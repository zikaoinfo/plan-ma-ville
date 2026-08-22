import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CRITERE_LABELS, CRITERES, type Critere, type CommuneStats } from '../../core/models/data.models';
import { fmtDateFr } from '../../core/format';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AuthService } from '../../core/services/auth.service';
import { AvisService } from '../../core/services/avis.service';
import { schemaBreadcrumb, schemaFaq, schemaPlace, type Miette } from '../../core/seo/schemas';
import { CommuneDataService } from '../../core/services/commune-data.service';
import { JsonLdService } from '../../core/services/json-ld.service';
import { MetaService } from '../../core/services/meta.service';
import { PonderationService } from '../../core/services/ponderation.service';
import { SearchIndexService } from '../../core/services/search-index.service';
import { AuthGate } from '../../shared/auth-gate/auth-gate';
import { NoteBar } from '../../shared/note-bar/note-bar';
import { ProfilPicker } from '../../shared/profil-picker/profil-picker';
import { ScoreBadge } from '../../shared/score-badge/score-badge';
import { CommuneAvisForm } from './commune-avis/commune-avis-form';
import { CommuneAvisList } from './commune-avis/commune-avis-list';
import {
  communesSimilaires,
  dvfTrendPct,
  filtrerBassinVoisinage,
  libellePeriodeDvf,
  nearestCommunes,
} from './commune-insights';
import { lignesClassement } from './commune-classements';
import { blocDemographie } from './commune-demographie';
import { RAPPEL_METHODE } from '../methodologie/methodologie-chiffres';
import { genereFaqCommune } from './commune-faq';
import { genereTexteCommune } from './commune-texte';

/** Seuil des pages « Où vivre autour de {ville} » — aligné sur
 *  `hubAutourMinPopulation` de scoring.config.json. */
