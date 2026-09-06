import { expect, test } from '@playwright/test';
import { PAGES } from './pages';
import { preferer } from './preferences';

/**
 * Definition of Done §3 : ~360px, ~920px et > 1080px. Les largeurs viennent
 * des projets de `playwright.config.ts`, donc chaque test tourne trois fois.
 *
 * On mesure le DOM plutôt qu'une capture : « rien ne déborde » est une
 * assertion numérique (scrollWidth vs clientWidth), pas un jugement à l'œil.
 */

for (const { nom, url } of PAGES) {
  test(`aucun débordement horizontal — ${nom}`, async ({ page }) => {
    await preferer(page, 'light', 'orange');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.skeleton')).toHaveCount(0);

    const debordement = await page.evaluate(() => {
      const racine = document.documentElement;
      // 1px de marge : les sous-pixels d'arrondi ne sont pas un bug.
      if (racine.scrollWidth <= racine.clientWidth + 1) return null;

      // Nommer le coupable, sinon l'échec n'est pas actionnable.
      const coupables: string[] = [];
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        // Élément entièrement hors écran à gauche : technique du lien
        // d'évitement, ça n'élargit pas le document.
        if (r.right <= 0) continue;
        if (r.right > racine.clientWidth + 1) {
          const s = getComputedStyle(el);
          // Un conteneur qui scrolle lui-même est le remède, pas le problème.
          if (s.overflowX === 'auto' || s.overflowX === 'scroll') continue;
          coupables.push(
            `${el.tagName.toLowerCase()}.${el.className || '·'} [${Math.round(r.left)}→${Math.round(r.right)}]`,
          );
        }
      }
      return {
        scrollWidth: racine.scrollWidth,
        clientWidth: racine.clientWidth,
        coupables: coupables.slice(0, 5),
      };
    });

    expect(debordement).toBeNull();
  });
}

test('la navigation bascule en menu compact sous 920px', async ({ page }, infos) => {
  await preferer(page, 'light', 'orange');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main h1')).toBeVisible();

  const largeur = page.viewportSize()?.width ?? 0;
  const burger = page.locator('button[aria-controls="site-nav"]');
  const compact = largeur <= 920; // la media query est `max-width: 920px`

  expect(
    await burger.isVisible(),
    `${infos.project.name} : burger attendu ${compact ? 'visible' : 'masqué'}`,
  ).toBe(compact);
});
