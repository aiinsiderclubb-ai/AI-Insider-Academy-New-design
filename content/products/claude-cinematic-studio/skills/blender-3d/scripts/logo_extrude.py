"""SVG logo → extruded, bevelled 3D logo in a studio, animated, rendered.

    blender -b -P logo_extrude.py -- --svg logo.svg --out public/footage/logo
    blender -b -P logo_extrude.py -- --svg logo.svg --material gold --anim reveal --look warm
    blender -b -P logo_extrude.py -- --text "AI" --font Unbounded-ExtraBold.ttf --material glass --engine cycles

How it works:
  1. The SVG is imported as curves (Blender's own SVG importer; fills only —
     convert strokes to paths in your vector editor first). Or --text builds
     the same from a font (any TTF/OTF; Cyrillic works with a font that has it).
  2. All shapes are joined, centred, scaled to --width units and stood up.
  3. The curves get --depth of extrusion and a --bevel that catches light:
     the bevel is what makes a 3D logo read as machined, not as a slab.
  4. Material: chrome | gold | black-chrome | glass | matte.
  5. Animation:
       turntable  one smooth swing (--turn degrees) with a light sweeping across
       reveal     the logo rotates up from flat and settles on an eased curve,
                  then a specular strip slides over its face (the "logo sting")
  6. Two passes like product_turntable.py: plate/ (with backdrop) and cutout/
     (RGBA, logo only), plus meta.json.

Options: --frames 120 --fps 30 --res 1920x1080 --engine eevee|cycles
--samples N --look graphite|studio-white|warm|night-blue --lens 85
--only plate|cutout --save-blend scene.blend --no-render
"""
from __future__ import annotations

import argparse
import math
import os
import sys

import addon_utils
import bpy
from mathutils import Vector

sys.dont_write_bytecode = True  # keep the product folder free of __pycache__
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import studio  # noqa: E402

MATERIALS = {
    "chrome": dict(color=(0.92, 0.92, 0.94), metallic=1.0, roughness=0.05),
    "gold": dict(color=(1.0, 0.72, 0.32), metallic=1.0, roughness=0.14),
    "black-chrome": dict(color=(0.06, 0.06, 0.07), metallic=1.0, roughness=0.08),
    "glass": dict(color=(0.9, 0.95, 1.0), roughness=0.0, transmission=1.0, ior=1.5),
    "matte": dict(color=(0.85, 0.85, 0.85), roughness=0.6),
}


def import_svg(path):
    addon_utils.enable("io_curve_svg", default_set=False)
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=os.path.abspath(path))
    curves = [o for o in bpy.data.objects if o not in before and o.type == "CURVE"]
    if not curves:
        raise SystemExit(f"No filled shapes found in {path}. Convert strokes and text to paths and try again.")
    return curves


def make_text(text, font):
    curve = bpy.data.curves.new("LogoText", "FONT")
    curve.body = text
    curve.align_x, curve.align_y = "CENTER", "CENTER"
    if font:
        curve.font = bpy.data.fonts.load(os.path.abspath(font))
    obj = bpy.data.objects.new("LogoText", curve)
    bpy.context.collection.objects.link(obj)
    return [obj]


def build(curves, width, depth, bevel):
    """Join, extrude and bevel in the file's own units, mesh it, then scale to `width`.

    Scaling a curve object and then setting extrude/bevel mixes two unit
    systems; doing the extrusion first and scaling the finished mesh does not.
    """
    for c in curves:
        c.data.dimensions = "2D"
        c.data.fill_mode = "BOTH"
    bpy.ops.object.select_all(action="DESELECT")
    for c in curves:
        c.select_set(True)
    bpy.context.view_layer.objects.active = curves[0]
    if len(curves) > 1:
        bpy.ops.object.join()
    logo = bpy.context.view_layer.objects.active
    logo.name = "Logo"
    bpy.ops.object.select_all(action="DESELECT")
    logo.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.context.view_layer.update()
    raw = max(logo.dimensions.x, logo.dimensions.y, 1e-9)
    k = raw / width  # file units per scene unit
    logo.data.extrude = depth / 2 * k
    logo.data.bevel_depth = bevel * k
    logo.data.bevel_resolution = 6
    logo.data.resolution_u = 24
    try:
        logo.data.bevel_mode = "ROUND"
    except AttributeError:
        pass
    bpy.ops.object.convert(target="MESH")
    logo = bpy.context.view_layer.objects.active
    logo.scale = (1 / k, 1 / k, 1 / k)
    # Stand it up facing the camera on +Y, reading left to right from there:
    # X→−X, Y→Z, Z→Y (90° about X, then 180° about Z).
    logo.rotation_euler = (math.radians(90), 0, math.radians(180))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    logo.location = (0, 0, 0)
    studio.smooth(logo, 30)
    bpy.context.view_layer.update()
    d = logo.dimensions
    print(f"[logo] {d.x:.2f} × {d.z:.2f} units, {d.y:.2f} deep, {len(logo.data.polygons)} faces")
    return logo


