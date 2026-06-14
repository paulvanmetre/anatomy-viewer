# Anatomy Viewer — v0 (Skeletal · Upper Limb)

**Live demo:** https://paulvanmetre.github.io/anatomy-viewer/

An interactive 3D anatomy viewer for medical students. v0 is a deliberately
narrow **vertical slice**: the skeletal system, upper-limb region, five
separately selectable bones, with named landmark annotations on the humerus.
Everything else (other systems, full body, search, quizzes) is out of scope but
the architecture makes adding it a **data change, not a code change**.

> **Share-alike notice.** This application is distributed under
> **CC BY-SA 4.0**. The 3D anatomy data is **BodyParts3D**, © The Database
> Center for Life Science, licensed under **CC BY-SA 2.1 Japan**. Any
> redistribution or derivative must preserve attribution and remain under a
> compatible share-alike license. See [Licensing](#licensing).

---

## Quick start

```bash
npm install      # also copies the Draco decoder into public/draco (postinstall)
npm run dev      # http://localhost:5173  (exposed on your LAN for tablet/phone testing)
```

> **Prerequisite:** Node.js 18+ and npm. (This was not installed on the original
> build machine — install from https://nodejs.org or `winget install OpenJS.NodeJS.LTS`.)

Other scripts:

```bash
npm run build       # type-check + production build
npm run test        # vitest: schema + manifest validation
npm run validate    # CLI manifest/renderability report (add --strict to require real GLBs)
```

---

## What works in v0

- **Scene & camera** — Three.js scene, lighting, ground grid, `OrbitControls`
  (pan / zoom / rotate; one-finger orbit, two-finger dolly+pan on touch).
- **Organ-system navigation** — sidebar lists all systems; only **Skeletal** is
  enabled, the rest are shown disabled ("coming soon").
- **Layer toggle** — per-structure show/hide checkboxes + **isolate** (hide
  everything else) with a reversible **Show all**.
- **Click-to-select + info pop-out** — raycast selection highlights the mesh and
  opens an info panel: name, Latin name, system/region/FMA chips, description,
  bone type, **articulations**, **muscle attachments**, landmark list,
  **clinical notes**, and **source links**. Clicking empty space deselects.
- **Landmark annotations** — the humerus carries 8 named landmarks (head,
  greater/lesser tubercle, deltoid tuberosity, medial/lateral epicondyle,
  capitulum, trochlea), each a clickable marker with a label and description.

The five bones load as **real BodyParts3D models** (Draco-compressed GLBs). If a
GLB is ever missing, the app falls back to **clearly-marked placeholder
geometry** (with a banner) so the interaction loop still works.

---

## Data sources & licensing

### Source chosen for v0: BodyParts3D

| | |
|---|---|
| **Dataset** | BodyParts3D / Anatomography (Database Center for Life Science, Japan) |
| **Mirror used** | https://github.com/Kevin-Mattheus-Moerman/BodyParts3D (per-file STL, browser-friendly) |
| **Official archive** | https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html |
| **Format** | one `FMA<id>.stl` file **per anatomical structure** (+ FMA→name lookup tables) |
| **License** | **CC Attribution-Share Alike 2.1 Japan** |
| **Required credit** | *"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan"* |
| **Citation** | Mitsuhashi N, et al. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids Res. 2009;37(Database issue):D782-5. |

**Why this source:** one file per structure, named by FMA id, maps directly onto
the per-bone selection requirement and the `fmaId` field in the data model. The
conversion is a clean `STL → decimate → Draco GLB`.

### Upgrade path: Z-Anatomy

- https://www.z-anatomy.com · https://simtk.org/projects/z-anatomy · https://github.com/Z-Anatomy/Models-of-human-anatomy
- **License: CC BY-SA 4.0.** Cleaner anatomical naming, grouping, and TA2 labels.
- Ships as a **monolithic Blender application template**, *not* per-structure
  files — extracting individual bones means opening the atlas in Blender and
  exporting each object. Deferred past v0 for that reason; it is the path to
  richer labels later.

### Licensing

The app is **CC BY-SA 4.0**. BodyParts3D content is **CC BY-SA 2.1 Japan**.
The descriptive panel text (descriptions, articulations, muscle attachments,
clinical notes) is **adapted from Wikipedia, CC BY-SA 4.0**, with per-structure
source links in each info panel. ShareAlike binds derivatives to a compatible
license; mixing in Z-Anatomy (BY-SA 4.0) content later is compatible but **keep
the attributions distinct**. The in-app footer carries the live attribution
(`src/ui/Footer.ts`).

---

## Conversion / optimization pipeline

Source mesh → decimated, Draco-compressed GLB, in a shared coordinate frame so
bones assemble correctly when loaded together.

### 1. Fetch a structure

```bash
node scripts/fetch-bodyparts3d.mjs 13303 humerus_right
# -> scripts/.cache/humerus_right.stl
```

FMA ids used in this slice (right-side, confirmed against the mirror's
`parts_list_e.txt`):

| structure | fmaId | raw STL |
|---|---|---|
| scapula_right | FMA:13395 | 5.5 MB |
| clavicle_right | FMA:13322 | 250 KB |
| humerus_right | FMA:23130 | 794 KB |
| radius_right | FMA:23464 | 137 KB |
| ulna_right | FMA:23467 | 175 KB |

The mirror stores per-structure STLs under
`assets/BodyParts3D_data/stl/FMA<id>.stl` on the `main` branch, with the
FMA→name table at `assets/BodyParts3D_data/parts_list_e.txt`.

> **Coordinate note.** BodyParts3D is in **millimetres** and **Z-up**, in a
> single shared whole-body frame. Use the **same `scale` (0.001 = mm→m) for every
> bone and do not recenter**, so the bones keep their relative positions and
> assemble correctly. The body's vertical axis is Z, so the model must end up
> Y-up for three.js (see per-path notes below).

### 2a. Convert — Blender (primary, recommended)

```bash
blender --background --python scripts/convert-blender.py -- \
  scripts/.cache/humerus_right.stl public/models/humerus_right.glb 0.3 0.001
```

Args: `<input> <output.glb> [ratio=0.3] [scale=0.001]`. Blender is Z-up and its
glTF exporter converts to Y-up automatically, so no explicit rotation is needed
here. `ratio` is the decimation target (0.3 ≈ keep 30% of triangles).

### 2b. Convert — Node (fallback, no Blender) — **the path used for this build**

```bash
# args: <input> <output.glb> [ratio] [scale] [rotXdeg]
node scripts/convert.mjs scripts/.cache/humerus_right.stl public/models/humerus_right.glb 1 0.001 -90
```

`STLLoader → (SimplifyModifier) → GLTFExporter → gltf-pipeline (Draco)`. The Node
exporter has no up-axis convention, so pass **`-90`** to rotate Z-up→Y-up. This
build used **`ratio 1`** (no decimation — Draco handles size; ~608 KB total for
all five bones, scapula being 490 KB / 113k tris). Lower the ratio, or use the
Blender path, to also reduce triangle count for production.

### 3. Verify

```bash
npm run validate          # reports GLB vs placeholder per structure
npm run dev               # the bone now renders instead of its placeholder
```

Because each structure JSON already points at `models/<id>.glb`, **dropping the
GLB into `public/models/` is all that's needed** — no code change.

---

## Adding a new structure or system (data-only)

**New bone in an existing region:**
1. Add `data/<system>/structures/<id>.json` (validate against `data/schema.json`).
2. Reference it from the region's `manifest.json` `structures` array.
3. Drop `public/models/<id>.glb` (or give it a `placeholder` hint for now).

**New organ system:**
1. Add `data/<system>/manifest.json` with its regions/structures.
2. Add the system to `data/systems.json` (`"enabled": true`, `"manifest": "<system>/manifest.json"`).

No viewer code changes. `npm run test` will validate the new JSON.

---

## Architecture

```
src/
  main.ts                 wiring: events, selection state, system loading
  data.ts                 import.meta.glob('/data/**/*.json') — lazy, data-as-source-of-truth
  types.ts                data-model types (mirror data/schema.json)
  viewer/
    SceneManager.ts       renderer, camera, lights, OrbitControls, raycast, render loop
    ModelLoader.ts        GLTF+Draco load, placeholder fallback
    StructureManager.ts   visibility, isolate, selection highlight, landmarks, disposal
  ui/
    Sidebar.ts            systems + structures list, toggles, isolate
    InfoPanel.ts          info pop-out
    Footer.ts             CC BY-SA attribution
data/                     manifests + per-structure JSON (the content)
public/models/            optimized Draco GLBs (the geometry)
scripts/                  fetch + convert + validate tooling
tests/                    schema/manifest validation
```

Lazy loading: a system's structure JSON is only fetched when the system is
selected (lazy glob), and a model's geometry only loads at that point. Switching
systems disposes all geometries/materials/textures (`StructureManager.dispose`)
to avoid GPU memory growth.

---

## QA checklist

See [NOTES.md](./NOTES.md) for the run status of the full acceptance checklist.

## Known limitations (v0)

- All five bones are **real BodyParts3D models** (placeholders remain as a
  fallback only if a GLB goes missing). Meshes are full-resolution (Draco only);
  triangle decimation via Blender or a lower `ratio` is available for production.
- Humerus landmark coordinates were snapped to the **real** mesh surface
  (`scripts/gen-humerus-landmarks.mjs`) from anatomical bbox fractions. They are
  close but approximate — fine-tuning is a data edit in the humerus JSON.
- Single region (right upper limb), single system populated — by design.
