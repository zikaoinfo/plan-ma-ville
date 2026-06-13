import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CRITERE_LABELS, CRITERES } from '../../core/models/data.models';
import { CommuneDataService } from '../../core/services/commune-data.service';
import { MetaService } from '../../core/services/meta.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ScoreBadge } from '../../shared/score-badge/score-badge';
import { filterAndSortCommunes, type SortField, type SortOrder } from './sort-communes';

@Component({
  selector: 'app-departement',
  imports: [RouterLink, ScoreBadge, DecimalPipe],
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

  readonly #file = this.#data.loadDep(this.code);

  protected readonly nom = computed(
    () => this.#file()?.nom ?? this.#search.departementName(this.code()) ?? this.code(),
  );
  protected readonly noteMoyenne = computed(
    () => this.#search.departementSummary(this.code())?.noteMoyenne ?? null,
  );

  protected readonly sortField = signal<SortField>('global');
  protected readonly sortOrder = signal<SortOrder>(-1);
  protected readonly filterText = signal('');

  protected readonly communes = computed(() => {
    const file = this.#file();
    if (!file) return null; // chargement
    return filterAndSortCommunes(
      file.communes,
      this.sortField(),
      this.sortOrder(),
      this.filterText(),
    );
  });

  constructor() {
    effect(() => {
      const nom = this.nom();
      this.#meta.setPage({
        title: this.#file()
          ? `${nom} (${this.code()}) — ma ville, notée`
          : 'Chargement… — ma ville, notée',
        description: `Les communes du département ${nom} (${this.code()}) notées sur 10, classables par critère.`,
        canonicalPath: `/departement/${this.code()}`,
      });
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
