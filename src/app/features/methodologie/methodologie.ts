import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-methodologie',
  template: `
    <section class="container page-hero">
      <span class="tag-chantier">Phase 0 — Méthodologie</span>
      <h1>Méthodologie</h1>
      <p class="sous-titre">
        Comment les notes sont calculées (sources, pondérations, limites) — rédaction à venir.
      </p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Methodologie {}
