import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { schemaBreadcrumb, schemaItemList } from '../../core/seo/schemas';
import { CommuneDataService } from '../../core/services/commune-data.service';
import { JsonLdService } from '../../core/services/json-ld.service';
import { MetaService } from '../../core/services/meta.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ScoreBadge } from '../../shared/score-badge/score-badge';
import { introPrix, introSecurite, topPrix, topSecurite } from './palmares-logic';

export type TypePalmares = 'securite' | 'prix';

/**
 * Hub SEO départemental : « Les villes les plus sûres du {dép} » ou
 * « Les meilleurs prix au m² du {dép} » (docs/SEO-PLAN.md §P4). Le `type`
 * vient du `data` de la route (withComponentInputBinding).
 */
@Component({
  selector: 'app-palmares-departement',
  imports: [RouterLink, ScoreBadge, DecimalPipe],
  templateUrl: './palmares-departement.html',
  styleUrl: './palmares.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PalmaresDepartement {
  readonly #data = inject(CommuneDataService);
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);
  readonly #jsonLd = inject(JsonLdService);

  readonly code = input.required<string>();
  readonly type = input.required<TypePalmares>();

  readonly #file = this.#data.loadDep(this.code);

  protected readonly nom = computed(
    () => this.#file()?.nom ?? this.#search.departementName(this.code()) ?? this.code(),
  );
  protected readonly charge = computed(() => this.#file() !== undefined);

  protected readonly top = computed(() => {
    const file = this.#file();
    if (!file) return [];
    return this.type() === 'securite' ? topSecurite(file.communes) : topPrix(file.communes);
  });

  protected readonly intro = computed(() => {
    const file = this.#file();
    if (!file) return '';
    return this.type() === 'securite'
      ? introSecurite(this.nom(), file.communes, this.top())
      : introPrix(this.nom(), file.communes, this.top());
  });

  protected readonly titre = computed(() =>
    this.type() === 'securite'
      ? `Les villes les plus sûres du ${this.nom()}`
      : `Immobilier : les meilleurs prix au m² du ${this.nom()}`,
  );

  /** L'autre palmarès du même département (maillage croisé). */
  protected readonly autreType = computed<TypePalmares>(() =>
    this.type() === 'securite' ? 'prix' : 'securite',
  );

  constructor() {
    effect(() => {
      const chemin = `/palmares/${this.type()}/${this.code()}`;
      this.#meta.setPage({
        title: `${this.titre()} (${this.code()}) — ma ville, notée`,
        description:
          this.type() === 'securite'
            ? `Classement des communes les plus sûres du ${this.nom()} (${this.code()}), d'après les faits de délinquance enregistrés (SSMSI) rapportés à la population.`
            : `Les communes du ${this.nom()} (${this.code()}) au prix au m² le plus accessible, d'après les ventes immobilières réelles (base DVF).`,
        canonicalPath: chemin,
      });

      const top = this.top();
      if (top.length) {
        const region = this.#search.regionForDepartement(this.code());
        this.#jsonLd.set([
          schemaBreadcrumb([
            { nom: 'Accueil', path: '/' },
            ...(region ? [{ nom: region.nom, path: `/region/${region.code}` }] : []),
            { nom: `${this.nom()} (${this.code()})`, path: `/departement/${this.code()}` },
            { nom: this.titre() },
          ]),
          schemaItemList(
            this.titre(),
            top.map((c) => ({ nom: c.nom, path: `/ville/${c.slug}` })),
          ),
        ]);
      }
    });
  }
}
