import { describe, expect, it } from 'vitest';
import { normaliseNom, slugify } from '../src/emit/index.js';

describe('normaliseNom', () => {
  it('retire accents, tirets et casse', () => {
    expect(normaliseNom('Saint-Étienne')).toBe('saint etienne');
  });

  it('gère apostrophes, tréma et y accentué', () => {
    expect(normaliseNom("L'Haÿ-les-Roses")).toBe('l hay les roses');
  });
});

describe('slugify', () => {
  it('produit des slugs uniques pour des communes homonymes', () => {
    const homonymes = [
      { nom: 'Saint-Denis', codeInsee: '93066' }, // Seine-Saint-Denis
      { nom: 'Saint-Denis', codeInsee: '97411' }, // La Réunion
      { nom: 'Saint-Denis', codeInsee: '11343' }, // Aude
      { nom: 'Saint-Denis', codeInsee: '30240' }, // Gard
    ];
    const slugs = homonymes.map((c) => slugify(c.nom, c.codeInsee));
    expect(new Set(slugs).size).toBe(homonymes.length);
    expect(slugs[0]).toBe('saint-denis-93066');
  });
});
