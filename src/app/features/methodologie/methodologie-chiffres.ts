/**
 * Source unique des chiffres de méthodologie affichés sur le site
 * (page /methodologie et rappel sur chaque fiche commune).
 *
 * **Pourquoi ce module plutôt que des nombres écrits dans les gabarits** :
 * ces chiffres apparaissent à deux endroits au moins, et une source de
 * données ajoutée sans mettre à jour les deux ferait afficher au site une
 * affirmation fausse sur sa propre méthode. Les totaux sont donc DÉRIVÉS de
 * la liste des sources, jamais recopiés.
 *
 * **Positionnement, à conserver en tête avant d'y toucher** : le concurrent
 * de référence affiche « 197 critères, 11 catégories ». Se lancer dans une
 * course au nombre serait perdu d'avance et surtout invérifiable pour le
 * visiteur. L'argument tenu ici est celui qu'on peut prouver ligne à ligne :
 * des sources publiques nommées avec leur millésime, une méthode reproductible,
 * et aucune donnée inventée quand la source est muette. Ne pas remplacer ces
 * formulations par un décompte gonflé d'« indicateurs ».
 */

export interface SourceDonnees {
  /** Ce que la source alimente sur le site. */
  domaine: string;
  /** Intitulé officiel du jeu de données. */
  source: string;
  /** Millésime ou fréquence de publication. */
  millesime: string;
  /** `true` si la source entre dans le calcul de la note globale. */
  entreDansLaNote: boolean;
}

export const SOURCES: readonly SourceDonnees[] = [
  {
    domaine: 'Périmètre des communes, population',
    source: 'API Géo (geo.api.gouv.fr)',
    millesime: 'à jour',
    entreDansLaNote: false,
  },
  {
    domaine: 'Santé, commerces, enseignement, sports, culture, transports',
    source: 'Base permanente des équipements (BPE, INSEE)',
    millesime: '2018',
    entreDansLaNote: true,
  },
  {
    domaine: 'Sécurité',
    source: 'Bases statistiques de la délinquance (SSMSI, ministère de l’Intérieur)',
    millesime: '2025',
    entreDansLaNote: true,
  },
  {
    domaine: 'Niveau de vie',
    source: 'Revenus localisés (Filosofi, INSEE)',
    millesime: '2021',
    entreDansLaNote: true,
  },
  {
    domaine: 'Prix immobilier au m² (maisons et appartements)',
    source: 'Statistiques DVF — valeurs foncières (DGFiP, data.gouv.fr)',
    millesime: 'semestriel',
    entreDansLaNote: false,
  },
  {
    domaine: 'Âges, sexe, catégories socioprofessionnelles',
    source: 'Évolution et structure de la population (recensement, INSEE)',
    millesime: '2022',
    entreDansLaNote: false,
  },
  {
    domaine: 'Coordonnées de la mairie',
    source: 'Annuaire de l’administration (DILA, service-public.fr)',
    millesime: 'trimestriel',
    entreDansLaNote: false,
  },
];

/** Nombre de critères notés — aligné sur `CRITERES` de data.models. */
export const NB_CRITERES = 8;

/** Totaux dérivés : ajouter une source ci-dessus les met à jour partout. */
export const NB_SOURCES = SOURCES.length;
export const NB_SOURCES_NOTE = SOURCES.filter((s) => s.entreDansLaNote).length;

/**
 * Phrase de rappel affichée sur chaque fiche commune. Volontairement factuelle
 * et vérifiable — chaque terme renvoie à quelque chose que le visiteur peut
 * contrôler sur la page méthodologie.
 */
export const RAPPEL_METHODE =
  `Note calculée sur ${NB_CRITERES} critères, à partir de ${NB_SOURCES} sources publiques ` +
  `officielles (${NB_SOURCES_NOTE} entrent dans la note). Aucune estimation : ` +
  `quand une donnée n’est pas publiée, elle n’est pas inventée.`;
