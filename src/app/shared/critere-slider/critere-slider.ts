import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { scoreTier, TIER_BG, TIER_FG } from '../score-color';

/** Curseur 1–10 pour un critère, avec valeur colorée. Two-way via [(value)]. */
@Component({
  selector: 'app-critere-slider',
  template: `
    <div class="cs">
      <label class="cs__label" [attr.for]="id()">{{ label() }}</label>
      <input
        class="cs__range"
        type="range"
        min="1"
        max="10"
        step="1"
        [id]="id()"
        [value]="value()"
        (input)="value.set(+$any($event.target).value)"
      />
      <span class="cs__val" [style.background]="bg()" [style.color]="fg()">{{ value() }}</span>
    </div>
  `,
  styles: `
    .cs {
      display: grid;
      grid-template-columns: 130px 1fr 2.2rem;
      align-items: center;
      gap: 0.75rem;
    }
    .cs__label {
      font-weight: 500;
      color: var(--ink-soft);
    }
    .cs__range {
      width: 100%;
      accent-color: var(--accent);
    }
    .cs__val {
      display: grid;
      place-items: center;
      min-width: 2rem;
      padding: 0.15rem 0;
      border-radius: 999px;
      font-family: var(--font-display);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 480px) {
      .cs {
        grid-template-columns: 96px 1fr 2.2rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CritereSlider {
  readonly label = input.required<string>();
  readonly value = model<number>(5);
  /** id unique pour lier le label au range. */
  readonly id = input<string>('cs');

  protected readonly bg = computed(() => TIER_BG[scoreTier(this.value())]);
  protected readonly fg = computed(() => TIER_FG[scoreTier(this.value())]);
}
