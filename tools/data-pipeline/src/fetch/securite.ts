import { ensureCsv, forEachCsvRow, parseNumber, type SourceSpec } from './download.js';
import { communeParent } from './insee-code.js';

/** codeInsee (commune mère) → nombre total de faits sur le dernier millésime. */
export type SecuriteMap = Map<string, number>;

const CODE_COLS = ['CODGEO_2024', 'CODGEO_2025', 'CODGEO', 'CODGEO_2023', 'codgeo', 'DEPCOM'];
const YEAR_COLS = ['annee', 'ANNEE', 'Année', 'year'];
const FAITS_COLS = ['faits', 'Faits', 'nombre', 'Nombre', 'nb_faits'];

function pick(keys: string[], candidats: string[]): string | undefined {
  return candidats.find((c) => keys.includes(c));
}

/**
 * Accumulateur streaming SSMSI : somme les faits par (commune, millésime) —
 * toutes classes de délinquance confondues — en suivant le millésime maximal.
 * `result()` ne renvoie que le dernier millésime. Exporté pour testabilité.
 */
export function makeSecuriteAccumulator() {
  // code → (annéeNum → faits cumulés)
  const parAnnee = new Map<string, Map<number, number>>();
  let maxAnnee = -Infinity;
  let codeCol: string | undefined;
  let yearCol: string | null | undefined;
  let faitsCol: string | undefined;

  return {
    add(row: Record<string, string>): void {
      if (codeCol === undefined) {
        const keys = Object.keys(row);
        codeCol = pick(keys, CODE_COLS);
        yearCol = pick(keys, YEAR_COLS) ?? null;
        faitsCol = pick(keys, FAITS_COLS);
        if (!codeCol || !faitsCol) {
          throw new Error(`SSMSI : colonnes code/faits introuvables (en-têtes : ${keys.join(', ')})`);
        }
      }
      const brut = row[codeCol];
      const faits = parseNumber(row[faitsCol as string]);
      if (!brut || faits === undefined) return; // faits masqué (secret stat.) → ignoré
      const annee = yearCol ? (parseNumber(row[yearCol]) ?? 0) : 0;
      if (annee > maxAnnee) maxAnnee = annee;
      const code = communeParent(brut);
      const parC = parAnnee.get(code) ?? new Map<number, number>();
      parC.set(annee, (parC.get(annee) ?? 0) + faits);
      parAnnee.set(code, parC);
    },
    result(): SecuriteMap {
      const out: SecuriteMap = new Map();
      for (const [code, parC] of parAnnee) {
        const faits = parC.get(maxAnnee);
        if (faits !== undefined) out.set(code, faits);
      }
      return out;
    },
    /** Millésime retenu (pour le rapport de run). */
    millesime(): number {
      return maxAnnee;
    },
  };
}

/** Télécharge et agrège la base SSMSI : commune → faits du dernier millésime. */
export async function fetchSecurite(
  spec: SourceSpec,
  cacheDir: string,
): Promise<{ map: SecuriteMap; millesime: number }> {
  const csv = await ensureCsv('securite', spec, cacheDir);
  const acc = makeSecuriteAccumulator();
  await forEachCsvRow(csv, {}, (row) => acc.add(row));
  return { map: acc.result(), millesime: acc.millesime() };
}
