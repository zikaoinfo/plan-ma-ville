import { TestBed } from '@angular/core/testing';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const INVITE = { id: 'u-invite', is_anonymous: true } as User;
const COMPTE = { id: 'u-compte', email: 'a@b.fr', is_anonymous: false } as User;

/** Client Supabase minimal, sans session par défaut. */
function mockClient(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { user: INVITE }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      linkIdentity: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      ...overrides,
    },
  };
}

function setup(client: ReturnType<typeof mockClient> | null) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SupabaseService,
        useValue: { enabled: client !== null, getClient: () => Promise.resolve(client) },
      },
    ],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService — mode invité', () => {
  it('ensureUser crée une session anonyme quand il n\'y en a aucune', async () => {
    const client = mockClient();
    const auth = setup(client);

    const user = await auth.ensureUser();

    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(user).toEqual(INVITE);
    expect(auth.user()).toEqual(INVITE);
    expect(auth.estAnonyme()).toBe(true);
    expect(auth.connecteCompte()).toBe(false);
  });

  it('ensureUser réutilise la session existante sans en créer', async () => {
    const client = mockClient({
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: COMPTE } } }),
    });
    const auth = setup(client);

    const user = await auth.ensureUser();

    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(user).toEqual(COMPTE);
    expect(auth.estAnonyme()).toBe(false);
    expect(auth.connecteCompte()).toBe(true);
  });

  it('ensureUser se dégrade en null sans Supabase', async () => {
    const auth = setup(null);
    expect(await auth.ensureUser()).toBeNull();
  });

  it('attacherEmail convertit le compte invité (ok)', async () => {
    const client = mockClient();
    const auth = setup(client);

    expect(await auth.attacherEmail('a@b.fr')).toEqual({ ok: true, dejaPris: false });
    expect(client.auth.updateUser).toHaveBeenCalledWith(
      { email: 'a@b.fr' },
      expect.objectContaining({ emailRedirectTo: expect.any(String) }),
    );
  });

  it('attacherEmail signale un email déjà pris (email_exists)', async () => {
    const client = mockClient({
      updateUser: vi
        .fn()
        .mockResolvedValue({ error: { code: 'email_exists', message: 'Email already registered' } }),
    });
    const auth = setup(client);

    expect(await auth.attacherEmail('a@b.fr')).toEqual({ ok: false, dejaPris: true });
  });

  it('attacherEmail se dégrade sans Supabase', async () => {
    const auth = setup(null);
    expect(await auth.attacherEmail('a@b.fr')).toEqual({ ok: false, dejaPris: false });
  });

  it('loginWithGoogle rattache l\'identité au compte invité (linkIdentity)', async () => {
    const client = mockClient();
    const auth = setup(client);
    await auth.ensureUser(); // devient invité

    await auth.loginWithGoogle();

    expect(client.auth.linkIdentity).toHaveBeenCalledOnce();
    expect(client.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('loginWithGoogle retombe sur la connexion classique si le lien échoue', async () => {
    const client = mockClient({
      linkIdentity: vi.fn().mockResolvedValue({ error: { message: 'identity already linked' } }),
    });
    const auth = setup(client);
    await auth.ensureUser();

    await auth.loginWithGoogle();

    expect(client.auth.signInWithOAuth).toHaveBeenCalledOnce();
  });

  it('loginWithGoogle sans session invitée : connexion classique directe', async () => {
    const client = mockClient();
    const auth = setup(client);

    await auth.loginWithGoogle();

    expect(client.auth.linkIdentity).not.toHaveBeenCalled();
    expect(client.auth.signInWithOAuth).toHaveBeenCalledOnce();
  });
});
