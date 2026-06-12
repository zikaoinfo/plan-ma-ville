import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-classement',
  template: `
    <section class="container page-hero">
      <span class="tag-chantier">Phase 0 — Classement</span>
      <h1>Top &amp; flop national</h1>
      <p class="sous-titre">Les 50 meilleures et 50 moins bonnes communes, bientôt ici.</p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Classement {}
