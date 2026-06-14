#!/usr/bin/env node
// Generate humerus landmark coordinates anchored to the REAL mesh. Loads the
// humerus STL, applies the SAME transform as the conversion (rotateX -90°,
// scale 0.001) so coordinates match the GLB, then snaps each anatomical target
// (expressed as a fraction of the bounding box) to the nearest surface vertex.
//
//   node scripts/gen-humerus-landmarks.mjs scripts/.cache/humerus_right.stl
//
// Frame after transform (right humerus): Y = long axis (proximal high, distal
// low); X = medial-lateral (more negative = lateral); Z = anterior-posterior.
import fs from 'node:fs';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const file = process.argv[2] || 'scripts/.cache/humerus_right.stl';
const buf = fs.readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const geo = new STLLoader().parse(ab);
geo.rotateX(-Math.PI / 2);
geo.scale(0.001, 0.001, 0.001);
geo.computeBoundingBox();
const bb = geo.boundingBox;
const size = bb.getSize(new THREE.Vector3());

// fx: 0 = lateral (min x), 1 = medial (max x)
// fy: 0 = distal (min y), 1 = proximal (max y)
// fz: 0 = min z, 1 = max z
const targets = [
  ['head', 'Head', 0.75, 0.97, 0.25],
  ['greater_tubercle', 'Greater tubercle', 0.1, 0.92, 0.5],
  ['lesser_tubercle', 'Lesser tubercle', 0.55, 0.92, 0.85],
  ['deltoid_tuberosity', 'Deltoid tuberosity', 0.1, 0.5, 0.5],
  ['medial_epicondyle', 'Medial epicondyle', 0.95, 0.05, 0.5],
  ['lateral_epicondyle', 'Lateral epicondyle', 0.05, 0.05, 0.5],
  ['capitulum', 'Capitulum', 0.2, 0.02, 0.8],
  ['trochlea', 'Trochlea', 0.7, 0.02, 0.8],
];

const pos = geo.attributes.position;
const v = new THREE.Vector3();

function nearestVertex(target) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.distanceToSquared(target);
    if (d < bestD) {
      bestD = d;
      best = v.clone();
    }
  }
  return best;
}

const round = (n) => Number(n.toFixed(4));
const out = targets.map(([id, name, fx, fy, fz]) => {
  const target = new THREE.Vector3(
    bb.min.x + fx * size.x,
    bb.min.y + fy * size.y,
    bb.min.z + fz * size.z,
  );
  const p = nearestVertex(target);
  return { id, name, position: [round(p.x), round(p.y), round(p.z)] };
});

console.log(JSON.stringify(out, null, 2));
