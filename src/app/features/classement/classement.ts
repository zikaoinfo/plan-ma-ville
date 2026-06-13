import { DecimalPipe, DOCUMENT } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import type { ClassementFile } from '../../core/models/data.models';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ScoreBadge } from '../../shared/score-badge/score-badge';

@Component({
  selector: 'app-classement',
  imports: [RouterLink, ScoreBadge, DecimalPipe],
  templateUrl: './classement.html',
  styleUrl: './classement.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Classement {
  readonly #doc = inject(DOCUMENT);
  readonly #search = inject(SearchIndexService);
  readonly #title = inject(Title);

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

  constructor() {
    effect(() => this.#title.setTitle('Classement des communes — ma ville, notée'));
  }

  protected setTab(tab: 'top' | 'flop'): void {
    this.tab.set(tab);
  }

  protected reload(): void {
    this.#classement.reload();
  }
}
