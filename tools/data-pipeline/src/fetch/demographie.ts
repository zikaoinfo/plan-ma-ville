import { ensureCsv, parseNumber, readCsvRows, type SourceSpec } from './download.js';
import type { Demographie } from '../models.js';

/**
 * Démographie communale : pyramide des âges, répartition par sexe et
 * catégories socioprofessionnelles, depuis la base INSEE « Évolution et
 * structure de la population » (recensement, dossier complet).
 *
 * **Nommage des colonnes** : l'INSEE suffixe chaque variable par le millésime
 * du recensement — `P22_POP0014` en 2022, `P21_POP0014` en 2021, etc. Coder un
 * millésime en dur ferait tomber la source en silence au prochain millésime.
 * Le préfixe est donc DÉTECTÉ dans les en-têtes, en retenant le plus récent
 * (même stratégie que le fetcher Filosofi pour `MED21`).
 *
 * Réseau bloqué en sandbox : les motifs de colonnes sont écrits d'après la
 * documentation INSEE et **doivent être confirmés par le job CI**
 * « Validate open data », qui logge l'inventaire réel. En cas d'écart, la
 * source dégrade proprement (bloc démographie absent, reste du site intact).
 */
export type DemographieMap = Map<string, Demographie>;

const CODE_COLS = ['CODGEO', 'codgeo', 'COM', 'DEPCOM', 'Code géographique', 'Code geographique'];

/** Tranches d'âge de la base INSEE, dans l'ordre de la pyramide. */
export const TRANCHES_AGE = ['0014', '1529', '3044', '4559', '6074', '7589', '90P'] as const;

/** Libellés d'affichage, même ordre que `TRANCHES_AGE`. */
export const LABELS_AGE = [
  '0 à 14 ans',
  '15 à 29 ans',
  '30 à 44 ans',
  '45 à 59 ans',
  '60 à 74 ans',
  '75 à 89 ans',
  '90 ans et plus',
];

/**
 * Catégories socioprofessionnelles INSEE (CS1 à CS8), population de 15 ans et
 * plus. CS7 (retraités) et CS8 (autres sans activité) ne sont pas des
 * professions mais font partie de la nomenclature — les omettre fausserait les
 * pourcentages, dont la somme ne ferait plus 100 %.
 */
export const LABELS_CSP = [
  'Agriculteurs exploitants',
  'Artisans, commerçants, chefs d’entreprise',
  'Cadres et professions intellectuelles supérieures',
  'Professions intermédiaires',
  'Employés',
  'Ouvriers',
  'Retraités',
  'Autres personnes sans activité professionnelle',
];

function pick(keys: string[], candidats: string[]): string | undefined {
  return candidats.find((c) => keys.includes(c));
}

/**
 * Millésime du recensement présent dans les en-têtes (le plus récent si
 * plusieurs). `undefined` si aucune colonne de pyramide n'est reconnue.
 */
export function detecteMillesime(keys: string[]): string | undefined {
  const annees = keys
    .map((k) => /^P(\d{2})_POP0014$/i.exec(k)?.[1])
    .filter((a): a is string => a !== undefined);
  if (annees.length === 0) return undefined;
  return [...annees].sort((a, b) => Number(b) - Number(a))[0];
}

/** Somme de plusieurs colonnes ; `undefined` si aucune n'est exploitable. */
function somme(row: Record<string, string>, cols: string[]): number | undefined {
  let total = 0;
  let vue = false;
  for (const c of cols) {
    const v = parseNumber(row[c]);
    if (v !== undefined) {
      total += v;
      vue = true;
    }
  }
  return vue ? total : undefined;
}

/**
 * Construit la map commune → démographie (fonction PURE, testable).
 *
 * Les effectifs INSEE sont des estimations pondérées : ils arrivent avec des
 * décimales (« 1234.5678 ») et sont arrondis ici. Une commune dont la
 * pyramide est entièrement absente n'est PAS insérée — mieux vaut ne rien
 * afficher qu'une pyramide de zéros.
 *
 * NB : contrairement aux autres sources, on n'agrège PAS les arrondissements
 * sur leur commune mère. Le fichier INSEE publie déjà une ligne pour la
 * commune mère ET une par arrondissement ; sommer les secondes sur la
 * première doublerait sa population.
 */
export function buildDemographieMap(rows: Record<string, string>[]): DemographieMap {
  const map: DemographieMap = new Map();
  if (rows.length === 0) return map;
  const keys = Object.keys(rows[0]);
  const codeCol = pick(keys, CODE_COLS);
  const mil = detecteMillesime(keys);
  if (!codeCol || !mil) {
    throw new Error(
      `Démographie : colonnes code/pyramide introuvables (millésime ${mil ?? 'non détecté'} — en-têtes : ${keys.slice(0, 20).join(', ')}…)`,
    );
  }

  const colAge = TRANCHES_AGE.map((t) => `P${mil}_POP${t}`);
  const colCsp = Array.from({ length: 8 }, (_, i) => `C${mil}_POP15P_CS${i + 1}`);
  const colH = `P${mil}_POPH`;
  const colF = `P${mil}_POPF`;

  for (const row of rows) {
    const code = row[codeCol]?.trim();
    if (!code) continue;

    const ages = colAge.map((c) => parseNumber(row[c]));
    if (ages.every((v) => v === undefined)) continue; // aucune donnée exploitable

    const csp = colCsp.map((c) => parseNumber(row[c]));
    const demo: Demographie = {
      millesime: 2000 + Number(mil),
      ages: ages.map((v) => Math.round(v ?? 0)),
      ...(somme(row, [colH]) !== undefined ? { hommes: Math.round(somme(row, [colH]) as number) } : {}),
      ...(somme(row, [colF]) !== undefined ? { femmes: Math.round(somme(row, [colF]) as number) } : {}),
      // CSP publiées seulement si au moins une catégorie est renseignée :
      // certaines petites communes sont sous secret statistique.
      ...(csp.some((v) => v !== undefined) ? { csp: csp.map((v) => Math.round(v ?? 0)) } : {}),
    };
    map.set(code, demo);
  }
  return map;
}

/** Télécharge la base INSEE et renvoie la map commune → démographie. */
export async function fetchDemographie(
  spec: SourceSpec,
  cacheDir: string,
): Promise<DemographieMap> {
  const csv = await ensureCsv('demographie', spec, cacheDir);
  const rows = await readCsvRows(csv);
  return buildDemographieMap(rows);
}
