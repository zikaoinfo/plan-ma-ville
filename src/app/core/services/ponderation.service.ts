import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Critere } from '../models/data.models';
import {
  noteGlobalePonderee,
  POIDS_OFFICIELS,
  type Poids,
  type ProfilId,
  profilById,
  PROFILS,
  sanitisePoids,
  sanitiseProfil,
} from '../ponderation';

const PROFIL_KEY = 'mvn-profil';
const POIDS_KEY = 'mvn-poids';

/**
 * Profil de pondération de l'utilisateur, persisté en localStorage.
 * `poids()` = poids effectifs (preset du profil, ou réglages perso).
 * `actif()` = true dès que le profil dévie de la pondération officielle →
 * les pages affichent alors la note « pour vous » recalculée côté client.
 */
@Injectable({ providedIn: 'root' })
export class PonderationService {
  readonly #doc = inject(DOCUMENT);

  readonly profils = PROFILS;

  readonly profil = signal<ProfilId>(sanitiseProfil(this.#read(PROFIL_KEY)));
  readonly poidsPerso = signal<Poids>(sanitisePoids(this.#readJson(POIDS_KEY)));

  /** Poids effectifs selon le profil sélectionné. */
  readonly poids = computed<Poids>(() => {
    const p = profilById(this.profil());
    return p.poids ?? this.poidsPerso();
  });

  /** true si la pondération courante diffère de l'officielle. */
  readonly actif = computed(() => {
    const poids = this.poids();
    return (Object.keys(POIDS_OFFICIELS) as Critere[]).some(
      (c) => poids[c] !== POIDS_OFFICIELS[c],
    );
  });

  constructor() {
    effect(() => {
      this.#write(PROFIL_KEY, this.profil());
      this.#write(POIDS_KEY, JSON.stringify(this.poidsPerso()));
    });
  }

  setProfil(id: ProfilId): void {
    this.profil.set(id);
  }

  setPoids(critere: Critere, valeur: number): void {
    // Modifier un slider bascule automatiquement sur le profil perso, en
    // partant des poids du preset courant (pour ajuster, pas repartir de zéro).
    if (this.profil() !== 'perso') {
      this.poidsPerso.set({ ...this.poids() });
      this.profil.set('perso');
    }
    this.poidsPerso.update((p) => sanitisePoids({ ...p, [critere]: valeur }));
  }

  /** Note globale « pour vous » d'une commune (à partir de ses 8 critères). */
  note(criteres: Record<Critere, number>): number {
    return noteGlobalePonderee(criteres, this.poids());
  }

  #read(key: string): string | null {
    try {
      return this.#doc.defaultView?.localStorage.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  #readJson(key: string): unknown {
    const raw = this.#read(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  #write(key: string, value: string): void {
    try {
      this.#doc.defaultView?.localStorage.setItem(key, value);
    } catch {
      /* stockage indisponible : préférences non persistées */
    }
  }
}
