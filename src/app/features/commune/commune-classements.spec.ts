import { describe, expect, it } from 'vitest';
import type { Classements, CommuneDetail, Critere } from '../../core/models/data.models';
import {
  libelleStrate,
  lignesClassement,
  percentile,
  rangTexte,
  STRATES_LABELS,
} from './commune-classements';

const commune = (classements?: Classements): CommuneDetail => ({
  slug: 'testville-99999',
  nom: 'Testville',
  codeInsee: '99999',
  codesPostaux: ['99000'],
  population: 30000,
  score: {
    source: 'computed',
    global: 6.6,
    criteres: {
      securite: 6,
      sante: 7,
      commerces: 5,
      enseignement: 6,
      sports: 5,
      culture: 4,
      transports: 6,
      niveauVie: 7,
    } as Record<Critere, number>,
  },
  ...(classements ? { classements } : {}),
});

const rangs: Classements = {
  national: 104,
  nationalTotal: 34920,
  departement: 5,
  departementTotal: 47,
  strate: 34,
  strateTotal: 512,
  strateIndex: 5,
};

describe('rangTexte', () => {
  it('accorde le premier rang au féminin', () => {
    expect(rangTexte(1)).toBe('1ʳᵉ');
    expect(rangTexte(2)).toBe('2ᵉ');
    expect(rangTexte(104)).toBe('104ᵉ');
  });

  it('sépare les milliers à la française', () => {
    expect(rangTexte(1234)).toMatch(/^1\s234ᵉ$/u);
  });
});

describe('percentile', () => {
  it('donne 100 au premier et 0 au dernier', () => {
    expect(percentile(1, 500)).toBe(100);
    expect(percentile(500, 500)).toBe(0);
  });

  it('situe correctement un rang intermédiaire', () => {
    expect(percentile(51, 101)).toBe(50);
  });

  /**
   * 104ᵉ sur 34 920, c'est 99,7 % — un arrondi au plus proche afficherait
   * « 100 % », soit qu'aucune commune ne fait mieux. Faux, et vérifiable
   * d'un coup d'œil au rang affiché juste à côté.
   */
  it('arrondit vers le bas et ne surestime jamais le classement', () => {
    expect(percentile(104, 34920)).toBe(99);
    expect(percentile(2, 1000)).toBe(99);
    expect(percentile(34, 512)).toBe(93);
  });

  it('ne divise pas par zéro sur un groupe d’une seule commune', () => {
    expect(percentile(1, 1)).toBe(100);
    expect(percentile(1, 0)).toBe(100);
  });
});

describe('libelleStrate', () => {
  it('couvre les neuf strates du pipeline', () => {
    expect(STRATES_LABELS).toHaveLength(9);
    expect(libelleStrate(0)).toBe('de moins de 500 habitants');
    expect(libelleStrate(8)).toBe('de plus de 200 000 habitants');
  });

  /**
   * Les libellés se lisent après « Parmi les communes … » : chacun doit
   * commencer par « de », sinon la phrase produit « communes de de 500 à … »
   * ou « communes moins de 500 … ».
   */
  it('se compose grammaticalement avec « Parmi les communes »', () => {
    for (const label of STRATES_LABELS) {
      expect(`Parmi les communes ${label}`).toMatch(
        /^Parmi les communes de (moins de |plus de )?\d/u,
      );
    }
  });

  it('renvoie une chaîne vide hors bornes plutôt qu’undefined', () => {
    expect(libelleStrate(99)).toBe('');
    expect(libelleStrate(-1)).toBe('');
  });
});

describe('lignesClassement', () => {
  it('produit les trois lignes attendues', () => {
    const lignes = lignesClassement(commune(rangs), 'Val-de-Marne');
    expect(lignes?.map((l) => l.libelle)).toEqual([
      'En France',
      'Dans son département (Val-de-Marne)',
      'Parmi les communes de 20 000 à 50 000 habitants',
    ]);
    expect(lignes?.[0]).toMatchObject({ rang: 104, total: 34920, rangTexte: '104ᵉ' });
    expect(lignes?.[2]).toMatchObject({ rang: 34, total: 512 });
  });

  it('calcule le percentile de chaque ligne sur son propre groupe', () => {
    const lignes = lignesClassement(commune(rangs), 'Val-de-Marne') ?? [];
    expect(lignes.map((l) => l.percentile)).toEqual([99, 91, 93]);
  });

  it('masque la ligne strate quand la commune y est seule', () => {
    const lignes = lignesClassement(
      commune({ ...rangs, strate: 1, strateTotal: 1 }),
      'Val-de-Marne',
    );
    expect(lignes).toHaveLength(2);
    expect(lignes?.some((l) => l.libelle.startsWith('Parmi'))).toBe(false);
  });

  /**
   * Sans le champ, on n'affiche RIEN plutôt qu'un rang recalculé côté client :
   * il contredirait celui de la prose et de la FAQ.
   */
  it('renvoie null quand les données ne portent pas les classements', () => {
    expect(lignesClassement(commune(), 'Val-de-Marne')).toBeNull();
  });
});
