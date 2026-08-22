import { describe, expect, it } from 'vitest';
import {
  agregeSegments,
  calculeDeltas,
  doitAlerter,
  formateResume,
  tauxSegment,
  variation,
} from '../resume.mjs';

const mesure = (over = {}) => ({
  date: '2026-08-22',
  periode_debut: '2026-08-13',
  periode_fin: '2026-08-19',
  impressions: 2000,
  clics: 40,
  ctr: 0.02,
  position_moyenne: 28.4,
  pages_indexees_estimees: 20000,
  taux_indexation: 0.57,
  urls_total: 35000,
  segments: [],
  top_requetes: [],
  ...over,
});

describe('variation', () => {
  it('calcule une variation relative en %', () => {
    expect(variation(110, 100)).toBeCloseTo(10);
    expect(variation(90, 100)).toBeCloseTo(-10);
  });

  it('refuse de comparer à une référence absente ou nulle', () => {
    expect(variation(100, 0)).toBeNull();
    expect(variation(100, null)).toBeNull();
    expect(variation(null, 100)).toBeNull();
  });
});

describe('calculeDeltas', () => {
  it("n'invente aucune tendance à la première mesure", () => {
    expect(calculeDeltas(mesure(), null)).toEqual({
      impressions: null,
      clics: null,
      pagesIndexees: null,
      tauxIndexation: null,
    });
  });

  it('compare chaque métrique à la mesure précédente', () => {
    const d = calculeDeltas(
      mesure({ impressions: 1500, pages_indexees_estimees: 18000 }),
      mesure(),
    );
    expect(d.impressions).toBeCloseTo(-25);
    expect(d.pagesIndexees).toBeCloseTo(-10);
  });
});

describe('doitAlerter', () => {
  /**
   * Le scénario qui a motivé ce script : les pages indexées reculent semaine
   * après semaine sans que personne ne le voie.
   */
  it('alerte au-delà de -5 % de pages indexées', () => {
    const { alerte, raison } = doitAlerter(
      mesure({ pages_indexees_estimees: 18000 }),
      mesure({ pages_indexees_estimees: 20000 }),
    );
    expect(alerte).toBe(true);
    expect(raison).toContain('10,0 %');
    expect(raison).toMatch(/20\s000/u);
    expect(raison).toMatch(/18\s000/u);
  });

  it("n'alerte pas sur une baisse mineure ni sur une hausse", () => {
    expect(doitAlerter(mesure({ pages_indexees_estimees: 19600 }), mesure()).alerte).toBe(false);
    expect(doitAlerter(mesure({ pages_indexees_estimees: 25000 }), mesure()).alerte).toBe(false);
  });

  it("n'alerte jamais à la première mesure", () => {
    expect(doitAlerter(mesure(), null).alerte).toBe(false);
  });

  it("n'alerte pas sur une chute d'impressions seule (trop bruitée)", () => {
    const { alerte } = doitAlerter(mesure({ impressions: 200 }), mesure({ impressions: 2400 }));
    expect(alerte).toBe(false);
  });

  it('respecte un seuil personnalisé', () => {
    expect(doitAlerter(mesure({ pages_indexees_estimees: 19400 }), mesure(), 2).alerte).toBe(true);
  });
});

describe('tauxSegment', () => {
  it('calcule le taux sur les verdicts exploitables', () => {
    expect(tauxSegment([true, true, false, true])).toEqual({
      echantillon: 4,
      indexees: 3,
      taux: 0.75,
    });
  });

  /**
   * Une inspection en échec (quota, erreur réseau) n'est PAS une page non
   * indexée : la compter comme telle produirait une fausse alerte.
   */
  it('exclut les inspections en échec du dénominateur', () => {
    expect(tauxSegment([true, null, null, false])).toEqual({
      echantillon: 2,
      indexees: 1,
      taux: 0.5,
    });
  });

  it('reste neutre si aucune inspection n’a abouti', () => {
    expect(tauxSegment([null, null])).toEqual({ echantillon: 0, indexees: 0, taux: 0 });
    expect(tauxSegment([])).toEqual({ echantillon: 0, indexees: 0, taux: 0 });
  });
});

describe('agregeSegments', () => {
  it('extrapole les pages indexées en pondérant par la taille du segment', () => {
    const r = agregeSegments([
      { nom: 'grandes', urls_total: 1000, echantillon: 40, indexees: 38, taux: 0.95 },
      { nom: 'communes', urls_total: 30000, echantillon: 40, indexees: 20, taux: 0.5 },
    ]);
    expect(r.urls_total).toBe(31000);
    expect(r.pages_indexees_estimees).toBe(15950); // 950 + 15 000
    expect(r.taux_indexation).toBeCloseTo(15950 / 31000, 5);
  });

  it('ne divise pas par zéro sans segment', () => {
    expect(agregeSegments([])).toEqual({
      urls_total: 0,
      pages_indexees_estimees: 0,
      taux_indexation: 0,
    });
  });
});

describe('formateResume', () => {
  const complet = mesure({
    segments: [{ nom: 'sitemap-communes.xml', urls_total: 28000, echantillon: 40, indexees: 12, taux: 0.3 }],
    top_requetes: [
      { requete: 'vivre à lyon', impressions: 500, clics: 12, ctr: 0.024, position: 8.2 },
    ],
  });

  it('affiche les deltas quand une mesure précédente existe', () => {
    const txt = formateResume(complet, mesure({ pages_indexees_estimees: 25000 }));
    expect(txt).toMatch(/Pages indexées \(estimées\) : 20\s000/u);
    expect(txt).toContain('-20,0 %');
  });

  it('signale explicitement la première mesure au lieu de deltas vides', () => {
    const txt = formateResume(complet, null);
    expect(txt).toContain('Première mesure');
    expect(txt).not.toContain('vs mesure précédente');
  });

  it('détaille les segments et les requêtes', () => {
    const txt = formateResume(complet, null);
    expect(txt).toMatch(
      /sitemap-communes\.xml — 30 % \(12\/40 URLs échantillonnées sur 28\s000\)/u,
    );
    expect(txt).toContain('vivre à lyon');
  });

  it("fait ressortir l'alerte dans le résumé", () => {
    const txt = formateResume(complet, mesure({ pages_indexees_estimees: 25000 }));
    expect(txt).toContain('🚨 ALERTE');
  });
});
