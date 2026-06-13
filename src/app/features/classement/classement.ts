import { DecimalPipe, DOCUMENT } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ClassementFile } from '../../core/models/data.models';
import { MetaService } from '../../core/services/meta.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ErrorMessage } from '../../shared/error-message/error-message';
import { ScoreBadge } from '../../shared/score-badge/score-badge';

@Component({
  selector: 'app-classement',
  imports: [RouterLink, ScoreBadge, ErrorMessage, DecimalPipe],
  templateUrl: './classement.html',
  styleUrl: './classement.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Classement {
  readonly #doc = inject(DOCUMENT);
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);

  readonly #classement = httpResource<ClassementFile>(
    () => new URL('data/classement.json', this.#doc.baseURI).href,
  );

  protected readonly status = this.#classement.status;
  protected readonly tab = signal<'top' | 'flop'>('top');
  protected readonly filterDep = signal('');

  protected readonly departements = computed(() => this.#search.getDepartements());
  protected readonly populationMin = computed(() => this.#classement.value()?.populationMin ?? null);

  protected readonly entries = computed(() => {
    const data = this.#classement.value();
    if (!data) return [];
    const base = this.tab() === 'top' ? data.top : data.flop;
    const dep = this.filterDep();
    return dep ? base.filter((e) => e.departement === dep) : base;
  });

  protected readonly reload = () => this.#classement.reload();

  constructor() {
    effect(() =>
      this.#meta.setPage({
        title: 'Classement des communes — ma ville, notée',
        description:
          'Les meilleures et les pires communes françaises selon leur note globale sur 10.',
        canonicalPath: '/classement',
      }),
    );
  }

  protected setTab(tab: 'top' | 'flop'): void {
    this.tab.set(tab);
  }
}
