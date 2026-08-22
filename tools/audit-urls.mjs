// Audit d'indexabilité des URLs du sitemap (critère de succès du plan de
// correction : « 0 redirection sur un échantillon aléatoire de 500 URLs »).
//
// Pour CHAQUE URL testée, vérifie qu'elle répond 200 SANS redirection et que
// le HTML servi ne contient pas de `<meta name="robots" content="noindex">`.
// C'est exactement ce que Googlebot voit au premier hit : une 301 gaspille le
// budget de crawl, un noindex retire la page de l'index.
//
// Usage :
//   node tools/audit-urls.mjs                    # 500 URLs au hasard du sitemap EN LIGNE
//   node tools/audit-urls.mjs --local            # lit public/sitemap.xml au lieu du site
//   node tools/audit-urls.mjs --sample 0         # toutes les URLs (long : ~35 000)
//   node tools/audit-urls.mjs --sample 50 --concurrence 5
//   node tools/audit-urls.mjs --site https://exemple.fr
//
// Sortie non nulle si au moins une URL redirige, échoue ou est en noindex.
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (nom, defaut) => {
  const i = args.indexOf(`--${nom}`);
  return i === -1 ? defaut : args[i + 1];
};
const flag = (nom) => args.includes(`--${nom}`);

const SITE = (opt('site', 'https://planmaville.fr')).replace(/\/$/, '');
const ECHANTILLON = Number(opt('sample', '500')); // 0 = tout
const CONCURRENCE = Math.max(1, Number(opt('concurrence', '8')));
const LOCAL = flag('local');
const TIMEOUT = 20000;

// Graine fixe : deux exécutions consécutives testent le même échantillon, ce
// qui rend un avant/après déploiement comparable (Math.random ne le permet pas).
function melangeDeterministe(liste, graine) {
  const out = [...liste];
  let etat = graine >>> 0 || 1;
  const suivant = () => {
    etat ^= etat << 13; etat >>>= 0;
    etat ^= etat >> 17;
    etat ^= etat << 5; etat >>>= 0;
    return etat / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(suivant() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function lireSitemap() {
  if (LOCAL) {
    const xml = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  }
  const res = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`${SITE}/sitemap.xml → HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/**
 * `redirect: 'manual'` : on veut voir la 301 elle-même, pas la page finale.
 * GET (pas HEAD) car seul le corps révèle un `noindex` — et certains hôtes
 * statiques ne répondent pas à HEAD comme à GET.
 */
async function verifie(url) {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': 'plan-ma-ville-audit/1.0' },
    });
    if (res.status >= 300 && res.status < 400) {
      return { url, ok: false, raison: `${res.status} → ${res.headers.get('location') ?? '?'}` };
    }
    if (res.status !== 200) return { url, ok: false, raison: `HTTP ${res.status}` };
    const html = await res.text();
    if (/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html)) {
      return { url, ok: false, raison: 'noindex dans le HTML servi' };
    }
    return { url, ok: true };
  } catch (err) {
    return { url, ok: false, raison: `échec réseau : ${err.message}` };
  }
}

const toutes = await lireSitemap();
if (toutes.length === 0) {
  console.error('✗ Aucune URL dans le sitemap.');
  process.exit(1);
}
const cibles =
  ECHANTILLON > 0 && ECHANTILLON < toutes.length
    ? melangeDeterministe(toutes, 20260822).slice(0, ECHANTILLON)
    : toutes;

console.log(
  `▸ Audit de ${cibles.length}/${toutes.length} URLs (${LOCAL ? 'sitemap local' : `sitemap de ${SITE}`}), ${CONCURRENCE} en parallèle…`,
);

const echecs = [];
let faits = 0;
const file = [...cibles];
await Promise.all(
  Array.from({ length: CONCURRENCE }, async () => {
    for (let u = file.pop(); u !== undefined; u = file.pop()) {
      const r = await verifie(u);
      if (!r.ok) echecs.push(r);
      if (++faits % 100 === 0) console.log(`  · ${faits}/${cibles.length}…`);
    }
  }),
);

if (echecs.length === 0) {
  console.log(`✓ ${cibles.length} URLs : 200 direct, aucune redirection, aucun noindex.`);
  process.exit(0);
}

// Regroupé par raison : 7 000 URLs qui redirigent toutes pour la même cause ne
// doivent pas noyer le diagnostic sous 7 000 lignes.
const parRaison = new Map();
for (const e of echecs) {
  const cle = e.raison.replace(/https?:\/\/[^\s]*/g, '<url>');
  if (!parRaison.has(cle)) parRaison.set(cle, []);
  parRaison.get(cle).push(e);
}
console.error(`\n✗ ${echecs.length}/${cibles.length} URLs problématiques :`);
for (const [raison, liste] of [...parRaison].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`\n  ${liste.length}× ${raison}`);
  for (const e of liste.slice(0, 5)) console.error(`    - ${e.url} (${e.raison})`);
  if (liste.length > 5) console.error(`    … et ${liste.length - 5} autres`);
}
process.exit(1);
