# Playbook Accessibilité RGAA 4.1.2 — plan-ma-ville

> **Fichier destiné à Claude Code.** À déposer à la racine du repo et à référencer
> depuis `CLAUDE.md` (`Voir ACCESSIBILITE-RGAA.md pour toute création/modif d'UI`).
> Objectif : viser la **conformité totale RGAA** (100 % des critères applicables validés).

---

## 0. Contexte, périmètre et honnêteté légale

- **RGAA 4.1.2** = déclinaison française de **WCAG 2.1 niveaux A + AA** (+ norme EN 301 549).
  13 thématiques, **106 critères**, ~257 tests. La conformité se mesure ainsi :
  `taux = critères validés / critères applicables`.
  - **Conformité totale** = 100 % · **partielle** ≥ 50 % · **non-conforme** < 50 %.
- **Statut légal de plan-ma-ville** : l'obligation RGAA vise les personnes morales de
  droit public, délégataires de service public, et entreprises > 250 M€ de CA. Un projet
  perso **n'y est donc pas légalement soumis**. La *déclaration d'accessibilité* et le
  *schéma pluriannuel* (§10) sont **facultatifs** pour toi. On vise la conformité comme
  objectif **qualité + SEO + UX**, pas comme obligation. Les critères techniques ci-dessous
  restent 100 % pertinents.
- ⚠️ **Ce qu'aucun outil auto ne te dira** : les tests automatiques ne couvrent que
  **~30-40 % des critères RGAA**. Le reste (pertinence des alternatives, ordre de lecture,
  cohérence lecteur d'écran, focus…) exige une passe **manuelle**. « CI verte » ≠ « 100 % RGAA ».

---

## 1. Definition of Done accessibilité (à appliquer à CHAQUE PR touchant l'UI)

Avant de considérer une tâche UI comme terminée, Claude Code doit vérifier :

1. **Lint a11y vert** : `@angular-eslint` règles a11y activées, 0 erreur (§2).
2. **axe = 0 violation** sur le composant/la page modifiée (§2).
3. **Navigation clavier seule** : tout est atteignable/activable, focus visible, pas de piège.
4. **Focus géré au changement de route** (SPA zoneless — voir §11).
5. **Contraste ≥ 4.5:1** (texte) / **3:1** (UI + texte large) — **dans les deux thèmes** (clair/sombre).
6. **Chaque `<img>`/icône/SVG** a une alternative pertinente OU est neutralisée (§4.1).
7. **Chaque champ de formulaire** a un label associé programmatiquement (§4.11).
8. **Titre de page unique et pertinent** + `<html lang="fr">` (§4.8).
9. Si carte/data ajoutée : **alternative HTML accessible** aux données de la carte (§9).

---

## 2. Outillage — mettre l'automatisable sous CI d'abord

### 2.1 ESLint templates Angular (statique, gratuit, gros ROI)

`eslint.config.js` (flat config) — active les règles a11y de `@angular-eslint/template` :

```js
// dans le bloc templates (*.html)
rules: {
  "@angular-eslint/template/alt-text": "error",
  "@angular-eslint/template/elements-content": "error",
  "@angular-eslint/template/label-has-associated-control": "error",
  "@angular-eslint/template/table-scope": "error",
  "@angular-eslint/template/valid-aria": "error",
  "@angular-eslint/template/click-events-have-key-events": "error",
  "@angular-eslint/template/mouse-events-have-key-events": "error",
  "@angular-eslint/template/interactive-supports-focus": "error",
  "@angular-eslint/template/role-has-required-aria": "error",
  "@angular-eslint/template/no-autofocus": "error",
  "@angular-eslint/template/no-positive-tabindex": "error"
}
```

### 2.2 axe-core (dynamique) — composants + e2e

- **Unitaire (Jest)** : `jest-axe` → assert `toHaveNoViolations()` sur le DOM rendu du composant.
- **E2E (Playwright)** : `@axe-core/playwright` → `new AxeBuilder({ page }).analyze()` sur chaque route clé, échec CI si violations. Injecter les deux thèmes (clair/sombre).

```ts
// exemple Playwright, à répéter par route + par thème
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze();
expect(results.violations).toEqual([]);
```

### 2.3 Lighthouse CI / pa11y-ci sur les pages prerendues (SSG)

Comme plan-ma-ville passe en SSG (`outputMode: 'static'`), pointe **pa11y-ci** ou
**Lighthouse CI** sur le HTML statique généré → audit page réelle indexable.

### 2.4 Passe MANUELLE (obligatoire, non automatisable)

- **Clavier seul** (Tab / Maj+Tab / Entrée / Espace / flèches / Échap) sur chaque parcours.
- **Lecteur d'écran** : NVDA + Firefox (Windows) *et* VoiceOver + Safari (macOS/iOS).
- **Zoom navigateur 200 %** + **reflow 320 px** (mobile) sans perte d'info ni scroll horizontal.
- **Espacement du texte** forcé (bookmarklet) sans casse de contenu.
- **Sans CSS** : l'ordre de lecture reste logique.

---

## 3. Comment Claude Code doit utiliser les §4→§9

Chaque bloc = **une thématique RGAA**. Format : `Règle → Faire → Ne pas faire → Vérifier`.
Applique la règle qui correspond à ce que tu es en train de coder. En cas de doute,
la question RGAA de référence est citée entre parenthèses (`crit. X.Y`).

---

## 4. Règles par thématique RGAA → patterns Angular/PrimeNG

### 4.1 Images (thématique 1 — crit. 1.1 à 1.9)

**Règle** : toute image porteuse d'info a une alternative textuelle pertinente ; toute image
décorative est ignorée par les technologies d'assistance.

**Faire**
```html
<!-- Informative -->
<img [src]="commune.blason" [alt]="'Blason de ' + commune.nom" />

<!-- Décorative → alt vide -->
<img src="separateur.svg" alt="" />

<!-- Icône SVG décorative (cas PrimeNG le + fréquent) -->
<i class="pi pi-search" aria-hidden="true"></i>

<!-- Icône SVG porteuse de sens (ex : bouton icône seule) -->
<button type="button" [attr.aria-label]="'Trier par note'">
  <i class="pi pi-sort" aria-hidden="true"></i>
</button>

<!-- SVG inline informatif -->
<svg role="img" aria-label="Évolution du score sur 5 ans"> … </svg>
```
**Ne pas faire** : `alt="image"`, `alt="logo"` non pertinent ; icône seule cliquable sans `aria-label` ; SVG informatif sans `role="img"`.

**Vérifier** : ESLint `alt-text` ; axe `image-alt` ; passe lecteur d'écran (l'alternative est-elle *pertinente*, pas juste présente — crit. 1.3, non automatisable).

