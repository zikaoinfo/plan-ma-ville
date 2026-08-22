import { forEachJsonDoc, type SourceSpec } from './download.js';
import type { Mairie } from '../models.js';

/**
 * Coordonnées officielles des mairies, depuis l'annuaire de l'administration
 * (DILA / service-public.fr, « base de données locales »).
 *
 * **Parser volontairement TOLÉRANT.** Cette source est publiée en JSON
 * imbriqué dont le schéma exact n'a pas pu être inspecté (réseau open data
 * bloqué hors CI) et évolue au fil des versions du flux DILA. Plutôt que de
 * coder un chemin d'accès rigide qui casserait au premier changement, on
 * parcourt récursivement chaque document et on reconnaît une mairie à ses
 * traits : un code INSEE valide, et un marqueur de type « mairie ». Les
 * champs sont ensuite extraits par correspondance approchée de clés.
 *
 * Conséquence assumée : le parser accepte plusieurs formes plausibles (testé
 * sur trois), au prix d'une extraction moins précise qu'un mapping exact.
 * L'inventaire du job CI « Validate open data » permettra de resserrer les
 * motifs une fois la structure réelle observée.
 *
 * Cette source n'alimente AUCUNE note : son absence retire seulement un bloc
 * de la fiche.
 */
export type MairieMap = Map<string, Mairie>;

/** Code INSEE de commune : 5 caractères, avec la particularité corse 2A/2B. */
const INSEE_RE = /^(\d{5}|2[AB]\d{3})$/i;

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Première valeur chaîne trouvée sous une clé correspondant au motif. */
function chercheChaine(obj: Record<string, unknown>, motif: RegExp): string | undefined {
  for (const [k, v] of Object.entries(obj)) {
    if (!motif.test(k)) continue;
    if (typeof v === 'string' && v.trim()) return v.trim();
    // Le flux DILA enveloppe souvent les valeurs dans un tableau d'objets
    // ({ valeur: "…" }) : on descend d'un niveau plutôt que d'abandonner.
    const candidats = Array.isArray(v) ? v : [v];
    for (const c of candidats) {
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (estObjet(c)) {
        for (const vv of Object.values(c)) {
          if (typeof vv === 'string' && vv.trim()) return vv.trim();
        }
      }
    }
  }
  return undefined;
}

/** Code INSEE porté par l'objet, s'il en a un de forme valide. */
export function codeInseeDe(obj: Record<string, unknown>): string | undefined {
  for (const [k, v] of Object.entries(obj)) {
    if (!/insee|codgeo|code_?commune/i.test(k)) continue;
    const brut = typeof v === 'string' ? v : Array.isArray(v) ? v.find((x) => typeof x === 'string') : undefined;
    if (typeof brut === 'string' && INSEE_RE.test(brut.trim())) return brut.trim().toUpperCase();
  }
  return undefined;
}

/**
 * L'objet décrit-il une mairie ? On cherche le mot « mairie » dans les
 * valeurs des clés de typage (pivot, type de service, catégorie), sans
 * descendre dans tout l'objet — sinon une adresse « rue de la Mairie »
 * ferait passer n'importe quel service pour une mairie.
 */
export function estMairie(obj: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(obj)) {
    if (!/pivot|type|categorie|nature/i.test(k)) continue;
    const valeurs: unknown[] = Array.isArray(v) ? v : [v];
    for (const val of valeurs) {
      if (typeof val === 'string' && /^mairie\b/i.test(val.trim())) return true;
      if (estObjet(val)) {
        for (const vv of Object.values(val)) {
          if (typeof vv === 'string' && /^mairie\b/i.test(vv.trim())) return true;
        }
      }
    }
  }
  return false;
}

/** Adresse postale lisible, recomposée depuis la structure d'adresse. */
export function adresseLisible(obj: Record<string, unknown>): string | undefined {
  const brut = Object.entries(obj).find(([k]) => /^adresse/i.test(k))?.[1];
  const premier = Array.isArray(brut) ? brut[0] : brut;
  if (typeof premier === 'string') return premier.trim() || undefined;
  if (!estObjet(premier)) return undefined;

  const part = (motif: RegExp) => chercheChaine(premier, motif);
  const voie = part(/numero_?voie|^voie|ligne|rue/i);
  const cp = part(/code_?postal/i);
  const ville = part(/nom_?commune|^commune|ville|localite/i);
  const morceaux = [voie, [cp, ville].filter(Boolean).join(' ')].filter((x) => x && x.trim());
  return morceaux.length ? morceaux.join(', ') : undefined;
}

/** URL du site officiel, si elle est présente et bien formée. */
export function siteOfficiel(obj: Record<string, unknown>): string | undefined {
  const url = chercheChaine(obj, /site_?internet|^url$|web|internet/i);
  if (!url) return undefined;
  try {
    const u = new URL(url);
    // Seuls http(s) : le flux contient parfois des adresses mail ou des
    // valeurs libres, qu'on ne va pas publier en lien.
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parcourt récursivement un document et collecte les mairies trouvées.
 * Fonction PURE (testée dans `test/mairie.spec.ts`).
 *
 * `map` est alimentée en place : un document DILA contient des milliers
 * d'entrées, et on ne garde que l'extrait utile (cf. `forEachJsonDoc`).
 */
export function collecteMairies(doc: unknown, map: MairieMap): void {
  // Pile LIFO, mais les enfants sont empilés À L'ENVERS pour être dépilés dans
  // l'ordre du document : sinon « la première mairie rencontrée » serait en
  // fait la dernière du tableau, et le choix entre mairie centrale et mairie
  // annexe dépendrait d'un détail d'implémentation.
  const pile: unknown[] = [doc];
  const empile = (valeurs: unknown[]) => {
    for (let i = valeurs.length - 1; i >= 0; i--) pile.push(valeurs[i]);
  };
  while (pile.length) {
    const noeud = pile.pop();
    if (Array.isArray(noeud)) {
      empile(noeud);
      continue;
    }
    if (!estObjet(noeud)) continue;

    const insee = codeInseeDe(noeud);
    if (insee && estMairie(noeud) && !map.has(insee)) {
      const nom = chercheChaine(noeud, /^nom$|^libelle|intitule/i);
      const adresse = adresseLisible(noeud);
      const url = siteOfficiel(noeud);
      // Une entrée sans aucune information exploitable n'apporte rien.
      if (nom || adresse || url) {
        map.set(insee, {
          ...(nom ? { nom } : {}),
          ...(adresse ? { adresse } : {}),
          ...(url ? { url } : {}),
        });
      }
    }
    empile(Object.values(noeud));
  }
}

/** Télécharge l'annuaire et renvoie la map commune → coordonnées de mairie. */
export async function fetchMairies(spec: SourceSpec, cacheDir: string): Promise<MairieMap> {
  const map: MairieMap = new Map();
  const docs = await forEachJsonDoc('mairie', spec, cacheDir, (doc) => collecteMairies(doc, map));
  if (map.size === 0) {
    throw new Error(
      `Annuaire des mairies : ${docs} document(s) lus, aucune mairie reconnue — la structure du flux a probablement changé (cf. fetch/mairie.ts).`,
    );
  }
  return map;
}
