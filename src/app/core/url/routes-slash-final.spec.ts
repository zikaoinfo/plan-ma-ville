import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Routes, UrlSerializer } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { SlashFinalUrlSerializer } from './slash-final-url-serializer';

@Component({ template: '' })
class Vide {}

/**
 * Les VRAIS chemins de `app.routes.ts`, composants remplacés par un stub : le
 * test porte sur le MATCHING d'URL, pas sur le rendu (charger les composants
 * réels tirerait Leaflet, Supabase & co. dans la suite unitaire).
 */
const cheminsReels: Routes = routes.map(({ path }) => ({ path, component: Vide }));

async function routeMatchee(url: string): Promise<string | undefined> {
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  return router.routerState.snapshot.root.firstChild?.routeConfig?.path;
}

describe('routes × slash final', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(cheminsReels),
        { provide: UrlSerializer, useClass: SlashFinalUrlSerializer },
      ],
    });
  });

  /**
   * RÉGRESSION (cause n°1 de la désindexation). GitHub Pages sert le HTML
   * prérendu à l'URL AVEC slash final et redirige (301) la forme sans slash :
   * c'est donc `/ville/{slug}/` que Googlebot charge et exécute. Sans le
   * sérialiseur, cette URL tombait sur le wildcard `**` → page « Commune
   * introuvable » + `<meta name="robots" content="noindex">` posé à
   * l'hydratation → page retirée de l'index par Google.
   */
  it.each([
    ['/ville/lyon-69123/', 'ville/:slug'],
    ['/ville/lyon-69123', 'ville/:slug'],
    ['/departement/94/', 'departement/:code'],
    ['/region/11/', 'region/:code'],
    ['/palmares/securite/94/', 'palmares/securite/:code'],
    ['/palmares/prix/94/', 'palmares/prix/:code'],
    ['/palmares/autour/lyon-69123/', 'palmares/autour/:slug'],
    ['/classement/', 'classement'],
    ['/regions/', 'regions'],
    ['/methodologie/', 'methodologie'],
    ['/comparer/', 'comparer'],
    ['/carte/', 'carte'],
    ['/', ''],
  ])('%s matche la route %s (et non le wildcard 404)', async (url, attendu) => {
    expect(await routeMatchee(url)).toBe(attendu);
  });

  it('une URL réellement inconnue tombe toujours sur le 404', async () => {
    expect(await routeMatchee('/nawak/')).toBe('**');
    expect(await routeMatchee('/nawak')).toBe('**');
  });

  it("normalise l'URL affichée vers la forme canonique à slash final", async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/ville/lyon-69123');
    expect(router.url).toBe('/ville/lyon-69123/');
    await router.navigateByUrl('/ville/lyon-69123/?onglet=avis');
    expect(router.url).toBe('/ville/lyon-69123/?onglet=avis');
  });
});
