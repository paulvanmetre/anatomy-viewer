import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { Structure } from '../types';

export interface LoadedModel {
  /** Local-space object (centred); the caller positions it via a parent group. */
  object: THREE.Object3D;
  /** True when the real GLB was missing and a stand-in was generated. */
  isPlaceholder: boolean;
}

/**
 * Loads a structure's Draco-compressed GLB. If the file is missing (v0, before
 * the conversion pipeline has been run), it returns a clearly-synthetic
 * procedural placeholder so the full interaction loop still works. Swapping in
 * the real model is then purely dropping the GLB into /public/models.
 */
export class ModelLoader {
  private readonly gltf: GLTFLoader;
  private readonly draco: DRACOLoader;

  constructor() {
    this.draco = new DRACOLoader();
    // Decoder is copied from the three package into /public/draco on postinstall
    // (scripts/copy-draco.mjs), so there is no runtime CDN dependency.
    // BASE_URL makes this work under a sub-path deploy (e.g. GitHub Pages).
    this.draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(this.draco);
  }

  async load(structure: Structure): Promise<LoadedModel> {
    try {
      const gltf = await this.gltf.loadAsync(`${import.meta.env.BASE_URL}${structure.modelFile}`);
      const object = gltf.scene;
      object.userData.structureId = structure.id;
      object.traverse((o) => (o.userData.structureId = structure.id));
      return { object, isPlaceholder: false };
    } catch {
      const object = this.buildPlaceholder(structure);
      object.userData.structureId = structure.id;
      object.traverse((o) => (o.userData.structureId = structure.id));
      return { object, isPlaceholder: true };
    }
  }

  dispose(): void {
    this.draco.dispose();
  }

  private buildPlaceholder(structure: Structure): THREE.Object3D {
    const hint = structure.placeholder ?? { shape: 'block', size: [1, 1, 1], color: '#cccccc' };
    const [sx, sy, sz] = hint.size;
    let geometry: THREE.BufferGeometry;

    switch (hint.shape) {
      case 'long-bone': {
        const radius = Math.min(sx, sz) / 2;
        const cylLen = Math.max(sy - radius * 2, radius);
        geometry = new THREE.CapsuleGeometry(radius, cylLen, 6, 16);
        break;
      }
      case 'flat-bone': {
        // Flattened, slightly tapered shape to read as a blade-like bone.
        geometry = new THREE.BoxGeometry(sx, sy, sz, 2, 2, 1);
        break;
      }
      default:
        geometry = new THREE.BoxGeometry(sx, sy, sz);
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hint.color),
      roughness: 0.75,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${structure.id}__placeholder`;
    return mesh;
  }
}