---

### 4.2 Cadres (thématique 2 — crit. 2.1, 2.2)

**Règle** : chaque `<iframe>` a un `title` pertinent.
```html
<iframe [title]="'Carte OpenStreetMap de ' + commune.nom" src="…"></iframe>
```
**Vérifier** : ESLint/axe `frame-title`. Si tu intègres une carte via iframe tierce → title obligatoire.

---

### 4.3 Couleurs (thématique 3 — crit. 3.1 à 3.3)

**Règle**
- L'info **ne passe jamais uniquement par la couleur** (crit. 3.1) → double avec texte/icône/motif.
- Contraste texte/fond **≥ 4.5:1** (≥ 3:1 si texte ≥ 24px ou ≥ 18.66px gras) — crit. 3.2.
- Contraste des **composants d'interface** et éléments graphiques porteurs d'info **≥ 3:1** — crit. 3.3.

**Faire** : sur une carte de score « rouge/vert », ajoute un libellé (« Faible »/« Élevé ») ou une icône. Vérifie **les deux thèmes** (clair + sombre) — le mode sombre casse souvent les 3:1 sur bordures/placeholders.

**Ne pas faire** : « les communes en rouge sont à éviter » sans indication non colorée ; placeholder gris clair < 4.5:1 utilisé comme label.

**Vérifier** : axe `color-contrast` (les deux thèmes) ; crit. 3.1 → manuel.

---

### 4.4 Multimédia (thématique 4 — crit. 4.1 à 4.13)

