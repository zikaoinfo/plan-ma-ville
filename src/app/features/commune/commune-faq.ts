import { fmtEntier, fmtNote } from '../../core/format';
import type { CommuneDetail } from '../../core/models/data.models';
import {
  categorieTaille,
  contexteDepartemental,
  label,
  pointsForts,
  qualificatif,
  rangOrdinal,
  tranche,
  variante,
} from './commune-contexte';
import { dvfTrendPct, libellePeriodeDvf } from './commune-insights';

/**
 * FAQ d'une fiche commune : 3 à 4 paires question/réponse **entièrement
 * dérivées des données déjà calculées** (note globale, rang départemental,
 * notes par critère, moyennes du département, prix DVF). Aucune rédaction
 * manuelle, aucune génération IA — c'est du templating sur des chiffres réels.
 *
 * Pourquoi ce format : une réponse courte, autonome et directement citable est
 * ce que reprennent les moteurs de réponse (AI Overviews, assistants). Chaque
 * réponse commence donc par le chiffre demandé, se suffit à elle-même (elle ne
 * renvoie pas à « voir ci-dessus ») et nomme sa source.
 *
 * Cohérence garantie avec la prose : les deux passent par
 * `commune-contexte.ts` (même rang, mêmes moyennes, mêmes points forts) — cf.
 * le commentaire d'en-tête de ce module.
 *
 * Variation : le jeu de tournures dépend de la TRANCHE de taille (village →
 * grande ville) et la variante retenue du hash du code INSEE. Deux builds
 * successifs produisent le même texte (SSG déterministe) ; deux communes
 * comparables ne produisent pas la même phrase.
 *
 * Règle de rédaction des variantes : chaque phrase commence par un SUJET
 * EXPLICITE (« Cette note… », « Le calcul… »), jamais par un pronom. Une
 * réponse de FAQ est lue isolément — extraite par un moteur de réponse, elle
 * perd le contexte qui donnerait son antécédent au pronom. Un test le vérifie.
 *
 * Fonction PURE (testée dans `commune-faq.spec.ts`).
 */

export interface QuestionReponse {
  q: string;
  r: string;
}

/** « Cette petite ville », « Ce village »… accordé sur la catégorie. */
function demonstratif(pop: number): string {
  return tranche(pop) === 'village' ? `Ce ${categorieTaille(pop)}` : `Cette ${categorieTaille(pop)}`;
}

