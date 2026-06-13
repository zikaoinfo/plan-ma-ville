import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MetaService } from '../../core/services/meta.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ErrorMessage } from '../../shared/error-message/error-message';
import { ScoreBadge } from '../../shared/score-badge/score-badge';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ScoreBadge, ErrorMessage, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);

  protected readonly query = signal('');
  protected readonly ready = this.#search.ready;
  protected readonly indexStatus = this.#search.indexStatus;

  protected readonly results = computed(() => this.#search.search(this.query()));
  protected readonly departements = computed(() => this.#search.getDepartements());

  /** true dès qu'une recherche exploitable a été tapée mais ne renvoie rien. */
  protected readonly noResult = computed(
    () => this.query().trim().length >= 2 && this.results().length === 0 && this.ready(),
  );

  protected readonly reload = () => this.#search.reload();

  constructor() {
    effect(() =>
      this.#meta.setPage({
        title: 'ma ville, notée — la qualité de vie des communes françaises',
        description:
          'La note sur 10 de chaque commune française : sécurité, santé, commerces, ' +
          'enseignement, sports, culture, transports et niveau de vie.',
        canonicalPath: '/',
      }),
    );
  }
}
