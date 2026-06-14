#!/usr/bin/env node
// CLI: validate all structure JSON against the schema and report renderability.
// Usage:  node scripts/validate-manifest.mjs [--strict]
// --strict additionally fails if any real GLB is missing (use once the
// conversion pipeline has produced the models; v0 allows placeholders).
import { validateAll } from './lib/validate.mjs';

const strict = process.argv.includes('--strict');
const { schemaErrors, structures } = validateAll();

console.log(`Validated ${structures.length} structure(s).`);
for (const s of structures) {
  const tag = s.exists ? 'GLB' : s.hasPlaceholder ? 'placeholder' : 'MISSING';
  console.log(`  ${s.renderable ? '✓' : '✗'} ${s.id.padEnd(18)} ${s.modelFile}  [${tag}]`);
}

let failed = false;

if (schemaErrors.length) {
  failed = true;
  console.error('\nSchema errors:');
  for (const e of schemaErrors) {
    console.error(`  ${e.file}`);
    e.errors.forEach((msg) => console.error(`     - ${msg}`));
  }
}

const notRenderable = structures.filter((s) => !s.renderable);
if (notRenderable.length) {
  failed = true;
  console.error('\nNot renderable (no GLB and no placeholder):');
  notRenderable.forEach((s) => console.error(`  - ${s.id}`));
}

if (strict) {
  const missing = structures.filter((s) => !s.exists);
  if (missing.length) {
    failed = true;
    console.error('\n--strict: missing GLB files:');
    missing.forEach((s) => console.error(`  - ${s.modelFile}`));
  }
}

if (failed) {
  console.error('\nVALIDATION FAILED');
  process.exit(1);
}
console.log('\nOK');
