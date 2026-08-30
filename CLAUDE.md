# ma-ville-notée (repo : plan-ma-ville)

App Angular 22 qui note les communes françaises sur 8 critères (open data +
avis habitants). Concurrence ville-ideale.fr. **100 % statique (GitHub Pages)**,
backend communautaire = **Supabase** uniquement.

Specs : `docs/SPEC-DATA.md`, `docs/SPEC-PHASES-2-6.md`, `docs/SPEC-PHASES-7-12.md`.
**SEO : `docs/SEO-PLAN.md` (stratégie) et `docs/SEO-INDEXATION.md` (défauts
techniques d'indexation corrigés en août 2026 — à lire avant toute modif
d'URL, de sitemap, de balise robots ou de workflow de déploiement).**
**Accessibilité : voir `ACCESSIBILITE-RGAA.md`** (Definition of Done a11y §1 à
appliquer à toute création/modif d'UI ; socle focus/skip-link/live déjà en place).

## Docs à charger À LA DEMANDE (ne pas tout lire par défaut)

| Tu touches à…                                   | Lis d'abord                    |
| ----------------------------------------------- | ------------------------------ |
| pipeline, sources, scoring, arrondissements     | `docs/ARCHI-DONNEES.md`        |
| une page/composant existant, UI, thème, PWA     | `docs/ARCHI-FEATURES.md`       |
| build, prerender, URL publiée, sitemap, robots  | `docs/ARCHI-BUILD-SSG.md` + `docs/SEO-INDEXATION.md` |
| avis, auth, RLS, schéma SQL                     | `docs/ARCHI-SUPABASE.md`       |
| stratégie SEO / monitoring                      | `docs/SEO-PLAN.md`, `docs/SEO-MONITORING.md` |
| reste à faire                                   | `docs/TODO.md`                 |

## Stack & conventions (NON négociables)

- **Angular 22**, standalone (aucun `NgModule`), **zoneless** (pas de zone.js,
  pas de `provideZoneChangeDetection`).
- **`inject()` uniquement** (jamais d'injection par constructeur).
- `ChangeDetectionStrategy.OnPush` sur **tous** les composants.
- **Signals partout** : pas d'`async` pipe, pas de `subscribe()`. `httpResource`
  pour le fetch. `computed` pour le dérivé, `effect` seulement pour l'impératif
  DOM (title/meta, Leaflet).
- SCSS, TypeScript strict, ESLint flat config (`eslint.config.js`).
- Routing lazy via `loadComponent` dans `src/app/app.routes.ts`.
- **PrimeNG INTERDIT** : sa dernière version peer-requiert Angular 21, pas de
  build ng22 → tous les atomes UI sont **maison** (badge, barre, slider, onglets,
  spinner, auth-gate…).

## Environnement (IMPORTANT)

- **Node 24 requis** (le CLI ng22 exige ≥ 22.22.3). Si la sandbox a Node 22.x,
  installer Node 24 en local puis `export PATH=$HOME/.local/node/bin:$PATH`
  avant toute commande npm/npx — ou patcher localement (non commité)
  `node_modules/@angular/cli/src/utilities/node-version.js`.
- **Angular épinglé en 22.0.6 exact** (paquets @angular/* alignés : le
  service-worker et l'ssr peer-exigent la version EXACTE du core).
- **Réseau sandbox bloqué** vers `geo.api.gouv.fr` / `insee.fr` / `data.gouv.fr`
  (hors allowlist). Le pipeline lit un **fixture** `tools/data-pipeline/.cache/geo.json`
  (gitignoré) → `npm run data:build` marche en local. En CI le réseau est ouvert.
- Impossible de tester Supabase/navigateur ici → tests unitaires + dégradation.

## Commandes

- `npm start` — dev (http://localhost:4200/).
- `npm run build` — build prod + `404.html` (fallback SPA Pages).
- `npm run data:build` — pipeline complet + validation 6 invariants + sitemap.
- `npm run data:sample` — pipeline départements 69,75.
- `npm test` — Vitest (app). `npm run test:data` — tests pipeline.
  `npm run test:functions` — tests des Cloudflare Pages Functions (logique pure).
- `npm run seo:audit` — audit des URLs du sitemap EN LIGNE (0 redirection,
  0 `noindex`) ; `--local` pour lire `public/sitemap.xml` sans réseau.
- `npm run seo:monitor` — mesure Search Console hebdomadaire → Supabase
  (`docs/SEO-MONITORING.md`). `npm run seo:citation` — baseline de citation
  IA (**coûteux**, mensuel). `npm run test:seo` — logique pure des deux.
- `npx eslint .` — lint.

## Arborescence

```
src/app/
├── core/
│   ├── models/data.models.ts        schémas contractuels (+ copie pipeline models.ts)
│   ├── normalise.ts                 normaliseNom (aligné pipeline)
│   ├── url/                         slash-final.ts + SlashFinalUrlSerializer
│   │                                (forme canonique des URLs, cf. SEO-INDEXATION)
│   └── services/
│       ├── search-index.service.ts  httpResource index+departements, search()
│       ├── commune-data.service.ts  getCommuneBySlug()→{state,depFile}, loadDep()
│       ├── meta.service.ts          title/description/og/canonical
│       ├── supabase.service.ts      client optionnel (enabled/null)
│       ├── auth.service.ts          Google + magic-link, user() signal
│       └── avis.service.ts          stats/liste/upsert (dégrade en []/null)
├── features/{home,commune,departement,classement,carte,comparateur,methodologie}/
│   └── commune/commune-avis/{commune-avis-list,commune-avis-form}
└── shared/{note-bar,score-badge,score-color,error-message,
            critere-slider,auth-gate}
tools/data-pipeline/                 tsx (pas de build), fixture .cache/geo.json
tools/seo-monitor/                   workspace : monitoring GSC + citation IA
tools/audit-urls.mjs                 audit 0 redirection / 0 noindex du sitemap
docs/supabase-schema.sql             SQL Supabase (+ migration-fix-profiles.sql)
```

## Règles dures (violer = régression connue ; détail dans les docs ci-dessus)

- **Toute URL publiée passe par les helpers slash-final** (`core/url/`,
  `avecSlashFinal()` de `MetaService`, `core/seo/schemas.ts`, `urlsSitemap()`
  du pipeline) : sans slash, GitHub Pages répond 301 et la route ne matche pas.
- **Jamais de `noindex` sur un état de CHARGEMENT** — seulement sur un état
  définitif (`erreur()`, `introuvable()`, `not-found`).
- **`index.html` porte un marqueur vide `<!-- SEO_ROBOTS -->`** (site indexable
  par défaut) ; ce sont les workflows qui *posent* le `noindex`. Ne jamais y
  remettre une balise robots littérale.
- **URLs de données via `core/data-url.ts`** (`dataUrl`/`baseUri`) : pas de
  `document.baseURI` (inexistant en prerender), jamais `/plan-ma-ville/` en dur.
- **`npm run build` = build shardé** (`tools/build-prerender.mjs`) : un seul
  `ng build` sur les ~35 000 communes part en OOM.
- **Aucune donnée inventée** : pas d'estimation ni de trajectoire simulée
  affichée comme un fait ; commune sans donnée → note neutre **5**, jamais 0,
  ou champ absent assumé dans l'UI.
- **Toute nouvelle dérivation chiffrée d'une fiche passe par
  `commune-contexte.ts`** (socle partagé prose/FAQ/classements) — deux calculs
  parallèles finissent par se contredire sur la même page.
- **Toute couleur passe par les tokens** de `styles.scss` (thème clair/sombre +
  4 accents) — jamais de hex en dur dans un composant.

## Pièges zoneless / Angular 22

- `viewChild`/`input`/`model` **ne peuvent pas** être des champs ES `#private` →
  utiliser `private readonly` TS.
- Leaflet : `afterNextRender` + `await import('leaflet')` (accès DOM). CSS Leaflet
  dans `angular.json` ; `leaflet`/`leaflet.markercluster` en `allowedCommonJsDependencies`.
- `httpResource` fetch async : en test, `fixture.detectChanges()` puis attendre
  (helper `tick` + poll sur `HttpTestingController.match`), pas `whenStable()`
  (bloque sur requête en vol).
- Ne pas désactiver un bouton via binding réactif fragile → valider au clic.

## Déploiement & Git

- **Domaine : planmaville.fr** (fichier `public/CNAME`, baseHref `/`,
  `environment.baseUrl` + `siteBaseUrl` pipeline alignés). GitHub redirige
  automatiquement l'ancienne URL github.io vers le domaine. `public/robots.txt`
  (Allow + Sitemap). **IndexNow** : clé `public/<hex32>.txt` + job `indexnow`
  de deploy.yml (ping Bing/Yandex à chaque déploiement, seulement si
  `SITE_INDEXABLE=true`). `outputPath dist/ma-ville-notes`.
- `.github/workflows/deploy.yml` : sur push `main` → inject secrets → data:build
  (cache) → build → Pages. **Pages déjà activé** (source « GitHub Actions »).
- **Branche de dev** : `claude/angular-21-creative-design-bfybnz`. Workflow
  demandé par l'utilisateur : **committer sur la branche + ouvrir/mettre à jour
  une PR, NE PAS merger dans `main` soi-même** (il relit et merge).
- **PR #5 ouverte** = Phase 7 (avis Supabase), pas encore mergée.
- Push de **tags bloqué (403)** dans l'env distant → tags locaux seulement.
- Fin des messages de commit : la co-authorship + session (voir gabarit fourni
  par l'outil). Ne jamais mettre l'ID de modèle dans un artefact poussé.

## Tests

- Vitest. Extraire la logique en **fonctions pures** testables (search, sort,
  insights, resolveCommuneState, marker-style…). ~42 tests.
- Intégration composant : `TestBed` + `provideRouter([])` + `provideHttpClient()`
  + `provideHttpClientTesting()`.

## État des phases

Faites : 0–4, 6, 8 (carte), 11 (comparateur), 7 (avis). Dashboard commune.
**5** (vraies données open data — BPE/SSMSI/Filosofi via percentile) : **codée +
testée** (29 tests pipeline), en attente de **validation CI** des URLs sources.
DVF (prix m² réel) : **fait** (en attente de validation CI des colonnes/URL).
Reste : **12** (page profil/villes suivies, Supabase),
**9/10** (IA — bloqué : nécessite un proxy serveur pour cacher la clé Claude ;
option quiz déterministe sans IA). Détail vivant : `docs/TODO.md`.
