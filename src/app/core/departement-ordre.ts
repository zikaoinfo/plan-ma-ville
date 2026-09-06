/**
 * Clé de tri des codes département dans l'ordre administratif français.
 *
 * `localeCompare(…, { numeric: true })` place « 2A » et « 2B » entre 02 et 03 :
 * la Corse se lit alors avant l'Allier, ce qui n'est l'ordre de personne. Les
 * deux départements corses occupent la place de l'ancien « 20 », c'est-à-dire
 * entre la Corrèze (19) et la Côte-d'Or (21). Les DROM (971…976) suivent 95.
 */
export function ordreDepartement(code: string): number {
  if (code === '2A') return 20.1;
  if (code === '2B') return 20.2;
  const n = Number(code);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

/** Comparateur prêt pour `Array.prototype.sort`. */
export function comparerDepartements(a: string, b: string): number {
  return ordreDepartement(a) - ordreDepartement(b) || a.localeCompare(b);
}
