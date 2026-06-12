import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-commune',
  template: `
    <section class="container page-hero">
      <span class="tag-chantier">Phase 0 — Commune</span>
      <h1>Fiche commune</h1>
      <p class="sous-titre">
        Slug demandé&nbsp;: <code>{{ slug() }}</code> — notes détaillées à venir.
      </p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Commune {
  readonly slug = input.required<string>();
}
