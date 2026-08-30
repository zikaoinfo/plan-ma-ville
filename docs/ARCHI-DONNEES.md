# Architecture — données (pipeline `tsx`)

Détail extrait de `CLAUDE.md` (chargé à la demande). À lire avant toute modif de
`tools/data-pipeline/` ou de `scoring.config.json`.

## Données (pipeline `tsx`)

- Sources (toutes URLs dans `sources.config.json`) :
  - `geo.api.gouv.fr` — périmètre communes, population, `centre` (lat/lng).
    **Piège** : filtre par défaut `type=commune-actuelle` si le paramètre
    `type` est omis de l'URL → les arrondissements de Paris/Lyon/Marseille ne
    sont JAMAIS renvoyés sans `type=commune-actuelle,arrondissement-municipal`
    explicite dans `geoCommunes` (`sources.config.json`) ; oubli détecté par
    l'invariant 5 (0 arrondissement rattaché) lors de la 1re validation CI de
    la note par arrondissement.
  - **BPE** (INSEE) — équipements → santé, commerces, enseignement, sports,
    culture, transports. `fetch/bpe.ts`, domaine = 1re lettre TYPEQU (F1/F2 sports,
    F3 culture).
  - **SSMSI** (data.gouv) — délinquance → sécurité (note inversée). `fetch/securite.ts`.
  - **Filosofi** (INSEE) — revenu médian → niveau de vie. `fetch/filosofi.ts`.
  - **Statistiques DVF** (DGFiP/data.gouv) — agrégats PRÊTS À L'EMPLOI du prix m²
    médian résidentiel par commune et par semestre (pas le DVF brut multi-Go).
    `fetch/dvf.ts` : échelle commune uniquement, priorité appartements+maisons,
    historique ≤10 périodes → `CommuneDetail.prix` (`{m2, periode, nb?, histo}`)
    dans `dep/{code}.json`. Hors couverture (Alsace, Moselle, Mayotte, communes
    sans ventes) → champ absent, l'UI l'affiche honnêtement. N'alimente PAS la
    note (info affichée, pas critère). **Piège arrondissements** : le
    millésime DVF ventile Paris/Lyon/Marseille PAR arrondissement (751xx/690xx/
    132xx), jamais sur le code INSEE de la ville-mère — `codesAccumulation`
    crédite donc CHAQUE ligne d'arrondissement à la fois sur lui-même et sur sa
    mère, mais l'accumulateur (`makeDvfAccumulator`) doit alors **combiner**
    (sommer le nb de ventes, moyenne pondérée par nb pour le prix) les
    lignes de PLUSIEURS origines reçues par la mère pour une même période —
    la 1ʳᵉ version ne gardait que la meilleure priorité de type de bien et
    écrasait silencieusement les arrondissements suivants avec le même type,
    d'où un `nb` dérisoire pour Paris (~3 ventes au lieu de centaines) hérité
    d'un seul arrondissement. Tests : `test/dvf.spec.ts`.
