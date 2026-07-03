import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Comparateur } from './comparateur';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('Comparateur', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Comparateur],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('se construit et affiche le champ d’ajout + l’état vide', async () => {
    const fixture = TestBed.createComponent(Comparateur);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.add__input')).toBeTruthy();
    expect(el.querySelector('.empty')).toBeTruthy();

    // purge les ressources d'index en vol
    await tick();
    ctrl.match(() => true).forEach((r) => r.flush({ v: 1, gen: '', items: [] }));
  });
});