**Règle** : si tu ajoutes audio/vidéo → transcription, sous-titres synchronisés, audiodescription si nécessaire ; lecteur contrôlable au clavier ; pas de son auto > 3 s sans contrôle.
> plan-ma-ville n'a probablement pas de média temporel → thématique **non applicable** (à documenter comme telle). Ne pas introduire de vidéo auto-play.

---

### 4.5 Tableaux (thématique 5 — crit. 5.1 à 5.8)

**Règle** : tableau de données = `<caption>`, en-têtes `<th scope="col|row">`, association cellule/en-tête correcte ; pas de tableau de mise en forme.

**PrimeNG `p-table` / classement communes**
```html
<p-table [value]="communes()">
  <ng-template pTemplate="caption">Classement des communes par qualité de vie</ng-template>
  <ng-template pTemplate="header">
    <tr>
      <th scope="col">Commune</th>
      <th scope="col">Score global</th>
    </tr>
  </ng-template>
  <ng-template pTemplate="body" let-c>
    <tr>
      <th scope="row">{{ c.nom }}</th>
      <td>{{ c.score }}</td>
    </tr>
  </ng-template>
</p-table>
```
**AG Grid SSRM** : passe `ariaLabel` sur la grille, garde `ensureDomOrder: true`, teste la navigation clavier (les grilles complexes sont le point noir a11y — prévois une passe lecteur d'écran dédiée).

**Vérifier** : ESLint `table-scope` ; axe `table-*` ; crit. 5.3 (linéarisation compréhensible) → manuel.

---

### 4.6 Liens (thématique 6 — crit. 6.1, 6.2)

**Règle** : intitulé de lien **explicite** hors contexte ; tout lien a un intitulé.
```html
<!-- Mauvais --><a [routerLink]="…">En savoir plus</a>
<!-- Bon -->
<a [routerLink]="['/commune', c.slug]"
   [attr.aria-label]="'Voir la fiche détaillée de ' + c.nom">
  En savoir plus
</a>
```
**Vérifier** : axe `link-name` ; pertinence hors contexte (crit. 6.1) → manuel.

---

### 4.7 Scripts (thématique 7 — crit. 7.1 à 7.5)

**Règle** : composants JS compatibles technologies d'assistance (rôles/états ARIA corrects) ;
tout au **clavier** (crit. 7.3) ; **messages de statut** annoncés (crit. 7.5).

**Messages de statut (zoneless) — CDK LiveAnnouncer**
```ts
import { LiveAnnouncer } from '@angular/cdk/a11y';

private readonly announcer = inject(LiveAnnouncer);
// après un filtre/chargement de données :
this.announcer.announce(`${count} communes trouvées`, 'polite');
```
Ou région live déclarative pour compteurs/erreurs :
```html
<p role="status" aria-live="polite">{{ resultCount() }} résultats</p>
```
**Composant custom interactif** = handlers clavier + rôle :
```html
<div role="button" tabindex="0"
     (click)="toggle()" (keydown.enter)="toggle()" (keydown.space)="toggle()"
     [attr.aria-pressed]="open()">…</div>
```
> Préfère un vrai `<button>` quand c'est possible — 90 % de l'ARIA en moins.

**Vérifier** : ESLint `click-events-have-key-events`, `interactive-supports-focus`, `valid-aria`, `role-has-required-aria` ; le reste manuel (lecteur d'écran).

---

### 4.8 Éléments obligatoires (thématique 8 — crit. 8.1 à 8.10)

**Règle** : doctype présent, code valide, `lang` renseigné, **titre de page unique & pertinent**, changements de langue signalés.

- `index.html` : `<!doctype html><html lang="fr">`.
- **Titre par route** (crit. 8.5/8.6) — via `Title` service, idéalement piloté par les
  données de route pour que le **SSG prerende un `<title>` unique par page** (bonus SEO direct) :

```ts
import { Title } from '@angular/platform-browser';

private readonly title = inject(Title);
private readonly router = inject(Router);

constructor() {
  this.router.events
    .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
    .subscribe(() => {
      const t = deepestRouteData(this.router)['title'] ?? 'plan-ma-ville';
      this.title.setTitle(`${t} — plan-ma-ville`);
    });
}
```
- Changement de langue inline (crit. 8.7) : `<span lang="en">community</span>`.

**Vérifier** : axe `document-title`, `html-has-lang`, `valid-lang` ; unicité/pertinence → manuel.

---

### 4.9 Structuration de l'information (thématique 9 — crit. 9.1 à 9.4)

**Règle** : hiérarchie de titres cohérente (**un seul `<h1>`/page, pas de saut de niveau**),
listes réelles (`<ul>/<ol>`), citations balisées.

**Faire** : `<h1>` = titre principal de la page (ex. nom de la commune), sous-sections en
`<h2>`/`<h3>` séquentiels. Utilise des landmarks (`<header> <nav> <main> <footer>`), avec
`aria-label` si plusieurs `<nav>` (crit. 12.6).

**Ne pas faire** : `<h1>` puis `<h3>` en sautant `<h2>` ; « faux titres » en `<div class="title">`.

**Vérifier** : axe `heading-order`, `landmark-*` ; cohérence sémantique → manuel.

---

### 4.10 Présentation de l'information (thématique 10 — crit. 10.1 à 10.14)

**Règle**
- Mise en forme via **CSS**, pas de balises de présentation (crit. 10.1).
- Info conservée CSS désactivé + couleurs désactivées (10.2/10.3).
- **Texte zoomable à 200 %** sans perte (10.4) → utilise `rem`, pas de tailles fixes en `px` bloquantes.
- **Focus visible** sur tout élément focusable (10.7) → ne jamais faire `outline: none` sans remplacement net (≥ 3:1).
- **Reflow 320 px** sans scroll horizontal (10.11).
- **Espacement du texte** redéfinissable (10.12) → n'impose pas `line-height`/`letter-spacing` en dur qui coupent le contenu.
- Contenus au survol/focus (tooltips) contrôlables et persistants (10.13/10.14).

```css
:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 2px; }
```
**Vérifier** : zoom 200 % + reflow 320 px + focus visible → **manuel** (peu automatisable).

---

### 4.11 Formulaires (thématique 11 — crit. 11.1 à 11.13)

**Règle** : **chaque champ a un label associé programmatiquement**, groupes de champs
regroupés (`<fieldset>/<legend>`), erreurs identifiées et reliées, `autocomplete` renseigné (11.13).

**Faire**
```html
<label for="rech-commune">Rechercher une commune</label>
<input pInputText id="rech-commune" name="commune"
       autocomplete="off"
       [attr.aria-invalid]="hasError()"
       [attr.aria-describedby]="hasError() ? 'rech-err' : null" />
<p id="rech-err" role="alert" *ngIf="hasError()">Saisissez au moins 2 caractères.</p>
```
- **PrimeNG p-select / p-dropdown / p-calendar** : pas toujours de `<label>` implicite →
  fournis `inputId` + `<label [for]="inputId">` OU `ariaLabel`. Vérifie la version PrimeNG 19,
  les attributs ARIA diffèrent d'une version à l'autre.
- Regroupe boutons radio/cases liées dans `<fieldset><legend>…</legend>`.

**Ne pas faire** : label uniquement en `placeholder` ; erreur signalée seulement par une bordure rouge (viole aussi 3.1).

**Vérifier** : ESLint `label-has-associated-control` ; axe `label`, `aria-*` ; pertinence des intitulés/erreurs → manuel.

---

### 4.12 Navigation (thématique 12 — crit. 12.1 à 12.11)

**Règle** : ≥ 2 systèmes de navigation (menu + moteur de recherche ou plan) ; **lien
d'évitement** vers le contenu (crit. 12.7) ; ordre de tabulation cohérent (12.8) ;
**pas de piège clavier** (12.9) ; zones regroupées atteignables/évitables (landmarks, 12.6).

**Lien d'évitement**
```html
<a class="skip-link" href="#contenu-principal">Aller au contenu principal</a>
…
<main id="contenu-principal" tabindex="-1"> … </main>
```
```css
.skip-link { position: absolute; left: -9999px; }
.skip-link:focus { left: 8px; top: 8px; /* visible au focus */ }
```
**Ne jamais** utiliser de `tabindex` positif (casse l'ordre). Modales/menus : `Échap` ferme, focus piégé *dans* la modale mais libérable.

**Vérifier** : présence du skip link, tab order, absence de piège → **manuel clavier**.

---

### 4.13 Consultation (thématique 13 — crit. 13.1 à 13.12)

**Règle** : contrôle des limites de temps (13.1) ; **pas d'ouverture de fenêtre/onglet sans
action utilisateur** (13.2) ; documents en téléchargement avec alternative accessible si besoin
(13.3/13.4) ; **contenu clignotant/en mouvement contrôlable** et pas > 3 flashs/s (13.8) ;
utilisable **portrait ET paysage** (13.9) ; gestes complexes ayant une **alternative simple**
(13.10) ; actions au pointeur **annulables** (13.11) ; alternative aux mouvements d'appareil (13.12).

**Pour plan-ma-ville** : `target="_blank"` uniquement sur action explicite et signalé
(« nouvelle fenêtre ») ; pas d'animation de carte non stoppable ; interactions carte tactiles
(pinch-zoom) doublées de boutons +/-.

---

## 5. Patterns spécifiques plan-ma-ville

### 5.1 Carte Leaflet — le point critique (et une opportunité SEO)

**Fait RGAA clé** : les **cartes en ligne sont exemptées** de l'obligation *pour la fonction
de localisation visuelle*, **à condition que les informations essentielles soient fournies
sous une forme numérique accessible**. Traduction concrète :

- La carte Leaflet (tuiles + markers) **n'a pas** à être parfaitement restituée au lecteur d'écran…
- …**MAIS** les données qu'elle porte (scores, classement, communes) **doivent** exister en
  **HTML accessible** à côté ou à la place : un `<table>`/liste des communes, filtrable,
  navigable au clavier. **C'est exactement le contenu que le SSG doit prerender** → tu couvres
  l'accessibilité *et* l'indexation Google d'un seul geste.

**Mise en œuvre (zoneless)**
```ts
// Leaflet chargé hors zone, après rendu — cohérent avec ta convention
afterNextRender(() => {
  const L = await import('leaflet');
  const map = L.map(this.mapEl.nativeElement, { keyboard: true }); // clavier activé
  this.mapEl.nativeElement.setAttribute('role', 'region');
  this.mapEl.nativeElement.setAttribute('aria-label',
    'Carte des communes. Les données sont aussi disponibles dans le tableau ci-dessous.');
  // markers : garder keyboard:true (défaut L.Marker) + title/alt pertinent
});
```
```html
<!-- la carte -->
<div #map class="carte"></div>

<!-- l'alternative accessible = la vraie source de vérité data + SEO -->
<section aria-label="Liste des communes (alternative à la carte)">
  <p-table [value]="communes()"> … (voir §4.5) … </p-table>
</section>
```
- Si la carte est **purement décorative** parce que toute la donnée est dans le tableau →
  `aria-hidden="true"` sur le conteneur carte est acceptable.
- **Contrôles +/- Leaflet** : vérifie qu'ils ont un `aria-label` (« Zoom avant »/« Zoom arrière ») ; les défauts Leaflet posent `title` seulement — ajoute `aria-label` si besoin.

### 5.2 SPA zoneless — gestion du focus au changement de route (indispensable)

En SPA (même hydratée depuis le SSG), changer de route **ne déplace pas le focus** et
**n'annonce rien** au lecteur d'écran → critères 8.5/8.6 + 12.x en pratique. Pattern :

```ts
import { LiveAnnouncer } from '@angular/cdk/a11y';

private readonly router = inject(Router);
private readonly title = inject(Title);
private readonly announcer = inject(LiveAnnouncer);

constructor() {
  this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    takeUntilDestroyed()
  ).subscribe(() => {
    const pageTitle = this.title.getTitle();
    this.announcer.announce(pageTitle, 'assertive');        // annonce la nouvelle page
    // déplace le focus sur le <main tabindex="-1"> ou le <h1 tabindex="-1">
    queueMicrotask(() => document.getElementById('contenu-principal')?.focus());
  });
}
```
> Le `focus()` hors zone est sans risque en zoneless (pas de dépendance à Zone.js).

### 5.3 PrimeNG 19 — checklist par composant

- `p-dialog` : vérifie `aria-modal`, focus trap actif, **retour du focus au déclencheur** à la fermeture, `Échap` ferme.
- `p-toast` / notifications : région `aria-live` présente (sinon double avec `LiveAnnouncer`).
- `p-dropdown`/`p-select`, `p-multiselect`, `p-calendar`/`p-datepicker` : `inputId` + `<label>` ou `ariaLabel` ; navigation flèches + `Échap`.
- `p-paginator` : `aria-label` sur les boutons page (souvent défaut ok, à re-tester en 19).
- `p-tabView`/`@defer` : rôle `tablist/tab/tabpanel`, focus géré à l'activation.
- **Icônes PrimeNG** décoratives → `aria-hidden="true"` systématique.
> Ne jamais présumer qu'un composant PrimeNG est accessible « par défaut » : **re-tester à ta version 19** (l'ARIA a bougé entre versions).

### 5.4 Thème sombre

Rejoue **tout l'audit contraste dans les deux thèmes**. Le mode sombre casse typiquement :
bordures d'inputs, placeholders, états désactivés, focus ring, textes secondaires. Fais deux
passes axe `color-contrast` (clair + sombre) en CI.

---

## 6. Checklist de conformité (cochable, par thématique)

> Marque chaque critère : ✅ validé · ⬜ à faire · ➖ non applicable (à justifier).

```
Thématique 1  Images         [1.1..1.9]    ⬜  (alt pertinents, décoratives neutralisées)
Thématique 2  Cadres         [2.1..2.2]    ➖ ? (iframe carte tierce → sinon N/A)
Thématique 3  Couleurs       [3.1..3.3]    ⬜  (contraste 2 thèmes + info non-couleur)
Thématique 4  Multimédia     [4.1..4.13]   ➖  (pas de média temporel prévu)
Thématique 5  Tableaux       [5.1..5.8]    ⬜  (caption + th scope, AG Grid clavier)
Thématique 6  Liens          [6.1..6.2]    ⬜  (intitulés explicites hors contexte)
Thématique 7  Scripts        [7.1..7.5]    ⬜  (clavier + messages de statut live)
Thématique 8  Élts oblig.    [8.1..8.10]   ⬜  (lang, title unique/route, doctype)
Thématique 9  Structuration  [9.1..9.4]    ⬜  (un h1, hiérarchie, landmarks)
Thématique 10 Présentation   [10.1..10.14] ⬜  (zoom 200%, reflow 320, focus visible)
Thématique 11 Formulaires    [11.1..11.13] ⬜  (labels, erreurs reliées, autocomplete)
Thématique 12 Navigation     [12.1..12.11] ⬜  (skip link, 2 systèmes nav, pas de piège)
Thématique 13 Consultation   [13.1..13.12] ⬜  (pas de popup auto, orientation, gestes)
```

**Règle de calcul** : un critère n'est *validé* que s'il l'est sur **toutes** les pages de
l'échantillon testé ; il est *applicable* dès qu'il l'est sur **une seule** page.

---

## 7. Échantillon de pages à auditer (plan-ma-ville)

Choisis un échantillon représentatif (l'audit RGAA se fait par pages) :
- Accueil / carte
- Page « fiche commune » (données + carte)
- Page de résultats / classement filtrable
- Formulaire (recherche avancée, avis communautaire Supabase)
- Page de connexion / callback auth
- Page mentions / contact
- Une page d'erreur (404)

---

## 8. Ordre d'attaque recommandé (du plus rentable au plus fin)

1. **Socle global** (impacte toutes les pages) : `lang`, doctype, skip link, landmarks,
   focus au changement de route, focus-visible, contrastes des tokens de thème.
2. **Titres de page par route** (a11y + SEO, synergique avec le SSG).
3. **Formulaires** (labels, erreurs, autocomplete).
4. **Tableaux / classement** (caption, scope, clavier).
5. **Carte Leaflet + alternative HTML** (donnée accessible = donnée indexable).
6. **Composants PrimeNG** un par un (§5.3).
7. **Passe manuelle** clavier + lecteur d'écran + zoom sur l'échantillon (§7).

---

## 9. Déclaration d'accessibilité (facultative pour ce projet, template prêt)

Non obligatoire légalement pour plan-ma-ville (§0), mais recommandée comme page « /accessibilite »
si tu veux afficher la démarche. Format officiel imposé, à remplir :

```
DÉCLARATION D'ACCESSIBILITÉ
plan-ma-ville s'engage à rendre son site accessible.
Cette déclaration s'applique à : plan-ma-ville (zikaoinfo.github.io/plan-ma-ville).

ÉTAT DE CONFORMITÉ
plan-ma-ville est en conformité [totale | partielle | non conforme] avec le RGAA 4.1.2.

RÉSULTATS DES TESTS
L'audit réalisé en interne révèle que [X] % des critères RGAA sont respectés.

CONTENUS NON ACCESSIBLES
- Non-conformités : [lister]
- Contenus non soumis : cartographie Leaflet (données fournies via le tableau accessible).

ÉTABLISSEMENT
Déclaration établie le [JJ mois AAAA], mise à jour le [JJ mois AAAA].
Technologies : HTML, CSS, JavaScript, Angular 22, PrimeNG 19, Leaflet.
Outils de vérification : axe, Lighthouse, NVDA+Firefox, VoiceOver+Safari.
Pages testées : [échantillon §7].

RETOUR D'INFORMATION ET CONTACT
[email ou formulaire de signalement].
```
> Les voies de recours (Défenseur des droits) ne concernent que les organismes soumis à l'obligation — inutiles ici.

---

## 10. Rappels de format pour Claude Code

- **Composants standalone, signals, `inject()`, `OnPush`/zoneless** — pas de NgModules, pas de `effect()` pour dériver de l'état.
- Préfère un **élément HTML natif** (`<button>`, `<a>`, `<label>`, `<table>`) à une reconstruction ARIA : c'est la solution la plus accessible et la plus courte.
- **Chaque PR UI** repasse la *Definition of Done* (§1). N'annonce jamais « accessible » sur la seule foi d'axe : cite ce que tu as vérifié manuellement.
- Documente les critères **non applicables** (thématique 4 notamment) plutôt que de les ignorer — ça compte dans le taux.
```

---

## 11. État d'implémentation (socle global — PR accessibilité)

**Fait (automatisable + socle, impacte toutes les pages) :**
- Lint a11y sous CI : `angular-eslint` `templateAccessibility` actif (couvre
  alt-text, label-has-associated-control, valid-aria, click-events-have-key-events,
  interactive-supports-focus, role-has-required-aria, no-positive-tabindex…), 0 violation.
- **Lien d'évitement** « Aller au contenu principal » (crit. 12.7) + `<main
  id="contenu-principal" tabindex="-1">`.
- **Focus + annonce au changement de route** (SPA zoneless, §5.2) : `App` déplace
  le focus sur `<main>` et annonce le titre via une région `aria-live` (impératif
  DOM, gardé navigateur pour le prerender).
- **`:focus-visible`** global (crit. 10.7), `.sr-only`, `.skip-link`,
  `prefers-reduced-motion` (styles.scss).
- **`<caption>` sr-only** sur toutes les tables de données (crit. 5.5) ; en-têtes
  `<th scope="col">` déjà présents, `<th scope="row">` sur le comparateur.
- **Carte Leaflet** (crit. §5.1) : `role="region"` + `aria-label`, et **alternative
  HTML accessible** (lien vers le classement/regions tabulaires) sous la carte.
- `<html lang="fr">`, doctype, titres uniques par route (MetaService) : déjà en place.

**Reste (NON automatisable — passe manuelle requise, cf. §2.4) :**
- Test **clavier seul** complet sur l'échantillon §7 (pièges, ordre de tabulation).
- Test **lecteur d'écran** (NVDA/VoiceOver) : pertinence des alternatives, ordre de
  lecture, annonces.
- **Contraste** dans les deux thèmes sur l'échantillon (axe `color-contrast` clair+sombre).
- **Zoom 200 % / reflow 320 px** sans perte.
- Déclaration d'accessibilité (§9) : facultative pour ce projet.
