import type { Structure, SystemManifest, SystemsIndex } from './types';

// All JSON under /data is pulled in lazily via import.meta.glob. This keeps the
// /data directory as the single source of truth: dropping in a new structure
// JSON (and referencing it from a manifest) is picked up with no code change.
// `import: 'default'` + lazy (the default) means a file is only fetched/parsed
// when its loader is actually called — i.e. when its system is selected.
const dataModules = import.meta.glob('/data/**/*.json', {
  import: 'default',
}) as Record<string, () => Promise<unknown>>;

async function loadData<T>(absPath: string): Promise<T> {
  const loader = dataModules[absPath];
  if (!loader) {
    throw new Error(`Data file not found in /data glob: ${absPath}`);
  }
  return (await loader()) as T;
}

/** Directory of a manifest path, e.g. "skeletal/manifest.json" -> "skeletal". */
function dirOf(manifestRelPath: string): string {
  const idx = manifestRelPath.lastIndexOf('/');
  return idx === -1 ? '' : manifestRelPath.slice(0, idx);
}

export async function loadSystemsIndex(): Promise<SystemsIndex> {
  return loadData<SystemsIndex>('/data/systems.json');
}

export async function loadSystemManifest(manifestRelPath: string): Promise<SystemManifest> {
  return loadData<SystemManifest>(`/data/${manifestRelPath}`);
}

/**
 * Load every Structure referenced by a system manifest. Structure paths in the
 * manifest are relative to the manifest's own directory.
 */
export async function loadStructuresForManifest(
  manifestRelPath: string,
  manifest: SystemManifest,
): Promise<Structure[]> {
  const baseDir = dirOf(manifestRelPath);
  const refs = manifest.regions.flatMap((r) => r.structures);
  const structures = await Promise.all(
    refs.map((ref) => loadData<Structure>(`/data/${baseDir}/${ref}`)),
  );
  return structures;
}
