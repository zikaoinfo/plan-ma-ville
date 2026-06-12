# Annexe technique — Schémas de données & prompts détaillés (Phases 0–1)

> Complément de `PLAN-ma-ville-notes.md`.
> Stack : **Angular 22**, zoneless, standalone, Signal Forms, httpResource stable.

---

## 1. Schémas TypeScript exacts

À créer dans `src/app/core/models/data.models.ts` **et** copié dans
`tools/data-pipeline/src/models.ts` (copie suffit, pas besoin de package partagé).

```typescript
// ─────────────────────────────────────────────
// Critères de notation (ordre canonique, figé)
// ─────────────────────────────────────────────
export const CRITERES = [
  'securite',
  'sante',
  'commerces',
  'enseignement',
  'sports',
  'culture',
  'transports',
  'niveauVie',
] as const;

export type Critere = (typeof CRITERES)[number];

export const CRITERE_LABELS: Record<Critere, string> = {
  securite:     'Sécurité',
  sante:        'Santé',
  commerces:    'Commerces',
  enseignement: 'Enseignement',
  sports:       'Sports & loisirs',
  culture:      'Culture',
  transports:   'Transports',
  niveauVie:    'Niveau de vie',
};

// ─────────────────────────────────────────────
// index.json — index de recherche global
// Champs courts volontairement : ~35 000 entrées
// ─────────────────────────────────────────────
export interface SearchIndexFile {
  v: 1;                  // version schéma
  gen: string;           // date ISO génération (YYYY-MM-DD)
  items: SearchIndexItem[];  // triés par nn croissant
}

export interface SearchIndexItem {
  /** Nom officiel ("Lyon", "Saint-Étienne") */
  n: string;
  /** Nom normalisé : minuscules, sans accents, tirets/apostrophes → espaces */
  nn: string;
  /** Codes postaux (plusieurs possibles) */
  cp: string[];
  /** Code département ("01"…"95", "2A", "2B", "971"…"976") */
  d: string;
  /** Slug = nom-kebab + code INSEE : "saint-denis-93066" */
  s: string;
  /** Code INSEE (≠ code postal !) */
  i: string;
  /** Population */
  p: number;
  /** Note globale /10, 1 décimale — affichée dans l'autocomplete */
  g: number;
}

// ─────────────────────────────────────────────
// departements.json
// ─────────────────────────────────────────────
export interface DepartementsFile {
  v: 1;
  gen: string;
  items: DepartementSummary[];
}

export interface DepartementSummary {
  code: string;          // "69"
  nom: string;           // "Rhône"
  nbCommunes: number;
  noteMoyenne: number;   // moyenne pondérée population, 1 décimale
}

// ─────────────────────────────────────────────
// dep/{code}.json — détail par département (lazy)
// ─────────────────────────────────────────────
export interface DepartementDetailFile {
  v: 1;
  gen: string;
  code: string;
  nom: string;
  communes: CommuneDetail[];
}

export interface CommuneDetail {
  slug: string;
  nom: string;
  codeInsee: string;
  codesPostaux: string[];
  population: number;
  score: CommuneScore;
}

export interface CommuneScore {
  /** 'computed' = open data v1. 'community' réservé pour plus tard. */
  source: 'computed' | 'community';
  /** Note globale /10, 1 décimale */
  global: number;
  /** Notes /10 par critère, 1 décimale */
  criteres: Record<Critere, number>;
}

// ─────────────────────────────────────────────
// classement.json — top/flop national
// ─────────────────────────────────────────────
export interface ClassementFile {
  v: 1;
  gen: string;
  populationMin: number;
  top: ClassementEntry[];   // 50, note décroissante
  flop: ClassementEntry[];  // 50, note croissante
}

export interface ClassementEntry {
  slug: string;
  nom: string;
  departement: string;
  population: number;
  global: number;
}
```

### `tools/data-pipeline/scoring.config.json`

```json
{
  "version": 1,
  "populationMinClassement": 2000,
  "ponderations": {
    "securite":     1.5,
    "sante":        1.2,
    "commerces":    1.0,
    "enseignement": 1.0,
    "sports":       0.8,
    "culture":      0.8,
    "transports":   1.2,
    "niveauVie":    1.0
  }
}
```

> Note globale = `Σ(note × poids) / Σ(poids)`, arrondie à 1 décimale.

### Invariants contractuels (à valider en fin de pipeline)

