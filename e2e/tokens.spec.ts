import { expect, test } from '@playwright/test';
import { ratio } from './contraste';

/**
 * Definition of Done §2 et §5 automatisées : les 2 thèmes × 4 accents, et
 * pour chaque combinaison tous les couples de tokens qui doivent tenir un
 * seuil WCAG. La boucle remplace l'inspection à l'œil, qui ne peut pas
 * couvrir 8 combinaisons à chaque modification.
 */

const THEMES = ['light', 'dark'] as const;
const ACCENTS = ['orange', 'jaune', 'vert', 'bleu'] as const;

/** [libellé, token de premier plan, token de fond, seuil]. */
const COUPLES: readonly [string, string, string, number][] = [
  ['encre / paper', '--ink', '--paper', 4.5],
  ['encre / paper-soft', '--ink', '--paper-soft', 4.5],
  ['encre / paper-raised', '--ink', '--paper-raised', 4.5],
  ['encre douce / paper', '--ink-soft', '--paper', 4.5],
  ['encre douce / paper-soft', '--ink-soft', '--paper-soft', 4.5],
  ['encre douce / paper-raised', '--ink-soft', '--paper-raised', 4.5],
  // Seuil 3:1 : élément d'interface non textuel (crit. 1.4.11).
  ['filet franc / paper', '--line-strong', '--paper', 3],
  ['filet franc / paper-soft', '--line-strong', '--paper-soft', 3],
  // L'accent sert d'anneau de focus sur le fond de page.
  ['accent / paper', '--accent', '--paper', 3],
  ['texte sur accent', '--on-accent', '--accent', 4.5],
  ['accent-text / paper', '--accent-text', '--paper', 4.5],
  ['accent-text / paper-soft', '--accent-text', '--paper-soft', 4.5],
  ['accent-text / paper-raised', '--accent-text', '--paper-raised', 4.5],
  ['good-text / paper', '--good-text', '--paper', 4.5],
  ['good-text / paper-raised', '--good-text', '--paper-raised', 4.5],
  // --bad est aussi une couleur de TEXTE (point faible du héros).
  ['bad / paper', '--bad', '--paper', 4.5],
  ['bad / paper-raised', '--bad', '--paper-raised', 4.5],
  ['texte sur bad', '--on-bad', '--bad', 4.5],
  // Skip-link et onglet actif : papier sur encre.
  ['paper / encre', '--paper', '--ink', 4.5],
  ['encre sur accent-soft', '--ink', '--accent-soft', 4.5],
  ['encre sur good-soft', '--ink', '--good-soft', 4.5],
  ['texte sur palier bas', '--on-tier-bad', '--tier-bad', 4.5],
  ['texte sur palier moyen', '--on-tier-mid', '--tier-mid', 4.5],
  ['texte sur palier moyen+', '--on-tier-warn', '--tier-warn', 4.5],
  ['texte sur palier haut', '--on-tier-good', '--tier-good', 4.5],
];

for (const theme of THEMES) {
  for (const accent of ACCENTS) {
    test(`contrastes des tokens — ${theme} / ${accent}`, async ({ page }) => {
      await page.goto('/');
      const valeurs = await page.evaluate(
        ({ theme, accent, noms }) => {
          const racine = document.documentElement;
          racine.setAttribute('data-theme', theme);
          racine.setAttribute('data-accent', accent);
          const style = getComputedStyle(racine);
          return Object.fromEntries(noms.map((n) => [n, style.getPropertyValue(n).trim()]));
        },
        { theme, accent, noms: [...new Set(COUPLES.flatMap(([, a, b]) => [a, b]))] },
      );

      const echecs: string[] = [];
      for (const [libelle, premierPlan, fond, seuil] of COUPLES) {
        const [fg, bg] = [valeurs[premierPlan], valeurs[fond]];
        expect(fg, `${premierPlan} non défini en ${theme}/${accent}`).toBeTruthy();
        expect(bg, `${fond} non défini en ${theme}/${accent}`).toBeTruthy();
        const r = ratio(fg, bg);
        if (r < seuil) {
          echecs.push(`${libelle} : ${r.toFixed(2)}:1 (min ${seuil}) — ${fg} sur ${bg}`);
        }
      }
      expect(echecs, `${theme}/${accent}\n  ${echecs.join('\n  ')}`).toEqual([]);
    });
  }
}

test('aucune couleur du thème ne reste non substituée', async ({ page }) => {
  // Un token qui pointe vers une variable inexistante se calcule en chaîne
  // vide ou en `var(...)` littéral : le test de contraste le manquerait en
  // levant une erreur peu lisible, celui-ci nomme le coupable.
  await page.goto('/');
  const suspects = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const noms = [
      '--paper', '--paper-soft', '--paper-raised', '--line', '--line-strong',
      '--ink', '--ink-soft', '--accent', '--accent-soft', '--accent-text',
      '--on-accent', '--good', '--good-soft', '--good-text', '--warn', '--bad',
      '--on-bad', '--tier-bad', '--tier-mid', '--tier-warn', '--tier-good',
    ];
    return noms.filter((n) => {
      const v = style.getPropertyValue(n).trim();
      return !v || v.includes('var(');
    });
  });
  expect(suspects).toEqual([]);
});
