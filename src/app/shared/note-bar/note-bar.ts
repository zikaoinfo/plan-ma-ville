import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { scoreTier, TIER_VAR } from '../score-color';

/**
 * Ligne « label — barre proportionnelle — note » pour un critère /10.
 *
 * `moyenne` (optionnelle) pose un repère sur la piste : une note absolue ne
 * dit pas grand-chose, la même note lue CONTRE la moyenne du département en
 * dit beaucoup. Absente (aucune commune de comparaison externe), la barre
 * reste strictement absolue plutôt que de se comparer à une valeur inventée.
 */
@Component({
  selector: 'app-note-bar',
  template: `
    <div
      class="note-bar"
      role="progressbar"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-valuenow]="score()"
      aria-valuemin="0"
      aria-valuemax="10"
    >
      <span class="note-bar__label">{{ label() }}</span>
      <span class="note-bar__track">
        <span class="note-bar__fill" [style.width.%]="pct()" [style.background]="color()"></span>
        @if (moyenne() !== null) {
          <span class="note-bar__repere" [style.left.%]="pctMoyenne()" aria-hidden="true"></span>
        }
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
      position: relative;
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

    /* Repère « moyenne du département » : trait vertical à l'encre, lisible
       sur le remplissage comme sur la piste vide dans les deux thèmes. La
       valeur est donnée en toutes lettres aux lecteurs d'écran. */
    .note-bar__repere {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      margin-left: -1px;
      background: var(--ink);
      border-radius: 1px;
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
  /** Moyenne de comparaison (département) ; `null` = aucun repère affiché. */
  readonly moyenne = input<number | null>(null);

  protected readonly pct = computed(() => (this.score() / 10) * 100);
  protected readonly pctMoyenne = computed(() => ((this.moyenne() ?? 0) / 10) * 100);

  /* Le rôle progressbar n'expose pas le contenu de l'élément : la moyenne de
     comparaison doit entrer dans l'étiquette, sinon elle n'existe que pour
     les voyants. */
  protected readonly ariaLabel = computed(() => {
    const m = this.moyenne();
    return m === null
      ? this.label()
      : `${this.label()} — moyenne du département ${m.toFixed(1)} sur 10`;
  });
  protected readonly color = computed(() => TIER_VAR[scoreTier(this.score())]);
}
