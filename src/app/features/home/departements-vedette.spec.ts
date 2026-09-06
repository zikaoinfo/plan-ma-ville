import { describe, expect, it } from 'vitest';
import type { DepartementSummary } from '../../core/models/data.models';
import { departementsVedette, NB_DEPARTEMENTS_VEDETTE } from './departements-vedette';

function dep(
  code: string,
  nom: string,
  population: number,
  nbCommunes = 10,
  noteMoyenne = 5,
): DepartementSummary {
  return { code, nom, nbCommunes, population, noteMoyenne };
}

describe('departementsVedette', () => {
  it('trie par population décroissante, pas par note ni par code', () => {
    const items = [
      dep('69', 'Rhône', 1_914_667, 266, 5.2),
      dep('75', 'Paris', 2_103_778, 1, 6.3),
      dep('48', 'Lozère', 76_000, 152, 7.9),
    ];
    expect(departementsVedette(items, 3).map((d) => d.code)).toEqual(['75', '69', '48']);
  });

  it('départage les populations égales par ordre alphabétique (tri stable)', () => {
    const items = [dep('02', 'Aisne', 500_000), dep('01', 'Ain', 500_000)];
    expect(departementsVedette(items, 2).map((d) => d.nom)).toEqual(['Ain', 'Aisne']);
  });

  it('coupe à la taille demandée', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      dep(String(i).padStart(2, '0'), `Dép ${i}`, 1000 - i),
    );
    expect(departementsVedette(items)).toHaveLength(NB_DEPARTEMENTS_VEDETTE);
    expect(departementsVedette(items, 3).map((d) => d.code)).toEqual(['00', '01', '02']);
  });

  it('ne modifie pas le tableau reçu', () => {
    const items = [dep('48', 'Lozère', 76_000), dep('75', 'Paris', 2_103_778)];
    departementsVedette(items);
    expect(items.map((d) => d.code)).toEqual(['48', '75']);
  });

  it('rend moins d’éléments que demandé plutôt que d’en inventer', () => {
    expect(departementsVedette([dep('75', 'Paris', 2_103_778)])).toHaveLength(1);
    expect(departementsVedette([])).toEqual([]);
  });
});
