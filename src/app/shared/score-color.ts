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

export const TIER_BG: Record<ScoreTier, string> = {
  bad: '#e74c3c',
  mid: '#e67e22',
  warn: '#f1c40f',
  good: '#27ae60',
};

/** Texte sombre uniquement sur le jaune, pour le contraste. */
export const TIER_FG: Record<ScoreTier, string> = {
  bad: '#ffffff',
  mid: '#ffffff',
  warn: '#1b1b1b',
  good: '#ffffff',
};
