import { DecimalPipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AnalyticsService } from '../../core/services/analytics.service';
import { MetaService } from '../../core/services/meta.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import {
  NB_CRITERES,
  NB_SOURCES,
  NB_SOURCES_NOTE,
} from '../methodologie/methodologie-chiffres';
import { ErrorMessage } from '../../shared/error-message/error-message';
import { ScoreBadge } from '../../shared/score-badge/score-badge';
import { TerritoireCard } from '../../shared/territoire-card/territoire-card';
import { departementsVedette } from './departements-vedette';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ScoreBadge, ErrorMessage, DecimalPipe, TerritoireCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);
  readonly #analytics = inject(AnalyticsService);
  readonly #router = inject(Router);
  readonly #doc = inject(DOCUMENT);

  protected readonly query = signal('');
  protected readonly ready = this.#search.ready;
  protected readonly indexStatus = this.#search.indexStatus;
  protected readonly departementsStatus = this.#search.departementsStatus;

  protected readonly results = computed(() => this.#search.search(this.query()));
  protected readonly departements = computed(() => this.#search.getDepartements());

  /** Sélection mise en avant sur l'accueil (critère assumé dans le gabarit). */
  protected readonly vedettes = computed(() => departementsVedette(this.departements()));

  /**
   * true quand la grille montre TOUS les départements disponibles — cas des
   * jeux de données partiels (`data:sample`) et des premiers déploiements.
   * On n'annonce alors pas « les N plus peuplés » : la sélection n'en est pas
   * une, et une légende qui décrit autre chose que ce qui est à l'écran est
   * un chiffre inventé de plus.
   */
  protected readonly vedettesExhaustives = computed(
    () => this.vedettes().length === this.departements().length,
  );

  /** Les 18 régions tiennent en une section : l'accueil les liste toutes. */
  protected readonly regions = computed(() => this.#search.getRegions());
  protected readonly regionsStatus = this.#search.regionsStatus;
  protected readonly reloadRegions = () => this.#search.reloadRegions();

  /* Chiffres de preuve : lus dans la source unique de /methodologie
     (`methodologie-chiffres.ts`) plutôt qu'écrits dans le gabarit — une
     source ajoutée sans mettre à jour la home ferait mentir la page
     d'accueil sur la méthode du site. */
  protected readonly nbCriteres = NB_CRITERES;
  protected readonly nbSources = NB_SOURCES;
  protected readonly nbSourcesNote = NB_SOURCES_NOTE;

  /** Nombre de communes couvertes, SOMMÉ sur les départements chargés :
      `null` tant que la liste n'est pas là — pas de nombre rond décoratif. */
  protected readonly nbCommunes = computed(() => {
    const deps = this.departements();
    return deps.length ? deps.reduce((n, d) => n + d.nbCommunes, 0) : null;
  });

  /** true dès qu'une recherche exploitable a été tapée mais ne renvoie rien. */
  protected readonly noResult = computed(
    () => this.query().trim().length >= 2 && this.results().length === 0 && this.ready(),
  );

  // ── Panneau de suggestions (combobox) ──────────────────────────
  /** Fermé par Échap ou perte de focus ; rouvert à la saisie/au focus. */
  readonly #panelOpen = signal(false);
  /** Option surlignée au clavier (-1 : aucune). */
  protected readonly activeIndex = signal(-1);

  protected readonly panelVisible = computed(
    () => this.#panelOpen() && this.query().trim().length >= 2,
  );

  /** id de l'option active (aria-activedescendant), null sinon. */
  protected readonly activeId = computed(() => {
    const i = this.activeIndex();
    return this.panelVisible() && i >= 0 && i < this.results().length
      ? `search-opt-${i}`
      : null;
  });

  protected readonly reload = () => this.#search.reload();

  /** Nom du département (fallback sur le code si departements.json n'est pas
   * encore chargé) — affiché en évidence dans les résultats pour distinguer
   * les communes homonymes (ex. plusieurs « Saint-Denis »). */
  protected depLabel(code: string): string {
    return this.#search.departementName(code) ?? code;
  }

  /** Recherche effectuée (commune sélectionnée), pas à chaque frappe. */
  protected selectResult(slug: string): void {
    this.#analytics.track('recherche_query', { requete: this.query().trim(), ville: slug });
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.activeIndex.set(-1);
    this.#panelOpen.set(true);
  }

  protected openPanel(): void {
    this.#panelOpen.set(true);
  }

  /** Ferme le panneau quand le focus sort du bloc de recherche. */
  protected onFocusOut(event: FocusEvent): void {
    const dest = event.relatedTarget as Node | null;
    const wrapper = event.currentTarget as Node;
    if (!dest || !wrapper.contains(dest)) this.#panelOpen.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.panelVisible()) return;
    const nb = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!nb) return;
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = (this.activeIndex() + delta + nb) % nb;
        this.activeIndex.set(next);
        this.#doc.getElementById(`search-opt-${next}`)?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'Enter': {
        if (!nb) return;
        event.preventDefault();
        const item = this.results()[Math.max(this.activeIndex(), 0)];
        this.selectResult(item.s);
        void this.#router.navigate(['/ville', item.s]);
        break;
      }
      case 'Escape':
        event.preventDefault();
        this.#panelOpen.set(false);
        this.activeIndex.set(-1);
        break;
    }
  }

  constructor() {
    effect(() =>
      this.#meta.setPage({
        title: 'ma ville, notée — la qualité de vie des communes françaises',
        description:
          'La note sur 10 de chaque commune française : sécurité, santé, commerces, ' +
          'enseignement, sports, culture, transports et niveau de vie.',
        canonicalPath: '/',
      }),
    );
  }
}
