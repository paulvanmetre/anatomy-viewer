#!/usr/bin/env node
// Download a single BodyParts3D STL by its FMA id from the GitHub mirror.
//
// Usage:
//   node scripts/fetch-bodyparts3d.mjs <FMAID> [outName]
//   node scripts/fetch-bodyparts3d.mjs 13303 humerus_right
//
// Source: Kevin-Mattheus-Moerman/BodyParts3D (clone of BodyParts3D/Anatomography).
// License of the content: CC Attribution-Share Alike 2.1 Japan.
//
// NOTE: if you get a 404, open the repo in a browser and confirm the branch
// ('main' vs 'master') and the STL folder name, then override with BP3D_BASE:
//   BP3D_BASE=https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<dir> node scripts/fetch-bodyparts3d.mjs 13303
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(here, '.cache');

const BASE =
  process.env.BP3D_BASE ||
  'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl';

const [, , rawId, outName] = process.argv;
if (!rawId) {
  console.error('Usage: node scripts/fetch-bodyparts3d.mjs <FMAID> [outName]');
  process.exit(1);
}

const fmaNum = String(rawId).replace(/[^0-9]/g, '');
const fileName = `FMA${fmaNum}.stl`;
const url = `${BASE}/${fileName}`;
const out = path.join(cacheDir, `${outName || `FMA${fmaNum}`}.stl`);

fs.mkdirSync(cacheDir, { recursive: true });

console.log(`Fetching ${url}`);
const res = await fetch(url);
if (!res.ok) {
  console.error(`HTTP ${res.status} for ${url}`);
  console.error('Confirm the FMA id and the mirror path (see BP3D_BASE note in this script).');
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(out, buf);
console.log(`Saved ${out} (${(buf.length / 1024).toFixed(0)} KB)`);
console.log(`Next: convert it ->  node scripts/convert.mjs "${out}" public/models/${outName || `FMA${fmaNum}`}.glb`);
