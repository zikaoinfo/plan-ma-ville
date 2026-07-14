import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CRITERE_LABELS, CRITERES } from '../../core/models/data.models';
import { schemaBreadcrumb, type Miette } from '../../core/seo/schemas';
import { CommuneDataService } from '../../core/services/commune-data.service';
import { JsonLdService } from '../../core/services/json-ld.service';
import { MetaService } from '../../core/services/meta.service';
import { PonderationService } from '../../core/services/ponderation.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ErrorMessage } from '../../shared/error-message/error-message';
import { ProfilPicker } from '../../shared/profil-picker/profil-picker';
import { ScoreBadge } from '../../shared/score-badge/score-badge';
import { filterAndSortCommunes, type SortField, type SortOrder } from './sort-communes';

@Component({
  selector: 'app-departement',
  imports: [RouterLink, ScoreBadge, DecimalPipe, ProfilPicker, ErrorMessage],
  templateUrl: './departement.html',
  styleUrl: './departement.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Departement {
  readonly #data = inject(CommuneDataService);
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);

  readonly code = input.required<string>();

  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;

  /** Code normalisé : les données utilisent `2A`/`2B` en majuscules. */
  readonly #code = computed(() => this.code().toUpperCase());

  readonly #dep = this.#data.loadDep(this.#code);
  readonly #file = this.#dep.file;
  protected readonly erreur = this.#dep.erreur;
  protected readonly reload = this.#dep.reload;

  protected readonly nom = computed(
    () => this.#file()?.nom ?? this.#search.departementName(this.#code()) ?? this.code(),
  );
  protected readonly noteMoyenne = computed(
    () => this.#search.departementSummary(this.#code())?.noteMoyenne ?? null,
  );

  protected readonly ponderation = inject(PonderationService);

  protected readonly sortField = signal<SortField>('global');
  protected readonly sortOrder = signal<SortOrder>(-1);
  protected readonly filterText = signal('');

  /**
   * Lignes du tableau : communes filtrées/triées, note « Pour vous »
   * précalculée UNE fois par changement (pas à chaque rendu de ligne).
   */
  protected readonly communes = computed(() => {
    const file = this.#file();
    if (!file) return null; // chargement
    const list = filterAndSortCommunes(
      file.communes,
      this.sortField(),
      this.sortOrder(),
      this.filterText(),
      this.ponderation.poids(),
    );
    return list.map((c) => ({ c, perso: this.ponderation.note(c.score.criteres) }));
  });

  readonly #jsonLd = inject(JsonLdService);

  constructor() {
    effect(() => {
      const nom = this.nom();
      const code = this.#code();
      this.#meta.setPage({
        title: this.#file()
          ? `${nom} (${code}) — ma ville, notée`
          : this.erreur()
            ? 'Département introuvable — ma ville, notée'
            : 'Chargement… — ma ville, notée',
        description: `Les communes du département ${nom} (${code}) notées sur 10, classables par critère.`,
        canonicalPath: `/departement/${code}`,
        noindex: !this.#file(), // chargement ou erreur : rien d'indexable
      });

      const region = this.#search.regionForDepartement(code);
      const miettes: Miette[] = [
        { nom: 'Accueil', path: '/' },
        ...(region ? [{ nom: region.nom, path: `/region/${region.code}` }] : []),
        { nom: `${nom} (${code})` },
      ];
      this.#jsonLd.set([schemaBreadcrumb(miettes)]);
    });
  }

  /** Clic sur un en-tête : bascule l'ordre si même colonne, sinon trie dessus. */
  protected sortBy(field: SortField): void {
    if (this.sortField() === field) {
      this.sortOrder.update((o) => (o === 1 ? -1 : 1));
    } else {
      this.sortField.set(field);
      this.sortOrder.set(field === 'nom' ? 1 : -1);
    }
  }

  protected ariaSort(field: SortField): 'ascending' | 'descending' | 'none' {
    if (this.sortField() !== field) return 'none';
    return this.sortOrder() === 1 ? 'ascending' : 'descending';
  }
}
