import type { PrixM2 } from '../models.js';
import { ensureCsv, forEachCsvRow, parseNumber, type SourceSpec } from './download.js';
import { codesAccumulation } from './insee-code.js';

/** codeInsee (commune mère) → prix m² DVF (médiane + historique). */
export type DvfMap = Map<string, PrixM2>;

const CODE_COLS = ['code_geo', 'CODE_GEO', 'codgeo', 'CODGEO', 'code_commune', 'INSEE_COM'];
const ECHELLE_COLS = ['echelle_geo', 'ECHELLE_GEO', 'echelle'];
const PERIODE_COLS = ['annee_semestre', 'semestre', 'periode', 'annee_mois', 'annee', 'mois'];

/**
 * Priorité des colonnes/types de bien pour la médiane du prix m² : le marché
 * résidentiel combiné d'abord, sinon maisons, sinon appartements.
 */
const MED_PRIORITES = [
  /med.*prix.*m2.*(apparts?_?\w*maisons?|maisons?_?\w*apparts?)/i,
  /med.*prix.*m2.*maison/i,
  /med.*prix.*m2.*appart/i,
  /^med.*prix.*m2$/i,
  /med.*prix.*m2/i,
];
const NB_PRIORITES = [
  /nb.*(ventes|mut).*(apparts?_?\w*maisons?|maisons?_?\w*apparts?)/i,
  /nb.*(ventes|mut).*maison/i,
  /nb.*(ventes|mut).*appart/i,
  /nb.*(ventes|mut)/i,
];
/** Valeurs de type de bien (fichiers « longs » à colonne type) par priorité. */
const TYPE_PRIORITES = [
  /apparts?.*maisons?|maisons?.*apparts?|tous|ensemble/i,
  /^maisons?$/i,
  /^apparts?/i,
];

const MAX_HISTO = 10;

function pick(keys: string[], candidats: string[]): string | undefined {
  return candidats.find((c) => keys.includes(c));
}

function pickByRegex(keys: string[], priorites: RegExp[]): string | undefined {
  for (const motif of priorites) {
    const hit = keys.find((k) => motif.test(k));
    if (hit) return hit;
  }
  return undefined;
}

/** Priorité (0 = meilleure) d'une valeur de type de bien ; -1 si inconnue. */
export function prioriteType(type: string): number {
  const idx = TYPE_PRIORITES.findIndex((m) => m.test(type.trim()));
  return idx;
}

interface Ligne {
  v: number;
  nb?: number;
  prio: number;
}

/**
 * Combine, pour une période donnée, les lignes venues de plusieurs origines
 * (les arrondissements agrégés sur leur commune mère, ex. les 20
 * arrondissements de Paris crédités sur 75056) : nombre de ventes TOTAL
 * (somme), prix médian approché par une moyenne pondérée par le nombre de
 * ventes de chaque origine (à défaut de données brutes, la meilleure
 * approximation disponible à partir d'agrégats). Une seule origine (cas
 * normal, communes sans arrondissement) → valeur inchangée.
 */
function combinerOrigines(parOrigine: ReadonlyMap<string, Ligne>): { v: number; nb?: number } {
  const lignes = [...parOrigine.values()];
  if (lignes.length === 1) {
    return { v: Math.round(lignes[0].v), nb: lignes[0].nb };
  }
  const nbTotal = lignes.every((l) => l.nb !== undefined)
    ? lignes.reduce((acc, l) => acc + l.nb!, 0)
    : undefined;
  const v = nbTotal
    ? lignes.reduce((acc, l) => acc + l.v * l.nb!, 0) / nbTotal
    : lignes.reduce((acc, l) => acc + l.v, 0) / lignes.length;
  return { v: Math.round(v), nb: nbTotal };
}

