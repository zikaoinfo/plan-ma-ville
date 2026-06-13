import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Placeholder animé générique : N lignes de hauteurs variées. */
@Component({
  selector: 'app-page-skeleton',
  template: `
    <div class="skeleton" role="status" aria-label="Chargement en cours">
      <div class="sk sk--title"></div>
      @for (line of lines(); track $index) {
        <div class="sk sk--line" [style.width.%]="line"></div>
      }
    </div>
  `,
  styles: `
    .skeleton {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      padding: 1.5rem 0;
    }

    .sk {
      height: 1rem;
      border-radius: 8px;
      background: linear-gradient(
        90deg,
        var(--paper-soft) 25%,
        var(--line) 50%,
        var(--paper-soft) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.3s ease infinite;
    }

    .sk--title {
      height: 2.2rem;
      width: 55%;
      margin-bottom: 0.6rem;
    }

    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sk {
        animation-duration: 3s;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageSkeleton {
  /** Largeurs (%) des lignes sous le titre. */
  readonly lines = input<number[]>([90, 75, 82, 60]);
}
