# NOTES — dataset findings, decisions, blockers

## Datasets confirmed (Section 2)

### Z-Anatomy
- **Where:** https://www.z-anatomy.com · https://simtk.org/projects/z-anatomy ·
  models repo https://github.com/Z-Anatomy/Models-of-human-anatomy
- **License:** CC BY-SA 4.0 (confirmed on the project page and repo).
- **Format:** ships as a **Blender application template** (`Z-Anatomy.zip` /
  `Z-Anatomy_Template.zip`) — a single navigable atlas, **not** per-structure
  exportable files. No pre-exported glTF. Extracting individual bones requires
  opening it in Blender and exporting objects.

### BodyParts3D / Anatomography  ← chosen for v0
- **Where:** official archive https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html ·
  per-file GitHub mirror https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
- **License:** **CC Attribution-Share Alike 2.1 Japan** (note: 2.1 JP, *not* 4.0).
  Required credit string: *"BodyParts3D, © The Database Center for Life Science
  licensed under CC Attribution-Share Alike 2.1 Japan."* Cite Mitsuhashi et al.,
  Nucleic Acids Res. 2009.
- **Format:** one `FMA<id>.stl` per structure + `.txt` FMA→English lookup tables.
  ~1,523 structures. Maps 1:1 onto our per-bone, `fmaId`-keyed data model.

## Decision

Use **BodyParts3D** for v0: per-structure STLs named by FMA id are the shortest
path to individually-selectable upper-limb bones and a clean
`STL → decimate → Draco GLB` pipeline. **Z-Anatomy** is documented as the upgrade
path (better labels/grouping) once we want richer annotations.

Licensing flagged: BodyParts3D is **BY-SA 2.1 JP**, while the prompt assumed a
generic "CC BY-SA". The app is shipped **BY-SA 4.0** with both attributions in
the footer; ShareAlike obligations noted in README.

## Environment / status

- **Node.js** was not installed system-wide. Installed **portable Node v24.16.0**
  to `%LOCALAPPDATA%\nodejs-portable\node-v24.16.0-win-x64` (no admin; the
  machine-scope MSI needed UAC). Added to the **user PATH**, so new terminals
  pick it up. `npm install`, type-check, tests, build, and dev server all ran
  green from here.
- **Blender** is still not installed — only needed for the *primary* model
  conversion path. The Node fallback (`scripts/convert.mjs`) was used instead and
  produced all five GLBs.
- The five real bones are now committed under `public/models/`. Placeholder
  geometry remains only as a fallback if a GLB goes missing.

## Real models — DONE

All five right upper-limb bones are now **real BodyParts3D models**, fetched from
the mirror, converted to Draco GLB via the Node path, and verified rendering:

| structure | FMA | GLB |
|---|---|---|
| scapula_right | FMA13395 | 490 KB (113k tris) |
| humerus_right | FMA23130 | 70 KB |
| clavicle_right | FMA13322 | 20 KB |
| ulna_right | FMA23467 | 16 KB |
| radius_right | FMA23464 | 12 KB |

Pipeline used: `fetch-bodyparts3d.mjs` → `convert.mjs <stl> <glb> 1 0.001 -90`
(scale mm→m, rotate Z-up→Y-up, no decimation; Draco only). Humerus landmarks
re-snapped to the real mesh via `gen-humerus-landmarks.mjs`.

## Muscular system — DONE (layered)

Added the muscular system as a second layer over the bones (same BodyParts3D
coordinate frame). Six right upper-limb muscles, each merged from its
BodyParts3D parts and converted muscle-red, rendered translucent (`opacity`):
deltoid (3 parts), biceps brachii (2 heads), triceps brachii (3 heads),
brachialis, brachioradialis, flexor carpi radialis. ~1.9 MB GLB total, lazy-loaded
when the layer is toggled on.

Viewer change: systems are now **additive layers** (toggle on/off, grouped in the
sidebar) instead of single-select; `StructureManager.loadSystem`/`unloadSystem`
add/dispose a system without touching others. Muscle panels show
origin/insertion/action/innervation (adapted from Wikipedia, CC BY-SA).

## Acceptance checklist — status

Legend: ✅ verified in-browser/CI · 🟡 implemented, needs a real device

- ✅ Data pipeline reproducible — fetch + convert scripts run; produced all 5 GLBs; `npm run validate --strict` passes
- ✅ ≥1 real model loaded from the dataset — all 5 real BodyParts3D bones render & assemble correctly
- 🟡 Pan/zoom/rotate with mouse + touch — OrbitControls verified rendering/orbit; touch needs a real device
- ✅ Each upper-limb structure independently selectable & toggle-able — verified (5 real bones, checkboxes)
- ✅ Isolate mode + reversible Show all — verified on real models
- ✅ Raycast/selection returns the correct structure — verified (highlight on real GLB; correct info)
- ✅ Humerus landmarks in correct locations + labels — verified on real mesh; all 8 labels/descriptions, anatomically placed
- ✅ Info pop-out content matches selection — verified for structure + landmark drill-down + Back (FMA:23130)
- ✅ No console errors (clean across all interactions) · 🟡 GPU-growth-on-switch needs a 2nd enabled system to exercise
- ✅ Desktop + tablet-width layouts verified (responsive breakpoint at 800px) · 🟡 phone device + touch pending
- ✅ CC BY-SA attribution + share-alike notice in-app (footer) and README
- ✅ Automated check: manifest validates vs schema + every structure renderable (vitest, 4/4)

## Next actions

1. Install Node.js 18+ (and optionally Blender) on the build machine.
2. `npm install && npm run test` (schema/manifest test should pass on placeholders).
3. `npm run dev` and walk the in-browser checklist (selection, isolate, landmarks, touch).
4. Run the fetch + convert pipeline for the five bones; drop GLBs into
   `public/models/`; re-author humerus landmark coordinates to the real model.
5. `npm run validate --strict` should then pass with all real GLBs.
