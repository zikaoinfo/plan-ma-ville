import { describe, expect, it } from 'vitest';
import type { Demographie } from '../../core/models/data.models';
import {
  blocDemographie,
  LABELS_AGE,
  LABELS_CSP,
  series,
} from './commune-demographie';

const demo = (over: Partial<Demographie> = {}): Demographie => ({
  millesime: 2022,
  ages: [1200, 900, 1100, 1000, 800, 400, 60],
  hommes: 2650,
  femmes: 2810,
  csp: [20, 150, 600, 700, 650, 450, 900, 380],
  ...over,
});

describe('series', () => {
  /**
   * Deux échelles volontairement distinctes : `part` est le poids réel (ce
   * qu'on lit), `largeur` la proportion de la plus grande barre (ce qu'on
   * voit). Confondre les deux écraserait visuellement toutes les tranches dès
   * qu'une domine, ou ferait afficher un pourcentage faux.
   */
  it('calcule la part réelle et la largeur relative au maximum', () => {
    const s = series([50, 25, 25], ['a', 'b', 'c']);
    expect(s.map((x) => x.part)).toEqual([50, 25, 25]);
    expect(s.map((x) => x.largeur)).toEqual([100, 50, 50]);
  });

  it('arrondit la part à une décimale', () => {
    expect(series([1, 2], ['a', 'b'])[0].part).toBe(33.3);
  });

  it('ne divise pas par zéro sur une série vide ou nulle', () => {
    expect(series([], [])).toEqual([]);
    expect(series([0, 0], ['a', 'b']).map((x) => x.part)).toEqual([0, 0]);
    expect(series([0, 0], ['a', 'b']).map((x) => x.largeur)).toEqual([0, 0]);
  });

  it('associe chaque valeur à son libellé', () => {
    expect(series([1, 2], ['x', 'y']).map((s) => s.label)).toEqual(['x', 'y']);
  });
});

describe('blocDemographie', () => {
  it('prépare pyramide, sexes et CSP', () => {
    const b = blocDemographie(demo())!;
    expect(b.millesime).toBe(2022);
    expect(b.total).toBe(5460);
    expect(b.ages).toHaveLength(LABELS_AGE.length);
    expect(b.ages[0]).toMatchObject({ label: '0 à 14 ans', effectif: 1200 });
    expect(b.csp).toHaveLength(LABELS_CSP.length);
    expect(b.sexes).toMatchObject({ hommes: 2650, femmes: 2810 });
    expect((b.sexes?.partHommes ?? 0) + (b.sexes?.partFemmes ?? 0)).toBeCloseTo(100, 1);
  });

  it('omet la répartition par sexe si elle n’est pas publiée', () => {
    expect(blocDemographie(demo({ hommes: undefined }))?.sexes).toBeNull();
    expect(blocDemographie(demo({ femmes: undefined }))?.sexes).toBeNull();
  });

  it('omet les CSP sous secret statistique sans perdre la pyramide', () => {
    const b = blocDemographie(demo({ csp: undefined }))!;
    expect(b.csp).toBeNull();
    expect(b.ages).toHaveLength(7);
  });

  /**
   * Sans données, on n'affiche RIEN : une pyramide de zéros se lirait comme
   * une commune sans habitants.
   */
  it('renvoie null sans démographie exploitable', () => {
    expect(blocDemographie(undefined)).toBeNull();
    expect(blocDemographie(demo({ ages: [] }))).toBeNull();
    expect(blocDemographie(demo({ ages: [0, 0, 0, 0, 0, 0, 0] }))).toBeNull();
  });

  it('a autant de libellés que de séries INSEE', () => {
    expect(LABELS_AGE).toHaveLength(7);
    expect(LABELS_CSP).toHaveLength(8);
  });
});
