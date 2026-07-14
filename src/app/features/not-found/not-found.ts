import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MetaService } from '../../core/services/meta.service';

/**
 * Page 404 : affichée pour toute URL inconnue (route `**`). Un vrai état
 * « page introuvable » (noindex) plutôt qu'une redirection silencieuse vers
 * l'accueil, qui produirait des soft-404 côté moteurs de recherche.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="page-hero container">
      <span class="tag-chantier">Erreur 404</span>
      <h1>Page introuvable</h1>
      <p class="sous-titre">
        L'adresse demandée n'existe pas (ou plus). Recherchez votre commune
        depuis l'accueil, ou explorez les classements.
      </p>
      <nav class="nf__liens" aria-label="Pages principales">
        <a routerLink="/" class="nf__btn nf__btn--primaire">Rechercher une commune</a>
        <a routerLink="/classement" class="nf__btn">Classement</a>
        <a routerLink="/carte" class="nf__btn">Carte</a>
      </nav>
    </section>
  `,
  styles: `
    .nf__liens {
      display: flex;
      justify-content: center;
      gap: 0.8rem;
      flex-wrap: wrap;
      margin-top: 2rem;
    }

    .nf__btn {
      display: inline-block;
      padding: 0.6rem 1.3rem;
      border: 1.5px solid var(--ink);
      border-radius: 999px;
      background: var(--paper);
      color: var(--ink);
      font-weight: 600;
      text-decoration: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .nf__btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }

    .nf__btn--primaire {
      background: var(--ink);
      color: var(--paper);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {
  constructor() {
    inject(MetaService).setPage({
      title: 'Page introuvable — ma ville, notée',
      description: "Cette page n'existe pas. Recherchez votre commune depuis l'accueil.",
      canonicalPath: '/',
      noindex: true,
    });
  }
}
