import { describe, expect, it } from 'vitest';
import type { CommuneDetail, Critere } from '../../core/models/data.models';
import {
  estimatePriceM2,
  haversineKm,
  nearestCommunes,
  noteHistory,
} from './commune-insights';

function commune(
  slug: string,
  codeInsee: string,
  global: number,
  opts: { lat?: number; lon?: number; niveauVie?: number; population?: number } = {},
): CommuneDetail {
  const criteres = Object.fromEntries(
    (['securite', 'sante', 'commerces', 'enseignement', 'sports', 'culture', 'transports', 'niveauVie'] as Critere[]).map(
      (c) => [c, c === 'niveauVie' ? (opts.niveauVie ?? global) : global],
    ),
  ) as Record<Critere, number>;
  return {
    slug,
    nom: slug,
    codeInsee,
    codesPostaux: [],
    population: opts.population ?? 10000,
    lat: opts.lat,
    lon: opts.lon,
    score: { source: 'computed', global, criteres },
  };
}

const lyon = commune('lyon-69123', '69123', 6.2, { lat: 45.75801, lon: 4.83566, niveauVie: 6, population: 522250 });
const villeurbanne = commune('villeurbanne-69266', '69266', 6.8, { lat: 45.7733, lon: 4.8902 });
const caluire = commune('caluire-69034', '69034', 4.9, { lat: 45.7956, lon: 4.8467 });
const affoux = commune('affoux-69001', '69001', 5, { lat: 45.8856, lon: 4.4761 });

describe('estimatePriceM2', () => {
  it('est déterministe et borné', () => {
    const a = estimatePriceM2(lyon);
    const b = estimatePriceM2(lyon);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(900);
    expect(a).toBeLessThanOrEqual(12000);
  });

  it('croît avec le niveau de vie', () => {
    const pauvre = commune('a', '00001', 5, { niveauVie: 2, population: 10000 });
    const riche = commune('b', '00001', 5, { niveauVie: 9, population: 10000 });
    // même seed (codeInsee), seul niveauVie change → prix plus élevé
    expect(estimatePriceM2(riche)).toBeGreaterThan(estimatePriceM2(pauvre));
  });
});

describe('noteHistory', () => {
  it('se termine sur la note actuelle et couvre N années', () => {
    const h = noteHistory(lyon, 2026, 6);
    expect(h).toHaveLength(6);
    expect(h[h.length - 1]).toEqual({ year: 2026, note: 6.2 });
    expect(h[0].year).toBe(2021);
    expect(h.every((p) => p.note >= 0 && p.note <= 10)).toBe(true);
  });

  it('est déterministe', () => {
    expect(noteHistory(lyon, 2026)).toEqual(noteHistory(lyon, 2026));
  });
});

describe('haversineKm', () => {
  it('mesure ~4 km entre Lyon et Villeurbanne', () => {
    const d = haversineKm({ lat: 45.758, lon: 4.8357 }, { lat: 45.7733, lon: 4.8902 });
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(6);
  });
});

describe('nearestCommunes', () => {
  it('trie par distance et exclut la commune courante', () => {
    const res = nearestCommunes(lyon, [lyon, affoux, villeurbanne, caluire], 5);
    expect(res.map((v) => v.commune.slug)).toEqual([
      'caluire-69034',
      'villeurbanne-69266',
      'affoux-69001',
    ]);
    expect(res[0].distanceKm).toBeLessThan(res[2].distanceKm);
  });

  it('retourne [] si la commune courante n’a pas de coordonnées', () => {
    const sansCoord = commune('x', '00001', 5);
    expect(nearestCommunes(sansCoord, [villeurbanne, caluire])).toEqual([]);
  });

  it('respecte la limite', () => {
    expect(nearestCommunes(lyon, [villeurbanne, caluire, affoux], 2)).toHaveLength(2);
  });
});
