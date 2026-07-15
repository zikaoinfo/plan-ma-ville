import { describe, expect, it } from 'vitest';
import type { CommuneDetail, Critere } from '../../core/models/data.models';
import {
  dvfTrendPct,
  filtrerBassinVoisinage,
  haversineKm,
  nearestCommunes,
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

describe('dvfTrendPct', () => {
  it('compare au même semestre un an avant', () => {
    const histo = [
      { p: '2024-S1', v: 4000 },
      { p: '2024-S2', v: 4100 },
      { p: '2025-S1', v: 4200 },
    ];
    expect(dvfTrendPct(histo)).toBe(5); // 4200 vs 4000 (2024-S1)
  });

  it("replie sur l'avant-avant-dernière période si l'année N-1 manque", () => {
    const histo = [
      { p: '2023-S2', v: 4000 },
      { p: '2024-S2', v: 4100 },
      { p: '2025-S1', v: 4300 },
    ];
    // pas de 2024-S1 → référence = histo[length-3] = 2023-S2
    expect(dvfTrendPct(histo)).toBe(7.5);
  });

  it('historique trop court → null (pas de fausse tendance)', () => {
    expect(dvfTrendPct([])).toBeNull();
    expect(dvfTrendPct([{ p: '2025-S1', v: 4000 }])).toBeNull();
    // 2 points mais pas d'année N-1 comparable ni de 3ᵉ point
    expect(dvfTrendPct([{ p: '2025-S1', v: 4000 }, { p: '2025-S2', v: 4100 }])).toBeNull();
  });

  it('gère la baisse (signe négatif) et arrondit à 0.1', () => {
    const histo = [
      { p: '2024-S2', v: 4000 },
      { p: '2025-S2', v: 3868 },
    ];
    expect(dvfTrendPct(histo)).toBe(-3.3);
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

describe('filtrerBassinVoisinage', () => {
  const paris = {
    ...commune('paris-75056', '75056', 7, { lat: 48.8566, lon: 2.3522, population: 2100000 }),
    arrondissements: [{ slug: 'paris-1er-75101', nom: 'Paris 1er', codeInsee: '75101', population: 16000, score: { source: 'computed' as const, global: 8, criteres: lyon.score.criteres } }],
  };
  const paris1 = {
    ...commune('paris-1er-75101', '75101', 8, { lat: 48.8606, lon: 2.3376, population: 16000 }),
    communeMere: { slug: 'paris-75056', nom: 'Paris', codeInsee: '75056' },
  };
  const paris2 = {
    ...commune('paris-2e-75102', '75102', 7.5, { lat: 48.8686, lon: 2.3425, population: 20000 }),
    communeMere: { slug: 'paris-75056', nom: 'Paris', codeInsee: '75056' },
  };

  it('retire les arrondissements de la commune mère du bassin de voisinage de celle-ci', () => {
    const res = filtrerBassinVoisinage(paris, [paris, paris1, paris2, villeurbanne]);
    expect(res.map((c) => c.slug)).toEqual(['paris-75056', 'villeurbanne-69266']);
  });

  it("retire la commune mère du bassin de voisinage d'un arrondissement", () => {
    const res = filtrerBassinVoisinage(paris1, [paris, paris1, paris2, villeurbanne]);
    expect(res.map((c) => c.slug)).toEqual(['paris-1er-75101', 'paris-2e-75102', 'villeurbanne-69266']);
  });

  it("ne filtre rien pour une commune ordinaire sans lien de parenté", () => {
    expect(filtrerBassinVoisinage(lyon, [villeurbanne, caluire])).toEqual([villeurbanne, caluire]);
  });
});
