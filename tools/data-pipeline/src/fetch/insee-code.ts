/**
 * Ramène un code INSEE d'arrondissement municipal à sa commune mère.
 * Les sources open data (BPE, SSMSI, Filosofi) ventilent parfois Paris, Lyon
 * et Marseille par arrondissement (75101…, 69381…, 13201…) alors que l'index
 * du site n'expose que la commune mère (75056, 69123, 13055). On agrège donc
 * les données des arrondissements sur la mère pour ne pas la laisser à zéro.
 */
export function communeParent(code: string): string {
  const c = code.trim().toUpperCase();
  const n = Number(c);
  if (Number.isNaN(n)) return c; // codes Corse 2A004 / 2B033 : inchangés
  if (n >= 75101 && n <= 75120) return '75056';
  if (n >= 69381 && n <= 69389) return '69123';
  if (n >= 13201 && n <= 13216) return '13055';
  return c;
}
