"""
RiftScape GLB Cleaner
======================
Cleans up Meshy export:
- Removes all Icospheres (debug artifacts)
- Keeps only char1 mesh and Armature
- Exports clean GLB with all animations

USAGE:
1. Edit INPUT_FILE and OUTPUT_FILE paths
2. Run in Blender Scripting tab
3. Use the output file in your game
"""

import bpy
from pathlib import Path

# =============================================================================
# EDIT THESE PATHS
# =============================================================================

INPUT_FILE = r"C:\Users\KonoPea_See-Evo-GX2\Documents\RiftScape\Survival_Core\RiftScape-core\models\Meshy_Merged_Animations.glb"
OUTPUT_FILE = r"C:\Users\KonoPea_See-Evo-GX2\Documents\RiftScape\Survival_Core\RiftScape-core\models\Riftling_Clean.glb"

# =============================================================================
# CLEANER
# =============================================================================

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0: bpy.data.meshes.remove(block)
    for block in bpy.data.armatures:
        if block.users == 0: bpy.data.armatures.remove(block)
    for block in bpy.data.actions:
        if block.users == 0: bpy.data.actions.remove(block)

def main():
    print("\n" + "="*60)
    print(" RIFTSCAPE GLB CLEANER")
    print("="*60)
    
    # Check input exists
    if not Path(INPUT_FILE).exists():
        print(f"ERROR: Input file not found: {INPUT_FILE}")
        return
    
    # Clear and import
    clear_scene()
    print(f"\nImporting: {INPUT_FILE}")
    bpy.ops.import_scene.gltf(filepath=INPUT_FILE)
    
    # Count objects before
    total_before = len(bpy.context.scene.objects)
    print(f"Objects before cleanup: {total_before}")
    
    # Find objects to delete (Icospheres)
    to_delete = []
    to_keep = []
    
    for obj in bpy.context.scene.objects:
        if 'Icosphere' in obj.name:
            to_delete.append(obj.name)
        else:
            to_keep.append(obj.name)
    
    print(f"\nKeeping: {to_keep}")
    print(f"Deleting: {len(to_delete)} Icospheres")
    
    # Delete Icospheres
    bpy.ops.object.select_all(action='DESELECT')
    for obj_name in to_delete:
        obj = bpy.data.objects.get(obj_name)
        if obj:
            obj.select_set(True)
    
    bpy.ops.object.delete()
    
    # Count after
    total_after = len(bpy.context.scene.objects)
    print(f"Objects after cleanup: {total_after}")
    
    # List remaining objects
    print("\nRemaining objects:")
    for obj in bpy.context.scene.objects:
        print(f"  {obj.name} ({obj.type})")
    
    # List animations
    print("\nAnimations preserved:")
    for action in bpy.data.actions:
        frames = action.frame_range[1] - action.frame_range[0]
        print(f"  {action.name}: {int(frames)} frames")
    
    # Export
    print(f"\nExporting to: {OUTPUT_FILE}")
    
    # Make sure output directory exists
    Path(OUTPUT_FILE).parent.mkdir(parents=True, exist_ok=True)
    
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_FILE,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_lights=False,
        export_cameras=False
    )
    
    print("\n" + "="*60)
    print(" DONE!")
    print("="*60)
    print(f"""
Your clean GLB is ready: {Path(OUTPUT_FILE).name}

In your mod, use this SINGLE file for both mesh and animations:

    const glb = await loader.load('models/Riftling_Clean.glb');
    const scene = glb.scene;
    const mixer = new THREE.AnimationMixer(scene);
    
    // Animations are in glb.animations
    glb.animations.forEach(clip => {{
        console.log('Animation:', clip.name);
    }});
    
    // Play idle
    const idle = glb.animations.find(c => c.name === 'Idle');
    if (idle) mixer.clipAction(idle).play();
""")

main()
