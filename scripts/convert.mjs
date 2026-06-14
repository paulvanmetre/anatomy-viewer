#!/usr/bin/env node
// Node fallback conversion path (use when Blender is not available):
//   STL(s) -> merge -> decimate (SimplifyModifier) -> GLB -> Draco (gltf-pipeline).
//
// Usage:
//   node scripts/convert.mjs <input.stl[,input2.stl,...]> <output.glb> [ratio] [scale] [rotXdeg] [colorHex]
//   node scripts/convert.mjs in.stl public/models/humerus_right.glb 1 0.001 -90
//   # merge multiple parts (e.g. the heads of a muscle) into one GLB:
//   node scripts/convert.mjs a.stl,b.stl public/models/biceps_brachii_right.glb 0.45 0.001 -90 c0473b
//
// The Blender path (scripts/convert-blender.py) is the primary, most reliable
// route and is what the README documents first. This script exists so the
// pipeline is runnable on a machine without Blender.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import gltfPipeline from 'gltf-pipeline';

// three's GLTFExporter is browser-oriented and uses FileReader/Blob to emit the
// binary buffer. Node has global Blob but not FileReader — provide a minimal
// polyfill backed by Blob.arrayBuffer() so GLB export works headless.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.();
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = `data:${blob.type || ''};base64,${Buffer.from(buf).toString('base64')}`;
        this.onloadend?.();
      });
    }
  };
}

const [, , input, output, ratioArg, scaleArg, rotXArg, colorArg] = process.argv;
if (!input || !output) {
  console.error(
    'Usage: node scripts/convert.mjs <input.stl[,input2,...]> <output.glb> [ratio] [scale] [rotXdeg] [colorHex]',
  );
  process.exit(1);
}
const ratio = ratioArg ? Number(ratioArg) : 0.3;
const scale = scaleArg ? Number(scaleArg) : 0.001;
// BodyParts3D is Z-up (mm). Bake a -90° X rotation so the model is Y-up for
// three.js. Keep this identical across all structures (and do NOT recenter) so
// the shared coordinate frame is preserved and everything assembles correctly.
const rotXdeg = rotXArg ? Number(rotXArg) : 0;
const color = colorArg ? parseInt(colorArg.replace('#', ''), 16) : 0xe9e1d1;

// 1) Load each input STL, transform consistently, and merge into one geometry.
// (BodyParts3D splits some structures — e.g. muscle heads — into separate files.)
const inputs = input.split(',').map((s) => s.trim()).filter(Boolean);
const parts = inputs.map((file) => {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const g = new STLLoader().parse(ab);
  if (rotXdeg) g.rotateX((rotXdeg * Math.PI) / 180);
  g.scale(scale, scale, scale);
  // Keep only position so all parts share identical attributes before merge.
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  return g;
});
let geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
if (!geometry) {
  console.error('mergeGeometries failed — inputs have mismatched attributes.');
  process.exit(1);
}
geometry.computeVertexNormals();

// 2) Decimate to the target triangle budget.
const before = geometry.attributes.position.count;
const removeCount = Math.max(0, Math.floor(before * (1 - ratio)));
if (removeCount > 0) {
  geometry = new SimplifyModifier().modify(geometry, removeCount);
  geometry.computeVertexNormals();
}
const after = geometry.attributes.position.count;
console.log(`Vertices: ${before} -> ${after} (ratio ${ratio})`);
geometry.computeBoundingBox();
const bb = geometry.boundingBox;
const f = (n) => n.toFixed(3);
console.log(
  `bbox min [${f(bb.min.x)}, ${f(bb.min.y)}, ${f(bb.min.z)}] max [${f(bb.max.x)}, ${f(bb.max.y)}, ${f(bb.max.z)}]`,
);

// 3) Export to GLB (uncompressed) via three.
const mesh = new THREE.Mesh(
  geometry,
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 }),
);
const scene = new THREE.Scene();
scene.add(mesh);

const glb = await new Promise((resolve, reject) => {
  new GLTFExporter().parse(
    scene,
    (result) => resolve(Buffer.from(result)),
    (err) => reject(err),
    { binary: true },
  );
});

// 4) Draco-compress with gltf-pipeline.
const { processGlb } = gltfPipeline;
const { glb: compressed } = await processGlb(glb, {
  dracoOptions: { compressionLevel: 7 },
});

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, compressed);
console.log(`Wrote ${output} (${(compressed.length / 1024).toFixed(0)} KB, Draco)`);
