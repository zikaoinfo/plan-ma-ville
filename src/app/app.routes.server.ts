import { RenderMode, type ServerRoute } from '@angular/ssr';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DepartementsFile, RegionsFile, SearchIndexFile } from './core/models/data.models';

const RACINE = process.cwd();

/** Population minimale pour prérendre la page d'une commune (SEO). */
const MIN_POP_DEFAUT = 0;

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
 * Sharding du build (cf. tools/build-prerender.mjs) : prérendre les ~35 000
 * communes dans UN SEUL process `ng build` sature le tas V8 (constaté en CI —
 * heap ~4,1 Go atteint puis `JavaScript heap out of memory` après ~20 min,
 * sans avoir fini). Le script d'orchestration relance `ng build` plusieurs
 * fois avec PRERENDER_SHARD_INDEX/COUNT, chaque process ne rendant qu'une
 * tranche modulo des communes avant de repartir de zéro (mémoire remise à
 * plat entre deux shards) ; les dossiers `browser/ville/*` de chaque shard
 * sont ensuite fusionnés. Par défaut (vars absentes, ex. `ng build` lancé à
 * la main) : un seul shard, comportement inchangé.
 */
const SHARD_INDEX = Number(process.env['PRERENDER_SHARD_INDEX'] ?? 0);
const SHARD_COUNT = Math.max(1, Number(process.env['PRERENDER_SHARD_COUNT'] ?? 1));

/**
 * Seul le premier shard prérend les pages fixes et les petites listes
 * paramétrées (régions, départements, palmarès, hubs « autour de » — quelques
 * centaines de pages en tout) : les regénérer à l'identique sur chaque shard
 * serait un travail redondant pur. Les autres shards les laissent en
 * RenderMode.Client (aucun fichier émis, le script d'orchestration ne
 * conserve de toute façon que `browser/ville/*` des shards > 0).
 */
const modePrincipal = SHARD_INDEX === 0 ? RenderMode.Prerender : RenderMode.Client;

function routeFixe(path: string): ServerRoute {
  return modePrincipal === RenderMode.Prerender
    ? { path, renderMode: RenderMode.Prerender }
    : { path, renderMode: RenderMode.Client };
}

function routeParametree(
  path: string,
  getPrerenderParams: () => Promise<Record<string, string>[]>,
): ServerRoute {
  return modePrincipal === RenderMode.Prerender
    ? { path, renderMode: RenderMode.Prerender, getPrerenderParams }
    : { path, renderMode: RenderMode.Client };
}

/**
 * Stratégie de rendu par route (outputMode: 'static' → tout est généré au
 * build, aucun serveur Node au runtime). Les paramètres proviennent des JSON
 * émis par le pipeline (`data:build` tourne AVANT `ng build` en CI). En local
 * sans données, les listes sont vides : seules les pages fixes sont prérendues
 * et les routes paramétrées retombent sur le fallback SPA (404.html).
 */
export const serverRoutes: ServerRoute[] = [
  routeFixe(''),
  routeFixe('regions'),
  routeFixe('classement'),
  routeFixe('comparer'),
  routeFixe('methodologie'),
  routeFixe('carte'),
  routeParametree('region/:code', async () => {
    const regions = lireJson<RegionsFile>('public/data/regions.json')?.items ?? [];
    info(`${regions.length} pages région`);
    return regions.map((r) => ({ code: r.code }));
  }),
  routeParametree('departement/:code', async () => {
    const deps = codesDepartements();
    info(`${deps.length} pages département`);
    return deps;
  }),
  routeParametree('palmares/securite/:code', async () => {
    const deps = codesDepartements();
    info(`${deps.length} palmarès sécurité`);
    return deps;
  }),
  routeParametree('palmares/prix/:code', async () => {
    const deps = codesDepartements();
    info(`${deps.length} palmarès prix`);
    return deps;
  }),
  routeParametree('palmares/autour/:slug', async () => {
    const seuil = seuilHubAutour();
    const items = lireJson<SearchIndexFile>('public/data/index.json')?.items ?? [];
    const grandes = items.filter((it) => it.p >= seuil);
    info(`${grandes.length} pages « autour de » (population ≥ ${seuil})`);
    return grandes.map((it) => ({ slug: it.s }));
  }),
  {
    path: 'ville/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const seuil = seuilPopulation();
      const items = lireJson<SearchIndexFile>('public/data/index.json')?.items ?? [];
      const eligibles = items.filter((it) => it.p >= seuil);
      const slugs =
        SHARD_COUNT > 1
          ? eligibles.filter((_, i) => i % SHARD_COUNT === SHARD_INDEX).map((it) => it.s)
          : eligibles.map((it) => it.s);

      info(
        items.length === 0
          ? 'public/data/index.json absent — aucune page commune prérendue (build local)'
          : `${slugs.length}/${eligibles.length} pages commune (population ≥ ${seuil}, shard ${SHARD_INDEX + 1}/${SHARD_COUNT})`,
      );
      return slugs.map((slug) => ({ slug }));
    },
  },
  // Toute commune est prérendue (seuil de population à 0, cf. scoring.config.json) :
  // ce fallback ne sert plus qu'aux URLs inconnues (slug invalide) et aux builds
  // locaux sans données (public/data/index.json absent, cf. commentaire ci-dessus).
  { path: '**', renderMode: RenderMode.Client },
];
