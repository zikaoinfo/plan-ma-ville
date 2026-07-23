// Lance `ng build` en plusieurs passes (« shards ») au lieu d'une seule pour
// prérendre les ~35 000 fiches commune sans saturer le tas V8 : un run CI a
// crashé en OOM (heap ~4,1 Go) après ~20 min en tentant de tout rendre dans un
// seul process `ng build` (cf. commentaire dans app.routes.server.ts). Chaque
// shard ne prérend qu'une tranche modulo des communes (PRERENDER_SHARD_INDEX/
// COUNT), avec la mémoire remise à plat entre deux `ng build` puisque ce sont
// des process distincts. Seul le premier shard prérend aussi les pages fixes
// et les petites listes paramétrées (accueil, régions, départements,
// palmarès, hubs « autour de ») ; les dossiers `browser/ville/*` de chaque
// shard sont ensuite fusionnés dans un seul dist/.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const DIST = path.join(REPO_ROOT, 'dist/ma-ville-notes');
const MERGE = path.join(REPO_ROOT, 'dist/.ma-ville-notes-merge');
const INDEX_JSON = path.join(REPO_ROOT, 'public/data/index.json');

/** Nombre de communes par shard : marge de sécurité sous le seuil connu OK
 * (~2 500 communes rendues en ~2 min sans souci mémoire avant ce changement). */
const PAGES_PAR_SHARD = 2000;

function nbCommunes() {
  if (!existsSync(INDEX_JSON)) return 0;
  try {
    return JSON.parse(readFileSync(INDEX_JSON, 'utf8')).items?.length ?? 0;
  } catch {
    return 0;
  }
}

const total = nbCommunes();
const shards = total > 0 ? Math.max(1, Math.ceil(total / PAGES_PAR_SHARD)) : 1;

console.log(`▸ Build : ${total} commune(s) → ${shards} shard(s) de prérendu`);

rmSync(MERGE, { recursive: true, force: true });

for (let i = 0; i < shards; i++) {
  console.log(`▸ Shard ${i + 1}/${shards}…`);
  rmSync(DIST, { recursive: true, force: true });
  execFileSync('npx', ['--no-install', 'ng', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PRERENDER_SHARD_INDEX: String(i),
      PRERENDER_SHARD_COUNT: String(shards),
    },
  });
  if (i === 0) {
    renameSync(DIST, MERGE);
  } else {
    cpSync(path.join(DIST, 'browser/ville'), path.join(MERGE, 'browser/ville'), {
      recursive: true,
    });
    rmSync(DIST, { recursive: true, force: true });
  }
}

rmSync(DIST, { recursive: true, force: true });
renameSync(MERGE, DIST);
console.log('▸ Shards fusionnés dans dist/ma-ville-notes/');
