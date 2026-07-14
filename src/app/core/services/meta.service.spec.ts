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
    // Le document jsdom est partagé entre fichiers de spec : purge les balises
    // robots posées par d'autres suites (états noindex de composants testés).
    doc.head.querySelectorAll('meta[data-page-robots]').forEach((t) => t.remove());
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

  it('noindex : pose une balise robots, puis la retire sur la page suivante', () => {
    const robots = () =>
      doc.head.querySelectorAll<HTMLMetaElement>('meta[name="robots"][data-page-robots]');

    service.setPage({ title: '404', description: 'd', canonicalPath: '/', noindex: true });
    expect(robots().length).toBe(1);

    // Un second setPage noindex ne duplique pas la balise.
    service.setPage({ title: '404b', description: 'd', canonicalPath: '/', noindex: true });
    expect(robots().length).toBe(1);

    service.setPage({ title: 'ok', description: 'd', canonicalPath: '/classement' });
    expect(robots().length).toBe(0);
  });

  it('émet les balises twitter:* en miroir des OG', () => {
    service.setPage({ title: 'titre X', description: 'desc X', canonicalPath: '/' });
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="twitter:title"')?.content).toBe('titre X');
    expect(meta.getTag('name="twitter:description"')?.content).toBe('desc X');
    expect(meta.getTag('name="twitter:image"')?.content).toContain('og-image.png');
  });
});
