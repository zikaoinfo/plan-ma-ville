# Architecture — build, prerender (SSG) et URLs canoniques

Détail extrait de `CLAUDE.md` (chargé à la demande). **À lire avant toute modif du
build, du prerender, d’une URL publiée, du sitemap ou d’un workflow de déploiement**
(voir aussi `docs/SEO-INDEXATION.md`).

- **SSG/prerender (SEO)** : `outputMode: 'static'` + `src/main.server.ts`
  (bootstrap AVEC `BootstrapContext` — NG0401 sinon) + routes serveur dans
  `src/app/app.routes.server.ts` : pages fixes + `region/:code` +
  `departement/:code` + `ville/:slug` (communes ≥ `prerenderMinPopulation`
  de scoring.config.json, **0 depuis la correction du 404 bots** → les
  ~35 000 communes sont toutes prérendues, cf. section Déploiement), reste en
  `RenderMode.Client` (fallback SPA 404.html, ne sert plus qu'aux slugs
  inconnus et aux builds locaux sans données). **Build shardé (`npm run
  build` = `tools/build-prerender.mjs` + `copy-404.mjs`)** : prérendre les
  ~35 000 communes dans UN SEUL `ng build` sature le tas V8 (constaté en CI —
  `JavaScript heap out of memory` après ~20 min, heap ~4,1 Go, sans avoir
  fini). `build-prerender.mjs` relance `ng build` plusieurs fois
  (`PAGES_PAR_SHARD = 2000` → ~18 shards), chaque process ne prérendant
  qu'une tranche modulo des communes (`PRERENDER_SHARD_INDEX`/`_COUNT` lus
  par `app.routes.server.ts`, mémoire remise à plat entre deux shards
  puisque ce sont des process distincts), puis fusionne les dossiers
  `browser/ville/*` de chaque shard. Seul le shard 0 prérend aussi les pages
  fixes et les petites listes paramétrées (région/département/palmarès/hubs
  « autour de » — RenderMode.Client sur les autres shards, sinon regénérées
  N fois pour rien). Sans les variables d'env (`ng build` lancé à la main) :
  un seul shard, comportement inchangé. Si l'OOM revient (jeu de données
  encore plus gros), baisser `PAGES_PAR_SHARD`. **Piège du prerender async
  contourné** : intercepteur serveur `core/prerender/donnees-locales.interceptor.ts`
  qui sert `data/*.json` depuis le disque en synchrone (data:build tourne
  AVANT ng build en CI). `document.baseURI` N'EXISTE PAS dans le DOM serveur →
  toujours passer par `core/data-url.ts` (`dataUrl`/`baseUri`) pour les URLs de
  données ; idem `dataset` sur documentElement (utiliser setAttribute).
  Hydratation activée avec `withNoHttpTransferCache` (sinon index.json ~Mo
  embarqué dans chaque HTML). Le sitemap inclut les mêmes communes ≥ seuil.
  **Balise robots globale (sens INVERSÉ depuis le fix indexation)** :
  `src/index.html` porte un marqueur vide `<!-- SEO_ROBOTS -->` → le site est
  indexable **par défaut**. Les 3 workflows de déploiement *posent* le
  `noindex` par `sed` quand il ne faut pas indexer (`SITE_INDEXABLE != 'true'`
  pour deploy.yml/data-refresh.yml ; **toujours** pour
  deploy-cloudflare-pages.yml, qui ne publie que sur une préversion
  `*.pages.dev`). La version précédente écrivait le `noindex` en dur et
  comptait sur chaque workflow pour le retirer : **data-refresh.yml n'avait
  pas l'étape**, donc chaque rafraîchissement mensuel des données redéployait
  les 35 000 pages en `noindex` jusqu'au push suivant sur `main` (cause de
  l'effondrement des impressions d'août 2026). Ne JAMAIS remettre une balise
  robots littérale dans un commentaire d'index.html : les workflows vérifient
  la substitution par `grep`.
- **URLs canoniques = AVEC slash final** (`src/app/core/url/`, cf.
  `docs/SEO-INDEXATION.md`) : le prerender écrit un dossier par route
  (`ville/{slug}/index.html`) et GitHub Pages ne sert ce fichier en 200 qu'à
  `…/ville/{slug}/` — la forme sans slash répond **301**. Le site publiait
  pourtant partout la forme sans slash (sitemap, canonique, `og:url`, JSON-LD,
  `href` des routerLink) → 7 129 pages « Page avec redirection » en GSC et
  autant de budget de crawl brûlé. **Pire** : `DefaultUrlSerializer` découpe
  `/ville/x/` en TROIS segments (`['ville','x','']`), donc la route
  `ville/:slug` ne matchait pas, le wildcard `**` rendait « Commune
  introuvable » et posait un `noindex` à l'hydratation — sur l'URL même que
  Google crawle. Google exécutant le JS, il désindexait la page. Corrigé par
  `SlashFinalUrlSerializer` (parse tolérant, serialize canonique) fourni dans
  `app.config.ts`, plus `avecSlashFinal()` dans `MetaService`,
  `core/seo/schemas.ts`, `functions/_lib/commune-meta.mjs` et `urlsSitemap()`
  du pipeline. **Toute nouvelle URL publiée doit passer par ces helpers.**
  Non-régression : `core/url/routes-slash-final.spec.ts` (échoue sur les 12
  routes du site sans le sérialiseur). Audit en ligne : `npm run seo:audit`
  (`tools/audit-urls.mjs` — 0 redirection, 0 `noindex` attendus).
- **Jamais de `noindex` sur un état de CHARGEMENT** : Googlebot photographie le
  DOM à un instant donné ; un `noindex` transitoire désindexe une page valide.
  Les pages ne le posent que sur un état définitif (`erreur()`,
  `introuvable()`, `not-found`).

## Historique : 404 bots corrigé par prérendu intégral

- **404 bots corrigé par prérendu intégral (au lieu de la bascule Cloudflare)** :
  GitHub Pages servait son fallback SPA (`404.html`) en statut HTTP **404**
  pour toute commune non prérendue → aucune preview OG, non indexable. Plutôt
  que de dépendre d'un hébergeur tiers (Cloudflare Pages, cf.
  `docs/MIGRATION-CLOUDFLARE-PAGES.md` pour l'historique), `prerenderMinPopulation`
  (scoring.config.json) est passé à **0** : les ~35 000 communes ont désormais
  toutes un vrai HTML statique (`ville/:slug` dans `app.routes.server.ts`,
  logique de seuil simplifiée en conséquence — plus de cas spécial
  départements de campagne / top-flop, devenu redondant). Reste 100 % GitHub
  Pages, aucun compte/DNS externe requis. **Contrepartie rencontrée** : le
  premier déploiement a crashé en OOM (`ng build` prérendant les 34 920
  communes dans un seul process) → corrigé par le build shardé (cf. section
  SSG/prerender ci-dessus, `tools/build-prerender.mjs`). Le code de la
  migration Cloudflare (`functions/ville/[slug].js`,
  `deploy-cloudflare-pages.yml`, `wrangler.toml`) reste dans le repo (déploie
  toujours sans risque sur une URL de preview `*.pages.dev`, secrets
  Cloudflare absents → step sautée) mais n'est plus nécessaire pour ce
  problème ; à retirer si la piste Cloudflare est définitivement abandonnée.
