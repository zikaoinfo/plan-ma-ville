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
  /**
   * Vrai pour un arrondissement municipal (Paris/Lyon/Marseille) : noté comme
   * une commune à part entière, mais rattaché à une commune mère (`communeMere`).
   * Hiérarchie : Région > Département > Ville > Arrondissement.
   */
  estArrondissement?: boolean;
  /** Pour un arrondissement : identité de sa commune mère (fil d'Ariane). */
  communeMere?: CommuneMereRef;
  /** Pour Paris/Lyon/Marseille : ses arrondissements, triés par note décroissante. */
  arrondissements?: ArrondissementResume[];
}

export interface CommuneMereRef {
  slug: string;
  nom: string;
  codeInsee: string;
}

/** Résumé d'un arrondissement, embarqué dans la fiche de sa commune mère. */
export interface ArrondissementResume {
  slug: string;
  nom: string;
  codeInsee: string;
  population: number;
  score: CommuneScore;
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

// ─────────────────────────────────────────────
// Avis habitant (Supabase) — spec SPEC-PHASES-7-12 §1
// ─────────────────────────────────────────────
export interface Avis {
  id: string;
  commune_insee: string; // code INSEE (= SearchIndexItem.i)
  user_id: string;
  created_at: string; // ISO
  note_securite: number;
  note_sante: number;
  note_commerces: number;
  note_enseignement: number;
  note_sports: number;
  note_culture: number;
  note_transports: number;
  note_niveau_vie: number;
  note_globale: number; // calculé côté Supabase (GENERATED STORED)
  positifs: string;
  negatifs: string | null;
  /** Affiché tel quel : "Habitant anonyme" ou "Prénom I." — calculé côté serveur. */
  pseudo: string;
  /** Avis publié sans nom (pseudo forcé à "Habitant anonyme" côté serveur). */
  anonyme: boolean;
  resume_ia?: string;
}

export type AvisInsert = Omit<Avis, 'id' | 'created_at' | 'note_globale' | 'resume_ia'>;

/** Stats communautaires agrégées d'une commune (table communes_stats). */
export interface CommuneStats {
  note_habitants: number | null;
  nb_avis: number;
  resume_ia: string | null;
}

/** Correspondance clé de critère (Critere) → colonne note_* de la table avis. */
export const AVIS_NOTE_COLS: Record<Critere, keyof AvisInsert> = {
  securite: 'note_securite',
  sante: 'note_sante',
  commerces: 'note_commerces',
  enseignement: 'note_enseignement',
  sports: 'note_sports',
  culture: 'note_culture',
  transports: 'note_transports',
  niveauVie: 'note_niveau_vie',
};
