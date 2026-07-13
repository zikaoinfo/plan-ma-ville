import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';

/**
 * Détection des mises à jour PWA : quand le service worker a téléchargé une
 * nouvelle version de l'app (déploiement), `disponible()` passe à true et le
 * header affiche une bannière « Recharger ». En dev (SW désactivé),
 * `versionUpdates` n'émet jamais → bannière jamais affichée.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  readonly #sw = inject(SwUpdate);

  readonly #dernierEvenement = toSignal(this.#sw.versionUpdates, { initialValue: null });

  /** true dès qu'une nouvelle version est prête (rechargement recommandé). */
  readonly disponible = computed(() => this.#dernierEvenement()?.type === 'VERSION_READY');

  /** Applique la mise à jour : un rechargement suffit (SW déjà prêt). */
  recharger(): void {
    document.location.reload();
  }
}
