import { environment } from '../../../environments/environment';
import type { CommuneDetail } from '../models/data.models';

/**
 * Constructeurs PURS de schémas JSON-LD (schema.org). Périmètre volontairement
 * restreint (cf. docs/SEO-PLAN.md §P3) : BreadcrumbList (rich result actif),
 * Place+geo (compréhension d'entité), ItemList (classements), Dataset
 * (méthodologie). PAS de FAQPage (rich results retirés) ni d'AggregateRating
 * (types Place/City inéligibles aux étoiles).
 */

const abs = (path: string): string => environment.baseUrl + path;

export interface Miette {
  nom: string;
  /** Chemin absolu commençant par `/` ; omis pour le dernier élément. */
  path?: string;
}

/** Fil d'Ariane : Accueil › Région › Département › Commune. */
export function schemaBreadcrumb(miettes: readonly Miette[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: miettes.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.nom,
      ...(m.path ? { item: abs(m.path) } : {}),
    })),
  };
}

/** Entité commune (Place + géolocalisation si disponible). */
export function schemaPlace(commune: CommuneDetail, depNom: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: commune.nom,
    url: abs(`/ville/${commune.slug}`),
    address: {
      '@type': 'PostalAddress',
      addressLocality: commune.nom,
      ...(commune.codesPostaux[0] ? { postalCode: commune.codesPostaux[0] } : {}),
      addressRegion: depNom,
      addressCountry: 'FR',
    },
    ...(commune.lat !== undefined && commune.lon !== undefined
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: commune.lat,
            longitude: commune.lon,
          },
        }
      : {}),
  };
}

export interface EntreeListe {
  nom: string;
  /** Chemin absolu commençant par `/`. */
  path: string;
}

/** Liste ordonnée (classements, hubs). */
export function schemaItemList(nomListe: string, entrees: readonly EntreeListe[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: nomListe,
    numberOfItems: entrees.length,
    itemListElement: entrees.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.nom,
      url: abs(e.path),
    })),
  };
}

/** Le jeu de données du site (page méthodologie) — candidat Dataset Search. */
export function schemaDataset(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Notes de qualité de vie des communes françaises',
    description:
      'Notes sur 10 des communes françaises sur 8 critères (sécurité, santé, commerces, ' +
      'enseignement, sports, culture, transports, niveau de vie), calculées à partir de ' +
      'données publiques : BPE (INSEE), délinquance (SSMSI), revenus Filosofi (INSEE), ' +
      'prix immobiliers DVF (DGFiP), périmètres geo.api.gouv.fr.',
    url: abs('/methodologie'),
    creator: { '@type': 'Organization', name: 'ma ville, notée', url: environment.baseUrl },
    isBasedOn: [
      'https://www.insee.fr/fr/metadonnees/source/serie/s1161',
      'https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales',
      'https://www.data.gouv.fr/datasets/statistiques-dvf',
    ],
    spatialCoverage: { '@type': 'Country', name: 'France' },
    inLanguage: 'fr',
  };
}
