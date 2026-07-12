import { closeSync, createReadStream, existsSync, openSync, readSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse';
import { parse as parseSync } from 'csv-parse/sync';

/** Cache local considéré frais pendant 30 jours (gitignoré). */
const MAX_CACHE_AGE_MS = 30 * 24 * 3600 * 1000;

export interface SourceSpec {
  /** URL directe du fichier (CSV, CSV.gz ou ZIP). Prioritaire sur `dataset`. */
  url?: string;
  /**
   * Slug d'un jeu de données data.gouv.fr : l'URL de la ressource est résolue
   * dynamiquement via l'API publique (`/api/1/datasets/<slug>/`). Évite de coder
   * en dur des UUID de ressources fragiles, et fonctionne depuis la CI.
   */
  dataset?: string;
  /**
   * Avec `dataset` : motif (regex) pour choisir la ressource (test sur
   * « titre + url »). Ex. `commun` pour la base communale.
   */
  resource?: string;
  /** Avec `dataset` : motif d'exclusion (ex. écarter les fichiers régionaux). */
  resourceExclude?: string;
  /** Avec `dataset` : filtre de format de ressource (ex. `csv`). */
  format?: string;
  /**
   * Pour une archive .zip : motif (regex, insensible à la casse) du nom de
   * l'entrée à extraire. Par défaut, la première entrée `.csv` de l'archive.
   */
  entry?: string;
  /**
   * Indice de colonne (regex) pour les sources où le nom de la variable dépend
   * du millésime (ex. Filosofi `MED21`). Auto-détection à défaut.
   */
  valueCol?: string;
}

const UA = 'ma-ville-notee/data-pipeline (open data)';

interface DataGouvResource {
  title?: string;
  format?: string;
  url: string;
}

/**
 * Résout l'URL de téléchargement : `url` directe si fournie, sinon la ressource
 * d'un jeu de données data.gouv.fr (filtrée par `format` puis `resource`). En
 * l'absence de correspondance, logge les ressources disponibles pour affiner le
 * motif — l'itération se fait alors simplement en lisant les logs CI.
 */
async function resolveUrl(name: string, spec: SourceSpec): Promise<string> {
  if (spec.url) return spec.url;
  if (!spec.dataset) throw new Error(`Source "${name}" : ni "url" ni "dataset" dans la config`);

  const api = `https://www.data.gouv.fr/api/1/datasets/${spec.dataset}/`;
  const res = await fetch(api, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    throw new Error(`Source "${name}" — API data.gouv ${res.status} (dataset ${spec.dataset})`);
  }
  const data = (await res.json()) as { resources: DataGouvResource[] };
  // Inventaire (aide au choix du motif `resource` en lisant les logs CI).
  const inventaire = data.resources
    .slice(0, 40)
    .map((r) => `      [${r.format}] ${r.title ?? ''} — ${r.url}`)
    .join('\n');
  console.log(`  · ${name} : ${data.resources.length} ressources data.gouv\n${inventaire}`);

  const fmt = spec.format?.toLowerCase();
  const motif = spec.resource ? new RegExp(spec.resource, 'i') : undefined;
  const exclu = spec.resourceExclude ? new RegExp(spec.resourceExclude, 'i') : undefined;

  const candidats = data.resources.filter((r) => {
    const cible = `${r.title ?? ''} ${r.url}`;
    if (fmt && (r.format ?? '').toLowerCase() !== fmt) return false;
    if (motif && !motif.test(cible)) return false;
    if (exclu && exclu.test(cible)) return false;
    return true;
  });
  if (candidats.length === 0) {
    throw new Error(
      `Source "${name}" — aucune ressource ${fmt ?? '*'}/${spec.resource ?? '*'} dans ${spec.dataset} (voir inventaire ci-dessus).`,
    );
  }
  console.log(`  · ${name} → ressource choisie : ${candidats[0].title ?? candidats[0].url}`);
  return candidats[0].url;
}

export interface CsvOptions {
  /** Délimiteur ; auto-détecté (`;` ou `,`) si absent. */
  delimiter?: string;
}

/**
 * Garantit la présence d'un CSV décompressé dans `.cache/{name}.csv` :
 * télécharge la source (sauf cache frais < 30 j), décompresse gz/zip une fois
 * sur le disque, puis renvoie le chemin local. Le parsing (streaming ou sync)
 * lit ensuite ce fichier — mémoire maîtrisée même pour les gros fichiers.
 */
export async function ensureCsv(name: string, spec: SourceSpec, cacheDir: string): Promise<string> {
  const csvPath = path.join(cacheDir, `${name}.csv`);

  if (existsSync(csvPath)) {
    const age = Date.now() - (await stat(csvPath)).mtimeMs;
    if (age < MAX_CACHE_AGE_MS) return csvPath;
  }

  const url = await resolveUrl(name, spec);
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) {
    throw new Error(`Source "${name}" — ${url} a répondu ${response.status} ${response.statusText}`);
  }
  const raw = Buffer.from(await response.arrayBuffer());
  const csv = decompress(raw, spec, name);

  await mkdir(cacheDir, { recursive: true });
  await writeFile(csvPath, csv);
  return csvPath;
}

