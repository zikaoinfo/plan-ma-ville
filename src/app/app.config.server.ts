import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { donneesLocalesInterceptor } from './core/prerender/donnees-locales.interceptor';

/**
 * Configuration serveur (prerender/SSG). Le provideHttpClient d'ici PREND LE
 * PAS sur celui d'appConfig (mergé après) : toutes les requêtes data/*.json
 * sont servies depuis le disque, en synchrone — jamais de réseau au build.
 */
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(withInterceptors([donneesLocalesInterceptor])),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
