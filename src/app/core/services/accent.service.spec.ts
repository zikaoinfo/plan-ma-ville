import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccentService, ACCENT_STORAGE_KEY, sanitiseAccent } from './accent.service';

describe('sanitiseAccent', () => {
  it('accepte orange/jaune/vert/bleu', () => {
    expect(sanitiseAccent('orange')).toBe('orange');
    expect(sanitiseAccent('jaune')).toBe('jaune');
    expect(sanitiseAccent('vert')).toBe('vert');
    expect(sanitiseAccent('bleu')).toBe('bleu');
  });

  it("replie tout l'inattendu sur orange (défaut)", () => {
    expect(sanitiseAccent(null)).toBe('orange');
    expect(sanitiseAccent(undefined)).toBe('orange');
    expect(sanitiseAccent('violet')).toBe('orange');
    expect(sanitiseAccent('BLEU')).toBe('orange');
  });
});

describe('AccentService', () => {
  let doc: Document;

  beforeEach(() => {
    doc = TestBed.inject(DOCUMENT);
    doc.defaultView?.localStorage.removeItem(ACCENT_STORAGE_KEY);
    delete doc.documentElement.dataset['accent'];
  });

  it("applique data-accent sur <html> et persiste l'accent", () => {
    const service = TestBed.inject(AccentService);
    service.setAccent('bleu');
    TestBed.tick(); // flush des effects (zoneless)

    expect(doc.documentElement.dataset['accent']).toBe('bleu');
    expect(doc.defaultView?.localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('bleu');
  });

  it('démarre sur orange sans préférence stockée', () => {
    const service = TestBed.inject(AccentService);
    TestBed.tick();

    expect(service.accent()).toBe('orange');
    expect(doc.documentElement.dataset['accent']).toBe('orange');
  });
});
