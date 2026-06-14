# Primary, reliable conversion path: source mesh -> decimated, Draco-compressed GLB.
#
# Usage:
#   blender --background --python scripts/convert-blender.py -- <input> <output.glb> [ratio] [scale]
#
# Example (preserve BodyParts3D shared coordinate frame; mm -> m):
#   blender --background --python scripts/convert-blender.py -- \
#       scripts/.cache/humerus_right.stl public/models/humerus_right.glb 0.3 0.001
#
# Args:
#   input   .stl / .obj / .ply source mesh
#   output  destination .glb
#   ratio   decimate collapse ratio, 0..1 (default 0.3 -> keep ~30% of triangles)
#   scale   uniform scale applied to all bones (default 0.001 = mm -> m).
#           Keep this IDENTICAL across every bone and do NOT recenter, so the
#           bones keep their correct relative position when loaded together.
import bpy
import sys
import os

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    print("ERROR: need <input> <output.glb> [ratio] [scale]")
    sys.exit(1)

inp, outp = argv[0], argv[1]
ratio = float(argv[2]) if len(argv) > 2 else 0.3
scale = float(argv[3]) if len(argv) > 3 else 0.001

# Clean default scene.
bpy.ops.wm.read_factory_settings(use_empty=True)

ext = os.path.splitext(inp)[1].lower()
if ext == ".stl":
    # Operator name moved between Blender versions.
    if hasattr(bpy.ops.wm, "stl_import"):
        bpy.ops.wm.stl_import(filepath=inp)          # Blender 4.x
    else:
        bpy.ops.import_mesh.stl(filepath=inp)        # Blender 3.x
elif ext == ".obj":
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=inp)
    else:
        bpy.ops.import_scene.obj(filepath=inp)
elif ext == ".ply":
    bpy.ops.wm.ply_import(filepath=inp)
else:
    print(f"ERROR: unsupported input extension {ext}")
    sys.exit(1)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    print("ERROR: no mesh imported")
    sys.exit(1)

# Join everything into one object.
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active

# Decimate to the triangle budget.
dec = obj.modifiers.new(name="decimate", type="DECIMATE")
dec.ratio = ratio
bpy.ops.object.modifier_apply(modifier=dec.name)

# Uniform scale (NO recenter — keep shared coordinate frame for assembly).
obj.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

tri_count = sum(len(p.vertices) - 2 for p in obj.data.polygons)
print(f"Output triangles (approx): {tri_count}")

os.makedirs(os.path.dirname(outp) or ".", exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=outp,
    export_format="GLB",
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_apply=True,
    use_selection=False,
)
print(f"Wrote {outp}")
