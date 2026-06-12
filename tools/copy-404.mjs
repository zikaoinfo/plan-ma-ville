// GitHub Pages ne connaît pas le routing SPA : servir index.html en 404
// pour que /ville/lyon-69123 rechargé en direct retombe sur l'app.
import { copyFile } from 'node:fs/promises';

const browserDir = new URL('../dist/ma-ville-notes/browser/', import.meta.url);

await copyFile(new URL('index.html', browserDir), new URL('404.html', browserDir));
console.log('404.html généré dans dist/ma-ville-notes/browser/');