def main():
    ap = argparse.ArgumentParser(prog="logo_extrude.py", description="SVG logo → 3D (see the file header).")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--svg")
    src.add_argument("--text")
    ap.add_argument("--font", help="TTF/OTF for --text")
    ap.add_argument("--out", required=True)
    ap.add_argument("--name")
    ap.add_argument("--material", choices=sorted(MATERIALS), default="chrome")
    ap.add_argument("--anim", choices=["turntable", "reveal"], default="reveal")
    ap.add_argument("--look", choices=sorted(studio.LOOKS), default="graphite")
    ap.add_argument("--width", type=float, default=2.0, help="logo width in scene units")
    ap.add_argument("--depth", type=float, default=0.18)
    ap.add_argument("--bevel", type=float, default=0.018)
    ap.add_argument("--turn", type=float, default=40)
    ap.add_argument("--frames", type=int, default=120)
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--res", default="1920x1080")
    ap.add_argument("--engine", choices=["eevee", "cycles"], default="eevee")
    ap.add_argument("--samples", type=int)
    ap.add_argument("--lens", type=float, default=85)
    ap.add_argument("--only", choices=["plate", "cutout"])
    ap.add_argument("--save-blend")
    ap.add_argument("--no-render", action="store_true", help="build (and --save-blend) the scene without rendering")
    args = ap.parse_args(studio.script_args())

    w, h = (int(v) for v in args.res.lower().split("x"))
    look = studio.LOOKS[args.look]
    studio.reset()
    samples = args.samples or (64 if args.engine == "cycles" or args.material == "glass" else 32)
    studio.setup_render(args.engine, samples, (w, h), args.fps, args.frames)
    studio.world(look["world"])
    backdrop = studio.backdrop(look, depth=-3.2)

    curves = import_svg(args.svg) if args.svg else make_text(args.text, args.font)
    logo = build(curves, args.width, args.depth, args.bevel)
    studio.assign(logo, studio.material("LogoMat", **MATERIALS[args.material]))
    size = logo.dimensions.copy()  # at rest, before the animation moves it
    cz = 1.0
    logo.location = (0, 0, cz)

    n = args.frames
    if args.anim == "reveal":
        # Lies back, rises and turns into place, then holds while light moves over it.
        settle = max(2, int(n * 0.45))
        logo.rotation_euler = (math.radians(-75), 0, math.radians(-25))
        logo.scale = (0.85, 0.85, 0.85)
        logo.location = (0, 0.6, cz - 0.25)
        for prop in ("rotation_euler", "scale", "location"):
            logo.keyframe_insert(prop, frame=1)
        logo.rotation_euler = (0, 0, 0)
        logo.scale = (1, 1, 1)
        logo.location = (0, 0, cz)
        for prop in ("rotation_euler", "scale", "location"):
            logo.keyframe_insert(prop, frame=settle)
        logo.rotation_euler = (0, 0, math.radians(4))
        logo.keyframe_insert("rotation_euler", frame=n)
    else:
        logo.rotation_euler = (0, 0, math.radians(-args.turn / 2))
        logo.keyframe_insert("rotation_euler", frame=1)
        logo.rotation_euler = (0, 0, math.radians(args.turn / 2))
        logo.keyframe_insert("rotation_euler", frame=n)
    studio.ease_keys(logo)

    studio.lights(look, center=(0, 0, cz))
    # The sweep: a tall thin softbox crossing in front, seen only as a reflection gliding over the face.
    sweep = studio.area("Sweep", (-4.0, 3.0, cz), (0, 0, cz), 0.25, 900, size_y=6.0)
    start = int(n * 0.45) if args.anim == "reveal" else 1
    sweep.keyframe_insert("location", frame=start)
    sweep.location = (4.0, 3.0, cz)
    sweep.keyframe_insert("location", frame=n)
    studio.ease_keys(sweep)

    dist = studio.framing_distance(size.x, size.z, args.lens, (w, h), fill_h=0.5, fill_w=0.6)
    studio.camera(n, lens=args.lens, start=(0.15, dist * 1.06, cz + 0.12), end=(-0.05, dist * 0.96, cz + 0.05),
                  target=(0, 0, cz), orbit_deg=6)
    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save_blend))
    if args.no_render:
        print("[studio] scene built, not rendered (--no-render)")
        return
    name = args.name or os.path.basename(os.path.normpath(args.out))
    source = f"blender:logo_extrude:{os.path.basename(args.svg) if args.svg else 'text'}"
    studio.render_passes(args.out, name, [backdrop], args.fps, n, source,
                         skip_plate=args.only == "cutout", skip_cutout=args.only == "plate")


if __name__ == "__main__":
    main()
