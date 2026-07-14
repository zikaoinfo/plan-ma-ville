import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CRITERE_LABELS, CRITERES, type AvisInsert, type Critere } from '../../../core/models/data.models';
import { AuthService } from '../../../core/services/auth.service';
import { AvisService } from '../../../core/services/avis.service';
import { CritereSlider } from '../../../shared/critere-slider/critere-slider';

const MIN_POSITIFS = 20;
/** Borne haute (anti-abus) — à garder alignée avec le CHECK du schéma SQL. */
const MAX_TEXTE = 2000;

type Message =
  | 'ok'
  | 'ok-verifier'
  | 'email-pris'
  | 'lien-envoye'
  | 'err'
  | 'court'
  | 'invite-off'
  | null;

function notesParDefaut(): Record<Critere, number> {
  return Object.fromEntries(CRITERES.map((c) => [c, 5])) as Record<Critere, number>;
}

@Component({
  selector: 'app-commune-avis-form',
  imports: [CritereSlider],
  template: `
    <form class="form" (submit)="submit($event)">
      <h2 class="form__title">
        {{ existing() ? 'Modifier mon avis' : 'Donner mon avis' }}
      </h2>

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
          [attr.maxlength]="max"
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
          [attr.maxlength]="max"
          [value]="negatifs()"
          (input)="negatifs.set($any($event.target).value)"
          placeholder="Ce qui pourrait être amélioré…"
        ></textarea>
      </label>

      <label class="form__anonyme">
        <input
          type="checkbox"
          [checked]="anonyme()"
          (change)="anonyme.set($any($event.target).checked)"
        />
        <span>Publier anonymement</span>
      </label>
      <p class="form__hint">
        {{
          anonyme()
            ? 'Votre avis sera affiché sous « Habitant anonyme ».'
            : invite()
              ? 'Votre avis sera signé par un pseudonyme stable (ex. « Habitant #A3F2 »).'
              : 'Votre avis sera affiché avec votre prénom (ex. « Jean D. »).'
        }}
      </p>

      @if (invite()) {
        <label class="form__field">
          <span>Votre email <em>(optionnel)</em></span>
          <input
            type="email"
            class="form__email"
            autocomplete="email"
            placeholder="votre@email.fr"
            [value]="email()"
            (input)="email.set($any($event.target).value)"
          />
          <small class="form__rgpd">
            Uniquement pour retrouver et modifier vos avis depuis n'importe quel
            appareil — jamais affiché, jamais partagé. Sans email, votre avis
            est publié tout aussi bien.
          </small>
        </label>
      }

      @switch (message()) {
        @case ('ok') {
          <p class="form__msg form__msg--ok">Merci ! Votre avis a été enregistré.</p>
        }
        @case ('ok-verifier') {
          <p class="form__msg form__msg--ok">
            Merci ! Votre avis est publié. Un email de confirmation vous a été
            envoyé — cliquez son lien pour retrouver vos avis sur tous vos
            appareils.
          </p>
        }
        @case ('email-pris') {
          <div class="form__msg form__msg--info">
            <p>
              Votre avis est publié. Cet email est déjà associé à un compte —
              connectez-vous avec pour retrouver vos avis.
            </p>
            <button type="button" class="form__lien" (click)="envoyerLien()" [disabled]="envoiLien()">
              {{ envoiLien() ? 'Envoi…' : 'Recevoir un lien de connexion' }}
            </button>
          </div>
        }
        @case ('lien-envoye') {
          <p class="form__msg form__msg--ok">
            Lien de connexion envoyé à <strong>{{ email() }}</strong>.
          </p>
        }
        @case ('err') {
          <p class="form__msg form__msg--err">Une erreur est survenue. Réessayez.</p>
        }
        @case ('invite-off') {
          <p class="form__msg form__msg--err">
            La publication sans compte n'est pas encore activée sur ce site.
            Connectez-vous ci-dessous (« Déjà un compte ? ») pour publier votre
            avis.
          </p>
        }
        @case ('court') {
          <p class="form__msg form__msg--err">
            Les « points positifs » doivent faire au moins {{ min }} caractères
            ({{ positifs().trim().length }}/{{ min }}).
          </p>
        }
      }

      <!-- Bouton toujours cliquable : la validation se fait au clic (pas de
           bouton grisé mystérieux). -->
      <div class="form__actions">
        <button type="submit" class="form__submit" [disabled]="submitting()">
          {{ submitting() ? 'Envoi…' : existing() ? 'Mettre à jour' : 'Publier mon avis' }}
        </button>
        @if (existing()) {
          <button type="button" class="form__delete" (click)="supprimer()" [disabled]="submitting()">
            Supprimer mon avis
          </button>
        }
      </div>
    </form>
  `,
  styleUrl: './commune-avis-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommuneAvisForm {
  readonly #avis = inject(AvisService);
  readonly #auth = inject(AuthService);
  readonly #doc = inject(DOCUMENT);

  readonly codeInsee = input.required<string>();
  readonly submitted = output<void>();

  protected readonly criteres = CRITERES;
  protected readonly labels = CRITERE_LABELS;
  protected readonly min = MIN_POSITIFS;
  protected readonly max = MAX_TEXTE;

  protected readonly notes = signal<Record<Critere, number>>(notesParDefaut());
  protected readonly positifs = signal('');
  protected readonly negatifs = signal('');
  protected readonly anonyme = signal(false);
  protected readonly email = signal('');
  protected readonly existing = signal<boolean>(false);
  protected readonly submitting = signal(false);
  protected readonly envoiLien = signal(false);
  protected readonly message = signal<Message>(null);

  /** Contributeur sans compte email/Google : le champ email optionnel s'affiche. */
  protected readonly invite = computed(() => !this.#auth.connecteCompte());

  constructor() {
    // Pré-remplit avec l'avis existant du contributeur (compte OU session
    // invitée restaurée depuis localStorage), le cas échéant.
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

    this.submitting.set(true);
    this.message.set(null);
    try {
      // Mode invité par défaut : session anonyme créée à la volée si besoin.
      const user = await this.#auth.ensureUser();
      if (!user) throw new Error('authentification indisponible');
      const n = this.notes();
      const insert: AvisInsert = {
        commune_insee: this.codeInsee(),
        user_id: user.id,
        pseudo: this.#auth.pseudo(),
        anonyme: this.anonyme(),
        positifs: this.positifs().trim().slice(0, MAX_TEXTE),
        negatifs: this.negatifs().trim().slice(0, MAX_TEXTE) || null,
        note_securite: n.securite,
        note_sante: n.sante,
        note_commerces: n.commerces,
        note_enseignement: n.enseignement,
        note_sports: n.sports,
        note_culture: n.culture,
        note_transports: n.transports,
        note_niveau_vie: n.niveauVie,
      };
      await this.#avis.submitAvis(insert);
      this.existing.set(true);
      this.submitted.emit();
      this.message.set(await this.#claimEmail());
    } catch (e) {
      // La cause réelle (RLS, trigger, réseau, toggle dashboard manquant…)
      // est en console : le message à l'écran reste actionnable sans jargon.
      console.error('[avis] publication échouée', e);
      const code = (e as { code?: string } | null)?.code;
      this.message.set(code === 'anonymous_provider_disabled' ? 'invite-off' : 'err');
    } finally {
      this.submitting.set(false);
    }
  }

  /** L'email conflictuel a déjà un compte : envoie le magic-link classique. */
  protected async envoyerLien(): Promise<void> {
    this.envoiLien.set(true);
    const res = await this.#auth.loginWithEmail(this.email().trim());
    this.envoiLien.set(false);
    this.message.set(res.ok ? 'lien-envoye' : 'err');
  }

  protected async supprimer(): Promise<void> {
    const user = this.#auth.user();
    if (!user || !this.#doc.defaultView?.confirm('Supprimer définitivement votre avis ?')) return;
    this.submitting.set(true);
    try {
      await this.#avis.deleteAvis(user.id, this.codeInsee());
      this.notes.set(notesParDefaut());
      this.positifs.set('');
      this.negatifs.set('');
      this.existing.set(false);
      this.message.set(null);
      this.submitted.emit();
    } catch {
      this.message.set('err');
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Rattache l'email optionnel au compte invité APRÈS la publication (l'avis
   * n'est jamais bloqué par l'email) et choisit le message de confirmation.
   * Échec non-conflit → l'avis est publié quand même, message « ok » simple.
   */
  async #claimEmail(): Promise<Message> {
    const email = this.email().trim();
    if (!email || !this.invite()) return 'ok';
    const res = await this.#auth.attacherEmail(email);
    if (res.ok) return 'ok-verifier';
    return res.dejaPris ? 'email-pris' : 'ok';
  }

  async #prefill(userId: string, code: string): Promise<void> {
    const avis = await this.#avis.getUserAvis(userId, code);
    if (!avis) {
      // Nouvel avis : reprend le dernier choix "anonyme" de l'utilisateur.
      this.anonyme.set(await this.#avis.getAnonymeDefaut(userId));
      return;
    }
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
    this.anonyme.set(avis.anonyme);
    this.existing.set(true);
  }
}
