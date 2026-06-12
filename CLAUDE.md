# ma-ville-notes (repo : plan-ma-ville)

Application Angular 22 qui note les communes françaises sur 8 critères
(données open data, notes factices déterministes en Phase 1).
Spécification contractuelle : `docs/SPEC-DATA.md`.

## Stack & conventions

- **Angular 22**, standalone uniquement (aucun `NgModule`), **zoneless**
  (pas de `zone.js`, pas de `provideZoneChangeDetection`).
- Injection via `inject()` uniquement — jamais par constructeur.
- `ChangeDetectionStrategy.OnPush` sur tous les composants.
- SCSS, TypeScript strict, ESLint flat config (`eslint.config.js`).
- Routing lazy via `loadComponent` dans `src/app/app.routes.ts`.
- Données runtime : fichiers JSON statiques dans `public/data/`
  (générés, gitignorés sauf `README.md`).

## Arborescence

- `src/app/core/models/data.models.ts` — schémas contractuels (§1 de la spec).
- `src/app/core/services/` — services (httpResource).
- `src/app/features/{home,commune,departement,classement,methodologie}/`
- `src/app/shared/{note-bar,score-badge}/`
- `tools/data-pipeline/` — pipeline TypeScript exécuté avec `tsx` (pas de build).

## Commandes

- `npm start` — serveur de dev.
- `npm run build` — build prod + génération `404.html` (GitHub Pages).
- `npm run data:sample` — pipeline sur les départements 69 et 75.
- `npm run data:build` — pipeline complet + validation des 6 invariants.
- `npm test` — tests Vitest du pipeline (`tools/data-pipeline`).
- `npx eslint .` — lint.

## Décisions de déploiement

- Le repo GitHub s'appelle `plan-ma-ville` ⇒ le `baseHref` est
  **`/plan-ma-ville/`** (et non `/ma-ville-notes/` comme dans la spec,
  sinon GitHub Pages servirait un 404). L'app et `outputPath` gardent
  le nom `ma-ville-notes`.
- Déploiement GitHub Pages via `.github/workflows/deploy.yml`
  (data:build → build → upload-pages-artifact).

## Invariants données (rappel)

Toute note ∈ [0,10] à 1 décimale ; `index.json` trié par `nn` ;
slugs uniques ; chaque commune de l'index présente dans exactement un
`dep/{d}.json` ; pas de doublons arrondissements/commune mère ;
codes Corse `2A`/`2B`.
