import { describe, expect, it } from 'vitest';
import type { SearchIndexItem } from '../models/data.models';
import { normaliseNom } from '../normalise';
import { searchItems } from './search-index.service';

function item(partial: Partial<SearchIndexItem> & Pick<SearchIndexItem, 'n' | 's' | 'cp'>): SearchIndexItem {
  return {
    n: partial.n,
    nn: partial.nn ?? normaliseNom(partial.n),
    cp: partial.cp,
    d: partial.d ?? partial.cp[0]?.slice(0, 2) ?? '',
    s: partial.s,
    i: partial.i ?? partial.s,
    p: partial.p ?? 1000,
    g: partial.g ?? 5,
  };
}

const ITEMS: SearchIndexItem[] = [
  item({ n: 'Lyon', s: 'lyon-69123', cp: ['69001', '69002', '69003'], d: '69', p: 522250, g: 6.2 }),
  item({ n: 'Lyonnais-le-Bois', s: 'lyonnais-le-bois-69999', cp: ['69280'], d: '69' }),
  item({ n: 'Villeurbanne', s: 'villeurbanne-69266', cp: ['69100'], d: '69' }),
  item({ n: 'Saint-Étienne', s: 'saint-etienne-42218', cp: ['42000', '42100'], d: '42' }),
  item({ n: 'Paris', s: 'paris-75056', cp: ['75001', '75002'], d: '75' }),
];

describe('normaliseNom', () => {
  it('retire accents, tirets et casse', () => {
    expect(normaliseNom('Saint-Étienne')).toBe('saint etienne');
  });

  it('gère apostrophe, tréma et y accentué', () => {
    expect(normaliseNom("L'Haÿ-les-Roses")).toBe('l hay les roses');
  });
});

describe('searchItems', () => {
  it('renvoie Lyon en premier pour "lyon" (match exact avant préfixe)', () => {
    const res = searchItems(ITEMS, 'lyon');
    expect(res[0].n).toBe('Lyon');
    expect(res.map((r) => r.n)).toContain('Lyonnais-le-Bois');
  });

  it('mode code postal : "69001" renvoie au moins Lyon', () => {
    const res = searchItems(ITEMS, '69001');
    expect(res.some((r) => r.s === 'lyon-69123')).toBe(true);
  });

  it('"69" déclenche le mode code postal (préfixe), pas le mode nom', () => {
    const res = searchItems(ITEMS, '69');
    // toutes les correspondances ont un CP qui commence par 69
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.cp.some((cp) => cp.startsWith('69')))).toBe(true);
    // un nom ne commençant pas par "69" mais du dép. 69 ne doit PAS venir d'un match nom
    expect(res.some((r) => r.n === 'Paris')).toBe(false);
  });

  it('"a" (< 2 caractères) renvoie []', () => {
    expect(searchItems(ITEMS, 'a')).toEqual([]);
  });

  it('chaîne vide renvoie []', () => {
    expect(searchItems(ITEMS, '')).toEqual([]);
  });

  it('limite à 10 résultats', () => {
    const many = Array.from({ length: 25 }, (_, k) =>
      item({ n: `Ville${k}`, s: `ville${k}`, cp: ['10000'], d: '10' }),
    );
    expect(searchItems(many, '10000')).toHaveLength(10);
  });
});
