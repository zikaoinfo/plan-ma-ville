import { describe, expect, it } from 'vitest';
import {
  buildDemographieMap,
  detecteMillesime,
  LABELS_AGE,
  LABELS_CSP,
  TRANCHES_AGE,
} from '../src/fetch/demographie.js';

/** Ligne INSEE « dossier complet » réduite aux colonnes qui nous intéressent. */
function ligne(code: string, mil = '22', over: Record<string, string> = {}) {
  return {
    CODGEO: code,
    LIBGEO: 'Testville',
    [`P${mil}_POP0014`]: '1200',
    [`P${mil}_POP1529`]: '900',
    [`P${mil}_POP3044`]: '1100',
    [`P${mil}_POP4559`]: '1000',
    [`P${mil}_POP6074`]: '800',
    [`P${mil}_POP7589`]: '400',
    [`P${mil}_POP90P`]: '60',
    [`P${mil}_POPH`]: '2650',
    [`P${mil}_POPF`]: '2810',
    [`C${mil}_POP15P_CS1`]: '20',
    [`C${mil}_POP15P_CS2`]: '150',
    [`C${mil}_POP15P_CS3`]: '600',
    [`C${mil}_POP15P_CS4`]: '700',
    [`C${mil}_POP15P_CS5`]: '650',
    [`C${mil}_POP15P_CS6`]: '450',
    [`C${mil}_POP15P_CS7`]: '900',
    [`C${mil}_POP15P_CS8`]: '380',
    ...over,
  };
}

describe('detecteMillesime', () => {
  /**
   * L'INSEE suffixe chaque variable par le millésime du recensement : coder
   * `P22_` en dur ferait tomber la source en silence au millésime suivant.
   */
  it('lit le millésime dans les en-têtes', () => {
    expect(detecteMillesime(Object.keys(ligne('69123', '22')))).toBe('22');
    expect(detecteMillesime(Object.keys(ligne('69123', '21')))).toBe('21');
  });

  it('retient le millésime le plus récent quand plusieurs coexistent', () => {
    expect(detecteMillesime(['P16_POP0014', 'P22_POP0014', 'P21_POP0014'])).toBe('22');
  });

  it('renvoie undefined si aucune colonne de pyramide n’est reconnue', () => {
    expect(detecteMillesime(['CODGEO', 'LIBGEO'])).toBeUndefined();
  });
});

describe('buildDemographieMap', () => {
  it('extrait pyramide, sexes et CSP', () => {
    const m = buildDemographieMap([ligne('69123')]);
    const d = m.get('69123')!;
    expect(d.millesime).toBe(2022);
    expect(d.ages).toEqual([1200, 900, 1100, 1000, 800, 400, 60]);
    expect(d.ages).toHaveLength(TRANCHES_AGE.length);
    expect(d.hommes).toBe(2650);
    expect(d.femmes).toBe(2810);
    expect(d.csp).toEqual([20, 150, 600, 700, 650, 450, 900, 380]);
  });

  /** Les effectifs INSEE sont pondérés : ils arrivent avec des décimales. */
  it('arrondit les effectifs pondérés', () => {
    const m = buildDemographieMap([ligne('69123', '22', { P22_POP0014: '1234.5678' })]);
    expect(m.get('69123')!.ages[0]).toBe(1235);
  });

  it('accepte le format FR à virgule décimale', () => {
    const m = buildDemographieMap([ligne('69123', '22', { P22_POP0014: '1234,4' })]);
    expect(m.get('69123')!.ages[0]).toBe(1234);
  });

  /**
   * Une commune sans aucune donnée exploitable ne doit pas apparaître : mieux
   * vaut ne rien afficher qu'une pyramide de zéros, qui se lirait comme une
   * commune sans habitants.
   */
  it('écarte les communes dont la pyramide est entièrement absente', () => {
    const vide = Object.fromEntries(
      TRANCHES_AGE.map((t) => [`P22_POP${t}`, '']),
    ) as Record<string, string>;
    const m = buildDemographieMap([{ CODGEO: '99999', ...vide }]);
    expect(m.has('99999')).toBe(false);
  });

  it('omet les CSP sous secret statistique sans perdre la pyramide', () => {
    const sansCsp = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`C22_POP15P_CS${i + 1}`, '']),
    ) as Record<string, string>;
    const m = buildDemographieMap([ligne('69123', '22', sansCsp)]);
    const d = m.get('69123')!;
    expect(d.csp).toBeUndefined();
    expect(d.ages[0]).toBe(1200);
  });

  /**
   * Contrairement aux autres sources, PAS d'agrégation des arrondissements sur
   * la commune mère : l'INSEE publie déjà une ligne pour la mère et une par
   * arrondissement — sommer les secondes sur la première doublerait sa
   * population.
   */
  it('n’agrège pas les arrondissements sur leur commune mère', () => {
    const m = buildDemographieMap([
      ligne('75056', '22', { P22_POP0014: '300000' }),
      ligne('75115', '22', { P22_POP0014: '30000' }),
    ]);
    expect(m.get('75056')!.ages[0]).toBe(300000);
    expect(m.get('75115')!.ages[0]).toBe(30000);
  });

  it('lève une erreur explicite si les colonnes sont introuvables', () => {
    expect(() => buildDemographieMap([{ foo: '1', bar: '2' }])).toThrow(/colonnes code\/pyramide/);
  });

  it('tolère une source vide', () => {
    expect(buildDemographieMap([]).size).toBe(0);
  });

  it('a autant de libellés que de séries', () => {
    expect(LABELS_AGE).toHaveLength(TRANCHES_AGE.length);
    expect(LABELS_CSP).toHaveLength(8);
  });
});
