import { describe, expect, it } from 'vitest';
import { median, sortedValues, toPercentileNote } from '../src/score/percentile.js';

describe('toPercentileNote', () => {
  it('respecte la convention contractuelle (fraction ≤ valeur)', () => {
    expect(toPercentileNote(5, [1, 3, 5, 7, 9])).toBe(6);
  });

  it('note la valeur minimale > 0 et la maximale à 10', () => {
    const all = [1, 3, 5, 7, 9];
    expect(toPercentileNote(1, all)).toBe(2); // 1/5·10
    expect(toPercentileNote(9, all)).toBe(10); // 5/5·10
    expect(toPercentileNote(1, all)).toBeGreaterThan(0);
  });

  it('inverse : valeur basse = meilleure note (sécurité)', () => {
    const all = [1, 3, 5, 7, 9];
    expect(toPercentileNote(1, all, true)).toBe(10); // 5/5·10, la plus sûre
    expect(toPercentileNote(9, all, true)).toBe(2); // 1/5·10, la moins sûre
  });

  it('gère les ex æquo (toutes les valeurs égales à la valeur cherchée)', () => {
    expect(toPercentileNote(0, [0, 0, 0, 0])).toBe(10);
  });

  it('renvoie 5 pour une distribution vide (repli)', () => {
    expect(toPercentileNote(3, [])).toBe(5);
  });
});

describe('sortedValues / median', () => {
  it('trie une source non ordonnée', () => {
    expect(sortedValues([9, 1, 5, 3, 7])).toEqual([1, 3, 5, 7, 9]);
  });

  it('médiane impaire et paire', () => {
    expect(median([1, 3, 5, 7, 9])).toBe(5);
    expect(median([1, 3, 5, 7])).toBe(4);
    expect(median([])).toBe(0);
  });
});
