import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

const SCRIPT_ID = 'mvn-jsonld';

/**
 * Injecte les schémas JSON-LD dans le <head> (un seul <script> agrégé,
 * remplacé à chaque page — MetaService appelle `clear()` à la navigation
 * pour qu'aucune page n'hérite des schémas de la précédente). Passe par
 * DOCUMENT : fonctionne aussi au prerender (le script est sérialisé dans
 * le HTML statique).
 */
@Injectable({ providedIn: 'root' })
export class JsonLdService {
  readonly #doc = inject(DOCUMENT);

  set(schemas: readonly object[]): void {
    this.clear();
    if (schemas.length === 0) return;
    const script = this.#doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('id', SCRIPT_ID);
    script.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : schemas);
    this.#doc.head.appendChild(script);
  }

  clear(): void {
    this.#doc.getElementById(SCRIPT_ID)?.remove();
  }
}
