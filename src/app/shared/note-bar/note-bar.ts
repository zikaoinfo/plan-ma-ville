import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { scoreTier, TIER_BG } from '../score-color';

/** Ligne « label — barre proportionnelle — note » pour un critère /10. */
@Component({
  selector: 'app-note-bar',
  template: `
    <div
      class="note-bar"
      role="progressbar"
      [attr.aria-label]="label()"
      [attr.aria-valuenow]="score()"
      aria-valuemin="0"
      aria-valuemax="10"
    >
      <span class="note-bar__label">{{ label() }}</span>
      <span class="note-bar__track">
        <span class="note-bar__fill" [style.width.%]="pct()" [style.background]="color()"></span>
      </span>
      <span class="note-bar__score">{{ score().toFixed(1) }}</span>
    </div>
  `,
  styles: `
    .note-bar {
      display: grid;
      grid-template-columns: 130px 1fr 2.5rem;
      align-items: center;
      gap: 0.75rem;
    }

    .note-bar__label {
      font-weight: 500;
      color: var(--ink-soft);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .note-bar__track {
      height: 10px;
      border-radius: 999px;
      background: var(--paper-soft);
      border: 1px solid var(--line);
      overflow: hidden;
    }

    .note-bar__fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .note-bar__score {
      font-family: var(--font-display);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteBar {
  readonly label = input.required<string>();
  readonly score = input.required<number>();

  protected readonly pct = computed(() => (this.score() / 10) * 100);
  protected readonly color = computed(() => TIER_BG[scoreTier(this.score())]);
}
