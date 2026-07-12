import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ThemeService, type ThemePref } from './core/services/theme.service';

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
  protected readonly annee = new Date().getFullYear();

  protected readonly menuOpen = signal(false);
  protected readonly navOpen = signal(false);
  protected readonly themeMenuOpen = signal(false);

  protected readonly themeOptions = THEME_OPTIONS;

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
