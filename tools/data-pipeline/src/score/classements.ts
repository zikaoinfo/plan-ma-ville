/**
 * Classements d'une commune : national, départemental et **par strate de
 * population**.
 *
 * Le rang par strate est la vraie nouveauté : comparer une commune de 3 000
 * habitants aux 35 000 communes de France n'a guère de sens (les équipements,
 * la délinquance, les prix ne se comparent pas d'un village à une métropole).
 * La comparer aux communes de taille voisine est statistiquement plus honnête
 * — et souvent plus juste pour la commune elle-même, qui peut être excellente
 * dans sa catégorie sans figurer dans le haut du classement national.
 *
 * Le calcul est fait UNE FOIS dans le pipeline et embarqué dans les données :
 * l'application n'a plus à le refaire, et la prose, la FAQ et le bloc
 * « Classements » d'une même fiche ne peuvent pas afficher trois rangs
 * différents.
 *
 * Fonctions PURES (testées dans `test/classements.spec.ts`).
 */
import type { Classements } from '../models.js';

/**
 * Seuils de population délimitant les strates de comparaison.
 *
 * Neuf strates, alignées sur les seuils usuels du secteur pour que les
 * comparaisons entre sites restent lisibles. Servent à DEUX usages qui
 * doivent rester cohérents : le rang par strate affiché sur la fiche, et le
 * classement de la sécurité (cf. `score/real.ts` — la délinquance est notée
 * par strate, sinon les dizaines de milliers de villages sans délinquance
 * enregistrée écrasent toute commune urbaine vers 0). Une seule définition,
 * donc : deux listes de seuils finiraient par se contredire sur la même page.
 */
export const STRATES_POP = [500, 2000, 5000, 10000, 20000, 50000, 100000, 200000];

/** Libellé lisible de chaque strate (même ordre que `stratePopulation`). */
export const STRATES_LABELS = [
  'de moins de 500 habitants',
  'de 500 à 2 000 habitants',
  'de 2 000 à 5 000 habitants',
  'de 5 000 à 10 000 habitants',
  'de 10 000 à 20 000 habitants',
  'de 20 000 à 50 000 habitants',
  'de 50 000 à 100 000 habitants',
  'de 100 000 à 200 000 habitants',
  'de plus de 200 000 habitants',
];

/** Indice de la strate de population (0 = plus petite). */
export function stratePopulation(pop: number): number {
  let i = 0;
  while (i < STRATES_POP.length && pop >= STRATES_POP[i]) i++;
  return i;
}

/** Commune minimale nécessaire au calcul des rangs. */
export interface CommuneRang {
  codeInsee: string;
  slug: string;
  population: number;
  codeDepartement: string;
  score: { global: number };
}

/**
 * Rangs de chaque commune dans son groupe. Tri par note décroissante, ex æquo
 * départagés par slug — même règle que `classement.json`, pour que deux
 * classements du site ne se contredisent jamais. Les ex æquo reçoivent des
 * rangs distincts (1, 2, 3…) plutôt qu'un rang partagé : afficher « 5ᵉ sur
 * 120 » suppose un ordre total, et un rang partagé rendrait les totaux faux.
 */
function rangsDansGroupe(groupe: readonly CommuneRang[]): Map<string, number> {
  const tri = [...groupe].sort(
    (a, b) => b.score.global - a.score.global || (a.slug < b.slug ? -1 : 1),
  );
  return new Map(tri.map((c, i) => [c.codeInsee, i + 1]));
}

function groupePar<T>(items: readonly CommuneRang[], cle: (c: CommuneRang) => T): Map<T, CommuneRang[]> {
  const groupes = new Map<T, CommuneRang[]>();
  for (const c of items) {
    const k = cle(c);
    const liste = groupes.get(k) ?? [];
    liste.push(c);
    groupes.set(k, liste);
  }
  return groupes;
}

/**
 * Calcule les trois rangs de chaque commune, indexés par code INSEE.
 *
 * NB : les arrondissements de Paris/Lyon/Marseille sont inclus comme des
 * communes à part entière — c'est le choix déjà fait partout ailleurs
 * (index, classement, carte). Ils sont donc classés dans la strate
 * correspondant à LEUR population, pas à celle de leur commune mère.
 */
export function calculeClassements(communes: readonly CommuneRang[]): Map<string, Classements> {
  const national = rangsDansGroupe(communes);
  const parDepartement = groupePar(communes, (c) => c.codeDepartement);
  const parStrate = groupePar(communes, (c) => stratePopulation(c.population));

  const rangsDep = new Map<string, Map<string, number>>();
  for (const [code, liste] of parDepartement) rangsDep.set(code, rangsDansGroupe(liste));

  const rangsStrate = new Map<number, Map<string, number>>();
  for (const [strate, liste] of parStrate) rangsStrate.set(strate, rangsDansGroupe(liste));

  const resultat = new Map<string, Classements>();
  for (const c of communes) {
    const strate = stratePopulation(c.population);
    resultat.set(c.codeInsee, {
      national: national.get(c.codeInsee) as number,
      nationalTotal: communes.length,
      departement: rangsDep.get(c.codeDepartement)?.get(c.codeInsee) as number,
      departementTotal: (parDepartement.get(c.codeDepartement) as CommuneRang[]).length,
      strate: rangsStrate.get(strate)?.get(c.codeInsee) as number,
      strateTotal: (parStrate.get(strate) as CommuneRang[]).length,
      strateIndex: strate,
    });
  }
  return resultat;
}
