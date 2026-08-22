import { execSync } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ClassementEntry,
  ClassementFile,
  CommuneDetail,
  DepartementDetailFile,
  DepartementsFile,
  GeoLightFile,
  RegionsFile,
  SearchIndexFile,
  SearchIndexItem,
} from '../models.js';
import { DEPARTEMENTS } from './departements.js';
import { aggregateRegions, type DepAggregat } from './regions.js';
import { calculeClassements } from '../score/classements.js';

/** Commune scorée, prête à être émise. */
export interface CommuneScoree extends CommuneDetail {
  codeDepartement: string;
}

/** Normalisation spec §3.4 : minuscules, sans accents, '/- → espace. */
export function normaliseNom(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug = nom normalisé en kebab-case + code INSEE : "saint-denis-93066". */
export function slugify(nom: string, codeInsee: string): string {
  return `${normaliseNom(nom).replace(/ /g, '-')}-${codeInsee}`;
}

export interface EmitResult {
  nbCommunes: number;
  nbDepartements: number;
  nbRegions: number;
  indexGzipBytes: number;
  top3: ClassementEntry[];
  flop3: ClassementEntry[];
}

/** Tri déterministe : nn croissant, départagé par code INSEE. */
function parNn(a: { nn: string; i: string }, b: { nn: string; i: string }): number {
  return a.nn < b.nn ? -1 : a.nn > b.nn ? 1 : a.i < b.i ? -1 : 1;
}

export interface PagesSitemap {
  codes: string[];
  regionCodes: string[];
  /** Communes prérendues : slug + population (segmentation par taille). */
  villes: { slug: string; population: number }[];
  autourSlugs: string[];
}

/** Une URL du sitemap, avec ses indications de priorité de crawl. */
export interface UrlSitemap {
  loc: string;
  priority: string;
  changefreq: 'weekly' | 'monthly';
}

/** Un fichier de sitemap : son nom et les URLs qu'il contient. */
export interface SegmentSitemap {
  fichier: string;
  urls: UrlSitemap[];
}

/**
 * Seuils de segmentation (population). Alignés sur le plan de croissance :
 * les grandes villes concentrent le potentiel de recherche, les petites
 * communes forment la longue traîne.
 */
const POP_GRANDE_VILLE = 20000;
const POP_VILLE_MOYENNE = 2000;

/**
 * Plafond d'URLs par fichier. La limite du protocole est 50 000 ; on garde de
 * la marge et on scinde automatiquement (`-2`, `-3`…) plutôt que d'émettre un
 * fichier invalide le jour où un segment grossit.
 */
const MAX_URLS_PAR_FICHIER = 45000;

const slash = (p: string): string => (p.endsWith('/') ? p : `${p}/`);

/**
 * Segmentation du sitemap (plan de croissance §4).
 *
 * `sitemap.xml` reste le point d'entrée mais devient un **index** : c'est
 * l'URL déjà déclarée dans `robots.txt` et déjà soumise en Search Console, la
 * transformer en index évite d'invalider les deux. Il pointe vers des
 * sous-sitemaps par nature de page et par taille de commune, ce qui permet de
 * suivre le **taux d'indexation segment par segment** dans la Search Console
 * (chaque sous-sitemap y est soumis séparément) — c'est le vrai bénéfice :
 * savoir si ce sont les 28 000 petites communes qui ne s'indexent pas, ou tout
 * le site indistinctement.
 *
 * `<priority>` et `<changefreq>` sont émis parce que le plan les demande et
 * que Bing/Yandex les lisent encore, mais **Google les ignore explicitement** :
 * n'en attendre aucun effet côté Google, le signal utile est la segmentation.
 *
 * SLASH FINAL sur toutes les URLs : le prerender écrit un dossier par route
 * (`ville/{slug}/index.html`) et GitHub Pages ne sert ce fichier en 200 qu'à
 * l'URL avec slash — la forme sans slash répond 301 (cf.
 * `src/app/core/url/slash-final.ts` et `docs/SEO-INDEXATION.md`).
 *
 * Fonction PURE (testée dans `test/sitemap.spec.ts`).
 */
export function segmentsSitemap(base: string, pages: PagesSitemap): SegmentSitemap[] {
  const root = base.replace(/\/$/, '');
  const { codes, regionCodes, villes, autourSlugs } = pages;
  const url = (
    chemin: string,
    priority: string,
    changefreq: 'weekly' | 'monthly',
  ): UrlSitemap => ({ loc: `${root}${slash(chemin)}`, priority, changefreq });

  // Pages éditoriales + niveaux géographiques : peu nombreuses, fortement
  // liées, elles doivent être crawlées en priorité (elles distribuent le
  // maillage vers tout le reste).
  const pagesFixes: UrlSitemap[] = [
    url('/', '1.0', 'weekly'),
    url('/classement', '0.9', 'weekly'),
    url('/regions', '0.8', 'weekly'),
    url('/methodologie', '0.5', 'monthly'),
    ...regionCodes.map((c) => url(`/region/${c}`, '0.8', 'weekly')),
    ...codes.map((c) => url(`/departement/${c}`, '0.8', 'weekly')),
  ];

  const hubs: UrlSitemap[] = [
    ...codes.map((c) => url(`/palmares/securite/${c}`, '0.7', 'monthly')),
    ...codes.map((c) => url(`/palmares/prix/${c}`, '0.7', 'monthly')),
    ...autourSlugs.map((s) => url(`/palmares/autour/${s}`, '0.7', 'monthly')),
  ];

  const villeUrl = (
    v: { slug: string },
    priority: string,
    changefreq: 'weekly' | 'monthly',
  ): UrlSitemap => url(`/ville/${v.slug}`, priority, changefreq);

  const grandes = villes
    .filter((v) => v.population >= POP_GRANDE_VILLE)
    .map((v) => villeUrl(v, '0.9', 'weekly'));
  const moyennes = villes
    .filter((v) => v.population >= POP_VILLE_MOYENNE && v.population < POP_GRANDE_VILLE)
    .map((v) => villeUrl(v, '0.6', 'monthly'));
  const petites = villes
    .filter((v) => v.population < POP_VILLE_MOYENNE)
    .map((v) => villeUrl(v, '0.3', 'monthly'));

  const bruts: { nom: string; urls: UrlSitemap[] }[] = [
    { nom: 'sitemap-pages', urls: pagesFixes },
    { nom: 'sitemap-grandes-villes', urls: grandes },
    { nom: 'sitemap-villes-moyennes', urls: moyennes },
    { nom: 'sitemap-communes', urls: petites },
    { nom: 'sitemap-hubs', urls: hubs },
  ];

  // Scinde les segments trop gros ; ignore les segments vides (un sitemap sans
  // URL est invalide).
  const segments: SegmentSitemap[] = [];
  for (const { nom, urls } of bruts) {
    if (urls.length === 0) continue;
    const nbFichiers = Math.ceil(urls.length / MAX_URLS_PAR_FICHIER);
    for (let i = 0; i < nbFichiers; i++) {
      segments.push({
        fichier: nbFichiers === 1 ? `${nom}.xml` : `${nom}-${i + 1}.xml`,
        urls: urls.slice(i * MAX_URLS_PAR_FICHIER, (i + 1) * MAX_URLS_PAR_FICHIER),
      });
    }
  }
  return segments;
}

/** Toutes les URLs de pages du sitemap, tous segments confondus. */
export function urlsSitemap(base: string, pages: PagesSitemap): string[] {
  return segmentsSitemap(base, pages).flatMap((s) => s.urls.map((u) => u.loc));
}

const echappe = (s: string): string => s.replace(/&/g, '&amp;');

export function xmlUrlset(urls: readonly UrlSitemap[], gen: string): string {
  const corps = urls
    .map(
      (u) =>
        `  <url><loc>${echappe(u.loc)}</loc><lastmod>${gen}</lastmod>` +
        `<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${corps}\n</urlset>\n`;
}

export function xmlSitemapIndex(base: string, fichiers: readonly string[], gen: string): string {
  const root = base.replace(/\/$/, '');
  const corps = fichiers
    .map((f) => `  <sitemap><loc>${root}/${f}</loc><lastmod>${gen}</lastmod></sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${corps}\n</sitemapindex>\n`;
}

/**
 * Écrit `sitemap.xml` (index) et un fichier par segment, à la racine publique.
 * Les anciens segments d'un run précédent sont supprimés : sans ça, un
 * `sitemap-communes-2.xml` devenu inutile resterait servi et référencerait des
 * URLs que l'index ne déclare plus.
 */
async function emitSitemap(
  racinePublique: string,
  base: string,
  pages: PagesSitemap,
  gen: string,
): Promise<string[]> {
  for (const f of await readdir(racinePublique)) {
    if (/^sitemap-.*\.xml$/.test(f)) await rm(path.join(racinePublique, f), { force: true });
  }

  const segments = segmentsSitemap(base, pages);
  for (const segment of segments) {
    await writeFile(
      path.join(racinePublique, segment.fichier),
      xmlUrlset(segment.urls, gen),
      'utf8',
    );
  }
  await writeFile(
    path.join(racinePublique, 'sitemap.xml'),
    xmlSitemapIndex(base, segments.map((s) => s.fichier), gen),
    'utf8',
  );
  return segments.map((s) => s.fichier);
}

export async function emitAll(
  communes: CommuneScoree[],
  options: {
    outDir: string;
    gen: string;
    populationMin: number;
    /** Seuil de population des pages communes prérendues → sitemap. */
    sitemapVillesMinPop: number;
    /** Seuil de population des hubs « autour de {ville} » → sitemap. */
    hubAutourMinPop: number;
    siteBaseUrl: string;
  },
): Promise<EmitResult> {
  const { outDir, gen, populationMin, sitemapVillesMinPop, hubAutourMinPop, siteBaseUrl } =
    options;

  // Repart d'un répertoire propre pour éviter les fichiers dep/ orphelins
  // d'un run précédent (le README est préservé : il vit dans outDir et
  // seul dep/ + les 4 fichiers json racine sont régénérés).
  await rm(path.join(outDir, 'dep'), { recursive: true, force: true });
  await mkdir(path.join(outDir, 'dep'), { recursive: true });

  // ── Classements national / département / strate ──
  // Calculés UNE fois ici sur l'ensemble des communes, puis embarqués dans
  // dep/{code}.json : l'application ne les recalcule pas (cf. le commentaire
  // d'en-tête de score/classements.ts).
  const classements = calculeClassements(communes);

  // ── index.json ────────────────────────────
  const items: SearchIndexItem[] = communes
    .map((c) => ({
      n: c.nom,
      nn: normaliseNom(c.nom),
      cp: c.codesPostaux,
      d: c.codeDepartement,
      s: c.slug,
      i: c.codeInsee,
      p: c.population,
      g: c.score.global,
    }))
    .sort(parNn);

  const indexFile: SearchIndexFile = { v: 1, gen, items };
  const indexPath = path.join(outDir, 'index.json');
  await writeFile(indexPath, JSON.stringify(indexFile), 'utf8');

  // ── dep/{code}.json ───────────────────────
  const parDepartement = new Map<string, CommuneScoree[]>();
  for (const commune of communes) {
    const liste = parDepartement.get(commune.codeDepartement) ?? [];
    liste.push(commune);
    parDepartement.set(commune.codeDepartement, liste);
  }

  const codes = [...parDepartement.keys()].sort();
  for (const code of codes) {
    const liste = (parDepartement.get(code) as CommuneScoree[])
      .slice()
      .sort((a, b) => parNn({ nn: normaliseNom(a.nom), i: a.codeInsee }, { nn: normaliseNom(b.nom), i: b.codeInsee }));
    const fichier: DepartementDetailFile = {
      v: 1,
      gen,
      code,
      nom: DEPARTEMENTS[code],
      communes: liste.map((c) => ({
        slug: c.slug,
        nom: c.nom,
        codeInsee: c.codeInsee,
        codesPostaux: c.codesPostaux,
        population: c.population,
        ...(c.lat !== undefined && c.lon !== undefined ? { lat: c.lat, lon: c.lon } : {}),
        ...(c.prix ? { prix: c.prix } : {}),
        ...(c.demographie ? { demographie: c.demographie } : {}),
        ...(c.estArrondissement ? { estArrondissement: true } : {}),
        ...(c.communeMere ? { communeMere: c.communeMere } : {}),
        ...(c.arrondissements ? { arrondissements: c.arrondissements } : {}),
        ...(classements.has(c.codeInsee)
          ? { classements: classements.get(c.codeInsee) }
          : {}),
        score: c.score,
      })),
    };
    await writeFile(path.join(outDir, 'dep', `${code}.json`), JSON.stringify(fichier), 'utf8');
  }

  // ── departements.json ─────────────────────
  // Agrégats (population, nbCommunes, noteMoyenne) calculés sur les COMMUNES
  // RÉELLES uniquement : les arrondissements de Paris/Lyon/Marseille sont une
  // subdivision de leur commune mère, pas des habitants supplémentaires — les
  // compter aussi doublerait la population de ces départements.
  const parDepartementReel = new Map<string, CommuneScoree[]>();
  for (const commune of communes) {
    if (commune.estArrondissement) continue;
    const liste = parDepartementReel.get(commune.codeDepartement) ?? [];
    liste.push(commune);
    parDepartementReel.set(commune.codeDepartement, liste);
  }

  // On conserve les totaux non arrondis (popTotale, Σ note×pop) pour repondérer
  // proprement au niveau région ensuite.
  const depAggregats: DepAggregat[] = codes.map((code) => {
    const liste = parDepartementReel.get(code) ?? [];
    const popTotale = liste.reduce((acc, c) => acc + c.population, 0);
    const sommeNotePonderee = liste.reduce((acc, c) => acc + c.score.global * c.population, 0);
    return {
      summary: {
        code,
        nom: DEPARTEMENTS[code],
        nbCommunes: liste.length,
        noteMoyenne: popTotale > 0 ? Math.round((sommeNotePonderee / popTotale) * 10) / 10 : 0,
      },
      popTotale,
      sommeNotePonderee,
    };
  });

  const departementsFile: DepartementsFile = {
    v: 1,
    gen,
    items: depAggregats.map((d) => d.summary),
  };
  await writeFile(
    path.join(outDir, 'departements.json'),
    JSON.stringify(departementsFile),
    'utf8',
  );

  // ── regions.json (classement régional → départements) ──
  const regionsFile: RegionsFile = { v: 1, gen, items: aggregateRegions(depAggregats) };
  await writeFile(path.join(outDir, 'regions.json'), JSON.stringify(regionsFile), 'utf8');

  // ── classement.json ───────────────────────
  const eligibles: ClassementEntry[] = communes
    .filter((c) => c.population >= populationMin)
    .map((c) => ({
      slug: c.slug,
      nom: c.nom,
      departement: c.codeDepartement,
      population: c.population,
      global: c.score.global,
      criteres: c.score.criteres,
    }));

  const desc = eligibles
    .slice()
    .sort((a, b) => b.global - a.global || (a.slug < b.slug ? -1 : 1));
  const asc = eligibles
    .slice()
    .sort((a, b) => a.global - b.global || (a.slug < b.slug ? -1 : 1));

  const classementFile: ClassementFile = {
    v: 1,
    gen,
    populationMin,
    top: desc.slice(0, 50),
    flop: asc.slice(0, 50),
  };
  await writeFile(path.join(outDir, 'classement.json'), JSON.stringify(classementFile), 'utf8');

  // ── geo-light.json — points carte (communes ≥ 500 hab avec coordonnées) ──
  const GEO_LIGHT_POP_MIN = 500;
  const geoLight: GeoLightFile = {
    v: 1,
    gen,
    items: communes
      .filter((c) => c.population >= GEO_LIGHT_POP_MIN && c.lat !== undefined && c.lon !== undefined)
      .map((c) => ({
        i: c.codeInsee,
        n: c.nom,
        s: c.slug,
        lat: c.lat as number,
        lng: c.lon as number,
        g: c.score.global,
        p: c.population,
      })),
  };
  await writeFile(path.join(outDir, 'geo-light.json'), JSON.stringify(geoLight), 'utf8');

  // ── sitemap.xml (à la racine publique, pas dans data/) ──
  // Index + sous-sitemaps segmentés par nature de page et taille de commune
  // (cf. segmentsSitemap). Toutes les URLs portent un slash final.
  const fichiersSitemap = await emitSitemap(
    path.join(outDir, '..'),
    siteBaseUrl,
    {
      codes,
      regionCodes: regionsFile.items.map((r) => r.code),
      villes: communes
        .filter((c) => c.population >= sitemapVillesMinPop)
        .map((c) => ({ slug: c.slug, population: c.population })),
      autourSlugs: communes.filter((c) => c.population >= hubAutourMinPop).map((c) => c.slug),
    },
    gen,
  );
  console.log(`  · sitemap : index + ${fichiersSitemap.length} segment(s) — ${fichiersSitemap.join(', ')}`);

  const indexGzipBytes = Number(
    execSync(`gzip -c ${JSON.stringify(indexPath)} | wc -c`).toString().trim(),
  );

  return {
    nbCommunes: communes.length,
    nbDepartements: codes.length,
    nbRegions: regionsFile.items.length,
    indexGzipBytes,
    top3: classementFile.top.slice(0, 3),
    flop3: classementFile.flop.slice(0, 3),
  };
}
