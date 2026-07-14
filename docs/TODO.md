# TODO — ma ville, notée

> État au 2026-07-03. Suivi de ce qui reste après les phases 0→6 + dashboard + carte.
> Specs : `docs/SPEC-DATA.md`, `docs/SPEC-PHASES-2-6.md`, `docs/SPEC-PHASES-7-12.md`.

## État d'avancement

| Phase | Sujet | Statut |
| --- | --- | --- |
| 0 | Bootstrap Angular 22 zoneless, routing, CI Pages | ✅ Fait |
| 1 | Pipeline de données + notes déterministes + 6 invariants | ✅ Fait |
| 2 | Recherche & page Home | ✅ Fait |
| 3 | Fiche commune | ✅ Fait |
| 4 | Page département & classement | ✅ Fait |
| 5 | **Vraies données open data** | ✅ Validé en CI (BPE 86 % · SSMSI 100 % · Filosofi 89 %) |
| 6 | Finitions (SEO, états, méthodologie, assets) | ✅ Fait |
| + | Dashboard commune (carte, thématiques, historique, prix m², voisins) | ✅ Fait (estimations factices) |
| 8 | **Carte interactive Leaflet** | ✅ Fait |
| 7 | Avis communautaires (Supabase) | ✅ Codé — à activer (secrets + SQL) |
| 9 | Résumé IA (Cloudflare Worker) | ⛔ Bloqué infra (option : sauté) |
| 10 | Quiz matching IA | ⏳ Faisable sans IA (matcher déterministe) |
| 11 | Comparateur de villes | ✅ Fait (note habitants via Supabase à brancher) |
| 12 | Profil & villes suivies | ⏳ À faire (Supabase, sans IA) |

Tests : 37 verts (Vitest). Lint clean. Build OK. Pipeline déterministe.

> **⛔ Bloqué infra** = nécessite des ressources externes que la sandbox n'a pas :
> projet **Supabase** (URL + anon key), **Cloudflare Worker** déployé + **clé API
> Claude**, secrets GitHub Actions. Le code peut être écrit mais pas exécuté/validé ici.
> **Piège transverse** : la spec 7-12 suppose **PrimeNG** (Tabs, Slider) — indisponible
> sur Angular 22 → composants maison, comme pour le reste du projet.

---

## 1. Déploiement & vérification (priorité immédiate)

