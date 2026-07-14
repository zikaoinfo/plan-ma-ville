// GitHub Pages ne connaît pas le routing SPA : servir un shell CSR en 404
// pour que /ville/lyon-69123 (ou toute route non prérendue, ex. callback
// OAuth Supabase) rechargée en direct retombe sur l'app côté client.
//
// Piège : en sortie 'static' avec des routes mixtes Prerender/Client,
// index.html à la racine est la page d'accueil PRÉRENDUE (path ''), pas un
// shell générique — la copier en 404.html renvoyait "ma ville, notée" en
// dur sur toute route non prérendue au lieu de laisser le routeur Angular
// résoudre l'URL réelle. Angular émet séparément index.csr.html (shell
// client pur) dès qu'au moins une route est en RenderMode.Client : on
// l'utilise en priorité, avec repli sur index.html si absent.
import { copyFile, access } from 'node:fs/promises';

const browserDir = new URL('../dist/ma-ville-notes/browser/', import.meta.url);

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

const csrUrl = new URL('index.csr.html', browserDir);
const source = (await exists(csrUrl)) ? csrUrl : new URL('index.html', browserDir);

await copyFile(source, new URL('404.html', browserDir));
console.log(`404.html généré dans dist/ma-ville-notes/browser/ (depuis ${source.pathname.split('/').pop()})`);
