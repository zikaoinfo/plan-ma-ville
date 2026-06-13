import { describe, expect, it } from 'vitest';
import type { CommuneDetail, Critere } from '../../core/models/data.models';
import { filterAndSortCommunes } from './sort-communes';

function commune(nom: string, population: number, global: number): CommuneDetail {
  const criteres = Object.fromEntries(
    (['securite', 'sante', 'commerces', 'enseignement', 'sports', 'culture', 'transports', 'niveauVie'] as Critere[]).map(
      (c) => [c, global],
    ),
  ) as Record<Critere, number>;
  return {
    slug: `${nom.toLowerCase()}-x`,
    nom,
    codeInsee: '00000',
    codesPostaux: [],
    population,
    score: { source: 'computed', global, criteres },
  };
}

const COMMUNES: CommuneDetail[] = [
  commune('Villeurbanne', 156928, 6.8),
  commune('Lyon', 522250, 6.2),
  commune('Caluire-et-Cuire', 43985, 4.9),
  commune('Albigny-sur-Saône', 3001, 6.5),
];

describe('filterAndSortCommunes', () => {
  it('trie par note globale décroissante', () => {
    const res = filterAndSortCommunes(COMMUNES, 'global', -1, '');
    expect(res.map((c) => c.nom)).toEqual([
      'Villeurbanne',
      'Albigny-sur-Saône',
      'Lyon',
      'Caluire-et-Cuire',
    ]);
  });

  it('inverse en ordre croissant', () => {
    const res = filterAndSortCommunes(COMMUNES, 'global', 1, '');
    expect(res[0].nom).toBe('Caluire-et-Cuire');
  });

  it('trie par population décroissante', () => {
    const res = filterAndSortCommunes(COMMUNES, 'population', -1, '');
    expect(res[0].nom).toBe('Lyon');
  });

  it('filtre par sous-chaîne normalisée ("vil" → Villeurbanne)', () => {
    const res = filterAndSortCommunes(COMMUNES, 'nom', 1, 'vil');
    expect(res.map((c) => c.nom)).toEqual(['Villeurbanne']);
  });

  it('le filtre est insensible aux accents ("saone" → Albigny-sur-Saône)', () => {
    const res = filterAndSortCommunes(COMMUNES, 'nom', 1, 'saone');
    expect(res.map((c) => c.nom)).toEqual(['Albigny-sur-Saône']);
  });

  it('ne mute pas le tableau source', () => {
    const copie = [...COMMUNES];
    filterAndSortCommunes(COMMUNES, 'population', 1, '');
    expect(COMMUNES).toEqual(copie);
  });
});
