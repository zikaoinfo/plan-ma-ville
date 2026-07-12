import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MetaService } from '../../core/services/meta.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ErrorMessage } from '../../shared/error-message/error-message';
import { ScoreBadge } from '../../shared/score-badge/score-badge';

@Component({
  selector: 'app-regions',
  imports: [RouterLink, ScoreBadge, ErrorMessage, DecimalPipe],
  templateUrl: './regions.html',
  styleUrl: './regions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Regions {
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);

  protected readonly status = this.#search.regionsStatus;
  protected readonly regions = computed(() => this.#search.getRegions());

  protected readonly reload = () => this.#search.reloadRegions();

  constructor() {
    effect(() =>
      this.#meta.setPage({
        title: 'Classement des régions — ma ville, notée',
        description:
          'Les régions françaises classées par note moyenne. Explorez une région pour ' +
          'voir ses départements, puis ses communes.',
        canonicalPath: '/regions',
      }),
    );
  }
}
