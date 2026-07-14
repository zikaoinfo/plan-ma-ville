import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CRITERE_LABELS, CRITERES } from '../../core/models/data.models';
import { POIDS_OFFICIELS } from '../../core/ponderation';
import { schemaDataset } from '../../core/seo/schemas';
import { JsonLdService } from '../../core/services/json-ld.service';
import { MetaService } from '../../core/services/meta.service';

@Component({
  selector: 'app-methodologie',
  imports: [RouterLink],
  templateUrl: './methodologie.html',
  styleUrl: './methodologie.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Methodologie {
  readonly #meta = inject(MetaService);

  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;
  /** Source de vérité unique (core/ponderation) — plus de copie locale. */
  protected readonly ponderations = POIDS_OFFICIELS;

  readonly #jsonLd = inject(JsonLdService);

  constructor() {
    effect(() => {
      this.#meta.setPage({
        title: 'Méthodologie — ma ville, notée',
        description:
          'Comment sont calculées les notes des communes : critères, pondérations, sources et limites.',
        canonicalPath: '/methodologie',
      });
      this.#jsonLd.set([schemaDataset()]);
    });
  }
}
