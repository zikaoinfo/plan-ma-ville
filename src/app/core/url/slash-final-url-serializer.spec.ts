import { DefaultUrlSerializer } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { SlashFinalUrlSerializer } from './slash-final-url-serializer';

const segments = (serializer: DefaultUrlSerializer, url: string): string[] =>
  serializer.parse(url).root.children['primary']?.segments.map((s) => s.path) ?? [];

describe('SlashFinalUrlSerializer', () => {
  const s = new SlashFinalUrlSerializer();

  it('RÉGRESSION : le sérialiseur par défaut casse les URLs à slash final', () => {
    // Le bug d'origine : `/ville/x/` produit un TROISIÈME segment vide, donc la
    // route `ville/:slug` (2 segments) ne matche pas et le wildcard `**` rend
    // la page « introuvable » + noindex — sur l'URL même que GitHub Pages sert
    // (301 depuis `/ville/x`) et donc que Google crawle.
    expect(segments(new DefaultUrlSerializer(), '/ville/lyon-69123/')).toEqual([
      'ville',
      'lyon-69123',
      '',
    ]);
  });

  it('parse les deux formes vers les MÊMES segments de route', () => {
    expect(segments(s, '/ville/lyon-69123/')).toEqual(['ville', 'lyon-69123']);
    expect(segments(s, '/ville/lyon-69123')).toEqual(['ville', 'lyon-69123']);
    expect(segments(s, '/palmares/securite/94/')).toEqual(['palmares', 'securite', '94']);
    expect(segments(s, '/departement/2A/')).toEqual(['departement', '2A']);
  });

  it('sérialise toujours AVEC slash final (href des routerLink, barre d’adresse)', () => {
    expect(s.serialize(s.parse('/ville/lyon-69123'))).toBe('/ville/lyon-69123/');
    expect(s.serialize(s.parse('/ville/lyon-69123/'))).toBe('/ville/lyon-69123/');
    expect(s.serialize(s.parse('/'))).toBe('/');
  });

  it('préserve query et fragment (onglet avis, retour OAuth Supabase)', () => {
    expect(s.serialize(s.parse('/ville/lyon-69123?onglet=avis'))).toBe(
      '/ville/lyon-69123/?onglet=avis',
    );
    expect(segments(s, '/ville/lyon-69123/?onglet=avis')).toEqual(['ville', 'lyon-69123']);
    expect(s.parse('/ville/lyon-69123/?onglet=avis').queryParams).toEqual({ onglet: 'avis' });
    expect(s.parse('/ville/lyon-69123/#access_token=x').fragment).toBe('access_token=x');
  });

  it('est idempotent : re-sérialiser une URL déjà canonique ne l’allonge pas', () => {
    const une = s.serialize(s.parse('/comparer?villes=a,b'));
    expect(une).toBe('/comparer/?villes=a,b');
    expect(s.serialize(s.parse(une))).toBe(une);
  });
});
