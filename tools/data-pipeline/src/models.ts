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
  securite: 'Sécurité',
  sante: 'Santé',
  commerces: 'Commerces',
  enseignement: 'Enseignement',
  sports: 'Sports & loisirs',
  culture: 'Culture',
  transports: 'Transports',
  niveauVie: 'Niveau de vie',
};

// ─────────────────────────────────────────────
// index.json — index de recherche global
// Champs courts volontairement : ~35 000 entrées
// ─────────────────────────────────────────────
export interface SearchIndexFile {
  v: 1; // version schéma
  gen: string; // date ISO génération (YYYY-MM-DD)
  items: SearchIndexItem[]; // triés par nn croissant
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
  code: string; // "69"
  nom: string; // "Rhône"
  nbCommunes: number;
  noteMoyenne: number; // moyenne pondérée population, 1 décimale
}

// ─────────────────────────────────────────────
// regions.json — classement régional (régions → départements)
// ─────────────────────────────────────────────
export interface RegionsFile {
  v: 1;
  gen: string;
  items: RegionSummary[]; // triés par note décroissante
}

export interface RegionSummary {
  code: string; // code INSEE région ("84")
  nom: string; // "Auvergne-Rhône-Alpes"
  nbDepartements: number;
  nbCommunes: number;
  noteMoyenne: number; // moyenne pondérée population, 1 décimale
  /** Départements de la région, triés par note décroissante. */
  departements: DepartementSummary[];
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
  /** Latitude du centre (absente si l'open data ne la fournit pas). */
  lat?: number;
  /** Longitude du centre. */
  lon?: number;
  score: CommuneScore;
  /** Prix immobilier réel DVF (absent : pas de ventes / hors couverture). */
  prix?: PrixM2;
}

/**
 * Prix au m² réel issu des agrégats « Statistiques DVF » (data.gouv, DGFiP).
 * Couverture : France sauf Alsace, Moselle, Mayotte (livre foncier local) ;
 * médiane absente quand trop peu de ventes sur la période.
 */
export interface PrixM2 {
  /** €/m² médian (résidentiel) sur la dernière période disponible. */
  m2: number;
  /** Dernière période ("2025-S2" ou "2025-12" selon la granularité source). */
  periode: string;
  /** Nombre de ventes de la période (indice de fiabilité), si publié. */
  nb?: number;
  /** Historique chronologique (≤ 10 périodes) pour la sparkline. */
  histo: { p: string; v: number }[];
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
  top: ClassementEntry[]; // 50, note décroissante
  flop: ClassementEntry[]; // 50, note croissante
}

export interface ClassementEntry {
  slug: string;
  nom: string;
  departement: string;
  population: number;
  global: number;
  /** Notes par critère (100 entrées → coût nul) : permet la repondération
   *  côté client (profil famille/actif/retraité). */
  criteres: Record<Critere, number>;
}

// ─────────────────────────────────────────────
// geo-light.json — points allégés pour la carte
// (champs courts : ~25 000 communes ≥ 500 hab avec coordonnées)
// ─────────────────────────────────────────────
export interface GeoLightFile {
  v: 1;
  gen: string;
  items: GeoLightItem[];
}

export interface GeoLightItem {
  /** Code INSEE */
  i: string;
  /** Nom officiel */
  n: string;
  /** Slug (lien fiche) */
  s: string;
  lat: number;
  lng: number;
  /** Note globale /10 */
  g: number;
  /** Population (dimensionne le marker) */
  p: number;
}
