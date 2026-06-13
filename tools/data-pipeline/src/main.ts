import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { CRITERES, type Critere } from './models.js';
import type {
  ClassementFile,
  DepartementDetailFile,
  DepartementsFile,
  SearchIndexFile,
} from './models.js';
import { fetchCommunes } from './fetch/geo.js';
import { fakeScores } from './score/fake.js';
import { noteGlobale } from './score/aggregate.js';
import { emitAll, slugify, type CommuneScoree } from './emit/index.js';
import { DEPARTEMENTS } from './emit/departements.js';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = path.resolve(SRC_DIR, '..');
const REPO_ROOT = path.resolve(PIPELINE_DIR, '../..');
const OUT_DIR = path.join(REPO_ROOT, 'public/data');

interface ScoringConfig {
  version: number;
  populationMinClassement: number;
  ponderations: Record<Critere, number>;
}

function parseDepartementsArg(argv: string[]): string[] | undefined {
  const idx = argv.indexOf('--departements');
  if (idx === -1) return undefined;
  const valeur = argv[idx + 1];
  if (!valeur) {
    console.error('Usage : --departements 69,75');
    process.exit(1);
  }
  return valeur.split(',').map((c) => c.trim());
}

// ─────────────────────────────────────────────
// Validation des 6 invariants contractuels (spec §1)
// ─────────────────────────────────────────────

function estNoteValide(x: number): boolean {
  return x >= 0 && x <= 10 && Math.abs(x * 10 - Math.round(x * 10)) < 1e-9;
}

async function lireJson<T>(fichier: string): Promise<T> {
  return JSON.parse(await readFile(path.join(OUT_DIR, fichier), 'utf8')) as T;
}

async function validerInvariants(): Promise<string[]> {
  const erreurs: string[] = [];
  const index = await lireJson<SearchIndexFile>('index.json');
  const departements = await lireJson<DepartementsFile>('departements.json');
  const classement = await lireJson<ClassementFile>('classement.json');

  const depFiles = new Map<string, DepartementDetailFile>();
  for (const { code } of departements.items) {
    depFiles.set(code, await lireJson<DepartementDetailFile>(path.join('dep', `${code}.json`)));
  }

  // 1. Toute note ∈ [0,10], exactement 1 décimale.
  for (const item of index.items) {
    if (!estNoteValide(item.g)) erreurs.push(`Invariant 1 : note globale invalide ${item.g} (${item.s})`);
  }
  for (const entry of [...classement.top, ...classement.flop]) {
    if (!estNoteValide(entry.global)) {
      erreurs.push(`Invariant 1 : note classement invalide ${entry.global} (${entry.slug})`);
    }
  }
  for (const dep of depFiles.values()) {
    for (const commune of dep.communes) {
      if (!estNoteValide(commune.score.global)) {
        erreurs.push(`Invariant 1 : note globale invalide ${commune.score.global} (${commune.slug})`);
      }
      for (const critere of CRITERES) {
        if (!estNoteValide(commune.score.criteres[critere])) {
          erreurs.push(`Invariant 1 : note ${critere} invalide (${commune.slug})`);
        }
      }
    }
  }

  // 2. index.json trié par nn croissant.
  for (let i = 1; i < index.items.length; i++) {
    if (index.items[i - 1].nn > index.items[i].nn) {
      erreurs.push(`Invariant 2 : index non trié à la position ${i} ("${index.items[i].nn}")`);
      break;
    }
  }

  // 3. Slugs uniques sur tout le territoire.
  const slugs = new Set<string>();
  for (const item of index.items) {
    if (slugs.has(item.s)) erreurs.push(`Invariant 3 : slug en double "${item.s}"`);
    slugs.add(item.s);
  }

  // 4. Chaque code INSEE de l'index présent dans exactement un dep/{d}.json.
  const occurrences = new Map<string, number>();
  for (const dep of depFiles.values()) {
    for (const commune of dep.communes) {
      occurrences.set(commune.codeInsee, (occurrences.get(commune.codeInsee) ?? 0) + 1);
    }
  }
  for (const item of index.items) {
    const n = occurrences.get(item.i) ?? 0;
    if (n !== 1) erreurs.push(`Invariant 4 : INSEE ${item.i} présent dans ${n} fichier(s) dep/`);
  }

  // 5. Pas d'arrondissements municipaux en double avec la commune mère.
  const arrondissement = /^(751[0-2][0-9]|6938[1-9]|132[01][0-9]|13216)$/;
  for (const item of index.items) {
    if (arrondissement.test(item.i)) {
      erreurs.push(`Invariant 5 : arrondissement municipal présent (${item.i} ${item.n})`);
    }
  }

  // 6. Codes Corse 2A/2B utilisables tels quels comme noms de fichiers.
  for (const code of ['2A', '2B']) {
    const attendu = index.items.some((item) => item.d === code);
    if (attendu && !depFiles.has(code)) {
      erreurs.push(`Invariant 6 : dep/${code}.json manquant`);
    }
  }

  return erreurs;
}

