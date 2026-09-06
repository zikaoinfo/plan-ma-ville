import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
import { AccentService, type AccentPref } from './core/services/accent.service';
import { ThemeService, type ThemePref } from './core/services/theme.service';
import { UpdateService } from './core/services/update.service';
import { PonderationService } from './core/services/ponderation.service';
import { profilById } from './core/ponderation';
import { SOURCES } from './features/methodologie/methodologie-chiffres';

/** Options du sélecteur de thème (ordre d'affichage). */
const THEME_OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'light', label: 'Clair', icon: '☀️' },
  { value: 'dark', label: 'Sombre', icon: '🌙' },
  { value: 'system', label: 'Système', icon: '💻' },
];

/** Options du sélecteur d'accent (pastilles colorées via --swatch-*). */
const ACCENT_OPTIONS: { value: AccentPref; label: string }[] = [
  { value: 'orange', label: 'Orange' },
  { value: 'jaune', label: 'Jaune' },
  { value: 'vert', label: 'Vert' },
  { value: 'bleu', label: 'Bleu' },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly accentService = inject(AccentService);
  protected readonly maj = inject(UpdateService);
  protected readonly ponderation = inject(PonderationService);
  protected readonly annee = new Date().getFullYear();

  /* Les sources et leur millésime en pied de CHAQUE page : c'est l'argument
     du site (traçabilité) — le reléguer à /methodologie revenait à ne le
     montrer qu'aux visiteurs déjà convaincus. Source unique partagée avec
     cette page. */
  protected readonly sources = SOURCES;

  /** Profil de pondération actif (« Officiel » par défaut) pour le menu compte. */
  protected readonly profilActif = computed(() => profilById(this.ponderation.profil()));

  protected readonly menuOpen = signal(false);
  protected readonly navOpen = signal(false);
  protected readonly themeMenuOpen = signal(false);

  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly accentOptions = ACCENT_OPTIONS;

  // ── Accessibilité : focus + annonce au changement de route (RGAA 5.2) ──
  readonly #doc = inject(DOCUMENT);
  readonly #title = inject(Title);
  readonly #estNavigateur = isPlatformBrowser(inject(PLATFORM_ID));
  readonly #navigationTerminee = toSignal(
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)),
  );

  constructor() {
    // En SPA, changer de route ne bouge PAS le focus et n'annonce rien au
    // lecteur d'écran. On déplace donc le focus sur <main> et on annonce le
    // titre. Gardé au navigateur (le DOM serveur du prerender n'a pas focus()).
    // Le drapeau se consomme sur la PREMIÈRE NavigationEnd, pas sur le premier
    // passage de l'effect : celui-ci tourne une fois avant toute navigation
    // (signal encore `undefined`) et brûlerait la garde, si bien que le
    // chargement initial volait le focus — lien d'évitement et en-tête
    // devenaient alors inatteignables au clavier (RGAA 12.7).
    let premiereNavigation = true;
    effect(() => {
      const navigation = this.#navigationTerminee();
      if (!this.#estNavigateur || navigation === undefined) return;
      if (premiereNavigation) {
        premiereNavigation = false;
        return; // pas de vol de focus au chargement initial (hydratation)
      }
      // Après le rendu de la nouvelle page (le titre est posé par son effect).
      setTimeout(() => {
        this.#doc.getElementById('contenu-principal')?.focus();
        const region = this.#doc.getElementById('route-annonce');
        if (region) region.textContent = this.#title.getTitle();
      });
    });
  }

  protected toggleMenu(): void {
    this.themeMenuOpen.set(false);
    this.menuOpen.update((o) => !o);
  }

  protected toggleNav(): void {
    this.navOpen.update((o) => !o);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  protected toggleThemeMenu(): void {
    this.menuOpen.set(false);
    this.themeMenuOpen.update((o) => !o);
  }

  protected setTheme(pref: ThemePref): void {
    this.theme.setPreference(pref);
    this.themeMenuOpen.set(false);
  }

  /** Choisir un accent ne ferme pas le menu : on voit l'effet en direct. */
  protected setAccent(accent: AccentPref): void {
    this.accentService.setAccent(accent);
  }

  /** Icône du bouton thème : celle de la préférence courante. */
  protected themeIcon(): string {
    const pref = this.theme.preference();
    return THEME_OPTIONS.find((o) => o.value === pref)?.icon ?? '💻';
  }

  protected loginGoogle(): void {
    void this.auth.loginWithGoogle();
  }

  protected async logout(): Promise<void> {
    this.menuOpen.set(false);
    await this.auth.logout();
  }
}
