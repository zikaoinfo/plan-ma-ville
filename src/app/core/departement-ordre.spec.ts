import { describe, expect, it } from 'vitest';
import { comparerDepartements, ordreDepartement } from './departement-ordre';

describe('ordre des départements', () => {
  it('place la Corse à l’emplacement de l’ancien 20, entre 19 et 21', () => {
    const codes = ['21', '03', '2B', '01', '19', '2A', '02'];
    expect(codes.sort(comparerDepartements)).toEqual(['01', '02', '03', '19', '2A', '2B', '21']);
  });

  it('place les DROM après la métropole', () => {
    expect(['974', '95', '971', '01'].sort(comparerDepartements)).toEqual([
      '01',
      '95',
      '971',
      '974',
    ]);
  });

  it('ne perd pas un code inattendu : il part en fin de liste', () => {
    expect(['ZZ', '01'].sort(comparerDepartements)).toEqual(['01', 'ZZ']);
    expect(ordreDepartement('ZZ')).toBe(Number.POSITIVE_INFINITY);
  });
});
