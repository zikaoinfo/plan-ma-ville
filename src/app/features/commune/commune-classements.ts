import { fmtEntier } from '../../core/format';
import type { Classements, CommuneDetail } from '../../core/models/data.models';

/**
 * Mise en forme des trois classements d'une commune (national, départemental,
 * par strate de population).
 *
 * Le rang par strate est celui qui apporte le plus : comparer une commune de
 * 3 000 habitants aux 35 000 communes de France n'a pas grand sens, alors que
 * la comparer aux communes de taille voisine est statistiquement défendable —
 * et souvent plus juste pour elle, une petite ville pouvant très bien mener sa
 * catégorie sans figurer dans le haut du classement national.
 *
 * Les rangs viennent des données (`score/classements.ts` du pipeline), jamais
 * d'un recalcul côté client : c'est ce qui garantit que ce bloc, la prose et
 * la FAQ d'une même fiche annoncent le même chiffre.
 *
 * Fonctions PURES (testées dans `commune-classements.spec.ts`).
 */

/** Libellés des strates — MÊME ordre que `STRATES_LABELS` du pipeline. */
export const STRATES_LABELS = [
  'de moins de 500 habitants',
  'de 500 à 2 000 habitants',
  'de 2 000 à 5 000 habitants',
  'de 5 000 à 10 000 habitants',
  'de 10 000 à 20 000 habitants',
  'de 20 000 à 50 000 habitants',
  'de 50 000 à 100 000 habitants',
  'de 100 000 à 200 000 habitants',
  'de plus de 200 000 habitants',
];

export interface LigneClassement {
  /** Intitulé du groupe de comparaison (« Dans le Rhône »). */
  libelle: string;
  rang: number;
  total: number;
  /** Rang formaté (« 1ʳᵉ », « 34ᵉ »). */
  rangTexte: string;
  /** Percentile : part des communes du groupe faisant moins bien (0-100). */
  percentile: number;
}

/** Rang à la française : 1ʳᵉ, 2ᵉ, 3ᵉ… */
export function rangTexte(rang: number): string {
  return rang === 1 ? '1ʳᵉ' : `${fmtEntier(rang)}ᵉ`;
}

/** Libellé d'une strate ; chaîne vide si l'indice est hors bornes. */
export function libelleStrate(index: number): string {
  return STRATES_LABELS[index] ?? '';
}

/**
 * Part des communes du groupe classées derrière, en %.
 *
 * Arrondi vers le BAS, jamais au plus proche : sur un groupe de 34 920
 * communes, être 104ᵉ donne 99,7 %, qu'un arrondi classique afficherait
 * « 100 % » — soit l'affirmation, fausse, qu'aucune commune ne fait mieux.
 * Le plancher ne surestime jamais le classement.
 *
 * Sur un groupe d'une seule commune la notion n'a pas de sens : on renvoie
 * 100 (elle est bien première, et la ligne n'est de toute façon pas affichée).
 */
export function percentile(rang: number, total: number): number {
  if (total <= 1) return 100;
  return Math.floor(((total - rang) / (total - 1)) * 100);
}

/**
 * Les trois lignes du bloc. `null` si la commune n'a pas de classements
 * (données antérieures au champ) : mieux vaut ne rien afficher qu'un rang
 * inventé côté client.
 */
export function lignesClassement(
  commune: CommuneDetail,
  depNom: string,
): LigneClassement[] | null {
  const c: Classements | undefined = commune.classements;
  if (!c) return null;

  const ligne = (libelle: string, rang: number, total: number): LigneClassement => ({
    libelle,
    rang,
    total,
    rangTexte: rangTexte(rang),
    percentile: percentile(rang, total),
  });

  const lignes = [
    ligne('En France', c.national, c.nationalTotal),
    // « Dans son département (X) » plutôt que « Dans le X » : les noms de
    // départements n'ont pas tous le même article (le Rhône, la Marne, les
    // Yvelines, l'Aisne) et aucune règle simple ne le déduit du nom.
    ligne(`Dans son département (${depNom})`, c.departement, c.departementTotal),
  ];

  // La ligne « strate » n'est utile que s'il y a réellement d'autres communes
  // comparables : « 1ʳᵉ sur 1 » n'informe personne.
  if (c.strateTotal > 1) {
    // Le libellé commence déjà par « de » (cf. STRATES_LABELS).
    lignes.push(ligne(`Parmi les communes ${libelleStrate(c.strateIndex)}`, c.strate, c.strateTotal));
  }
  return lignes;
}
