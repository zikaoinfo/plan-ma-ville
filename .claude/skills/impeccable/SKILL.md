---
name: impeccable
description: Barre de qualité UI pour plan-ma-ville — tokens de thème, atomes maison (pas de PrimeNG), états vides/erreur honnêtes, a11y RGAA. À invoquer avant toute création ou modification d'écran, de composant ou de SCSS.
---

# Design impeccable — plan-ma-ville

Objectif : une UI **sobre, factuelle et tenue**, cohérente entre 2 thèmes × 4 accents,
qui ne promet jamais une donnée qu'on n'a pas. Ce fichier est la barre de qualité ;
l'accessibilité détaillée vit dans `ACCESSIBILITE-RGAA.md` (ne pas la dupliquer ici).

## 1. Le système existe déjà — s'y brancher, ne pas le refaire

Tokens définis dans `src/styles.scss` (`:root`, `[data-accent=…]`, `[data-theme='dark']`) :

| Rôle | Tokens |
| --- | --- |
| Surfaces | `--paper`, `--paper-soft`, `--paper-raised`, `--line`, `--line-strong`, `--scrim` |
| Texte | `--ink`, `--ink-soft` |
| Accent | `--accent`, `--accent-soft`, `--accent-text`, `--on-accent` |
| Sémantique | `--good`/`--good-soft`/`--good-text`, `--warn`, `--bad`/`--on-bad` |
| Paliers de note | `--tier-bad/-mid/-warn/-good` + `--on-tier-*` (via `TIER_VAR`) |
| Forme | `--radius` (14), `--radius-sm` (8), `--shadow`, `--shadow-lift` |
| Largeurs | `--container` (1080, prose), `--container-wide` (1280, dashboards) |
| Typo | `--font-display`, `--font-body`, `--fs-display/-xxl/-xl/-l/-m/-s/-xs`, `--num-tracking` |
| Espacement | `--sp-1`…`--sp-8` (0.25 → 4rem) |

**Règles :**

- **Zéro hex, zéro rgb() en dur dans un composant.** Une couleur nouvelle se déclare
  d'abord comme token dans `styles.scss`, dans **les deux thèmes**, et pour les 4 accents
  si elle en dépend.
- **Tout token de couleur porte son ratio de contraste en commentaire** (`/* 5.16:1 en blanc */`),
  comme les tokens existants. Pas de ratio calculé = pas de token.
