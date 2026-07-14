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
  console.warn('::warning::IndexNow ignoré : aucune URL dans le sitemap.');
  process.exit(0);
}

// Auto-vérification : IndexNow renvoie 403 si la clé n'est pas EXACTEMENT
// servie à keyLocation. On la récupère et on compare AVANT de soumettre, pour
// un diagnostic clair (fichier absent, HTTPS pas prêt, contenu inattendu) au
// lieu d'un 403 opaque. Sur domaine neuf, le certificat/propagation peut ne
// pas être prêt → on saute proprement (retry au prochain déploiement).
const keyLocation = `${SITE}/${cle}.txt`;
try {
  const check = await fetch(keyLocation, { signal: AbortSignal.timeout(15000) });
  const contenu = (await check.text()).trim();
  if (!check.ok || contenu !== cle) {
    console.warn(
      `::warning::IndexNow ignoré : ${keyLocation} a répondu ${check.status} / contenu inattendu ` +
        `(la clé n'est pas encore servie telle quelle — HTTPS/propagation en cours ?). Réessai au prochain déploiement.`,
    );
    process.exit(0);
  }
} catch (err) {
  console.warn(`::warning::IndexNow ignoré : clé ${keyLocation} injoignable (${err.message}). Réessai au prochain déploiement.`);
  process.exit(0);
}

// L'API accepte jusqu'à 10 000 URLs par appel.
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'planmaville.fr', key: cle, keyLocation, urlList: urls }),
});
if (res.ok || res.status === 202) {
  console.log(`✓ IndexNow : ${urls.length} URLs soumises → HTTP ${res.status}`);
} else {
  // Best-effort (Bing/Yandex uniquement — Google n'utilise pas IndexNow) :
  // un 403 sur domaine neuf est fréquent (clé pas encore validée côté moteur)
  // et se résout aux déploiements suivants. On n'échoue jamais le pipeline.
  console.warn(
    `::warning::IndexNow : ${urls.length} URLs soumises → HTTP ${res.status} (non bloquant ; ` +
      `${res.status === 403 ? 'validation de clé en attente côté moteur, ' : ''}Google passe de toute façon par GSC + sitemap).`,
  );
}
