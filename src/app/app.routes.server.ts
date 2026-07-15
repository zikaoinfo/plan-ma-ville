import { RenderMode, type ServerRoute } from '@angular/ssr';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ClassementFile,
  DepartementsFile,
  RegionsFile,
  SearchIndexFile,
} from './core/models/data.models';

const RACINE = process.cwd();

/** Population minimale pour prérendre la page d'une commune (SEO). */
const MIN_POP_DEFAUT = 5000;

/**
 * Départements ciblés par la campagne d'acquisition en cours (P0 pré-lancement,
 * cf. docs/MIGRATION-CLOUDFLARE-PAGES.md) : leurs communes sont TOUJOURS
 * prérendues, même sous le seuil de population, pour de vraies pages SSG
 * (meilleur signal SEO que le fallback dynamique de la Pages Function) sur
 * les zones les plus susceptibles d'être partagées dans l'immédiat. À
 * compléter au fur et à mesure des départements visés par la presse.
 */
const DEPARTEMENTS_CAMPAGNE = ['75', '93', '94'];

function lireJson<T>(chemin: string): T | null {
  try {
    return JSON.parse(readFileSync(join(RACINE, chemin), 'utf8')) as T;
  } catch {
    return null;
  }
}

function seuilPopulation(): number {
  const scoring = lireJson<{ prerenderMinPopulation?: number }>(
    'tools/data-pipeline/scoring.config.json',
  );
  return scoring?.prerenderMinPopulation ?? MIN_POP_DEFAUT;
}

function seuilHubAutour(): number {
  const scoring = lireJson<{ hubAutourMinPopulation?: number }>(
    'tools/data-pipeline/scoring.config.json',
  );
  return scoring?.hubAutourMinPopulation ?? 50000;
}

function codesDepartements(): { code: string }[] {
  const deps = lireJson<DepartementsFile>('public/data/departements.json')?.items ?? [];
  return deps.map((d) => ({ code: d.code }));
}

/** Log en une ligne, seulement au moment du build (jamais côté navigateur). */
function info(msg: string): void {
  console.log(`  · prerender : ${msg}`);
}

/**
 * Stratégie de rendu par route (outputMode: 'static' → tout est généré au
 * build, aucun serveur Node au runtime). Les paramètres proviennent des JSON
 * émis par le pipeline (`data:build` tourne AVANT `ng build` en CI). En local
 * sans données, les listes sont vides : seules les pages fixes sont prérendues
 * et les routes paramétrées retombent sur le fallback SPA (404.html).
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'regions', renderMode: RenderMode.Prerender },
  { path: 'classement', renderMode: RenderMode.Prerender },
  { path: 'comparer', renderMode: RenderMode.Prerender },
  { path: 'methodologie', renderMode: RenderMode.Prerender },
  { path: 'carte', renderMode: RenderMode.Prerender },
  {
    path: 'region/:code',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const regions = lireJson<RegionsFile>('public/data/regions.json')?.items ?? [];
      info(`${regions.length} pages région`);
      return regions.map((r) => ({ code: r.code }));
    },
  },
  {
    path: 'departement/:code',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const deps = codesDepartements();
      info(`${deps.length} pages département`);
      return deps;
    },
  },
  {
    path: 'palmares/securite/:code',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const deps = codesDepartements();
      info(`${deps.length} palmarès sécurité`);
      return deps;
    },
  },
  {
    path: 'palmares/prix/:code',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const deps = codesDepartements();
      info(`${deps.length} palmarès prix`);
      return deps;
    },
  },
  {
    path: 'palmares/autour/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const seuil = seuilHubAutour();
      const items = lireJson<SearchIndexFile>('public/data/index.json')?.items ?? [];
      const grandes = items.filter((it) => it.p >= seuil);
      info(`${grandes.length} pages « autour de » (population ≥ ${seuil})`);
      return grandes.map((it) => ({ slug: it.s }));
    },
  },
  {
    path: 'ville/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const seuil = seuilPopulation();
      const items = lireJson<SearchIndexFile>('public/data/index.json')?.items ?? [];
      const classement = lireJson<ClassementFile>('public/data/classement.json');

      // Seuil de population, + top/flop national (pages les plus consultées/
      // partagées), + départements ciblés par la campagne en cours (intégralement,
      // quelle que soit la population) — cf. DEPARTEMENTS_CAMPAGNE ci-dessus.
      const slugs = new Set<string>();
      for (const it of items) {
        if (it.p >= seuil || DEPARTEMENTS_CAMPAGNE.includes(it.d)) slugs.add(it.s);
      }
      for (const entry of [...(classement?.top ?? []), ...(classement?.flop ?? [])]) {
        slugs.add(entry.slug);
      }

      info(
        items.length === 0
          ? 'public/data/index.json absent — aucune page commune prérendue (build local)'
          : `${slugs.size} pages commune (population ≥ ${seuil}, top/flop national, départements ${DEPARTEMENTS_CAMPAGNE.join(', ')})`,
      );
      return [...slugs].map((slug) => ({ slug }));
    },
  },
  // Tout le reste (communes non prérendues, URLs inconnues) : rendu client via
  // le shell CSR (index.csr.html), servi en 200 par la Pages Function
  // `functions/ville/[slug].js` (Cloudflare) ou par `public/_redirects` pour
  // les autres routes ; 404.html sert le même rôle côté GitHub Pages (statut
  // 404, cf. docs/MIGRATION-CLOUDFLARE-PAGES.md).
  { path: '**', renderMode: RenderMode.Client },
];
