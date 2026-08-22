// Baseline de citation IA (plan de croissance §6) : le site est-il cité quand
// un moteur de réponse traite « [ville] est-elle une bonne ville où vivre ? ».
// Mesure complémentaire du classement Google classique : sur des requêtes
// informationnelles comme les nôtres, une part croissante des réponses est
// lue sans clic.
//
// Usage :
//   npm run seo:citation                       # 50 plus grandes communes
//   node tools/seo-monitor/ai-citation.mjs --villes 100
//   node tools/seo-monitor/ai-citation.mjs --villes 5 --dry-run
//
// Variables d'environnement :
//   ANTHROPIC_API_KEY           requis
//   PERPLEXITY_API_KEY          optionnel : interroge aussi Perplexity
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   optionnel : historisation
//
// ⚠️ COÛT : chaque ville = une requête avec recherche web. Compter quelques
// dollars pour 100 villes et par moteur. Le script est fait pour tourner
// MENSUELLEMENT, pas en continu.
import Anthropic from '@anthropic-ai/sdk';
import { agregeCitations, detecteCitation, formateRapport } from './ai-citation-logic.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};

const SITE = (process.env['SITE_URL'] ?? 'https://planmaville.fr').replace(/\/$/, '');
const DOMAINE = new URL(SITE).hostname;
const NB_VILLES = Number(opt('villes', '50'));
const DRY = flag('dry-run');
const MODELE = 'claude-opus-5';

const question = (ville, departement) =>
  `${ville} (${departement}) est-elle une bonne ville où vivre ? ` +
  `Réponds en quelques phrases en t'appuyant sur des sources en ligne récentes.`;

/** Les N communes les plus peuplées, lues sur le site en ligne. */
async function grandesVilles(n) {
  const res = await fetch(`${SITE}/data/index.json`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${SITE}/data/index.json → HTTP ${res.status}`);
  const { items } = await res.json();
  return [...items].sort((a, b) => b.p - a.p).slice(0, n);
}

// ── Moteur 1 : Claude avec recherche web ─────
const anthropic = new Anthropic();

/**
 * Interroge Claude avec l'outil de recherche web côté serveur, et renvoie la
 * réponse au format normalisé `{ texte, sources }`. `max_uses` borne le coût.
 */
async function interrogeClaude(ville, departement) {
  const reponse = await anthropic.messages.create({
    model: MODELE,
    max_tokens: 2000,
    // Effort bas : la tâche est une recherche + synthèse courte, pas du
    // raisonnement difficile — inutile de payer davantage sur 100 villes.
    output_config: { effort: 'low' },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }],
    messages: [{ role: 'user', content: question(ville, departement) }],
  });

  const texte = reponse.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  // Les URLs réellement consultées : sur un bloc de résultats, `content` est
  // une LISTE en succès et un OBJET d'erreur en échec (les erreurs d'outil
  // serveur ne lèvent pas) — d'où le test avant d'itérer.
  const sources = [];
  for (const bloc of reponse.content) {
    if (bloc.type !== 'web_search_tool_result' || !Array.isArray(bloc.content)) continue;
    for (const r of bloc.content) if (r.url) sources.push({ url: r.url, titre: r.title });
  }
  return { texte, sources, refus: reponse.stop_reason === 'refusal' };
}

// ── Moteur 2 : Perplexity (optionnel) ────────
async function interrogePerplexity(ville, departement) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env['PERPLEXITY_API_KEY']}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: question(ville, departement) }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Perplexity → HTTP ${res.status}`);
  const json = await res.json();
  return {
    texte: json.choices?.[0]?.message?.content ?? '',
    sources: (json.citations ?? []).map((url) => ({ url })),
  };
}

// ── Campagne ─────────────────────────────────
async function campagne(nom, interroge, villes) {
  console.log(`\n▸ ${nom} — ${villes.length} villes`);
  const resultats = [];
  for (const v of villes) {
    try {
      const reponse = await interroge(v.n, v.d);
      if (reponse.refus) {
        resultats.push({ ville: v.n, slug: v.s, erreur: 'refus du modèle' });
        console.log(`  · ${v.n} : refus`);
        continue;
      }
      const detection = detecteCitation(reponse, DOMAINE);
      resultats.push({ ville: v.n, slug: v.s, ...detection });
      console.log(
        `  · ${v.n} : ${detection.citee ? (detection.dans_texte ? '✓ nommé' : '✓ source') : '—'}`,
      );
    } catch (err) {
      // Une ville en échec ne doit pas compter comme « non citée » : elle est
      // exclue du dénominateur (cf. agregeCitations).
      resultats.push({ ville: v.n, slug: v.s, erreur: err.message });
      console.log(`  · ${v.n} : erreur — ${err.message}`);
    }
  }
  return resultats;
}

// ── Exécution ────────────────────────────────
if (!process.env['ANTHROPIC_API_KEY']) {
  console.error('✗ ANTHROPIC_API_KEY manquant. Voir docs/SEO-MONITORING.md.');
  process.exit(1);
}

const villes = await grandesVilles(NB_VILLES);
const date = new Date().toISOString().slice(0, 10);

const moteurs = [{ nom: 'Claude (recherche web)', cle: 'claude', fn: interrogeClaude }];
if (process.env['PERPLEXITY_API_KEY']) {
  moteurs.push({ nom: 'Perplexity', cle: 'perplexity', fn: interrogePerplexity });
} else {
  console.log('(PERPLEXITY_API_KEY absent : seul Claude est interrogé)');
}

const mesure = { date, domaine: DOMAINE, moteurs: {} };
for (const moteur of moteurs) {
  const resultats = await campagne(moteur.nom, moteur.fn, villes);
  const stats = agregeCitations(resultats);
  console.log(`\n${formateRapport(stats, resultats, date)}`);
  mesure.moteurs[moteur.cle] = { ...stats, resultats };
}

const url = process.env['SUPABASE_URL'];
const cle = process.env['SUPABASE_SERVICE_ROLE_KEY'];
if (url && cle && !DRY) {
  const res = await fetch(`${url}/rest/v1/ai_citations?on_conflict=date`, {
    method: 'POST',
    headers: {
      apikey: cle,
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(mesure),
  });
  if (!res.ok) throw new Error(`Supabase : HTTP ${res.status} ${await res.text()}`);
  console.log(`\n✓ Campagne du ${date} enregistrée dans ai_citations.`);
} else {
  console.log('\n(non enregistré : --dry-run ou Supabase non configuré)');
}
