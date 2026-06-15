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

// Waypoints in the shared BodyParts3D frame, hand-tuned to hug the real bones.
// The arm angles laterally toward the wrist (humerus x≈-0.15..-0.19 up high;
// radius/ulna x≈-0.21..-0.27 lower), so the vessels track that shift instead of
// running straight. Anterior (higher z) = superficial. Radii are thin (arteries
// ~3.5 mm, veins ~4.5 mm at scale) so they read as vessels, not rods.
const vessels = [
  {
    // Medial–anterior arm, axilla to cubital fossa.
    id: 'brachial_artery_right', color: ARTERY, radius: 0.0036,
    points: [
      [-0.150, 1.345, 0.108], [-0.158, 1.26, 0.112], [-0.165, 1.17, 0.116],
      [-0.172, 1.10, 0.119], [-0.178, 1.045, 0.121],
    ],
  },
  {
    // Lateral forearm, along the radius to the wrist.
    id: 'radial_artery_right', color: ARTERY, radius: 0.0032,
    points: [
      [-0.182, 1.04, 0.120], [-0.205, 0.985, 0.116], [-0.228, 0.925, 0.110],
      [-0.248, 0.865, 0.104], [-0.262, 0.825, 0.100],
    ],
  },
  {
    // Medial forearm, along the ulna to the wrist.
    id: 'ulnar_artery_right', color: ARTERY, radius: 0.0032,
    points: [
      [-0.176, 1.04, 0.117], [-0.188, 0.975, 0.107], [-0.198, 0.905, 0.098],
      [-0.206, 0.855, 0.091], [-0.210, 0.825, 0.087],
    ],
  },
  {
    // Superficial lateral vein: lateral wrist up to the deltopectoral groove.
    id: 'cephalic_vein_right', color: VEIN, radius: 0.0044,
    points: [
      [-0.262, 0.84, 0.118], [-0.246, 0.92, 0.128], [-0.226, 1.02, 0.136],
      [-0.205, 1.14, 0.142], [-0.186, 1.255, 0.146], [-0.172, 1.33, 0.148],
    ],
  },
  {
    // Superficial medial vein: medial wrist up the medial arm.
    id: 'basilic_vein_right', color: VEIN, radius: 0.0044,
    points: [
      [-0.206, 0.835, 0.116], [-0.193, 0.93, 0.122], [-0.179, 1.03, 0.127],
      [-0.166, 1.13, 0.131], [-0.156, 1.215, 0.133],
    ],
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
