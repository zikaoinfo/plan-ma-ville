// Appels Search Console. Deux API distinctes, deux limites à connaître.
const API = 'https://searchconsole.googleapis.com';

async function appel(jeton, url, corps) {
  const res = await fetch(url, {
    method: corps ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${jeton}`,
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json.error?.message ?? `HTTP ${res.status}`;
    // 403 = le compte de service n'est pas utilisateur de la propriété : c'est
    // l'erreur d'installation la plus fréquente, on la nomme explicitement.
    throw new Error(
      res.status === 403
        ? `Search Console a refusé l'accès (403) : ${message}. Le compte de service est-il ajouté en utilisateur de la propriété (Paramètres → Utilisateurs et autorisations) ?`
        : `Search Console : ${message}`,
    );
  }
  return json;
}

/**
 * Statistiques de performance sur une période (Search Analytics API).
 * `dimensions: []` donne les totaux, `['query']` le détail par requête.
 */
export async function performances(jeton, site, debut, fin, dimensions = [], limite = 25) {
  const url = `${API}/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const json = await appel(jeton, url, {
    startDate: debut,
    endDate: fin,
    dimensions,
    rowLimit: limite,
    dataState: 'final',
  });
  return json.rows ?? [];
}

/**
 * État d'indexation d'UNE URL (URL Inspection API).
 *
 * Il n'existe AUCUNE API pour le rapport « Pages » de la Search Console (le
 * nombre global de pages indexées ne s'obtient donc pas directement). Cette
 * API-ci inspecte une URL à la fois, sous quota : 2 000 requêtes/jour et
 * 600/minute par propriété. D'où l'échantillonnage (cf. index.mjs) plutôt
 * qu'un balayage des ~35 000 pages.
 *
 * Retourne true/false, ou null si l'inspection a échoué (l'URL ne doit alors
 * pas compter comme « non indexée » : ce serait une fausse alerte).
 */
export async function estIndexee(jeton, site, url) {
  try {
    const json = await appel(jeton, `${API}/v1/urlInspection/index:inspect`, {
      inspectionUrl: url,
      siteUrl: site,
      languageCode: 'fr',
    });
    const verdict = json.inspectionResult?.indexStatusResult?.verdict;
    return verdict === 'PASS';
  } catch (err) {
    console.warn(`  ⚠ inspection impossible pour ${url} : ${err.message}`);
    return null;
  }
}
