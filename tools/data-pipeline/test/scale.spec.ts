import { describe, expect, it } from 'vitest';
import { median, rankNotes, sortedValues } from '../src/score/scale.js';

describe('rankNotes', () => {
  it('étale les valeurs distinctes de 0 (pire) à 10 (meilleur)', () => {
    expect(rankNotes([1, 2, 3, 4, 5])).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('inverse : la valeur la plus basse obtient la meilleure note', () => {
    expect(rankNotes([1, 2, 3, 4, 5], true)).toEqual([10, 7.5, 5, 2.5, 0]);
  });

  it('donne aux ex æquo à zéro une note MOYENNE (ni 0 ni ~10) et met le meilleur à 10', () => {
    const notes = rankNotes([0, 0, 0, 0, 10]);
    expect(notes[4]).toBe(10); // le seul équipé
    expect(notes[0]).toBeGreaterThan(2); // les « creux » ne sont pas à 0…
    expect(notes[0]).toBeLessThan(6); // …ni au sommet
    expect(new Set(notes.slice(0, 4)).size).toBe(1); // tous identiques
  });

  it('remet à l’échelle pour que la meilleure commune = 10 (cas inversé avec ex æquo)', () => {
    // 2 communes sûres (0) + 1 dangereuse (10) → sûres à 10, dangereuse à 0.
    expect(rankNotes([0, 0, 10], true)).toEqual([10, 10, 0]);
  });

  it('renvoie 10 pour une commune unique', () => {
    expect(rankNotes([42])).toEqual([10]);
  });
});

describe('sortedValues / median', () => {
  it('trie et calcule la médiane', () => {
    expect(sortedValues([9, 1, 5])).toEqual([1, 5, 9]);
    expect(median([1, 3, 5, 7, 9])).toBe(5);
    expect(median([1, 3, 5, 7])).toBe(4);
  });
});
