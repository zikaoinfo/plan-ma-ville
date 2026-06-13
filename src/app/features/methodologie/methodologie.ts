import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CRITERE_LABELS, CRITERES, type Critere } from '../../core/models/data.models';
import { MetaService } from '../../core/services/meta.service';

const PONDERATIONS: Record<Critere, number> = {
  securite: 1.5,
  sante: 1.2,
  commerces: 1.0,
  enseignement: 1.0,
  sports: 0.8,
  culture: 0.8,
  transports: 1.2,
  niveauVie: 1.0,
};

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
  protected readonly ponderations = PONDERATIONS;

  constructor() {
    effect(() =>
      this.#meta.setPage({
        title: 'Méthodologie — ma ville, notée',
        description:
          'Comment sont calculées les notes des communes : critères, pondérations, sources et limites.',
        canonicalPath: '/methodologie',
      }),
    );
  }
}
