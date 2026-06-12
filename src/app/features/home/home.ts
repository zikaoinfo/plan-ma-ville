import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CRITERE_LABELS, CRITERES } from '../../core/models/data.models';

@Component({
  selector: 'app-home',
  template: `
    <section class="container page-hero">
      <span class="tag-chantier">Phase 0 — Home</span>
      <h1>Quelle note mérite <em class="ville">votre ville</em>&nbsp;?</h1>
      <p class="sous-titre">
        35&nbsp;000 communes françaises notées sur 10, à partir de données ouvertes&nbsp;:
        la recherche arrive en phase&nbsp;2.
      </p>
      <ul class="criteres" aria-label="Critères de notation">
        @for (critere of criteres; track critere) {
          <li class="criteres__chip">{{ labels[critere] }}</li>
        }
      </ul>
    </section>
  `,
  styles: `
    .ville {
      color: var(--accent);
      font-style: italic;
    }

    .criteres {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
      max-width: 36rem;
      margin: 2rem auto 0;
      padding: 0;
      list-style: none;
    }

    .criteres__chip {
      padding: 0.35rem 0.9rem;
      border: 1.5px solid var(--line);
      border-radius: 999px;
      background: var(--paper-soft);
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--ink-soft);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;
}
