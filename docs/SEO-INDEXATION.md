# Correction de l'indexation (août 2026)

> Réponse au diagnostic Search Console du 17/08/2026 : 18 668 pages indexées
> (contre 20 908 le 25/07), 31 497 non indexées, impressions retombées de
> 2 373 à ~300/jour. Complète `docs/SEO-PLAN.md`, qui reste la stratégie de
> fond ; ce document traite les défauts **techniques** qui empêchaient cette
> stratégie de produire quoi que ce soit.

## Résumé

Trois défauts indépendants se cumulaient. Les deux premiers viennent de la même
cause racine — **le site publiait partout des URLs que le serveur ne sert pas** —
et le troisième désindexait le site entier une fois par mois.

| # | Défaut | Symptôme GSC | Correctif |
|---|---|---|---|
| 1 | Toutes les URLs publiées (sitemap, canonique, liens) sans slash final, alors que GitHub Pages ne sert que la forme avec slash | « Page avec redirection » — 7 129 | slash final partout |
| 2 | Le routeur Angular ne reconnaissait **pas** les URLs à slash final → page « introuvable » + `noindex` posée à l'hydratation | « Exclue par balise noindex » — 3 881, et perte continue de pages indexées | `SlashFinalUrlSerializer` |
| 3 | `data-refresh.yml` n'avait pas l'étape qui retire la balise `noindex` globale | chute des impressions après le 01/08 | marqueur inversé + étape ajoutée aux 3 workflows |

## Défaut 1 — le slash final (P0 du plan)

Le prerender Angular (`outputMode: 'static'`) écrit **un dossier par route** :

```
dist/ma-ville-notes/browser/ville/vincennes-94080/index.html
```

GitHub Pages ne sert ce fichier en 200 qu'à l'URL `…/ville/vincennes-94080/`.
Sur la forme sans slash, il répond **301** vers la forme avec slash. Or le site
publiait partout la forme sans slash :

- `sitemap.xml` (~35 000 URLs) ;
- `<link rel="canonical">` et `og:url` (`MetaService`) ;
- les URLs des schémas JSON-LD (`core/seo/schemas.ts`) ;
- les `href` de tous les `routerLink`.

Googlebot dépensait donc un hit de crawl en redirection **avant** chaque page,
sur un site de 35 000 pages sans autorité — exactement le budget qui manquait
pour sortir les 20 404 pages « Détectée, actuellement non indexée ».

**Correctif** : la forme canonique du site est désormais celle **avec** slash
final, la seule réellement servie en 200. Aucun changement d'hébergement.

- `src/app/core/url/slash-final.ts` — `avecSlashFinal` / `sansSlashFinal`, pures.
- `MetaService`, `core/seo/schemas.ts`, `functions/_lib/commune-meta.mjs` —
  canonique, `og:url` et JSON-LD passent par `avecSlashFinal`.
- `tools/data-pipeline/src/emit/index.ts` — `urlsSitemap()` (pure, testée)
  termine chaque URL par un slash.
- `SlashFinalUrlSerializer` — les `href` des `routerLink` aussi.

La redirection 301 de GitHub Pages existe toujours pour la forme sans slash :
c'est désormais une normalisation légitime pour les vieux liens, plus le chemin
de crawl principal.

## Défaut 2 — le routeur rejetait les URLs réellement servies (le plus grave)

`DefaultUrlSerializer.parse('/ville/vincennes-94080/')` produit **trois**
segments : `['ville', 'vincennes-94080', '']` — le slash final crée un segment
vide. La route `ville/:slug` n'en attend que deux : **aucune route ne matchait**,
et le wildcard `**` rendait la page « Commune introuvable », qui pose
`<meta name="robots" content="noindex">`.

Le scénario complet, pour chaque page du site :

1. Google lit `/ville/vincennes-94080` dans le sitemap ;
2. GitHub Pages répond 301 vers `/ville/vincennes-94080/` ;
3. il y sert le bon HTML prérendu — titre, contenu, pas de `noindex` ;
4. Googlebot exécute le JS (il le fait) : l'app démarre sur `/ville/…/`, ne
   matche rien, remplace la page par « Commune introuvable » **et pose la
   balise `noindex`** ;
5. Google voit un `noindex` dans le DOM rendu et retire la page de l'index.

C'est la cause de la baisse **continue** du nombre de pages indexées : chaque
re-rendu par Google en supprimait de nouvelles. Le test de non-régression
`src/app/core/url/routes-slash-final.spec.ts` échoue sur **12 URLs** (toutes les
routes du site) si l'on retire le sérialiseur.

**Correctif** : `SlashFinalUrlSerializer` (`src/app/core/url/`) — `parse()`
normalise l'URL entrante avant le découpage en segments, `serialize()` produit
la forme canonique à slash final. Branché dans `app.config.ts`, donc actif au
prerender comme dans le navigateur.

### Corollaire : plus de `noindex` sur un état transitoire