1. Toute note ∈ `[0, 10]`, exactement 1 décimale (`Math.round(x * 10) / 10`).
2. `index.json.items` trié par `nn` croissant.
3. Chaque `slug` est unique sur l'ensemble du territoire.
4. Chaque `SearchIndexItem.i` existe dans exactement un `dep/{d}.json`.
5. Pas d'arrondissements de Paris/Lyon/Marseille en double avec la commune mère.
6. Codes Corse : `2A` / `2B` — noms de fichiers valides tels quels.

---

## 2. Prompt Phase 0 — Bootstrap Angular 22

```text
Lis CLAUDE.md et docs/SPEC-DATA.md avant de commencer.

Initialise ce repo comme une app Angular 22 nommée "ma-ville-notes".

Tâches :

1. ng new en place : Angular 22, standalone, zoneless (PAS de zone.js, PAS
   de provideZoneChangeDetection), sans SSR, routing, SCSS, strict TypeScript.
   main.ts utilise bootstrapApplication avec provideRouter et provideHttpClient.

2. ESLint flat config (eslint.config.js) avec @angular-eslint :
   règles TS sur *.ts séparées des règles template sur *.html.

3. Arborescence avec composants placeholder standalone :
   - src/app/core/models/data.models.ts ← copie EXACTE des interfaces §1 ci-dessus
   - src/app/core/services/ (vide)
   - src/app/features/home, commune, departement, classement, methodologie
     (chacun : composant standalone affichant son nom, OnPush implicite)
   - src/app/shared/note-bar/, src/app/shared/score-badge/ (composants vides)

4. Routing dans app.routes.ts avec lazy loadComponent :
   ''                   → home
   'ville/:slug'        → commune
   'departement/:code'  → departement
   'classement'         → classement
   'methodologie'       → methodologie
   '**'                 → redirect ''

5. GitHub Pages :
   - angular.json : outputPath "dist/ma-ville-notes", baseHref "/ma-ville-notes/"
   - package.json scripts :
     "build": "ng build && node tools/copy-404.mjs"
   - tools/copy-404.mjs : copie dist/ma-ville-notes/browser/index.html
     → dist/ma-ville-notes/browser/404.html (fs/promises, ESM)

6. public/data/ avec .gitkeep. Ajoute public/data/*.json dans .gitignore
   SAUF public/data/README.md (qui explique que le contenu est généré).

7. .github/workflows/deploy.yml exact du PLAN.md §9 (étape data:build
   remplacée par un commentaire TODO pour l'instant).

Critères d'acceptation — vérifie avant de conclure :
- `npm run build` réussit, 404.html existe dans dist.
- `npm start` : les 5 routes affichent leur placeholder.
- `npx eslint .` passe sans erreur.
- Aucun NgModule, aucun constructeur d'injection (inject() uniquement).
- Aucune référence à zone.js dans le projet.
```

---

## 3. Prompt Phase 1 — Pipeline de données (notes factices stables)

