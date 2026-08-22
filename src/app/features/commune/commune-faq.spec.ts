import { describe, expect, it } from 'vitest';
import type { CommuneDetail, Critere } from '../../core/models/data.models';
import { genereFaqCommune } from './commune-faq';
import { genereTexteCommune } from './commune-texte';

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
    transports: 5.5,
    niveauVie: 6.1,
    ...over,
  } as Record<Critere, number>;
  return {
    slug: `${nom.toLowerCase()}-${insee}`,
    nom,
    codeInsee: insee,
    codesPostaux: ['12345'],
    population: pop,
    score: { source: 'computed', global, criteres },
    ...(prix ? { prix } : {}),
  };
}

const voisines = [
  commune('Alpha', '11111', 5.2, 8000, { securite: 4, niveauVie: 5 }, undefined),
  commune('Beta', '22222', 7.4, 30000, { securite: 8, niveauVie: 7.4 }, {
    m2: 2000,
    periode: '2025-S2',
    histo: [{ p: '2024-S2', v: 1900 }, { p: '2025-S2', v: 2000 }],
  }),
  commune('Gamma', '33333', 6.1, 4000, { securite: 6, niveauVie: 6 }, {
    m2: 2600,
    periode: '2025-S2',
    histo: [{ p: '2024-S2', v: 2500 }, { p: '2025-S2', v: 2600 }],
  }),
];

const cible = commune('Testville', '99999', 6.6, 12000, {}, {
  m2: 3000,
  periode: '2025-S2',
  histo: [
    { p: '2024-S2', v: 2700 },
    { p: '2025-S2', v: 3000 },
  ],
});
const pool = [cible, ...voisines];

describe('genereFaqCommune', () => {
  const faq = genereFaqCommune(cible, pool, 'Rhône');

  it('produit 3 à 4 questions', () => {
    expect(faq.length).toBeGreaterThanOrEqual(3);
    expect(faq.length).toBeLessThanOrEqual(4);
  });

  it('couvre les questions attendues, toutes nommant la commune', () => {
    const questions = faq.map((f) => f.q);
    expect(questions[0]).toBe('Testville est-elle une bonne ville pour vivre ?');
    expect(questions).toContain('Testville est-elle une ville sûre ?');
    expect(questions).toContain("Combien coûte l'immobilier à Testville ?");
    expect(questions).toContain('Quel est le niveau de vie à Testville ?');
    expect(questions.every((q) => q.includes('Testville'))).toBe(true);
  });

  it('donne des réponses autonomes : le chiffre demandé y figure', () => {
    const parQ = new Map(faq.map((f) => [f.q, f.r]));
    expect(parQ.get('Testville est-elle une bonne ville pour vivre ?')).toContain('6,6/10');
    expect(parQ.get('Testville est-elle une ville sûre ?')).toContain('6,0/10');
    // fmtEntier utilise le séparateur de milliers fr-FR (espace fine
    // insécable U+202F) : ne pas coder une espace ordinaire en dur.
    expect(parQ.get("Combien coûte l'immobilier à Testville ?")).toMatch(/3\s000\s€/u);
    expect(parQ.get('Quel est le niveau de vie à Testville ?')).toContain('6,1/10');
  });

  it('cite systématiquement la source de la donnée', () => {
    const parQ = new Map(faq.map((f) => [f.q, f.r]));
    expect(parQ.get('Testville est-elle une ville sûre ?')).toContain('SSMSI');
    expect(parQ.get("Combien coûte l'immobilier à Testville ?")).toContain('DVF');
    expect(parQ.get('Quel est le niveau de vie à Testville ?')).toContain('Filosofi');
  });

  it('ne contredit pas la prose : mêmes rang et points forts', () => {
    const texte = genereTexteCommune(cible, pool, 'Rhône');
    const globale = faq[0].r;
    // Testville est 2ᵉ sur 4 (7,4 > 6,6 > 6,1 > 5,2).
    expect(globale).toContain('2ᵉ sur les 4 communes');
    expect(texte.resume).toContain('2ᵉ sur 4 communes');
    // Points forts : santé (7,2) puis enseignement (6,8) dans les deux blocs.
    expect(globale).toContain('santé (7,2/10)');
    expect(globale).toContain('enseignement (6,8/10)');
    expect(texte.resume).toContain('santé (7,2/10)');
  });

  it('est déterministe (SSG : deux builds → même HTML)', () => {
    expect(genereFaqCommune(cible, pool, 'Rhône')).toEqual(faq);
  });

  it('varie les tournures entre communes (anti scaled-content)', () => {
    // Même profil de notes, INSEE différents → formulations différentes.
    const a = genereFaqCommune(commune('A', '10001', 6.6), pool, 'Rhône');
    const b = genereFaqCommune(commune('B', '10002', 6.6), pool, 'Rhône');
    const c = genereFaqCommune(commune('C', '10003', 6.6), pool, 'Rhône');
    const phrases = new Set([a, b, c].map((f) => f[1].r.replace(/^\w+/, '')));
    expect(phrases.size).toBeGreaterThan(1);
  });

  it('reste honnête sans donnée DVF : aucune estimation inventée', () => {
    const sansPrix = commune('Nodata', '88888', 5.5);
    const f = genereFaqCommune(sansPrix, [sansPrix, ...voisines], 'Rhône');
    const immo = f.find((x) => x.q.startsWith('Combien'))?.r ?? '';
    expect(immo).toContain('Aucun prix au m² fiable');
    expect(immo).not.toMatch(/\d+\s?€\/m²/);
  });

  it('omet le niveau de vie sans commune de comparaison externe', () => {
    const seule = commune('Isolee', '77777', 6);
    const f = genereFaqCommune(seule, [seule], 'Rhône');
    expect(f.map((x) => x.q)).not.toContain('Quel est le niveau de vie à Isolee ?');
    expect(f.length).toBe(3);
  });

  it("s'accorde sur la catégorie de taille (« Ce village » vs « Cette »)", () => {
    const village = commune('Petitbourg', '66666', 6, 800);
    const secu = genereFaqCommune(village, [village, ...voisines], 'Rhône').find((x) =>
      x.q.includes('sûre'),
    )?.r;
    expect(secu).toContain('Ce village');
  });
});

describe('rédaction des réponses', () => {
  /**
   * Une réponse de FAQ est lue ISOLÉMENT (extraite par un moteur de réponse) :
   * une phrase ouverte par « Elle/Il/Celle-ci » y perd son antécédent. Toutes
   * les phrases doivent donc commencer par un sujet explicite.
   */
  it('ne commence aucune phrase par un pronom sans antécédent', () => {
    const cas: CommuneDetail[] = [
      cible,
      commune('Sansprix', '55501', 4.2, 900),
      commune('Grandeville', '55502', 8.1, 250000, { securite: 9 }),
      commune('Moyenne', '55503', 6, 45000, { niveauVie: 2 }),
    ];
    const interdits = /(^|\. )(Elle|Il|Ils|Elles|Celle-ci|Celui-ci|Cela)\b/;
    for (const c of cas) {
      for (const { q, r } of genereFaqCommune(c, [c, ...voisines], 'Rhône')) {
        expect(r, `${c.nom} — ${q}`).not.toMatch(interdits);
      }
    }
  });

  it('termine chaque réponse par une phrase complète', () => {
    for (const { r } of genereFaqCommune(cible, pool, 'Rhône')) {
      expect(r.trim()).toMatch(/[.!?]$/);
      expect(r).not.toContain('  ');
      expect(r).not.toMatch(/\s,/);
    }
  });
});
