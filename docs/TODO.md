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
| 5 | **Vraies données open data** | ⏳ À faire (réseau) |
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

> Bloqué en sandbox : `insee.fr` et `data.gouv.fr` hors allowlist réseau. À faire
> dans un environnement avec accès, ou en CI. L'API publique de `score/fake.ts`
> doit rester compatible (le reste du pipeline ne bouge pas).

- [ ] `tools/data-pipeline/src/score/percentile.ts` : `toPercentileNote(value, all, invert)`
      + communes sans données → médiane nationale (jamais 0). Test :
      `toPercentileNote(5,[1,3,5,7,9]) === 6`.
- [ ] Fetchers (cache `.cache/{nom}.json` < 30 j, décompression zip, parsing CSV) :
  - [ ] `fetch/bpe.ts` — Base permanente des équipements (santé, commerces,
        enseignement, sports, culture, transports). Densité / 1000 hab.
  - [ ] `fetch/securite.ts` — SSMSI (taux pour 1000 hab, note inversée).
  - [ ] `fetch/filosofi.ts` — revenu médian (niveau de vie).
- [ ] `score/real.ts` — remplace `fake.ts`, même signature ; `DataMaps`
      (bpe, securite, filosofi, distributions nationales).
- [ ] URLs **uniquement** dans `sources.config.json` (UUID data.gouv inclus).
- [ ] Ajouter `csv-parse` (ou `papaparse`) à `tools/data-pipeline/package.json`.
- [ ] Rapport de run : distribution des notes globales par tranche (courbe ~normale).
- [ ] Tests : percentile, commune sans données → médiane.
- [ ] Critères : Lyon transports > 7 ; commune rurale ≠ 0 ; pas de 0/10 parfaits.
- [ ] `.github/workflows/data-refresh.yml` (cron) — rafraîchit les données ;
      tester via `workflow_dispatch` avant merge.
- [ ] Mettre à jour `/methodologie` : retirer l'encart « notes déterministes »,
      renseigner sources + millésimes réels.

## 3. Dashboard commune — remplacer les estimations factices

> Actuellement déterministes par code INSEE (cf. `commune-insights.ts`), assumées
> « indicatives ». À brancher sur du réel une fois la phase 5 en place.

- [ ] **Prix au m²** : source réelle DVF (Demandes de Valeurs Foncières,
      data.gouv.fr) → prix médian par commune. Ajouter au pipeline + au schéma
      `CommuneDetail` (`prixM2?`). Retirer `estimatePriceM2` une fois réel.
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
- **Pour activer (côté proprio)** :
  1. Coller `docs/supabase-schema.sql` dans Supabase (SQL Editor).
  2. Activer le provider Google dans Supabase (magic-link email marche sans config).
  3. Ajouter les secrets GitHub `SUPABASE_URL` + `SUPABASE_ANON_KEY`
     (le job `deploy.yml` les injecte dans `environment.ts` au build).
  4. Dans Supabase → Auth → URL Configuration, autoriser
     `https://zikaoinfo.github.io/plan-ma-ville/` en redirect.

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
