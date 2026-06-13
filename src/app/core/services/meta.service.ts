import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface PageMeta {
  title: string;
  description: string;
  /** Chemin canonique commençant par `/` (hors baseHref), ex. `/ville/lyon-69123`. */
  canonicalPath: string;
}

const SITE = 'ma ville, notée';

/**
 * Centralise le SEO d'une page : <title>, meta description, balises OpenGraph
 * et lien canonique. À appeler depuis chaque page (effect ou ngOnInit).
 */
@Injectable({ providedIn: 'root' })
export class MetaService {
  readonly #title = inject(Title);
  readonly #meta = inject(Meta);
  readonly #doc = inject(DOCUMENT);

  setPage(meta: PageMeta): void {
    const url = environment.baseUrl + meta.canonicalPath;

    this.#title.setTitle(meta.title);
    this.#meta.updateTag({ name: 'description', content: meta.description });
    this.#meta.updateTag({ property: 'og:type', content: 'website' });
    this.#meta.updateTag({ property: 'og:site_name', content: SITE });
    this.#meta.updateTag({ property: 'og:title', content: meta.title });
    this.#meta.updateTag({ property: 'og:description', content: meta.description });
    this.#meta.updateTag({ property: 'og:url', content: url });
    this.#meta.updateTag({ name: 'twitter:card', content: 'summary' });

    this.#setCanonical(url);
  }

  #setCanonical(url: string): void {
    const head = this.#doc.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.#doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
