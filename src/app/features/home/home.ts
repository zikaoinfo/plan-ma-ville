import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ScoreBadge } from '../../shared/score-badge/score-badge';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ScoreBadge, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly #search = inject(SearchIndexService);

  protected readonly query = signal('');
  protected readonly ready = this.#search.ready;

  protected readonly results = computed(() => this.#search.search(this.query()));
  protected readonly departements = computed(() => this.#search.getDepartements());

  /** true dès qu'une recherche exploitable a été tapée mais ne renvoie rien. */
  protected readonly noResult = computed(
    () => this.query().trim().length >= 2 && this.results().length === 0 && this.ready(),
  );
}
