/**
 * Formatage français des nombres, partagé par les textes éditoriaux
 * (commune-texte, palmares-logic). Fonctions pures.
 */

/** Entier avec séparateurs de milliers français (12 345). */
export const fmtEntier = (n: number): string => n.toLocaleString('fr-FR');

/** Note sur 10 à une décimale, virgule française (7,4). */
export const fmtNote = (n: number): string => n.toFixed(1).replace('.', ',');
