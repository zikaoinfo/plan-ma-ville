/**
 * Le jeu de pages balayé par les tests de rendu. Les slugs viennent du
 * fixture `npm run data:sample` (départements 69 et 75) : garder cette liste
 * alignée dessus, sinon les tests passent sur des pages vides.
 * Toutes les URLs sont sous forme canonique **avec slash final**.
 */
export const PAGES: readonly { readonly nom: string; readonly url: string }[] = [
  { nom: 'accueil', url: '/' },
  { nom: 'fiche commune', url: '/ville/lyon-69123/' },
  { nom: 'département', url: '/departement/69/' },
  { nom: 'départements', url: '/departements/' },
  { nom: 'régions', url: '/regions/' },
  { nom: 'région', url: '/region/84/' },
  { nom: 'classement', url: '/classement/' },
  { nom: 'comparateur', url: '/comparer/' },
  { nom: 'méthodologie', url: '/methodologie/' },
];
