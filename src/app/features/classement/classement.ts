import { DecimalPipe, DOCUMENT } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dataUrl } from '../../core/data-url';
import type { ClassementEntry, ClassementFile } from '../../core/models/data.models';
import { schemaItemList } from '../../core/seo/schemas';
import { JsonLdService } from '../../core/services/json-ld.service';
import { MetaService } from '../../core/services/meta.service';
import { PonderationService } from '../../core/services/ponderation.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ErrorMessage } from '../../shared/error-message/error-message';
import { ProfilPicker } from '../../shared/profil-picker/profil-picker';
import { ScoreBadge } from '../../shared/score-badge/score-badge';

@Component({
  selector: 'app-classement',
  imports: [RouterLink, ScoreBadge, ErrorMessage, DecimalPipe, ProfilPicker],
  templateUrl: './classement.html',
  styleUrl: './classement.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Classement {
  readonly #doc = inject(DOCUMENT);
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);

  readonly #classement = httpResource<ClassementFile>(
    () => dataUrl(this.#doc, 'classement.json'),
  );

  protected readonly status = this.#classement.status;
  protected readonly tab = signal<'top' | 'flop'>('top');
  protected readonly filterDep = signal('');

  protected readonly departements = computed(() => this.#search.getDepartements());
  protected readonly populationMin = computed(() => this.#classement.value()?.populationMin ?? null);

  protected readonly ponderation = inject(PonderationService);

  protected readonly entries = computed(() => {
    const data = this.#classement.value();
    if (!data) return [];
    const base = this.tab() === 'top' ? data.top : data.flop;
    const dep = this.filterDep();
    const filtered = dep ? base.filter((e) => e.departement === dep) : base;
    if (!this.ponderation.actif()) return filtered;
    // Repondération du top/flop OFFICIEL (les 50 entrées émises) : on re-trie
    // ces communes selon le profil — sans prétendre recalculer un top national.
    const sens = this.tab() === 'top' ? -1 : 1;
    return [...filtered].sort(
      (a, b) => sens * (this.notePerso(a) - this.notePerso(b)) || a.slug.localeCompare(b.slug),
    );
  });

  /** Note repondérée d'une entrée. Repli sur la note officielle si le
   *  classement.json servi précède l'ajout des critères (données en vol). */
  protected notePerso(e: ClassementEntry): number {
    return e.criteres ? this.ponderation.note(e.criteres) : e.global;
  }

  protected readonly reload = () => this.#classement.reload();

  readonly #jsonLd = inject(JsonLdService);

  constructor() {
    effect(() => {
      this.#meta.setPage({
        title: 'Classement des communes — ma ville, notée',
        description:
          'Les meilleures et les pires communes françaises selon leur note globale sur 10.',
        canonicalPath: '/classement',
      });

      // ItemList = le top 50 OFFICIEL (stable, indépendant des filtres UI).
      const top = this.#classement.value()?.top ?? [];
      if (top.length) {
        this.#jsonLd.set([
          schemaItemList(
            'Meilleures communes de France par note de qualité de vie',
            top.map((e) => ({ nom: e.nom, path: `/ville/${e.slug}` })),
          ),
        ]);
      }
    });
  }

  protected setTab(tab: 'top' | 'flop'): void {
    this.tab.set(tab);
  }
}
