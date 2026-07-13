import { describe, expect, it } from 'vitest';
import type { CommuneDetail, Critere, GeoLightItem } from '../../core/models/data.models';
import { autourDe, introAutour, introPrix, introSecurite, topPrix, topSecurite } from './palmares-logic';

function commune(
  nom: string,
  pop: number,
  securite: number,
  global: number,
  m2?: number,
): CommuneDetail {
  const criteres = Object.fromEntries(
    ['securite', 'sante', 'commerces', 'enseignement', 'sports', 'culture', 'transports', 'niveauVie'].map(
      (c) => [c, c === 'securite' ? securite : 5],
    ),
  ) as Record<Critere, number>;
  return {
    slug: nom.toLowerCase(),
    nom,
    codeInsee: nom,
    codesPostaux: [],
    population: pop,
    score: { source: 'computed', global, criteres },
    ...(m2 ? { prix: { m2, periode: '2025-S2', histo: [{ p: '2025-S2', v: m2 }] } } : {}),
  };
}

const COMMUNES = [
  commune('Sure', 9000, 9.4, 6.0, 3200),
  commune('Moyenne', 5000, 6.0, 7.5, 2100),
  commune('Village', 800, 10, 8.0, 1500), // < 2000 hab → exclu
  commune('Chere', 12000, 8.0, 8.2, 6800),
  commune('SansDvf', 4000, 7.0, 5.5),
];

describe('topSecurite', () => {
  it('trie par note sécurité, exclut les < 2000 habitants', () => {
    const top = topSecurite(COMMUNES);
    expect(top.map((c) => c.nom)).toEqual(['Sure', 'Chere', 'SansDvf', 'Moyenne']);
  });

  it('respecte la limite', () => {
    expect(topSecurite(COMMUNES, 2)).toHaveLength(2);
  });
});

describe('topPrix', () => {
  it('trie par prix croissant, exclut sans DVF et < 2000 hab', () => {
    const top = topPrix(COMMUNES);
    expect(top.map((c) => c.nom)).toEqual(['Moyenne', 'Sure', 'Chere']);
  });
});

describe('autourDe', () => {
  const geo = (n: string, lat: number, lng: number, g: number, p = 5000): GeoLightItem => ({
    i: n, n, s: n.toLowerCase(), lat, lng, g, p,
  });
  const centre = geo('Lyon', 45.758, 4.8357, 6.2, 522000);
  const items = [
    centre,
    geo('Proche', 45.77, 4.88, 6.8), // ~4 km
    geo('Top', 45.7, 4.9, 8.5), // ~8 km
    geo('Loin', 46.5, 5.5, 9.9), // ~97 km → exclu
    geo('Hameau', 45.76, 4.85, 9.0, 900), // < 2000 hab → exclu
  ];

  it('filtre par rayon et population, trie par note décroissante', () => {
    const proches = autourDe(centre, items);
    expect(proches.map((p) => p.item.n)).toEqual(['Top', 'Proche']);
    expect(proches[0].distanceKm).toBeLessThan(20);
  });

  it("exclut la ville centre elle-même", () => {
    expect(autourDe(centre, items).some((p) => p.item.s === centre.s)).toBe(false);
  });
});

describe('intros', () => {
  it('sécurité : stats réelles, jamais de undefined', () => {
    const txt = introSecurite('Rhône', COMMUNES, topSecurite(COMMUNES));
    expect(txt).toContain('Sure');
    expect(txt).toContain('9,4/10');
    expect(txt).not.toContain('undefined');
  });

  it('prix : médiane départementale et meilleur prix', () => {
    const txt = introPrix('Rhône', COMMUNES, topPrix(COMMUNES));
    expect(txt).toContain('Moyenne');
    expect(txt).toMatch(/2\s?100 €\/m²/);
  });

  it('prix : message honnête quand aucune couverture DVF', () => {
    const sans = [commune('A', 5000, 5, 5), commune('B', 3000, 5, 5)];
    expect(introPrix('Moselle', sans, topPrix(sans))).toContain('ne couvrent pas assez');
  });

  it('autour : cite la meilleure voisine', () => {
    const centre: GeoLightItem = { i: 'x', n: 'Lyon', s: 'lyon', lat: 45.758, lng: 4.8357, g: 6.2, p: 522000 };
    const proches = autourDe(centre, [
      centre,
      { i: 'y', n: 'Caluire', s: 'caluire', lat: 45.79, lng: 4.85, g: 7.4, p: 43000 },
    ]);
    expect(introAutour(centre, proches)).toContain('Caluire');
  });
});
