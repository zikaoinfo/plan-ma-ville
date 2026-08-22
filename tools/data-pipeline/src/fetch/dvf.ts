import type { PrixM2 } from '../models.js';
import { ensureCsv, forEachCsvRow, parseNumber, type SourceSpec } from './download.js';
import { codesAccumulation } from './insee-code.js';

/** codeInsee (commune mère) → prix m² DVF (médiane + historique). */
export type DvfMap = Map<string, PrixM2>;

const CODE_COLS = ['code_geo', 'CODE_GEO', 'codgeo', 'CODGEO', 'code_commune', 'INSEE_COM'];
const ECHELLE_COLS = ['echelle_geo', 'ECHELLE_GEO', 'echelle'];
const PERIODE_COLS = ['annee_semestre', 'semestre', 'periode', 'annee_mois', 'annee', 'mois'];

/**
 * Variantes de bien suivies. `ensemble` reste la valeur de référence affichée
 * (le marché résidentiel global) ; `maison` et `appartement` sont publiées en
 * plus quand la source les distingue — un prix moyen unique mélange deux
 * marchés qui n'évoluent pas de la même façon.
 */
export const VARIANTES = ['ensemble', 'maison', 'appartement'] as const;
export type Variante = (typeof VARIANTES)[number];

/**
 * Variante décrite par un nom de colonne (fichiers « larges », une colonne
 * par type de bien). Le classement se fait par PRÉSENCE des deux mots, pas
 * par ordre de motifs : une colonne nommée `med_prix_m2_apparts_maisons`
 * contient « maison » ET « appart », c'est donc le combiné — un simple
 * `/maison/` la capterait à tort comme la colonne maisons.
 */
export function varianteColonne(nom: string): Variante | undefined {
  if (!/med.*prix.*m2/i.test(nom)) return undefined;
  const maison = /maisons?/i.test(nom);
  const appart = /apparts?/i.test(nom);
  if (maison && appart) return 'ensemble';
  if (maison) return 'maison';
  if (appart) return 'appartement';
  return 'ensemble'; // colonne générique `med_prix_m2`
}

/** Idem pour les colonnes de nombre de ventes. */
export function varianteColonneNb(nom: string): Variante | undefined {
  if (!/nb.*(ventes|mut)/i.test(nom)) return undefined;
  const maison = /maisons?/i.test(nom);
  const appart = /apparts?/i.test(nom);
  if (maison && appart) return 'ensemble';
  if (maison) return 'maison';
  if (appart) return 'appartement';
  return 'ensemble';
}

/** Valeurs de type de bien (fichiers « longs » à colonne type) par priorité. */
const TYPE_PRIORITES = [
  /apparts?.*maisons?|maisons?.*apparts?|tous|ensemble/i,
  /^maisons?$/i,
  /^apparts?/i,
];

/** Variante d'une valeur de la colonne `type` ; `undefined` = hors sujet. */
export function varianteType(type: string): Variante | undefined {
  const idx = prioriteType(type);
  return idx === -1 ? undefined : VARIANTES[idx];
}

const MAX_HISTO = 10;

