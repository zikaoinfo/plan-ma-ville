import {
  HttpErrorResponse,
  type HttpEvent,
  type HttpHandlerFn,
  type HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { readFileSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { type Observable, of, throwError } from 'rxjs';

const DATA_DIR = join(process.cwd(), 'public', 'data');

/**
 * Intercepteur SERVEUR (prerender uniquement) : sert les requêtes `data/*.json`
 * depuis `public/data/` sur disque, en SYNCHRONE. C'est le contournement du
 * piège connu du prerender Angular (les fetchs HTTP asynchrones ne sont pas
 * toujours attendus avant la sérialisation → pages vides aléatoires) : ici la
 * réponse est émise immédiatement, la page est sérialisée avec ses données.
 * En CI, `data:build` tourne AVANT `ng build`, donc les fichiers existent.
 */
export function donneesLocalesInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const m = /\/data\/([\w/.-]+\.json)$/.exec(req.url);
  if (!m) return next(req);

  const fichier = normalize(m[1]);
  if (fichier.split(sep).includes('..')) return next(req);

  try {
    const body: unknown = JSON.parse(readFileSync(join(DATA_DIR, fichier), 'utf8'));
    return of(new HttpResponse({ status: 200, body, url: req.url }));
  } catch {
    // Fichier absent (build local sans données) : 404 → les httpResource
    // passent en erreur, les pages prérendues affichent l'état dégradé.
    return throwError(
      () => new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: req.url }),
    );
  }
}
