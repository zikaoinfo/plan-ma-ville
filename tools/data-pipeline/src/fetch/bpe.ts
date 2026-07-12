import { ensureCsv, forEachCsvRow, parseNumber, type SourceSpec } from './download.js';
import { communeParent } from './insee-code.js';

/** Critères alimentés par la Base permanente des équipements (BPE, INSEE). */
export const BPE_CRITERES = [
  'sante',
  'commerces',
  'enseignement',
  'sports',
  'culture',
  'transports',
] as const;
export type BpeCritere = (typeof BPE_CRITERES)[number];

export type BpeCounts = Record<BpeCritere, number>;
/** codeInsee (commune mère) → nombre d'équipements par critère. */
export type BpeMap = Map<string, BpeCounts>;

/**
 * Domaine BPE = 1re lettre du code TYPEQU → critère.
 *   B commerces · C enseignement · D santé/social · E transports.
 *   F éclaté : F1/F2 sports & loisirs, F3 culture.
 *   A (services) et G (tourisme) : hors critères notés.
 */
export function typequToCritere(typequ: string): BpeCritere | undefined {
  const t = typequ.trim().toUpperCase();
  switch (t[0]) {
    case 'B':
      return 'commerces';
    case 'C':
      return 'enseignement';
    case 'D':
      return 'sante';
    case 'E':
      return 'transports';
    case 'F':
      if (t.startsWith('F3')) return 'culture';
      if (t.startsWith('F1') || t.startsWith('F2')) return 'sports';
      return undefined;
    default:
      return undefined;
  }
}

const CODE_COLS = ['DEPCOM', 'CODGEO', 'CODGEO_2024', 'CODGEO_2023', 'DCIRIS', 'COM', 'depcom', 'codgeo'];
const TYPE_COLS = ['TYPEQU', 'typequ'];
// Fichiers « nombre d'équipements par commune » : colonne d'effectif. Absente
// dans le fichier détaillé (1 ligne = 1 équipement) → chaque ligne compte 1.
const NB_COLS = ['NB', 'NB_EQUIP', 'NB_EQUIPEMENT', 'nb', 'nombre'];

function emptyCounts(): BpeCounts {
  return { sante: 0, commerces: 0, enseignement: 0, sports: 0, culture: 0, transports: 0 };
}

function pick(keys: string[], candidats: string[]): string | undefined {
  return candidats.find((c) => keys.includes(c));
}

/**
 * Accumulateur streaming : détecte les colonnes sur la 1re ligne puis agrège
 * les effectifs par (commune mère, critère). Exporté pour testabilité.
 */
export function makeBpeAccumulator() {
  const map: BpeMap = new Map();
  let codeCol: string | undefined;
  let typeCol: string | undefined;
  let nbCol: string | null | undefined; // undefined = pas encore détecté, null = absent

  return {
    add(row: Record<string, string>): void {
      if (codeCol === undefined) {
        const keys = Object.keys(row);
        codeCol = pick(keys, CODE_COLS);
        typeCol = pick(keys, TYPE_COLS);
        nbCol = pick(keys, NB_COLS) ?? null;
        if (!codeCol || !typeCol) {
          throw new Error(`BPE : colonnes code/type introuvables (en-têtes : ${keys.join(', ')})`);
        }
      }
      const brut = row[codeCol];
      const critere = typequToCritere(row[typeCol as string] ?? '');
      if (!brut || !critere) return;
      const nb = nbCol ? (parseNumber(row[nbCol]) ?? 0) : 1;
      if (nb <= 0) return;
      const code = communeParent(brut);
      const cur = map.get(code) ?? emptyCounts();
      cur[critere] += nb;
      map.set(code, cur);
    },
    result(): BpeMap {
      return map;
    },
  };
}

/** Télécharge et agrège la BPE : commune mère → équipements par critère. */
export async function fetchBpe(spec: SourceSpec, cacheDir: string): Promise<BpeMap> {
  const csv = await ensureCsv('bpe', spec, cacheDir);
  const acc = makeBpeAccumulator();
  await forEachCsvRow(csv, {}, (row) => acc.add(row));
  return acc.result();
}