/**
 * Accumulateur streaming « Statistiques DVF » (agrégats data.gouv par échelle
 * géographique) : ne retient que les lignes d'échelle commune, la médiane du
 * prix m² par période, avec priorité au résidentiel combiné. Les périodes
 * (semestres `AAAA-S?` ou mois `AAAA-MM`) se trient lexicographiquement.
 * Les codes d'arrondissement (Paris/Lyon/Marseille) sont crédités À LA FOIS
 * sur eux-mêmes et sur leur commune mère (`codesAccumulation`) : la mère
 * reçoit alors PLUSIEURS lignes par période (une par arrondissement), gardées
 * séparément par origine puis combinées dans `result()` (sinon un seul
 * arrondissement écraserait les autres et la mère hériterait d'un nombre de
 * ventes dérisoire — cf. Paris 75056 avec ~3 ventes au lieu de centaines).
 * Exporté pour testabilité.
 */
export function makeDvfAccumulator() {
  // code destination → période → code origine (brut) → ligne retenue (meilleure prio)
  const parCommune = new Map<string, Map<string, Map<string, Ligne>>>();
  let cols:
    | {
        code: string;
        echelle?: string;
        periode?: string;
        type?: string;
        med: string;
        nb?: string;
      }
    | undefined;

  return {
    add(row: Record<string, string>): void {
      if (cols === undefined) {
        const keys = Object.keys(row);
        const code = pick(keys, CODE_COLS) ?? keys.find((k) => /^code_?geo/i.test(k));
        const med = pickByRegex(keys, MED_PRIORITES);
        if (!code || !med) {
          throw new Error(`DVF : colonnes code/médiane introuvables (en-têtes : ${keys.join(', ')})`);
        }
        cols = {
          code,
          med,
          echelle: pick(keys, ECHELLE_COLS),
          periode: pick(keys, PERIODE_COLS) ?? keys.find((k) => /^(annee|periode|semestre|mois)/i.test(k)),
          type: keys.find((k) => /^type/i.test(k)),
          nb: pickByRegex(keys, NB_PRIORITES),
        };
      }

      // Fichier multi-échelles : ne garder que les communes.
      if (cols.echelle && !/commune/i.test(row[cols.echelle] ?? '')) return;

      const brut = row[cols.code];
      const valeur = parseNumber(row[cols.med]);
      if (!brut || valeur === undefined || valeur <= 0) return;

      // Fichier « long » (colonne type de bien) : priorité au combiné.
      let prio = 0;
      if (cols.type) {
        prio = prioriteType(row[cols.type] ?? '');
        if (prio === -1) return; // locaux commerciaux/industriels : hors sujet
      }

      const periode = cols.periode ? (row[cols.periode] ?? '') : '';
      const nb = cols.nb ? parseNumber(row[cols.nb]) : undefined;
      const origine = brut.trim().toUpperCase();

      for (const code of codesAccumulation(brut)) {
        const parPeriode = parCommune.get(code) ?? new Map();
        const parOrigine = parPeriode.get(periode) ?? new Map<string, Ligne>();
        const existant = parOrigine.get(origine);
        if (!existant || prio < existant.prio) {
          parOrigine.set(origine, { v: valeur, nb, prio });
        }
        parPeriode.set(periode, parOrigine);
        parCommune.set(code, parPeriode);
      }
    },

    result(): DvfMap {
      const out: DvfMap = new Map();
      for (const [code, parPeriode] of parCommune) {
        const periodes = [...parPeriode.keys()].sort(); // lexicographique = chronologique
        const histo = periodes
          .slice(-MAX_HISTO)
          .map((p) => ({ p, v: combinerOrigines(parPeriode.get(p)!).v }));
        if (histo.length === 0) continue;
        const derniere = periodes[periodes.length - 1];
        const d = combinerOrigines(parPeriode.get(derniere)!);
        out.set(code, {
          m2: d.v,
          periode: derniere,
          ...(d.nb !== undefined ? { nb: d.nb } : {}),
          histo,
        });
      }
      return out;
    },
  };
}

/** Télécharge et agrège les statistiques DVF : commune → prix m² médian. */
export async function fetchDvf(spec: SourceSpec, cacheDir: string): Promise<DvfMap> {
  const csv = await ensureCsv('dvf', spec, cacheDir);
  const acc = makeDvfAccumulator();
  await forEachCsvRow(csv, {}, (row) => acc.add(row));
  return acc.result();
}
