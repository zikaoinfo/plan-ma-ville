import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CRITERE_LABELS, CRITERES } from '../../core/models/data.models';
import { POIDS_MAX, POIDS_MIN } from '../../core/ponderation';
import { PonderationService } from '../../core/services/ponderation.service';

/**
 * Sélecteur de profil de pondération : chips de presets (Officiel, Famille,
 * Jeune actif, Retraité, Perso) + panneau de sliders par critère. Écrit
 * directement dans PonderationService (persisté) — aucune sortie.
 */
let instances = 0;

@Component({
  selector: 'app-profil-picker',
  templateUrl: './profil-picker.html',
  styleUrl: './profil-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilPicker {
  protected readonly ponderation = inject(PonderationService);

  /** id unique par instance : deux pickers sur une même page resteraient valides. */
  protected readonly panelId = `poids-panel-${++instances}`;

  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;
  protected readonly min = POIDS_MIN;
  protected readonly max = POIDS_MAX;

  /** Panneau des sliders ouvert (auto-ouvert quand on choisit Perso). */
  protected readonly reglages = signal(false);

  protected choisir(id: (typeof this.ponderation.profils)[number]['id']): void {
    this.ponderation.setProfil(id);
    if (id === 'perso') this.reglages.set(true);
  }

  protected onSlider(critere: (typeof CRITERES)[number], event: Event): void {
    this.ponderation.setPoids(critere, Number((event.target as HTMLInputElement).value));
  }
}
