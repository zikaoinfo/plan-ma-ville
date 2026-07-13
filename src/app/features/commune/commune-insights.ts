import type { CommuneDetail } from '../../core/models/data.models';

// ── PRNG déterministe (même famille que le pipeline) ──
// Permet de dériver des estimations stables par commune (toujours les mêmes
// valeurs pour un code INSEE donné). Ces chiffres sont des ESTIMATIONS
// indicatives, pas des données réelles (cf. page Méthodologie).
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/** Point d'historique : année + note globale estimée cette année-là. */
export interface HistoryPoint {
  year: number;
  note: number;
}

/**
 * Reconstitue une trajectoire déterministe de la note globale sur `years`
 * années, se terminant sur la note actuelle (année courante). Indicatif.
 */
export function noteHistory(
  commune: CommuneDetail,
  endYear: number,
  years = 6,
): HistoryPoint[] {
  const rand = mulberry32(cyrb53(commune.codeInsee, 42));
  const points: HistoryPoint[] = [{ year: endYear, note: commune.score.global }];
  let note = commune.score.global;
  for (let i = 1; i < years; i++) {
    // marche arrière : petite variation déterministe ±0.4
    note = clampNote(note - (rand() - 0.5) * 0.8);
    points.unshift({ year: endYear - i, note });
  }
  return points;
}

function clampNote(n: number): number {
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10;
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
  return pool
    .filter((c) => c.slug !== current.slug && c.lat !== undefined && c.lon !== undefined)
    .map((c) => ({
      commune: c,
      distanceKm: haversineKm(origin, { lat: c.lat as number, lon: c.lon as number }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
