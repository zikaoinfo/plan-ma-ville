import {
  buildCommuneMeta,
  findCommuneDetail,
  findIndexItem,
  injectMeta,
  notFoundMeta,
} from '../_lib/commune-meta.mjs';

const BASE_URL = 'https://planmaville.fr';

/**
 * `/ville/:slug` — corrige le 404 HTTP du fallback SPA (cf. P0 pré-lancement) :
 * chaque URL de fiche commune doit répondre 200 avec des balises OG correctes,
 * qu'elle soit prérendue (SSG) ou non (~32 000 des 35 000 communes, sous le
 * seuil `prerenderMinPopulation`).
 *
 * `_routes.json` restreint cette Function à `/ville/*` : toutes les autres
 * routes (accueil, régions, départements — intégralement prérendues) passent
 * directement par les assets statiques, sans invocation de Function.
 */
export async function onRequestGet({ request, env, params }) {
  // 1. Commune prérendue : l'asset statique existe déjà (index.html généré au
  //    build, meta déjà correctes) → servi tel quel, AUCUNE régression.
  //    (Cloudflare route les Functions AVANT les assets statiques par
  //    défaut : on doit vérifier nous-mêmes l'asset via le binding ASSETS.)
  const assetRes = await env.ASSETS.fetch(request);
  if (assetRes.status !== 404) return assetRes;

  // 2. Commune non prérendue (ou slug invalide) : shell CSR (déjà utilisé par
  //    l'ancien fallback GitHub Pages, cf. tools/copy-404.mjs) + meta de LA
  //    commune demandée injectées à la volée, HTTP 200.
  const shellRes = await env.ASSETS.fetch(new URL('/index.csr.html', request.url));
  if (shellRes.status === 404) return shellRes; // shell absent : ne pas fabriquer une 200 mensongère

  const slug = String(params.slug ?? '').toLowerCase();
  const meta = await resolveMeta(env, request.url, slug);
  const html = injectMeta(await shellRes.text(), meta, BASE_URL);

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

async function resolveMeta(env, requestUrl, slug) {
  try {
    const indexRes = await env.ASSETS.fetch(new URL('/data/index.json', requestUrl));
    if (!indexRes.ok) return notFoundMeta(slug);
    const item = findIndexItem(await indexRes.json(), slug);
    if (!item) return notFoundMeta(slug);

    const depRes = await env.ASSETS.fetch(new URL(`/data/dep/${item.d}.json`, requestUrl));
    if (!depRes.ok) return notFoundMeta(slug);
    const detail = findCommuneDetail(await depRes.json(), slug);
    if (!detail) return notFoundMeta(slug);

    return buildCommuneMeta(item, detail);
  } catch {
    // Donnée corrompue/absente : repli honnête plutôt qu'une page cassée.
    return notFoundMeta(slug);
  }
}
