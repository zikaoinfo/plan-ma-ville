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
import { fetchBpe } from './fetch/bpe.js';
import { fetchSecurite } from './fetch/securite.js';
import { fetchFilosofi } from './fetch/filosofi.js';
import type { SourceSpec } from './fetch/download.js';
import { computeRealScores, type DataMaps } from './score/real.js';
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
  /** Gamma d'ajustement par critère (< 1 relève/homogénéise vers le haut). */
  boost?: Partial<Record<Critere, number>>;
}

interface SourcesConfig {
  geoCommunes: string;
  bpe: SourceSpec;
  securite: SourceSpec;
  filosofi: SourceSpec;
}

/**
 * Exécute un fetch de source ; en cas d'échec (URL/format/réseau), logge un
 * avertissement explicite et renvoie un repli neutre. Objectif : ne jamais
 * bloquer tout le déploiement pour une source indisponible — le critère
 * concerné bascule sur la médiane nationale.
 */
async function fetchOrWarn<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`  ⚠ ${label} indisponible → repli médiane : ${(err as Error).message}`);
    return fallback;
  }
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
  const argv = process.argv.slice(2);
  const filtreDeps = parseDepartementsArg(argv);
  // --strict : échoue si une source open data a 0 % de couverture (gate de CI
  // de validation des URLs ; le déploiement normal reste en dégradation gracieuse).
  const strict = argv.includes('--strict');

  const cacheDir = path.join(PIPELINE_DIR, '.cache');
  const sources = JSON.parse(
    await readFile(path.join(PIPELINE_DIR, 'sources.config.json'), 'utf8'),
  ) as SourcesConfig;
  const scoring = JSON.parse(
    await readFile(path.join(PIPELINE_DIR, 'scoring.config.json'), 'utf8'),
  ) as ScoringConfig;

  console.log('▸ Téléchargement des communes (geo.api.gouv.fr)…');
  const toutes = await fetchCommunes(sources.geoCommunes, cacheDir);

  const retenues = toutes.filter(
    (c) =>
      c.codeDepartement in DEPARTEMENTS &&
      (filtreDeps === undefined || filtreDeps.includes(c.codeDepartement)),
  );
  if (retenues.length === 0) {
    console.error(`Aucune commune retenue (filtre : ${filtreDeps?.join(', ') ?? 'aucun'}).`);
    process.exit(1);
  }

  console.log('▸ Téléchargement des sources open data (BPE, SSMSI, Filosofi)…');
  const [bpe, securite, filosofi] = await Promise.all([
    fetchOrWarn('BPE', () => fetchBpe(sources.bpe, cacheDir), new Map()),
    fetchOrWarn(
      'SSMSI',
      () => fetchSecurite(sources.securite, cacheDir),
      { map: new Map(), millesime: NaN },
    ),
    fetchOrWarn('Filosofi', () => fetchFilosofi(sources.filosofi, cacheDir), new Map()),
  ]);
  const maps: DataMaps = { bpe, securite: securite.map, filosofi };
  const couverture = {
    bpe: retenues.filter((c) => bpe.has(c.codeInsee)).length,
    securite: retenues.filter((c) => maps.securite.has(c.codeInsee)).length,
    filosofi: retenues.filter((c) => filosofi.has(c.codeInsee)).length,
  };

  console.log(`▸ Scoring de ${retenues.length} communes (rang percentile national)…`);
  const notesParCommune = computeRealScores(
    retenues.map((c) => ({ codeInsee: c.codeInsee, population: c.population })),
    maps,
    scoring.boost,
  );
  const scorees: CommuneScoree[] = retenues.map((c) => {
    const criteres = notesParCommune.get(c.codeInsee)!;
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
  const pct = (n: number) => `${((100 * n) / retenues.length).toFixed(0)}%`;
  // Distribution des notes globales par tranche de 2 points (courbe attendue ~ normale).
  const tranches = [0, 0, 0, 0, 0];
  for (const c of scorees) tranches[Math.min(4, Math.floor(c.score.global / 2))]++;
  const histo = ['0-2', '2-4', '4-6', '6-8', '8-10']
    .map((label, i) => `${label}:${pct(tranches[i])}`)
    .join('  ');

  // Diag : étendue des notes par critère (doit couvrir ~0→10, meilleure = 10).
  const statCritere = CRITERES.map((crit) => {
    const vals = scorees.map((s) => s.score.criteres[crit]).sort((a, b) => a - b);
    const med = vals[Math.floor(vals.length / 2)];
    return `${crit}: ${vals[0].toFixed(1)}–${vals[vals.length - 1].toFixed(1)} (méd ${med.toFixed(1)})`;
  });
  // Diag : communes de référence (grandes villes + une aisée).
  const refs = ['75056', '69123', '13055', '92051', '31555'];
  const parInsee = new Map(scorees.map((s) => [s.codeInsee, s]));

  console.log('');
  console.log('── Rapport ──────────────────────────────');
  console.log(`Communes      : ${rapport.nbCommunes}`);
  console.log(`Départements  : ${rapport.nbDepartements}`);
  console.log(`Régions       : ${rapport.nbRegions}`);
  console.log(`index.json gz : ${(rapport.indexGzipBytes / 1024).toFixed(0)} Ko`);
  console.log(
    `Couverture    : BPE ${pct(couverture.bpe)} · SSMSI ${pct(couverture.securite)}` +
      `${Number.isNaN(securite.millesime) ? '' : ` (${securite.millesime})`}` +
      ` · Filosofi ${pct(couverture.filosofi)}`,
  );
  console.log(`Notes /tranche: ${histo}`);
  console.log('Étendue notes/critère :');
  for (const l of statCritere) console.log(`   ${l}`);
  console.log('Communes réf. (securite | sante | niveauVie | global) :');
  for (const insee of refs) {
    const s = parInsee.get(insee);
    if (s) {
      const c = s.score.criteres;
      console.log(
        `   ${s.nom} (${insee}) : ${c.securite} | ${c.sante} | ${c.niveauVie} | ${s.score.global}`,
      );
    }
  }
  console.log(`Top 3         : ${rapport.top3.map(fmt).join(' · ')}`);
  console.log(`Flop 3        : ${rapport.flop3.map(fmt).join(' · ')}`);
  console.log(`Durée         : ${((Date.now() - debut) / 1000).toFixed(1)} s`);
  console.log('Invariants    : 6/6 OK');

  if (strict) {
    const vides = (
      [
        ['BPE', couverture.bpe],
        ['SSMSI', couverture.securite],
        ['Filosofi', couverture.filosofi],
      ] as const
    )
      .filter(([, n]) => n === 0)
      .map(([nom]) => nom);
    if (vides.length > 0) {
      console.error(
        `\n✗ --strict : couverture nulle pour ${vides.join(', ')} — vérifier les URLs ` +
          `dans sources.config.json (voir les ⚠ ci-dessus : statut HTTP / entrées zip).`,
      );
      process.exit(1);
    }
    console.log('Couverture    : toutes les sources > 0 (strict OK)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
