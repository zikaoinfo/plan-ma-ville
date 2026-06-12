import { CRITERES, type Critere } from '../models.js';

// PRNG de référence de la spec (docs/SPEC-DATA.md §4) — copié tel quel, ne pas modifier.
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOTE_MIN = 2.0;
const NOTE_MAX = 9.5;
const SEUIL_GRANDE_VILLE = 20_000;
const CRITERES_BIAISES: readonly Critere[] = ['transports', 'culture', 'commerces'];

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Notes factices déterministes : le code INSEE seed le PRNG, donc une même
 * commune obtient toujours les mêmes 8 notes, dans l'ordre canonique CRITERES.
 * Les communes de plus de 20 000 habitants gagnent +0.5 (plafonné à 9.5)
 * sur transports, culture et commerces.
 */
export function fakeScores(codeInsee: string, population: number): Record<Critere, number> {
  const rand = mulberry32(cyrb53(codeInsee));
  const notes = {} as Record<Critere, number>;

  for (const critere of CRITERES) {
    notes[critere] = round1(NOTE_MIN + rand() * (NOTE_MAX - NOTE_MIN));
  }

  if (population > SEUIL_GRANDE_VILLE) {
    for (const critere of CRITERES_BIAISES) {
      notes[critere] = Math.min(NOTE_MAX, round1(notes[critere] + 0.5));
    }
  }

  return notes;
}
