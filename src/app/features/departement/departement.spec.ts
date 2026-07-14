import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Departement } from './departement';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Departement — gestion des erreurs de chargement', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Departement],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  /** Attend qu'une requête vers `urlEnd` soit émise, puis la sert (ou l'échoue). */
  async function respond(
    fixture: { detectChanges(): void },
    urlEnd: string,
    respond: (req: ReturnType<HttpTestingController['match']>[number]) => void,
  ): Promise<void> {
    for (let i = 0; i < 12; i++) {
      fixture.detectChanges();
      const reqs = ctrl.match((r) => r.url.endsWith(urlEnd));
      if (reqs.length) {
        reqs.forEach(respond);
        return;
      }
      await tick();
    }
    throw new Error(`Aucune requête émise vers ${urlEnd}`);
  }

  it("affiche un état d'erreur (pas un spinner infini) pour un code inconnu", async () => {
    const fixture = TestBed.createComponent(Departement);
    fixture.componentRef.setInput('code', '99');

    await respond(fixture, '/data/dep/99.json', (r) =>
      r.flush('not found', { status: 404, statusText: 'Not Found' }),
    );

    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await tick();
    }

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-error-message')).toBeTruthy();
    expect(el.querySelector('.loading')).toBeNull();

    // Les ressources annexes (index/departements/regions) peuvent rester en vol.
    ctrl.match(() => true).forEach((r) => r.flush({ v: 1, gen: '', items: [] }));
  });

  it('normalise le code en majuscules (2a → dep/2A.json)', async () => {
    const fixture = TestBed.createComponent(Departement);
    fixture.componentRef.setInput('code', '2a');

    await respond(fixture, '/data/dep/2A.json', (r) =>
      r.flush({ v: 1, gen: '2026-01-01', code: '2A', nom: 'Corse-du-Sud', communes: [] }),
    );

    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await tick();
    }

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Corse-du-Sud');

    ctrl.match(() => true).forEach((r) => r.flush({ v: 1, gen: '', items: [] }));
  });
});
