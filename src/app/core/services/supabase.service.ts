import { Injectable } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Point d'entrée Supabase. Les features communautaires sont optionnelles :
 * tant que `supabaseUrl` / `supabaseAnonKey` ne sont pas renseignés (secrets
 * CI), `enabled` vaut false et `client` est null → l'UI se dégrade proprement.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  /** true seulement si une vraie URL + clé anon sont configurées. */
  readonly enabled =
    /^https?:\/\//.test(environment.supabaseUrl) &&
    environment.supabaseAnonKey.length > 0 &&
    !environment.supabaseAnonKey.startsWith('__');

  readonly client: SupabaseClient | null = this.enabled
    ? createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;
}
