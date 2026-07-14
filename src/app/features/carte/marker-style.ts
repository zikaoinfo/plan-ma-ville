import { scoreTier, TIER_BG } from '../../shared/score-color';

/**
 * Style des markers de la carte (spec §6).
 * Fonctions pures, sans dépendance à Leaflet → testables.
 */

/** Couleur du marker selon la note globale /10 (palette partagée TIER_BG). */
export function markerColor(note: number): string {
  return TIER_BG[scoreTier(note)];
}

/** Rayon du marker (px) selon la population. */
export function markerRadius(pop: number): number {
  if (pop >= 100_000) return 10;
  if (pop >= 10_000) return 7;
  return 5;
}
