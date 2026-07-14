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
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';

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
