import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import { ThemeService, type ThemePref } from './core/services/theme.service';
import { UpdateService } from './core/services/update.service';

/** Options du sélecteur de thème (ordre d'affichage). */
const THEME_OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'light', label: 'Clair', icon: '☀️' },
  { value: 'dark', label: 'Sombre', icon: '🌙' },
  { value: 'system', label: 'Système', icon: '💻' },
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
  protected readonly maj = inject(UpdateService);
  protected readonly annee = new Date().getFullYear();

  protected readonly menuOpen = signal(false);
  protected readonly navOpen = signal(false);
  protected readonly themeMenuOpen = signal(false);

  protected readonly themeOptions = THEME_OPTIONS;

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
    let premier = true;
    effect(() => {
      this.#navigationTerminee();
      if (!this.#estNavigateur || premier) {
        premier = false;
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
