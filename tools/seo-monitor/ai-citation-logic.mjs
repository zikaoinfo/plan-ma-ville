// Logique PURE de détection de citation : décide si une réponse de moteur IA
// cite le site, et agrège les résultats. Aucune E/S — donc testable sans clé
// d'API (cf. test/ai-citation.spec.mjs).

/** Normalise un domaine pour la comparaison (sans protocole, sans www). */
export function normaliseDomaine(d) {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

/**
 * Le domaine apparaît-il dans un texte libre ? On accepte les formes
 * « planmaville.fr », « www.planmaville.fr » et « https://planmaville.fr/… »,
 * mais PAS un domaine dont le nôtre ne serait qu'un suffixe
 * (« notplanmaville.fr ») : ce serait un faux positif qui gonflerait
 * artificiellement la baseline.
 */
export function texteCite(texte, domaine) {
  if (!texte) return false;
  const d = normaliseDomaine(domaine).replace(/[.]/g, '\\.');
  // Deux garde-fous après le domaine : `(?![\w-])` écarte « planmaville.frites »,
  // et `(?!\.[a-z0-9])` écarte « planmaville.fr.example.com » — tout en laissant
  // passer un point final de phrase (« … selon planmaville.fr. »).
  return new RegExp(`(^|[^\\w.-])(www\\.)?${d}(?![\\w-])(?!\\.[a-z0-9])`, 'i').test(texte);
}

/** Une URL pointe-t-elle vers le domaine (ou un de ses sous-domaines) ? */
export function urlCite(url, domaine) {
  if (!url) return false;
  let hote;
  try {
    hote = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  const d = normaliseDomaine(domaine);
  return hote === d || hote.endsWith(`.${d}`);
}

/**
 * Analyse une réponse normalisée `{ texte, sources[] }` et dit si le site est
 * cité, et comment. La distinction compte : être une SOURCE consultée par le
 * moteur n'est pas la même chose qu'être NOMMÉ dans la réponse lue par
 * l'utilisateur — la seconde est ce qui amène du trafic et de la notoriété.
 */
export function detecteCitation(reponse, domaine) {
  const sources = (reponse.sources ?? []).filter((s) => urlCite(s.url, domaine));
  const dansTexte = texteCite(reponse.texte, domaine);
  return {
    citee: dansTexte || sources.length > 0,
    dans_texte: dansTexte,
    dans_sources: sources.length > 0,
    urls: sources.map((s) => s.url),
    nb_sources_total: (reponse.sources ?? []).length,
  };
}

/** Statistiques d'une campagne : taux de citation, texte vs sources. */
export function agregeCitations(resultats) {
  const exploitables = resultats.filter((r) => !r.erreur);
  const cites = exploitables.filter((r) => r.citee);
  return {
    villes_interrogees: resultats.length,
    villes_exploitables: exploitables.length,
    villes_en_erreur: resultats.length - exploitables.length,
    citations: cites.length,
    citations_dans_texte: exploitables.filter((r) => r.dans_texte).length,
    citations_dans_sources: exploitables.filter((r) => r.dans_sources).length,
    // Dénominateur = réponses exploitables : compter un échec d'API comme
    // « non citée » ferait chuter la baseline pour une raison technique.
    taux: exploitables.length ? cites.length / exploitables.length : 0,
  };
}

/** Résumé lisible d'une campagne (aucun appel à un modèle : que des chiffres). */
export function formateRapport(stats, resultats, date) {
  const pct = (n) => (n * 100).toFixed(1).replace('.', ',');
  const lignes = [
    `🤖 Citation IA — planmaville.fr — ${date}`,
    '',
    `Villes interrogées : ${stats.villes_interrogees}` +
      (stats.villes_en_erreur ? ` (${stats.villes_en_erreur} en erreur, exclues)` : ''),
    `Citée : ${stats.citations}/${stats.villes_exploitables} — ${pct(stats.taux)} %`,
    `  · nommée dans la réponse : ${stats.citations_dans_texte}`,
    `  · présente dans les sources consultées : ${stats.citations_dans_sources}`,
  ];
  const cites = resultats.filter((r) => r.citee);
  if (cites.length) {
    lignes.push('', 'Villes où le site est cité :');
    for (const r of cites) {
      lignes.push(`  · ${r.ville}${r.dans_texte ? ' (nommé dans la réponse)' : ' (source)'}`);
    }
  } else {
    lignes.push('', 'Aucune citation détectée — c’est la baseline de départ.');
  }
  return lignes.join('\n');
}
