import { describe, expect, it } from 'vitest';
import type { CommuneDetail, Critere } from '../models/data.models';
import { schemaBreadcrumb, schemaDataset, schemaItemList, schemaPlace } from './schemas';

const CRITERES_5 = Object.fromEntries(
  ['securite', 'sante', 'commerces', 'enseignement', 'sports', 'culture', 'transports', 'niveauVie'].map(
    (c) => [c, 5],
  ),
) as Record<Critere, number>;

const LYON: CommuneDetail = {
  slug: 'lyon-69123',
  nom: 'Lyon',
  codeInsee: '69123',
  codesPostaux: ['69001'],
  population: 522250,
  lat: 45.758,
  lon: 4.8357,
  score: { source: 'computed', global: 6.2, criteres: CRITERES_5 },
};

describe('schemaBreadcrumb', () => {
  it('numérote les positions et omet item pour le dernier élément', () => {
    const s = schemaBreadcrumb([
      { nom: 'Accueil', path: '/' },
      { nom: 'Rhône', path: '/departement/69' },
      { nom: 'Lyon' },
    ]) as { itemListElement: { position: number; name: string; item?: string }[] };
    expect(s.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(s.itemListElement[1].item).toContain('/departement/69');
    expect(s.itemListElement[2].item).toBeUndefined();
    expect(s.itemListElement[2].name).toBe('Lyon');
  });
});

describe('schemaPlace', () => {
  it('adresse complète + géolocalisation', () => {
    const s = schemaPlace(LYON, 'Rhône') as Record<string, unknown>;
    expect(s['@type']).toBe('Place');
    expect(s['geo']).toEqual({ '@type': 'GeoCoordinates', latitude: 45.758, longitude: 4.8357 });
    expect((s['address'] as Record<string, string>)['postalCode']).toBe('69001');
    expect((s['address'] as Record<string, string>)['addressCountry']).toBe('FR');
  });

  it('sans coordonnées : pas de bloc geo', () => {
    const sans = { ...LYON, lat: undefined, lon: undefined };
    const s = schemaPlace(sans, 'Rhône') as Record<string, unknown>;
    expect(s['geo']).toBeUndefined();
  });
});

describe('schemaItemList / schemaDataset', () => {
  it('liste ordonnée avec URLs absolues', () => {
    const s = schemaItemList('Top', [
      { nom: 'Lyon', path: '/ville/lyon-69123' },
      { nom: 'Annecy', path: '/ville/annecy-74010' },
    ]) as { numberOfItems: number; itemListElement: { position: number; url: string }[] };
    expect(s.numberOfItems).toBe(2);
    expect(s.itemListElement[1].position).toBe(2);
    expect(s.itemListElement[0].url).toMatch(/^https?:\/\/.+\/ville\/lyon-69123$/);
  });

  it('dataset : sources officielles référencées, aucun undefined', () => {
    const json = JSON.stringify(schemaDataset());
    expect(json).toContain('data.gouv.fr');
    expect(json).not.toContain('undefined');
  });
});
