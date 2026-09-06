import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScoreBadge } from '../score-badge/score-badge';

/**
 * Carte d'un territoire (région ou département) : code, nom, couverture,
 * note, rang facultatif.
 *
 * Un seul composant pour les trois écrans qui listent des territoires
 * (accueil, /regions, /region/:code) : le même triplet code · nom · communes ·
 * note s'y affichait auparavant sous trois formes différentes, ce qui donnait
 * l'impression de trois objets distincts pour une seule et même donnée.
 */
@Component({
  selector: 'app-territoire-card',
  imports: [RouterLink, ScoreBadge, DecimalPipe],
  templateUrl: './territoire-card.html',
  styleUrl: './territoire-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerritoireCard {
  /** Code affiché en pastille : « 69 », « 2A », « 84 » (région). */
  readonly code = input.required<string>();
  readonly nom = input.required<string>();
  /** Cible du lien, au format `routerLink` (ex. `['/departement', '69']`). */
  readonly lien = input.required<unknown[]>();

  /**
   * Note sur 10, ou `null` quand le territoire n'en a pas de calculable.
   * `null` n'est PAS un 0 : la carte affiche alors « Non notée ».
   */
  readonly note = input.required<number | null>();

  /** Nombre total de communes du territoire. */
  readonly nbCommunes = input.required<number>();

  /**
   * Communes effectivement notées, quand la couverture est connue. `null` =
   * l'information n'est pas publiée par le pipeline — on affiche alors le
   * total seul plutôt qu'une couverture inventée.
   */
  readonly nbNotees = input<number | null>(null);

  /** Précision qui précède le décompte de communes (ex. « 12 départements »). */
  readonly detail = input<string | null>(null);

  /** Rang dans le classement affiché ; `null` quand la liste n'est pas classée. */
  readonly rang = input<number | null>(null);

  /** true quand la couverture est connue : on la montre au lieu du total seul. */
  protected readonly couvertureConnue = computed(() => this.nbNotees() !== null);

  /**
   * Note réellement affichable. Le pipeline émet `0` quand aucune population
   * ne permet de pondérer la moyenne : c'est une absence de note, pas un zéro
   * de qualité — l'afficher en pastille rouge serait une donnée inventée.
   */
  protected readonly noteAffichable = computed(() => {
    const n = this.note();
    return n === null || n <= 0 ? null : n;
  });
}
