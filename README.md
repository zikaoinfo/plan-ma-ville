# ma ville, notée — plan-ma-ville

Toutes les communes françaises notées sur 10, à partir de données ouvertes,
sur 8 critères : sécurité, santé, commerces, enseignement, sports & loisirs,
culture, transports, niveau de vie.

**Stack** : Angular 22 (standalone, zoneless, signals), SCSS, ESLint flat
config, Vitest, pipeline de données TypeScript (`tsx`), déploiement GitHub Pages.

> Spécification contractuelle des données : [`docs/SPEC-DATA.md`](docs/SPEC-DATA.md)
> Conventions du projet : [`CLAUDE.md`](CLAUDE.md)

## Démarrage

```bash
npm install
npm run data:sample   # génère public/data/ pour les départements 69 et 75
npm start             # http://localhost:4200/plan-ma-ville/
```

## Scripts

| Script | Rôle |
| --- | --- |
| `npm start` | Serveur de dev |
| `npm run build` | Build prod + `404.html` (GitHub Pages SPA fallback) |
| `npm run data:build` | Pipeline France entière + validation des 6 invariants |
| `npm run data:sample` | Pipeline limité aux départements 69 et 75 |
| `npm test` | Tests unitaires de l'app (Vitest) |
| `npm run test:data` | Tests du pipeline de données |
| `npm run lint` | ESLint (TS + templates) |

## Architecture

- `src/app/core/models/` — schémas contractuels des fichiers JSON.
- `src/app/features/{home,commune,departement,classement,methodologie}` —
  pages lazy-loadées (`loadComponent`).
- `src/app/shared/{note-bar,score-badge}` — composants d'affichage des notes.
- `tools/data-pipeline/` — télécharge les communes (geo.api.gouv.fr),
  calcule des notes **factices mais déterministes** (PRNG seedé par code
  INSEE, Phase 1) et émet `public/data/{index,departements,classement}.json`
  + `dep/{code}.json`.

## Déploiement

Push sur `main` → `.github/workflows/deploy.yml` régénère les données
(avec cache), build l'app et publie sur GitHub Pages sous `/plan-ma-ville/`.

## Phases

- [x] **Phase 0** — bootstrap Angular 22, routing, placeholders, CI Pages.
- [x] **Phase 1** — pipeline de données (notes factices stables).
- [ ] **Phase 2** — recherche (autocomplete sur `index.json`).
- [ ] **Phase 3** — fiches commune/département, classement, visualisations.
