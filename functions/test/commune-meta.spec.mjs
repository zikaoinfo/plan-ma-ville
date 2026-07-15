import { describe, expect, it } from 'vitest';
import {
  buildCommuneMeta,
  findCommuneDetail,
  findIndexItem,
  injectMeta,
  notFoundMeta,
} from '../_lib/commune-meta.mjs';

const INDEX = {
  v: 1,
  gen: '2026-07-15',
  items: [
    { n: 'Samatan', nn: 'samatan', cp: ['32130'], d: '32', s: 'samatan-32410', i: '32410', p: 2200, g: 7.6 },
  ],
};

const DEP32 = {
  v: 1,
  gen: '2026-07-15',
  code: '32',
  nom: 'Gers',
  communes: [
    {
      slug: 'samatan-32410',
      nom: 'Samatan',
      codeInsee: '32410',
      codesPostaux: ['32130'],
      population: 2200,
      score: {
        source: 'computed',
        global: 7.6,
        criteres: {
          securite: 8,
          sante: 6,
          commerces: 7,
          enseignement: 7.5,
          sports: 7,
          culture: 6.5,
          transports: 5,
          niveauVie: 7.2,
        },
      },
    },
  ],
};

const SHELL_HTML = `<!doctype html><html lang="fr"><head>
  <meta charset="utf-8">
  <title>ma ville, notée — toutes les communes de France sur 10</title>
  <meta name="description" content="La note sur 10 de chaque commune française.">
</head><body><app-root></app-root></body></html>`;

describe('findIndexItem / findCommuneDetail', () => {
  it('trouve un slug existant', () => {
    expect(findIndexItem(INDEX, 'samatan-32410')?.n).toBe('Samatan');
    expect(findCommuneDetail(DEP32, 'samatan-32410')?.nom).toBe('Samatan');
  });

  it('renvoie null pour un slug absent', () => {
    expect(findIndexItem(INDEX, 'inconnu-00000')).toBeNull();
    expect(findCommuneDetail(DEP32, 'inconnu-00000')).toBeNull();
  });
});

describe('buildCommuneMeta', () => {
  it('reproduit le format title/description de commune.ts', () => {
    const item = findIndexItem(INDEX, 'samatan-32410');
    const detail = findCommuneDetail(DEP32, 'samatan-32410');
    const meta = buildCommuneMeta(item, detail);
    expect(meta.title).toBe('Samatan (32) — note 7.6/10 — ma ville, notée');
    expect(meta.description).toBe(
      'Samatan : note globale 7.6/10. Sécurité 8, santé 6, transports 5, niveau de vie 7.2.',
    );
    expect(meta.canonicalPath).toBe('/ville/samatan-32410');
    expect(meta.noindex).toBe(false);
  });
});

describe('notFoundMeta', () => {
  it('pose noindex pour un slug inconnu', () => {
    const meta = notFoundMeta('inconnu-00000');
    expect(meta.noindex).toBe(true);
    expect(meta.title).toContain('introuvable');
  });
});

describe('injectMeta', () => {
  it('remplace title/description et insère OG/canonique/twitter avant </head>', () => {
    const item = findIndexItem(INDEX, 'samatan-32410');
    const detail = findCommuneDetail(DEP32, 'samatan-32410');
    const meta = buildCommuneMeta(item, detail);
    const html = injectMeta(SHELL_HTML, meta, 'https://planmaville.fr');

    expect(html).toContain('<title>Samatan (32) — note 7.6/10 — ma ville, notée</title>');
    // Un seul <title> (HTML valide, pas de doublon).
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain(
      '<meta name="description" content="Samatan : note globale 7.6/10.',
    );
    expect(html).toContain('<meta property="og:title" content="Samatan (32) — note 7.6/10 — ma ville, notée">');
    expect(html).toContain('<meta property="og:url" content="https://planmaville.fr/ville/samatan-32410">');
    expect(html).toContain('<link rel="canonical" href="https://planmaville.fr/ville/samatan-32410">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).not.toContain('noindex');
  });

  it('pose noindex pour une commune introuvable', () => {
    const meta = notFoundMeta('inconnu-00000');
    const html = injectMeta(SHELL_HTML, meta, 'https://planmaville.fr');
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it('échappe les caractères HTML dans title/description (anti-injection)', () => {
    const meta = {
      title: 'Ville <script>alert(1)</script> & "Test"',
      description: 'Une commune & "spéciale" <b>ici</b>',
      canonicalPath: '/ville/x',
      noindex: false,
    };
    const html = injectMeta(SHELL_HTML, meta, 'https://planmaville.fr');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });
});
