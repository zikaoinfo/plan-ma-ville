import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  resolveTheme,
  sanitiseTheme,
  THEME_STORAGE_KEY,
  ThemeService,
} from './theme.service';

describe('sanitiseTheme', () => {
  it('accepte light/dark/system', () => {
    expect(sanitiseTheme('light')).toBe('light');
    expect(sanitiseTheme('dark')).toBe('dark');
    expect(sanitiseTheme('system')).toBe('system');
  });

  it("replie tout l'inattendu sur system", () => {
    expect(sanitiseTheme(null)).toBe('system');
    expect(sanitiseTheme(undefined)).toBe('system');
    expect(sanitiseTheme('DARK')).toBe('system');
    expect(sanitiseTheme('bleu')).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('préférence explicite : ignore le système', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('system : suit prefers-color-scheme', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('ThemeService', () => {
  let doc: Document;

  beforeEach(() => {
    doc = TestBed.inject(DOCUMENT);
    doc.defaultView?.localStorage.removeItem(THEME_STORAGE_KEY);
    delete doc.documentElement.dataset['theme'];
  });

  it('applique data-theme sur <html> et persiste la préférence', () => {
    const service = TestBed.inject(ThemeService);
    service.setPreference('dark');
    TestBed.tick(); // flush des effects (zoneless)

    expect(doc.documentElement.dataset['theme']).toBe('dark');
    expect(doc.defaultView?.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(service.resolved()).toBe('dark');
  });

  it('bascule light → dark au runtime', () => {
    const service = TestBed.inject(ThemeService);
    service.setPreference('light');
    TestBed.tick();
    expect(doc.documentElement.dataset['theme']).toBe('light');

    service.setPreference('dark');
    TestBed.tick();
    expect(doc.documentElement.dataset['theme']).toBe('dark');
  });
});
