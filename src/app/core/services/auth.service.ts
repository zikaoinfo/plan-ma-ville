import { ApplicationRef, computed, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { filter, firstValueFrom } from 'rxjs';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

/**
 * Authentification Supabase : invité (anonymous sign-in) par défaut,
 * Google OAuth + lien magique email en option.
 * Sans configuration Supabase, `user` reste null et les actions no-op.
 * Le client Supabase est chargé en différé (voir SupabaseService).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #sb = inject(SupabaseService);
  readonly #doc = inject(DOCUMENT);
  readonly #appRef = inject(ApplicationRef);

  readonly user = signal<User | null>(null);
  readonly connecte = computed(() => this.user() !== null);
  /** Session invitée (anonymous sign-in) — un UUID opaque, aucune PII. */
  readonly estAnonyme = computed(() => this.user()?.is_anonymous === true);
  /** Connecté avec un vrai compte (email/Google) — un invité n'en est pas un. */
  readonly connecteCompte = computed(() => this.connecte() && !this.estAnonyme());
  /** L'auth est-elle disponible (Supabase configuré) ? */
  readonly disponible = this.#sb.enabled;

  constructor() {
    // Chargement du chunk @supabase/supabase-js (lourd) différé après la
    // stabilisation de l'appli : sinon la restauration de session au
    // démarrage le déclenche sur CHAQUE page dès le premier rendu, ce qui
    // annule le bénéfice de l'import dynamique (JS chargé mais quasi
    // inutilisé au moment du chargement — flag Lighthouse « unused JS »).
    if (this.disponible) {
      void firstValueFrom(this.#appRef.isStable.pipe(filter((stable) => stable))).then(() =>
        this.#init(),
      );
    }
  }

  async #init(): Promise<void> {
    const client = await this.#sb.getClient();
    if (!client) return;
    // Les callbacks Supabase sont hors zone : en zoneless, un set() de signal
    // déclenche la détection de changement — pas besoin de NgZone.
    const { data } = await client.auth.getSession();
    this.user.set(data.session?.user ?? null);
    client.auth.onAuthStateChange((_evt, session) => this.user.set(session?.user ?? null));
  }

  /** Pseudo affichable de l'utilisateur courant. */
  pseudo(): string {
    const u = this.user();
    if (!u) return '';
    const meta = u.user_metadata as { full_name?: string; name?: string } | undefined;
    return meta?.full_name ?? meta?.name ?? u.email?.split('@')[0] ?? 'Habitant';
  }

  /** Email de l'utilisateur courant. */
  email(): string {
    return this.user()?.email ?? '';
  }

  /** Photo de profil (Google), si disponible. */
  avatarUrl(): string | null {
    const meta = this.user()?.user_metadata as
      | { avatar_url?: string; picture?: string }
      | undefined;
    return meta?.avatar_url ?? meta?.picture ?? null;
  }

  /** Initiales de repli pour l'avatar. */
  initiales(): string {
    const p = this.pseudo().trim();
    return p ? p.slice(0, 2).toUpperCase() : '?';
  }

  /**
   * Garantit une identité pour publier : session existante (compte ou invité),
   * sinon création silencieuse d'un invité (`signInAnonymously`) — le mode par
   * défaut pour donner un avis, sans aucune donnée personnelle.
   * Null si Supabase n'est pas configuré ; PROPAGE l'erreur Supabase sinon
   * (`code === 'anonymous_provider_disabled'` = toggle « Allow anonymous
   * sign-ins » manquant côté dashboard, la cause n°1 en prod).
   */
  async ensureUser(): Promise<User | null> {
    const client = await this.#sb.getClient();
    if (!client) return null;
    // Lit la session directement (le signal `user` peut être en retard :
    // #init est différé après la stabilisation de l'appli).
    const { data } = await client.auth.getSession();
    if (data.session?.user) {
      this.user.set(data.session.user);
      return data.session.user;
    }
    const { data: anon, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    if (!anon.user) return null;
    this.user.set(anon.user);
    return anon.user;
  }

  /**
   * Rattache un email au compte invité courant : Supabase envoie un lien de
   * confirmation qui le convertit en compte permanent, MÊME user_id → avis
   * conservés. L'unicité de l'email est garantie nativement (`email_exists`).
   */
  async attacherEmail(email: string): Promise<{ ok: boolean; dejaPris: boolean }> {
    const client = await this.#sb.getClient();
    if (!client) return { ok: false, dejaPris: false };
    const { error } = await client.auth.updateUser(
      { email },
      { emailRedirectTo: this.#doc.location.href },
    );
    if (!error) return { ok: true, dejaPris: false };
    return {
      ok: false,
      dejaPris: error.code === 'email_exists' || /already|exists/i.test(error.message),
    };
  }

  async loginWithGoogle(): Promise<void> {
    const client = await this.#sb.getClient();
    if (!client) return;
    const options = { redirectTo: this.#doc.location.href };
    // Un invité qui se connecte GARDE ses avis : l'identité Google est
    // rattachée au même user_id (« manual linking » activé côté Supabase).
    if (this.estAnonyme()) {
      const { error } = await client.auth.linkIdentity({ provider: 'google', options });
      if (!error) return;
      // Identité déjà liée à un autre compte (ou option désactivée) → repli
      // sur la connexion classique : ce compte-là reprend la main.
    }
    await client.auth.signInWithOAuth({ provider: 'google', options });
  }

  /** Envoie un lien magique. Renvoie l'erreur Supabase réelle si l'envoi échoue. */
  async loginWithEmail(email: string): Promise<{ ok: boolean; error?: string }> {
    const client = await this.#sb.getClient();
    if (!client) return { ok: false, error: 'Authentification indisponible (Supabase non configuré).' };
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: this.#doc.location.href },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async logout(): Promise<void> {
    const client = await this.#sb.getClient();
    await client?.auth.signOut();
  }
}
