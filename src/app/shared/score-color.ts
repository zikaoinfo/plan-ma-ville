/**
 * Palette des notes, partagée par ScoreBadge et NoteBar.
 * Seuils contractuels (spec phase 2) : <4 rouge, <6 orange,
 * <7.5 jaune (texte sombre), ≥7.5 vert.
 */
export type ScoreTier = 'bad' | 'mid' | 'warn' | 'good';

export function scoreTier(score: number): ScoreTier {
  if (score < 4) return 'bad';
  if (score < 6) return 'mid';
  if (score < 7.5) return 'warn';
  return 'good';
}

/**
 * Couleurs de note en HEX — réservées au rendu HORS CSS : les markers
 * Leaflet sont peints dans un canvas, sans accès aux variables du thème
 * (`marker-style.ts`). Tout ce qui vit dans le DOM passe par TIER_VAR,
 * qui suit le thème clair/sombre. Valeurs = paliers du THÈME CLAIR.
 *
 * Valeurs alignées sur --tier-* du thème clair (styles.scss) : une couleur
 * qui dérive ici ferait des markers de carte d'une autre palette que les
 * badges de la même note. Chaque palier porte son texte à ≥ 5.3:1.
 */
export const TIER_BG: Record<ScoreTier, string> = {
  bad: '#c02c26',
  mid: '#d97706',
  warn: '#b8890b',
  good: '#0f7a4f',
};

/**
 * Couleur de texte par palier — chacune vérifiée ≥ 4.5:1 (WCAG AA) sur son
 * fond ci-dessus. `mid` (orange) passe en texte sombre : en blanc le ratio
 * n'était que de 2.85:1 (échec relevé par Lighthouse sur `span.badge`).
 */
export const TIER_FG: Record<ScoreTier, string> = {
  bad: '#ffffff',
  mid: '#1a1a1a',
  warn: '#1a1a1a',
  good: '#ffffff',
};

/**
 * Paliers en variables CSS — à utiliser partout dans le DOM (badges, barres,
 * sliders, comparateur). Le thème sombre redéfinit --tier-* dans styles.scss :
 * une couleur figée en TS resterait au vert profond du thème clair sur la nuit
 * violette, désaccordée du reste de la page.
 */
export const TIER_VAR: Record<ScoreTier, string> = {
  bad: 'var(--tier-bad)',
  mid: 'var(--tier-mid)',
  warn: 'var(--tier-warn)',
  good: 'var(--tier-good)',
};

/** Texte posé sur TIER_VAR — contrastes vérifiés dans les deux thèmes. */
export const ON_TIER_VAR: Record<ScoreTier, string> = {
  bad: 'var(--on-tier-bad)',
  mid: 'var(--on-tier-mid)',
  warn: 'var(--on-tier-warn)',
  good: 'var(--on-tier-good)',
};