- **Scoring réel par rang percentile moyen** (`score/real.ts`, plus de notes
  factices) : densité /1000 hab (BPE), taux /1000 hab (SSMSI, inversé), revenu
  médian (Filosofi) → `rankNotes` (`score/scale.ts`) = midrank puis remise à
  l'échelle (meilleure commune du critère → 10). **NB scaling** : la 1re version
  « count ≤ valeur » mettait les ex æquo à zéro EN HAUT (commune sans culture =
  9.6/10) ; le min–max les mettait à 0 (effondrement, meilleure note globale 6.1).
  Le **midrank** leur donne le MILIEU de leur plage (≈4-5), distribution saine.
  **Sécurité classée PAR strate de population** (`stratePopulation`, seuils
  500/2k/5k/20k/50k/100k) : sinon les >50 % de communes rurales sans délinquance
  écrasent toutes les villes vers 0. **Boost gamma par critère**
  (`scoring.config.json` `boost`, appliqué dans `rankNotes`) : `gamma < 1` relève
  et homogénéise les notes vers le haut pour les services de base très répandus
  (enseignement, sports = 0.5). Commune sans donnée → **note neutre 5**
  (jamais 0). **Arrondissements Paris/Lyon/Marseille notés individuellement**
  (`fetch/insee-code.ts` `codesAccumulation`/`estArrondissement`) : les 4
  fetchers créditent CHAQUE ligne source à la fois sur la commune mère
  (agrégat historique, ex. `75056`) et sur l'arrondissement lui-même (ex.
  `75108`), classé au même rang percentile national que n'importe quelle
  commune — hiérarchie **Région > Département > Ville > Arrondissement**.
  `main.ts` relie ensuite chaque arrondissement à sa mère
  (`CommuneDetail.communeMere`) et embarque sur la mère la liste triée de ses
  arrondissements (`CommuneDetail.arrondissements`). `geo.ts` ne filtre donc
  plus `type === 'arrondissement-municipal'` (exclusif à ces 45 communes).
  `emit/index.ts` exclut les arrondissements des totaux
  population/nbCommunes/noteMoyenne de `departements.json`/`regions.json`
  (double comptage sinon — un arrondissement n'est pas un habitant
  supplémentaire) mais les inclut PARTOUT ailleurs comme des communes à part
  entière : `index.json`, `classement.json`, `geo-light.json`,
  `dep/{code}.json`. Invariant 5 revu en conséquence (cohérence
  mère ↔ arrondissements, comptes attendus 20/9/16). Note globale =
  Σ(note×poids)/Σ(poids).
- **URLs résolues et validées en CI** (job « Validate open data » vert, PR #11) :
  BPE via dataset data.gouv `base-permanente-des-equipements` (CSV ensemble
  **2018**, en-têtes FR), SSMSI `bases-statistiques-…-delinquance` (COM csv.gz,
  millésime **2025**), Filosofi `revenu-des-francais-a-la-commune` (**2021**,
  colonne `[DISP] Médiane (€)`). Couverture obtenue : BPE 86 % · SSMSI 100 % ·
  Filosofi 89 %. Réseau bloqué en sandbox → **jamais exécutable en local**, valider
  en CI. Fetchers en **dégradation gracieuse** (`fetchOrWarn`) : une source KO logge
  un ⚠ et bascule le critère sur la médiane (déploiement non bloqué). Rapport de run
  = couverture par source + histogramme des notes. **BPE 2018 = limite v1** (dernier
  ensemble librement téléchargeable ; upgrade vers dénombrement INSEE récent = TODO).
- Cache `.cache/{name}.csv` (< 30 j, gitignoré), décompression zip/gz + parsing
  CSV streaming (`fetch/download.ts`, deps `adm-zip`+`csv-parse`).
- Émet dans `public/data/` (gitignoré, régénéré en CI) : `index.json` (trié nn),
  `departements.json`, `regions.json` (classement régional → départements imbriqués,
  `emit/regions.ts`), `dep/{code}.json`, `classement.json`, `geo-light.json`
  (carte, communes ≥500 hab avec lat/lng) + `public/sitemap.xml`.
- **Régions** (`emit/regions.ts`) : table statique `DEPARTEMENT_REGION` (101 dépts →
  code région INSEE) + `REGIONS` (code → nom). `aggregateRegions()` regroupe les
  départements, note région = moyenne des communes **pondérée population**
  (recalculée depuis les sommes non arrondies), régions et départements triés note ↓.
- 6 invariants validés en fin de run (notes ∈[0,10] 1 déc., slugs uniques, etc.).
- **Déterministe à données constantes** : même cache → fichiers identiques.
- Refresh mensuel : `.github/workflows/data-refresh.yml` (cron + `workflow_dispatch`,
  force la régénération hors cache de `deploy.yml`).
- Validation URLs en CI : `data-validate.yml` tourne **sur la PR** (si le pipeline
  change) et lance `npm run data:validate` = `data:build --strict` (échoue si une
  source a 0 % de couverture). Ne déploie pas. `deploy.yml` reste gracieux.
- URL des données runtime = `new URL('data/x.json', document.baseURI)` (relatif,
  correct en dev comme en prod — jamais coder `/plan-ma-ville/` en dur).

