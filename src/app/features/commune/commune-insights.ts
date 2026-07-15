import type { CommuneDetail } from '../../core/models/data.models';

// ── Prix m² réel (DVF) ──

/**
 * Évolution du prix m² (%) entre la dernière période DVF et la période
 * comparable UN AN avant (même semestre/mois de l'année précédente si présent,
 * sinon le point le plus ancien à ≥ 2 périodes d'écart). `null` si l'historique
 * est trop court pour une comparaison honnête.
 */
export function dvfTrendPct(histo: readonly { p: string; v: number }[]): number | null {
  if (histo.length < 2) return null;
  const dernier = histo[histo.length - 1];
  const anneeDerniere = Number(dernier.p.slice(0, 4));
  const suffixe = dernier.p.slice(4); // "-S2", "-12"…
  const cible = `${anneeDerniere - 1}${suffixe}`;
  const reference =
    histo.find((h) => h.p === cible) ??
    (histo.length >= 3 ? histo[histo.length - 3] : null);
  if (!reference || reference.v <= 0) return null;
  return Math.round(((dernier.v - reference.v) / reference.v) * 1000) / 10;
}

// ── Voisinage géographique ──
const R_TERRE_KM = 6371;

/** Distance à vol d'oiseau entre deux points (km), formule de haversine. */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TERRE_KM * Math.asin(Math.sqrt(h));
}

export interface VoisineCommune {
  commune: CommuneDetail;
  distanceKm: number;
}

/**
 * Retire du bassin de voisinage les entités déjà reliées à `current` par la
 * hiérarchie Région > Département > Ville > Arrondissement, pour ne pas
 * doublonner avec un lien déjà affiché ailleurs sur la fiche :
 * - si `current` est une commune mère (Paris/Lyon/Marseille), ses propres
 *   arrondissements (déjà listés dans la section dédiée) ;
 * - si `current` est un arrondissement, sa commune mère (déjà dans le fil
 *   d'Ariane).
 */
export function filtrerBassinVoisinage(
  current: CommuneDetail,
  pool: readonly CommuneDetail[],
): CommuneDetail[] {
  return pool.filter((c) => {
    if (current.arrondissements && c.communeMere?.codeInsee === current.codeInsee) return false;
    if (current.communeMere && c.codeInsee === current.communeMere.codeInsee) return false;
    return true;
  });
}

/**
 * Communes les plus proches de `current` dans `pool` (même département en
 * pratique), triées par distance croissante. Exige des coordonnées ; si
 * `current` n'en a pas, retourne `[]`. `limit` résultats max.
 */
export function nearestCommunes(
  current: CommuneDetail,
  pool: readonly CommuneDetail[],
  limit = 5,
): VoisineCommune[] {
  if (current.lat === undefined || current.lon === undefined) return [];
  const origin = { lat: current.lat, lon: current.lon };
  return filtrerBassinVoisinage(current, pool)
    .filter((c) => c.slug !== current.slug && c.lat !== undefined && c.lon !== undefined)
    .map((c) => ({
      commune: c,
      distanceKm: haversineKm(origin, { lat: c.lat as number, lon: c.lon as number }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
