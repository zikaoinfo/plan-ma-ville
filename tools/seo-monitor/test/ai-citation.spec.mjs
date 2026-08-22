import { describe, expect, it } from 'vitest';
import {
  agregeCitations,
  detecteCitation,
  formateRapport,
  normaliseDomaine,
  texteCite,
  urlCite,
} from '../ai-citation-logic.mjs';

const D = 'planmaville.fr';

describe('normaliseDomaine', () => {
  it('retire protocole, www et chemin', () => {
    expect(normaliseDomaine('https://www.planmaville.fr/ville/lyon/')).toBe('planmaville.fr');
    expect(normaliseDomaine('  PlanMaVille.FR ')).toBe('planmaville.fr');
  });
});

describe('texteCite', () => {
  it('reconnaît les formes usuelles du domaine', () => {
    expect(texteCite('Selon planmaville.fr, la note est de 7/10.', D)).toBe(true);
    expect(texteCite('Voir www.planmaville.fr pour le détail.', D)).toBe(true);
    expect(texteCite('Source : https://planmaville.fr/ville/lyon-69123/', D)).toBe(true);
    expect(texteCite('(planmaville.fr)', D)).toBe(true);
  });

  /**
   * Un faux positif gonflerait la baseline et rendrait la progression
   * illisible : le domaine ne doit pas matcher en simple sous-chaîne.
   */
  it('ne se laisse pas piéger par un domaine qui contient le nôtre', () => {
    expect(texteCite('Voir notplanmaville.fr', D)).toBe(false);
    expect(texteCite('Voir planmaville.fr.example.com', D)).toBe(false);
    expect(texteCite('planmaville.frites', D)).toBe(false);
  });

  it('gère l’absence de texte', () => {
    expect(texteCite('', D)).toBe(false);
    expect(texteCite(undefined, D)).toBe(false);
  });
});

describe('urlCite', () => {
  it('accepte le domaine et ses sous-domaines', () => {
    expect(urlCite('https://planmaville.fr/ville/lyon-69123/', D)).toBe(true);
    expect(urlCite('https://www.planmaville.fr/', D)).toBe(true);
  });

  it('rejette les autres domaines et les URLs invalides', () => {
    expect(urlCite('https://ville-ideale.fr/lyon', D)).toBe(false);
    expect(urlCite('https://notplanmaville.fr/', D)).toBe(false);
    expect(urlCite('pas une url', D)).toBe(false);
    expect(urlCite(undefined, D)).toBe(false);
  });
});

describe('detecteCitation', () => {
  it('distingue « nommé dans la réponse » de « simple source consultée »', () => {
    const nomme = detecteCitation(
      { texte: 'D’après planmaville.fr, Lyon obtient 7,1/10.', sources: [] },
      D,
    );
    expect(nomme).toMatchObject({ citee: true, dans_texte: true, dans_sources: false });

    const source = detecteCitation(
      {
        texte: 'Lyon est bien notée.',
        sources: [{ url: 'https://planmaville.fr/ville/lyon-69123/' }],
      },
      D,
    );
    expect(source).toMatchObject({ citee: true, dans_texte: false, dans_sources: true });
    expect(source.urls).toEqual(['https://planmaville.fr/ville/lyon-69123/']);
  });

  it('ne signale rien quand le site est absent', () => {
    const r = detecteCitation(
      { texte: 'Lyon est agréable.', sources: [{ url: 'https://ville-ideale.fr/lyon' }] },
      D,
    );
    expect(r.citee).toBe(false);
    expect(r.nb_sources_total).toBe(1);
  });

  it('tolère une réponse sans sources', () => {
    expect(detecteCitation({ texte: 'Rien.' }, D).citee).toBe(false);
  });
});

describe('agregeCitations', () => {
  const resultats = [
    { ville: 'Lyon', citee: true, dans_texte: true, dans_sources: false },
    { ville: 'Nice', citee: true, dans_texte: false, dans_sources: true },
    { ville: 'Brest', citee: false, dans_texte: false, dans_sources: false },
    { ville: 'Caen', erreur: 'HTTP 529' },
  ];

  /**
   * Une ville en échec d'API n'est pas une ville « non citée » : la compter
   * comme telle ferait baisser la baseline pour une raison technique.
   */
  it('exclut les erreurs du dénominateur', () => {
    const s = agregeCitations(resultats);
    expect(s.villes_interrogees).toBe(4);
    expect(s.villes_exploitables).toBe(3);
    expect(s.villes_en_erreur).toBe(1);
    expect(s.citations).toBe(2);
    expect(s.taux).toBeCloseTo(2 / 3);
  });

  it('ventile texte vs sources', () => {
    const s = agregeCitations(resultats);
    expect(s.citations_dans_texte).toBe(1);
    expect(s.citations_dans_sources).toBe(1);
  });

  it('ne divise pas par zéro quand tout échoue', () => {
    expect(agregeCitations([{ ville: 'X', erreur: 'boom' }]).taux).toBe(0);
    expect(agregeCitations([]).taux).toBe(0);
  });
});

describe('formateRapport', () => {
  it('liste les villes citées et la nature de la citation', () => {
    const resultats = [
      { ville: 'Lyon', citee: true, dans_texte: true },
      { ville: 'Nice', citee: true, dans_texte: false },
      { ville: 'Brest', citee: false },
    ];
    const txt = formateRapport(agregeCitations(resultats), resultats, '2026-08-22');
    expect(txt).toContain('Citée : 2/3 — 66,7 %');
    expect(txt).toContain('Lyon (nommé dans la réponse)');
    expect(txt).toContain('Nice (source)');
  });

  it('dit explicitement qu’une baseline nulle est un point de départ', () => {
    const resultats = [{ ville: 'Brest', citee: false }];
    const txt = formateRapport(agregeCitations(resultats), resultats, '2026-08-22');
    expect(txt).toContain('Aucune citation détectée');
  });
});
