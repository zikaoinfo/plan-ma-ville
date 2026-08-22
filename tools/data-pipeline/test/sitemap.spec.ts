import { describe, expect, it } from 'vitest';
import { urlsSitemap } from '../src/emit/index';

const pages = {
  codes: ['69', '2A'],
  regionCodes: ['84'],
  villeSlugs: ['lyon-69123', 'annecy-74010'],
  autourSlugs: ['lyon-69123'],
};

describe('urlsSitemap', () => {
  const urls = urlsSitemap('https://planmaville.fr', pages);

  /**
   * RÉGRESSION indexation : GitHub Pages sert le HTML prérendu
   * (`ville/{slug}/index.html`) UNIQUEMENT à l'URL avec slash final et répond
   * 301 sur la forme sans slash. Un sitemap sans slash final = une
   * redirection par URL soumise, soit ~35 000 hits de crawl gaspillés.
   */
  it('termine TOUTES les URLs par un slash', () => {
    expect(urls.every((u) => u.endsWith('/'))).toBe(true);
  });

  it('ne double jamais le slash (racine incluse)', () => {
    expect(urls.filter((u) => /\/\/$/.test(u))).toEqual([]);
    expect(urls).toContain('https://planmaville.fr/');
  });

  it('couvre chaque type de page attendu', () => {
    expect(urls).toContain('https://planmaville.fr/classement/');
    expect(urls).toContain('https://planmaville.fr/regions/');
    expect(urls).toContain('https://planmaville.fr/methodologie/');
    expect(urls).toContain('https://planmaville.fr/region/84/');
    expect(urls).toContain('https://planmaville.fr/departement/2A/');
    expect(urls).toContain('https://planmaville.fr/palmares/securite/69/');
    expect(urls).toContain('https://planmaville.fr/palmares/prix/69/');
    expect(urls).toContain('https://planmaville.fr/palmares/autour/lyon-69123/');
    expect(urls).toContain('https://planmaville.fr/ville/annecy-74010/');
  });

  it('ne produit aucun doublon', () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('tolère une base avec slash final (pas de // dans les URLs)', () => {
    const avecSlash = urlsSitemap('https://planmaville.fr/', pages);
    expect(avecSlash).toEqual(urls);
  });
});
