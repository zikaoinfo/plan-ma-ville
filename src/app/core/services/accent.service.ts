import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

/** Couleur d'accent choisie par l'utilisateur (thème d'accent). */
export type AccentPref = 'orange' | 'jaune' | 'vert' | 'bleu';

export const ACCENT_STORAGE_KEY = 'mvn-accent';

export const ACCENT_DEFAULT: AccentPref = 'orange';

const ACCENTS: readonly AccentPref[] = ['orange', 'jaune', 'vert', 'bleu'];

/** Valide une valeur brute (localStorage) ; tout l'inattendu → orange. */
export function sanitiseAccent(raw: string | null | undefined): AccentPref {
  return ACCENTS.includes(raw as AccentPref) ? (raw as AccentPref) : ACCENT_DEFAULT;
}

/**
 * Couleur d'accent (orange par défaut, jaune, vert ou bleu), persistée dans
 * localStorage et appliquée via `data-accent` sur `<html>` (les tokens par
 * accent vivent dans `styles.scss`, thèmes clair ET sombre). Un script
 * inline dans `index.html` pose l'attribut AVANT le boot Angular
 * (anti-flash) ; ce service prend ensuite le relais pour le runtime.
 */
@Injectable({ providedIn: 'root' })
export class AccentService {
  readonly #doc = inject(DOCUMENT);

  /** Accent courant (source de vérité UI). */
  readonly accent = signal<AccentPref>(sanitiseAccent(this.#read()));

  constructor() {
    // Impératif DOM : attribut sur <html> + persistance. setAttribute (et
    // pas dataset) : le DOM serveur du prerender n'implémente pas dataset
    // sur documentElement.
    effect(() => {
      const accent = this.accent();
      this.#doc.documentElement.setAttribute('data-accent', accent);
      this.#write(accent);
    });
  }

  setAccent(accent: AccentPref): void {
    this.accent.set(accent);
  }

  #read(): string | null {
    try {
      return this.#doc.defaultView?.localStorage.getItem(ACCENT_STORAGE_KEY) ?? null;
    } catch {
      return null; // stockage indisponible (navigation privée stricte…)
    }
  }

  #write(accent: AccentPref): void {
    try {
      this.#doc.defaultView?.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    } catch {
      /* stockage indisponible : l'accent reste appliqué, juste non persisté */
    }
  }
}
