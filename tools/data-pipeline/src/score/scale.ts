import { round1 } from './round.js';

/** Copie triée croissante des valeurs. */
export function sortedValues(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

/** Médiane d'un tableau trié croissant (0 si vide). */
export function median(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Notes /10 par **rang percentile moyen** (midrank), dans l'ordre des `values`
 * fournies. Chaque commune est notée selon la position de sa valeur parmi
 * toutes ; les ex æquo reçoivent le rang MOYEN de leur groupe (au milieu de leur
 * plage, jamais au sommet). C'est la clé : une masse de communes ex æquo à zéro
 * (ex. aucun équipement culturel) obtient une note médiane — ni 0 ni ~10.
 *
 * `invert = true` (délinquance) : valeur BASSE ⇒ meilleure note.
 *
 * On remet ensuite à l'échelle pour que la meilleure commune du critère = 10
 * (division par la note max), sans forcer le minimum à 0 : les critères très
 * creux gardent ainsi une distribution réaliste au lieu de s'effondrer.
 *
 * `gamma` (défaut 1) courbe la distribution : `gamma < 1` relève et resserre les
 * notes vers le haut (utile pour un critère « service de base » très répandu,
 * ex. enseignement, sports) ; `gamma > 1` étale vers le bas.
 */
export function rankNotes(values: readonly number[], invert = false, gamma = 1): number[] {
  const m = values.length;
  if (m === 0) return [];
  if (m === 1) return [10];

  // Rang moyen (1-based) de chaque valeur, ex æquo regroupés.
  const ordre = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const midrank = new Array<number>(m);
  let i = 0;
  while (i < m) {
    let j = i;
    while (j + 1 < m && values[ordre[j + 1]] === values[ordre[i]]) j++;
    const rangMoyen = (i + 1 + (j + 1)) / 2; // moyenne des rangs i+1..j+1
    for (let k = i; k <= j; k++) midrank[ordre[k]] = rangMoyen;
    i = j + 1;
  }

  const brut = midrank.map((r) => {
    const frac = (r - 1) / (m - 1); // 0 (pire) → 1 (meilleur)
    const oriente = invert ? 1 - frac : frac;
    return Math.pow(oriente, gamma) * 10;
  });

  const maxBrut = Math.max(...brut);
  const echelle = maxBrut > 0 ? 10 / maxBrut : 1; // meilleure commune → 10
  return brut.map((n) => round1(Math.min(10, Math.max(0, n * echelle))));
}
