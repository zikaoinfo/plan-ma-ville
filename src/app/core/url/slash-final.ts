/**
 * Forme canonique des URLs du site : AVEC slash final (`/ville/lyon-69123/`).
 *
 * Pourquoi : le prerender Angular (`outputMode: 'static'`) écrit un dossier par
 * route (`ville/lyon-69123/index.html`). GitHub Pages ne sert ce fichier qu'à
 * l'URL AVEC slash final : toute requête sur `/ville/lyon-69123` répond **301**
 * vers `/ville/lyon-69123/`. Le site publiait pourtant partout la forme SANS
 * slash (sitemap, `<link rel=canonical>`, `og:url`, `href` des `routerLink`) —
 * d'où les milliers de pages « Page avec redirection » de la Search Console et
 * le budget de crawl gaspillé. On aligne donc tout le site sur la forme
 * réellement servie en 200, sans rien changer à l'hébergement.
 *
 * Ces deux fonctions sont PURES (testées dans `slash-final.spec.ts`) et
 * servent à la fois au routeur (`SlashFinalUrlSerializer`) et au SEO
 * (`MetaService`, `core/seo/schemas.ts`).
 */

/** Sépare le chemin de la query/du fragment (`/a/b?x=1#y` → `['/a/b', '?x=1#y']`). */
function decoupe(url: string): [chemin: string, suite: string] {
  const i = url.search(/[?#]/);
  return i === -1 ? [url, ''] : [url.slice(0, i), url.slice(i)];
}

/**
 * Ajoute le slash final au CHEMIN (jamais après la query ni le fragment).
 * La racine `/` et un chemin déjà terminé par `/` sont renvoyés tels quels.
 */
export function avecSlashFinal(url: string): string {
  const [chemin, suite] = decoupe(url);
  if (chemin === '') return `/${suite}`;
  return (chemin.endsWith('/') ? chemin : `${chemin}/`) + suite;
}

/**
 * Retire le(s) slash(s) final(aux) du CHEMIN. La racine `/` est préservée :
 * c'est la seule URL du site dont le slash final fait partie du chemin.
 */
export function sansSlashFinal(url: string): string {
  const [chemin, suite] = decoupe(url);
  let net = chemin;
  while (net.length > 1 && net.endsWith('/')) net = net.slice(0, -1);
  return (net === '' ? '/' : net) + suite;
}
