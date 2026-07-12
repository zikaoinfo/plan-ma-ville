import type { DepartementSummary, RegionSummary } from '../models.js';

/**
 * Table statique des régions françaises (code INSEE région → nom) et
 * correspondance département → région. Aucune API : le découpage administratif
 * est figé (spec §3.4). Les départements absents de `DEPARTEMENT_REGION`
 * (collectivités hors périmètre v1) ne sont rattachés à aucune région et sont
 * ignorés du classement régional.
 */
export const REGIONS: Record<string, string> = {
  '84': 'Auvergne-Rhône-Alpes',
  '27': 'Bourgogne-Franche-Comté',
  '53': 'Bretagne',
  '24': 'Centre-Val de Loire',
  '94': 'Corse',
  '44': 'Grand Est',
  '32': 'Hauts-de-France',
  '11': 'Île-de-France',
  '28': 'Normandie',
  '75': 'Nouvelle-Aquitaine',
  '76': 'Occitanie',
  '52': 'Pays de la Loire',
  '93': "Provence-Alpes-Côte d'Azur",
  '01': 'Guadeloupe',
  '02': 'Martinique',
  '03': 'Guyane',
  '04': 'La Réunion',
  '06': 'Mayotte',
};

/** Code département ("69", "2A", "971"…) → code région INSEE. */
export const DEPARTEMENT_REGION: Record<string, string> = {
  // Auvergne-Rhône-Alpes (84)
  '01': '84', '03': '84', '07': '84', '15': '84', '26': '84', '38': '84',
  '42': '84', '43': '84', '63': '84', '69': '84', '73': '84', '74': '84',
  // Bourgogne-Franche-Comté (27)
  '21': '27', '25': '27', '39': '27', '58': '27', '70': '27', '71': '27',
  '89': '27', '90': '27',
  // Bretagne (53)
  '22': '53', '29': '53', '35': '53', '56': '53',
  // Centre-Val de Loire (24)
  '18': '24', '28': '24', '36': '24', '37': '24', '41': '24', '45': '24',
  // Corse (94)
  '2A': '94', '2B': '94',
  // Grand Est (44)
  '08': '44', '10': '44', '51': '44', '52': '44', '54': '44', '55': '44',
  '57': '44', '67': '44', '68': '44', '88': '44',
  // Hauts-de-France (32)
  '02': '32', '59': '32', '60': '32', '62': '32', '80': '32',
  // Île-de-France (11)
  '75': '11', '77': '11', '78': '11', '91': '11', '92': '11', '93': '11',
  '94': '11', '95': '11',
  // Normandie (28)
  '14': '28', '27': '28', '50': '28', '61': '28', '76': '28',
  // Nouvelle-Aquitaine (75)
  '16': '75', '17': '75', '19': '75', '23': '75', '24': '75', '33': '75',
  '40': '75', '47': '75', '64': '75', '79': '75', '86': '75', '87': '75',
  // Occitanie (76)
  '09': '76', '11': '76', '12': '76', '30': '76', '31': '76', '32': '76',
  '34': '76', '46': '76', '48': '76', '65': '76', '66': '76', '81': '76',
  '82': '76',
  // Pays de la Loire (52)
  '44': '52', '49': '52', '53': '52', '72': '52', '85': '52',
  // Provence-Alpes-Côte d'Azur (93)
  '04': '93', '05': '93', '06': '93', '13': '93', '83': '93', '84': '93',
  // DROM
  '971': '01', '972': '02', '973': '03', '974': '04', '976': '06',
};

/** Département enrichi des totaux population/note nécessaires à l'agrégation. */
export interface DepAggregat {
  summary: DepartementSummary;
  /** Population cumulée du département. */
  popTotale: number;
  /** Σ(note globale × population) non arrondi — pour repondérer à l'échelle région. */
  sommeNotePonderee: number;
}

/**
 * Agrège les départements en régions. La note d'une région est la moyenne des
 * notes des communes pondérée par la population (comme au niveau département),
 * recalculée à partir des sommes non arrondies pour éviter le cumul d'erreurs.
 * Départements et régions sont triés par note décroissante (départage par nom).
 */
export function aggregateRegions(deps: readonly DepAggregat[]): RegionSummary[] {
  const parRegion = new Map<
    string,
    { departements: DepartementSummary[]; popTotale: number; sommeNotePonderee: number; nbCommunes: number }
  >();

  for (const dep of deps) {
    const codeRegion = DEPARTEMENT_REGION[dep.summary.code];
    if (!codeRegion) continue; // hors périmètre régional v1
    const g = parRegion.get(codeRegion) ?? {
      departements: [],
      popTotale: 0,
      sommeNotePonderee: 0,
      nbCommunes: 0,
    };
    g.departements.push(dep.summary);
    g.popTotale += dep.popTotale;
    g.sommeNotePonderee += dep.sommeNotePonderee;
    g.nbCommunes += dep.summary.nbCommunes;
    parRegion.set(codeRegion, g);
  }

  return [...parRegion.entries()]
    .map(([code, g]) => ({
      code,
      nom: REGIONS[code] ?? code,
      nbDepartements: g.departements.length,
      nbCommunes: g.nbCommunes,
      noteMoyenne: g.popTotale > 0 ? Math.round((g.sommeNotePonderee / g.popTotale) * 10) / 10 : 0,
      departements: g.departements
        .slice()
        .sort((a, b) => b.noteMoyenne - a.noteMoyenne || a.nom.localeCompare(b.nom)),
    }))
    .sort((a, b) => b.noteMoyenne - a.noteMoyenne || a.nom.localeCompare(b.nom));
}
