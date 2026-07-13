# PLAN SEO — plan-ma-ville (version consolidée, juillet 2026)

> Fusion du plan initial, de l'état réel du code et d'une recherche sourcée
> (deep-research) sur les pratiques 2025-2026. Sert de spec d'exécution aux
> sessions Claude Code. ✅ = affirmation contre-vérifiée (3 votes indépendants).

## Contexte 2026 — ce qui a changé (et change les priorités)

1. ✅ **AI Overviews : −58 % de clics en position 1** quand un AIO est présent
   (Ahrefs, déc. 2025 : CTR pos.1 7,3 % → 1,6 %). ~99 % des requêtes à AIO sont
   informationnelles — exactement nos requêtes (« ville X avis »). Parades :
   être la source **citée** (+35 % de clics quand cité — Seer), construire une
   **marque** cherchée directement, viser les requêtes d'action (déménagement,
   comparaison).
2. **FAQPage : rich results morts** (restreints août 2023, retirés ~2026).
   Ne pas implémenter. HowTo : idem.
3. ✅ **AggregateRating : jamais d'étoiles pour une commune** — la liste des
   types éligibles est fermée (pas Place/City) ; LocalBusiness self-serving
   bloqué depuis 2019. Ne pas maquiller les communes en LocalBusiness.
4. **Scaled content abuse** (Google mars 2024, juin/août 2025) : le volume est
   OK si chaque page apporte des **données originales** ; fatal = template où
   seul le nom change. Heuristique : ~60 %+ de contenu unique/page, données de
   3+ sources (nous : 5). Détection au niveau site → montée en charge
   progressive, surveiller « Explorée, actuellement non indexée » dans GSC.
5. **Domaine neuf** : indexation 2-6 semaines, rankings bridés ~3-6 mois
   (sandbox). GSC jour 1, sitemap immédiat, Request Indexing sur les pages clés.
6. **Trafic non organique** : NavBoost (leaks/DOJ) valorise les clics engagés
   (tranches par pays/langue) et **filtre/pénalise** les clics de mauvaise
   qualité. Promotion = communautés qualifiées, jamais de trafic acheté.
7. **llms.txt : aucune preuve d'effet** (Google ne le lit pas). Optionnel.
   Le **schema n'augmente pas causalement les citations IA** (test Ahrefs,
   1 885 pages). **INP/CWV : déjà OK** (~130 kB transférés).

## Déjà fait (ne pas refaire)

- Prerender SSG : ~2 500 communes (≥ 5 000 hab) + régions + départements +
  pages fixes, title/description/canonical/OG/Twitter uniques dans le HTML.
- Sitemap (lastmod ; `priority` ignoré par Google, inutile). Noindex github.io
  + interrupteur `SITE_INDEXABLE`. `environment.baseUrl` centralisé. PWA, perf.

## Phases restantes (ordre d'exécution)

### P1 — Contenu unique par commune ⚠️ LE cœur — ✅ FAIT (PR #24)
- [x] Paragraphe « réponse directe » 50-70 mots en HAUT de page (format cité
      par les AIO) : note, rang départemental, 2 points forts, prix m² DVF,
      population.
- [x] `commune-texte.ts` : fonctions PURES de génération (hash INSEE →
      variantes de tournures stables entre builds ; formulations
      conditionnelles par seuils ; comparaisons au département et à la strate).
- [x] Section « Vivre à {ville} » (3-4 paragraphes, h2 par thème) en bas de
      fiche : qualité de vie, sécurité (neutre, factuel), équipements &
      transports, immobilier & niveau de vie (DVF ; phrase honnête si absent).
- [x] Maillage : lien « Comparer {ville} » vers /comparer?villes={slug}.
- [x] Tests : déterminisme, variation inter-communes, seuils, absence de
      « undefined », branche sans DVF.
- Anti-scaled-content : seuil 5 000 hab au lancement ; élargir par paliers
  (2 000 puis 500) seulement si l'indexation GSC est saine.

### P2 — Meta finales (XS) — ✅ FAIT
- [x] `og:image` statique de marque 1200×630 (public/), `og:locale=fr_FR`,
      `twitter:card=summary_large_image`.

### P3 — JSON-LD ciblé (S) — ✅ FAIT
- [x] `JsonLdService` (script ld+json via DOCUMENT, nettoyé à la navigation).
- [x] `BreadcrumbList` (Accueil › Région › Département › Ville) — rich result
      encore actif. `Place` + geo sur les fiches. `ItemList` sur classements
      et hubs. `Dataset` sur la méthodologie.
- [x] ❌ Pas de FAQPage ni d'AggregateRating (cf. contexte 2-3). AggregateRating
      à reconsidérer si les avis Supabase décollent (note visible sur la page).

### P4 — Hubs longue traîne (M) — ✅ FAIT
- [x] Pages prerendues à intention : « Villes les plus sûres du {dép} »,
      « Où vivre autour de {grande ville} » (haversine existante), « Meilleurs
      prix m² du {département} » (DVF). ItemList + breadcrumb + intro factuelle,
      liens croisés (hub ↔ hub ↔ département ↔ communes), sitemap. Routes :
      /palmares/securite/:dep, /palmares/prix/:dep (101 chacun),
      /palmares/autour/:slug (villes ≥ hubAutourMinPopulation = 50 000, ~130).
- Ce sont aussi les contenus à promouvoir (P6).

### P5 — Jour J du domaine (S + manuel) — CODE ✅ FAIT (domaine : planmaville.fr)
- [x] Code : `CNAME` (planmaville.fr), baseHref `/`, `environment.baseUrl` +
  `siteBaseUrl` → https://planmaville.fr, `robots.txt` (Allow + Sitemap),
  clé + job IndexNow dans deploy.yml (gated `SITE_INDEXABLE`). La redirection
  github.io → domaine est gérée automatiquement par GitHub Pages.
- Manuel (propriétaire) : DNS (4 A + CNAME www), Enforce HTTPS, propriétés
  Google Search Console + Bing Webmaster le jour même, soumettre le sitemap,
  Request Indexing (home, hubs, top-50 villes). 2-6 semaines d'indexation puis
  3-6 mois bridés = normal.

### P6 — Promotion non organique qui SERT le SEO (continu, manuel)
- Participation utile dans les communautés FR (r/AskFrance, r/vosfinances,
  forums immo, groupes FB « s'installer à X ») ; publier des data-stories
  générées du pipeline (classements insolites) → liens, mentions Reddit
  (fortement affiché par Google), clics engagés, recherches de marque.
- ❌ Jamais : trafic acheté bas de gamme, échange de clics, self-promo brute
  (bad clicks NavBoost = contre-productif).

### P7 — Mesure
- GSC (couverture, requêtes), suivi « crawled not indexed », citations IA.
- CWV déjà OK ; `@defer` optionnel sur blocs sous la ligne de flottaison.

## Règles globales
- Respecter CLAUDE.md (signals, inject(), OnPush, DOCUMENT — jamais de
  `document` global : compatibilité prerender ; `data-url.ts` pour les URLs).
- Après chaque phase : `npm run build` + inspection de 2-3 HTML prérendus.
