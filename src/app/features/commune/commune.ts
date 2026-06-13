import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CRITERE_LABELS, CRITERES } from '../../core/models/data.models';
import { CommuneDataService } from '../../core/services/commune-data.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { NoteBar } from '../../shared/note-bar/note-bar';
import { ScoreBadge } from '../../shared/score-badge/score-badge';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-commune',
  imports: [RouterLink, NoteBar, ScoreBadge, DecimalPipe],
  templateUrl: './commune.html',
  styleUrl: './commune.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Commune {
  readonly #data = inject(CommuneDataService);
  readonly #search = inject(SearchIndexService);
  readonly #title = inject(Title);

  readonly slug = input.required<string>();

  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;

  readonly #state = this.#data.getCommuneBySlug(this.slug);

  protected readonly status = computed(() =>
    typeof this.#state() === 'string' ? (this.#state() as 'loading' | 'not-found') : 'ok',
  );
  protected readonly commune = computed(() => {
    const s = this.#state();
    return typeof s === 'string' ? null : s;
  });

  /** Code département de la commune courante (depuis l'index). */
  protected readonly depCode = computed(() => this.#search.findBySlug(this.slug())?.d ?? '');
  /** Nom du département, ou le code à défaut tant que departements.json n'est pas là. */
  protected readonly depNom = computed(
    () => this.#search.departementName(this.depCode()) ?? this.depCode(),
  );

  constructor() {
    effect(() => {
      const s = this.#state();
      if (s === 'loading') {
        this.#title.setTitle('Chargement… — ma ville, notée');
      } else if (s === 'not-found') {
        this.#title.setTitle('Commune introuvable — ma ville, notée');
      } else {
        this.#title.setTitle(`${s.nom} (${this.depCode()}) — ma ville, notée`);
      }
    });
  }
}
