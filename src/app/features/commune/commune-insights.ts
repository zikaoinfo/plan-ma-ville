import { CRITERES, type CommuneDetail } from '../../core/models/data.models';

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

/**
 * Libellé humain d'une période DVF : « 2025-S2 » → « 2ᵉ semestre 2025 »,
 * « 2025-12 » → « décembre 2025 ». Retourne la valeur brute si le format
 * n'est pas reconnu (jamais d'invention). Partagé par la fiche et la FAQ :
 * un code de période brut dans une phrase se lit mal.
 */
const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function libellePeriodeDvf(periode: string): string {
  const semestre = /^(\d{4})-S([12])$/.exec(periode);
  if (semestre) return `${semestre[2]}${semestre[2] === '1' ? 'ᵉʳ' : 'ᵉ'} semestre ${semestre[1]}`;
  const mois = /^(\d{4})-(\d{2})$/.exec(periode);
  if (mois) {
    const nom = MOIS_FR[Number(mois[2]) - 1];
    if (nom) return `${nom} ${mois[1]}`;
  }
  return periode;
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

// ── Similarité par profil de notes ──

export interface CommuneSimilaire {
  commune: CommuneDetail;
  /** Distance euclidienne sur les 8 critères (0 = profil identique). */
  distance: number;
}

/**
 * Distance euclidienne entre deux communes sur les 8 critères. Les notes
 * partagent la même échelle (0-10) : aucune normalisation n'est nécessaire,
 * et en introduire une fausserait le sens (un écart de 2 points vaut autant
 * en sécurité qu'en culture).
 */
export function distanceProfil(a: CommuneDetail, b: CommuneDetail): number {
  let somme = 0;
  for (const critere of CRITERES) {
    const d = a.score.criteres[critere] - b.score.criteres[critere];
    somme += d * d;
  }
  return Math.sqrt(somme);
}

/**
 * Communes au profil de notes le plus proche de `current` (maillage interne,
 * plan de croissance §3). Complète « Aux alentours », qui est purement
 * géographique : deux communes voisines peuvent avoir des profils opposés, et
 * inversement.
 *
 * `dejaLiees` (les voisines déjà affichées sur la fiche) est EXCLU : réafficher
 * les mêmes communes n'ajouterait aucun chemin de crawl et ferait doublon à
 * l'écran. Le bassin exclut aussi la commune elle-même et sa famille
 * mère/arrondissements (cf. `filtrerBassinVoisinage`).
 *
 * Départage à distance égale par slug : le rendu doit être stable entre deux
 * builds (SSG déterministe).
 */
export function communesSimilaires(
  current: CommuneDetail,
  pool: readonly CommuneDetail[],
  dejaLiees: readonly string[] = [],
  limit = 5,
): CommuneSimilaire[] {
  const exclus = new Set([current.slug, ...dejaLiees]);
  return filtrerBassinVoisinage(current, pool)
    .filter((c) => !exclus.has(c.slug))
    .map((c) => ({ commune: c, distance: distanceProfil(current, c) }))
    .sort((a, b) =>
      a.distance - b.distance || (a.commune.slug < b.commune.slug ? -1 : 1),
    )
    .slice(0, limit);
}
