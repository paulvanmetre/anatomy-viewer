import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Landmark, Selection, Structure } from '../types';
import { ModelLoader } from './ModelLoader';

const HIGHLIGHT = new THREE.Color(0x2f6bff);
const MARKER_COLOR = new THREE.Color(0x35a7ff);
const MARKER_SELECTED = new THREE.Color(0xffcc33);

interface MarkerHandle {
  landmark: Landmark;
  mesh: THREE.Mesh;
  label: CSS2DObject;
}

interface StructureEntry {
  structure: Structure;
  group: THREE.Group;
  model: THREE.Object3D;
  isPlaceholder: boolean;
  markers: MarkerHandle[];
  visible: boolean;
}

/**
 * Owns the loaded structure meshes for the current system: visibility, isolate,
 * selection highlighting, and landmark markers/labels. Disposes all GPU
 * resources when the system is swapped to avoid memory growth.
 */
export class StructureManager {
  private readonly root = new THREE.Group();
  private readonly entries = new Map<string, StructureEntry>();
  private selectedStructureId: string | null = null;
  private selectedLandmarkId: string | null = null;
  private isolatedId: string | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly loader: ModelLoader,
  ) {
    this.root.name = '__structures';
    this.scene.add(this.root);
  }

  /** Add a system's structures to the scene (additive — does not clear others). */
  async loadSystem(structures: Structure[]): Promise<{ anyPlaceholder: boolean }> {
    let anyPlaceholder = false;

    for (const structure of structures) {
      if (this.entries.has(structure.id)) continue; // already loaded
      const { object: model, isPlaceholder } = await this.loader.load(structure);
      if (isPlaceholder) anyPlaceholder = true;

      const group = new THREE.Group();
      group.name = structure.id;
      // Placeholder offsets/rotations lay out the synthetic stand-ins into an
      // arm shape. Real GLBs carry their own shared (BodyParts3D) coordinate
      // frame, so they must NOT be shifted — they assemble on their own.
      if (isPlaceholder) {
        const t = structure.placeholder?.offset;
        if (t) group.position.set(t[0], t[1], t[2]);
        const r = structure.placeholder?.rotation;
        if (r) group.rotation.set(r[0], r[1], r[2]);
      }

      if (structure.opacity !== undefined && structure.opacity < 1) {
        applyOpacity(model, structure.opacity);
      }

      group.add(model);
      // Size markers/labels relative to the actual model so they read well on
      // both the ~0.3 m real bones and the multi-unit placeholders.
      const modelSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      const markerRadius = Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.02;
      const markers = this.buildMarkers(structure, markerRadius);
      markers.forEach((m) => {
        group.add(m.mesh);
        m.mesh.add(m.label);
      });

      this.root.add(group);
      this.entries.set(structure.id, {
        structure,
        group,
        model,
        isPlaceholder,
        markers,
        visible: true,
      });
    }

    this.updateLabelVisibility();
    return { anyPlaceholder };
  }

  /** Remove and dispose every structure belonging to a system. */
  unloadSystem(systemId: string): void {
    for (const [id, entry] of this.entries) {
      if (entry.structure.system !== systemId) continue;
      this.root.remove(entry.group);
      disposeObject(entry.group);
      entry.markers.forEach((m) => m.label.element.remove());
      this.entries.delete(id);
      if (this.selectedStructureId === id) {
        this.selectedStructureId = null;
        this.selectedLandmarkId = null;
      }
      if (this.isolatedId === id) this.isolatedId = null;
    }
    this.updateLabelVisibility();
  }

  private buildMarkers(structure: Structure, radius: number): MarkerHandle[] {
    const geo = new THREE.SphereGeometry(radius, 16, 12);
    return (structure.landmarks ?? []).map((landmark) => {
      const mat = new THREE.MeshBasicMaterial({ color: MARKER_COLOR.clone() });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...landmark.position);
      mesh.name = `${structure.id}:${landmark.id}`;
      mesh.userData.structureId = structure.id;
      mesh.userData.landmarkId = landmark.id;

      const el = document.createElement('div');
      el.className = 'landmark-label';
      el.textContent = landmark.name;
      const label = new CSS2DObject(el);
      label.position.set(0, radius * 2.5, 0);
      label.visible = false;

      return { landmark, mesh, label };
    });
  }

  // ---- visibility / isolate ------------------------------------------------

  setVisible(id: string, visible: boolean): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.visible = visible;
    entry.group.visible = visible;
    this.updateLabelVisibility();
  }

  isVisible(id: string): boolean {
    return this.entries.get(id)?.visible ?? false;
  }

  isolate(id: string): void {
    this.isolatedId = id;
    for (const [eid, entry] of this.entries) {
      const v = eid === id;
      entry.visible = v;
      entry.group.visible = v;
    }
    this.updateLabelVisibility();
  }

  showAll(): void {
    this.isolatedId = null;
    for (const entry of this.entries.values()) {
      entry.visible = true;
      entry.group.visible = true;
    }
    this.updateLabelVisibility();
  }

  get isolated(): string | null {
    return this.isolatedId;
  }

  // ---- selection -----------------------------------------------------------

  /** Resolve a raycast hit to a structure or landmark selection. */
  resolve(object: THREE.Object3D): Selection {
    let structureId: string | undefined;
    let landmarkId: string | undefined;
    for (let o: THREE.Object3D | null = object; o; o = o.parent) {
      if (!landmarkId && o.userData.landmarkId) landmarkId = o.userData.landmarkId as string;
      if (!structureId && o.userData.structureId) structureId = o.userData.structureId as string;
    }
    if (!structureId) return null;
    const entry = this.entries.get(structureId);
    if (!entry) return null;
    if (landmarkId) {
      const lm = entry.structure.landmarks?.find((l) => l.id === landmarkId);
      if (lm) return { kind: 'landmark', structure: entry.structure, landmark: lm };
    }
    return { kind: 'structure', structure: entry.structure };
  }

  select(selection: Selection): void {
    this.applyHighlight(null); // reset
    this.selectedStructureId = null;
    this.selectedLandmarkId = null;

    if (!selection) {
      this.updateLabelVisibility();
      this.updateMarkerColors();
      return;
    }

    this.selectedStructureId = selection.structure.id;
    if (selection.kind === 'landmark') this.selectedLandmarkId = selection.landmark.id;
    this.applyHighlight(selection.structure.id);
    this.updateLabelVisibility();
    this.updateMarkerColors();
  }

  /** Objects the raycaster should test (visible structures + their markers). */
  pickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const entry of this.entries.values()) {
      if (!entry.visible) continue;
      out.push(entry.group);
    }
    return out;
  }

  getBounds(): THREE.Box3 {
    const box = new THREE.Box3();
    for (const entry of this.entries.values()) {
      if (entry.visible) box.expandByObject(entry.group);
    }
    return box;
  }

  private applyHighlight(structureId: string | null): void {
    for (const entry of this.entries.values()) {
      const on = entry.structure.id === structureId;
      entry.model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of materials) {
          const mat = m as THREE.MeshStandardMaterial;
          if (!('emissive' in mat)) continue;
          if (mat.userData.baseEmissive === undefined) {
            mat.userData.baseEmissive = mat.emissive.getHex();
          }
          mat.emissive.set(on ? HIGHLIGHT : mat.userData.baseEmissive);
          mat.emissiveIntensity = on ? 0.45 : 1;
        }
      });
    }
  }

  private updateMarkerColors(): void {
    for (const entry of this.entries.values()) {
      for (const m of entry.markers) {
        const selected = m.landmark.id === this.selectedLandmarkId;
        const mat = m.mesh.material as THREE.MeshBasicMaterial;
        mat.color.copy(selected ? MARKER_SELECTED : MARKER_COLOR);
        m.mesh.scale.setScalar(selected ? 1.6 : 1);
      }
    }
  }

  /** Labels are only shown for the selected structure's landmarks. */
  private updateLabelVisibility(): void {
    for (const entry of this.entries.values()) {
      const show = entry.visible && entry.structure.id === this.selectedStructureId;
      for (const m of entry.markers) m.label.visible = show;
    }
  }

  // ---- lifecycle -----------------------------------------------------------

  private clear(): void {
    this.selectedStructureId = null;
    this.selectedLandmarkId = null;
    this.isolatedId = null;
    for (const entry of this.entries.values()) {
      this.root.remove(entry.group);
      disposeObject(entry.group);
      entry.markers.forEach((m) => m.label.element.remove());
    }
    this.entries.clear();
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.root);
  }
}

/** Make every material under an object translucent (e.g. muscle over bone). */
function applyOpacity(root: THREE.Object3D, opacity: number): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of materials) {
      m.transparent = true;
      m.opacity = opacity;
    }
  });
}

/** Recursively free geometries, materials and textures under an object. */
function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of materials) {
        const mat = m as THREE.Material & Record<string, unknown>;
        for (const key of Object.keys(mat)) {
          const val = mat[key] as { isTexture?: boolean; dispose?: () => void };
          if (val && val.isTexture && typeof val.dispose === 'function') val.dispose();
        }
        mat.dispose();
      }
    }
  });
}
