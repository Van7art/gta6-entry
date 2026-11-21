// Porto Verde: Full Throttle — Golden Hour. Entry point (Node 22, stdlib only).
// Hands the game in: copies game/ and screenshots/ beside this file into the
// output directory and writes the dossier the judge reads, using the vendored
// make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const dest = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(dest, { recursive: true });
  cpSync(join(root, 'game'), join(dest, 'game'), { recursive: true });
  const shots = join(root, 'screenshots');
  if (existsSync(shots)) {
    mkdirSync(join(dest, 'screenshots'), { recursive: true });
    cpSync(shots, join(dest, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(dest, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(dest, 'dossier.json'), dossier);
  const files = readdirSync(join(dest, 'game'), { recursive: true });
  console.log(`Porto Verde handed in: ${files.length} game files, dossier ${dossier.length} bytes -> ${dest}`);
}

handIn();
