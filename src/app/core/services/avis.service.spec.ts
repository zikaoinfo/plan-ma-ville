import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AvisService } from './avis.service';
import { SupabaseService } from './supabase.service';

// En test, environment.ts contient des placeholders (__SUPABASE_URL__…),
// donc Supabase doit être désactivé et tout se dégrader sans planter.
describe('Supabase désactivé (non configuré)', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('SupabaseService : enabled=false, client=null', async () => {
    const sb = TestBed.inject(SupabaseService);
    expect(sb.enabled).toBe(false);
    expect(await sb.getClient()).toBeNull();
  });

  it('AvisService : se dégrade en [] / null / map vide', async () => {
    const avis = TestBed.inject(AvisService);
    expect(avis.disponible).toBe(false);
    expect(await avis.loadAvis('75056')).toEqual([]);
    expect(await avis.loadStats('75056')).toBeNull();
    expect((await avis.loadStatsBatch(['75056'])).size).toBe(0);
    expect(await avis.getUserAvis('u', '75056')).toBeNull();
    await expect(avis.submitAvis({} as never)).rejects.toThrow();
  });
});
