import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MetaService } from '../../core/services/meta.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ErrorMessage } from '../../shared/error-message/error-message';
import { TerritoireCard } from '../../shared/territoire-card/territoire-card';

/**
 * Hub « tous les départements », symétrique de `/regions`. L'accueil n'en met
 * en avant que douze : cette page est la cible du « voir tout », et le seul
 * endroit où les 101 sont listés — les empiler sur l'accueil en ferait un mur
 * sans hiérarchie.
 */
@Component({
  selector: 'app-departements',
  imports: [RouterLink, ErrorMessage, TerritoireCard],
  templateUrl: './departements.html',
  styleUrl: './departements.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Departements {
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);

  protected readonly status = this.#search.departementsStatus;

  /** Ordre par code : on vient ici pour trouver un département, pas pour le
      comparer — un tri par note ferait de cette page un palmarès de plus. */
  protected readonly departements = computed(() => this.#search.getDepartements());

  protected readonly reload = () => this.#search.reload();

  constructor() {
    effect(() =>
      this.#meta.setPage({
        title: 'Tous les départements français — ma ville, notée',
        description:
          'Les 101 départements français, avec le nombre de communes notées et la note ' +
          'moyenne de chacun. Ouvrez un département pour voir ses communes.',
        canonicalPath: '/departements',
      }),
    );
  }
}
