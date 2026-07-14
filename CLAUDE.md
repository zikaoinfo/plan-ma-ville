# ma-ville-notée (repo : plan-ma-ville)

App Angular 22 qui note les communes françaises sur 8 critères (open data +
avis habitants). Concurrence ville-ideale.fr. **100 % statique (GitHub Pages)**,
backend communautaire = **Supabase** uniquement.

Specs : `docs/SPEC-DATA.md`, `docs/SPEC-PHASES-2-6.md`, `docs/SPEC-PHASES-7-12.md`.
**Accessibilité : voir `ACCESSIBILITE-RGAA.md`** (Definition of Done a11y §1 à
appliquer à toute création/modif d'UI ; socle focus/skip-link/live déjà en place).

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
└── shared/{note-bar,score-badge,score-color,error-message,
            critere-slider,auth-gate}
tools/data-pipeline/                 tsx (pas de build), fixture .cache/geo.json
docs/supabase-schema.sql             SQL Supabase (+ migration-fix-profiles.sql)
```

## Données (pipeline `tsx`)

- Sources (toutes URLs dans `sources.config.json`) :
  - `geo.api.gouv.fr` — périmètre communes, population, `centre` (lat/lng).
    **Piège** : filtre par défaut `type=commune-actuelle` si le paramètre
    `type` est omis de l'URL → les arrondissements de Paris/Lyon/Marseille ne
    sont JAMAIS renvoyés sans `type=commune-actuelle,arrondissement-municipal`
    explicite dans `geoCommunes` (`sources.config.json`) ; oubli détecté par
    l'invariant 5 (0 arrondissement rattaché) lors de la 1re validation CI de
    la note par arrondissement.
  - **BPE** (INSEE) — équipements → santé, commerces, enseignement, sports,
    culture, transports. `fetch/bpe.ts`, domaine = 1re lettre TYPEQU (F1/F2 sports,
    F3 culture).
  - **SSMSI** (data.gouv) — délinquance → sécurité (note inversée). `fetch/securite.ts`.
  - **Filosofi** (INSEE) — revenu médian → niveau de vie. `fetch/filosofi.ts`.
  - **Statistiques DVF** (DGFiP/data.gouv) — agrégats PRÊTS À L'EMPLOI du prix m²
    médian résidentiel par commune et par semestre (pas le DVF brut multi-Go).
    `fetch/dvf.ts` : échelle commune uniquement, priorité appartements+maisons,
    historique ≤10 périodes → `CommuneDetail.prix` (`{m2, periode, nb?, histo}`)
    dans `dep/{code}.json`. Hors couverture (Alsace, Moselle, Mayotte, communes
    sans ventes) → champ absent, l'UI l'affiche honnêtement. N'alimente PAS la
    note (info affichée, pas critère).
- **Scoring réel par rang percentile moyen** (`score/real.ts`, plus de notes
  factices) : densité /1000 hab (BPE), taux /1000 hab (SSMSI, inversé), revenu
  médian (Filosofi) → `rankNotes` (`score/scale.ts`) = midrank puis remise à
  l'échelle (meilleure commune du critère → 10). **NB scaling** : la 1re version
  « count ≤ valeur » mettait les ex æquo à zéro EN HAUT (commune sans culture =
  9.6/10) ; le min–max les mettait à 0 (effondrement, meilleure note globale 6.1).
  Le **midrank** leur donne le MILIEU de leur plage (≈4-5), distribution saine.
  **Sécurité classée PAR strate de population** (`stratePopulation`, seuils
  500/2k/5k/20k/50k/100k) : sinon les >50 % de communes rurales sans délinquance
  écrasent toutes les villes vers 0. **Boost gamma par critère**
  (`scoring.config.json` `boost`, appliqué dans `rankNotes`) : `gamma < 1` relève
  et homogénéise les notes vers le haut pour les services de base très répandus
  (enseignement, sports = 0.5). Commune sans donnée → **note neutre 5**
  (jamais 0). **Arrondissements Paris/Lyon/Marseille notés individuellement**
  (`fetch/insee-code.ts` `codesAccumulation`/`estArrondissement`) : les 4
  fetchers créditent CHAQUE ligne source à la fois sur la commune mère
  (agrégat historique, ex. `75056`) et sur l'arrondissement lui-même (ex.
  `75108`), classé au même rang percentile national que n'importe quelle
  commune — hiérarchie **Région > Département > Ville > Arrondissement**.
  `main.ts` relie ensuite chaque arrondissement à sa mère
  (`CommuneDetail.communeMere`) et embarque sur la mère la liste triée de ses
  arrondissements (`CommuneDetail.arrondissements`). `geo.ts` ne filtre donc
  plus `type === 'arrondissement-municipal'` (exclusif à ces 45 communes).
  `emit/index.ts` exclut les arrondissements des totaux
  population/nbCommunes/noteMoyenne de `departements.json`/`regions.json`
  (double comptage sinon — un arrondissement n'est pas un habitant
  supplémentaire) mais les inclut PARTOUT ailleurs comme des communes à part
  entière : `index.json`, `classement.json`, `geo-light.json`,
  `dep/{code}.json`. Invariant 5 revu en conséquence (cohérence
  mère ↔ arrondissements, comptes attendus 20/9/16). Note globale =
  Σ(note×poids)/Σ(poids).
- **URLs résolues et validées en CI** (job « Validate open data » vert, PR #11) :
  BPE via dataset data.gouv `base-permanente-des-equipements` (CSV ensemble
  **2018**, en-têtes FR), SSMSI `bases-statistiques-…-delinquance` (COM csv.gz,
  millésime **2025**), Filosofi `revenu-des-francais-a-la-commune` (**2021**,
  colonne `[DISP] Médiane (€)`). Couverture obtenue : BPE 86 % · SSMSI 100 % ·
  Filosofi 89 %. Réseau bloqué en sandbox → **jamais exécutable en local**, valider
  en CI. Fetchers en **dégradation gracieuse** (`fetchOrWarn`) : une source KO logge
  un ⚠ et bascule le critère sur la médiane (déploiement non bloqué). Rapport de run
  = couverture par source + histogramme des notes. **BPE 2018 = limite v1** (dernier
  ensemble librement téléchargeable ; upgrade vers dénombrement INSEE récent = TODO).
- Cache `.cache/{name}.csv` (< 30 j, gitignoré), décompression zip/gz + parsing
  CSV streaming (`fetch/download.ts`, deps `adm-zip`+`csv-parse`).
- Émet dans `public/data/` (gitignoré, régénéré en CI) : `index.json` (trié nn),
  `departements.json`, `regions.json` (classement régional → départements imbriqués,
  `emit/regions.ts`), `dep/{code}.json`, `classement.json`, `geo-light.json`
  (carte, communes ≥500 hab avec lat/lng) + `public/sitemap.xml`.
- **Régions** (`emit/regions.ts`) : table statique `DEPARTEMENT_REGION` (101 dépts →
  code région INSEE) + `REGIONS` (code → nom). `aggregateRegions()` regroupe les
  départements, note région = moyenne des communes **pondérée population**
  (recalculée depuis les sommes non arrondies), régions et départements triés note ↓.
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
- **Commune `/ville/:slug`** : **dashboard** en grille à zones nommées
  (`grid-template-areas`) — notes par thématique D'ABORD (pleine largeur), puis
  carte OSM (iframe `afterNextRender`) adossée à la pile prix m² + historique
  (sparkline SVG, hauteurs équilibrées ; variante `dash--nomap` sans coordonnées),
  puis communes voisines (haversine) en grille de vignettes pleine largeur.
  **Prix m² = RÉEL (DVF)** : médiane + tendance 1 an (`dvfTrendPct`) + sparkline
  depuis `commune.prix.histo` ; sans donnée → message honnête, pas d'estimation.
  L'historique de NOTE reste une trajectoire estimée (`commune-insights.ts`,
  pur, testé). **Texte éditorial SEO** (`commune-texte.ts`, pur, testé) :
  réponse directe ~60 mots sous l'en-tête + 4 sections h2 « Vivre à {ville} »
  (~250 mots), 100 % dérivés des données réelles (rang départemental, moyennes,
  DVF), variantes de tournures par hash INSEE (déterministe entre builds,
  anti scaled-content-abuse — cf. docs/SEO-PLAN.md). Onglets « Données
  officielles » / « Avis habitants » (`?onglet=avis` pour survivre au retour
  OAuth). **Arrondissements (Paris/Lyon/Marseille)** : la fiche d'une commune
  mère affiche une section « Ses arrondissements » (notes + population,
  triés note ↓) ; la fiche d'un arrondissement affiche un lien « Ville » vers
  sa mère dans le méta-en-tête et dans le fil d'Ariane JSON-LD (Région >
  Département > Ville > Arrondissement). `commune-insights.ts`
  `filtrerBassinVoisinage` retire mère/enfants du bassin « Communes aux
  alentours » pour ne pas doublonner ces liens (pur, testé).
- **Régions `/regions`** : classement des régions (grille, note ↓), drill-down.
  **Région `/region/:code`** : ses départements classés note ↓ → lien commune.
  Chaîne région → département → ville. Lu depuis `regions.json` (départements
  imbriqués, pas de fichier par région : ~18 entrées). Service
  `SearchIndexService.getRegions()/regionSummary(code)`.
- **Département `/departement/:code`** : tableau triable/filtrable.
- **Classement `/classement`** : top/flop, filtre département.
- **Carte `/carte`** : Leaflet + markercluster (chargé en dynamique), filtre note.
- **Comparateur `/comparer`** : jusqu'à 3 villes, URL partageable `?villes=`.
- **Pondération par profil** (`core/ponderation.ts` pur + `PonderationService`) :
  presets Officiel/Famille/Jeune actif/Retraité + sliders Perso (poids ∈[0,2]),
  persistés localStorage `mvn-profil`/`mvn-poids`. Note « pour vous » =
  Σ(note×poids)/Σ(poids) recalculée **côté client** (les 8 critères sont dans
  les données). `POIDS_OFFICIELS` à garder alignés avec `scoring.config.json`.
  UI : `shared/profil-picker` branché sur commune, classement (colonne « Pour
  vous » + re-tri du top/flop officiel — `criteres` embarqués dans
  `classement.json`), comparateur (ligne dédiée), département (colonne triable
  `perso` via `filterAndSortCommunes(..., poids)`).
- **Méthodologie** : statique.
- **Palmarès (hubs SEO, docs/SEO-PLAN.md §P4)** : `/palmares/securite/:dep` et
  `/palmares/prix/:dep` (un composant, `type` via route data +
  withComponentInputBinding), `/palmares/autour/:slug` (grandes villes
  ≥ `hubAutourMinPopulation` = 50k, rayon 20 km via geo-light.json). Logique
  pure `palmares-logic.ts` (tops, intros factuelles). Prerendus + sitemap +
  JSON-LD (Breadcrumb+ItemList) + maillage (département ↔ hubs ↔ communes,
  lien depuis les fiches des grandes villes).
- **Thème clair/sombre/système** : `ThemeService` (signal `preference` persisté
  localStorage `mvn-theme`, `resolved` computed suivant `prefers-color-scheme`
  en direct) → `data-theme` sur `<html>` via `effect`. Tokens sombres dans
  `styles.scss` (`:root[data-theme='dark']` + `color-scheme`). **Script inline
  anti-flash dans `index.html`** (à garder aligné avec le service). Sélecteur
  ☀️/🌙/💻 dans le header. Toute couleur nouvelle DOIT passer par les tokens
  (jamais de hex en dur dans les composants).
- **Nav mobile** (≤920px) : burger → panneau déroulant sous la topbar
  (backdrop, fermeture au clic sur un lien), pseudo compte masqué, marque
  réduite au badge <380px.
- **SSG/prerender (SEO)** : `outputMode: 'static'` + `src/main.server.ts`
  (bootstrap AVEC `BootstrapContext` — NG0401 sinon) + routes serveur dans
  `src/app/app.routes.server.ts` : pages fixes + `region/:code` +
  `departement/:code` + `ville/:slug` (communes ≥ `prerenderMinPopulation`
  de scoring.config.json, 5000 → ~2 500 pages), reste en
  `RenderMode.Client` (fallback SPA 404.html). **Piège du prerender async
  contourné** : intercepteur serveur `core/prerender/donnees-locales.interceptor.ts`
  qui sert `data/*.json` depuis le disque en synchrone (data:build tourne
  AVANT ng build en CI). `document.baseURI` N'EXISTE PAS dans le DOM serveur →
  toujours passer par `core/data-url.ts` (`dataUrl`/`baseUri`) pour les URLs de
  données ; idem `dataset` sur documentElement (utiliser setAttribute).
  Hydratation activée avec `withNoHttpTransferCache` (sinon index.json ~Mo
  embarqué dans chaque HTML). Le sitemap inclut les mêmes communes ≥ seuil.
  **NOINDEX temporaire** : `<meta name="robots" noindex>` dans index.html
  (l'URL github.io ne doit pas être indexée avant le vrai domaine ; un
  robots.txt ne marcherait pas — racine github.io hors de contrôle sur un
  site projet). deploy.yml la retire si la variable de dépôt
  `SITE_INDEXABLE=true` — à activer au passage sur le domaine définitif
  (avec `environment.baseUrl` + `siteBaseUrl` de main.ts à mettre à jour).
- **PWA installable** : `@angular/service-worker` (version EXACTE du core,
  22.0.1), activé en **prod uniquement** (`serviceWorker` dans la config
  production d'angular.json + `provideServiceWorker` gardé par `isDevMode`).
  `ngsw-config.json` : app shell prefetch, `data/**` en **freshness** (réseau
  d'abord, cache en secours → hors-ligne OK), Google Fonts en performance.
  `public/manifest.webmanifest` + icônes `public/icons/` (générées, any +
  maskable). `UpdateService` (toSignal sur `SwUpdate.versionUpdates`) →
  bannière « Recharger » dans le shell. Les specs TestBed qui montent `App`
  doivent fournir `provideServiceWorker('ngsw-worker.js', {enabled:false})`.
  Vérifié headless : SW contrôlant + navigation et données HORS-LIGNE.

## Supabase (Phase 7 — avis + auth)

- **Avis en mode INVITÉ par défaut** (`docs/SPEC-AVIS-INVITE.md`) : le
  formulaire est ouvert à tous ; au premier « Publier », `AuthService.ensureUser()`
  crée une session **anonymous sign-in** silencieuse (UUID opaque, zéro PII,
  session localStorage → 1 avis/commune/contributeur via l'UNIQUE existant).
  Email **optionnel** dans le formulaire = `attacherEmail()` (`updateUser`)
  APRÈS publication : conversion invité → compte permanent, même `user_id`
  (avis conservés), unicité email native (`email_exists` → propose le
  magic-link, PAS de re-soumission : doublon sinon). `loginWithGoogle()` d'un
  invité passe par `linkIdentity` (avis conservés, repli OAuth classique).
  Header : utiliser `connecteCompte()` (un invité ne s'affiche pas connecté).
  Pseudo public des comptes sans nom IdP = « Habitant #XXXX » stable (dérivé
  du user_id, trigger `force_avis_pseudo`). Dashboard requis : **Allow
  anonymous sign-ins** + **Allow manual linking** ; purge pg_cron des invités
  sans avis > 30 j (fin du schéma SQL).
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
