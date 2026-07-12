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
  /** URL du fichier (CSV, CSV.gz ou ZIP). */
  url: string;
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

  const response = await fetch(spec.url, {
    headers: { 'User-Agent': 'ma-ville-notee/data-pipeline (open data)' },
  });
  if (!response.ok) {
    throw new Error(`Source "${name}" — ${spec.url} a répondu ${response.status} ${response.statusText}`);
  }
  const raw = Buffer.from(await response.arrayBuffer());
  const csv = decompress(raw, spec, name);

  await mkdir(cacheDir, { recursive: true });
  await writeFile(csvPath, csv);
  return csvPath;
}

function decompress(raw: Buffer, spec: SourceSpec, name: string): Buffer {
  const url = spec.url.toLowerCase();
  if (url.endsWith('.gz')) return gunzipSync(raw);
  if (url.endsWith('.zip')) {
    const zip = new AdmZip(raw);
    const motif = spec.entry ? new RegExp(spec.entry, 'i') : /\.csv$/i;
    const entree = zip.getEntries().find((e) => motif.test(e.entryName));
    if (!entree) {
      const dispo = zip.getEntries().map((e) => e.entryName).join(', ');
      throw new Error(`Source "${name}" — aucune entrée ${motif} dans le zip (contient : ${dispo})`);
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
      let row: Record<string, string> | null;
      while ((row = parser.read() as Record<string, string> | null) !== null) onRow(row);
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
