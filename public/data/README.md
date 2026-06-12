# public/data/

Contenu **généré** par `tools/data-pipeline` — ne rien éditer à la main.

- `npm run data:sample` — départements 69 et 75 uniquement (dev rapide).
- `npm run data:build` — France entière + validation des invariants.

Fichiers produits : `index.json`, `departements.json`, `classement.json`,
`dep/{code}.json`. Tous gitignorés (régénérés en CI avant chaque déploiement).
Schémas contractuels : `docs/SPEC-DATA.md` §1.
