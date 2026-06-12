import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Réponse brute de geo.api.gouv.fr (champs demandés dans sources.config.json). */
interface GeoCommuneRaw {
  nom: string;
  code: string;
  codesPostaux?: string[];
  codeDepartement?: string;
  population?: number;
  type?: string;
}

/** Commune nettoyée, prête pour le scoring. */
export interface CommuneSource {
  nom: string;
  codeInsee: string;
  codesPostaux: string[];
  codeDepartement: string;
  population: number;
}

/**
 * Télécharge la liste des communes (avec cache brut local dans .cache/geo.json,
 * gitignoré) puis applique les règles de nettoyage de la spec :
 * arrondissements municipaux exclus, population manquante/0 → 1,
 * codesPostaux manquants → [].
 */
export async function fetchCommunes(url: string, cacheDir: string): Promise<CommuneSource[]> {
  const cacheFile = path.join(cacheDir, 'geo.json');

  let raw: GeoCommuneRaw[];
  if (existsSync(cacheFile)) {
    raw = JSON.parse(await readFile(cacheFile, 'utf8')) as GeoCommuneRaw[];
  } else {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`geo.api.gouv.fr a répondu ${response.status} ${response.statusText}`);
    }
    raw = (await response.json()) as GeoCommuneRaw[];
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheFile, JSON.stringify(raw), 'utf8');
  }

  return raw
    .filter((c) => c.type !== 'arrondissement-municipal')
    .filter((c) => c.codeDepartement !== undefined)
    .map((c) => ({
      nom: c.nom,
      codeInsee: c.code,
      codesPostaux: c.codesPostaux ?? [],
      codeDepartement: c.codeDepartement as string,
      population: c.population && c.population > 0 ? c.population : 1,
    }));
}
