import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { CRITERE_LABELS, CRITERES, type AvisInsert, type Critere } from '../../../core/models/data.models';
import { AuthService } from '../../../core/services/auth.service';
import { AvisService } from '../../../core/services/avis.service';
import { CritereSlider } from '../../../shared/critere-slider/critere-slider';

const MIN_POSITIFS = 20;

function notesParDefaut(): Record<Critere, number> {
  return Object.fromEntries(CRITERES.map((c) => [c, 5])) as Record<Critere, number>;
}

@Component({
  selector: 'app-commune-avis-form',
  imports: [CritereSlider],
  template: `
    <form class="form" (submit)="submit($event)">
      <h3 class="form__title">
        {{ existing() ? 'Modifier mon avis' : 'Donner mon avis' }}
      </h3>

      <div class="form__sliders">
        @for (critere of criteres; track critere) {
          <app-critere-slider
            [id]="'note-' + critere"
            [label]="labels[critere]"
            [value]="notes()[critere]"
            (valueChange)="setNote(critere, $event)"
          />
        }
      </div>

      <label class="form__field">
        <span>Points positifs <em>(20 caractères min.)</em></span>
        <textarea
          rows="3"
          [value]="positifs()"
          (input)="positifs.set($any($event.target).value)"
          placeholder="Ce que vous appréciez dans cette commune…"
        ></textarea>
        <small [class.form__count--ko]="positifs().length < min">
          {{ positifs().length }} / {{ min }}
        </small>
      </label>

      <label class="form__field">
        <span>Points négatifs <em>(optionnel)</em></span>
        <textarea
          rows="2"
          [value]="negatifs()"
          (input)="negatifs.set($any($event.target).value)"
          placeholder="Ce qui pourrait être amélioré…"
        ></textarea>
      </label>

      @if (message() === 'ok') {
        <p class="form__msg form__msg--ok">Merci ! Votre avis a été enregistré.</p>
      } @else if (message() === 'err') {
        <p class="form__msg form__msg--err">Une erreur est survenue. Réessayez.</p>
      } @else if (message() === 'court') {
        <p class="form__msg form__msg--err">
          Les « points positifs » doivent faire au moins {{ min }} caractères
          ({{ positifs().trim().length }}/{{ min }}).
        </p>
      }

      <!-- Bouton toujours cliquable : la validation se fait au clic (pas de
           bouton grisé mystérieux). -->
      <button type="submit" class="form__submit" [disabled]="submitting()">
        {{ submitting() ? 'Envoi…' : existing() ? 'Mettre à jour' : 'Publier mon avis' }}
      </button>
    </form>
  `,
  styleUrl: './commune-avis-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommuneAvisForm {
  readonly #avis = inject(AvisService);
  readonly #auth = inject(AuthService);

  readonly codeInsee = input.required<string>();
  readonly submitted = output<void>();

  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;
  protected readonly min = MIN_POSITIFS;

  protected readonly notes = signal<Record<Critere, number>>(notesParDefaut());
  protected readonly positifs = signal('');
  protected readonly negatifs = signal('');
  protected readonly existing = signal<boolean>(false);
  protected readonly submitting = signal(false);
  protected readonly message = signal<'ok' | 'err' | 'court' | null>(null);

  constructor() {
    // Pré-remplit avec l'avis existant de l'utilisateur, le cas échéant.
    effect(() => {
      const user = this.#auth.user();
      const code = this.codeInsee();
      if (!user) return;
      void this.#prefill(user.id, code);
    });
  }

  protected setNote(critere: Critere, value: number): void {
    this.notes.update((n) => ({ ...n, [critere]: value }));
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    // Validation au clic — lit la valeur fraîche du signal (aucune dépendance à
    // l'état d'un bouton désactivé).
    if (this.positifs().trim().length < MIN_POSITIFS) {
      this.message.set('court');
      return;
    }
    const user = this.#auth.user();
    if (!user) return;

    this.submitting.set(true);
    this.message.set(null);
    const n = this.notes();
    const insert: AvisInsert = {
      commune_insee: this.codeInsee(),
      user_id: user.id,
      pseudo: this.#auth.pseudo(),
      positifs: this.positifs().trim(),
      negatifs: this.negatifs().trim() || null,
      note_securite: n.securite,
      note_sante: n.sante,
      note_commerces: n.commerces,
      note_enseignement: n.enseignement,
      note_sports: n.sports,
      note_culture: n.culture,
      note_transports: n.transports,
      note_niveau_vie: n.niveauVie,
    };

    try {
      await this.#avis.submitAvis(insert);
      this.existing.set(true);
      this.message.set('ok');
      this.submitted.emit();
    } catch {
      this.message.set('err');
    } finally {
      this.submitting.set(false);
    }
  }

  async #prefill(userId: string, code: string): Promise<void> {
    const avis = await this.#avis.getUserAvis(userId, code);
    if (!avis) return;
    this.notes.set({
      securite: avis.note_securite,
      sante: avis.note_sante,
      commerces: avis.note_commerces,
      enseignement: avis.note_enseignement,
      sports: avis.note_sports,
      culture: avis.note_culture,
      transports: avis.note_transports,
      niveauVie: avis.note_niveau_vie,
    });
    this.positifs.set(avis.positifs);
    this.negatifs.set(avis.negatifs ?? '');
    this.existing.set(true);
  }
}
