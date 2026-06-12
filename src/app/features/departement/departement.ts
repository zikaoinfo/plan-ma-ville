import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-departement',
  template: `
    <section class="container page-hero">
      <span class="tag-chantier">Phase 0 — Département</span>
      <h1>Département</h1>
      <p class="sous-titre">
        Code demandé&nbsp;: <code>{{ code() }}</code> — liste des communes à venir.
      </p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Departement {
  readonly code = input.required<string>();
}
