import { fmtEntier, fmtNote } from '../../core/format';
import { CRITERE_LABELS, type CommuneDetail } from '../../core/models/data.models';
import {
  categorieTaille,
  contexteDepartemental,
  label,
  pointFaible,
  pointsForts,
  qualificatif,
  rangOrdinal,
  variante,
} from './commune-contexte';
import { dvfTrendPct } from './commune-insights';

// Réexportés : `commune-contexte.ts` est le module de référence, mais ces deux
// helpers font partie de l'API historique de commune-texte (specs, usages).
export { categorieTaille, qualificatif };

/**
 * Génération du texte éditorial des fiches communes — 100 % dérivé des
 * données réelles (notes, rang départemental, DVF, population), avec des
 * variantes de tournures choisies par hash du code INSEE : chaque commune a
 * SES chiffres et SA formulation, stables entre deux builds (SSG déterministe).
 * Anti « scaled content abuse » : pas de template où seul le nom change.
 */

export interface TexteCommune {
  /** Réponse directe (~50-70 mots) : le format repris par les moteurs IA. */
  resume: string;
  /** Sections « Vivre à {ville} » (h2 + paragraphe). */
  sections: { titre: string; texte: string }[];
}

// ── Génération ────────────────────────────────
export function genereTexteCommune(
  commune: CommuneDetail,
  deps: readonly CommuneDetail[],
  depNom: string,
): TexteCommune {
  const insee = commune.codeInsee;
  const ctx = contexteDepartemental(commune, deps);
  const [fort1, fort2] = pointsForts(commune);
  const faible = pointFaible(commune);
  const notes = commune.score.criteres;
  const taille = categorieTaille(commune.population);

  // ── Réponse directe (~50-70 mots) ──
  const verbe = variante(insee, 'verbe', ['obtient', 'affiche', 'décroche']);
  const rangTxt =
    ctx.rang > 0 && ctx.total > 1
      ? ` et se classe ${rangOrdinal(ctx.rang, fmtEntier)} sur ${fmtEntier(ctx.total)} communes ${variante(insee, 'dep', ['du département', 'dans le département'])} (${depNom})`
      : '';
  const prixTxt = commune.prix
    ? ` Le prix médian y est de ${fmtEntier(commune.prix.m2)} €/m².`
    : '';
  const resume =
    `${commune.nom} ${verbe} la note globale de ${fmtNote(commune.score.global)}/10${rangTxt}. ` +
    `Ses points forts : ${label(fort1)} (${fmtNote(notes[fort1])}/10) et ${label(fort2)} (${fmtNote(notes[fort2])}/10).` +
    prixTxt +
    ` Cette ${taille} compte ${fmtEntier(commune.population)} habitants.`;

  const sections: { titre: string; texte: string }[] = [];

  // ── Qualité de vie ──
  const deltaFort = notes[fort1] - ctx.moyennesDep[fort1];
  const comparaisonFort =
    Math.abs(deltaFort) >= 0.5 && ctx.nbExternes > 0
      ? ` — ${deltaFort > 0 ? `${fmtNote(Math.abs(deltaFort))} point${Math.abs(deltaFort) >= 2 ? 's' : ''} au-dessus de` : 'sous'} la moyenne départementale (${fmtNote(ctx.moyennesDep[fort1])}/10)`
      : '';
  sections.push({
    titre: `Qualité de vie à ${commune.nom}`,
    texte:
      `${variante(insee, 'qv', [
        `Sur les huit critères évalués, ${commune.nom} se distingue d'abord par`,
        `Parmi les huit thématiques notées, ${commune.nom} ressort surtout sur`,
        `Au regard des huit critères analysés, ${commune.nom} tire son épingle du jeu sur`,
      ])} ${label(fort1)}, noté ${fmtNote(notes[fort1])}/10${comparaisonFort}. ` +
      `${CRITERE_LABELS[fort2]} suit avec ${fmtNote(notes[fort2])}/10. ` +
      `À l'inverse, ${label(faible)} (${fmtNote(notes[faible])}/10) reste son point le plus discuté. ` +
      `La note globale de ${fmtNote(commune.score.global)}/10 résulte de la moyenne pondérée de ces critères, calculée uniquement à partir de données publiques (INSEE, ministère de l'Intérieur, DGFiP).`,
  });

  // ── Sécurité (neutre, factuel) ──
  const noteSecu = notes.securite;
  sections.push({
    titre: `La sécurité à ${commune.nom}`,
    texte:
      `${variante(insee, 'secu', [
        `Côté sécurité, ${commune.nom} obtient ${fmtNote(noteSecu)}/10`,
        `Sur le plan de la sécurité, la note s'établit à ${fmtNote(noteSecu)}/10`,
        `En matière de sécurité, ${commune.nom} est noté ${fmtNote(noteSecu)}/10`,
      ])}, une note ${qualificatif(noteSecu)} calculée à partir des faits de délinquance enregistrés par la police et la gendarmerie (base SSMSI), rapportés à la population. ` +
      `La comparaison se fait entre communes de taille similaire : cette ${taille} est classée parmi les communes de sa strate démographique, pas face aux villages sans délinquance enregistrée.`,
  });

  // ── Équipements & transports ──
  sections.push({
    titre: `Équipements, commerces et transports`,
    texte:
      `${variante(insee, 'equip', [
        `Au quotidien, les habitants disposent d'une offre`,
        `Pour la vie de tous les jours, l'offre est`,
        `Au jour le jour, la commune propose une offre`,
      ])} ${qualificatif(notes.commerces)} en commerces (${fmtNote(notes.commerces)}/10) et ${qualificatif(notes.sante)} en santé (${fmtNote(notes.sante)}/10), selon la densité d'équipements recensés par l'INSEE (base permanente des équipements). ` +
      `Les transports sont notés ${fmtNote(notes.transports)}/10 et l'enseignement ${fmtNote(notes.enseignement)}/10. ` +
      `Sports et loisirs (${fmtNote(notes.sports)}/10) et culture (${fmtNote(notes.culture)}/10) complètent le tableau.`,
  });

  // ── Immobilier & niveau de vie ──
  if (commune.prix) {
    const tendance = dvfTrendPct(commune.prix.histo);
    const tendanceTxt =
      tendance !== null
        ? ` ${tendance >= 0 ? `en hausse de ${fmtNote(Math.abs(tendance)).replace(',0', '')} %` : `en baisse de ${fmtNote(Math.abs(tendance)).replace(',0', '')} %`} sur un an,`
        : '';
    const vsDep =
      ctx.prixMedianDep !== null && ctx.prixMedianDep > 0
        ? ` soit ${commune.prix.m2 >= ctx.prixMedianDep ? 'plus cher' : 'moins cher'} que la médiane des communes du département couvertes par la donnée (${fmtEntier(ctx.prixMedianDep)} €/m²)`
        : '';
    sections.push({
      titre: `Immobilier et niveau de vie`,
      texte:
        `${variante(insee, 'immo', [
          `Les ventes immobilières réelles (base DVF des transactions notariées) situent le prix médian à`,
          `D'après les transactions notariées enregistrées (base DVF), le prix médian s'établit à`,
        ])} ${fmtEntier(commune.prix.m2)} €/m²,${tendanceTxt}${vsDep}. ` +
        `Le niveau de vie, estimé sur le revenu médian des ménages (INSEE Filosofi), est noté ${fmtNote(notes.niveauVie)}/10.`,
    });
  } else {
    sections.push({
      titre: `Immobilier et niveau de vie`,
      texte:
        `Trop peu de ventes immobilières sont enregistrées à ${commune.nom} pour publier un prix au m² fiable (la base DVF ne couvre par ailleurs ni l'Alsace, ni la Moselle, ni Mayotte). ` +
        `Le niveau de vie, estimé sur le revenu médian des ménages (INSEE Filosofi), est noté ${fmtNote(notes.niveauVie)}/10.`,
    });
  }

  return { resume, sections };
}
