import { computed, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

/**
 * Authentification Supabase (Google OAuth + lien magique email).
 * Sans configuration Supabase, `user` reste null et les actions no-op.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #sb = inject(SupabaseService);
  readonly #doc = inject(DOCUMENT);

  readonly user = signal<User | null>(null);
  readonly connecte = computed(() => this.user() !== null);
  /** L'auth est-elle disponible (Supabase configuré) ? */
  readonly disponible = this.#sb.enabled;

  constructor() {
    const client = this.#sb.client;
    if (!client) return;
    // Les callbacks Supabase sont hors zone : en zoneless, un set() de signal
    // déclenche la détection de changement — pas besoin de NgZone.
    client.auth.getSession().then(({ data }) => this.user.set(data.session?.user ?? null));
    client.auth.onAuthStateChange((_evt, session) => this.user.set(session?.user ?? null));
  }

  /** Pseudo affichable de l'utilisateur courant. */
  pseudo(): string {
    const u = this.user();
    if (!u) return '';
    const meta = u.user_metadata as { full_name?: string; name?: string } | undefined;
    return meta?.full_name ?? meta?.name ?? u.email?.split('@')[0] ?? 'Habitant';
  }

  loginWithGoogle() {
    return this.#sb.client?.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: this.#doc.location.href },
    });
  }

  /** Envoie un lien magique. Renvoie l'erreur Supabase réelle si l'envoi échoue. */
  async loginWithEmail(email: string): Promise<{ ok: boolean; error?: string }> {
    const client = this.#sb.client;
    if (!client) return { ok: false, error: 'Authentification indisponible (Supabase non configuré).' };
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: this.#doc.location.href },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  logout() {
    return this.#sb.client?.auth.signOut();
  }
}
