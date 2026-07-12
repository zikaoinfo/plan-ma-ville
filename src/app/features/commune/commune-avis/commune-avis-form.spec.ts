import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CommuneAvisForm } from './commune-avis-form';

describe('CommuneAvisForm', () => {
  function mount() {
    TestBed.configureTestingModule({
      imports: [CommuneAvisForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(CommuneAvisForm);
    fixture.componentRef.setInput('codeInsee', '75056');
    fixture.detectChanges();
    return fixture;
  }

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
});
