import { Injectable } from '@angular/core';

declare global {
  interface Window {
    umami?: { track: (eventName: string, data?: Record<string, unknown>) => void };
  }
}

/**
 * Fine couche au-dessus du script Umami (chargé dans `index.html`, cookieless
 * — pas de bannière de consentement CNIL). `window.umami` n'existe ni au
 * prerender (pas de `window`) ni si le script n'a pas encore fini de charger :
 * `track()` se dégrade silencieusement dans ces cas, jamais d'erreur runtime.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  track(eventName: string, data?: Record<string, unknown>): void {
    if (typeof window !== 'undefined' && 'umami' in window) {
      window.umami?.track(eventName, data);
    }
  }
}
