import { fmtEntier, fmtNote } from '../../core/format';
import type { CommuneDetail, GeoLightItem } from '../../core/models/data.models';
import { haversineKm } from '../commune/commune-insights';

/**
 * Logique PURE des pages palmarès (hubs SEO longue traîne — docs/SEO-PLAN.md
 * §P4). Population minimale : les classements « ville » n'ont de sens que sur
 * des communes d'une certaine taille (un hameau sans délinquance enregistrée
 * n'est pas « la ville la plus sûre »).
 */

export const PALMARES_MIN_POP = 2000;
export const PALMARES_TAILLE = 15;

export const AUTOUR_RAYON_KM = 20;
export const AUTOUR_TAILLE = 12;

/** Villes les plus sûres d'un département (note sécurité ↓, départage global). */
export function topSecurite(
  communes: readonly CommuneDetail[],
  limite = PALMARES_TAILLE,
): CommuneDetail[] {
  return communes
    .filter((c) => c.population >= PALMARES_MIN_POP)
    .sort(
      (a, b) =>
        b.score.criteres.securite - a.score.criteres.securite ||
        b.score.global - a.score.global ||
        a.nom.localeCompare(b.nom),
    )
    .slice(0, limite);
}

/** Meilleurs prix au m² d'un département (médiane DVF ↑ ; sans DVF → exclu). */
export function topPrix(
  communes: readonly CommuneDetail[],
  limite = PALMARES_TAILLE,
): CommuneDetail[] {
  return communes
    .filter((c) => c.population >= PALMARES_MIN_POP && c.prix !== undefined)
    .sort(
      (a, b) =>
        a.prix!.m2 - b.prix!.m2 ||
        b.score.global - a.score.global ||
        a.nom.localeCompare(b.nom),
    )
    .slice(0, limite);
}

export interface CommuneProche {
  item: GeoLightItem;
  distanceKm: number;
}

/**
 * Communes les mieux notées autour d'une ville (rayon 20 km, ≥ 2000 hab),
 * triées note ↓ puis distance ↑. La ville centre est exclue.
 */
export function autourDe(
  centre: GeoLightItem,
  toutes: readonly GeoLightItem[],
  rayonKm = AUTOUR_RAYON_KM,
  limite = AUTOUR_TAILLE,
): CommuneProche[] {
  const origin = { lat: centre.lat, lon: centre.lng };
  return toutes
    .filter((c) => c.s !== centre.s && c.p >= PALMARES_MIN_POP)
    .map((c) => ({ item: c, distanceKm: haversineKm(origin, { lat: c.lat, lon: c.lng }) }))
    .filter((c) => c.distanceKm <= rayonKm)
    .sort((a, b) => b.item.g - a.item.g || a.distanceKm - b.distanceKm)
    .slice(0, limite);
}

/** Intro factuelle du palmarès sécurité (unique par département : ses stats). */
export function introSecurite(depNom: string, communes: readonly CommuneDetail[], top: readonly CommuneDetail[]): string {
  const eligibles = communes.filter((c) => c.population >= PALMARES_MIN_POP);
  if (top.length === 0 || eligibles.length === 0) {
    return `Aucune commune de plus de ${fmtEntier(PALMARES_MIN_POP)} habitants n'est disponible pour ce classement.`;
  }
  const moyenne = eligibles.reduce((s, c) => s + c.score.criteres.securite, 0) / eligibles.length;
  return (
    `Sur les ${fmtEntier(eligibles.length)} communes de plus de ${fmtEntier(PALMARES_MIN_POP)} habitants ` +
    `du département ${depNom}, la note moyenne de sécurité est de ${fmtNote(moyenne)}/10. ` +
    `${top[0].nom} arrive en tête avec ${fmtNote(top[0].score.criteres.securite)}/10 — une note calculée à partir ` +
    `des faits de délinquance enregistrés (base SSMSI du ministère de l'Intérieur) rapportés à la population, ` +
    `chaque commune étant comparée aux communes de taille similaire.`
  );
}

/** Intro factuelle du palmarès prix (médianes DVF réelles du département). */
export function introPrix(depNom: string, communes: readonly CommuneDetail[], top: readonly CommuneDetail[]): string {
  const couvertes = communes.filter((c) => c.population >= PALMARES_MIN_POP && c.prix);
  if (top.length === 0 || couvertes.length === 0) {
    return (
      `Les prix de vente (base DVF) ne couvrent pas assez de communes de ce département ` +
      `pour établir un classement fiable — c'est notamment le cas en Alsace, en Moselle et à Mayotte.`
    );
  }
  const medianes = couvertes.map((c) => c.prix!.m2).sort((a, b) => a - b);
  const mediane = medianes[Math.floor(medianes.length / 2)];
  return (
    `D'après les ventes immobilières réelles enregistrées (base DVF des transactions notariées), ` +
    `le prix médian des ${fmtEntier(couvertes.length)} communes de plus de ${fmtEntier(PALMARES_MIN_POP)} habitants ` +
    `couvertes dans le département ${depNom} est de ${fmtEntier(mediane)} €/m². ` +
    `${top[0].nom} affiche le prix le plus accessible : ${fmtEntier(top[0].prix!.m2)} €/m², ` +
    `avec une note de qualité de vie de ${fmtNote(top[0].score.global)}/10.`
  );
}

/** Intro factuelle « autour de {ville} ». */
export function introAutour(centre: GeoLightItem, proches: readonly CommuneProche[]): string {
  if (proches.length === 0) {
    return (
      `Aucune commune de plus de ${fmtEntier(PALMARES_MIN_POP)} habitants n'est recensée ` +
      `à moins de ${AUTOUR_RAYON_KM} km de ${centre.n}.`
    );
  }
  const meilleure = proches[0];
  return (
    `${centre.n} (note ${fmtNote(centre.g)}/10) est entourée de ${fmtEntier(proches.length)} communes ` +
    `de plus de ${fmtEntier(PALMARES_MIN_POP)} habitants dans un rayon de ${AUTOUR_RAYON_KM} km. ` +
    `La mieux notée est ${meilleure.item.n} (${fmtNote(meilleure.item.g)}/10, à ${Math.round(meilleure.distanceKm)} km) — ` +
    `de quoi comparer avant de choisir où poser ses cartons, notes officielles et prix immobiliers à l'appui.`
  );
}
