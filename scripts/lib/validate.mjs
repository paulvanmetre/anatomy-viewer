// Shared validation logic used by both the CLI (scripts/validate-manifest.mjs)
// and the vitest suite (tests/manifest.test.ts). Validates every structure JSON
// against data/schema.json and reports whether each structure is renderable
// (real GLB present, or a placeholder hint defined for v0).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

export function validateAll() {
  const schema = readJson('data/schema.json');
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);

  const schemaErrors = [];
  const structures = [];

  const { systems } = readJson('data/systems.json');
  for (const sys of systems) {
    if (!sys.enabled || !sys.manifest) continue;
    const manifestDir = path.dirname(sys.manifest);
    const manifest = readJson(path.join('data', sys.manifest));

    for (const region of manifest.regions) {
      for (const ref of region.structures) {
        const rel = path.join('data', manifestDir, ref);
        const struct = readJson(rel);

        if (!validate(struct)) {
          schemaErrors.push({
            file: rel,
            errors: (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`),
          });
        }

        const modelPath = path.join(ROOT, 'public', struct.modelFile);
        const exists = fs.existsSync(modelPath);
        structures.push({
          id: struct.id,
          file: rel,
          modelFile: struct.modelFile,
          exists,
          hasPlaceholder: Boolean(struct.placeholder),
          renderable: exists || Boolean(struct.placeholder),
        });
      }
    }
  }

  return { schemaErrors, structures };
}