const HUB_AUTOUR_MIN_POP = 50000;

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
  readonly #jsonLd = inject(JsonLdService);
  readonly #sanitizer = inject(DomSanitizer);
  protected readonly auth = inject(AuthService);
  readonly #avis = inject(AvisService);
  protected readonly avisDisponible = this.#avis.disponible;
  readonly #analytics = inject(AnalyticsService);

  /** Note moyenne des habitants (affichage seul — n'entre pas dans la note
   *  officielle pondérée, cf. onglet « Avis habitants »). */
  protected readonly avisStats = signal<CommuneStats | null>(null);

  /** Note habitants prête à afficher (null tant qu'aucun avis publié). */
  protected readonly noteHabitants = computed(() => {
    const s = this.avisStats();
    return s && s.nb_avis > 0 && s.note_habitants !== null
      ? { note: s.note_habitants, nb: s.nb_avis }
      : null;
  });
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);

  /** Onglet actif de la fiche (synchronisé avec ?onglet= pour survivre au
   *  rechargement après redirection OAuth). */
  protected readonly onglet = signal<'officiel' | 'avis'>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('onglet') === 'avis' ? 'avis' : 'officiel',
  );
  /** Bump après soumission d'un avis → recharge la liste. */
  protected readonly avisVersion = signal(0);

  /** Ouverture de l'onglet « Avis habitants » (formulaire visible). */
  protected openOnglet(onglet: 'officiel' | 'avis'): void {
    this.onglet.set(onglet);
    if (onglet === 'avis') {
      this.#analytics.track('avis_start', { ville: this.#slug() });
    }
  }

  protected onAvisSubmitted(): void {
    this.avisVersion.update((v) => v + 1);
    this.#analytics.track('avis_submit', { ville: this.#slug() });
  }

  readonly slug = input.required<string>();

  /** Slug canonique (minuscules) : les données/URL sont résolues avec lui,
   *  même si l'URL saisie contient des majuscules. */
  readonly #slug = computed(() => this.slug().toLowerCase());

  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;
  protected readonly icons = ICONS;

  readonly #commune = this.#data.getCommuneBySlug(this.#slug);
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

  protected readonly depCode = computed(() => this.#search.findBySlug(this.#slug())?.d ?? '');
  protected readonly depNom = computed(
    () => this.#search.departementName(this.depCode()) ?? this.depCode(),
  );

  /** Pour un arrondissement : sa commune mère (fil d'Ariane « Ville »). */
  protected readonly communeMere = computed(() => this.commune()?.communeMere ?? null);
  /** Pour Paris/Lyon/Marseille : ses arrondissements, notés individuellement. */
  protected readonly arrondissements = computed(() => this.commune()?.arrondissements ?? []);

  // Communes voisines, depuis le même fichier département (une seule requête).
  // Le bassin exclut la commune mère / les arrondissements déjà reliés
  // ailleurs sur la fiche (fil d'Ariane, section « ses arrondissements »).
  protected readonly voisins = computed(() => {
    const c = this.commune();
    const f = this.#commune.depFile();
    return c && f ? nearestCommunes(c, filtrerBassinVoisinage(c, f.communes), 6) : [];
  });

  // Texte éditorial (SEO) : réponse directe + sections, dérivés des données
  // réelles — présent dans le HTML prérendu (cf. docs/SEO-PLAN.md, P1).
  protected readonly texte = computed(() => {
    const c = this.commune();
    const f = this.#commune.depFile();
    return c && f ? genereTexteCommune(c, f.communes, this.depNom()) : null;
  });

  /** Rappel de méthode, source unique partagée avec /methodologie. */
  protected readonly rappelMethode = RAPPEL_METHODE;

  /** Coordonnées officielles de la mairie (annuaire service-public.fr). */
  protected readonly mairie = computed(() => this.commune()?.mairie ?? null);

  /**
   * Bloc « Population » : pyramide des âges, sexes, CSP (INSEE, recensement).
   * `null` quand la source ne couvre pas la commune — le bloc disparaît alors
   * plutôt que d'afficher une répartition vide.
   */
  protected readonly demographie = computed(() => blocDemographie(this.commune()?.demographie));

  /**
   * Classements national / départemental / par strate, lus dans les données
   * (le pipeline les calcule une fois pour tout le site). `null` tant que les
   * données ne portent pas le champ : mieux vaut ne rien afficher qu'un rang
   * recalculé côté client, qui contredirait la prose et la FAQ.
   */
  protected readonly classements = computed(() => {
    const c = this.commune();
    return c ? lignesClassement(c, this.depNom()) : null;
  });

  /**
   * Communes au profil de notes le plus proche (maillage interne, §3 du plan
   * de croissance). Complète « Aux alentours », purement géographique : les
   * voisines déjà affichées sont exclues pour que la section apporte de
   * NOUVEAUX chemins de crawl, pas les mêmes liens une seconde fois.
   */
  protected readonly similaires = computed(() => {
    const c = this.commune();
    const f = this.#commune.depFile();
    if (!c || !f) return [];
    return communesSimilaires(
      c,
      f.communes,
      this.voisins().map((v) => v.commune.slug),
      5,
    );
  });

  // FAQ générée depuis les mêmes données que la prose (commune-contexte.ts
  // garantit qu'elles ne peuvent pas se contredire). Affichée dans un
  // accordéon ET balisée en JSON-LD FAQPage : le balisage ne doit jamais
  // décrire autre chose que ce qui est à l'écran.
  protected readonly faq = computed(() => {
    const c = this.commune();
    const f = this.#commune.depFile();
    return c && f ? genereFaqCommune(c, f.communes, this.depNom()) : [];
  });

  /** Grande ville → lien vers son hub « Où vivre autour de {ville} ». */
  protected readonly aHubAutour = computed(
    () => (this.commune()?.population ?? 0) >= HUB_AUTOUR_MIN_POP,
  );

  // Prix immobilier réel — agrégats DVF émis par le pipeline (cf. /methodologie).
  protected readonly prix = computed(() => this.commune()?.prix ?? null);
  protected readonly prixTrend = computed(() => {
    const p = this.prix();
    return p ? dvfTrendPct(p.histo) : null;
  });
  /**
   * Variation en valeur absolue : la flèche ▲/▼ porte déjà le sens, afficher
   * « ▼ -3,2 % » doublerait la négation. Le formatage français (virgule
   * décimale) passe par le pipe `number` — l'interpolation brute d'un nombre
   * ne localise pas, d'où le « 8.7 % » anglais affiché jusqu'ici.
   */
  protected readonly prixTrendAbs = computed(() => {
    const t = this.prixTrend();
    return t === null ? null : Math.abs(t);
  });
  /** Libellé humain de la période DVF ("2025-S2" → "2ᵉ semestre 2025").
   *  Helper partagé avec la FAQ (commune-insights) : une seule formulation. */
  protected readonly prixPeriode = computed(() => {
    const p = this.prix();
    return p ? libellePeriodeDvf(p.periode) : '';
  });
  /** Détail entre parenthèses (« Médiane des ventes (…) ») : période et/ou
   *  nombre de ventes, sans virgule orpheline quand l'un des deux est absent. */
  protected readonly prixDetailTxt = computed(() => {
    const p = this.prix();
    if (!p) return '';
    const parts = [this.prixPeriode(), p.nb ? `${p.nb.toLocaleString('fr-FR')} ventes` : ''].filter(
      (part) => part !== '',
    );
    return parts.join(', ');
  });
  /**
   * Ventilation maison / appartement, quand le millésime DVF la publie. Un
   * prix résidentiel unique mélange deux marchés qui n'évoluent pas de la
   * même façon ; on n'affiche la ligne que si la source la distingue
   * réellement (pas de répartition recopiée sur l'agrégat).
   */
  protected readonly prixParType = computed(() => {
    const p = this.prix();
    if (!p) return [];
    const tendance = (histo: { p: string; v: number }[]) => {
      const t = dvfTrendPct(histo);
      return { tendance: t, tendanceAbs: t === null ? null : Math.abs(t) };
    };
    return [
      ...(p.maison ? [{ label: 'Maisons', ...p.maison, ...tendance(p.maison.histo) }] : []),
      ...(p.appartement
        ? [{ label: 'Appartements', ...p.appartement, ...tendance(p.appartement.histo) }]
        : []),
    ];
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
  /** Date de génération des données de la commune (pas de fausse trajectoire
   *  historique : on n'a qu'un instantané par build, cf. Méthodologie). */
  protected readonly derniereMiseAJour = computed(() => {
    const gen = this.#commune.depFile()?.gen;
    return gen ? fmtDateFr(gen) : null;
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
    // Note moyenne des habitants (badge affiché à côté des notes officielles) :
    // rechargée quand la commune change et après soumission d'un nouvel avis.
    effect(() => {
      const c = this.commune();
      this.avisVersion();
      if (!c || !this.avisDisponible) {
        this.avisStats.set(null);
        return;
      }
      void this.#avis.loadStats(c.codeInsee).then((s) => this.avisStats.set(s));
    });

    // URL canonique : les slugs de l'index sont en minuscules. Une URL avec
    // majuscules (/ville/Lyon-69123) est réécrite vers la forme canonique
    // (les données, elles, sont déjà résolues via #slug — la réécriture est
    // cosmétique/SEO). setTimeout : sortir du cycle de navigation en cours,
    // sinon le navigate est avalé par la navigation initiale.
    effect(() => {
      const brut = this.slug();
      const canonique = this.#slug();
      if (brut !== canonique) {
        setTimeout(() => {
          void this.#router.navigate(['/ville', canonique], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
            preserveFragment: true, // ne pas avaler #access_token (retour OAuth)
          });
        });
      }
    });

    // Reflète l'onglet dans l'URL (?onglet=avis) : la redirection OAuth revient
    // sur cette URL, donc on retrouve l'onglet « Avis habitants » après login.
    effect(() => {
      const o = this.onglet();
      void this.#router.navigate([], {
        relativeTo: this.#route,
        queryParams: { onglet: o === 'avis' ? 'avis' : null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
        // Le client Supabase (chargé en différé) lit #access_token dans l'URL
        // au retour OAuth : cette réécriture ne doit JAMAIS l'avaler.
        preserveFragment: true,
      });
    });

    effect(() => {
      const s = this.#state();
      if (s === 'loading') {
        this.#meta.setPage({
          title: 'Chargement… — ma ville, notée',
          description: 'Chargement de la fiche commune.',
          canonicalPath: `/ville/${this.#slug()}`,
          // PAS de noindex ici : cet état est TRANSITOIRE et la page est
          // prérendue avec son contenu. Googlebot exécute le JS et prend un
          // instantané du DOM ; s'il le prend pendant le chargement de
          // `dep/{code}.json`, un noindex posé ici désindexe une page
          // parfaitement valide (cause de « Exclue par balise noindex » en
          // Search Console). Seul l'état 'not-found', définitif, le mérite.
        });
      } else if (s === 'not-found') {
        this.#meta.setPage({
          title: 'Commune introuvable — ma ville, notée',
          description: "Cette commune n'existe pas dans notre base.",
          canonicalPath: `/ville/${this.#slug()}`,
          noindex: true, // soft-404 : ne pas indexer
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

        // JSON-LD : fil d'Ariane (avec la région si résolue) + entité Place.
        // Hiérarchie Région > Département > Ville > Arrondissement : un
        // arrondissement insère sa commune mère entre le département et lui.
        const region = this.#search.regionForDepartement(this.depCode());
        const mere = s.communeMere;
        const miettes: Miette[] = [
          { nom: 'Accueil', path: '/' },
          ...(region ? [{ nom: region.nom, path: `/region/${region.code}` }] : []),
          { nom: this.depNom(), path: `/departement/${this.depCode()}` },
          ...(mere ? [{ nom: mere.nom, path: `/ville/${mere.slug}` }] : []),
          { nom: s.nom },
        ];
        const faq = schemaFaq(this.faq());
        this.#jsonLd.set(
          [schemaBreadcrumb(miettes), schemaPlace(s, this.depNom()), faq].filter(
            (x): x is object => x !== null,
          ),
        );
      }
    });
  }
}
