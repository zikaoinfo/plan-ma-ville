import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { avecReprise } from './download.js';

/** Réponse brute de geo.api.gouv.fr (champs demandés dans sources.config.json). */
interface GeoCommuneRaw {
  nom: string;
  code: string;
  codesPostaux?: string[];
  codeDepartement?: string;
  population?: number;
  type?: string;
  /** GeoJSON Point du centre : coordinates = [lon, lat]. */
  centre?: { type: 'Point'; coordinates: [number, number] };
}

/** Commune nettoyée, prête pour le scoring. */
export interface CommuneSource {
  nom: string;
  codeInsee: string;
  codesPostaux: string[];
  codeDepartement: string;
  population: number;
  /** Latitude du centre (si fournie par l'API). */
  lat?: number;
  /** Longitude du centre (si fournie par l'API). */
  lon?: number;
}

/**
 * Télécharge la liste des communes (avec cache brut local dans .cache/geo.json,
 * gitignoré) puis applique les règles de nettoyage de la spec : population
 * manquante/0 → 1, codesPostaux manquants → [].
 *
 * Les arrondissements municipaux de Paris/Lyon/Marseille (`type ===
 * 'arrondissement-municipal'`, seuls concernés par ce type sur tout le
 * territoire) sont CONSERVÉS : ils sont notés individuellement au même titre
 * qu'une commune (hiérarchie Région > Département > Ville > Arrondissement,
 * cf. `fetch/insee-code.ts`), en plus de la commune mère qui garde sa note
 * agrégée.
 */
export async function fetchCommunes(url: string, cacheDir: string): Promise<CommuneSource[]> {
  const cacheFile = path.join(cacheDir, 'geo.json');

  let raw: GeoCommuneRaw[];
  if (existsSync(cacheFile)) {
    raw = JSON.parse(await readFile(cacheFile, 'utf8')) as GeoCommuneRaw[];
  } else {
    raw = await avecReprise('geo.api.gouv.fr', async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`geo.api.gouv.fr a répondu ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as GeoCommuneRaw[];
    });
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheFile, JSON.stringify(raw), 'utf8');
  }

  return raw
    .filter((c) => c.codeDepartement !== undefined)
    .map((c) => {
      const [lon, lat] = c.centre?.coordinates ?? [];
      return {
        nom: c.nom,
        codeInsee: c.code,
        codesPostaux: c.codesPostaux ?? [],
        codeDepartement: c.codeDepartement as string,
        population: c.population && c.population > 0 ? c.population : 1,
        ...(lat !== undefined && lon !== undefined
          ? { lat: round5(lat), lon: round5(lon) }
          : {}),
      };
    });
}

/** Arrondi à 5 décimales (~1 m) pour limiter la taille des JSON. */
function round5(x: number): number {
  return Math.round(x * 1e5) / 1e5;
}
