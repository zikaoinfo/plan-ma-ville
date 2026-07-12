import { describe, expect, it } from 'vitest';
import { linearNote, median, quantile, robustBounds, sortedValues } from '../src/score/scale.js';

describe('quantile', () => {
  it('renvoie les bornes et la médiane', () => {
    const s = [1, 2, 3, 4, 5];
    expect(quantile(s, 0)).toBe(1);
    expect(quantile(s, 1)).toBe(5);
    expect(quantile(s, 0.5)).toBe(3);
  });
});

describe('linearNote', () => {
  const b = { lo: 0, hi: 10 };
  it('mappe linéairement lo→0, hi→10', () => {
    expect(linearNote(0, b)).toBe(0);
    expect(linearNote(5, b)).toBe(5);
    expect(linearNote(10, b)).toBe(10);
  });
  it('borne les valeurs hors [lo,hi]', () => {
    expect(linearNote(20, b)).toBe(10);
    expect(linearNote(-5, b)).toBe(0);
  });
  it('inverse : valeur basse = meilleure note', () => {
    expect(linearNote(0, b, true)).toBe(10);
    expect(linearNote(10, b, true)).toBe(0);
  });
  it('renvoie 5 pour un critère dégénéré (hi ≤ lo)', () => {
    expect(linearNote(3, { lo: 4, hi: 4 })).toBe(5);
  });
});

describe('robustBounds', () => {
  it('ignore les valeurs extrêmes (2ᵉ/98ᵉ centiles)', () => {
    // 100 valeurs 1..100 : q02≈3, q98≈99 (les extrêmes 1-2 et 99-100 écartés).
    const s = sortedValues(Array.from({ length: 100 }, (_, i) => i + 1));
    const { lo, hi } = robustBounds(s);
    expect(lo).toBeGreaterThan(1);
    expect(hi).toBeLessThan(100);
  });
  it('replie sur min/max si les centiles sont confondus (données creuses)', () => {
    // 96 zéros + 4 valeurs : le 98ᵉ centile tombe dans les valeurs positives.
    const s = sortedValues([...Array(96).fill(0), 10, 20, 30, 40]);
    const { lo, hi } = robustBounds(s);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0);
    // Une commune « creuse » (0) obtient donc 0, pas une note élevée.
    expect(linearNote(0, { lo, hi })).toBe(0);
  });
});

describe('median', () => {
  it('impaire et paire', () => {
    expect(median([1, 3, 5, 7, 9])).toBe(5);
    expect(median([1, 3, 5, 7])).toBe(4);
  });
});
