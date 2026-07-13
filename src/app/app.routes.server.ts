import { RenderMode, type ServerRoute } from '@angular/ssr';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  DepartementsFile,
  RegionsFile,
  SearchIndexFile,
} from './core/models/data.models';

const RACINE = process.cwd();

/** Population minimale pour prérendre la page d'une commune (SEO). */
const MIN_POP_DEFAUT = 5000;

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
      const deps = lireJson<DepartementsFile>('public/data/departements.json')?.items ?? [];
      info(`${deps.length} pages département`);
      return deps.map((d) => ({ code: d.code }));
    },
  },
  {
    path: 'ville/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const seuil = seuilPopulation();
      const items = lireJson<SearchIndexFile>('public/data/index.json')?.items ?? [];
      const retenues = items.filter((it) => it.p >= seuil);
      info(
        items.length === 0
          ? 'public/data/index.json absent — aucune page commune prérendue (build local)'
          : `${retenues.length} pages commune (population ≥ ${seuil})`,
      );
      return retenues.map((it) => ({ slug: it.s }));
    },
  },
  // Tout le reste (communes non prérendues, URLs inconnues) : rendu client
  // via le fallback SPA 404.html de GitHub Pages.
  { path: '**', renderMode: RenderMode.Client },
];
