import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { AvisService } from '../../../core/services/avis.service';
import { CommuneAvisForm } from './commune-avis-form';

const INVITE = { id: 'u-invite', is_anonymous: true } as User;

/** Laisse les promesses en vol (submit async) se résoudre. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
}

function mount(providers: unknown[] = []) {
  TestBed.configureTestingModule({
    imports: [CommuneAvisForm],
    providers: [provideHttpClient(), provideHttpClientTesting(), ...providers],
  });
  const fixture = TestBed.createComponent(CommuneAvisForm);
  fixture.componentRef.setInput('codeInsee', '75056');
  fixture.detectChanges();
  return fixture;
}

/** AuthService factice : invité potentiel (aucune session au départ). */
function mockAuth() {
  return {
    user: signal<User | null>(null),
    connecteCompte: () => false,
    ensureUser: vi.fn().mockResolvedValue(INVITE),
    attacherEmail: vi.fn().mockResolvedValue({ ok: true, dejaPris: false }),
    loginWithEmail: vi.fn().mockResolvedValue({ ok: true }),
    pseudo: () => 'Habitant',
  };
}

function mockAvis() {
  return {
    getUserAvis: vi.fn().mockResolvedValue(null),
    getAnonymeDefaut: vi.fn().mockResolvedValue(false),
    submitAvis: vi.fn().mockResolvedValue(undefined),
    deleteAvis: vi.fn().mockResolvedValue(undefined),
  };
}

function remplirPositifs(el: HTMLElement, fixture: ReturnType<typeof mount>): void {
  const positifs = el.querySelector('textarea') as HTMLTextAreaElement;
  positifs.value = 'Une commune très agréable à vivre au quotidien.';
  positifs.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('CommuneAvisForm', () => {
  it('le bouton « Publier » reste cliquable (jamais grisé par la validation)', () => {
    const fixture = mount();
    const submit = (fixture.nativeElement as HTMLElement).querySelector(
      '.form__submit',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('affiche un message si les points positifs sont trop courts', () => {
    const fixture = mount();
    const el = fixture.nativeElement as HTMLElement;
    const positifs = el.querySelector('textarea') as HTMLTextAreaElement;

    positifs.value = 'trop court';
    positifs.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (el.querySelector('.form__submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.form__msg--err')?.textContent).toContain('20');
  });

  it('la case « Publier anonymement » met à jour le message d\'aide', () => {
    const fixture = mount();
    const el = fixture.nativeElement as HTMLElement;
    const checkbox = el.querySelector('.form__anonyme input') as HTMLInputElement;

    expect(checkbox.checked).toBe(false);
    expect(el.querySelector('.form__hint')?.textContent).toContain('pseudonyme');

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(el.querySelector('.form__hint')?.textContent).toContain('Habitant anonyme');
  });

  it('affiche le champ email optionnel pour un visiteur sans compte', () => {
    const fixture = mount();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[type="email"]')).not.toBeNull();
    expect(el.querySelector('.form__rgpd')?.textContent).toContain('jamais affiché');
  });

  it('mode invité : publie via ensureUser (session anonyme à la volée)', async () => {
    const auth = mockAuth();
    const avis = mockAvis();
    const fixture = mount([
      { provide: AuthService, useValue: auth },
      { provide: AvisService, useValue: avis },
    ]);
    const el = fixture.nativeElement as HTMLElement;
    remplirPositifs(el, fixture);

    (el.querySelector('.form__submit') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect(auth.ensureUser).toHaveBeenCalledOnce();
    expect(avis.submitAvis).toHaveBeenCalledOnce();
    expect(avis.submitAvis.mock.calls[0][0]).toMatchObject({
      commune_insee: '75056',
      user_id: 'u-invite',
    });
    // Pas d'email saisi → pas de conversion tentée, message simple.
    expect(auth.attacherEmail).not.toHaveBeenCalled();
    expect(el.querySelector('.form__msg--ok')?.textContent).toContain('enregistré');
  });

  it('email optionnel rempli : rattaché APRÈS publication, message « vérifier »', async () => {
    const auth = mockAuth();
    const avis = mockAvis();
    const fixture = mount([
      { provide: AuthService, useValue: auth },
      { provide: AvisService, useValue: avis },
    ]);
    const el = fixture.nativeElement as HTMLElement;
    remplirPositifs(el, fixture);

    const email = el.querySelector('input[type="email"]') as HTMLInputElement;
    email.value = 'zoe@exemple.fr';
    email.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (el.querySelector('.form__submit') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect(avis.submitAvis).toHaveBeenCalledOnce();
    expect(auth.attacherEmail).toHaveBeenCalledWith('zoe@exemple.fr');
    expect(el.querySelector('.form__msg--ok')?.textContent).toContain('confirmation');
  });

  it('email déjà pris : l\'avis reste publié, propose le lien de connexion', async () => {
    const auth = mockAuth();
    auth.attacherEmail = vi.fn().mockResolvedValue({ ok: false, dejaPris: true });
    const avis = mockAvis();
    const fixture = mount([
      { provide: AuthService, useValue: auth },
      { provide: AvisService, useValue: avis },
    ]);
    const el = fixture.nativeElement as HTMLElement;
    remplirPositifs(el, fixture);

    const email = el.querySelector('input[type="email"]') as HTMLInputElement;
    email.value = 'deja@pris.fr';
    email.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (el.querySelector('.form__submit') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect(avis.submitAvis).toHaveBeenCalledOnce();
    expect(el.querySelector('.form__msg--info')?.textContent).toContain('déjà associé');

    (el.querySelector('.form__lien') as HTMLButtonElement).click();
    await flush();
    fixture.detectChanges();

    expect(auth.loginWithEmail).toHaveBeenCalledWith('deja@pris.fr');
    expect(el.querySelector('.form__msg--ok')?.textContent).toContain('Lien de connexion envoyé');
  });

  it('avis existant : bouton « Supprimer mon avis » → deleteAvis + reset', async () => {
    const auth = mockAuth();
    auth.user.set(INVITE);
    const avis = mockAvis();
    avis.getUserAvis = vi.fn().mockResolvedValue({
      note_securite: 7,
      note_sante: 7,
      note_commerces: 7,
      note_enseignement: 7,
      note_sports: 7,
      note_culture: 7,
      note_transports: 7,
      note_niveau_vie: 7,
      positifs: 'Un avis existant suffisamment long pour la validation.',
      negatifs: null,
      anonyme: false,
    });
    const fixture = mount([
      { provide: AuthService, useValue: auth },
      { provide: AvisService, useValue: avis },
    ]);
    await flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.form__title')?.textContent).toContain('Modifier');
    const suppr = el.querySelector('.form__delete') as HTMLButtonElement;
    expect(suppr).not.toBeNull();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    suppr.click();
    await flush();
    fixture.detectChanges();

    expect(avis.deleteAvis).toHaveBeenCalledWith('u-invite', '75056');
    expect(el.querySelector('.form__title')?.textContent).toContain('Donner mon avis');
  });
});
