import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import {
  ApplicationConfig,
  isDevMode,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withNoHttpTransferCache,
} from '@angular/platform-browser';
import {
  provideRouter,
  UrlSerializer,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { SlashFinalUrlSerializer } from './core/url/slash-final-url-serializer';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Scroll : retour en haut à chaque navigation (et restauration à la
    // position précédente au retour arrière), ancres #fragment gérées.
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    // URLs canoniques AVEC slash final : c'est la seule forme que GitHub Pages
    // sert en 200 (le prerender écrit `ville/{slug}/index.html`). Sans ce
    // sérialiseur, une arrivée sur `/ville/{slug}/` — l'URL vers laquelle le
    // serveur redirige, donc celle que Google crawle — ne matchait AUCUNE route
    // et basculait sur la page « introuvable » + noindex à l'hydratation.
    { provide: UrlSerializer, useClass: SlashFinalUrlSerializer },
    provideHttpClient(),
    // Hydratation des pages prérendues (SSG). Transfer cache HTTP DÉSACTIVÉ :
    // il embarquerait index.json (~Mo) et dep/*.json dans chaque HTML.
    provideClientHydration(withEventReplay(), withNoHttpTransferCache()),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    // PWA : service worker actif en prod uniquement (ngsw-config.json).
    // Enregistré une fois l'app stable (ou après 30 s au plus tard).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
