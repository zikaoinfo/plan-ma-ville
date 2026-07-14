import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

/** Préférence utilisateur ; `system` suit `prefers-color-scheme`. */
export type ThemePref = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'mvn-theme';

/** Couleur de la barre navigateur (`<meta name="theme-color">`) par thème —
 *  alignée sur le fond de la topbar (crème / nuit), et sur le script
 *  anti-flash d'index.html. */
const META_THEME_COLOR: Record<'light' | 'dark', string> = {
  light: '#faf6ef',
  dark: '#10152a',
};

/** Valide une valeur brute (localStorage) ; tout l'inattendu → `system`. */
export function sanitiseTheme(raw: string | null | undefined): ThemePref {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

/** Thème effectif à appliquer pour une préférence + l'état système. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

/**
 * Thème clair/sombre/système, persisté dans localStorage et appliqué via
 * `data-theme` sur `<html>` (les tokens sombres vivent dans `styles.scss`).
 * Un script inline dans `index.html` pose l'attribut AVANT le boot Angular
 * (anti-flash) ; ce service prend ensuite le relais pour le runtime.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly #doc = inject(DOCUMENT);

  /** Préférence courante (source de vérité UI). */
  readonly preference = signal<ThemePref>(sanitiseTheme(this.#read()));

  /** `prefers-color-scheme: dark` du système, suivi en direct. */
  readonly #systemDark = signal(this.#media()?.matches ?? false);

  /** Thème effectivement appliqué ('light' | 'dark'). */
  readonly resolved = computed(() => resolveTheme(this.preference(), this.#systemDark()));

  constructor() {
    // Suit les bascules système (utile quand la préférence est `system`).
    this.#media()?.addEventListener('change', (e) => this.#systemDark.set(e.matches));

    // Impératif DOM : attribut sur <html>, meta theme-color, persistance.
    // setAttribute (et pas dataset) : le DOM serveur du prerender n'implémente
    // pas dataset sur documentElement.
    effect(() => {
      const theme = this.resolved();
      this.#doc.documentElement.setAttribute('data-theme', theme);
      this.#doc
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', META_THEME_COLOR[theme]);
      this.#write(this.preference());
    });
  }

  setPreference(pref: ThemePref): void {
    this.preference.set(pref);
  }

  /** matchMedia peut manquer (environnement de test) → tout est gardé. */
  #media(): MediaQueryList | undefined {
    return this.#doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  }

  #read(): string | null {
    try {
      return this.#doc.defaultView?.localStorage.getItem(THEME_STORAGE_KEY) ?? null;
    } catch {
      return null; // stockage indisponible (navigation privée stricte…)
    }
  }

  #write(pref: ThemePref): void {
    try {
      this.#doc.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* stockage indisponible : le thème reste appliqué, juste non persisté */
    }
  }
}
