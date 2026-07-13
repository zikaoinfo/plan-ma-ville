import { CRITERES, type Critere } from './models/data.models';

/**
 * Pondération personnalisée des critères — tout est calculé CÔTÉ CLIENT à
 * partir des 8 notes par critère déjà présentes dans les données statiques.
 * Poids ∈ [0, 2] par critère (0 = critère ignoré).
 */
export type Poids = Record<Critere, number>;

export type ProfilId = 'officiel' | 'famille' | 'actif' | 'retraite' | 'perso';

export interface Profil {
  id: ProfilId;
  label: string;
  icon: string;
  description: string;
  /** Poids du preset ; `null` pour `perso` (poids libres de l'utilisateur). */
  poids: Poids | null;
}

export const POIDS_MIN = 0;
export const POIDS_MAX = 2;

/**
 * Poids officiels — MÊMES valeurs que `ponderations` de
 * `tools/data-pipeline/scoring.config.json` (la note globale pré-calculée) :
 * à garder alignés.
 */
export const POIDS_OFFICIELS: Poids = {
  securite: 1.5,
  sante: 1.2,
  commerces: 1.0,
  enseignement: 1.0,
  sports: 0.8,
  culture: 0.8,
  transports: 1.2,
  niveauVie: 1.0,
};

/** Presets par profil de vie (choix éditoriaux, documentés sur Méthodologie). */
export const PROFILS: readonly Profil[] = [
  {
    id: 'officiel',
    label: 'Officiel',
    icon: '⚖️',
    description: 'La pondération standard du site (celle des classements).',
    poids: POIDS_OFFICIELS,
  },
  {
    id: 'famille',
    label: 'Famille',
    icon: '👨‍👩‍👧',
    description: 'Écoles, sécurité et santé d’abord.',
    poids: {
      securite: 2.0,
      sante: 1.5,
      commerces: 1.0,
      enseignement: 2.0,
      sports: 1.2,
      culture: 0.8,
      transports: 1.0,
      niveauVie: 0.8,
    },
  },
  {
    id: 'actif',
    label: 'Jeune actif',
    icon: '🧑‍💼',
    description: 'Transports, sorties et commerces d’abord.',
    poids: {
      securite: 0.8,
      sante: 0.6,
      commerces: 1.5,
      enseignement: 0.3,
      sports: 1.2,
      culture: 1.5,
      transports: 2.0,
      niveauVie: 1.2,
    },
  },
  {
    id: 'retraite',
    label: 'Retraité',
    icon: '🧓',
    description: 'Santé, commerces de proximité et tranquillité d’abord.',
    poids: {
      securite: 1.5,
      sante: 2.0,
      commerces: 1.5,
      enseignement: 0.2,
      sports: 0.8,
      culture: 1.2,
      transports: 1.0,
      niveauVie: 1.0,
    },
  },
  {
    id: 'perso',
    label: 'Perso',
    icon: '🎛️',
    description: 'Réglez chaque critère vous-même.',
    poids: null,
  },
];

export function profilById(id: ProfilId): Profil {
  return PROFILS.find((p) => p.id === id) ?? PROFILS[0];
}

/** Valide un id de profil brut (localStorage) ; inattendu → `officiel`. */
export function sanitiseProfil(raw: string | null | undefined): ProfilId {
  return PROFILS.some((p) => p.id === raw) ? (raw as ProfilId) : 'officiel';
}

/** Borne un poids dans [0, 2] (0.1 près) ; non-numérique → poids officiel. */
export function sanitisePoids(raw: unknown): Poids {
  const out = { ...POIDS_OFFICIELS };
  if (raw && typeof raw === 'object') {
    for (const c of CRITERES) {
      const v = (raw as Record<string, unknown>)[c];
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[c] = Math.round(Math.min(POIDS_MAX, Math.max(POIDS_MIN, v)) * 10) / 10;
      }
    }
  }
  return out;
}

/**
 * Note globale repondérée = Σ(note×poids)/Σ(poids), arrondie à 0.1.
 * Tous les poids à 0 → moyenne simple (on n'invente pas une note nulle).
 */
export function noteGlobalePonderee(criteres: Record<Critere, number>, poids: Poids): number {
  let somme = 0;
  let total = 0;
  for (const c of CRITERES) {
    somme += criteres[c] * poids[c];
    total += poids[c];
  }
  if (total === 0) {
    for (const c of CRITERES) somme += criteres[c];
    return Math.round((somme / CRITERES.length) * 10) / 10;
  }
  return Math.round((somme / total) * 10) / 10;
}
