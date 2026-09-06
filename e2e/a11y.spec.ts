import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PAGES } from './pages';
import { preferer } from './preferences';
import { ratio } from './contraste';

/**
 * Definition of Done §4 et §7 : ce qu'une machine peut vérifier sans mentir.
 * axe ne prouve pas « accessible » — il attrape les régressions mécaniques
 * (libellés manquants, ordre de titres, rôles cassés). Le parcours clavier
 * ci-dessous couvre le point que les linters ratent : l'anneau de focus.
 */

async function attendreRendu(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Les vues chargent leurs données via httpResource : on attend un contenu
  // réel plutôt qu'un squelette, sinon axe analyse une page vide.
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
}

for (const { nom, url } of PAGES) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe sans violation — ${nom} (${theme})`, async ({ page }) => {
      await preferer(page, theme, 'orange');
      await attendreRendu(page, url);

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Message lisible : sans ça un échec ne dit que « expected [] ».
      expect(
        violations.map((v) => `${v.id} (${v.nodes.length}) — ${v.help}`),
      ).toEqual([]);
    });
  }
}

test('le focus reste visible sur tout le parcours clavier de l’accueil', async ({
  page,
}) => {
  await preferer(page, 'light', 'orange');
  await attendreRendu(page, '/');

  // Les indicateurs de focus sont animés (0.15s) : sans neutraliser les
  // transitions, getComputedStyle lit une valeur intermédiaire et le test
  // devient instable.
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });

  const invisibles: string[] = [];
  let arrets = 0;

  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');

    const verdict = await page.evaluate(() => {
      const cible = document.activeElement as HTMLElement | null;
      if (!cible || cible === document.body || cible === document.documentElement) return null;

      // L'indicateur peut vivre sur l'élément (anneau) ou sur un ancêtre
      // (`:focus-within`, cas du champ de recherche). On photographie donc la
      // chaîne, on retire le focus, et on compare : si rien n'a changé
      // visuellement, l'utilisateur au clavier est perdu.
      const chaine: HTMLElement[] = [];
      for (let el: HTMLElement | null = cible, n = 0; el && n < 4; el = el.parentElement, n++) {
        chaine.push(el);
      }
      const photo = () =>
        chaine.map((el) => {
          const s = getComputedStyle(el);
          return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.transform].join('|');
        });

      const avec = photo();
      cible.blur();
      const sans = photo();
      cible.focus(); // on rend le focus pour que le Tab suivant reprenne au bon endroit

      const nom = `${cible.tagName.toLowerCase()}.${cible.className || '·'}`;
      const change = avec.some((v, k) => v !== sans[k]);
      const s = getComputedStyle(cible);
      const anneau =
        s.outlineStyle !== 'none' && s.outlineStyle !== 'hidden' && parseFloat(s.outlineWidth) >= 2;
      return { nom, change, anneau, couleurAnneau: s.outlineColor };
    });

    if (verdict === null) break; // le cycle est bouclé : plus rien de focusable
    arrets++;

    if (!verdict.change) {
      invisibles.push(`${verdict.nom} — aucun changement visuel au focus`);
      continue;
    }
    // Un anneau présent mais sans contraste ne se voit pas (crit. 1.4.11).
    if (verdict.anneau && verdict.couleurAnneau.startsWith('rgb')) {
      const contraste = ratio(verdict.couleurAnneau, '#fafbfc'); // --paper clair
      if (contraste < 3) {
        invisibles.push(`${verdict.nom} — anneau à ${contraste.toFixed(2)}:1 sur --paper`);
      }
    }
  }

  expect(arrets).toBeGreaterThan(5); // sinon le test ne prouve rien
  expect(invisibles).toEqual([]);
});

test('le lien d’évitement est le premier arrêt clavier et cible le contenu', async ({
  page,
}) => {
  await preferer(page, 'light', 'orange');
  await attendreRendu(page, '/');

  await page.keyboard.press('Tab');
  const lien = page.locator(':focus');
  await expect(lien).toHaveClass(/skip-link/);

  const cible = await lien.getAttribute('href');
  expect(cible).toBeTruthy();
  await expect(page.locator(cible as string)).toHaveCount(1);
});
