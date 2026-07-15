import { describe, expect, it } from 'vitest';
import { fmtEntier } from '../../core/format';
import type { CommuneDetail, Critere } from '../../core/models/data.models';
import { categorieTaille, genereTexteCommune, qualificatif } from './commune-texte';

function commune(
  nom: string,
  insee: string,
  global: number,
  pop = 12000,
  over: Partial<Record<Critere, number>> = {},
  prix?: CommuneDetail['prix'],
): CommuneDetail {
  const criteres = {
    securite: 6,
    sante: 7.2,
    commerces: 5.1,
    enseignement: 6.8,
    sports: 4.9,
    culture: 3.2,
    transports: 8.4,
    niveauVie: 7.9,
    ...over,
  } as Record<Critere, number>;
  return {
    slug: `${nom.toLowerCase()}-${insee}`,
    nom,
    codeInsee: insee,
    codesPostaux: ['94420'],
    population: pop,
    score: { source: 'computed', global, criteres },
    ...(prix ? { prix } : {}),
  };
}

const PRIX: CommuneDetail['prix'] = {
  m2: 5120,
  periode: '2025-S2',
  nb: 150,
  histo: [
    { p: '2024-S2', v: 4880 },
    { p: '2025-S1', v: 5000 },
    { p: '2025-S2', v: 5120 },
  ],
};

const A = commune('Alphaville', '94001', 7.8, 21000, {}, PRIX);
const B = commune('Betaville', '94002', 6.1, 4000, { transports: 2, securite: 9.1 });
const DEPS = [A, B, commune('Gammaville', '94003', 5.2, 800)];

describe('genereTexteCommune', () => {
  it('est déterministe (même entrée → même texte)', () => {
    expect(genereTexteCommune(A, DEPS, 'Val-de-Marne')).toEqual(
      genereTexteCommune(A, DEPS, 'Val-de-Marne'),
    );
  });

  it('résume : note, rang départemental, points forts, prix et population', () => {
    const t = genereTexteCommune(A, DEPS, 'Val-de-Marne');
    expect(t.resume).toContain('7,8/10');
    expect(t.resume).toContain('1ʳᵉ sur 3');
    expect(t.resume).toContain('transports'); // meilleur critère
    expect(t.resume).toContain('5 120 €/m²'.replace(' ', ' ')); // séparateur FR
    expect(t.resume).toContain('21');
    // ordre de grandeur d'une réponse directe : 35-90 mots
    const mots = t.resume.split(/\s+/).length;
    expect(mots).toBeGreaterThan(35);
    expect(mots).toBeLessThan(90);
  });

  it('4 sections avec titres h2 et aucune valeur manquante', () => {
    const t = genereTexteCommune(A, DEPS, 'Val-de-Marne');
    expect(t.sections).toHaveLength(4);
    const tout = t.resume + t.sections.map((s) => s.titre + s.texte).join(' ');
    expect(tout).not.toMatch(/undefined|NaN|null/);
  });

  it('varie les tournures entre communes (hash INSEE) mais reste factuel', () => {
    const tA = genereTexteCommune(A, DEPS, 'Val-de-Marne');
    const tB = genereTexteCommune(B, DEPS, 'Val-de-Marne');
    expect(tA.resume).not.toBe(tB.resume);
    // B : sécurité 9,1 = point fort, transports 2 = point faible
    expect(tB.sections[0].texte).toContain('transports (2,0/10)');
  });

  it('sans DVF : phrase honnête, pas de prix inventé', () => {
    const t = genereTexteCommune(B, DEPS, 'Val-de-Marne');
    const immo = t.sections.find((s) => s.titre.includes('Immobilier'))!;
    expect(immo.texte).toContain('Trop peu de ventes');
    expect(immo.texte).not.toContain('€/m²,');
  });

  it('avec DVF : prix, tendance et comparaison départementale', () => {
    const t = genereTexteCommune(A, DEPS, 'Val-de-Marne');
    const immo = t.sections.find((s) => s.titre.includes('Immobilier'))!;
    expect(immo.texte).toContain('5 120 €/m²'.replace(' ', ' '));
    expect(immo.texte).toMatch(/hausse de 4,9 ?%/);
  });

  it("ne compare jamais une commune à elle-même (seule commune de son groupe de référence → pas de comparaison)", () => {
    // A est la SEULE commune du groupe à avoir un prix DVF : sans exclusion
    // de soi-même, la « médiane départementale » serait égale à son propre
    // prix (comparaison factice). Avec l'exclusion, aucune médiane externe
    // n'est disponible → la phrase de comparaison ne doit pas apparaître.
    const t = genereTexteCommune(A, DEPS, 'Val-de-Marne');
    const immo = t.sections.find((s) => s.titre.includes('Immobilier'))!;
    expect(immo.texte).not.toContain('plus cher que la médiane');
    expect(immo.texte).not.toContain('moins cher que la médiane');
  });

  it('compare bien à une médiane départementale EXTERNE quand une autre commune a un prix DVF', () => {
    const autrePrix: CommuneDetail['prix'] = {
      m2: 3000,
      periode: '2025-S2',
      nb: 40,
      histo: [{ p: '2025-S2', v: 3000 }],
    };
    const C = commune('Deltaville', '94004', 5.5, 9000, {}, autrePrix);
    const deps = [A, B, C];
    const t = genereTexteCommune(A, deps, 'Val-de-Marne');
    const immo = t.sections.find((s) => s.titre.includes('Immobilier'))!;
    expect(immo.texte).toContain('plus cher que la médiane des communes du département');
    expect(immo.texte).toContain(`${fmtEntier(3000)} €/m²`);
  });

  it("pour une commune mère (Paris) : exclut ses propres arrondissements du groupe de comparaison", () => {
    const arrPrix: CommuneDetail['prix'] = {
      m2: 11000,
      periode: '2025-S2',
      nb: 10,
      histo: [{ p: '2025-S2', v: 11000 }],
    };
    const paris = {
      ...commune('Paris', '75056', 7, 2100000, {}, PRIX),
      arrondissements: [{ slug: 'paris-1er-75101', nom: 'Paris 1er', codeInsee: '75101', population: 16000, score: A.score }],
    };
    const paris1 = { ...commune('Paris 1er', '75101', 8, 16000, {}, arrPrix), communeMere: { slug: 'paris-75056', nom: 'Paris', codeInsee: '75056' } };
    const t = genereTexteCommune(paris, [paris, paris1], 'Paris');
    const immo = t.sections.find((s) => s.titre.includes('Immobilier'))!;
    // Le seul « autre » prix du groupe est celui de son propre arrondissement
    // (75101) : ne doit PAS servir de référence externe.
    expect(immo.texte).not.toContain('la médiane des communes du département');
  });
});

describe('qualificatif / categorieTaille', () => {
  it('borne les qualificatifs par seuils', () => {
    expect(qualificatif(9)).toBe('excellente');
    expect(qualificatif(7)).toBe('bonne');
    expect(qualificatif(5.5)).toBe('moyenne');
    expect(qualificatif(4)).toBe('en retrait');
    expect(qualificatif(2)).toBe('faible');
  });

  it('catégorise la taille', () => {
    expect(categorieTaille(500)).toBe('village');
    expect(categorieTaille(8000)).toBe('petite ville');
    expect(categorieTaille(60000)).toBe('ville moyenne');
    expect(categorieTaille(300000)).toBe('grande ville');
  });
});