export function genereFaqCommune(
  commune: CommuneDetail,
  deps: readonly CommuneDetail[],
  depNom: string,
): QuestionReponse[] {
  const insee = commune.codeInsee;
  const nom = commune.nom;
  const notes = commune.score.criteres;
  const ctx = contexteDepartemental(commune, deps);
  const [fort1, fort2] = pointsForts(commune);
  const t = tranche(commune.population);
  const faq: QuestionReponse[] = [];

  const aRang = ctx.rang > 0 && ctx.total > 1;
  const rangTxt = aRang
    ? `${rangOrdinal(ctx.rang, fmtEntier)} sur les ${fmtEntier(ctx.total)} communes du département (${depNom})`
    : '';

  // ── 1. La question principale : la note globale ──
  // Placée en tête : c'est la requête d'intention primaire (« est-ce une
  // bonne ville pour vivre ») et la réponse que reprennent les moteurs.
  faq.push({
    q: `${nom} est-elle une bonne ville pour vivre ?`,
    r:
      `${nom} obtient la note globale de ${fmtNote(commune.score.global)}/10` +
      (aRang ? `, ce qui la place ${rangTxt}` : '') +
      `. Ses deux meilleurs critères sont ${label(fort1)} (${fmtNote(notes[fort1])}/10) et ` +
      `${label(fort2)} (${fmtNote(notes[fort2])}/10). ` +
      variante(insee, 'faq-globale-' + t, [
        `Cette note est la moyenne pondérée de huit critères mesurés sur des données publiques, sans avis subjectif.`,
        `Cette note agrège huit critères pondérés, calculés uniquement à partir de données publiques.`,
        `Le calcul agrège huit critères pondérés issus exclusivement de sources publiques.`,
      ]),
  });

  // ── 2. Sécurité ──
  const secu = notes.securite;
  const moySecu = ctx.moyennesDep.securite;
  // Sous 0,3 point l'écart n'est pas signifiant : le dire plutôt que
  // d'opposer deux chiffres quasi identiques (« 5,4 contre 5,6 »).
  const ecartSecu =
    ctx.nbExternes === 0
      ? ''
      : Math.abs(secu - moySecu) >= 0.3
        ? `, ${secu > moySecu ? 'au-dessus de' : 'en dessous de'} la moyenne des autres communes du département (${fmtNote(moySecu)}/10)`
        : `, comparable aux autres communes du département (${fmtNote(moySecu)}/10)`;
  faq.push({
    q: `${nom} est-elle une ville sûre ?`,
    r:
      `${nom} obtient ${fmtNote(secu)}/10 en sécurité, une note ${qualificatif(secu)}${ecartSecu}. ` +
      variante(insee, 'faq-secu-' + t, [
        `Cette note est calculée à partir des faits de délinquance enregistrés par la police et la gendarmerie (base SSMSI), rapportés à la population.`,
        `Le calcul repose sur les faits de délinquance enregistrés par les forces de l'ordre (base SSMSI), ramenés au nombre d'habitants.`,
      ]) +
      ` ${demonstratif(commune.population)} est comparée aux communes de sa strate de population, pas aux villages sans délinquance enregistrée.`,
  });

  // ── 3. Immobilier ──
  if (commune.prix) {
    const tendance = dvfTrendPct(commune.prix.histo);
    const tendanceTxt =
      tendance !== null
        ? ` Sur un an, le prix médian est ${tendance >= 0 ? 'en hausse' : 'en baisse'} de ${fmtNote(Math.abs(tendance)).replace(',0', '')} %.`
        : '';
    const vsDep =
      ctx.prixMedianDep !== null && ctx.prixMedianDep > 0
        ? ` C'est ${commune.prix.m2 >= ctx.prixMedianDep ? 'plus cher' : 'moins cher'} que la médiane des communes du département couvertes par la donnée (${fmtEntier(ctx.prixMedianDep)} €/m²).`
        : '';
    faq.push({
      q: `Combien coûte l'immobilier à ${nom} ?`,
      r:
        `À ${nom}, le prix médian au m² est de ${fmtEntier(commune.prix.m2)} €` +
        (commune.prix.periode ? ` au ${libellePeriodeDvf(commune.prix.periode)}` : '') +
        `.${vsDep}${tendanceTxt} ` +
        variante(insee, 'faq-prix-' + t, [
          `Ce chiffre provient des ventes immobilières réellement enregistrées (base DVF de la DGFiP), pas d'une estimation.`,
          `Ce prix est issu des transactions notariées effectivement enregistrées (base DVF, DGFiP) — ce n'est pas une estimation.`,
        ]),
    });
  } else {
    faq.push({
      q: `Combien coûte l'immobilier à ${nom} ?`,
      r:
        `Aucun prix au m² fiable ne peut être publié pour ${nom} : trop peu de ventes y sont enregistrées sur la période, ` +
        `ou la commune n'est pas couverte par la base DVF (Alsace, Moselle et Mayotte relèvent du livre foncier local). ` +
        `Plutôt qu'une estimation, aucun chiffre n'est affiché.`,
    });
  }

  // ── 4. Niveau de vie — seulement si la comparaison départementale existe ──
  // Sans commune externe de référence, la réponse se réduirait à répéter une
  // note déjà affichée dans le tableau des critères : sans intérêt.
  if (ctx.nbExternes > 0) {
    const nv = notes.niveauVie;
    const moyNv = ctx.moyennesDep.niveauVie;
    const vsMoyenne =
      Math.abs(nv - moyNv) >= 0.3
        ? `, contre ${fmtNote(moyNv)}/10 en moyenne pour les autres communes du département`
        : `, soit le niveau moyen des autres communes du département (${fmtNote(moyNv)}/10)`;
    faq.push({
      q: `Quel est le niveau de vie à ${nom} ?`,
      r:
        `Le niveau de vie à ${nom} est noté ${fmtNote(nv)}/10${vsMoyenne}. ` +
        // Sujet explicite dans chaque variante : « Elle » n'aurait pas
        // d'antécédent féminin dans la phrase précédente (« le niveau de vie »).
        variante(insee, 'faq-nv-' + t, [
          `Cette note est établie à partir du revenu médian disponible des ménages publié par l'INSEE (dispositif Filosofi).`,
          `Ce calcul repose sur le revenu médian disponible des ménages (INSEE, dispositif Filosofi).`,
        ]),
    });
  }

  return faq;
}
