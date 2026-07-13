import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CRITERE_LABELS, CRITERES, type Critere } from '../../core/models/data.models';
import { AuthService } from '../../core/services/auth.service';
import { AvisService } from '../../core/services/avis.service';
import { CommuneDataService } from '../../core/services/commune-data.service';
import { MetaService } from '../../core/services/meta.service';
import { PonderationService } from '../../core/services/ponderation.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { AuthGate } from '../../shared/auth-gate/auth-gate';
import { NoteBar } from '../../shared/note-bar/note-bar';
import { ProfilPicker } from '../../shared/profil-picker/profil-picker';
import { ScoreBadge } from '../../shared/score-badge/score-badge';
import { CommuneAvisForm } from './commune-avis/commune-avis-form';
import { CommuneAvisList } from './commune-avis/commune-avis-list';
import { dvfTrendPct, nearestCommunes, noteHistory } from './commune-insights';

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
  imports: [
    RouterLink,
    NoteBar,
    ScoreBadge,
    DecimalPipe,
    AuthGate,
    CommuneAvisList,
    CommuneAvisForm,
    ProfilPicker,
  ],
  templateUrl: './commune.html',
  styleUrl: './commune.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Commune {
  readonly #data = inject(CommuneDataService);
  readonly #search = inject(SearchIndexService);
  readonly #meta = inject(MetaService);
  readonly #sanitizer = inject(DomSanitizer);
  protected readonly auth = inject(AuthService);
  protected readonly avisDisponible = inject(AvisService).disponible;
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);

  /** Onglet actif de la fiche (synchronisé avec ?onglet= pour survivre au
   *  rechargement après redirection OAuth). */
  protected readonly onglet = signal<'officiel' | 'avis'>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('onglet') === 'avis' ? 'avis' : 'officiel',
  );
  /** Bump après soumission d'un avis → recharge la liste. */
  protected readonly avisVersion = signal(0);

  protected onAvisSubmitted(): void {
    this.avisVersion.update((v) => v + 1);
  }

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

  protected readonly ponderation = inject(PonderationService);

  /** Note globale repondérée selon le profil de l'utilisateur. */
  protected readonly notePerso = computed(() => {
    const c = this.commune();
    return c ? this.ponderation.note(c.score.criteres) : null;
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

  // Prix immobilier réel — agrégats DVF émis par le pipeline (cf. /methodologie).
  protected readonly prix = computed(() => this.commune()?.prix ?? null);
  protected readonly prixTrend = computed(() => {
    const p = this.prix();
    return p ? dvfTrendPct(p.histo) : null;
  });
  /** Libellé humain de la période DVF ("2025-S2" → "2ᵉ semestre 2025"). */
  protected readonly prixPeriode = computed(() => {
    const p = this.prix();
    if (!p) return '';
    const m = /^(\d{4})-S([12])$/.exec(p.periode);
    if (m) return `${m[2]}${m[2] === '1' ? 'ᵉʳ' : 'ᵉ'} semestre ${m[1]}`;
    return p.periode;
  });
  /** Sparkline SVG du prix m² (mêmes proportions que celle de la note). */
  protected readonly sparkPrix = computed(() => {
    const p = this.prix();
    if (!p || p.histo.length < 2) return null;
    const vals = p.histo.map((h) => h.v);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(1, max - min);
    const W = 100;
    const H = 32;
    const pad = 4;
    const points = p.histo
      .map((h, i) => {
        const x = (i / (p.histo.length - 1)) * (W - 2 * pad) + pad;
        const y = H - pad - ((h.v - min) / span) * (H - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return { points, first: p.histo[0], last: p.histo[p.histo.length - 1] };
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
    // Reflète l'onglet dans l'URL (?onglet=avis) : la redirection OAuth revient
    // sur cette URL, donc on retrouve l'onglet « Avis habitants » après login.
    effect(() => {
      const o = this.onglet();
      void this.#router.navigate([], {
        relativeTo: this.#route,
        queryParams: { onglet: o === 'avis' ? 'avis' : null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

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
