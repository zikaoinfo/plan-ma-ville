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
 *
 * `good` légèrement assombri (#1d8a63 → #1a7c59) : le vert d'origine ne
 * franchissait pas 4.5:1 en texte blanc (4.31:1, échec WCAG AA relevé par
 * l'audit Lighthouse) ; #1a7c59 atteint 5.16:1 tout en restant visuellement
 * le même vert de marque.
 */
export const TIER_BG: Record<ScoreTier, string> = {
  bad: '#c93a2e',
  mid: '#e67e22',
  warn: '#d9a514',
  good: '#1a7c59',
};

/**
 * Couleur de texte par palier — chacune vérifiée ≥ 4.5:1 (WCAG AA) sur son
 * fond ci-dessus. `mid` (orange) passe en texte sombre : en blanc le ratio
 * n'était que de 2.85:1 (échec relevé par Lighthouse sur `span.badge`).
 */
export const TIER_FG: Record<ScoreTier, string> = {
  bad: '#ffffff',
  mid: '#1a1a1a',
  warn: '#1b1b1b',
  good: '#ffffff',
};
