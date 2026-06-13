# Prompts détaillés — Phases 2 à 6

> Complément de `PLAN-ma-ville-notes.md` et `docs/SPEC-DATA.md`.
> Stack : Angular 22, zoneless, httpResource, Signal Forms, PrimeNG v19+.

> **Note de déploiement** : la spec écrit les URLs de données sous
> `/ma-ville-notes/data/...`. Le repo réel s'appelle `plan-ma-ville`, donc le
> `baseHref` est `/plan-ma-ville/`. Les services dérivent l'URL des données de
> `document.baseURI` (chemin relatif `data/…`) pour rester corrects en dev
> (`/plan-ma-ville/data/…`) comme en prod GitHub Pages.

---

## Phase 2 — Recherche & Home

### A. SearchIndexService (`src/app/core/services/search-index.service.ts`)
- `httpResource<SearchIndexFile>` sur `data/index.json`, second resource sur
  `data/departements.json`.
- `ready = computed(() => index.status() === 'resolved')`.
- `search(query)` : dispatch `/^\d{2,5}$/` → code postal (startsWith sur `cp[]`),
  sinon nom normalisé `nn` en startsWith. `query.length < 2` → `[]`. Max 10.
  Tri : exact match, puis startsWith, puis longueur.
- `getDepartements()` : `[]` si pas résolu.

### B. HomeComponent
Titre + sous-titre, champ recherche (signal `query`), liste de résultats
(role listbox/option), spinner si `!ready()`, section départements triée par code.

### C. Composants partagés
- `ScoreBadgeComponent` : score 0–10, couleur dynamique
  (<4 rouge, <6 orange, <7.5 jaune texte noir, ≥7.5 vert).
- `NoteBarComponent` : label + barre CSS `width: score/10*100%` + score,
  `role="progressbar"` avec `aria-valuenow/min/max`.

---

## Phase 3 — Fiche commune

### A. CommuneDataService
Résout un slug → `CommuneDetail`. Trouve l'item d'index (`s === slug`) →
code dép `d` → charge `dep/{d}.json` via httpResource (cache `Map`, un resource
par département). `getCommuneBySlug(slug)` →
`Signal<CommuneDetail | undefined | 'loading' | 'not-found'>`. `computed()` only.

### B. CommuneComponent
`@switch` sur l'état : skeleton / "introuvable" / fiche (ScoreBadge + 8 NoteBar
dans l'ordre `CRITERES`). Largeur max 680px. `effect()` pour le `<title>`.

---

## Phase 4 — Département & Classement

### A. DepartementComponent
`loadDep(code)` → `Signal<DepartementDetailFile | undefined>`. Signals locaux
`sortField` / `sortOrder` / `filterText`, dérivation `computed()` pure.
Tableau HTML natif (pas de p-table), colonnes critères masquées < 768px.

### B. ClassementComponent
`httpResource<ClassementFile>` sur `data/classement.json`. Onglets top/flop,
filtre par département (`<select>`), tableau Rang/Commune/Dép/Pop/Note.

---

## Phase 5 — Vraies données open data

Remplace `score/fake.ts` par de vraies sources (BPE INSEE, SSMSI sécurité,
Filosofi niveau de vie). URLs dans `sources.config.json`. Normalisation en
percentile (`score/percentile.ts`), communes sans données → médiane nationale.
Page `/methodologie` statique (sources, millésimes, pondérations, limites).

## Phase 6 — Finitions

SEO (`MetaService` : title/description/og/canonical), responsive mobile
(breakpoints 767/1023px), états chargement/erreur uniformes
(`PageSkeletonComponent`, `ErrorMessageComponent`), favicon SVG, `robots.txt`,
`sitemap.xml` (généré par le pipeline : home + classement + méthodo + 1 URL/dép).

---

## Récapitulatif des composants (fin phase 6)

```
src/app/
├── core/
│   ├── models/data.models.ts
│   └── services/{search-index,commune-data,meta}.service.ts
├── features/{home,commune,departement,classement,methodologie}/
└── shared/{score-badge,note-bar,page-skeleton,error-message}/
```

## Notes inter-phases
- Commit + tag par phase (`v0.2.0` phase 2, etc.), jamais deux phases mélangées.
- Un bug dans les JSON générés → fix dans le pipeline d'abord (les données sont
  le contrat, pas le front).
- PrimeNG dernière version compatible Angular 22, `providePrimeNG({ theme: Aura })`.