- Texte sur accent → `--on-accent` (jamais `#fff` supposé : en sombre l'accent s'éclaircit
  et `--on-accent` devient de l'encre).
- Accent = ponctuation, pas remplissage : liens, focus, CTA, pastilles actives. Le fond reste `--paper`.
- Le socle global (`:focus-visible`, `.skip-link`, `.sr-only`, `.chiffre`,
  `prefers-reduced-motion`) est déjà en place — ne pas le réécrire par composant.
- **Toute taille de texte et tout espacement passent par un token** (`--fs-*`,
  `--sp-*`) : des `rem` ad hoc par feuille et le rythme de la page se défait.
- **Un chiffre mis en scène porte `.chiffre`** (chasse fixe + tracking) : deux
  nombres empilés doivent s'aligner au chiffre près.
- **Couleur de note dans le DOM = `TIER_VAR`**, jamais `TIER_BG` (hex figé au
  thème clair, réservé au canvas Leaflet).

## 1 bis. Trois niveaux de surface (hiérarchie)

Un écran n'a qu'UN bloc primaire. Le poids visuel se porte par la surface, pas
par l'ombre — l'ombre portée sur tout ne hiérarchise rien.

| Niveau | Traitement | Exemple |
| --- | --- | --- |
| Primaire | `--paper-raised` + `--line-strong` | bandeau héros, notes par thématique |
| Secondaire | `.card` : `--paper` + `--line`, sans ombre | prix, démographie, mairie |
| Tertiaire | `.card--liens` : filet supérieur seul, titre en petites capitales | maillage interne (alentours, similaires, hubs, FAQ) |

## 2. Idiome de composant

- Standalone, `ChangeDetectionStrategy.OnPush`, `inject()`, signals. Aucun `NgModule`,
  aucun `async` pipe, aucun `subscribe()`.
- **Atome** (< ~60 lignes de style) : `template` + `styles` inline dans le décorateur
  (cf. `shared/score-badge`). **Écran ou composant riche** : `.html` + `.scss` séparés
  (cf. `shared/profil-picker`, features).
- **PrimeNG interdit.** Un besoin de widget = un atome maison dans `src/app/shared/`,
  réutilisable, avec son alternative clavier native.
- Préférer l'élément natif (`<button>`, `<a>`, `<details>`, `<table>`, `<label>`) à une
  reconstruction ARIA : plus court et plus accessible.
- Classes en BEM léger, scopées au composant : `.badge`, `.badge__num`, `.badge--compact`.

## 3. Mise en page

- Largeur de lecture : `.container` / `--container`. Ne pas inventer une largeur max locale.
- Écrans composites (dashboard commune) : `grid-template-areas` nommées, une variante
  explicite quand une zone manque (`dash--nomap`) — jamais un trou dans la grille.
- Rupture mobile du site : **920px** (nav burger). Vérifier aussi ~380px (marque réduite).
- Échelle d'espacement en `rem`, multiples de `0.25rem`. Rythme vertical constant entre
  sections d'une même page.
- Tableaux et blocs larges : conteneur `overflow-x: auto`, jamais de scroll horizontal de page.

## 4. Honnêteté de l'affichage (identité du produit)

Le site se positionne sur la rigueur face à ville-ideale.fr. L'UI doit le refléter :

- **Donnée absente → message honnête** (« Pas de vente enregistrée sur la période »),
  jamais une estimation, un `—` muet, un 0 trompeur ou un placeholder qui ressemble à une valeur.
- Tout chiffre affiché est **sourcé et daté** (millésime / « Fraîcheur des données »).
- Aucune tendance, trajectoire ou projection sans deux millésimes réels derrière.
- Trois états à dessiner pour toute vue qui charge : **chargement** (squelette ou spinner,
  **jamais** de `noindex`), **erreur** (`shared/error-message`, action de reprise),
  **vide** (phrase qui explique pourquoi, pas une zone blanche).

## 5. Definition of Done UI

Avant d'annoncer qu'un écran est fini :

1. `npx eslint .` vert, `npm test` vert, **`npm run test:ui` vert** — cette suite
   Playwright automatise les points 2, 3 et 5 ci-dessous (elle lit les valeurs
   calculées par le navigateur, pas des captures) ; les points 4, 6 et 7 restent
   à la main.
2. Rendu vérifié en **clair et sombre** et sur **les 4 accents** (orange/jaune/vert/bleu).
3. Rendu vérifié à ~360px, ~920px et > 1080px.
4. Parcours **clavier seul** : tout atteignable, focus visible, pas de piège.
5. Contrastes ≥ 4.5:1 (texte) / 3:1 (UI) **dans les deux thèmes** — ratios notés en commentaire.
6. États chargement / erreur / vide réellement implémentés, pas seulement le cas nominal.
7. `ACCESSIBILITE-RGAA.md` §1 repassée point par point ; citer ce qui a été vérifié
   **manuellement**, ne jamais dire « accessible » sur la seule foi d'un linter.
8. Aucun hex en dur introduit :
   `grep -rn '#[0-9a-fA-F]\{3,6\}' src/app --include='*.scss' --include='*.ts' | grep -v spec`
   Seules exceptions légitimes existantes : `score-color.ts` (paliers de note, ratios
   documentés), `marker-style.ts` (Leaflet peint hors CSS, pas d'accès aux variables) et
   `theme.service.ts` (`<meta name="theme-color">`). Toute autre occurrence est un bug.

## 6. Anti-patterns déjà rencontrés ici

- Couleur en dur dans un composant → invisible ou illisible en thème sombre.
- Widget ARIA maison là où `<details>`/`<button>` suffisait.
- État de chargement qui pose un `noindex` → désindexation d'une page valide par Googlebot.
- Bouton désactivé par binding réactif fragile → valider au clic à la place.
- Deux calculs parallèles du même chiffre sur une page → passer par `commune-contexte.ts`.
- Leaflet/DOM hors `afterNextRender` → casse le prerender.
