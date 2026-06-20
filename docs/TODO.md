# TODO — ma ville, notée

> État au 2026-06-14. Suivi de ce qui reste après les phases 0→6 + dashboard commune.
> Specs de référence : `docs/SPEC-DATA.md`, `docs/SPEC-PHASES-2-6.md`.

## État d'avancement

| Phase | Sujet | Statut |
| --- | --- | --- |
| 0 | Bootstrap Angular 22 zoneless, routing, CI Pages | ✅ Fait |
| 1 | Pipeline de données + notes déterministes + 6 invariants | ✅ Fait |
| 2 | Recherche & page Home | ✅ Fait |
| 3 | Fiche commune | ✅ Fait |
| 4 | Page département & classement | ✅ Fait |
| 5 | **Vraies données open data** | ⏳ À faire |
| 6 | Finitions (SEO, états, méthodologie, assets) | ✅ Fait |
| + | Dashboard commune (carte, thématiques, historique, prix m², voisins) | ✅ Fait (estimations factices) |

Tests : 35 verts (Vitest). Lint clean. Build OK. Pipeline déterministe.

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

## 5. Dette technique / notes

- **PrimeNG non installé** : dernière version (21.x) peer-requiert Angular 21, pas
  de build Angular 22. Atomes UI faits maison. À réévaluer quand PrimeNG 22 sort.
- **Node 24** installé localement (Angular 22 CLI exige > 22.22.3). CI utilise Node 24.
- **Push de tags bloqué (403)** dans l'environnement distant — tags créés en local
  uniquement (`v0.2.0`→`v0.6.0`).
- **baseHref** `/plan-ma-ville/` (nom réel du repo), pas `/ma-ville-notes/` de la spec.
- Données runtime (`public/data/*.json`, `public/sitemap.xml`) gitignorées,
  régénérées en CI avant chaque build.
