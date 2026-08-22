import type { Demographie } from '../../core/models/data.models';

/**
 * Mise en forme du bloc « Population » : pyramide des âges, répartition par
 * sexe et catégories socioprofessionnelles (INSEE, recensement).
 *
 * Les données stockées sont des EFFECTIFS ; les pourcentages sont calculés
 * ici. Stocker les deux les aurait fait diverger au premier arrondi.
 *
 * Fonctions PURES (testées dans `commune-demographie.spec.ts`).
 */

export const LABELS_AGE = [
  '0 à 14 ans',
  '15 à 29 ans',
  '30 à 44 ans',
  '45 à 59 ans',
  '60 à 74 ans',
  '75 à 89 ans',
  '90 ans et plus',
];

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

export interface BarreDemographie {
  label: string;
  effectif: number;
  /** Part du total, en % (une décimale). */
  part: number;
  /** Largeur de barre relative à la plus grande valeur de la série, en %. */
  largeur: number;
}

/**
 * Série de barres à partir d'effectifs. Deux échelles distinctes :
 * - `part` = poids réel dans la population (ce qui est lu),
 * - `largeur` = proportion de la plus grande barre (ce qui est vu).
 *
 * Utiliser `part` pour la largeur écraserait visuellement toutes les tranches
 * quand l'une domine ; utiliser `largeur` comme chiffre affiché mentirait sur
 * la répartition. D'où les deux.
 */
export function series(effectifs: readonly number[], labels: readonly string[]): BarreDemographie[] {
  const total = effectifs.reduce((a, b) => a + b, 0);
  const max = Math.max(...effectifs, 0);
  return effectifs.map((effectif, i) => ({
    label: labels[i] ?? '',
    effectif,
    part: total > 0 ? Math.round((effectif / total) * 1000) / 10 : 0,
    largeur: max > 0 ? Math.round((effectif / max) * 100) : 0,
  }));
}

export interface BlocDemographie {
  millesime: number;
  total: number;
  ages: BarreDemographie[];
  /** Répartition par sexe, absente si l'INSEE ne la publie pas. */
  sexes: { hommes: number; femmes: number; partHommes: number; partFemmes: number } | null;
  /** CSP, absentes sous secret statistique. */
  csp: BarreDemographie[] | null;
}

/** Prépare le bloc complet ; `null` si la commune n'a pas de démographie. */
export function blocDemographie(demo: Demographie | undefined): BlocDemographie | null {
  if (!demo || demo.ages.length === 0) return null;
  const total = demo.ages.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  const h = demo.hommes;
  const f = demo.femmes;
  const totalSexes = (h ?? 0) + (f ?? 0);
  return {
    millesime: demo.millesime,
    total,
    ages: series(demo.ages, LABELS_AGE),
    sexes:
      h !== undefined && f !== undefined && totalSexes > 0
        ? {
            hommes: h,
            femmes: f,
            partHommes: Math.round((h / totalSexes) * 1000) / 10,
            partFemmes: Math.round((f / totalSexes) * 1000) / 10,
          }
        : null,
    csp: demo.csp?.length ? series(demo.csp, LABELS_CSP) : null,
  };
}
