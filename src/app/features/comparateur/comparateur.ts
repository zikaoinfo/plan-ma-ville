import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CRITERE_LABELS, CRITERES, type CommuneDetail } from '../../core/models/data.models';
import { CommuneDataService } from '../../core/services/commune-data.service';
import { MetaService } from '../../core/services/meta.service';
import { PonderationService } from '../../core/services/ponderation.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { ProfilPicker } from '../../shared/profil-picker/profil-picker';
import { scoreTier, TIER_BG } from '../../shared/score-color';

const MAX_VILLES = 3;

@Component({
  selector: 'app-comparateur',
  imports: [RouterLink, DecimalPipe, ProfilPicker],
  templateUrl: './comparateur.html',
  styleUrl: './comparateur.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comparateur {
  readonly #data = inject(CommuneDataService);
  readonly #search = inject(SearchIndexService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #meta = inject(MetaService);

  protected readonly max = MAX_VILLES;
  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;

  // Jusqu'à 3 emplacements fixes créés en contexte d'injection (une ressource
  // httpResource chacun, inactive tant que le slug est vide).
  readonly #slugs = [signal(''), signal(''), signal('')];
  readonly #slots = this.#slugs.map((s) => this.#data.getCommuneBySlug(s));

  protected readonly query = signal('');
  protected readonly suggestions = computed(() =>
    this.query().trim().length >= 2 ? this.#search.search(this.query()) : [],
  );

  /** Colonnes actives (slug non vide) avec leur état résolu. */
  protected readonly colonnes = computed(() =>
    this.#slugs
      .map((s, i) => ({ slug: s(), index: i, state: this.#slots[i].state() }))
      .filter((c) => c.slug !== ''),
  );

  protected readonly nbVilles = computed(() => this.colonnes().length);
  protected readonly full = computed(() => this.nbVilles() >= MAX_VILLES);

  /** CommuneDetail par colonne (null si en chargement / introuvable). */
  readonly #communes = computed(() =>
    this.colonnes().map((c) => (typeof c.state === 'object' ? c.state : null)),
  );

  constructor() {
    this.#meta.setPage({
      title: 'Comparateur de communes — ma ville, notée',
      description: 'Comparez jusqu’à 3 communes françaises critère par critère.',
      canonicalPath: '/comparer',
    });

    const villes = this.#route.snapshot.queryParamMap.get('villes');
    if (villes) {
      [...new Set(villes.split(',').filter(Boolean))] // dédoublonne les slugs de l'URL
        .slice(0, MAX_VILLES)
        .forEach((slug, i) => this.#slugs[i].set(slug));
    }
  }

  protected addVille(slug: string): void {
    this.query.set('');
    if (this.full() || this.#slugs.some((s) => s() === slug)) return;
    this.#slugs.find((s) => s() === '')?.set(slug);
    this.#syncUrl();
  }

  protected removeVille(index: number): void {
    this.#slugs[index].set('');
    // recompacte pour éviter les trous entre colonnes
    const restants = this.#slugs.map((s) => s()).filter(Boolean);
    this.#slugs.forEach((s, i) => s.set(restants[i] ?? ''));
    this.#syncUrl();
  }

  /** Villes effectivement chargées (colonnes résolues). */
  readonly #chargees = computed(() =>
    this.#communes().filter((c): c is CommuneDetail => c !== null),
  );

  // Meilleures valeurs par ligne, précalculées (computed) au lieu d'être
  // re-balayées à chaque cellule du tableau à chaque rendu.
  readonly #meilleursCriteres = computed(() => {
    const chargees = this.#chargees();
    const map = {} as Record<(typeof CRITERES)[number], number | null>;
    for (const critere of CRITERES) {
      const vals = chargees.map((c) => c.score.criteres[critere]);
      map[critere] = vals.length ? Math.max(...vals) : null;
    }
    return map;
  });

  /** Meilleure valeur d'un critère parmi les villes chargées (pour surligner). */
  protected meilleureCritere(critere: (typeof CRITERES)[number]): number | null {
    return this.#meilleursCriteres()[critere];
  }

  protected readonly meilleureGlobale = computed(() => {
    const vals = this.#chargees().map((c) => c.score.global);
    return vals.length ? Math.max(...vals) : null;
  });

  protected readonly ponderation = inject(PonderationService);

  /** Note repondérée d'une commune selon le profil utilisateur. */
  protected notePerso(c: CommuneDetail): number {
    return this.ponderation.note(c.score.criteres);
  }

  protected readonly meilleurePerso = computed(() => {
    const vals = this.#chargees().map((c) => this.notePerso(c));
    return vals.length ? Math.max(...vals) : null;
  });

  protected couleur(note: number): string {
    return TIER_BG[scoreTier(note)];
  }

  protected communeAt(index: number): CommuneDetail | null {
    return this.#communes()[index] ?? null;
  }

  #syncUrl(): void {
    const villes = this.#slugs.map((s) => s()).filter(Boolean).join(',');
    this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: villes ? { villes } : {},
      replaceUrl: true,
    });
  }
}
