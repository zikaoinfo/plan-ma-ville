import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MetaService } from '../../core/services/meta.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ErrorMessage } from '../../shared/error-message/error-message';
import { ScoreBadge } from '../../shared/score-badge/score-badge';

@Component({
  selector: 'app-region',
  imports: [RouterLink, ScoreBadge, ErrorMessage, DecimalPipe],
  templateUrl: './region.html',
  styleUrl: './region.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Region {
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);

  readonly code = input.required<string>();

  protected readonly status = this.#search.regionsStatus;
  protected readonly region = computed(() => this.#search.regionSummary(this.code()));
  protected readonly nom = computed(() => this.region()?.nom ?? this.code());
  /** Résolu mais région introuvable (mauvais code) → 404 doux. */
  protected readonly introuvable = computed(
    () => this.status() === 'resolved' && this.region() === undefined,
  );

  protected readonly reload = () => this.#search.reloadRegions();

  constructor() {
    effect(() => {
      const region = this.region();
      this.#meta.setPage({
        title: region
          ? `${region.nom} — ma ville, notée`
          : 'Région — ma ville, notée',
        description: region
          ? `Les ${region.nbDepartements} départements de ${region.nom} classés par note moyenne sur 10.`
          : 'Classement des départements de la région.',
        canonicalPath: `/region/${this.code()}`,
      });
    });
  }
}
