import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain ESM helper shared with the CLI, no .d.ts needed
import { validateAll } from '../scripts/lib/validate.mjs';

const result = validateAll();

describe('data manifest', () => {
  it('loads at least the upper-limb structures', () => {
    expect(result.structures.length).toBeGreaterThanOrEqual(5);
  });

  it('every structure validates against data/schema.json', () => {
    expect(result.schemaErrors).toEqual([]);
  });

  it('every modelFile path is well-formed (models/*.glb)', () => {
    for (const s of result.structures) {
      expect(s.modelFile).toMatch(/^models\/.+\.glb$/);
    }
  });

  it('every structure is renderable (real GLB present, or a placeholder for v0)', () => {
    const notRenderable = result.structures.filter((s: { renderable: boolean }) => !s.renderable);
    expect(notRenderable).toEqual([]);
  });
});
