// Logique PURE du rapport hebdomadaire : deltas, texte de résumé, décision
// d'alerte. Aucune E/S ici — c'est ce qui rend le comportement testable sans
// credentials Google ni Supabase (cf. test/resume.spec.mjs).

const dec = (n, d = 1) => n.toFixed(d).replace('.', ',');
const pct = (n) => `${n >= 0 ? '+' : ''}${dec(n)} %`;
const nb = (n) => Math.round(n).toLocaleString('fr-FR');

/** Variation relative en %, `null` si la référence est absente ou nulle. */
export function variation(courant, precedent) {
  if (precedent === null || precedent === undefined || precedent === 0) return null;
  if (courant === null || courant === undefined) return null;
  return ((courant - precedent) / precedent) * 100;
}

/**
 * Deltas d'une mesure par rapport à la précédente. `null` partout s'il n'y a
 * pas de mesure précédente (première exécution) — surtout ne pas inventer un
 * point de comparaison, ce serait une fausse tendance.
 */
export function calculeDeltas(courant, precedent) {
  if (!precedent) {
    return { impressions: null, clics: null, pagesIndexees: null, tauxIndexation: null };
  }
  return {
    impressions: variation(courant.impressions, precedent.impressions),
    clics: variation(courant.clics, precedent.clics),
    pagesIndexees: variation(courant.pages_indexees_estimees, precedent.pages_indexees_estimees),
    tauxIndexation: variation(courant.taux_indexation, precedent.taux_indexation),
  };
}

/**
 * Faut-il alerter ? Oui si les pages indexées reculent de plus de `seuilPct`
 * par rapport à la mesure précédente. C'est exactement le signal qui manquait
 * début août 2026 : la perte d'indexation avait commencé trois semaines avant
 * d'être remarquée.
 *
 * Une chute d'impressions seule n'alerte PAS : elle est saisonnière et
 * bruitée, alors qu'un recul du nombre de pages indexées est structurel.
 */
export function doitAlerter(courant, precedent, seuilPct = 5) {
  const delta = calculeDeltas(courant, precedent).pagesIndexees;
  if (delta === null) return { alerte: false, raison: null };
  if (delta > -seuilPct) return { alerte: false, raison: null };
  return {
    alerte: true,
    raison:
      `Pages indexées en recul de ${dec(Math.abs(delta))} % ` +
      `(${nb(precedent.pages_indexees_estimees)} → ${nb(courant.pages_indexees_estimees)}) ` +
      `entre le ${precedent.date} et le ${courant.date}.`,
  };
}

const ligne = (libelle, valeur, delta) =>
  `${libelle} : ${valeur}${delta === null ? '' : ` (${pct(delta)} vs mesure précédente)`}`;

/** Résumé lisible d'une mesure — texte simple, aucun appel à un modèle. */
export function formateResume(courant, precedent) {
  const d = calculeDeltas(courant, precedent);
  const lignes = [
    `📊 planmaville.fr — semaine du ${courant.periode_debut} au ${courant.periode_fin}`,
    '',
    ligne('Pages indexées (estimées)', nb(courant.pages_indexees_estimees), d.pagesIndexees),
    ligne('Taux d’indexation', `${dec(courant.taux_indexation * 100)} %`, d.tauxIndexation),
    ligne('Impressions', nb(courant.impressions), d.impressions),
    ligne('Clics', nb(courant.clics), d.clics),
    `CTR moyen : ${dec(courant.ctr * 100, 2)} % · Position moyenne : ${dec(courant.position_moyenne)}`,
  ];

  if (courant.segments?.length) {
    lignes.push('', 'Indexation par segment de sitemap :');
    for (const s of courant.segments) {
      lignes.push(
        `  · ${s.nom} — ${Math.round(s.taux * 100)} % ` +
          `(${s.indexees}/${s.echantillon} URLs échantillonnées sur ${nb(s.urls_total)})`,
      );
    }
  }

  if (courant.top_requetes?.length) {
    lignes.push('', `Top ${Math.min(courant.top_requetes.length, 20)} requêtes :`);
    for (const [i, r] of courant.top_requetes.slice(0, 20).entries()) {
      lignes.push(
        `  ${String(i + 1).padStart(2)}. ${r.requete} — ${nb(r.impressions)} impr., ` +
          `${nb(r.clics)} clic(s), pos. ${dec(r.position)}`,
      );
    }
  }

  if (!precedent) {
    lignes.push('', 'Première mesure : aucune comparaison disponible.');
  }

  const { alerte, raison } = doitAlerter(courant, precedent);
  if (alerte) lignes.push('', `🚨 ALERTE — ${raison}`);

  return lignes.join('\n');
}

/**
 * Extrapole le nombre de pages indexées à partir d'un échantillon par segment.
 * Les inspections en échec (null) sont exclues du dénominateur : les compter
 * comme non indexées produirait une fausse chute.
 */
export function agregeSegments(segments) {
  const total = segments.reduce((acc, s) => acc + s.urls_total, 0);
  const estimees = segments.reduce((acc, s) => acc + s.taux * s.urls_total, 0);
  return {
    urls_total: total,
    pages_indexees_estimees: Math.round(estimees),
    taux_indexation: total > 0 ? estimees / total : 0,
  };
}

/** Taux d'indexation d'un segment, à partir des verdicts d'inspection. */
export function tauxSegment(verdicts) {
  const exploitables = verdicts.filter((v) => v !== null);
  if (exploitables.length === 0) return { echantillon: 0, indexees: 0, taux: 0 };
  const indexees = exploitables.filter(Boolean).length;
  return {
    echantillon: exploitables.length,
    indexees,
    taux: indexees / exploitables.length,
  };
}