/**
 * Décompresse selon les octets magiques (indépendant de l'extension d'URL :
 * gère les permaliens data.gouv `/datasets/r/<uuid>` sans extension).
 * gzip = 1F 8B ; zip = 50 4B ("PK").
 */
function decompress(raw: Buffer, spec: SourceSpec, name: string): Buffer {
  if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) return gunzipSync(raw);
  if (raw.length >= 2 && raw[0] === 0x50 && raw[1] === 0x4b) {
    const zip = new AdmZip(raw);
    const motif = spec.entry ? new RegExp(spec.entry, 'i') : /\.csv$/i;
    const entree = zip.getEntries().find((e) => motif.test(e.entryName));
    if (!entree) {
      const dispo = zip.getEntries().map((e) => e.entryName).join(', ');
      throw new Error(`Source "${name}" — aucune entrée /${motif.source}/ dans le zip (contient : ${dispo})`);
    }
    return entree.getData();
  }
  return raw;
}

/**
 * Parcourt un CSV en streaming (faible mémoire) : idéal pour les très gros
 * fichiers (SSMSI ≈ plusieurs millions de lignes). `columns: true` → chaque
 * ligne est un objet clé→valeur (première ligne = en-têtes).
 */
export function forEachCsvRow(
  csvPath: string,
  options: CsvOptions,
  onRow: (row: Record<string, string>) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parser = parse({
      columns: true,
      delimiter: options.delimiter ?? guessDelimiter(csvPath),
      relax_column_count: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    });
    parser.on('readable', () => {
      // Une exception de onRow dans un handler d'event s'échapperait en « uncaught »
      // (crash) : on la convertit en rejet de la promesse pour laisser fetchOrWarn
      // dégrader gracieusement.
      try {
        let row: Record<string, string> | null;
        while ((row = parser.read() as Record<string, string> | null) !== null) onRow(row);
      } catch (err) {
        parser.destroy();
        reject(err);
      }
    });
    parser.on('error', reject);
    parser.on('end', resolve);
    createReadStream(csvPath).on('error', reject).pipe(parser);
  });
}

/** Parse synchrone (petits fichiers ≤ quelques dizaines de milliers de lignes). */
export async function readCsvRows(
  csvPath: string,
  options: CsvOptions = {},
): Promise<Record<string, string>[]> {
  const texte = await readFile(csvPath, 'utf8');
  return parseSync(texte, {
    columns: true,
    delimiter: options.delimiter ?? guessDelimiterFromText(texte),
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[];
}

/** Détecte `;` vs `,` sur la première ligne du fichier. */
function guessDelimiter(csvPath: string): string {
  try {
    const debut = readFirstLine(csvPath);
    return debut.includes(';') ? ';' : ',';
  } catch {
    return ';';
  }
}

function guessDelimiterFromText(texte: string): string {
  const premiere = texte.slice(0, texte.indexOf('\n'));
  return premiere.includes(';') ? ';' : ',';
}

function readFirstLine(csvPath: string): string {
  // Lecture bornée : suffisant pour deviner le délimiteur d'en-tête.
  const fd = openSync(csvPath, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const texte = buf.toString('utf8', 0, n);
    const idx = texte.indexOf('\n');
    return idx === -1 ? texte : texte.slice(0, idx);
  } finally {
    closeSync(fd);
  }
}

/** Convertit un nombre au format français ("1 234,5") ou anglais en number. */
export function parseNumber(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const nettoye = v.replace(/\s/g, '').replace(',', '.');
  if (nettoye === '' || nettoye === 'N/A' || nettoye === 'ND' || nettoye === 'nd') return undefined;
  const n = Number(nettoye);
  return Number.isFinite(n) ? n : undefined;
}
