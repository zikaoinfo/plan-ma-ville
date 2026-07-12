import { describe, expect, it } from 'vitest';
import {
  aggregateRegions,
  DEPARTEMENT_REGION,
  REGIONS,
  type DepAggregat,
} from '../src/emit/regions.js';

/** Fabrique un agrégat département depuis (code, nom, note, population, nbCommunes). */
function dep(code: string, nom: string, note: number, pop: number, nbCommunes = 1): DepAggregat {
  return {
    summary: { code, nom, nbCommunes, noteMoyenne: note },
    popTotale: pop,
    sommeNotePonderee: note * pop,
  };
}

describe('mapping régions', () => {
  it('chaque code région pointé par un département existe dans REGIONS', () => {
    for (const codeRegion of Object.values(DEPARTEMENT_REGION)) {
      expect(REGIONS[codeRegion], `région ${codeRegion} manquante`).toBeDefined();
    }
  });

  it('couvre les 96 départements métropolitains + 5 DROM (101)', () => {
    expect(Object.keys(DEPARTEMENT_REGION)).toHaveLength(101);
  });

  it('rattache correctement quelques départements repères', () => {
    expect(DEPARTEMENT_REGION['69']).toBe('84'); // Rhône → Auvergne-Rhône-Alpes
    expect(DEPARTEMENT_REGION['75']).toBe('11'); // Paris → Île-de-France
    expect(DEPARTEMENT_REGION['2A']).toBe('94'); // Corse-du-Sud → Corse
    expect(DEPARTEMENT_REGION['974']).toBe('04'); // La Réunion
  });
});

describe('aggregateRegions', () => {
  it('regroupe les départements par région et pondère la note par population', () => {
    // Île-de-France : Paris (note 8, 100 hab) + Hauts-de-Seine (note 6, 300 hab)
    // → moyenne pondérée = (8·100 + 6·300) / 400 = 6.5
    const regions = aggregateRegions([
      dep('75', 'Paris', 8, 100, 2),
      dep('92', 'Hauts-de-Seine', 6, 300, 3),
    ]);
    expect(regions).toHaveLength(1);
    const idf = regions[0];
    expect(idf.code).toBe('11');
    expect(idf.nom).toBe('Île-de-France');
    expect(idf.nbDepartements).toBe(2);
    expect(idf.nbCommunes).toBe(5);
    expect(idf.noteMoyenne).toBe(6.5);
  });

  it('trie les régions et leurs départements par note décroissante', () => {
    const regions = aggregateRegions([
      dep('75', 'Paris', 5, 100),
      dep('92', 'Hauts-de-Seine', 9, 100), // IdF moyenne 7
      dep('69', 'Rhône', 8, 100), // ARA moyenne 8
    ]);
    expect(regions.map((r) => r.code)).toEqual(['84', '11']); // ARA (8) avant IdF (7)
    const idf = regions.find((r) => r.code === '11')!;
    expect(idf.departements.map((d) => d.code)).toEqual(['92', '75']); // 9 avant 5
  });

  it('ignore les départements hors périmètre régional (code inconnu)', () => {
    const regions = aggregateRegions([dep('999', 'Inconnu', 7, 100)]);
    expect(regions).toHaveLength(0);
  });
});
