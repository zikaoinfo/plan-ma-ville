import { describe, expect, it } from 'vitest';
import { CRITERES } from '../src/models.js';
import { fakeScores } from '../src/score/fake.js';

describe('fakeScores', () => {
  it('est stable : même code INSEE → mêmes 8 notes sur 2 appels', () => {
    const a = fakeScores('69123', 522_250);
    const b = fakeScores('69123', 522_250);
    expect(b).toEqual(a);
    expect(Object.keys(a)).toHaveLength(8);
  });

  it('produit des notes dans [2.0, 9.5] à 1 décimale', () => {
    for (const insee of ['75056', '13055', '2A004', '97411', '01001']) {
      const notes = fakeScores(insee, 5_000);
      for (const critere of CRITERES) {
        const note = notes[critere];
        expect(note).toBeGreaterThanOrEqual(2.0);
        expect(note).toBeLessThanOrEqual(9.5);
        expect(Math.round(note * 10) / 10).toBe(note);
      }
    }
  });

  it('applique le biais grandes villes sur transports, culture, commerces', () => {
    const petite = fakeScores('69123', 1_000);
    const grande = fakeScores('69123', 100_000);
    for (const critere of ['transports', 'culture', 'commerces'] as const) {
      expect(grande[critere]).toBe(Math.min(9.5, Math.round((petite[critere] + 0.5) * 10) / 10));
    }
    // les autres critères ne bougent pas
    expect(grande.securite).toBe(petite.securite);
    expect(grande.niveauVie).toBe(petite.niveauVie);
  });
});
