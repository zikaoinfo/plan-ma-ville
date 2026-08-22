import { describe, expect, it } from 'vitest';
import {
  adresseLisible,
  codeInseeDe,
  collecteMairies,
  estMairie,
  siteOfficiel,
  type MairieMap,
} from '../src/fetch/mairie.js';

const collecte = (doc: unknown): MairieMap => {
  const m: MairieMap = new Map();
  collecteMairies(doc, m);
  return m;
};

describe('codeInseeDe', () => {
  it('reconnaît un code INSEE, y compris corse', () => {
    expect(codeInseeDe({ code_insee_commune: '69123' })).toBe('69123');
    expect(codeInseeDe({ codeInsee: '2A004' })).toBe('2A004');
    expect(codeInseeDe({ CODGEO: '2b033' })).toBe('2B033');
  });

  it('descend dans un tableau de valeurs', () => {
    expect(codeInseeDe({ code_insee_commune: ['75056'] })).toBe('75056');
  });

  /** Un code postal a 5 chiffres lui aussi : la clé doit dire « insee ». */
  it('ignore les clés qui ne désignent pas un code INSEE', () => {
    expect(codeInseeDe({ code_postal: '69001' })).toBeUndefined();
    expect(codeInseeDe({ code_insee_commune: '1234' })).toBeUndefined();
    expect(codeInseeDe({ nom: 'Mairie de Lyon' })).toBeUndefined();
  });
});

describe('estMairie', () => {
  it('reconnaît le marqueur de type dans ses formes usuelles', () => {
    expect(estMairie({ pivotLocal: 'mairie' })).toBe(true);
    expect(estMairie({ type_service_local: 'Mairie' })).toBe(true);
    expect(estMairie({ pivot: [{ type_service_local: 'mairie' }] })).toBe(true);
    expect(estMairie({ categorie: 'Mairie annexe' })).toBe(true);
  });

  /**
   * Sans restriction aux clés de typage, une adresse « 3 rue de la Mairie »
   * ferait passer une préfecture ou un CCAS pour une mairie.
   */
  it('ne se laisse pas piéger par le mot « mairie » dans une adresse', () => {
    expect(estMairie({ adresse: [{ ligne: '3 rue de la Mairie' }] })).toBe(false);
    expect(estMairie({ nom: 'Annexe de la mairie', pivotLocal: 'ccas' })).toBe(false);
    expect(estMairie({ pivotLocal: 'prefecture' })).toBe(false);
  });
});

describe('adresseLisible', () => {
  it('recompose une adresse structurée', () => {
    expect(
      adresseLisible({
        adresse: [{ numero_voie: '1 place de la Mairie', code_postal: '69001', nom_commune: 'Lyon' }],
      }),
    ).toBe('1 place de la Mairie, 69001 Lyon');
  });

  it('accepte une adresse déjà écrite en une chaîne', () => {
    expect(adresseLisible({ adresse: '2 rue Neuve, 75001 Paris' })).toBe('2 rue Neuve, 75001 Paris');
  });

  it('se contente des morceaux disponibles', () => {
    expect(adresseLisible({ adresse: [{ code_postal: '69001', nom_commune: 'Lyon' }] })).toBe(
      '69001 Lyon',
    );
    expect(adresseLisible({ adresse: [{}] })).toBeUndefined();
    expect(adresseLisible({})).toBeUndefined();
  });
});

describe('siteOfficiel', () => {
  it('retient une URL http(s) bien formée', () => {
    expect(siteOfficiel({ site_internet: [{ valeur: 'https://www.lyon.fr' }] })).toBe(
      'https://www.lyon.fr/',
    );
    expect(siteOfficiel({ url: 'http://mairie.fr/accueil' })).toBe('http://mairie.fr/accueil');
  });

  /** Le flux contient des valeurs libres : on ne publie pas n'importe quoi en lien. */
  it('écarte ce qui n’est pas une URL http(s)', () => {
    expect(siteOfficiel({ site_internet: 'mairie@ville.fr' })).toBeUndefined();
    expect(siteOfficiel({ url: 'javascript:alert(1)' })).toBeUndefined();
    expect(siteOfficiel({ site_internet: 'pas une url' })).toBeUndefined();
    expect(siteOfficiel({})).toBeUndefined();
  });
});

describe('collecteMairies — tolérance à la structure', () => {
  /**
   * La structure exacte du flux DILA n'a pas pu être inspectée (réseau open
   * data bloqué hors CI) et évolue selon les versions. Le parser est donc
   * testé sur trois formes plausibles : si la réalité est l'une d'elles, il
   * fonctionne du premier coup.
   */
  it('forme A — tableau d’entrées à plat sous une clé racine', () => {
    const m = collecte({
      service: [
        {
          pivotLocal: 'mairie',
          code_insee_commune: '69123',
          nom: 'Mairie de Lyon',
          adresse: [{ numero_voie: '1 place Louis Pradel', code_postal: '69001', nom_commune: 'Lyon' }],
          site_internet: [{ valeur: 'https://www.lyon.fr' }],
        },
        { pivotLocal: 'prefecture', code_insee_commune: '69123', nom: 'Préfecture' },
      ],
    });
    expect(m.size).toBe(1);
    expect(m.get('69123')).toEqual({
      nom: 'Mairie de Lyon',
      adresse: '1 place Louis Pradel, 69001 Lyon',
      url: 'https://www.lyon.fr/',
    });
  });

  it('forme B — tableau racine, typage imbriqué dans « pivot »', () => {
    const m = collecte([
      {
        pivot: [{ type_service_local: 'mairie', code_insee_commune: '75056' }],
        codeInsee: '75056',
        libelle: 'Mairie de Paris',
        adresse: [{ ligne: 'Place de l’Hôtel de Ville', code_postal: '75004', commune: 'Paris' }],
        url: 'https://www.paris.fr',
      },
    ]);
    expect(m.get('75056')).toMatchObject({
      nom: 'Mairie de Paris',
      url: 'https://www.paris.fr/',
    });
  });

  it('forme C — entrées imbriquées en profondeur', () => {
    const m = collecte({
      export: { departements: [{ code: '2A', services: [
        { type: 'Mairie', codeInsee: '2A004', nom: 'Mairie d’Ajaccio', site_internet: 'https://ajaccio.fr' },
      ] }] },
    });
    expect(m.get('2A004')).toMatchObject({ nom: 'Mairie d’Ajaccio', url: 'https://ajaccio.fr/' });
  });

  it('garde la première mairie rencontrée par commune (annexes ignorées)', () => {
    const m = collecte([
      { pivotLocal: 'mairie', code_insee_commune: '69123', nom: 'Mairie centrale' },
      { pivotLocal: 'mairie', code_insee_commune: '69123', nom: 'Mairie annexe' },
    ]);
    expect(m.size).toBe(1);
    expect(m.get('69123')?.nom).toBe('Mairie centrale');
  });

  it('n’insère rien quand aucune information n’est exploitable', () => {
    expect(collecte([{ pivotLocal: 'mairie', code_insee_commune: '69123' }]).size).toBe(0);
    expect(collecte({}).size).toBe(0);
    expect(collecte(null).size).toBe(0);
    expect(collecte([]).size).toBe(0);
  });
});
