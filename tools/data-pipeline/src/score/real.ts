import { CRITERES, type Critere } from '../models.js';
import { BPE_CRITERES, type BpeMap } from '../fetch/bpe.js';
import type { FilosofiMap } from '../fetch/filosofi.js';
import type { SecuriteMap } from '../fetch/securite.js';
import { linearNote, robustBounds, sortedValues, type Bounds } from './scale.js';

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
 * Note chaque commune sur les 8 critères par normalisation min–max robuste
 * (bornes 2ᵉ/98ᵉ centiles), relative au jeu de communes fourni. Deux passes :
 * (1) métriques brutes + bornes par critère, (2) conversion linéaire en notes
 * /10 (la moins dotée → 0, la mieux dotée → 10). Une commune sans donnée pour
 * un critère reçoit la note neutre 5 (jamais 0).
 */
export function computeRealScores(
  communes: readonly CommuneRef[],
  maps: DataMaps,
): Map<string, Record<Critere, number>> {
  // Passe 1 — métriques brutes.
  const metriques = communes.map((c) => ({ code: c.codeInsee, m: rawMetrics(c, maps) }));

  // Bornes robustes par critère (valeurs définies uniquement).
  const bounds = {} as Record<Critere, Bounds>;
  for (const c of CRITERES) {
    const vals = sortedValues(
      metriques.map((x) => x.m[c]).filter((v): v is number => v !== undefined),
    );
    bounds[c] = robustBounds(vals);
  }

  // Passe 2 — normalisation min–max.
  const out = new Map<string, Record<Critere, number>>();
  for (const { code, m } of metriques) {
    const notes = {} as Record<Critere, number>;
    for (const c of CRITERES) {
      const v = m[c];
      notes[c] = v === undefined ? 5 : linearNote(v, bounds[c], INVERSE[c]);
    }
    out.set(code, notes);
  }
  return out;
}
