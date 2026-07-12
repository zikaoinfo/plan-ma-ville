import { ensureCsv, parseNumber, readCsvRows, type SourceSpec } from './download.js';
import { communeParent } from './insee-code.js';

/** codeInsee (commune mère) → revenu médian disponible par UC (Filosofi, INSEE). */
export type FilosofiMap = Map<string, number>;

const CODE_COLS = ['CODGEO', 'codgeo', 'COM', 'DEPCOM', 'Code géographique', 'Code geographique'];
// Médiane du niveau de vie, suffixée par le millésime (MED21, Q221, NIVVIE_MED…).
const VALUE_REGEX = /^(MED|Q2|NIVVIE_?MED|DISP_?MED|MEDIANE)/i;

function pick(keys: string[], candidats: string[]): string | undefined {
  return candidats.find((c) => keys.includes(c));
}

/** Choisit la colonne médiane : motif fourni, sinon auto-détection (millésime max). */
export function detectValueCol(keys: string[], motif?: string): string | undefined {
  if (motif) {
    const re = new RegExp(motif, 'i');
    const found = keys.filter((k) => re.test(k));
    if (found.length) return preferLatest(found);
  }
  const candidats = keys.filter((k) => VALUE_REGEX.test(k));
  return candidats.length ? preferLatest(candidats) : undefined;
}

/** Parmi plusieurs colonnes millésimées, garde le suffixe numérique le plus grand. */
function preferLatest(cols: string[]): string {
  return [...cols].sort((a, b) => suffixNum(b) - suffixNum(a))[0];
}
function suffixNum(s: string): number {
  const m = s.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : -1;
}

/** Construit la map commune → revenu médian (fonction pure, testable). */
export function buildFilosofiMap(rows: Record<string, string>[], motif?: string): FilosofiMap {
  const map: FilosofiMap = new Map();
  if (rows.length === 0) return map;
  const keys = Object.keys(rows[0]);
  const codeCol = pick(keys, CODE_COLS);
  const valueCol = detectValueCol(keys, motif);
  if (!codeCol || !valueCol) {
    throw new Error(`Filosofi : colonnes code/médiane introuvables (en-têtes : ${keys.join(', ')})`);
  }
  for (const row of rows) {
    const brut = row[codeCol];
    const val = parseNumber(row[valueCol]);
    if (!brut || val === undefined) continue; // commune sous secret statistique → absente
    // La médiane d'un arrondissement n'est pas sommable : on garde la 1re valeur
    // rencontrée pour la commune mère (approximation acceptable, rare).
    const code = communeParent(brut);
    if (!map.has(code)) map.set(code, val);
  }
  return map;
}

/** Télécharge Filosofi et renvoie la map commune → revenu médian. */
export async function fetchFilosofi(spec: SourceSpec, cacheDir: string): Promise<FilosofiMap> {
  const csv = await ensureCsv('filosofi', spec, cacheDir);
  const rows = await readCsvRows(csv);
  return buildFilosofiMap(rows, spec.valueCol);
}
