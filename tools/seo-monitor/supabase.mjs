// Stockage des mesures dans Supabase (table seo_metrics, cf.
// docs/supabase-migration-seo-metrics.sql). Accès via PostgREST avec la clé
// SERVICE ROLE : ce script tourne en CI, jamais dans le navigateur — cette clé
// contourne les RLS et ne doit JAMAIS être exposée côté client.

function entetes(cle) {
  return {
    apikey: cle,
    Authorization: `Bearer ${cle}`,
    'Content-Type': 'application/json',
  };
}

/** Dernière mesure enregistrée, ou `null` s'il n'y en a aucune. */
export async function derniereMesure(url, cle) {
  const res = await fetch(
    `${url}/rest/v1/seo_metrics?select=*&order=date.desc&limit=1`,
    { headers: entetes(cle) },
  );
  if (!res.ok) throw new Error(`Supabase (lecture) : HTTP ${res.status} ${await res.text()}`);
  const lignes = await res.json();
  return lignes[0] ?? null;
}

/**
 * Enregistre une mesure. `Prefer: resolution=merge-duplicates` rend le script
 * rejouable : relancé le même jour, il met à jour la ligne au lieu d'en créer
 * une seconde qui fausserait le delta suivant.
 */
export async function enregistreMesure(url, cle, mesure) {
  const res = await fetch(`${url}/rest/v1/seo_metrics?on_conflict=date`, {
    method: 'POST',
    headers: { ...entetes(cle), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(mesure),
  });
  if (!res.ok) throw new Error(`Supabase (écriture) : HTTP ${res.status} ${await res.text()}`);
}
