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
 * Source de vérité UNIQUE des couleurs de note : badges, barres, sliders,
 * comparateur ET markers de la carte (marker-style.ts). Alignée sur les
 * tokens --bad / --warn / --good de styles.scss.
 */
export const TIER_BG: Record<ScoreTier, string> = {
  bad: '#c93a2e',
  mid: '#e67e22',
  warn: '#d9a514',
  good: '#1d8a63',
};

/** Texte sombre uniquement sur le jaune, pour le contraste. */
export const TIER_FG: Record<ScoreTier, string> = {
  bad: '#ffffff',
  mid: '#ffffff',
  warn: '#1b1b1b',
  good: '#ffffff',
};
