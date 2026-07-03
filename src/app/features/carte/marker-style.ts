/**
 * Style des markers de la carte (spec §6).
 * Fonctions pures, sans dépendance à Leaflet → testables.
 */

/** Couleur du marker selon la note globale /10. */
export function markerColor(note: number): string {
  if (note >= 7.5) return '#1d8a63';
  if (note >= 6) return '#d9a514';
  if (note >= 4) return '#e67e22';
  return '#c93a2e';
}

/** Rayon du marker (px) selon la population. */
export function markerRadius(pop: number): number {
  if (pop >= 100_000) return 10;
  if (pop >= 10_000) return 7;
  return 5;
}
