import './style.css';
import { SceneManager } from './viewer/SceneManager';
import { ModelLoader } from './viewer/ModelLoader';
import { StructureManager } from './viewer/StructureManager';
import { Sidebar } from './ui/Sidebar';
import { InfoPanel } from './ui/InfoPanel';
import { renderFooter } from './ui/Footer';
import {
  loadStructuresForManifest,
  loadSystemManifest,
  loadSystemsIndex,
} from './data';
import type { Selection, Structure, SystemEntry } from './types';

const canvasContainer = document.getElementById('canvas-container')!;
const sidebarEl = document.getElementById('sidebar')!;
const infoEl = document.getElementById('info-panel')!;
const footerEl = document.getElementById('footer')!;
const bannerEl = document.getElementById('placeholder-banner')!;
const loadingEl = document.getElementById('loading')!;

const scene = new SceneManager(canvasContainer);
const loader = new ModelLoader();
const structures = new StructureManager(scene.scene, loader);

let systems: SystemEntry[] = [];
let activeSystemId: string | null = null;
let currentStructures: Structure[] = [];
let structureById = new Map<string, Structure>();
let selection: Selection = null;

const infoPanel = new InfoPanel(infoEl, {
  onClose: () => setSelection(null),
  onSelectLandmark: (landmarkId) => {
    if (!selection) return;
    if (landmarkId === '') {
      setSelection({ kind: 'structure', structure: selection.structure });
      return;
    }
    const lm = selection.structure.landmarks?.find((l) => l.id === landmarkId);
    if (lm) setSelection({ kind: 'landmark', structure: selection.structure, landmark: lm });
  },
});

const sidebar = new Sidebar(sidebarEl, {
  onSelectSystem: (id) => selectSystem(id),
  onToggleStructure: (id, visible) => {
    structures.setVisible(id, visible);
    refreshState();
  },
  onIsolate: (id) => {
    structures.isolate(id);
    refreshState();
  },
  onShowAll: () => {
    structures.showAll();
    refreshState();
  },
  onSelectStructure: (id) => {
    const s = structureById.get(id);
    if (s) setSelection({ kind: 'structure', structure: s });
  },
});

renderFooter(footerEl);
scene.start();
init();

async function init(): Promise<void> {
  const index = await loadSystemsIndex();
  systems = index.systems;
  sidebar.setSystems(systems, null);
  // Auto-load the only populated system so the slice is visible on first paint.
  const skeletal = systems.find((s) => s.enabled);
  if (skeletal) await selectSystem(skeletal.id);
}

async function selectSystem(id: string): Promise<void> {
  const sys = systems.find((s) => s.id === id);
  if (!sys || !sys.enabled || !sys.manifest) return;

  activeSystemId = sys.id;
  sidebar.setSystems(systems, sys.id);
  toggle(loadingEl, true);

  const manifest = await loadSystemManifest(sys.manifest);
  currentStructures = await loadStructuresForManifest(sys.manifest, manifest);
  structureById = new Map(currentStructures.map((s) => [s.id, s]));

  const { anyPlaceholder } = await structures.setStructures(currentStructures);
  sidebar.setStructures(currentStructures);
  scene.frameBounds(structures.getBounds());
  setSelection(null);

  bannerEl.textContent = anyPlaceholder
    ? 'Showing placeholder geometry — real models not yet installed (run the conversion pipeline; see README).'
    : '';
  toggle(bannerEl, anyPlaceholder);
  toggle(loadingEl, false);
  refreshState();
}

function setSelection(sel: Selection): void {
  selection = sel;
  structures.select(sel);
  if (sel) infoPanel.show(sel);
  else infoPanel.hide();
  refreshState();
}

function refreshState(): void {
  const visibility = new Map(currentStructures.map((s) => [s.id, structures.isVisible(s.id)]));
  sidebar.setStructureState({
    visibility,
    isolatedId: structures.isolated,
    selectedId: selection?.structure.id ?? null,
  });
}

function toggle(el: HTMLElement, on: boolean): void {
  el.classList.toggle('hidden', !on);
}

// ---- click / tap selection (raycast, drag-tolerant) ------------------------
const DRAG_THRESHOLD_PX = 6;
let down: { x: number; y: number } | null = null;

const canvas = scene.renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > DRAG_THRESHOLD_PX) return; // it was an orbit/pan, not a click

  const hits = scene.raycast(e.clientX, e.clientY, structures.pickables());
  for (const hit of hits) {
    const resolved = structures.resolve(hit.object);
    if (resolved) {
      setSelection(resolved);
      return;
    }
  }
  setSelection(null); // clicked empty space
});

// Expose a little state for debugging / tests in the browser console.
(window as unknown as Record<string, unknown>).__anatomy = {
  get activeSystemId() {
    return activeSystemId;
  },
  get structures() {
    return currentStructures;
  },
};
