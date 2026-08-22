import { CRITERE_LABELS, type CommuneDetail, type Critere } from '../../core/models/data.models';
import { filtrerBassinVoisinage } from './commune-insights';

/**
 * Socle de dérivation PARTAGÉ par la prose (`commune-texte.ts`) et la FAQ
 * (`commune-faq.ts`) d'une fiche commune.
 *
 * Pourquoi un module commun plutôt que deux calculs parallèles : les deux
 * blocs sont affichés sur la MÊME page et parlent des mêmes chiffres. Deux
 * implémentations séparées finiraient tôt ou tard par diverger (un rang
 * calculé sur un tri différent, une moyenne départementale incluant la
 * commune ici et pas là) — et une page qui se contredit elle-même est
 * exactement ce que les moteurs pénalisent. Tout ce qui est chiffré passe
 * donc par ici, une seule fois.
 *
 * Fonctions PURES (testées dans `commune-contexte.spec.ts`).
 */

// ── Aléa déterministe ─────────────────────────

/** Hash 32 bits stable (dérivé de cyrb53, suffisant pour choisir une variante). */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Variante déterministe : même (INSEE, slot) → toujours la même tournure.
 * Indispensable au SSG (deux builds doivent produire un HTML identique) et
 * anti « scaled content abuse » (pas de template où seul le nom change).
 */
export function variante(insee: string, slot: string, options: readonly string[]): string {
  return options[hash(`${insee}:${slot}`) % options.length];
}

// ── Qualificatifs ─────────────────────────────

/** Qualificatif d'une note /10 (registre neutre, factuel). */
export function qualificatif(note: number): string {
  if (note >= 8) return 'excellente';
  if (note >= 6.5) return 'bonne';
  if (note >= 5) return 'moyenne';
  if (note >= 3.5) return 'en retrait';
  return 'faible';
}

/** Catégorie de taille (pour adapter les formulations). */
export function categorieTaille(pop: number): string {
  if (pop < 2000) return 'village';
  if (pop < 20000) return 'petite ville';
  if (pop < 100000) return 'ville moyenne';
  return 'grande ville';
}

/** Clé de tranche, pour choisir un jeu de tournures par taille de commune. */
export type Tranche = 'village' | 'petite' | 'moyenne' | 'grande';

export function tranche(pop: number): Tranche {
  if (pop < 2000) return 'village';
  if (pop < 20000) return 'petite';
  if (pop < 100000) return 'moyenne';
  return 'grande';
}

// ── Contexte départemental ────────────────────

export interface Contexte {
  rang: number;
  total: number;
  moyennesDep: Record<Critere, number>;
  /** Médiane départementale du prix m² (communes couvertes par DVF). */
  prixMedianDep: number | null;
  /** Nombre de communes EXTERNES utilisées pour moyennesDep/prixMedianDep. */
  nbExternes: number;
}

/**
 * Communes de comparaison EXTERNES à `commune` : jamais elle-même, ni sa
 * famille (commune mère / arrondissements — cf. Paris/Lyon/Marseille, dont le
 * département ne contient quasiment que la ville et ses propres
 * arrondissements). Sans cette exclusion, comparer Paris à « la moyenne du
 * département » revient à la comparer en grande partie à elle-même.
 */
export function contexteDepartemental(
  commune: CommuneDetail,
  deps: readonly CommuneDetail[],
): Contexte {
  // Rang départemental : on lit celui calculé par le pipeline
  // (`score/classements.ts`) plutôt que de le recalculer. C'est le même rang
  // que celui affiché dans le bloc « Classements » — deux calculs parallèles
  // finiraient par diverger (tri sans départage ici, avec là-bas) et la même
  // fiche annoncerait deux rangs différents. Le repli couvre les données
  // antérieures à ce champ et les fixtures de test.
  const rang =
    commune.classements?.departement ??
    [...deps]
      .sort((a, b) => b.score.global - a.score.global || (a.slug < b.slug ? -1 : 1))
      .findIndex((c) => c.slug === commune.slug) + 1;

  const externes = filtrerBassinVoisinage(commune, deps).filter((c) => c.slug !== commune.slug);

  const moyennesDep = {} as Record<Critere, number>;
  for (const critere of Object.keys(CRITERE_LABELS) as Critere[]) {
    const somme = externes.reduce((acc, c) => acc + c.score.criteres[critere], 0);
    moyennesDep[critere] = externes.length ? somme / externes.length : 0;
  }

  const prix = externes
    .map((c) => c.prix?.m2)
    .filter((v): v is number => v !== undefined)
    .sort((a, b) => a - b);
  const prixMedianDep = prix.length ? prix[Math.floor(prix.length / 2)] : null;

  const total = commune.classements?.departementTotal ?? deps.length;
  return { rang, total, moyennesDep, prixMedianDep, nbExternes: externes.length };
}

// ── Points forts / faibles ────────────────────

/** Les 2 critères les mieux notés (ordre décroissant, départagés par label). */
export function pointsForts(commune: CommuneDetail): [Critere, Critere] {
  const tri = (Object.keys(CRITERE_LABELS) as Critere[]).sort(
    (a, b) =>
      commune.score.criteres[b] - commune.score.criteres[a] ||
      CRITERE_LABELS[a].localeCompare(CRITERE_LABELS[b]),
  );
  return [tri[0], tri[1]];
}

export function pointFaible(commune: CommuneDetail): Critere {
  return (Object.keys(CRITERE_LABELS) as Critere[]).reduce((min, c) =>
    commune.score.criteres[c] < commune.score.criteres[min] ? c : min,
  );
}

/** Label d'un critère en minuscules (« sécurité », « niveau de vie »). */
export const label = (c: Critere): string => CRITERE_LABELS[c].toLowerCase();

/** Rang formaté à la française : 1ʳᵉ, 2ᵉ, 3ᵉ… */
export function rangOrdinal(rang: number, fmt: (n: number) => string): string {
  return rang === 1 ? '1ʳᵉ' : `${fmt(rang)}ᵉ`;
}
