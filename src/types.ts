// Shared data-model types. These mirror data/schema.json one-to-one so that
// "add a bone / system" is purely a data change (new JSON + GLB), never a code
// change to the viewer.

export interface Landmark {
  id: string;
  name: string;
  /** Position in the structure's local model space (metres). */
  position: [number, number, number];
  description: string;
}

export type PlaceholderShape = 'long-bone' | 'flat-bone' | 'block';

/** Procedural stand-in used until the real GLB is installed (v0 only). */
export interface PlaceholderHint {
  shape: PlaceholderShape;
  size: [number, number, number];
  color: string;
  /** Euler XYZ rotation (radians) applied to the structure group. */
  rotation?: [number, number, number];
  /** World offset for the structure group, so placeholders don't stack. */
  offset?: [number, number, number];
}

export interface Reference {
  label: string;
  url: string;
}

export interface Structure {
  id: string;
  name: string;
  system: string;
  region: string;
  parentId?: string;
  fmaId?: string;
  /** Path under /public, e.g. "models/humerus_right.glb". */
  modelFile: string;
  description: string;
  /** Optional richer detail (adapted from open CC BY-SA sources). */
  latinName?: string;
  classification?: string;
  articulations?: string[];
  muscleAttachments?: string[];
  /** Muscle-specific detail. */
  origin?: string;
  insertion?: string;
  action?: string;
  innervation?: string;
  clinical?: string[];
  references?: Reference[];
  /** 0..1 — render translucent (e.g. muscles over bone). Default 1 (opaque). */
  opacity?: number;
  /** True for procedurally-approximated models (e.g. schematic vessels). */
  schematic?: boolean;
  placeholder?: PlaceholderHint;
  landmarks?: Landmark[];
}

export interface Region {
  id: string;
  name: string;
  /** Paths to structure JSON files, relative to the system's manifest dir. */
  structures: string[];
}

export interface SystemManifest {
  system: string;
  name: string;
  regions: Region[];
}

export interface SystemEntry {
  id: string;
  name: string;
  enabled: boolean;
  /** Path to the system manifest, relative to /data. Present when enabled. */
  manifest?: string;
}

export interface SystemsIndex {
  systems: SystemEntry[];
}

/** What the raycaster can return on a click. */
export type Selection =
  | { kind: 'structure'; structure: Structure }
  | { kind: 'landmark'; structure: Structure; landmark: Landmark }
  | null;
