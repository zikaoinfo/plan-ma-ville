import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { MetaService } from './meta.service';

describe('MetaService', () => {
  let service: MetaService;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MetaService);
    doc = TestBed.inject(DOCUMENT);
  });

  it('met à jour le titre et la meta description', () => {
    service.setPage({ title: 'Lyon — test', description: 'desc Lyon', canonicalPath: '/ville/lyon-69123' });

    expect(TestBed.inject(Title).getTitle()).toBe('Lyon — test');
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe('desc Lyon');
  });

  it("pose une URL OpenGraph et un lien canonique préfixés du baseUrl", () => {
    service.setPage({ title: 't', description: 'd', canonicalPath: '/classement' });

    const og = TestBed.inject(Meta).getTag('property="og:url"')?.content;
    expect(og).toBe(environment.baseUrl + '/classement');

    const canonical = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe(environment.baseUrl + '/classement');
  });

  it('réutilise le même lien canonique entre deux pages (pas de doublon)', () => {
    service.setPage({ title: 'a', description: 'a', canonicalPath: '/' });
    service.setPage({ title: 'b', description: 'b', canonicalPath: '/methodologie' });

    expect(doc.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toMatch(
      /\/methodologie$/,
    );
  });
});
