import { describe, expect, it } from 'vitest';
import {
  segmentsSitemap,
  urlsSitemap,
  xmlSitemapIndex,
  xmlUrlset,
  type PagesSitemap,
} from '../src/emit/index';

const pages: PagesSitemap = {
  codes: ['69', '2A'],
  regionCodes: ['84'],
  villes: [
    { slug: 'lyon-69123', population: 522250 }, // grande
    { slug: 'villeurbanne-69266', population: 156929 }, // grande
    { slug: 'givors-69091', population: 19500 }, // moyenne
    { slug: 'brindas-69027', population: 3200 }, // moyenne
    { slug: 'sainte-foy-l-argentiere-69207', population: 900 }, // petite
  ],
  autourSlugs: ['lyon-69123'],
};

const BASE = 'https://planmaville.fr';
const segments = segmentsSitemap(BASE, pages);
const parFichier = new Map(segments.map((s) => [s.fichier, s.urls]));

describe('segmentsSitemap', () => {
  it('produit un fichier par segment attendu', () => {
    expect([...parFichier.keys()].sort()).toEqual([
      'sitemap-communes.xml',
      'sitemap-grandes-villes.xml',
      'sitemap-hubs.xml',
      'sitemap-pages.xml',
      'sitemap-villes-moyennes.xml',
    ]);
  });

  it('range chaque commune dans le segment de sa taille', () => {
    const locs = (f: string) => (parFichier.get(f) ?? []).map((u) => u.loc);
    expect(locs('sitemap-grandes-villes.xml')).toEqual([
      `${BASE}/ville/lyon-69123/`,
      `${BASE}/ville/villeurbanne-69266/`,
    ]);
    expect(locs('sitemap-villes-moyennes.xml')).toEqual([
      `${BASE}/ville/givors-69091/`,
      `${BASE}/ville/brindas-69027/`,
    ]);
    expect(locs('sitemap-communes.xml')).toEqual([
      `${BASE}/ville/sainte-foy-l-argentiere-69207/`,
    ]);
  });

  it('différencie priorité et fréquence par segment', () => {
    const p = (f: string) => parFichier.get(f)?.[0];
    expect(p('sitemap-grandes-villes.xml')).toMatchObject({
      priority: '0.9',
      changefreq: 'weekly',
    });
    expect(p('sitemap-villes-moyennes.xml')).toMatchObject({
      priority: '0.6',
      changefreq: 'monthly',
    });
    expect(p('sitemap-communes.xml')).toMatchObject({ priority: '0.3', changefreq: 'monthly' });
    expect(p('sitemap-pages.xml')).toMatchObject({ priority: '1.0', changefreq: 'weekly' });
  });

  it("n'émet pas de segment vide (un sitemap sans URL est invalide)", () => {
    // Sans commune : plus de segment ville, mais les hubs palmarès par
    // département subsistent (ils ne dépendent que des codes département).
    const sansVilles = segmentsSitemap(BASE, { ...pages, villes: [], autourSlugs: [] });
    expect(sansVilles.map((s) => s.fichier)).toEqual(['sitemap-pages.xml', 'sitemap-hubs.xml']);

    // Sans rien du tout : seules les pages fixes restent.
    const vide = segmentsSitemap(BASE, {
      codes: [],
      regionCodes: [],
      villes: [],
      autourSlugs: [],
    });
    expect(vide.map((s) => s.fichier)).toEqual(['sitemap-pages.xml']);
    expect(vide.every((s) => s.urls.length > 0)).toBe(true);
  });

  it('scinde un segment au-delà du plafond de 45 000 URLs', () => {
    const beaucoup = Array.from({ length: 92_000 }, (_, i) => ({
      slug: `commune-${i}`,
      population: 100,
    }));
    const noms = segmentsSitemap(BASE, { ...pages, villes: beaucoup })
      .map((s) => s.fichier)
      .filter((f) => f.startsWith('sitemap-communes'));
    expect(noms).toEqual([
      'sitemap-communes-1.xml',
      'sitemap-communes-2.xml',
      'sitemap-communes-3.xml',
    ]);
  });
});

describe('urlsSitemap', () => {
  const urls = urlsSitemap(BASE, pages);

  /**
   * RÉGRESSION indexation : GitHub Pages sert le HTML prérendu
   * (`ville/{slug}/index.html`) UNIQUEMENT à l'URL avec slash final et répond
   * 301 sur la forme sans slash — une URL sans slash = un hit de crawl perdu.
   */
  it('termine TOUTES les URLs par un slash, sans jamais le doubler', () => {
    expect(urls.every((u) => u.endsWith('/'))).toBe(true);
    expect(urls.filter((u) => u.endsWith('//'))).toEqual([]);
    expect(urls).toContain(`${BASE}/`);
  });

  it('couvre chaque type de page et ne produit aucun doublon', () => {
    expect(urls).toContain(`${BASE}/classement/`);
    expect(urls).toContain(`${BASE}/regions/`);
    expect(urls).toContain(`${BASE}/methodologie/`);
    expect(urls).toContain(`${BASE}/region/84/`);
    expect(urls).toContain(`${BASE}/departement/2A/`);
    expect(urls).toContain(`${BASE}/palmares/securite/69/`);
    expect(urls).toContain(`${BASE}/palmares/prix/69/`);
    expect(urls).toContain(`${BASE}/palmares/autour/lyon-69123/`);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('reprend toutes les communes fournies, quelle que soit leur taille', () => {
    for (const v of pages.villes) expect(urls).toContain(`${BASE}/ville/${v.slug}/`);
  });

  it('tolère une base avec slash final', () => {
    expect(urlsSitemap(`${BASE}/`, pages)).toEqual(urls);
  });
});

describe('sérialisation XML', () => {
  it('émet un urlset valide avec lastmod, changefreq et priority', () => {
    const xml = xmlUrlset(parFichier.get('sitemap-pages.xml') ?? [], '2026-08-22');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(
      `<url><loc>${BASE}/</loc><lastmod>2026-08-22</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    );
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('émet un index pointant vers chaque segment', () => {
    const xml = xmlSitemapIndex(BASE, ['sitemap-pages.xml', 'sitemap-communes.xml'], '2026-08-22');
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${BASE}/sitemap-pages.xml</loc>`);
    expect(xml).toContain(`<loc>${BASE}/sitemap-communes.xml</loc>`);
    expect(xml).not.toContain('<urlset');
  });

  it('échappe les esperluettes (XML invalide sinon)', () => {
    const xml = xmlUrlset(
      [{ loc: `${BASE}/ville/a&b/`, priority: '0.5', changefreq: 'monthly' }],
      '2026-08-22',
    );
    expect(xml).toContain('a&amp;b');
    expect(xml).not.toMatch(/a&b/);
  });
});
