// Logique pure (aucune API Cloudflare) : construction des balises meta d'une
// fiche commune, réutilisée par la Pages Function `functions/ville/[slug].js`.
// Reproduit EXACTEMENT title/description de
// `src/app/features/commune/commune.ts` (MetaService.setPage) pour que la
// preview servie à un crawler (Facebook/WhatsApp/Google, qui n'exécutent pas
// le JS) corresponde à ce que l'app affiche une fois hydratée côté client.

const SITE = 'ma ville, notée';

/** Trouve l'entrée `index.json` d'un slug (déjà chargé en mémoire par l'appelant). */
export function findIndexItem(index, slug) {
  return index.items.find((it) => it.s === slug) ?? null;
}

/** Trouve le détail complet (notes par critère) d'une commune dans son fichier département. */
export function findCommuneDetail(depFile, slug) {
  return depFile.communes.find((c) => c.slug === slug) ?? null;
}

/** Meta d'une commune résolue — même contenu que l'état "ok" de `commune.ts`. */
export function buildCommuneMeta(item, detail) {
  const cr = detail.score.criteres;
  const global = detail.score.global.toFixed(1);
  return {
    title: `${detail.nom} (${item.d}) — note ${global}/10 — ${SITE}`,
    description:
      `${detail.nom} : note globale ${global}/10. ` +
      `Sécurité ${cr.securite}, santé ${cr.sante}, transports ${cr.transports}, ` +
      `niveau de vie ${cr.niveauVie}.`,
    canonicalPath: `/ville/${detail.slug}`,
    noindex: false,
  };
}

/** Meta pour un slug absent de l'index — même contenu que l'état "not-found" de `commune.ts` : jamais indexé. */
export function notFoundMeta(slug) {
  return {
    title: `Commune introuvable — ${SITE}`,
    description: "Cette commune n'existe pas dans notre base.",
    canonicalPath: `/ville/${slug}`,
    noindex: true,
  };
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Injecte title/description/OG/canonique dans le shell CSR statique
 * (`index.csr.html`, déjà utilisé par le fallback GitHub Pages) : remplace
 * le `<title>`/`<meta description>` déjà présents (substitution unique, sûre)
 * et INSÈRE le bloc OpenGraph/Twitter/canonique avant `</head>` — absent du
 * shell brut, ces balises ne sont posées côté client par `MetaService`
 * qu'après hydratation, donc invisibles à un crawler qui n'exécute pas le JS.
 */
export function injectMeta(html, meta, baseUrl) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = `${baseUrl}${meta.canonicalPath}`;
  const ogImage = `${baseUrl}/og-image.png`;

  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${description}">`,
    );

  const robots = meta.noindex ? '\n  <meta name="robots" content="noindex">' : '';
  const block =
    `  <link rel="canonical" href="${url}">\n` +
    `  <meta property="og:type" content="website">\n` +
    `  <meta property="og:site_name" content="${SITE}">\n` +
    `  <meta property="og:locale" content="fr_FR">\n` +
    `  <meta property="og:title" content="${title}">\n` +
    `  <meta property="og:description" content="${description}">\n` +
    `  <meta property="og:url" content="${url}">\n` +
    `  <meta property="og:image" content="${ogImage}">\n` +
    `  <meta property="og:image:width" content="1200">\n` +
    `  <meta property="og:image:height" content="630">\n` +
    `  <meta name="twitter:card" content="summary_large_image">\n` +
    `  <meta name="twitter:title" content="${title}">\n` +
    `  <meta name="twitter:description" content="${description}">\n` +
    `  <meta name="twitter:image" content="${ogImage}">${robots}\n`;

  return out.replace('</head>', `${block}</head>`);
}
