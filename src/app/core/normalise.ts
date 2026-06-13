/**
 * Normalisation des noms — strictement identique à la règle du pipeline
 * (`tools/data-pipeline/src/emit/index.ts`) pour que la saisie utilisateur
 * matche le champ `nn` pré-calculé dans index.json :
 * minuscules, sans accents, apostrophes/tirets → espaces, espaces compactés.
 */
export function normaliseNom(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