- [x] Merger la branche `claude/angular-21-creative-design-bfybnz` dans `main`.
- [ ] **Activer GitHub Pages** : Settings → Pages → Source = « GitHub Actions ».
- [ ] Vérifier que `deploy.yml` passe au vert (data:build → build → upload-pages).
- [ ] Contrôler en ligne : `https://zikaoinfo.github.io/plan-ma-ville/`
  - [ ] Recherche fonctionne (ex. « vincennes »).
  - [ ] Fiche commune affiche le **dashboard** (et non l'ancien placeholder).
  - [ ] `/robots.txt` et `/sitemap.xml` répondent 200.
- [ ] **Lighthouse mobile** : Performance ≥ 85, Accessibilité ≥ 90 (critère phase 6,
      non mesurable en sandbox).
- [ ] Poser le tag `v0.1.0` (et v0.2.0 → dashboard) une fois en ligne — _le push
      de tags a renvoyé 403 dans l'environnement actuel ; à refaire depuis un
      environnement autorisé ou via l'UI GitHub._

## 2. Phase 5 — Vraies données open data (gros morceau)

> **Codé + testé** (29 tests pipeline verts, typecheck + lint OK). `score/fake.ts`
> supprimé, remplacé par `score/real.ts` (percentile). **Réseau bloqué en sandbox**
> → le vrai fetch/parsing n'a **jamais tourné ici**, à valider au 1er run CI.

- [x] `score/percentile.ts` : `toPercentileNote(value, all, invert)` (fraction ≤
      valeur), `median`, `sortedValues`. Communes sans données → médiane nationale.
- [x] Fetchers (cache `.cache/{nom}.csv` < 30 j, décompression zip/gz, CSV
      streaming — `fetch/download.ts`) :
  - [x] `fetch/bpe.ts` — BPE, densité /1000 hab (F1/F2 sports, F3 culture).
  - [x] `fetch/securite.ts` — SSMSI, dernier millésime, taux /1000 hab inversé.
  - [x] `fetch/filosofi.ts` — revenu médian (auto-détection colonne `MED**`).
  - [x] `fetch/insee-code.ts` — arrondissements Paris/Lyon/Marseille notés
        individuellement (`codesAccumulation`) EN PLUS du repli sur la mère
        (`communeParent`, agrégat historique inchangé). Hiérarchie Région >
        Département > Ville > Arrondissement ; `communeMere`/`arrondissements`
        sur `CommuneDetail`, fiche dédiée par arrondissement (dashboard complet).
- [x] `score/real.ts` — `computeRealScores(communes, DataMaps)` deux passes.
- [x] URLs dans `sources.config.json`. Deps `adm-zip` + `csv-parse`.
- [x] Rapport de run : couverture par source + histogramme des notes /tranche.
- [x] Tests : percentile, repli médiane, parsing BPE/SSMSI/Filosofi, arrondissements.
- [x] `.github/workflows/data-refresh.yml` (cron mensuel + `workflow_dispatch`).
- [x] `/methodologie` : encart « rang percentile » + sources.
- [x] `data-validate.yml` (sur PR, sans déploiement) + `data:build --strict`
      (échoue si une source a 0 % de couverture) → boucle d'itération des URLs.
- [x] **CI validée** (job « Validate open data » vert) : URLs résolues via l'API
      data.gouv. Couverture BPE 86 % · SSMSI 100 % (2025) · Filosofi 89 % (2021).
      Distribution étalée (4-6 : 17 %, 6-8 : 79 %, 8-10 : 5 %) ; aucune note 0/10 ;
      top = Megève/Samoëns, flop = Fleury-Mérogis/Tourcoing/Argenteuil (cohérent).
- [ ] **Upgrade BPE 2018 → millésime récent** : le seul CSV ensemble librement
      téléchargeable est 2018. Trouver l'URL directe du dénombrement INSEE récent
      (fichier large 1 colonne/TYPEQU, déjà géré par le parser) et l'ajouter dans
      `sources.config.json`.

## 3. Dashboard commune — remplacer les estimations factices

> Actuellement déterministes par code INSEE (cf. `commune-insights.ts`), assumées
> « indicatives ». À brancher sur du réel une fois la phase 5 en place.

- [x] **Prix au m²** : FAIT — agrégats « Statistiques DVF » (data.gouv) →
      `fetch/dvf.ts`, `CommuneDetail.prix` (médiane, période, nb ventes,
      historique ≤10 périodes). `estimatePriceM2`/`priceTrendPct` supprimés,
      remplacés par `dvfTrendPct` (tendance 1 an sur données réelles). UI :
      carte prix (sparkline + source), ligne comparateur, méthodologie.
      Hors couverture (Alsace/Moselle/Mayotte, communes sans ventes) → absent.
- [ ] **Historique** : si série temporelle réelle dispo (notes par millésime),
      remplacer `noteHistory` ; sinon garder l'estimation en l'étiquetant.
- [ ] **Carte** : vérifier le rendu de l'iframe OSM en conditions réelles
      (non testable en sandbox sans navigateur).
- [ ] **Voisins** : envisager les communes proches **inter-départements**
      (actuellement limitées au département chargé). Nécessiterait un index
      géographique léger (lat/lon déjà présents dans l'index ? non → à ajouter).

## 4. Améliorations & finitions

- [ ] `favicon.ico` régénéré depuis `favicon.svg` (imagemagick/sharp absents en
      sandbox ; le SVG est référencé en premier, l'ancien `.ico` sert de repli).
- [ ] Vérifier le responsive réel sur mobile (iPhone SE 375px) — tableaux
      département/classement scrollables, dashboard en une colonne.
- [ ] Accessibilité : audit clavier complet (listbox recherche, tableaux triables).
- [ ] Éventuel partage social : image OpenGraph dédiée (actuellement pas d'`og:image`).

## 5. Phases 7→12 — features communautaires & IA (spec `SPEC-PHASES-7-12.md`)

### Prérequis infra (à fournir par le proprio du repo)
- [ ] Projet **Supabase** : exécuter le SQL de la spec §2 (tables `avis`,
      `communes_stats`, `signalements`, `profiles` + triggers + RLS).
- [ ] Secrets GitHub Actions : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WORKER_URL`.
- [ ] Étape « Inject env » dans `deploy.yml` (sed sur `environment.ts`) — §11.
- [ ] **Cloudflare Worker** (`workers/summarize/`) déployé + secret `CLAUDE_API_KEY`
      + namespace KV (rate-limit). CORS pour `zikaoinfo.github.io`.

### Phase 7 — Avis communautaires ✅ codé (Supabase-only)
- [x] `@supabase/supabase-js` ; services `supabase`, `auth`, `avis`.
- [x] Fiche commune : onglets « Données officielles » / « Avis habitants » (maison).
- [x] `commune-avis-list` (stats + liste paginée) et `commune-avis-form`
      (8 sliders maison + textareas + upsert, 1 avis/user/commune, pré-remplissage).
- [x] `auth-gate` (Google + magic-link) et `critere-slider` (shared).
- [x] Dégradation gracieuse si Supabase non configuré (onglet « bientôt », pas de crash).
- [x] **Avis en mode invité par défaut** (`SPEC-AVIS-INVITE.md`) : anonymous
      sign-in silencieux au premier « Publier », email optionnel = conversion
      du compte invité (avis conservés), connexion Google/magic-link en repli
      (`linkIdentity` préserve les avis), pseudonyme stable « Habitant #XXXX »,
      bouton « Supprimer mon avis », section RGPD dans la méthodologie.
- **Pour activer (côté proprio)** :
  1. Coller `docs/supabase-schema.sql` dans Supabase (SQL Editor) — base déjà
     créée : `docs/supabase-migration-avis-invite.sql`.
  2. Activer le provider Google dans Supabase (magic-link email marche sans config).
  3. Auth → Sign In / Up : activer **Allow anonymous sign-ins** ET
     **Allow manual linking** (mode invité + conservation des avis au login).
  4. Ajouter les secrets GitHub `SUPABASE_URL` + `SUPABASE_ANON_KEY`
     (le job `deploy.yml` les injecte dans `environment.ts` au build).
  5. Dans Supabase → Auth → URL Configuration, autoriser
     `https://zikaoinfo.github.io/plan-ma-ville/` en redirect.
  6. (option) pg_cron : purge hebdo des invités sans avis > 30 j (voir fin de
     `supabase-schema.sql`).

### Phase 9 — Résumé IA
- [ ] `workers/summarize/` (endpoints `/summarize` + `/quiz-match`, rate-limit KV).
- [ ] `claude-proxy.service.ts` + `commune-ia-summary` (affiché si ≥ 3 avis).
- [ ] Modèle Claude à jour (la spec cite `claude-sonnet-4-6` → utiliser le dernier
      Sonnet disponible au moment du déploiement).

### Phase 10 — Quiz matching
- [ ] `features/quiz/` (5 étapes signal-driven) + `CommuneCard` (shared).
- [ ] Fallback « IA indisponible » si `workerUrl` vide.

### Phase 11 — Comparateur ✅ Fait
- [x] `features/comparateur/` : jusqu'à 3 villes, URL partageable
      (`?villes=slug1,slug2`), tableau comparatif, meilleure note surlignée,
      autocomplete réutilisant SearchIndexService, responsive.
- [ ] Brancher la ligne « Note habitants » sur `communes_stats` (Phase 7).

### Phase 12 — Profil & villes suivies
- [ ] `features/profil/` (guard auth), villes suivies, mes avis.
- [ ] Bouton cœur « suivre » sur la fiche commune (state optimiste).

### Enrichissement classement (§12 de la spec)
- [ ] Colonnes « Note habitants » / « Avis » dans le classement (via `communes_stats`).

## 6. Dette technique / notes

- **PrimeNG non installé** : dernière version (21.x) peer-requiert Angular 21, pas
  de build Angular 22. Atomes UI faits maison. À réévaluer quand PrimeNG 22 sort.
- **Node 24** installé localement (Angular 22 CLI exige > 22.22.3). CI utilise Node 24.
- **Push de tags bloqué (403)** dans l'environnement distant — tags créés en local
  uniquement (`v0.2.0`→`v0.6.0`).
- **baseHref** `/plan-ma-ville/` (nom réel du repo), pas `/ma-ville-notes/` de la spec.
- Données runtime (`public/data/*.json`, `public/sitemap.xml`) gitignorées,
  régénérées en CI avant chaque build.