function pick(keys: string[], candidats: string[]): string | undefined {
  return candidats.find((c) => keys.includes(c));
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
  // code destination → période → variante → code origine (brut) → ligne retenue
  //
  // La dimension « origine » est ce qui rend correcte l'agrégation des
  // arrondissements sur leur commune mère : la mère reçoit une ligne PAR
  // arrondissement et par période, gardées séparément puis combinées (somme
  // des ventes, moyenne pondérée du prix). Sans elle, un arrondissement
  // écrasait les autres et Paris héritait d'un nombre de ventes dérisoire.
  // La dimension « variante » est ajoutée EN DESSOUS : la combinaison
  // multi-origines s'applique donc indépendamment aux maisons et aux
  // appartements, et le bug ne peut pas se rejouer sur les nouveaux champs.
  type ParVariante = Map<Variante, Map<string, Ligne>>;
  const parCommune = new Map<string, Map<string, ParVariante>>();

  let cols:
    | {
        code: string;
        echelle?: string;
        periode?: string;
        type?: string;
        /** variante → colonne médiane (fichiers larges). */
        med: Map<Variante, string>;
        /** variante → colonne nombre de ventes. */
        nb: Map<Variante, string>;
      }
    | undefined;

  return {
    add(row: Record<string, string>): void {
      if (cols === undefined) {
        const keys = Object.keys(row);
        const code = pick(keys, CODE_COLS) ?? keys.find((k) => /^code_?geo/i.test(k));
        const med = new Map<Variante, string>();
        for (const k of keys) {
          const v = varianteColonne(k);
          // Première colonne gagnante par variante : l'ordre des colonnes du
          // fichier est stable, donc le choix l'est aussi entre deux runs.
          if (v && !med.has(v)) med.set(v, k);
        }
        const nb = new Map<Variante, string>();
        for (const k of keys) {
          const v = varianteColonneNb(k);
          if (v && !nb.has(v)) nb.set(v, k);
        }
        const type = keys.find((k) => /^type/i.test(k));
        if (!code || (med.size === 0 && !type)) {
          throw new Error(`DVF : colonnes code/médiane introuvables (en-têtes : ${keys.join(', ')})`);
        }
        cols = {
          code,
          med,
          nb,
          echelle: pick(keys, ECHELLE_COLS),
          periode: pick(keys, PERIODE_COLS) ?? keys.find((k) => /^(annee|periode|semestre|mois)/i.test(k)),
          type,
        };
      }

      // Fichier multi-échelles : ne garder que les communes.
      if (cols.echelle && !/commune/i.test(row[cols.echelle] ?? '')) return;

      const brut = row[cols.code];
      if (!brut) return;
      const periode = cols.periode ? (row[cols.periode] ?? '') : '';
      const origine = brut.trim().toUpperCase();

      /** Enregistre une valeur pour une variante, sur toutes ses destinations. */
      const enregistre = (variante: Variante, valeur: number, nb: number | undefined, prio: number) => {
        for (const code of codesAccumulation(brut)) {
          const parPeriode = parCommune.get(code) ?? new Map<string, ParVariante>();
          const parVariante = parPeriode.get(periode) ?? (new Map() as ParVariante);
          const parOrigine = parVariante.get(variante) ?? new Map<string, Ligne>();
          const existant = parOrigine.get(origine);
          if (!existant || prio < existant.prio) {
            parOrigine.set(origine, { v: valeur, nb, prio });
          }
          parVariante.set(variante, parOrigine);
          parPeriode.set(periode, parVariante);
          parCommune.set(code, parPeriode);
        }
      };

      if (cols.type) {
        // Fichier « long » : une ligne par type de bien.
        const variante = varianteType(row[cols.type] ?? '');
        if (!variante) return; // locaux commerciaux/industriels : hors sujet
        const colMed = cols.med.get('ensemble') ?? [...cols.med.values()][0];
        const valeur = colMed ? parseNumber(row[colMed]) : undefined;
        if (valeur === undefined || valeur <= 0) return;
        const colNb = cols.nb.get('ensemble') ?? [...cols.nb.values()][0];
        enregistre(variante, valeur, colNb ? parseNumber(row[colNb]) : undefined, 0);
        return;
      }

      // Fichier « large » : une colonne par type de bien, toutes retenues.
      for (const [variante, colonne] of cols.med) {
        const valeur = parseNumber(row[colonne]);
        if (valeur === undefined || valeur <= 0) continue;
        const colNb = cols.nb.get(variante);
        enregistre(variante, valeur, colNb ? parseNumber(row[colNb]) : undefined, 0);
      }
    },

    result(): DvfMap {
      const out: DvfMap = new Map();
      for (const [code, parPeriode] of parCommune) {
        /** Historique + dernière valeur d'une variante, ou undefined si absente. */
        const serie = (variante: Variante) => {
          const periodes = [...parPeriode.keys()]
            .filter((p) => (parPeriode.get(p) as ParVariante).has(variante))
            .sort(); // lexicographique = chronologique
          if (periodes.length === 0) return undefined;
          const histo = periodes.slice(-MAX_HISTO).map((p) => ({
            p,
            v: combinerOrigines((parPeriode.get(p) as ParVariante).get(variante)!).v,
          }));
          const derniere = periodes[periodes.length - 1];
          const d = combinerOrigines((parPeriode.get(derniere) as ParVariante).get(variante)!);
          return { periode: derniere, m2: d.v, nb: d.nb, histo };
        };

        // Le prix de référence reste le résidentiel combiné ; à défaut, les
        // maisons, à défaut les appartements — comme avant le split.
        const ensemble = serie('ensemble') ?? serie('maison') ?? serie('appartement');
        if (!ensemble) continue;

        const maison = serie('maison');
        const appartement = serie('appartement');
        out.set(code, {
          m2: ensemble.m2,
          periode: ensemble.periode,
          ...(ensemble.nb !== undefined ? { nb: ensemble.nb } : {}),
          histo: ensemble.histo,
          // Publiés seulement si la source distingue réellement les deux : une
          // « répartition » recopiant l'agrégat n'apprendrait rien.
          ...(maison ? { maison: { m2: maison.m2, ...(maison.nb !== undefined ? { nb: maison.nb } : {}), histo: maison.histo } } : {}),
          ...(appartement ? { appartement: { m2: appartement.m2, ...(appartement.nb !== undefined ? { nb: appartement.nb } : {}), histo: appartement.histo } } : {}),
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
