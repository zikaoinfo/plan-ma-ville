import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { scoreTier, TIER_BG, TIER_FG } from '../score-color';

/** Pastille colorée affichant une note /10 (couleur selon le palier). */
@Component({
  selector: 'app-score-badge',
  template: `
    <span
      class="badge"
      [style.background]="bg()"
      [style.color]="fg()"
      [attr.aria-label]="'Note ' + score().toFixed(1) + ' sur 10'"
    >
      <span class="badge__num">{{ score().toFixed(1) }}</span>
      <span class="badge__den">/10</span>
    </span>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: baseline;
      gap: 0.1rem;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      /* Liseré dérivé de l'encre : visible dans les deux thèmes. */
      border: 1.5px solid color-mix(in srgb, var(--ink) 20%, transparent);
      font-family: var(--font-display);
      font-weight: 600;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .badge__num {
      font-size: 1.05em;
    }

    .badge__den {
      font-size: 0.7em;
      opacity: 0.8;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreBadge {
  readonly score = input.required<number>();

  protected readonly bg = computed(() => TIER_BG[scoreTier(this.score())]);
  protected readonly fg = computed(() => TIER_FG[scoreTier(this.score())]);
}
