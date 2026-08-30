# Architecture — features livrées (UI Angular)

Détail extrait de `CLAUDE.md` (chargé à la demande). À lire avant de modifier une
page existante ou d’en ajouter une.

## Features livrées

- **Home** : recherche (nom ou CP, dispatch), grille départements.
- **Commune `/ville/:slug`** : **dashboard** en grille à zones nommées
  (`grid-template-areas`) — notes par thématique D'ABORD (pleine largeur), puis
  carte OSM (iframe `afterNextRender`) adossée à la pile prix m² + historique
  (sparkline SVG, hauteurs équilibrées ; variante `dash--nomap` sans coordonnées),
  puis communes voisines (haversine) en grille de vignettes pleine largeur.
  **Prix m² = RÉEL (DVF)** : médiane + tendance 1 an (`dvfTrendPct`) + sparkline
  depuis `commune.prix.histo` ; sans donnée → message honnête, pas d'estimation.
  **Pas de trajectoire de note inventée** : la carte « Historique de la note »
  (fausse marche aléatoire seedée par code INSEE, ex-`noteHistory`) a été
  retirée avant le lancement public (site positionné comme factuel/rigoureux
  face à ville-idéale.fr — une trajectoire sans double millésime réel était
  attaquable) ; remplacée par un simple horodatage honnête « Fraîcheur des
  données » (`derniereMiseAJour`, dérivé du champ `gen` de
  `dep/{code}.json`, `fmtDateFr` dans `core/format.ts`). Si une vraie série
  temporelle (deux millésimes réels BPE/SSMSI/Filosofi) devient disponible un
  jour, documenter la méthode dans `/methodologie` avant de réafficher une
  évolution. **Texte éditorial SEO** (`commune-texte.ts`, pur, testé) :
  réponse directe ~60 mots sous l'en-tête + 4 sections h2 « Vivre à {ville} »
  (~250 mots), 100 % dérivés des données réelles (rang départemental, moyennes,
  DVF), variantes de tournures par hash INSEE (déterministe entre builds,
  anti scaled-content-abuse — cf. docs/SEO-PLAN.md). Comparaisons
  départementales (moyenne par critère, médiane DVF) calculées sur un groupe
  **EXTERNE** à la commune (`filtrerBassinVoisinage`, jamais elle-même ni sa
  famille mère/arrondissements) — sinon Paris/Lyon/Marseille, dont le
  département ne contient quasiment que la ville et ses propres
  arrondissements, se comparaient en grande partie à eux-mêmes (silencieux :
  la phrase disparaît si aucune commune externe n'a de données, plutôt que de
  comparer à une médiane fictive). Onglets « Données
  officielles » / « Avis habitants » (`?onglet=avis` pour survivre au retour
  OAuth). **Arrondissements (Paris/Lyon/Marseille)** : la fiche d'une commune
  mère affiche une section « Ses arrondissements » (notes + population,
  triés note ↓) ; la fiche d'un arrondissement affiche un lien « Ville » vers
  sa mère dans le méta-en-tête et dans le fil d'Ariane JSON-LD (Région >
  Département > Ville > Arrondissement). `commune-insights.ts`
  `filtrerBassinVoisinage` retire mère/enfants du bassin « Communes aux
  alentours » pour ne pas doublonner ces liens (pur, testé).
- **Régions `/regions`** : classement des régions (grille, note ↓), drill-down.
  **Région `/region/:code`** : ses départements classés note ↓ → lien commune.
  Chaîne région → département → ville. Lu depuis `regions.json` (départements
  imbriqués, pas de fichier par région : ~18 entrées). Service
  `SearchIndexService.getRegions()/regionSummary(code)`.
- **Département `/departement/:code`** : tableau triable/filtrable.
- **Classement `/classement`** : top/flop, filtre département.
- **Carte `/carte`** : Leaflet + markercluster (chargé en dynamique), filtre note.
- **Comparateur `/comparer`** : jusqu'à 3 villes, URL partageable `?villes=`.
- **Pondération par profil** (`core/ponderation.ts` pur + `PonderationService`) :
  presets Officiel/Famille/Jeune actif/Retraité + sliders Perso (poids ∈[0,2]),
  persistés localStorage `mvn-profil`/`mvn-poids`. Note « pour vous » =
  Σ(note×poids)/Σ(poids) recalculée **côté client** (les 8 critères sont dans
  les données). `POIDS_OFFICIELS` à garder alignés avec `scoring.config.json`.
  UI : `shared/profil-picker` branché sur commune, classement (colonne « Pour
  vous » + re-tri du top/flop officiel — `criteres` embarqués dans
  `classement.json`), comparateur (ligne dédiée), département (colonne triable
  `perso` via `filterAndSortCommunes(..., poids)`).
