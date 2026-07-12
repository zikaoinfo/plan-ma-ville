import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import type { Avis, CommuneStats } from '../../../core/models/data.models';
import { AvisService } from '../../../core/services/avis.service';
import { ScoreBadge } from '../../../shared/score-badge/score-badge';

@Component({
  selector: 'app-commune-avis-list',
  imports: [ScoreBadge, DatePipe],
  template: `
    <div class="avis-list">
      @if (stats(); as s) {
        <div class="stats">
          @if (s.nb_avis > 0 && s.note_habitants !== null) {
            <app-score-badge [score]="s.note_habitants" />
            <span class="stats__txt">
              note des habitants · {{ s.nb_avis }} avis
            </span>
          } @else {
            <span class="stats__txt">Aucun avis pour l'instant — soyez le premier.</span>
          }
        </div>
      }

      @if (loading() && avis().length === 0) {
        @for (n of [1, 2, 3]; track n) {
          <div class="sk"></div>
        }
      }

      <ul class="items">
        @for (a of avis(); track a.id) {
          <li class="item">
            <div class="item__head">
              <strong class="item__pseudo">{{ a.pseudo }}</strong>
              <span class="item__date">{{ a.created_at | date: 'longDate' }}</span>
              <app-score-badge [score]="a.note_globale" />
            </div>
            @if (a.positifs) {
              <p class="item__pos"><span aria-hidden="true">＋</span> {{ a.positifs }}</p>
            }
            @if (a.negatifs) {
              <p class="item__neg"><span aria-hidden="true">－</span> {{ a.negatifs }}</p>
            }
          </li>
        }
      </ul>

      @if (hasMore()) {
        <button type="button" class="more" (click)="voirPlus()" [disabled]="loading()">
          {{ loading() ? 'Chargement…' : 'Voir plus' }}
        </button>
      }
    </div>
  `,
  styleUrl: './commune-avis-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommuneAvisList {
  readonly #avis = inject(AvisService);

  readonly codeInsee = input.required<string>();
  /** Incrémenter pour forcer un rechargement (après soumission d'un avis). */
  readonly version = input(0);

  protected readonly stats = signal<CommuneStats | null>(null);
  protected readonly avis = signal<Avis[]>([]);
  protected readonly loading = signal(false);
  protected readonly hasMore = signal(false);
  readonly #page = signal(0);

  constructor() {
    effect(() => {
      const code = this.codeInsee();
      this.version(); // dépendance : recharge après un nouvel avis
      this.avis.set([]);
      this.#page.set(0);
      void this.#load(code, 0);
    });
  }

  protected voirPlus(): void {
    void this.#load(this.codeInsee(), this.#page() + 1);
  }

  async #load(code: string, page: number): Promise<void> {
    if (!this.#avis.disponible) return;
    this.loading.set(true);
    try {
      if (page === 0) this.stats.set(await this.#avis.loadStats(code));
      const batch = await this.#avis.loadAvis(code, page);
      this.avis.update((cur) => (page === 0 ? batch : [...cur, ...batch]));
      this.hasMore.set(batch.length === 10);
      this.#page.set(page);
    } catch {
      // silencieux : l'onglet reste utilisable même si le réseau échoue
    } finally {
      this.loading.set(false);
    }
  }
}
