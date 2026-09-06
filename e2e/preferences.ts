import type { Page } from '@playwright/test';

/** Mêmes clés que `core/services/theme.service.ts` et `accent.service.ts`. */
export const THEME_KEY = 'mvn-theme';
export const ACCENT_KEY = 'mvn-accent';

/**
 * Fixe thème et accent AVANT le premier script de la page : le marqueur
 * anti-flash d'`index.html` lit déjà localStorage, donc la page est peinte
 * directement dans la bonne combinaison — pas de repeinture à mi-test.
 */
export async function preferer(
  page: Page,
  theme: 'light' | 'dark',
  accent: 'orange' | 'jaune' | 'vert' | 'bleu',
): Promise<void> {
  await page.addInitScript(
    ([cleTheme, valTheme, cleAccent, valAccent]) => {
      localStorage.setItem(cleTheme, valTheme);
      localStorage.setItem(cleAccent, valAccent);
    },
    [THEME_KEY, theme, ACCENT_KEY, accent] as const,
  );
}