- **Classements multi-niveaux** (`score/classements.ts` pipeline, pur) : rangs
  national / départemental / **par strate de population**, calculés UNE fois et
  embarqués dans `dep/{code}.json` — l'app ne les recalcule pas (le bloc
  « Classements », la prose et la FAQ liraient sinon des rangs différents ;
  `commune-contexte.ts` lit le rang émis). **Strates = définition UNIQUE**
  (9 niveaux, seuils 500/2k/5k/10k/20k/50k/100k/200k) partagée avec le
  classement de la sécurité de `score/real.ts` : deux découpages se seraient
  contredits sur la même page. Percentile arrondi au PLANCHER (104ᵉ sur 34 920
  → « 99 % », jamais « 100 % » qui affirmerait qu'aucune commune ne fait mieux).
- **Prix DVF ventilés maison / appartement** : l'accumulateur suit 3 variantes
  (ensemble/maison/appartement) dans les deux formes de fichier (large et
  long). La dimension « origine » qui corrige l'agrégation des arrondissements
  reste SOUS la variante — sinon le bug d'écrasement se rejoue sur les
  nouveaux champs (testé). Colonnes classées par PRÉSENCE des deux mots
  (`med_prix_m2_appartement_maison` = combiné, pas « maison »).
- **Démographie INSEE** (`fetch/demographie.ts`) : pyramide 7 tranches, sexes,
  8 CSP. **Millésime détecté dans les en-têtes** (`P22_POP0014`) — figer le
  préfixe ferait tomber la source en silence au millésime suivant. PAS
  d'agrégation des arrondissements (l'INSEE publie déjà mère + arrondissements
  séparément). Effectifs stockés, parts calculées à l'affichage.
- **Fiche mairie** (`fetch/mairie.ts`) : annuaire DILA/service-public.fr, flux
  JSON imbriqué. **Parser TOLÉRANT** (reconnaissance par traits : code INSEE +
  marqueur de type « mairie », extraction par clés approchées) — la structure
  n'a pas pu être inspectée hors CI. Testé sur 3 formes plausibles. Le mot
  « mairie » n'est cherché que dans les clés de TYPAGE (sinon « rue de la
  Mairie » ferait passer une préfecture pour une mairie).
