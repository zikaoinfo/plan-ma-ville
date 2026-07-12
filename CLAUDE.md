# ma-ville-notée (repo : plan-ma-ville)

App Angular 22 qui note les communes françaises sur 8 critères (open data +
avis habitants). Concurrence ville-ideale.fr. **100 % statique (GitHub Pages)**,
backend communautaire = **Supabase** uniquement.

Specs : `docs/SPEC-DATA.md`, `docs/SPEC-PHASES-2-6.md`, `docs/SPEC-PHASES-7-12.md`.

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

- **Node 24 requis** (le CLI ng22 exige > 22.22.3). Si la sandbox a Node 22.x,
  installer Node 24 en local puis `export PATH=$HOME/.local/node/bin:$PATH`
  avant toute commande npm/npx.
- **Réseau sandbox bloqué** vers `geo.api.gouv.fr` / `insee.fr` / `data.gouv.fr`
  (hors allowlist). Le pipeline lit un **fixture** `tools/data-pipeline/.cache/geo.json`
  (gitignoré) → `npm run data:build` marche en local. En CI le réseau est ouvert.
- Impossible de tester Supabase/navigateur ici → tests unitaires + dégradation.

## Commandes

- `npm start` — dev (http://localhost:4200/plan-ma-ville/).
- `npm run build` — build prod + `404.html` (fallback SPA Pages).
- `npm run data:build` — pipeline complet + validation 6 invariants + sitemap.
- `npm run data:sample` — pipeline départements 69,75.
- `npm test` — Vitest (app). `npm run test:data` — tests pipeline.
- `npx eslint .` — lint.

## Arborescence

```
src/app/
├── core/
│   ├── models/data.models.ts        schémas contractuels (+ copie pipeline models.ts)
│   ├── normalise.ts                 normaliseNom (aligné pipeline)
│   └── services/
│       ├── search-index.service.ts  httpResource index+departements, search()
│       ├── commune-data.service.ts  getCommuneBySlug()→{state,depFile}, loadDep()
│       ├── meta.service.ts          title/description/og/canonical
│       ├── supabase.service.ts      client optionnel (enabled/null)
│       ├── auth.service.ts          Google + magic-link, user() signal
│       └── avis.service.ts          stats/liste/upsert (dégrade en []/null)
├── features/{home,commune,departement,classement,carte,comparateur,methodologie}/
│   └── commune/commune-avis/{commune-avis-list,commune-avis-form}
└── shared/{note-bar,score-badge,score-color,page-skeleton,error-message,
            critere-slider,auth-gate}
tools/data-pipeline/                 tsx (pas de build), fixture .cache/geo.json
docs/supabase-schema.sql             SQL Supabase (+ migration-fix-profiles.sql)
```

## Données (pipeline `tsx`)

- Sources (toutes URLs dans `sources.config.json`) :
  - `geo.api.gouv.fr` — périmètre communes, population, `centre` (lat/lng).
  - **BPE** (INSEE) — équipements → santé, commerces, enseignement, sports,
    culture, transports. `fetch/bpe.ts`, domaine = 1re lettre TYPEQU (F1/F2 sports,
    F3 culture).
  - **SSMSI** (data.gouv) — délinquance → sécurité (note inversée). `fetch/securite.ts`.
  - **Filosofi** (INSEE) — revenu médian → niveau de vie. `fetch/filosofi.ts`.
- **Scoring réel par rang percentile** (`score/real.ts`, plus de notes factices) :
  densité /1000 hab (BPE), taux /1000 hab (SSMSI, inversé), revenu médian
  (Filosofi) → `toPercentileNote` (`score/percentile.ts`, convention « fraction
  ≤ valeur », test `toPercentileNote(5,[1,3,5,7,9])===6`). Commune sans donnée
  → **médiane nationale** (jamais 0). Arrondissements Paris/Lyon/Marseille
  repliés sur la mère (`fetch/insee-code.ts`). Note globale = Σ(note×poids)/Σ(poids).
- **URLs BPE/SSMSI/Filosofi = best-effort** (réseau bloqué en sandbox, jamais
  testées ici) → à **confirmer/corriger au 1er run CI**. Fetchers en **dégradation
  gracieuse** (`fetchOrWarn`) : une source KO logge un ⚠ et bascule le critère sur
  la médiane (le déploiement n'est pas bloqué). Rapport de run = couverture par
  source + histogramme des notes.
- Cache `.cache/{name}.csv` (< 30 j, gitignoré), décompression zip/gz + parsing
  CSV streaming (`fetch/download.ts`, deps `adm-zip`+`csv-parse`).
- Émet dans `public/data/` (gitignoré, régénéré en CI) : `index.json` (trié nn),
  `departements.json`, `dep/{code}.json`, `classement.json`, `geo-light.json`
  (carte, communes ≥500 hab avec lat/lng) + `public/sitemap.xml`.
- 6 invariants validés en fin de run (notes ∈[0,10] 1 déc., slugs uniques, etc.).
- **Déterministe à données constantes** : même cache → fichiers identiques.
- Refresh mensuel : `.github/workflows/data-refresh.yml` (cron + `workflow_dispatch`,
  force la régénération hors cache de `deploy.yml`).
- Validation URLs en CI : `data-validate.yml` tourne **sur la PR** (si le pipeline
  change) et lance `npm run data:validate` = `data:build --strict` (échoue si une
  source a 0 % de couverture). Ne déploie pas. `deploy.yml` reste gracieux.
- URL des données runtime = `new URL('data/x.json', document.baseURI)` (relatif,
  correct en dev comme en prod — jamais coder `/plan-ma-ville/` en dur).

## Features livrées

- **Home** : recherche (nom ou CP, dispatch), grille départements.
- **Commune `/ville/:slug`** : **dashboard** — carte OSM (iframe `afterNextRender`),
  notes par thématique, historique (sparkline SVG), prix m² estimé, communes
  voisines (haversine). Estimations déterministes dans `commune-insights.ts`
  (pures, testées). Onglets « Données officielles » / « Avis habitants »
  (`?onglet=avis` pour survivre au retour OAuth).
- **Département `/departement/:code`** : tableau triable/filtrable.
- **Classement `/classement`** : top/flop, filtre département.
- **Carte `/carte`** : Leaflet + markercluster (chargé en dynamique), filtre note.
- **Comparateur `/comparer`** : jusqu'à 3 villes, URL partageable `?villes=`.
- **Méthodologie** : statique.

## Supabase (Phase 7 — avis + auth)

- **Dégradation gracieuse** : si `environment.supabaseUrl` n'est pas une vraie
  URL http (placeholder/vide), `SupabaseService.enabled=false`, `client=null`,
  toutes les méthodes renvoient `[]`/`null` → onglet avis « bientôt », pas de crash.
- **Env** : `environment.ts` contient des placeholders `__SUPABASE_URL__` /
  `__SUPABASE_ANON_KEY__` / `__WORKER_URL__`, remplacés en CI par une étape `sed`
  dans `deploy.yml` depuis les secrets GitHub. `environment.development.ts` vide
  (auth off en local — y mettre ses clés pour tester, ne pas commiter).
- **Activation** (côté proprio) : coller `docs/supabase-schema.sql` ; activer le
  provider Email + Google ; secrets GitHub `SUPABASE_URL`/`SUPABASE_ANON_KEY` ;
  autoriser les Redirect URLs (localhost + github.io).
- **Piège trigger** : la création de profil s'exécute dans la transaction
  d'`auth.users` → doit fournir un pseudo non-null unique et **ne jamais lever**
  (sinon « Database error saving new user » casse Google + magic-link). Corrigé
  dans le schéma (`handle_new_user`, garde-fou `WHEN OTHERS`).
- **Header** : menu compte (avatar Google/initiales, pseudo, email, déconnexion)
  affiché si Supabase configuré. `auth.user()` signal ; callbacks Supabase → `set()`
  déclenche la CD en zoneless.

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

- **baseHref `/plan-ma-ville/`** (nom réel du repo), `outputPath dist/ma-ville-notes`.
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
Reste : DVF (prix m² réel), **12** (page profil/villes suivies, Supabase),
**9/10** (IA — bloqué : nécessite un proxy serveur pour cacher la clé Claude ;
option quiz déterministe sans IA). Détail vivant : `docs/TODO.md`.