Le même mécanisme (Googlebot photographie le DOM à un instant donné) rendait
dangereux le `noindex` posé pendant le **chargement** des données. Une page
parfaitement valide était désindexée si l'instantané tombait avant la fin du
fetch de `data/dep/{code}.json`.

`commune`, `departement`, `region`, `palmares-departement` et `palmares-autour`
ne posent désormais `noindex` que sur un état **définitif** (`erreur()`,
`introuvable()`, `not-found`), jamais sur un chargement en cours.

## Défaut 3 — le site entier redéployé en `noindex` chaque mois

`src/index.html` contenait une balise `noindex` globale en dur, que chaque
workflow était censé retirer par `sed` si la variable de dépôt
`SITE_INDEXABLE` valait `true`. **`data-refresh.yml` (rafraîchissement mensuel
des données, cron le 1er du mois) n'avait pas cette étape** : chaque exécution
redéployait les ~35 000 pages avec un `noindex`, jusqu'au push suivant sur
`main`. Le pic d'impressions du 06/08 suivi d'un effondrement correspond à la
fenêtre ouverte par l'exécution du 01/08.

**Correctif — le sens est inversé.** `src/index.html` porte un marqueur
`<!-- SEO_ROBOTS -->` vide : par défaut, **le site est indexable**. Les
workflows *posent* la balise `noindex` quand il ne faut PAS indexer :

- `deploy.yml` et `data-refresh.yml` : seulement si `SITE_INDEXABLE != 'true'` ;
- `deploy-cloudflare-pages.yml` : **toujours** — ce workflow ne publie que sur
  une préversion `*.pages.dev`, qui duplique planmaville.fr et ne doit jamais
  être indexée.

Un workflow qui oublie l'étape publie désormais un site indexable, pas un site
invisible. Chaque étape vérifie en plus que la substitution a bien eu lieu (le
marqueur doit avoir disparu) : un `sed` devenu muet échoue bruyamment au lieu
de publier n'importe quoi.

## Vérifier

```bash
npm test              # 140 tests (dont 28 sur le slash final et les routes)
npm run test:data     # 56 tests pipeline (dont sitemap.spec.ts)
npm run test:functions
npm run seo:audit     # audit des URLs EN LIGNE (après déploiement)
```

`tools/audit-urls.mjs` (`npm run seo:audit`) est le critère de succès du plan :
il tire un échantillon déterministe du sitemap et vérifie, pour chaque URL,
qu'elle répond **200 sans redirection** et que le HTML servi ne contient
**aucun `noindex`**. Sortie non nulle sinon, échecs regroupés par cause.

```bash
npm run seo:audit                      # 500 URLs du sitemap en ligne
node tools/audit-urls.mjs --sample 0   # les ~35 000 (long)
node tools/audit-urls.mjs --local      # lit public/sitemap.xml sans réseau
```

L'échantillon est tiré avec une graine fixe : deux exécutions comparent le
**même** jeu d'URLs, donc un avant/après déploiement est lisible.

## Après déploiement

1. Resoumettre `sitemap.xml` dans la Search Console (les `<loc>` ont changé de
   forme : Google doit recharger le fichier).
2. Lancer `npm run seo:audit` — attendu : 0 redirection, 0 `noindex`.
3. Surveiller 2 à 3 semaines. La métrique à suivre n'est pas les impressions
   mais le **ratio indexées / non indexées** : l'objectif immédiat est
   d'arrêter l'hémorragie, pas de gagner du trafic.
4. Les 7 129 « Page avec redirection » ne disparaîtront pas d'un coup : ce sont
   les anciennes URLs sans slash déjà connues de Google. Elles s'éteindront au
   fil des recrawls, la forme avec slash étant maintenant celle du sitemap, du
   canonique et de tous les liens internes.

**Ne pas** relancer de demandes d'indexation manuelles en masse.

## Reste à faire

### P2 — les 56 pages en 404 (nécessite un export Search Console)

Non traité ici : les URLs concernées ne sont pas déductibles du code. Marche à
suivre : Search Console → Pages → *Introuvable (404)* → Exporter, puis
recouper avec `public/sitemap.xml`.

- URL **présente** dans le sitemap → régression : `npm run seo:audit` la
  signalera, à corriger dans le pipeline.
- URL **absente** du sitemap → ancien slug (une commune renommée ou un code
  INSEE modifié change le slug d'un rafraîchissement à l'autre). GitHub Pages
  ne sait pas faire de redirection 301 : si ces URLs ont des liens entrants, il
  faut soit figer les slugs, soit prérendre une page de redirection pour les
  anciens.

### P1 — maillage interne et priorisation (après stabilisation)

À ouvrir seulement une fois le ratio d'indexation redressé — renforcer le
maillage pendant que le crawl se dépense en redirections n'aurait rien donné.
Le plan initial vise : 3-4 points d'entrée par page ville, sitemap segmenté
(grandes villes surveillées à part), différenciation éditoriale des petites
communes. Voir `docs/SEO-PLAN.md`.