```text
Lis CLAUDE.md et docs/SPEC-DATA.md. Les schémas §1 et les invariants sont
contractuels — le pipeline doit les respecter exactement.

Implémente tools/data-pipeline/ en TypeScript (tsx, pas de build) :

tools/data-pipeline/
├── package.json          (private, deps : tsx, @types/node)
├── sources.config.json   (toutes URLs en dur ici, jamais dans le code)
├── scoring.config.json   (copie du §1 de la spec)
└── src/
    ├── main.ts           (orchestrateur + CLI --departements 69,75)
    ├── models.ts         (copie des interfaces de data.models.ts)
    ├── fetch/geo.ts
    ├── score/fake.ts
    ├── score/aggregate.ts
    └── emit/index.ts

────────────────────────────────────────────
1. fetch/geo.ts
────────────────────────────────────────────
- GET https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,codeDepartement,population&format=json
- Cache brut dans tools/data-pipeline/.cache/geo.json (gitignoré).
- Filtrer type === 'arrondissement-municipal' si présent.
- population absente ou 0 → 1.
- codesPostaux absent → [].

────────────────────────────────────────────
2. score/fake.ts — PRNG déterministe
────────────────────────────────────────────
Utilise EXACTEMENT ce PRNG (ne pas réinventer) :

function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// usage : const rand = mulberry32(cyrb53(codeInsee));

Pour chaque critère : note = rand() dans [2.0, 9.5] arrondi 1 décimale.
Biais communes > 20 000 hab : +0.5 sur transports, culture, commerces (max 9.5).
source: 'computed'.

────────────────────────────────────────────
3. score/aggregate.ts — note globale
────────────────────────────────────────────
Fonction pure :
  noteGlobale(criteres: Record<Critere, number>, ponderations: Record<Critere, number>): number
= Σ(note × poids) / Σ(poids), arrondi 1 décimale.
Throw si un poids est 0 ou négatif.

────────────────────────────────────────────
4. emit/index.ts
────────────────────────────────────────────
Normalisation nn :
  s.toLowerCase()
   .normalize('NFD').replace(/\p{Diacritic}/gu, '')
   .replace(/['\-]/g, ' ')
   .replace(/\s+/g, ' ').trim()

Slug : nn avec espaces → tirets, + '-' + code INSEE.

Génère :
  public/data/index.json       (SearchIndexFile, trié par nn)
  public/data/departements.json
  public/data/dep/{code}.json  (un fichier par département)
  public/data/classement.json  (populationMin depuis scoring.config.json)

Table statique des noms de départements dans le pipeline (ne pas appeler d'API).

Rapport en fin de run :
  - nb communes total, nb départements
  - taille index.json gzippé (exécute gzip -c | wc -c)
  - top 3 / flop 3 pour contrôle visuel

────────────────────────────────────────────
5. Validation post-génération (dans main.ts)
────────────────────────────────────────────
Recharge les fichiers émis et vérifie les 6 invariants de la spec §1.
Échec → exit code 1 + message explicite.

────────────────────────────────────────────
6. Scripts racine du repo (ajouter dans package.json)
────────────────────────────────────────────
"data:build":  "tsx tools/data-pipeline/src/main.ts"
"data:sample": "tsx tools/data-pipeline/src/main.ts --departements 69,75"

────────────────────────────────────────────
7. Tests Vitest dans tools/data-pipeline
────────────────────────────────────────────
- normalisation nn :
    "Saint-Étienne"    → "saint etienne"
    "L'Haÿ-les-Roses"  → "l hay les roses"
- stabilité PRNG : même code INSEE → mêmes 8 notes sur 2 appels
- aggregate : poids uniformes → moyenne simple, poids 0 → throw
- slugs uniques sur un jeu de communes homonymes
  (plusieurs "Saint-Denis" → distingués par code INSEE)

────────────────────────────────────────────
8. CI — deploy.yml
────────────────────────────────────────────
Remplace le TODO par l'étape data:build AVANT npm run build,
avec le cache actions/cache sur public/data comme dans PLAN.md §9.

────────────────────────────────────────────
Critères d'acceptation
────────────────────────────────────────────
- `npm run data:sample` < 30 s, génère les 4 fichiers de données.
- `npm run data:build` : validation des 6 invariants passe.
- index.json complet gzippé < 1,5 Mo (affiché dans le rapport).
- Deux runs successifs → fichiers byte-identiques (diff vide).
- Tous les tests Vitest passent.
- `npm start` puis /data/index.json accessible depuis le browser
  (vérifier que public/ est bien dans assets angular.json).
```

---

## 4. PRNG de référence rapide

```typescript
// Copier tels quels dans fake.ts — ne pas modifier
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

## 5. Anti-pièges Angular 22

### Zoneless

```typescript
// main.ts — PAS de provideZoneChangeDetection
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    // pas de provideZoneChangeDetection ici
  ],
});
```

### httpResource pour les données

```typescript
// commune-data.service.ts
readonly #depCache = new Map<string, Signal<DepartementDetailFile | undefined>>();

loadDep(code: string): Signal<DepartementDetailFile | undefined> {
  if (!this.#depCache.has(code)) {
    const res = httpResource<DepartementDetailFile>(
      () => `/ma-ville-notes/data/dep/${code}.json`
    );
    this.#depCache.set(code, computed(() => res.value()));
  }
  return this.#depCache.get(code)!;
}
```

### Signal Forms pour la recherche

```typescript
// home.component.ts
readonly query = signal('');

// template
<input [value]="query()" (input)="query.set($any($event.target).value)" />
```

*(Signal Forms stable en v22 — utiliser l'API officielle si disponible,
sinon ce pattern signal manuel est équivalent et tout aussi propre.)*

## 6. Checklist fin de phase 1

- [ ] `npm run data:sample` → rapport affiché, 5 fichiers dans public/data/
- [ ] Ouvrir dep/69.json : Lyon note globale visible, biais grandes villes présent
- [ ] Push sur main → deploy.yml termine en vert
- [ ] `https://<user>.github.io/ma-ville-notes/data/index.json` répond 200
- [ ] Tag `v0.1.0`

→ Phase 2 (recherche) peut démarrer.
