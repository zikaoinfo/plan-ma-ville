import type { Critere } from '../models.js';
import { round1 } from './fake.js';

/**
 * Note globale = Σ(note × poids) / Σ(poids), arrondie à 1 décimale.
 * Fonction pure ; throw si un poids est nul ou négatif.
 */
export function noteGlobale(
  criteres: Record<Critere, number>,
  ponderations: Record<Critere, number>,
): number {
  let somme = 0;
  let sommePoids = 0;

  for (const [critere, note] of Object.entries(criteres) as [Critere, number][]) {
    const poids = ponderations[critere];
    if (poids === undefined || poids <= 0) {
      throw new Error(`Pondération invalide pour "${critere}" : ${poids}`);
    }
    somme += note * poids;
    sommePoids += poids;
  }

  return round1(somme / sommePoids);
}
