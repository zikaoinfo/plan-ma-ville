import { computed, inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { httpResource } from '@angular/common/http';
import type {
  DepartementSummary,
  DepartementsFile,
  SearchIndexFile,
  SearchIndexItem,
} from '../models/data.models';
import { normaliseNom } from '../normalise';

const MAX_RESULTS = 10;
const CODE_POSTAL = /^\d{2,5}$/;

/**
 * Recherche pure sur un jeu d'items déjà chargé.
 * Exportée pour être testable sans HttpClient ni injection.
 *
 * Dispatch : 2–5 chiffres → préfixe de code postal, sinon préfixe de nom
 * normalisé. Tri : correspondance exacte d'abord, puis préfixe, puis nom court.
 */
export function searchItems(items: readonly SearchIndexItem[], query: string): SearchIndexItem[] {
  const raw = query.trim();
  if (raw.length < 2) return [];

  if (CODE_POSTAL.test(raw)) {
    return items
      .filter((it) => it.cp.some((cp) => cp.startsWith(raw)))
      .sort(
        (a, b) =>
          rangCp(b, raw) - rangCp(a, raw) || a.cp[0].localeCompare(b.cp[0]) || a.n.localeCompare(b.n),
      )
      .slice(0, MAX_RESULTS);
  }

  const q = normaliseNom(raw);
  if (q.length < 2) return [];
  return items
    .filter((it) => it.nn.startsWith(q))
    .sort((a, b) => rangNom(b, q) - rangNom(a, q) || a.nn.length - b.nn.length || a.n.localeCompare(b.n))
    .slice(0, MAX_RESULTS);
}

/** 2 = code postal exact, 1 = simple préfixe (priorité décroissante). */
function rangCp(item: SearchIndexItem, q: string): number {
  return item.cp.includes(q) ? 2 : 1;
}

/** 2 = nom normalisé exact, 1 = simple préfixe. */
function rangNom(item: SearchIndexItem, q: string): number {
  return item.nn === q ? 2 : 1;
}

@Injectable({ providedIn: 'root' })
export class SearchIndexService {
  readonly #doc = inject(DOCUMENT);

  readonly #index = httpResource<SearchIndexFile>(() => this.#url('index.json'));
  readonly #departements = httpResource<DepartementsFile>(() => this.#url('departements.json'));

  /** `true` dès que l'index de recherche est chargé. */
  readonly ready = computed(() => this.#index.status() === 'resolved');

  /** État brut de la ressource d'index (idle | loading | resolved | error). */
  readonly indexStatus = this.#index.status;

  /** Items de l'index ; `[]` tant que non résolu. */
  readonly items = computed(() => this.#index.value()?.items ?? []);

  search(query: string): SearchIndexItem[] {
    return searchItems(this.items(), query);
  }

  /** Retrouve un item d'index par son slug (`undefined` si absent/non chargé). */
  findBySlug(slug: string): SearchIndexItem | undefined {
    return this.items().find((it) => it.s === slug);
  }

  /** Nom d'un département depuis departements.json (`undefined` si non chargé). */
  departementName(code: string): string | undefined {
    return this.#departements.value()?.items.find((d) => d.code === code)?.nom;
  }

  /** Résumé d'un département (nb communes, note moyenne…). */
  departementSummary(code: string): DepartementSummary | undefined {
    return this.#departements.value()?.items.find((d) => d.code === code);
  }

  /** Départements triés par code croissant ; `[]` tant que non résolu. */
  getDepartements(): DepartementSummary[] {
    const items = this.#departements.value()?.items;
    if (!items) return [];
    return [...items].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }

  reload(): void {
    this.#index.reload();
    this.#departements.reload();
  }

  /**
   * URL d'un fichier de données, résolue contre `document.baseURI` (qui inclut
   * le `<base href>`), donc correcte en dev comme en prod quel que soit le
   * baseHref — sans le coder en dur.
   */
  #url(file: string): string {
    return new URL(`data/${file}`, this.#doc.baseURI).href;
  }
}
