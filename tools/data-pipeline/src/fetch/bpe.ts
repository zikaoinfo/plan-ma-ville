import { ensureCsv, forEachCsvRow, parseNumber, type SourceSpec } from './download.js';
import { codesAccumulation } from './insee-code.js';

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

const CODE_COLS = [
  'DEPCOM',
  'CODGEO',
  'CODGEO_2024',
  'CODGEO_2023',
  'DCIRIS',
  'COM',
  'depcom',
  'codgeo',
  'Code INSEE', // variante data.gouv (en-têtes en français)
];
const TYPE_COLS = ['TYPEQU', 'typequ', "Code d'équipement", 'Code d’équipement'];
// Fichiers « nombre d'équipements par commune » : colonne d'effectif. Absente
// dans le fichier détaillé (1 ligne = 1 équipement) → chaque ligne compte 1.
const NB_COLS = ['NB', 'NB_EQUIP', 'NB_EQUIPEMENT', 'nb', 'nombre', 'Nombre'];

function emptyCounts(): BpeCounts {
  return { sante: 0, commerces: 0, enseignement: 0, sports: 0, culture: 0, transports: 0 };
}

function pick(keys: string[], candidats: string[]): string | undefined {
  return candidats.find((c) => keys.includes(c));
}

/** Une colonne d'effectif (format large) : nom de colonne → critère cible. */
interface WideCol {
  col: string;
  critere: BpeCritere;
}

/**
 * Accumulateur streaming, robuste aux deux formats de la BPE :
 *  - **long** : une colonne TYPEQU + (option) une colonne d'effectif NB
 *    (fichier détaillé/géolocalisé : 1 ligne = 1 équipement, pas de NB).
 *  - **large** : une colonne par type d'équipement (A101, B201…) contenant
 *    l'effectif (fichier de dénombrement communal INSEE).
 * Exporté pour testabilité.
 */
export function makeBpeAccumulator() {
  const map: BpeMap = new Map();
  let mode: 'long' | 'wide' | undefined;
  let codeCol: string | undefined;
  let typeCol: string | undefined;
  let nbCol: string | null = null;
  let wideCols: WideCol[] = [];

  return {
    add(row: Record<string, string>): void {
      if (mode === undefined) {
        const keys = Object.keys(row);
        codeCol = pick(keys, CODE_COLS);
        if (!codeCol) {
          throw new Error(`BPE : colonne code introuvable (en-têtes : ${keys.join(', ')})`);
        }
        typeCol = pick(keys, TYPE_COLS);
        if (typeCol) {
          mode = 'long';
          nbCol = pick(keys, NB_COLS) ?? null;
        } else {
          // Format large : colonnes dont le nom est un code TYPEQU (ex. A101, F303).
          mode = 'wide';
          wideCols = keys
            .filter((k) => /^[A-G]\d{2,3}$/i.test(k))
            .map((col) => ({ col, critere: typequToCritere(col) }))
            .filter((c): c is WideCol => c.critere !== undefined);
          if (wideCols.length === 0) {
            throw new Error(`BPE : ni colonne TYPEQU ni colonnes d'effectif (en-têtes : ${keys.join(', ')})`);
          }
        }
      }

      const brut = row[codeCol as string];
      if (!brut) return;
      const codes = codesAccumulation(brut);

      if (mode === 'long') {
        const critere = typequToCritere(row[typeCol as string] ?? '');
        if (!critere) return;
        const nb = nbCol ? (parseNumber(row[nbCol]) ?? 0) : 1;
        if (nb <= 0) return;
        for (const code of codes) {
          const cur = map.get(code) ?? emptyCounts();
          cur[critere] += nb;
          map.set(code, cur);
        }
        return;
      }

      // wide
      for (const { col, critere } of wideCols) {
        const nb = parseNumber(row[col]) ?? 0;
        if (nb <= 0) continue;
        for (const code of codes) {
          const cur = map.get(code) ?? emptyCounts();
          cur[critere] += nb;
          map.set(code, cur);
        }
      }
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
