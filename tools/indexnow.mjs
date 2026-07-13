// Ping IndexNow (Bing/Yandex/Seznam/Naver — Google ne le supporte pas) après
// déploiement : lit le sitemap EN LIGNE et soumet toutes les URLs en un POST.
// La clé est le nom du fichier public/<clé>.txt servi à la racine du site.
// Lancé par deploy.yml uniquement quand SITE_INDEXABLE=true.
import { readdirSync, readFileSync } from 'node:fs';

const SITE = 'https://planmaville.fr';

const cle = readdirSync(new URL('../public/', import.meta.url))
  .find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
  ?.replace(/\.txt$/, '');
if (!cle) {
  console.error('✗ IndexNow : aucun fichier de clé public/<hex32>.txt');
  process.exit(1);
}

// Le sitemap peut être temporairement injoignable : DNS/HTTPS pas encore
// propagés le jour du lancement, ou fenêtre de bascule GitHub Pages. Ce n'est
// PAS une erreur de déploiement — on prévient et on sortira proprement (le
// ping se fera au prochain déploiement, une fois le domaine servi).
let reponse;
try {
  reponse = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(15000) });
} catch (err) {
  console.warn(`::warning::IndexNow ignoré : ${SITE}/sitemap.xml injoignable (${err.message}). Le ping se fera au prochain déploiement.`);
  process.exit(0);
}
if (!reponse.ok) {
  console.warn(`::warning::IndexNow ignoré : ${SITE}/sitemap.xml a répondu ${reponse.status} (site pas encore en ligne ?). Réessai au prochain déploiement.`);
  process.exit(0);
}
const xml = await reponse.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.error('✗ IndexNow : aucune URL dans le sitemap');
  process.exit(1);
}

// L'API accepte jusqu'à 10 000 URLs par appel.
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: 'planmaville.fr',
    key: cle,
    keyLocation: `${SITE}/${cle}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow : ${urls.length} URLs soumises → HTTP ${res.status}`);
if (!res.ok && res.status !== 202) process.exit(1);
