/**
 * URL absolue d'un fichier de `data/`, résolue contre `document.baseURI`
 * (inclut le `<base href>` → correct en dev comme en prod, jamais de chemin
 * codé en dur). Au PRERENDER, le DOM serveur (domino) n'implémente pas
 * `baseURI` (NotYetImplemented) : on replie sur une origine factice — seul le
 * chemin `/data/…` compte, l'intercepteur serveur lit alors le disque.
 */
export function dataUrl(doc: Document, fichier: string): string {
  let base: string | undefined;
  try {
    base = doc.baseURI;
  } catch {
    base = undefined;
  }
  return new URL(`data/${fichier}`, base || 'http://prerender.local/').href;
}

/** `baseURI` sans slash final (liens absolus, ex. iframe OSM) ; '' au prerender. */
export function baseUri(doc: Document): string {
  try {
    return doc.baseURI.replace(/\/$/, '');
  } catch {
    return '';
  }
}
