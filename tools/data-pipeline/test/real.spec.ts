import { describe, expect, it } from 'vitest';
import { CRITERES } from '../src/models.js';
import { computeRealScores, type DataMaps } from '../src/score/real.js';
import type { BpeCounts } from '../src/fetch/bpe.js';

function counts(partial: Partial<BpeCounts>): BpeCounts {
  return {
    sante: 0,
    commerces: 0,
    enseignement: 0,
    sports: 0,
    culture: 0,
    transports: 0,
    ...partial,
  };
}

const communes = [
  { codeInsee: 'A', population: 1000 }, // bien équipée, sûre, aisée
  { codeInsee: 'B', population: 1000 }, // peu équipée, plus de délinquance, modeste
  { codeInsee: 'C', population: 1000 }, // sans données sécurité ni revenu
];

const maps: DataMaps = {
  bpe: new Map([
    ['A', counts({ transports: 50, sante: 20, commerces: 40, culture: 10 })],
    ['B', counts({ transports: 1, sante: 1, commerces: 2 })],
    ['C', counts({ transports: 10, sante: 5, commerces: 10 })],
  ]),
  securite: new Map([
    ['A', 5],
    ['B', 100],
  ]),
  filosofi: new Map([
    ['A', 30_000],
    ['B', 15_000],
  ]),
};

describe('computeRealScores', () => {
  const scores = computeRealScores(communes, maps);

  it('note les 8 critères de chaque commune dans [0,10] à 1 décimale', () => {
    for (const c of communes) {
      const notes = scores.get(c.codeInsee)!;
      expect(Object.keys(notes)).toHaveLength(8);
      for (const critere of CRITERES) {
        const n = notes[critere];
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(10);
        expect(Math.round(n * 10) / 10).toBe(n);
      }
    }
  });

  it('classe la mieux équipée au-dessus (densité → percentile)', () => {
    expect(scores.get('A')!.transports).toBeGreaterThan(scores.get('B')!.transports);
    expect(scores.get('A')!.commerces).toBeGreaterThan(scores.get('B')!.commerces);
  });

  it('inverse la sécurité : moins de délinquance = meilleure note', () => {
    expect(scores.get('A')!.securite).toBeGreaterThan(scores.get('B')!.securite);
  });

  it('reflète le niveau de vie', () => {
    expect(scores.get('A')!.niveauVie).toBeGreaterThan(scores.get('B')!.niveauVie);
  });

  it('replie les communes sans donnée sur la médiane nationale (jamais 0)', () => {
    const c = scores.get('C')!;
    expect(c.securite).toBeGreaterThan(0);
    expect(c.niveauVie).toBeGreaterThan(0);
    // Repli = note de la médiane, entre les deux communes renseignées.
    expect(c.securite).toBeLessThanOrEqual(scores.get('A')!.securite);
    expect(c.securite).toBeGreaterThanOrEqual(scores.get('B')!.securite);
  });

  it('est déterministe : deux exécutions → notes identiques', () => {
    const a = computeRealScores(communes, maps);
    const b = computeRealScores(communes, maps);
    for (const c of communes) expect(b.get(c.codeInsee)).toEqual(a.get(c.codeInsee));
  });
});
