import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CommuneAvisForm } from './commune-avis-form';

describe('CommuneAvisForm', () => {
  it('active « Publier » seulement quand les points positifs atteignent 20 caractères', () => {
    TestBed.configureTestingModule({
      imports: [CommuneAvisForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(CommuneAvisForm);
    fixture.componentRef.setInput('codeInsee', '75056');
    fixture.detectChanges();

    const submit = (fixture.nativeElement as HTMLElement).querySelector(
      '.form__submit',
    ) as HTMLButtonElement;
    const positifs = (fixture.nativeElement as HTMLElement).querySelector(
      'textarea',
    ) as HTMLTextAreaElement;

    // trop court → désactivé
    positifs.value = 'trop court';
    positifs.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(submit.disabled).toBe(true);

    // ≥ 20 caractères → activé
    positifs.value = 'Ville très agréable à vivre, calme et bien desservie.';
    positifs.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(submit.disabled).toBe(false);
  });
});
