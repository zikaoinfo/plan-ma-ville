import { describe, expect, it } from 'vitest';
import type { Critere } from '../src/models.js';
import { CRITERES } from '../src/models.js';
import { noteGlobale } from '../src/score/aggregate.js';

function notesUniformes(valeurs: number[]): Record<Critere, number> {
  const notes = {} as Record<Critere, number>;
  CRITERES.forEach((critere, i) => (notes[critere] = valeurs[i]));
  return notes;
}

function poidsUniformes(poids: number): Record<Critere, number> {
  return notesUniformes(CRITERES.map(() => poids));
}

describe('noteGlobale', () => {
  it('poids uniformes → moyenne simple', () => {
    const notes = notesUniformes([2, 4, 6, 8, 10, 1, 3, 6]);
    const moyenne = (2 + 4 + 6 + 8 + 10 + 1 + 3 + 6) / 8;
    expect(noteGlobale(notes, poidsUniformes(1))).toBe(Math.round(moyenne * 10) / 10);
  });

  it('throw si un poids est nul', () => {
    const poids = poidsUniformes(1);
    poids.culture = 0;
    expect(() => noteGlobale(notesUniformes(CRITERES.map(() => 5)), poids)).toThrow(/culture/);
  });

  it('throw si un poids est négatif', () => {
    const poids = poidsUniformes(1);
    poids.sante = -0.5;
    expect(() => noteGlobale(notesUniformes(CRITERES.map(() => 5)), poids)).toThrow(/sante/);
  });
});
