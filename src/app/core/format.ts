/**
 * Formatage français des nombres, partagé par les textes éditoriaux
 * (commune-texte, palmares-logic). Fonctions pures.
 */

/** Entier avec séparateurs de milliers français (12 345). */
export const fmtEntier = (n: number): string => n.toLocaleString('fr-FR');

/** Note sur 10 à une décimale, virgule française (7,4). */
export const fmtNote = (n: number): string => n.toFixed(1).replace('.', ',');

/** Date ISO (« 2026-07-15 ») → libellé français long (« 15 juillet 2026 »). */
export function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
