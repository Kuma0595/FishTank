"""Run with Blender --background --disable-autoexec INPUT.blend --python SCRIPT -- OUTPUT.glb.

Keep the supplied .blend unchanged. Export only its fish mesh and armature, retaining
skin weights, packed texture, and the complete action including its loop endpoint.
"""
import bpy
import math
import pathlib
import sys

output = pathlib.Path(sys.argv[sys.argv.index('--') + 1]).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
if len(meshes) != 1 or len(rigs) != 1:
    raise RuntimeError('Expected one fish mesh and one armature')
fish, rig = meshes[0], rigs[0]
action = rig.animation_data.action if rig.animation_data else None
if not action:
    raise RuntimeError('The armature has no swimming action')

# Apply reduction before the armature so the exporter retains an undeformed bind
# mesh and interpolated vertex weights rather than baking a single swimming pose.
bpy.ops.object.select_all(action='DESELECT')
fish.select_set(True)
bpy.context.view_layer.objects.active = fish
reduction = fish.modifiers.new('Web geometry budget', 'DECIMATE')
reduction.ratio = 0.18
while fish.modifiers.find(reduction.name) > 0:
    bpy.ops.object.modifier_move_up(modifier=reduction.name)
bpy.ops.object.modifier_apply(modifier=reduction.name)

scene = bpy.context.scene
scene.frame_start = math.floor(action.frame_range[0])
scene.frame_end = math.ceil(action.frame_range[1])
scene.frame_set(scene.frame_start)
rig.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(output), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS',
    export_frame_range=True, export_anim_slide_to_zero=True,
    export_skins=True, export_image_format='JPEG', export_image_quality=90,
    export_cameras=False, export_lights=False,
)
print('Exported animated fish:', output)
