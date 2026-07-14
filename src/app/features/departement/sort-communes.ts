import type { CommuneDetail, Critere } from '../../core/models/data.models';
import { normaliseNom } from '../../core/normalise';
import { noteGlobalePonderee, POIDS_OFFICIELS, type Poids } from '../../core/ponderation';

export type SortField = Critere | 'nom' | 'population' | 'global' | 'perso';
export type SortOrder = 1 | -1;

function valeur(commune: CommuneDetail, field: SortField, poids: Poids, nn: string): number | string {
  switch (field) {
    case 'nom':
      return nn;
    case 'population':
      return commune.population;
    case 'global':
      return commune.score.global;
    case 'perso':
      return noteGlobalePonderee(commune.score.criteres, poids);
    default:
      return commune.score.criteres[field];
  }
}

/**
 * Filtre (sous-chaîne sur le nom normalisé) puis trie une liste de communes.
 * Fonction pure — ne mute pas l'entrée. `poids` n'est utilisé que pour le
 * tri `perso` (note repondérée côté client).
 *
 * Nom normalisé et clé de tri précalculés une fois par commune
 * (décorer-trier-retirer) : `normaliseNom` (NFD + regex) ne tourne plus
 * O(n log n) fois dans le comparateur sur les ~800 communes d'un département.
 */
export function filterAndSortCommunes(
  communes: readonly CommuneDetail[],
  field: SortField,
  order: SortOrder,
  filter: string,
  poids: Poids = POIDS_OFFICIELS,
): CommuneDetail[] {
  const q = normaliseNom(filter);
  const decorated = communes
    .map((c) => ({ c, nn: normaliseNom(c.nom) }))
    .filter((d) => !q || d.nn.includes(q))
    .map((d) => ({ ...d, v: valeur(d.c, field, poids, d.nn) }));

  decorated.sort((a, b) => {
    if (a.v < b.v) return -order;
    if (a.v > b.v) return order;
    // départage stable par nom pour un ordre déterministe
    return a.nn.localeCompare(b.nn);
  });

  return decorated.map((d) => d.c);
}
