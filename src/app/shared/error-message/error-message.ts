import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Message d'erreur de chargement avec bouton « Réessayer ». */
@Component({
  selector: 'app-error-message',
  template: `
    <div class="error" role="alert">
      <p class="error__msg">{{ message() }}</p>
      <button type="button" class="error__btn" (click)="retry()()">Réessayer</button>
    </div>
  `,
  styles: `
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.9rem;
      padding: 2.5rem 1rem;
      text-align: center;
      color: var(--ink-soft);
    }

    .error__msg {
      margin: 0;
      font-weight: 500;
    }

    .error__btn {
      padding: 0.55rem 1.3rem;
      background: var(--ink);
      color: var(--paper);
      border: none;
      border-radius: 999px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .error__btn:hover {
      background: var(--accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorMessage {
  readonly message = input('Impossible de charger les données.');
  /** Callback de relance (ex. `resource.reload`). */
  readonly retry = input.required<() => void>();
}
