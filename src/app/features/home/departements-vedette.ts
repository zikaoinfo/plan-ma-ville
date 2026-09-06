import type { DepartementSummary } from '../../core/models/data.models';

/** Combien de départements l'accueil met en avant. */
export const NB_DEPARTEMENTS_VEDETTE = 12;

/**
 * Les départements les plus peuplés, pour l'accueil.
 *
 * Afficher les 101 départements donnait un mur sans hiérarchie ; les trier par
 * note aurait doublonné /classement/ et laissé croire à un palmarès. La
 * population est un critère externe, vérifiable et sans rapport avec la note —
 * c'est le seul qui ne raconte rien de faux sur la sélection.
 *
 * Tri stable : à population égale, ordre alphabétique.
 */
export function departementsVedette(
  items: readonly DepartementSummary[],
  combien: number = NB_DEPARTEMENTS_VEDETTE,
): DepartementSummary[] {
  return [...items]
    .sort((a, b) => b.population - a.population || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, combien);
}
