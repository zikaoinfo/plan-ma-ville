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
 * Seuils de population délimitant les strates de comparaison de la sécurité.
 * La délinquance est classée PAR strate : une ville est comparée aux communes de
 * taille voisine, pas noyée sous les dizaines de milliers de villages sans
 * délinquance enregistrée (qui, en classement national, écrasent toute commune
 * urbaine vers 0). Chaque strate utilise ainsi pleinement l'échelle 0–10.
 */
const STRATES_POP = [500, 2000, 5000, 20000, 50000, 100000];

/** Indice de la strate de population (0 = plus petite). */
export function stratePopulation(pop: number): number {
  let i = 0;
  while (i < STRATES_POP.length && pop >= STRATES_POP[i]) i++;
  return i;
}

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
  boost: Partial<Record<Critere, number>> = {},
): Map<string, Record<Critere, number>> {
  const metriques = communes.map((c) => ({
    code: c.codeInsee,
    strate: stratePopulation(c.population),
    m: rawMetrics(c, maps),
  }));

  // Notes neutres par défaut (couvre les communes sans donnée sur un critère).
  const out = new Map<string, Record<Critere, number>>();
  for (const { code } of metriques) {
    out.set(code, Object.fromEntries(CRITERES.map((c) => [c, 5])) as Record<Critere, number>);
  }

  // Affecte les notes d'un sous-ensemble de communes (mêmes indices).
  const affecter = (codes: string[], valeurs: number[], critere: Critere) => {
    const notes = rankNotes(valeurs, INVERSE[critere], boost[critere] ?? 1);
    for (let i = 0; i < codes.length; i++) out.get(codes[i])![critere] = notes[i];
  };

  for (const critere of CRITERES) {
    if (critere === 'securite') {
      // Classement PAR strate de population (villes comparées entre elles).
      const parStrate = new Map<number, { codes: string[]; valeurs: number[] }>();
      for (const { code, strate, m } of metriques) {
        const v = m.securite;
        if (v === undefined) continue;
        const g = parStrate.get(strate) ?? { codes: [], valeurs: [] };
        g.codes.push(code);
        g.valeurs.push(v);
        parStrate.set(strate, g);
      }
      for (const { codes, valeurs } of parStrate.values()) affecter(codes, valeurs, critere);
    } else {
      // Classement national.
      const codes: string[] = [];
      const valeurs: number[] = [];
      for (const { code, m } of metriques) {
        const v = m[critere];
        if (v !== undefined) {
          codes.push(code);
          valeurs.push(v);
        }
      }
      affecter(codes, valeurs, critere);
    }
  }
  return out;
}
