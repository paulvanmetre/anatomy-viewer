#!/usr/bin/env node
// Generate SCHEMATIC vessel models for the upper limb. The BodyParts3D dataset
// has no arm vessels (only great/central vessels), so these are procedurally
// routed tubes following each vessel's anatomical course, anchored to the real
// bone coordinate frame (metres, Y-up, lateral = more negative X). They are
// approximations, clearly flagged as "schematic" in the app — not scanned data.
//
//   node scripts/gen-vessels.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import gltfPipeline from 'gltf-pipeline';

// GLTFExporter needs FileReader (browser API) — minimal Node polyfill.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((b) => {
        this.result = `data:${blob.type || ''};base64,${Buffer.from(b).toString('base64')}`;
        this.onloadend?.();
      });
    }
  };
}

const ARTERY = 0xc0392b;
const VEIN = 0x2e5fa3;

// Waypoints in the shared BodyParts3D frame: shoulder ~y1.35 down to wrist ~y0.82.
const vessels = [
  {
    id: 'brachial_artery_right', color: ARTERY, radius: 0.005,
    points: [[-0.155, 1.36, 0.085], [-0.160, 1.25, 0.095], [-0.166, 1.12, 0.106], [-0.170, 1.04, 0.115]],
  },
  {
    id: 'radial_artery_right', color: ARTERY, radius: 0.0042,
    points: [[-0.173, 1.03, 0.115], [-0.205, 0.95, 0.110], [-0.235, 0.88, 0.104], [-0.255, 0.83, 0.100]],
  },
  {
    id: 'ulnar_artery_right', color: ARTERY, radius: 0.0042,
    points: [[-0.168, 1.03, 0.112], [-0.180, 0.95, 0.100], [-0.192, 0.87, 0.092], [-0.200, 0.82, 0.088]],
  },
  {
    id: 'cephalic_vein_right', color: VEIN, radius: 0.0052,
    points: [[-0.255, 0.86, 0.120], [-0.245, 1.00, 0.131], [-0.230, 1.15, 0.141], [-0.205, 1.30, 0.150]],
  },
  {
    id: 'basilic_vein_right', color: VEIN, radius: 0.0052,
    points: [[-0.198, 0.85, 0.116], [-0.180, 0.98, 0.121], [-0.162, 1.12, 0.126], [-0.150, 1.22, 0.130]],
  },
];

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');
fs.mkdirSync(outDir, { recursive: true });

for (const v of vessels) {
  const curve = new THREE.CatmullRomCurve3(v.points.map((p) => new THREE.Vector3(...p)));
  const geometry = new THREE.TubeGeometry(curve, 64, v.radius, 12, false);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: v.color, roughness: 0.55, metalness: 0 }),
  );
  const scene = new THREE.Scene();
  scene.add(mesh);

  const glb = await new Promise((resolve, reject) => {
    new GLTFExporter().parse(scene, (r) => resolve(Buffer.from(r)), (e) => reject(e), { binary: true });
  });
  const { glb: compressed } = await gltfPipeline.processGlb(glb, { dracoOptions: { compressionLevel: 7 } });
  const out = path.join(outDir, `${v.id}.glb`);
  fs.writeFileSync(out, compressed);
  console.log(`Wrote ${path.basename(out)} (${(compressed.length / 1024).toFixed(1)} KB)`);
}
