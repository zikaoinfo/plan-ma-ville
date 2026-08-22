// Suivi SEO hebdomadaire (plan de croissance §5) : interroge la Search
// Console, estime l'indexation par segment de sitemap, enregistre la mesure
// dans Supabase et imprime un résumé de deltas. Alerte si les pages indexées
// reculent — c'est le signal qui a manqué début août 2026, où la perte
// d'indexation a couru trois semaines avant d'être remarquée.
//
// Usage :
//   npm run seo:monitor                  # mesure complète + enregistrement
//   node tools/seo-monitor/index.mjs --dry-run       # sans écrire dans Supabase
//   node tools/seo-monitor/index.mjs --echantillon 30
//
// Variables d'environnement :
//   GOOGLE_SERVICE_ACCOUNT_JSON  clé du compte de service (JSON ou base64)
//   GSC_SITE_URL                 propriété GSC (déf. https://planmaville.fr/)
//   SUPABASE_URL                 projet Supabase
//   SUPABASE_SERVICE_ROLE_KEY    clé service role (JAMAIS côté navigateur)
//   SLACK_WEBHOOK_URL            optionnel : destination de l'alerte
import { jetonAcces, litCompteDeService } from './google-auth.mjs';
import { estIndexee, performances } from './gsc.mjs';
import { agregeSegments, doitAlerter, formateResume, tauxSegment } from './resume.mjs';
import { derniereMesure, enregistreMesure } from './supabase.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};

const SITE = process.env['GSC_SITE_URL'] ?? 'https://planmaville.fr/';
const ORIGINE = SITE.replace(/\/$/, '');
const DRY = flag('dry-run');
/** URLs inspectées par segment. Quota URL Inspection : 2 000/jour, 600/min. */
const ECHANTILLON = Number(opt('echantillon', '40'));

const jour = (decalage) =>
  new Date(Date.now() - decalage * 86400000).toISOString().slice(0, 10);

/** Échantillon déterministe : la même semaine réinterroge les mêmes URLs. */
function echantillonne(urls, taille, graine) {
  if (urls.length <= taille) return [...urls];
  let etat = graine >>> 0 || 1;
  const suivant = () => {
    etat ^= etat << 13; etat >>>= 0;
    etat ^= etat >> 17;
    etat ^= etat << 5; etat >>>= 0;
    return etat / 0x100000000;
  };
  const copie = [...urls];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(suivant() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie.slice(0, taille);
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

/** Segments du sitemap EN LIGNE : { nom, urls[] } par sous-sitemap. */
async function litSegments() {
  const res = await fetch(`${ORIGINE}/sitemap.xml`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${ORIGINE}/sitemap.xml → HTTP ${res.status}`);
  const xml = await res.text();
  if (!/<sitemapindex/i.test(xml)) return [{ nom: 'sitemap.xml', urls: locs(xml) }];

  const segments = [];
  for (const url of locs(xml)) {
    const sous = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!sous.ok) {
      console.warn(`  ⚠ segment ${url} → HTTP ${sous.status}, ignoré`);
      continue;
    }
    segments.push({ nom: url.split('/').pop(), urls: locs(await sous.text()) });
  }
  return segments;
}

function exigeEnv(nom) {
  const v = process.env[nom];
  if (!v) {
    console.error(
      `✗ ${nom} manquant. Voir docs/SEO-MONITORING.md pour la configuration des secrets.`,
    );
    process.exit(1);
  }
  return v;
}

// ── Exécution ────────────────────────────────
const cle = litCompteDeService(exigeEnv('GOOGLE_SERVICE_ACCOUNT_JSON'));
const jeton = await jetonAcces(cle);

// La Search Console publie ses données avec ~2 jours de retard : une fenêtre
// qui irait jusqu'à aujourd'hui serait systématiquement incomplète.
const fin = jour(3);
const debut = jour(9);
console.log(`▸ Période analysée : ${debut} → ${fin}`);

const [totaux] = await performances(jeton, SITE, debut, fin, []);
const requetes = await performances(jeton, SITE, debut, fin, ['query'], 20);

console.log(`▸ Lecture du sitemap de ${ORIGINE}…`);
const segmentsSitemap = await litSegments();

const segments = [];
for (const segment of segmentsSitemap) {
  const cibles = echantillonne(segment.urls, ECHANTILLON, 20260822);
  process.stdout.write(`  · ${segment.nom} : ${cibles.length} URLs inspectées…`);
  const verdicts = [];
  for (const url of cibles) verdicts.push(await estIndexee(jeton, SITE, url));
  const { echantillon, indexees, taux } = tauxSegment(verdicts);
  segments.push({
    nom: segment.nom,
    urls_total: segment.urls.length,
    echantillon,
    indexees,
    taux,
  });
  console.log(` ${(taux * 100).toFixed(0)} % indexées`);
}

const mesure = {
  date: jour(0),
  periode_debut: debut,
  periode_fin: fin,
  impressions: totaux?.impressions ?? 0,
  clics: totaux?.clicks ?? 0,
  ctr: totaux?.ctr ?? 0,
  position_moyenne: totaux?.position ?? 0,
  ...agregeSegments(segments),
  segments,
  top_requetes: requetes.map((r) => ({
    requete: r.keys[0],
    impressions: r.impressions,
    clics: r.clicks,
    ctr: r.ctr,
    position: r.position,
  })),
};

// Supabase est optionnel : sans configuration, le script reste utile en
// affichant la mesure du jour (simplement sans comparaison ni historique).
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const stockage = Boolean(supabaseUrl && supabaseKey) && !DRY;
let precedent = null;
if (supabaseUrl && supabaseKey) {
  precedent = await derniereMesure(supabaseUrl, supabaseKey);
} else {
  console.warn('⚠ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents : pas d’historique ni de delta.');
}

console.log(`\n${formateResume(mesure, precedent)}\n`);

if (stockage) {
  await enregistreMesure(supabaseUrl, supabaseKey, mesure);
  console.log(`✓ Mesure du ${mesure.date} enregistrée dans seo_metrics.`);
} else {
  console.log('(mesure non enregistrée : --dry-run ou Supabase non configuré)');
}

const { alerte, raison } = doitAlerter(mesure, precedent);
if (alerte) {
  console.log(`::warning::${raison}`);
  const webhook = process.env['SLACK_WEBHOOK_URL'];
  if (webhook) {
    // Best-effort : une notification ratée ne doit pas masquer la mesure.
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🚨 planmaville.fr — ${raison}` }),
      });
      console.log('✓ Alerte envoyée sur Slack.');
    } catch (err) {
      console.warn(`⚠ Envoi Slack impossible : ${err.message}`);
    }
  }
  process.exitCode = 2; // le job CI ressort en échec : l'alerte est visible
}
