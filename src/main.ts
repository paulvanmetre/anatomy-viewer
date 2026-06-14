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
const activeSystems = new Set<string>();
const placeholderSystems = new Set<string>();
const systemStructures = new Map<string, Structure[]>(); // cache, by system id
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
  onToggleSystem: (id, active) => setSystemActive(id, active),
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
  // Load the default system (skeletal) so something is visible on first paint.
  const first = systems.find((s) => s.enabled);
  if (first) await setSystemActive(first.id, true, /* frame */ true);
  syncSidebar();
}

/** Load (active=true) or unload (active=false) a system as a layer. */
async function setSystemActive(id: string, active: boolean, frame = false): Promise<void> {
  const sys = systems.find((s) => s.id === id);
  if (!sys || !sys.enabled || !sys.manifest) return;

  if (active && !activeSystems.has(id)) {
    toggle(loadingEl, true);
    const structs = await loadSystemStructures(sys);
    const wasEmpty = currentStructures.length === 0;
    const { anyPlaceholder } = await structures.loadSystem(structs);
    if (anyPlaceholder) placeholderSystems.add(id);
    activeSystems.add(id);
    rebuildCurrent();
    if (frame || wasEmpty) scene.frameBounds(structures.getBounds());
    toggle(loadingEl, false);
  } else if (!active && activeSystems.has(id)) {
    structures.unloadSystem(id);
    activeSystems.delete(id);
    placeholderSystems.delete(id);
    rebuildCurrent();
    if (selection && !structureById.has(selection.structure.id)) selection = null;
  }

  updateBanner();
  syncSidebar();
  setSelection(selection);
}

async function loadSystemStructures(sys: SystemEntry): Promise<Structure[]> {
  const cached = systemStructures.get(sys.id);
  if (cached) return cached;
  const manifest = await loadSystemManifest(sys.manifest!);
  const structs = await loadStructuresForManifest(sys.manifest!, manifest);
  systemStructures.set(sys.id, structs);
  return structs;
}

/** Recompute the flat list of all currently-loaded structures, in system order. */
function rebuildCurrent(): void {
  currentStructures = systems
    .filter((s) => activeSystems.has(s.id))
    .flatMap((s) => systemStructures.get(s.id) ?? []);
  structureById = new Map(currentStructures.map((s) => [s.id, s]));
}

function setSelection(sel: Selection): void {
  selection = sel;
  structures.select(sel);
  if (sel) infoPanel.show(sel);
  else infoPanel.hide();
  refreshState();
}

function syncSidebar(): void {
  sidebar.setSystems(systems, activeSystems);
  sidebar.setStructures(currentStructures, systems);
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

function updateBanner(): void {
  const on = placeholderSystems.size > 0;
  bannerEl.textContent = on
    ? 'Showing placeholder geometry — real models not yet installed (see README).'
    : '';
  toggle(bannerEl, on);
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
  get activeSystems() {
    return [...activeSystems];
  },
  get structures() {
    return currentStructures;
  },
};