- **Chiffres de méthodologie** (`features/methodologie/methodologie-chiffres.ts`) :
  source UNIQUE des nombres affichés sur /methodologie et du rappel sur chaque
  fiche ; les totaux sont DÉRIVÉS de la liste des sources. **Positionnement
  assumé** : pas de course au nombre de critères face aux « 197 critères » du
  concurrent (perdu d'avance et invérifiable) — l'argument est la traçabilité
  (sources nommées + millésime, méthode reproductible, aucune estimation).
- **Méthodologie** : statique.
- **Palmarès (hubs SEO, docs/SEO-PLAN.md §P4)** : `/palmares/securite/:dep` et
  `/palmares/prix/:dep` (un composant, `type` via route data +
  withComponentInputBinding), `/palmares/autour/:slug` (grandes villes
  ≥ `hubAutourMinPopulation` = 50k, rayon 20 km via geo-light.json). Logique
  pure `palmares-logic.ts` (tops, intros factuelles). Prerendus + sitemap +
  JSON-LD (Breadcrumb+ItemList) + maillage (département ↔ hubs ↔ communes,
  lien depuis les fiches des grandes villes).
- **FAQ générée sur les fiches communes** (`commune-faq.ts`, pur, testé) :
  3-4 paires Q/R dérivées des données déjà calculées, en accordéon
  `<details>` natif + JSON-LD `FAQPage` alimenté par la MÊME source (du
  balisage FAQ sans contenu visible correspondant est du spam structuré).
  **Google n'affiche plus de rich result FAQ depuis 2023** — le balisage vise
  les moteurs de réponse, aucun gain de SERP à en attendre.
  `commune-contexte.ts` est le socle PARTAGÉ avec la prose (`commune-texte.ts`)
  : rang, moyennes départementales externes, points forts/faibles, variantes
  déterministes. **Toute nouvelle dérivation chiffrée passe par lui** — deux
  calculs parallèles finiraient par se contredire sur la même page.
  Règle de rédaction : chaque phrase commence par un SUJET EXPLICITE, jamais
  par un pronom (une réponse extraite est lue isolément ; un test le vérifie).
- **Maillage interne des fiches** (~18 liens contextuels sortants) :
  « Aux alentours » (géographique, haversine) + « Villes au profil similaire »
  (distance euclidienne sur les 8 critères, `communesSimilaires`) dont les
  voisines déjà affichées sont EXCLUES — sinon la section n'ajoute aucun
  chemin de crawl — + bloc « Explorer le {département} » (palmarès sécurité/
  prix, hub « autour de », page département) présent sur CHAQUE fiche.
- **Sitemap segmenté** : `sitemap.xml` est un **index** (URL déjà dans
  robots.txt et soumise en GSC) → `sitemap-pages` / `-grandes-villes` /
  `-villes-moyennes` / `-communes` / `-hubs`, `priority`/`changefreq`
  différenciés (Google les ignore ; le bénéfice est le suivi du taux
  d'indexation PAR SEGMENT en Search Console). Scission auto > 45 000 URLs.
  **Tout consommateur du sitemap doit dérouler l'index** — `indexnow.mjs` et
  `audit-urls.mjs` le font ; l'IndexNow découpe aussi en lots de 10 000
  (plafond de l'API). Le cache CI doit inclure `public/sitemap-*.xml`.
- **Monitoring SEO** (`tools/seo-monitor/`, workspace npm, `docs/SEO-MONITORING.md`) :
  mesure hebdo Search Console → table Supabase `seo_metrics`, alerte si les
  pages indexées reculent > 5 %. **Le rapport « Pages » de la GSC n'a pas
  d'API** : le nombre de pages indexées est ESTIMÉ par échantillonnage via
  l'URL Inspection API (quota 2 000/jour), 40 URLs par segment de sitemap,
  extrapolé par taille de segment. Une inspection en échec est exclue du
  dénominateur (sinon fausse alerte). JWT du compte de service signé avec
  node:crypto — pas de dépendance `googleapis`.
  `ai-citation.mjs` : baseline de citation par les moteurs de réponse
  (Claude + recherche web, Perplexity en option), **coûteux → mensuel, pas de
  workflow planifié**.
- **Thème clair/sombre/système** : `ThemeService` (signal `preference` persisté
  localStorage `mvn-theme`, `resolved` computed suivant `prefers-color-scheme`
  en direct) → `data-theme` sur `<html>` via `effect`. Tokens sombres dans
  `styles.scss` (`:root[data-theme='dark']` + `color-scheme`). **Script inline
  anti-flash dans `index.html`** (à garder aligné avec le service). Sélecteur
  ☀️/🌙/💻 dans le header. Toute couleur nouvelle DOIT passer par les tokens
  (jamais de hex en dur dans les composants).
- **Accent au choix de l'utilisateur** : orange (défaut), jaune, vert, bleu.
  `AccentService` (signal persisté localStorage `mvn-accent`) → `data-accent`
  sur `<html>` ; tokens par accent (`--accent/-soft/-text/--on-accent`) dans
  `styles.scss`, thèmes clair ET sombre, contrastes vérifiés (ratios en
  commentaire). Pastilles dans le menu thème (`--swatch-*`). Le script
  anti-flash d'index.html pose aussi `data-accent`. Les assets statiques
  (favicon, icônes PWA, og-image) suivent l'accent PAR DÉFAUT (orange).
- **Nav mobile** (≤920px) : burger → panneau déroulant sous la topbar
  (backdrop, fermeture au clic sur un lien), pseudo compte masqué, marque
  réduite au badge <380px.

- **PWA installable** : `@angular/service-worker` (version EXACTE du core,
  22.0.1), activé en **prod uniquement** (`serviceWorker` dans la config
  production d'angular.json + `provideServiceWorker` gardé par `isDevMode`).
  `ngsw-config.json` : app shell prefetch, `data/**` en **freshness** (réseau
  d'abord, cache en secours → hors-ligne OK), Google Fonts en performance.
  `public/manifest.webmanifest` + icônes `public/icons/` (générées, any +
  maskable). `UpdateService` (toSignal sur `SwUpdate.versionUpdates`) →
  bannière « Recharger » dans le shell. Les specs TestBed qui montent `App`
  doivent fournir `provideServiceWorker('ngsw-worker.js', {enabled:false})`.
  Vérifié headless : SW contrôlant + navigation et données HORS-LIGNE.
- **Analytics (Umami, cookieless — pas de bannière CNIL)** : script déjà posé
  dans `index.html` (`data-website-id`, survit au prerender car statique,
  jamais strippé par le build). `AnalyticsService` (`core/services/
  analytics.service.ts`) : `track(eventName, data?)` avec garde
  `typeof window !== 'undefined' && 'umami' in window` (dégradation
  silencieuse en SSR/prerender/avant chargement du script, jamais d'erreur).
  Events instrumentés : `avis_start` (ouverture de l'onglet « Avis
  habitants », `commune.ts` `openOnglet`), `avis_submit` (soumission
  réussie), `comparateur_add` (ajout d'une ville au comparateur),
  `recherche_query` (sélection d'un résultat de recherche sur la home —
  Entrée ou clic, pas à chaque frappe). UTM (`utm_source` etc.) : aucune
  route ne les strip (pas de `redirectTo`/`queryParamsHandling` qui les
  effacerait) — capturés par le tracking auto de pageview d'Umami au premier
  chargement.

