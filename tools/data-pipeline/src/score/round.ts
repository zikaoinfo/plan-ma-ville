/** Arrondi à 1 décimale (invariant contractuel : toute note ∈ [0,10] à 1 déc.). */
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
