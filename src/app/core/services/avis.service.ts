import { inject, Injectable } from '@angular/core';
import type { Avis, AvisInsert, CommuneStats } from '../models/data.models';
import { SupabaseService } from './supabase.service';

const PAGE_SIZE = 10;

/**
 * Accès aux avis habitants (Supabase). Toutes les méthodes se dégradent en
 * `[]` / `null` si Supabase n'est pas configuré.
 */
@Injectable({ providedIn: 'root' })
export class AvisService {
  readonly #sb = inject(SupabaseService);

  get disponible(): boolean {
    return this.#sb.enabled;
  }

  /** Page d'avis d'une commune (10 par page, plus récents d'abord). */
  async loadAvis(codeInsee: string, page = 0): Promise<Avis[]> {
    const client = this.#sb.client;
    if (!client) return [];
    const { data, error } = await client
      .from('avis')
      .select('*')
      .eq('commune_insee', codeInsee)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    return (data ?? []) as Avis[];
  }

  /** Stats agrégées (note habitants, nb avis) — null si aucune. */
  async loadStats(codeInsee: string): Promise<CommuneStats | null> {
    const client = this.#sb.client;
    if (!client) return null;
    const { data } = await client
      .from('communes_stats')
      .select('note_habitants, nb_avis, resume_ia')
      .eq('code_insee', codeInsee)
      .maybeSingle();
    return (data as CommuneStats | null) ?? null;
  }

  /** Stats de plusieurs communes d'un coup (classement / comparateur). */
  async loadStatsBatch(codesInsee: string[]): Promise<Map<string, CommuneStats>> {
    const client = this.#sb.client;
    const map = new Map<string, CommuneStats>();
    if (!client || codesInsee.length === 0) return map;
    const { data } = await client
      .from('communes_stats')
      .select('code_insee, note_habitants, nb_avis, resume_ia')
      .in('code_insee', codesInsee);
    for (const row of (data ?? []) as (CommuneStats & { code_insee: string })[]) {
      map.set(row.code_insee, {
        note_habitants: row.note_habitants,
        nb_avis: row.nb_avis,
        resume_ia: row.resume_ia,
      });
    }
    return map;
  }

  /** Avis de l'utilisateur pour cette commune (pour pré-remplir le formulaire). */
  async getUserAvis(userId: string, codeInsee: string): Promise<Avis | null> {
    const client = this.#sb.client;
    if (!client) return null;
    const { data } = await client
      .from('avis')
      .select('*')
      .eq('user_id', userId)
      .eq('commune_insee', codeInsee)
      .maybeSingle();
    return (data as Avis | null) ?? null;
  }

  /** Crée ou met à jour l'avis (1 par user par commune). */
  async submitAvis(avis: AvisInsert): Promise<void> {
    const client = this.#sb.client;
    if (!client) throw new Error('Supabase non configuré');
    const { error } = await client.from('avis').upsert(avis, {
      onConflict: 'user_id,commune_insee',
    });
    if (error) throw error;
  }
}
