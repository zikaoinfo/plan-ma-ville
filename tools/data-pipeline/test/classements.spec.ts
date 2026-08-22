import { describe, expect, it } from 'vitest';
import {
  calculeClassements,
  STRATES_LABELS,
  STRATES_POP,
  stratePopulation,
} from '../src/score/classements';

const c = (insee: string, pop: number, dep: string, global: number) => ({
  codeInsee: insee,
  slug: `c-${insee}`,
  population: pop,
  codeDepartement: dep,
  score: { global },
});

describe('stratePopulation', () => {
  it('range chaque population dans sa strate', () => {
    expect(stratePopulation(0)).toBe(0);
    expect(stratePopulation(499)).toBe(0);
    expect(stratePopulation(500)).toBe(1);
    expect(stratePopulation(1999)).toBe(1);
    expect(stratePopulation(2000)).toBe(2);
    expect(stratePopulation(9999)).toBe(3);
    expect(stratePopulation(10000)).toBe(4);
    expect(stratePopulation(49999)).toBe(5);
    expect(stratePopulation(50000)).toBe(6);
    expect(stratePopulation(199999)).toBe(7);
    expect(stratePopulation(2000000)).toBe(8);
  });

  it('a autant de libellés que de strates', () => {
    expect(STRATES_LABELS).toHaveLength(STRATES_POP.length + 1);
    expect(stratePopulation(Number.MAX_SAFE_INTEGER)).toBe(STRATES_LABELS.length - 1);
  });
});

describe('calculeClassements', () => {
  const communes = [
    c('001', 300, '69', 8.0), // strate 0
    c('002', 400, '69', 6.0), // strate 0
    c('003', 30000, '69', 7.0), // strate 5
    c('004', 30000, '75', 9.0), // strate 5
    c('005', 30000, '75', 5.0), // strate 5
  ];
  const r = calculeClassements(communes);

  it('classe au national sur l’ensemble des communes', () => {
    expect(r.get('004')).toMatchObject({ national: 1, nationalTotal: 5 });
    expect(r.get('001')).toMatchObject({ national: 2 });
    expect(r.get('003')).toMatchObject({ national: 3 });
    expect(r.get('005')).toMatchObject({ national: 5 });
  });

  it('classe dans le département, avec le bon total', () => {
    expect(r.get('001')).toMatchObject({ departement: 1, departementTotal: 3 });
    expect(r.get('003')).toMatchObject({ departement: 2, departementTotal: 3 });
    expect(r.get('004')).toMatchObject({ departement: 1, departementTotal: 2 });
  });

  /**
   * Le cœur de la fonctionnalité : une petite commune peut être en tête de sa
   * strate sans être bien placée au national, et réciproquement.
   */
  it('classe dans la strate de population, tous départements confondus', () => {
    expect(r.get('001')).toMatchObject({ strate: 1, strateTotal: 2, strateIndex: 0 });
    expect(r.get('002')).toMatchObject({ strate: 2, strateTotal: 2, strateIndex: 0 });
    // 004 (9,0) > 003 (7,0) > 005 (5,0) parmi les trois communes de 30 000 hab.
    expect(r.get('004')).toMatchObject({ strate: 1, strateTotal: 3, strateIndex: 5 });
    expect(r.get('003')).toMatchObject({ strate: 2, strateTotal: 3 });
    expect(r.get('005')).toMatchObject({ strate: 3, strateTotal: 3 });
  });

  it('donne un meilleur rang de strate que de national quand c’est mérité', () => {
    // 003 est 3ᵉ sur 5 au national mais 2ᵉ sur 3 dans sa strate.
    const x = r.get('003');
    expect(x?.strate).toBeLessThan(x?.national as number);
  });

  it('départage les ex æquo par slug (rangs distincts, totaux justes)', () => {
    const exaequo = [c('a', 1000, '69', 7), c('b', 1000, '69', 7), c('z', 1000, '69', 7)];
    const rr = calculeClassements(exaequo);
    expect([rr.get('a')?.national, rr.get('b')?.national, rr.get('z')?.national].sort()).toEqual([
      1, 2, 3,
    ]);
    // Stable : même entrée → même sortie (SSG déterministe).
    expect(calculeClassements(exaequo)).toEqual(rr);
  });

  it('gère une commune seule et une liste vide', () => {
    const seule = calculeClassements([c('x', 100, '01', 5)]);
    expect(seule.get('x')).toMatchObject({
      national: 1,
      nationalTotal: 1,
      departement: 1,
      departementTotal: 1,
      strate: 1,
      strateTotal: 1,
    });
    expect(calculeClassements([]).size).toBe(0);
  });

  it('classe un arrondissement selon SA population, pas celle de sa mère', () => {
    // Un arrondissement de 150 000 hab. appartient à la strate 7, même si sa
    // commune mère en compte 2 millions.
    const avecArr = [c('75056', 2100000, '75', 7), c('75115', 150000, '75', 8)];
    const rr = calculeClassements(avecArr);
    expect(rr.get('75056')?.strateIndex).toBe(8);
    expect(rr.get('75115')?.strateIndex).toBe(7);
    expect(rr.get('75115')).toMatchObject({ strate: 1, strateTotal: 1 });
  });
});
