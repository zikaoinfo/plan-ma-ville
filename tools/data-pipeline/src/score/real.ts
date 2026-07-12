import { CRITERES, type Critere } from '../models.js';
import { BPE_CRITERES, type BpeMap } from '../fetch/bpe.js';
import type { FilosofiMap } from '../fetch/filosofi.js';
import type { SecuriteMap } from '../fetch/securite.js';
import { rankNotes } from './scale.js';

/** Jeux de données réels agrégés par commune (issus des fetchers). */
export interface DataMaps {
  bpe: BpeMap;
  securite: SecuriteMap;
  filosofi: FilosofiMap;
}

export interface CommuneRef {
  codeInsee: string;
  population: number;
}

/** Critères où une valeur ÉLEVÉE dégrade la note (délinquance). */
const INVERSE: Partial<Record<Critere, boolean>> = { securite: true };

/**
 * Métrique brute par critère pour une commune. `undefined` = donnée absente
 * (secret statistique / hors couverture) → repli sur la médiane nationale.
 * - BPE : densité d'équipements pour 1000 habitants (toujours définie, 0 mini).
 * - Sécurité : taux de faits pour 1000 habitants (inversé au scoring).
 * - Niveau de vie : revenu médian disponible brut.
 */
function rawMetrics(commune: CommuneRef, maps: DataMaps): Record<Critere, number | undefined> {
  const pop = Math.max(commune.population, 1);
  const bpe = maps.bpe.get(commune.codeInsee);
  const m = {} as Record<Critere, number | undefined>;
  for (const c of BPE_CRITERES) m[c] = ((bpe?.[c] ?? 0) / pop) * 1000;
  const faits = maps.securite.get(commune.codeInsee);
  m.securite = faits === undefined ? undefined : (faits / pop) * 1000;
  m.niveauVie = maps.filosofi.get(commune.codeInsee);
  return m;
}

/**
 * Note chaque commune sur les 8 critères par rang percentile moyen (midrank),
 * relatif au jeu de communes fourni, puis remise à l'échelle pour que la
 * meilleure commune de chaque critère obtienne 10. Une commune sans donnée pour
 * un critère reçoit la note neutre 5 (jamais 0).
 */
export function computeRealScores(
  communes: readonly CommuneRef[],
  maps: DataMaps,
): Map<string, Record<Critere, number>> {
  const metriques = communes.map((c) => ({ code: c.codeInsee, m: rawMetrics(c, maps) }));

  // Notes neutres par défaut (couvre les communes sans donnée sur un critère).
  const out = new Map<string, Record<Critere, number>>();
  for (const { code } of metriques) {
    out.set(code, Object.fromEntries(CRITERES.map((c) => [c, 5])) as Record<Critere, number>);
  }

  // Par critère : noter les communes qui ont une valeur, réaffecter le résultat.
  for (const critere of CRITERES) {
    const codes: string[] = [];
    const valeurs: number[] = [];
    for (const { code, m } of metriques) {
      const v = m[critere];
      if (v !== undefined) {
        codes.push(code);
        valeurs.push(v);
      }
    }
    const notes = rankNotes(valeurs, INVERSE[critere]);
    for (let i = 0; i < codes.length; i++) {
      out.get(codes[i])![critere] = notes[i];
    }
  }
  return out;
}
