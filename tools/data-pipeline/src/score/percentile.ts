import { round1 } from './round.js';

/**
 * Note /10 par rang percentile.
 *
 * `all` DOIT être trié par ordre croissant (utiliser {@link sortedValues}).
 * La note correspond à la fraction de communes dont la valeur est ≤ à `value`
 * (convention contractuelle, cf. docs/SPEC-DATA — test :
 * `toPercentileNote(5, [1,3,5,7,9]) === 6`).
 *
 * `invert = true` (ex. délinquance) : plus la valeur est BASSE, meilleure est la
 * note. On prend alors la fraction de communes dont la valeur est ≥ à `value`.
 *
 * Aucune note n'est jamais 0 (la valeur minimale obtient au moins `1/n·10`) ;
 * seule la meilleure valeur du critère peut atteindre 10.
 */
export function toPercentileNote(value: number, all: readonly number[], invert = false): number {
  const n = all.length;
  if (n === 0) return 5;
  const rang = invert ? n - lowerBound(all, value) : upperBound(all, value);
  return clamp01to10(round1((rang / n) * 10));
}

/** Copie triée croissante des valeurs (à passer ensuite à toPercentileNote). */
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

function clamp01to10(x: number): number {
  return x < 0 ? 0 : x > 10 ? 10 : x;
}

/** Premier index dont l'élément est > value (nombre d'éléments ≤ value). */
function upperBound(a: readonly number[], value: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (a[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Premier index dont l'élément est ≥ value (nombre d'éléments < value). */
function lowerBound(a: readonly number[], value: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (a[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
