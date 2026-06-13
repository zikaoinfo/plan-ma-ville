import { computed, effect, inject, Injectable, Signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { httpResource } from '@angular/common/http';
import type {
  CommuneDetail,
  DepartementDetailFile,
  SearchIndexItem,
} from '../models/data.models';
import { SearchIndexService } from './search-index.service';

/** État résolu d'une fiche commune. */
export type CommuneState = CommuneDetail | 'loading' | 'not-found';

/**
 * Logique pure de résolution d'un slug en état de fiche, isolée pour être
 * testée sans HttpClient ni framework.
 *
 * - index pas encore résolu → 'loading'
 * - slug absent de l'index → 'not-found'
 * - fichier département en erreur → 'not-found'
 * - fichier département pas encore là → 'loading'
 * - commune absente du fichier → 'not-found', sinon le CommuneDetail.
 */
export function resolveCommuneState(args: {
  indexResolved: boolean;
  item: SearchIndexItem | undefined;
  depFile: DepartementDetailFile | undefined;
  depError: boolean;
  slug: string;
}): CommuneState {
  if (!args.indexResolved) return 'loading';
  if (!args.item) return 'not-found';
  if (!args.depFile) return args.depError ? 'not-found' : 'loading';
  return args.depFile.communes.find((c) => c.slug === args.slug) ?? 'not-found';
}

@Injectable({ providedIn: 'root' })
export class CommuneDataService {
  readonly #search = inject(SearchIndexService);
  readonly #doc = inject(DOCUMENT);

  /**
   * Cache des fichiers département déjà chargés, partagé entre toutes les
   * fiches : revisiter une commune d'un département déjà vu ne refait aucune
   * requête (le loader d'URL renvoie `undefined` sur cache hit → pas de fetch).
   */
  readonly #fileCache = new Map<string, DepartementDetailFile>();

  /**
   * Résout un slug réactif en `Signal<CommuneState>`.
   *
   * À appeler dans un contexte d'injection (initialiseur de champ d'un
   * composant) : la ressource et l'effet créés sont alors liés au cycle de vie
   * de l'appelant.
   */
  getCommuneBySlug(slug: Signal<string>): {
    state: Signal<CommuneState>;
    depFile: Signal<DepartementDetailFile | undefined>;
  } {
    const depCode = computed(() => {
      if (this.#search.indexStatus() !== 'resolved') return undefined;
      return this.#search.findBySlug(slug())?.d;
    });

    const depRes = httpResource<DepartementDetailFile>(() => {
      const code = depCode();
      if (!code || this.#fileCache.has(code)) return undefined; // cache hit → pas de fetch
      return this.#url(code);
    });

    // Alimente le cache singleton dès qu'un fichier est résolu.
    effect(() => {
      const file = depRes.value();
      if (file) this.#fileCache.set(file.code, file);
    });

    // Fichier du département (cache ou ressource) — partagé pour les voisins,
    // afin de n'émettre qu'une seule requête par département.
    const depFile = computed(() => {
      const code = depCode();
      return code ? (this.#fileCache.get(code) ?? depRes.value()) : undefined;
    });

    const state = computed(() =>
      resolveCommuneState({
        indexResolved: this.#search.indexStatus() === 'resolved',
        item: this.#search.findBySlug(slug()),
        depFile: depFile(),
        depError: depRes.status() === 'error',
        slug: slug(),
      }),
    );

    return { state, depFile };
  }

  /**
   * Charge le fichier détaillé d'un département (Phase 4).
   * `undefined` tant que non résolu ; sert le cache si déjà chargé.
   */
  loadDep(code: Signal<string>): Signal<DepartementDetailFile | undefined> {
    const depRes = httpResource<DepartementDetailFile>(() => {
      const c = code();
      if (!c || this.#fileCache.has(c)) return undefined;
      return this.#url(c);
    });

    effect(() => {
      const file = depRes.value();
      if (file) this.#fileCache.set(file.code, file);
    });

    return computed(() => this.#fileCache.get(code()) ?? depRes.value());
  }

  #url(code: string): string {
    return new URL(`data/dep/${code}.json`, this.#doc.baseURI).href;
  }
}
