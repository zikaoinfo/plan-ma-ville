import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Point d'entrée Supabase. Les features communautaires sont optionnelles :
 * tant que `supabaseUrl` / `supabaseAnonKey` ne sont pas renseignés (secrets
 * CI), `enabled` vaut false et `getClient()` résout null → l'UI se dégrade
 * proprement.
 *
 * La lib `@supabase/supabase-js` est LOURDE (gotrue/postgrest/realtime…) :
 * elle est importée dynamiquement, à la première utilisation réelle, pour ne
 * jamais peser dans le bundle initial — surtout quand Supabase est désactivé.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  /** true seulement si une vraie URL + clé anon sont configurées. */
  readonly enabled =
    /^https?:\/\//.test(environment.supabaseUrl) &&
    environment.supabaseAnonKey.length > 0 &&
    !environment.supabaseAnonKey.startsWith('__');

  #clientPromise: Promise<SupabaseClient | null> | null = null;

  /**
   * Client Supabase (créé au premier appel, partagé ensuite) ;
   * `null` si Supabase n'est pas configuré. Si le chargement du chunk échoue
   * (réseau), résout `null` (dégradation) et RÉINITIALISE le cache pour
   * retenter au prochain appel — jamais de promesse rejetée mémorisée.
   */
  getClient(): Promise<SupabaseClient | null> {
    if (!this.enabled) return Promise.resolve(null);
    this.#clientPromise ??= import('@supabase/supabase-js').then(
      ({ createClient }) =>
        createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
        }),
      () => {
        this.#clientPromise = null;
        return null;
      },
    );
    return this.#clientPromise;
  }
}
