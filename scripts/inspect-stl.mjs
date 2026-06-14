#!/usr/bin/env node
// Print the bounding box / size of an STL (raw units). Useful for choosing the
// conversion scale and for authoring landmark coordinates on the real mesh.
//   node scripts/inspect-stl.mjs <file.stl> [scale]
import fs from 'node:fs';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const [, , file, scaleArg] = process.argv;
if (!file) {
  console.error('Usage: node scripts/inspect-stl.mjs <file.stl> [scale]');
  process.exit(1);
}
const scale = scaleArg ? Number(scaleArg) : 1;

const buf = fs.readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const geo = new STLLoader().parse(ab);
if (scale !== 1) geo.scale(scale, scale, scale);
geo.computeBoundingBox();
const bb = geo.boundingBox;
const size = bb.getSize(new THREE.Vector3());
const center = bb.getCenter(new THREE.Vector3());
const tris = geo.attributes.position.count / 3;

const f = (v) => v.toFixed(2);
console.log(`triangles: ${tris}`);
console.log(`min:    [${f(bb.min.x)}, ${f(bb.min.y)}, ${f(bb.min.z)}]`);
console.log(`max:    [${f(bb.max.x)}, ${f(bb.max.y)}, ${f(bb.max.z)}]`);
console.log(`size:   [${f(size.x)}, ${f(size.y)}, ${f(size.z)}]`);
console.log(`center: [${f(center.x)}, ${f(center.y)}, ${f(center.z)}]`);
