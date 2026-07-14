import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

/** Invite de connexion (Google + lien magique email) affichée à la place d'un
 *  contenu réservé aux utilisateurs connectés. */
@Component({
  selector: 'app-auth-gate',
  template: `
    <div class="gate">
      <p class="gate__msg">{{ message() }}</p>

      <button type="button" class="gate__google" (click)="loginGoogle()">
        Continuer avec Google
      </button>

      <div class="gate__sep"><span>ou</span></div>

      @if (sent()) {
        <p class="gate__sent">Lien de connexion envoyé à <strong>{{ email() }}</strong>.</p>
      } @else {
        <form class="gate__email" (submit)="sendMagic($event)">
          <input
            type="email"
            class="gate__input"
            placeholder="votre@email.fr"
            aria-label="Adresse email pour recevoir le lien de connexion"
            autocomplete="email"
            [value]="email()"
            (input)="email.set($any($event.target).value)"
            required
          />
          <button type="submit" class="gate__send" [disabled]="envoi()">
            {{ envoi() ? '…' : 'Recevoir un lien' }}
          </button>
        </form>
        @if (erreur()) {
          <p class="gate__err">{{ erreur() }}</p>
        }
      }
    </div>
  `,
  styles: `
    .gate {
      max-width: 380px;
      margin-inline: auto;
      text-align: center;
      padding: 1.4rem;
      border: 1.5px dashed var(--line);
      border-radius: 16px;
      background: var(--paper-soft);
    }
    .gate__msg {
      margin: 0 0 1rem;
      font-weight: 500;
    }
    .gate__google {
      width: 100%;
      padding: 0.7rem 1rem;
      border: 2px solid var(--ink);
      border-radius: 12px;
      background: var(--paper);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      box-shadow: var(--shadow);
    }
    .gate__google:hover {
      background: var(--ink);
      color: var(--paper);
    }
    .gate__sep {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin: 1rem 0;
      color: var(--ink-soft);
      font-size: 0.85rem;
    }
    .gate__sep::before,
    .gate__sep::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--line);
    }
    .gate__email {
      display: flex;
      gap: 0.5rem;
    }
    .gate__input {
      flex: 1;
      min-width: 0;
      padding: 0.6rem 0.8rem;
      border: 1.5px solid var(--ink);
      border-radius: 10px;
      font: inherit;
    }
    .gate__send {
      padding: 0.6rem 1rem;
      border: none;
      border-radius: 10px;
      background: var(--accent);
      color: var(--on-accent);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .gate__sent {
      margin: 0;
      color: var(--good);
    }
    .gate__err {
      margin: 0.6rem 0 0;
      color: var(--bad);
      font-size: 0.88rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthGate {
  readonly #auth = inject(AuthService);

  readonly message = input('Connectez-vous pour donner votre avis.');

  protected readonly email = signal('');
  protected readonly sent = signal(false);
  protected readonly envoi = signal(false);
  protected readonly erreur = signal('');

  protected loginGoogle(): void {
    void this.#auth.loginWithGoogle();
  }

  protected async sendMagic(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.email().includes('@')) return;
    this.erreur.set('');
    this.envoi.set(true);
    // N'affiche « envoyé » QUE si Supabase confirme l'envoi ; sinon montre
    // l'erreur réelle (rate limit, SMTP, etc.) au lieu d'un faux succès.
    const res = await this.#auth.loginWithEmail(this.email());
    this.envoi.set(false);
    if (res.ok) this.sent.set(true);
    else this.erreur.set(res.error ?? "Échec de l'envoi du lien.");
  }
}
