import type { CommuneDetail, Critere } from '../../core/models/data.models';
import { normaliseNom } from '../../core/normalise';
import { noteGlobalePonderee, POIDS_OFFICIELS, type Poids } from '../../core/ponderation';

export type SortField = Critere | 'nom' | 'population' | 'global' | 'perso';
export type SortOrder = 1 | -1;

function valeur(commune: CommuneDetail, field: SortField, poids: Poids): number | string {
  switch (field) {
    case 'nom':
      return normaliseNom(commune.nom);
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
 */
export function filterAndSortCommunes(
  communes: readonly CommuneDetail[],
  field: SortField,
  order: SortOrder,
  filter: string,
  poids: Poids = POIDS_OFFICIELS,
): CommuneDetail[] {
  const q = normaliseNom(filter);
  const filtered = q
    ? communes.filter((c) => normaliseNom(c.nom).includes(q))
    : [...communes];

  return filtered.sort((a, b) => {
    const va = valeur(a, field, poids);
    const vb = valeur(b, field, poids);
    if (va < vb) return -order;
    if (va > vb) return order;
    // départage stable par nom pour un ordre déterministe
    return normaliseNom(a.nom).localeCompare(normaliseNom(b.nom));
  });
}
