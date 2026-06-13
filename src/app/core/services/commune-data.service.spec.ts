import { describe, expect, it } from 'vitest';
import type {
  CommuneDetail,
  DepartementDetailFile,
  SearchIndexItem,
} from '../models/data.models';
import { resolveCommuneState } from './commune-data.service';

const lyonItem: SearchIndexItem = {
  n: 'Lyon',
  nn: 'lyon',
  cp: ['69001'],
  d: '69',
  s: 'lyon-69123',
  i: '69123',
  p: 522250,
  g: 6.2,
};

const lyonDetail: CommuneDetail = {
  slug: 'lyon-69123',
  nom: 'Lyon',
  codeInsee: '69123',
  codesPostaux: ['69001'],
  population: 522250,
  score: {
    source: 'computed',
    global: 6.2,
    criteres: {
      securite: 6,
      sante: 7,
      commerces: 6.5,
      enseignement: 6,
      sports: 5.5,
      culture: 7.5,
      transports: 8,
      niveauVie: 6,
    },
  },
};

const depFile: DepartementDetailFile = {
  v: 1,
  gen: '2026-06-13',
  code: '69',
  nom: 'Rhône',
  communes: [lyonDetail],
};

describe('resolveCommuneState', () => {
  it("renvoie 'loading' tant que l'index n'est pas résolu", () => {
    expect(
      resolveCommuneState({
        indexResolved: false,
        item: undefined,
        depFile: undefined,
        depError: false,
        slug: 'lyon-69123',
      }),
    ).toBe('loading');
  });

  it("renvoie 'not-found' pour un slug absent de l'index", () => {
    expect(
      resolveCommuneState({
        indexResolved: true,
        item: undefined,
        depFile: undefined,
        depError: false,
        slug: 'nexiste-pas',
      }),
    ).toBe('not-found');
  });

  it("renvoie 'loading' quand l'item existe mais le département n'est pas chargé", () => {
    expect(
      resolveCommuneState({
        indexResolved: true,
        item: lyonItem,
        depFile: undefined,
        depError: false,
        slug: 'lyon-69123',
      }),
    ).toBe('loading');
  });

  it("renvoie 'not-found' si le fichier département est en erreur", () => {
    expect(
      resolveCommuneState({
        indexResolved: true,
        item: lyonItem,
        depFile: undefined,
        depError: true,
        slug: 'lyon-69123',
      }),
    ).toBe('not-found');
  });

  it('renvoie le CommuneDetail pour un slug connu et chargé', () => {
    expect(
      resolveCommuneState({
        indexResolved: true,
        item: lyonItem,
        depFile,
        depError: false,
        slug: 'lyon-69123',
      }),
    ).toEqual(lyonDetail);
  });

  it("renvoie 'not-found' si la commune est absente du fichier département", () => {
    expect(
      resolveCommuneState({
        indexResolved: true,
        item: { ...lyonItem, s: 'autre-69999' },
        depFile,
        depError: false,
        slug: 'autre-69999',
      }),
    ).toBe('not-found');
  });
});
