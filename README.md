# ma ville, notée — plan-ma-ville

Toutes les communes françaises notées sur 10, à partir de données ouvertes,
sur 8 critères : sécurité, santé, commerces, enseignement, sports & loisirs,
culture, transports, niveau de vie.

> Spécifications : [`docs/SPEC-DATA.md`](docs/SPEC-DATA.md) (données) et
> [`docs/SPEC-PHASES-2-6.md`](docs/SPEC-PHASES-2-6.md) (front).
> Conventions : [`CLAUDE.md`](CLAUDE.md).

## Fonctionnalités

- **Recherche instantanée** par nom ou code postal (autocomplete sur un index
  statique, dispatch nom / code postal).
- **Fiche commune** : note globale + 8 notes par critère, barres colorées.
- **Page département** : tableau triable et filtrable des communes.
- **Classement national** : meilleures / pires communes, filtre par département.
- **Méthodologie** : critères, pondérations, sources et limites.
- SEO (titres, meta, OpenGraph, canonical, sitemap), responsive mobile,
  états de chargement/erreur, accessibilité.

## Stack

Angular 22 (standalone, **zoneless**, signals, `httpResource`), SCSS,
TypeScript strict, ESLint flat config, Vitest. Pipeline de données TypeScript
exécuté avec `tsx`. Déploiement GitHub Pages.

## Lancer en local

```bash
npm install
npm run data:sample   # données de dev (départements 69 + 75)
npm start             # http://localhost:4200/plan-ma-ville/
```

> Le pipeline télécharge la liste des communes depuis `geo.api.gouv.fr`
> (mise en cache dans `tools/data-pipeline/.cache/`). En environnement sans
> accès à cet hôte, fournissez un `geo.json` de cache.

## Mettre à jour les données

```bash
npm run data:build    # France entière + validation des 6 invariants + sitemap
```

Les fichiers générés (`public/data/*.json`, `public/sitemap.xml`) sont
gitignorés et régénérés en CI avant chaque déploiement.

## Scripts

| Script | Rôle |
| --- | --- |
| `npm start` | Serveur de dev |
| `npm run build` | Build prod + `404.html` (fallback SPA GitHub Pages) |
| `npm run data:build` / `data:sample` | Pipeline complet / restreint (69, 75) |
| `npm test` | Tests unitaires de l'app (Vitest) |
| `npm run test:data` | Tests du pipeline de données |
| `npm run lint` | ESLint (TS + templates) |

## Déploiement

Push sur `main` → `.github/workflows/deploy.yml` régénère les données (avec
cache), build l'app et publie sur GitHub Pages sous `/plan-ma-ville/`.
Activer Pages avec la source « GitHub Actions » dans les réglages du dépôt.

## Sources des données

- Communes & population : [API Géo](https://geo.api.gouv.fr).
- Équipements, sécurité, niveau de vie : INSEE (BPE, Filosofi) et SSMSI —
  branchement prévu en phase ultérieure ; les notes par critère sont
  actuellement générées de façon déterministe (voir `/methodologie`).

## Licence

MIT.
