import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CRITERE_LABELS, CRITERES, type Critere } from '../../core/models/data.models';
import { CommuneDataService } from '../../core/services/commune-data.service';
import { MetaService } from '../../core/services/meta.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { NoteBar } from '../../shared/note-bar/note-bar';
import { ScoreBadge } from '../../shared/score-badge/score-badge';
import {
  estimatePriceM2,
  nearestCommunes,
  noteHistory,
  priceTrendPct,
} from './commune-insights';

const ICONS: Record<Critere, string> = {
  securite: '🛡️',
  sante: '🏥',
  commerces: '🛒',
  enseignement: '🎓',
  sports: '🏟️',
  culture: '🎭',
  transports: '🚆',
  niveauVie: '💶',
};

@Component({
  selector: 'app-commune',
  imports: [RouterLink, NoteBar, ScoreBadge, DecimalPipe],
  templateUrl: './commune.html',
  styleUrl: './commune.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Commune {
  readonly #data = inject(CommuneDataService);
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);
  readonly #sanitizer = inject(DomSanitizer);

  readonly slug = input.required<string>();

  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;
  protected readonly icons = ICONS;

  readonly #commune = this.#data.getCommuneBySlug(this.slug);
  readonly #state = this.#commune.state;

  protected readonly status = computed(() =>
    typeof this.#state() === 'string' ? (this.#state() as 'loading' | 'not-found') : 'ok',
  );
  protected readonly commune = computed(() => {
    const s = this.#state();
    return typeof s === 'string' ? null : s;
  });

  protected readonly depCode = computed(() => this.#search.findBySlug(this.slug())?.d ?? '');
  protected readonly depNom = computed(
    () => this.#search.departementName(this.depCode()) ?? this.depCode(),
  );

  // Communes voisines, depuis le même fichier département (une seule requête).
  protected readonly voisins = computed(() => {
    const c = this.commune();
    const f = this.#commune.depFile();
    return c && f ? nearestCommunes(c, f.communes, 6) : [];
  });

  // Estimations indicatives, déterministes (cf. /methodologie).
  protected readonly prixM2 = computed(() => {
    const c = this.commune();
    return c ? estimatePriceM2(c) : null;
  });
  protected readonly prixTrend = computed(() => {
    const c = this.commune();
    return c ? priceTrendPct(c) : 0;
  });
  protected readonly historique = computed(() => {
    const c = this.commune();
    return c ? noteHistory(c, new Date().getFullYear()) : [];
  });

  /** Sparkline SVG (polyline) de l'historique de la note. */
  protected readonly spark = computed(() => {
    const h = this.historique();
    if (h.length < 2) return null;
    const notes = h.map((p) => p.note);
    const min = Math.min(...notes);
    const max = Math.max(...notes);
    const span = Math.max(0.4, max - min);
    const W = 100;
    const H = 32;
    const pad = 4;
    const points = h
      .map((p, i) => {
        const x = (i / (h.length - 1)) * (W - 2 * pad) + pad;
        const y = H - pad - ((p.note - min) / span) * (H - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const delta = Math.round((h[h.length - 1].note - h[0].note) * 10) / 10;
    return { points, first: h[0], last: h[h.length - 1], delta };
  });

  /** URL de carte OpenStreetMap (iframe), assainie pour l'embed. */
  protected readonly mapUrl = computed<SafeResourceUrl | null>(() => {
    const c = this.commune();
    if (!c || c.lat === undefined || c.lon === undefined) return null;
    const d = 0.04;
    const bbox = [c.lon - d, c.lat - d, c.lon + d, c.lat + d].map((n) => n.toFixed(5)).join('%2C');
    const url =
      `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}` +
      `&layer=mapnik&marker=${c.lat.toFixed(5)}%2C${c.lon.toFixed(5)}`;
    return this.#sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  /** Lien « voir en grand » vers openstreetmap.org. */
  protected readonly mapLink = computed(() => {
    const c = this.commune();
    if (!c || c.lat === undefined || c.lon === undefined) return null;
    return `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=13/${c.lat}/${c.lon}`;
  });

  constructor() {
    effect(() => {
      const s = this.#state();
      if (s === 'loading') {
        this.#meta.setPage({
          title: 'Chargement… — ma ville, notée',
          description: 'Chargement de la fiche commune.',
          canonicalPath: `/ville/${this.slug()}`,
        });
      } else if (s === 'not-found') {
        this.#meta.setPage({
          title: 'Commune introuvable — ma ville, notée',
          description: "Cette commune n'existe pas dans notre base.",
          canonicalPath: `/ville/${this.slug()}`,
        });
      } else {
        const cr = s.score.criteres;
        this.#meta.setPage({
          title: `${s.nom} (${this.depCode()}) — note ${s.score.global.toFixed(1)}/10 — ma ville, notée`,
          description:
            `${s.nom} : note globale ${s.score.global.toFixed(1)}/10. ` +
            `Sécurité ${cr.securite}, santé ${cr.sante}, transports ${cr.transports}, ` +
            `niveau de vie ${cr.niveauVie}.`,
          canonicalPath: `/ville/${s.slug}`,
        });
      }
    });
  }
}
