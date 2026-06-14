#!/usr/bin/env node
// postinstall: copy the Draco decoder shipped with three into /public/draco so
// DRACOLoader has no runtime CDN dependency. Safe to re-run; no-op if three is
// not present yet (e.g. during a partial install).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco');
const dest = path.join(root, 'public', 'draco');

if (!fs.existsSync(src)) {
  console.warn('[copy-draco] three draco decoder not found yet; skipping.');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`[copy-draco] copied Draco decoder -> ${path.relative(root, dest)}`);
