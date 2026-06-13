import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { Commune } from './commune';

describe('Commune', () => {
  it("se construit sans erreur de contexte d'injection et démarre en chargement", () => {
    TestBed.configureTestingModule({
      imports: [Commune],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    const fixture = TestBed.createComponent(Commune);
    fixture.componentRef.setInput('slug', 'lyon-69123');
    fixture.detectChanges();

    // index.json encore en vol (HttpTestingController) → état de chargement,
    // skeleton affiché, aucune exception levée à la création des ressources.
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.skeleton')).toBeTruthy();
  });
});
