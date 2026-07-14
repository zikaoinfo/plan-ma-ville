import { DOCUMENT, DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dataUrl } from '../../core/data-url';
import type { GeoLightFile } from '../../core/models/data.models';
import { schemaBreadcrumb, schemaItemList } from '../../core/seo/schemas';
import { JsonLdService } from '../../core/services/json-ld.service';
import { MetaService } from '../../core/services/meta.service';
import { ScoreBadge } from '../../shared/score-badge/score-badge';
import { AUTOUR_RAYON_KM, autourDe, introAutour } from './palmares-logic';

/**
 * Hub SEO « Où vivre autour de {grande ville} ? » : les communes les mieux
 * notées dans un rayon de 20 km, tous départements confondus (geo-light.json).
 */
@Component({
  selector: 'app-palmares-autour',
  imports: [RouterLink, ScoreBadge, DecimalPipe],
  templateUrl: './palmares-autour.html',
  styleUrl: './palmares.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PalmaresAutour {
  readonly #doc = inject(DOCUMENT);
  readonly #meta = inject(MetaService);
  readonly #jsonLd = inject(JsonLdService);

  readonly slug = input.required<string>();

  readonly #geo = httpResource<GeoLightFile>(() => dataUrl(this.#doc, 'geo-light.json'));

  protected readonly status = this.#geo.status;
  protected readonly rayon = AUTOUR_RAYON_KM;

  protected readonly centre = computed(() =>
    this.#geo.value()?.items.find((c) => c.s === this.slug()),
  );

  protected readonly proches = computed(() => {
    const centre = this.centre();
    const items = this.#geo.value()?.items;
    return centre && items ? autourDe(centre, items) : [];
  });

  protected readonly intro = computed(() => {
    const centre = this.centre();
    return centre ? introAutour(centre, this.proches()) : '';
  });

  protected readonly introuvable = computed(
    () => this.status() === 'resolved' && this.centre() === undefined,
  );

  protected readonly reload = () => this.#geo.reload();

  constructor() {
    effect(() => {
      const centre = this.centre();
      this.#meta.setPage({
        title: centre
          ? `Où vivre autour de ${centre.n} ? Les communes les mieux notées — ma ville, notée`
          : 'Où vivre autour de… — ma ville, notée',
        description: centre
          ? `Les communes les mieux notées à moins de ${AUTOUR_RAYON_KM} km de ${centre.n} : notes de qualité de vie officielles, pour choisir où s'installer.`
          : 'Les communes les mieux notées autour d’une grande ville.',
        canonicalPath: `/palmares/autour/${this.slug()}`,
        noindex: !centre, // chargement / introuvable : rien d'indexable
      });

      const proches = this.proches();
      if (centre && proches.length) {
        this.#jsonLd.set([
          schemaBreadcrumb([
            { nom: 'Accueil', path: '/' },
            { nom: centre.n, path: `/ville/${centre.s}` },
            { nom: `Où vivre autour de ${centre.n}` },
          ]),
          schemaItemList(
            `Communes les mieux notées autour de ${centre.n}`,
            proches.map((p) => ({ nom: p.item.n, path: `/ville/${p.item.s}` })),
          ),
        ]);
      }
    });
  }
}
