import { execSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ClassementEntry,
  ClassementFile,
  CommuneDetail,
  DepartementDetailFile,
  DepartementsFile,
  SearchIndexFile,
  SearchIndexItem,
} from '../models.js';
import { DEPARTEMENTS } from './departements.js';

/** Commune scorée, prête à être émise. */
export interface CommuneScoree extends CommuneDetail {
  codeDepartement: string;
}

/** Normalisation spec §3.4 : minuscules, sans accents, '/- → espace. */
export function normaliseNom(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug = nom normalisé en kebab-case + code INSEE : "saint-denis-93066". */
export function slugify(nom: string, codeInsee: string): string {
  return `${normaliseNom(nom).replace(/ /g, '-')}-${codeInsee}`;
}

export interface EmitResult {
  nbCommunes: number;
  nbDepartements: number;
  indexGzipBytes: number;
  top3: ClassementEntry[];
  flop3: ClassementEntry[];
}

/** Tri déterministe : nn croissant, départagé par code INSEE. */
function parNn(a: { nn: string; i: string }, b: { nn: string; i: string }): number {
  return a.nn < b.nn ? -1 : a.nn > b.nn ? 1 : a.i < b.i ? -1 : 1;
}

async function emitSitemap(
  file: string,
  base: string,
  codes: string[],
  gen: string,
): Promise<void> {
  const root = base.replace(/\/$/, '');
  const paths = ['/', '/classement', '/methodologie', ...codes.map((c) => `/departement/${c}`)];
  const urls = paths
    .map((p) => `  <url><loc>${root}${p}</loc><lastmod>${gen}</lastmod></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  await writeFile(file, xml, 'utf8');
}

export async function emitAll(
  communes: CommuneScoree[],
  options: { outDir: string; gen: string; populationMin: number; siteBaseUrl: string },
): Promise<EmitResult> {
  const { outDir, gen, populationMin, siteBaseUrl } = options;

  // Repart d'un répertoire propre pour éviter les fichiers dep/ orphelins
  // d'un run précédent (le README est préservé : il vit dans outDir et
  // seul dep/ + les 4 fichiers json racine sont régénérés).
  await rm(path.join(outDir, 'dep'), { recursive: true, force: true });
  await mkdir(path.join(outDir, 'dep'), { recursive: true });

  // ── index.json ────────────────────────────
  const items: SearchIndexItem[] = communes
    .map((c) => ({
      n: c.nom,
      nn: normaliseNom(c.nom),
      cp: c.codesPostaux,
      d: c.codeDepartement,
      s: c.slug,
      i: c.codeInsee,
      p: c.population,
      g: c.score.global,
    }))
    .sort(parNn);

  const indexFile: SearchIndexFile = { v: 1, gen, items };
  const indexPath = path.join(outDir, 'index.json');
  await writeFile(indexPath, JSON.stringify(indexFile), 'utf8');

  // ── dep/{code}.json ───────────────────────
  const parDepartement = new Map<string, CommuneScoree[]>();
  for (const commune of communes) {
    const liste = parDepartement.get(commune.codeDepartement) ?? [];
    liste.push(commune);
    parDepartement.set(commune.codeDepartement, liste);
  }

  const codes = [...parDepartement.keys()].sort();
  for (const code of codes) {
    const liste = (parDepartement.get(code) as CommuneScoree[])
      .slice()
      .sort((a, b) => parNn({ nn: normaliseNom(a.nom), i: a.codeInsee }, { nn: normaliseNom(b.nom), i: b.codeInsee }));
    const fichier: DepartementDetailFile = {
      v: 1,
      gen,
      code,
      nom: DEPARTEMENTS[code],
      communes: liste.map((c) => ({
        slug: c.slug,
        nom: c.nom,
        codeInsee: c.codeInsee,
        codesPostaux: c.codesPostaux,
        population: c.population,
        ...(c.lat !== undefined && c.lon !== undefined ? { lat: c.lat, lon: c.lon } : {}),
        score: c.score,
      })),
    };
    await writeFile(path.join(outDir, 'dep', `${code}.json`), JSON.stringify(fichier), 'utf8');
  }

  // ── departements.json ─────────────────────
  const departementsFile: DepartementsFile = {
    v: 1,
    gen,
    items: codes.map((code) => {
      const liste = parDepartement.get(code) as CommuneScoree[];
      const popTotale = liste.reduce((acc, c) => acc + c.population, 0);
      const noteMoyenne =
        liste.reduce((acc, c) => acc + c.score.global * c.population, 0) / popTotale;
      return {
        code,
        nom: DEPARTEMENTS[code],
        nbCommunes: liste.length,
        noteMoyenne: Math.round(noteMoyenne * 10) / 10,
      };
    }),
  };
  await writeFile(
    path.join(outDir, 'departements.json'),
    JSON.stringify(departementsFile),
    'utf8',
  );

  // ── classement.json ───────────────────────
  const eligibles: ClassementEntry[] = communes
    .filter((c) => c.population >= populationMin)
    .map((c) => ({
      slug: c.slug,
      nom: c.nom,
      departement: c.codeDepartement,
      population: c.population,
      global: c.score.global,
    }));

  const desc = eligibles
    .slice()
    .sort((a, b) => b.global - a.global || (a.slug < b.slug ? -1 : 1));
  const asc = eligibles
    .slice()
    .sort((a, b) => a.global - b.global || (a.slug < b.slug ? -1 : 1));

  const classementFile: ClassementFile = {
    v: 1,
    gen,
    populationMin,
    top: desc.slice(0, 50),
    flop: asc.slice(0, 50),
  };
  await writeFile(path.join(outDir, 'classement.json'), JSON.stringify(classementFile), 'utf8');

  // ── sitemap.xml (à la racine publique, pas dans data/) ──
  // Pages statiques + 1 URL par département. PAS d'URL par commune (35k =
  // inutile pour GitHub Pages).
  await emitSitemap(path.join(outDir, '..', 'sitemap.xml'), siteBaseUrl, codes, gen);

  const indexGzipBytes = Number(
    execSync(`gzip -c ${JSON.stringify(indexPath)} | wc -c`).toString().trim(),
  );

  return {
    nbCommunes: communes.length,
    nbDepartements: codes.length,
    indexGzipBytes,
    top3: classementFile.top.slice(0, 3),
    flop3: classementFile.flop.slice(0, 3),
  };
}
