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

/** Quantile (rang le plus proche) d'un tableau trié croissant, p ∈ [0,1]. */
export function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const idx = Math.round(p * (n - 1));
  return sorted[Math.min(n - 1, Math.max(0, idx))];
}

export interface Bounds {
  lo: number;
  hi: number;
}

/**
 * Bornes robustes pour la normalisation : 2ᵉ et 98ᵉ centiles (ignore les
 * valeurs aberrantes — ex. densité folle d'une micro-commune, taux de
 * délinquance extrême). Repli sur min/max si les centiles sont confondus.
 */
export function robustBounds(sorted: readonly number[]): Bounds {
  let lo = quantile(sorted, 0.02);
  let hi = quantile(sorted, 0.98);
  if (hi <= lo) {
    lo = sorted[0] ?? 0;
    hi = sorted[sorted.length - 1] ?? 0;
  }
  return { lo, hi };
}

/**
 * Note /10 par normalisation min–max linéaire sur `[lo, hi]`, bornée à [0,10].
 * La commune la moins bien dotée (≤ lo) obtient 0, la mieux dotée (≥ hi) obtient
 * 10. `invert = true` (délinquance) : valeur BASSE ⇒ meilleure note.
 * Si `hi <= lo` (critère dégénéré), renvoie la note neutre 5.
 */
export function linearNote(value: number, { lo, hi }: Bounds, invert = false): number {
  if (hi <= lo) return 5;
  const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  return round1((invert ? 1 - t : t) * 10);
}