// ─────────────────────────────────────────────
// Orchestration
// ─────────────────────────────────────────────

async function main(): Promise<void> {
  const debut = Date.now();
  const filtreDeps = parseDepartementsArg(process.argv.slice(2));

  const sources = JSON.parse(
    await readFile(path.join(PIPELINE_DIR, 'sources.config.json'), 'utf8'),
  ) as { geoCommunes: string };
  const scoring = JSON.parse(
    await readFile(path.join(PIPELINE_DIR, 'scoring.config.json'), 'utf8'),
  ) as ScoringConfig;

  console.log('▸ Téléchargement des communes (geo.api.gouv.fr)…');
  const toutes = await fetchCommunes(sources.geoCommunes, path.join(PIPELINE_DIR, '.cache'));

  const retenues = toutes.filter(
    (c) =>
      c.codeDepartement in DEPARTEMENTS &&
      (filtreDeps === undefined || filtreDeps.includes(c.codeDepartement)),
  );
  if (retenues.length === 0) {
    console.error(`Aucune commune retenue (filtre : ${filtreDeps?.join(', ') ?? 'aucun'}).`);
    process.exit(1);
  }

  console.log(`▸ Scoring de ${retenues.length} communes…`);
  const scorees: CommuneScoree[] = retenues.map((c) => {
    const criteres = fakeScores(c.codeInsee, c.population);
    return {
      slug: slugify(c.nom, c.codeInsee),
      nom: c.nom,
      codeInsee: c.codeInsee,
      codesPostaux: c.codesPostaux,
      population: c.population,
      ...(c.lat !== undefined && c.lon !== undefined ? { lat: c.lat, lon: c.lon } : {}),
      codeDepartement: c.codeDepartement,
      score: {
        source: 'computed',
        global: noteGlobale(criteres, scoring.ponderations),
        criteres,
      },
    };
  });

  console.log('▸ Émission des fichiers public/data/…');
  const gen = new Date().toISOString().slice(0, 10);
  const rapport = await emitAll(scorees, {
    outDir: OUT_DIR,
    gen,
    populationMin: scoring.populationMinClassement,
    siteBaseUrl: 'https://zikaoinfo.github.io/plan-ma-ville',
  });

  console.log('▸ Validation des invariants…');
  const erreurs = await validerInvariants();
  if (erreurs.length > 0) {
    for (const erreur of erreurs) console.error(`  ✗ ${erreur}`);
    process.exit(1);
  }

  const fmt = (e: { nom: string; departement: string; global: number }) =>
    `${e.nom} (${e.departement}) — ${e.global}/10`;
  console.log('');
  console.log('── Rapport ──────────────────────────────');
  console.log(`Communes      : ${rapport.nbCommunes}`);
  console.log(`Départements  : ${rapport.nbDepartements}`);
  console.log(`index.json gz : ${(rapport.indexGzipBytes / 1024).toFixed(0)} Ko`);
  console.log(`Top 3         : ${rapport.top3.map(fmt).join(' · ')}`);
  console.log(`Flop 3        : ${rapport.flop3.map(fmt).join(' · ')}`);
  console.log(`Durée         : ${((Date.now() - debut) / 1000).toFixed(1)} s`);
  console.log('Invariants    : 6/6 OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
