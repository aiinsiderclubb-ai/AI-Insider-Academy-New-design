"""Procedural product shot in Blender: a hero object turning in a studio.

Run with Blender in the background (no window):

    blender -b -P product_turntable.py -- --out public/footage/device --product device
    blender -b -P product_turntable.py -- --out public/footage/bottle --product bottle \
        --frames 150 --res 1920x1080 --look warm --engine cycles --samples 64

What it builds (all from code, no model files):
  device        a premium phone/tablet back: titanium frame, frosted glass,
                raised camera module with three lenses and a flash
  bottle        a perfume/spirits bottle: thick amber glass, metal cap
  earbuds-case  a glossy white pill-shaped case with a seam and status light

Studio: seamless sweep backdrop (--look graphite | studio-white | warm |
night-blue), top softbox, key, fill, two cool rims, a light pool on the
backdrop. The product floats a little above the floor, turns slowly
(--turn degrees over the shot) and bobs; the camera pushes in on eased
Bézier keys while swinging --orbit degrees around it.

Output (the layout footage-composite and the Remotion template read):
    <out>/plate/frame_00001.png …   full frame with backdrop (RGB)
    <out>/cutout/frame_00001.png …  the product only, RGBA (backdrop hidden
                                    from camera but still lit and reflected,
                                    so the cutout sits back on the plate exactly)
    <out>/meta.json                 {"name","fps","count","width","height","source","engine"}

Options:
    --frames 180 --fps 30 --res 1080x1920
    --engine eevee|cycles  (EEVEE: ~1 s/frame, previews and most finals;
                            Cycles: real glass and caustics, slower)
    --samples N            (EEVEE default 32, Cycles default 48)
    --turn 50 --orbit 12 --lens 70
    --only plate|cutout    render one pass
    --save-blend path.blend  keep the scene to open and tweak in Blender
    --no-render            only build the scene (with --save-blend)
"""
from __future__ import annotations

import argparse
import math
import os
import sys

import bmesh
import bpy

sys.dont_write_bytecode = True  # keep the product folder free of __pycache__
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import studio  # noqa: E402


def rounded_slab(name, width, height, depth, radius, segments=12, edge=0.012):
    """A box whose corners (seen face-on) are rounded, with softly broken edges."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (width, depth, height)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.edges.ensure_lookup_table()
    # The four edges running along Y (thickness) are the corners seen from the front.
    corners = [e for e in bm.edges if abs(e.verts[0].co.y - e.verts[1].co.y) > depth * 0.5]
    bmesh.ops.bevel(bm, geom=corners, offset=radius, segments=segments, affect="EDGES", profile=0.5)
    bm.to_mesh(obj.data)
    bm.free()
    if edge > 0:
        mod = obj.modifiers.new("edge", "BEVEL")
        mod.width = edge
        mod.segments = 4
        mod.limit_method = "ANGLE"
        mod.harden_normals = False
    studio.smooth(obj, 40)
    return obj


def cylinder(name, radius, depth, location, rotation=(math.pi / 2, 0, 0), vertices=96):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=vertices, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    mod = obj.modifiers.new("edge", "BEVEL")
    mod.width = min(radius, depth) * 0.15
    mod.segments = 3
    studio.smooth(obj, 40)
    return obj


def parent(children, root):
    for c in children:
        c.parent = root
        c.matrix_parent_inverse = root.matrix_world.inverted()


def build_device(look):
    w, h, d = 0.75, 1.55, 0.085
    titanium = studio.material("Titanium", (0.48, 0.47, 0.45), metallic=1.0, roughness=0.32, anisotropic=0.3)
    frosted = studio.material("FrostedGlass", (0.06, 0.065, 0.075), roughness=0.38, coat=1.0)
    glass = studio.material("LensGlass", (0.005, 0.006, 0.01), roughness=0.05, coat=1.0)
    ring = studio.material("LensRing", (0.6, 0.6, 0.62), metallic=1.0, roughness=0.15)
    module_mat = studio.material("Module", (0.05, 0.055, 0.06), roughness=0.12, coat=1.0)
    flash = studio.material("Flash", (0.95, 0.9, 0.75), roughness=0.3, emission=(1.0, 0.95, 0.85), emission_strength=0.6)

    body = rounded_slab("Body", w, h, d, 0.12)
    studio.assign(body, titanium)
    back = rounded_slab("BackGlass", w - 0.03, h - 0.03, 0.006, 0.105, edge=0.002)
    back.location = (0, d / 2 + 0.001, 0)
    studio.assign(back, frosted)
    module = rounded_slab("Module", 0.33, 0.33, 0.024, 0.08, edge=0.008)
    # Object −X shows on the camera's right, so +X puts the module top-left, as on a real phone back.
    mx, mz = w / 2 - 0.215, h / 2 - 0.215
    module.location = (mx, d / 2 + 0.012, mz)
    studio.assign(module, module_mat)
    parts = [back, module]
    for i, (dx, dz) in enumerate(((0.07, 0.07), (0.07, -0.07), (-0.075, 0.0))):
        lens_ring = cylinder(f"Ring{i}", 0.058, 0.03, (mx + dx, d / 2 + 0.03, mz + dz))
        studio.assign(lens_ring, ring)
        lens = cylinder(f"Lens{i}", 0.044, 0.032, (mx + dx, d / 2 + 0.032, mz + dz))
        studio.assign(lens, glass)
        parts += [lens_ring, lens]
    fl = cylinder("Flash", 0.018, 0.026, (mx - 0.075, d / 2 + 0.028, mz + 0.105))
    studio.assign(fl, flash)
    logo = cylinder("Logo", 0.07, 0.002, (0, d / 2 + 0.005, 0.05), vertices=128)
    studio.assign(logo, studio.material("Logo", (0.7, 0.7, 0.72), metallic=1.0, roughness=0.28))
    parts += [fl, logo]
    parent(parts, body)
    return body, h


def build_bottle(look):
    amber = studio.material("Amber", (0.85, 0.45, 0.12), roughness=0.02, transmission=1.0, ior=1.5)
    metal = studio.material("Cap", (0.75, 0.6, 0.35), metallic=1.0, roughness=0.2)
    label = studio.material("Label", (0.92, 0.9, 0.85), roughness=0.55)
    body = rounded_slab("Body", 0.62, 0.95, 0.62, 0.14, edge=0.03)
    studio.assign(body, amber)
    neck = cylinder("Neck", 0.09, 0.12, (0, 0, 0.53), rotation=(0, 0, 0))
    studio.assign(neck, amber)
    cap = cylinder("Cap", 0.16, 0.34, (0, 0, 0.75), rotation=(0, 0, 0))
    studio.assign(cap, metal)
    tag = rounded_slab("Label", 0.4, 0.28, 0.004, 0.03, edge=0.001)
    tag.location = (0, 0.312, -0.05)
    studio.assign(tag, label)
    parent([neck, cap, tag], body)
    return body, 1.3


def build_case(look):
    white = studio.material("Gloss", (0.92, 0.92, 0.9), roughness=0.12, coat=1.0)
    seam_mat = studio.material("Seam", (0.02, 0.02, 0.02), roughness=0.6)
    led = studio.material("LED", (0.2, 1.0, 0.4), emission=(0.2, 1.0, 0.4), emission_strength=6.0)
    body = rounded_slab("Body", 0.95, 0.75, 0.38, 0.3, segments=16, edge=0.09)
    studio.assign(body, white)
    # The lid line sits where the sides are still straight, so it never pokes out of the curve.
    seam = rounded_slab("Seam", 0.9, 0.006, 0.386, 0.002, edge=0.0)
    seam.location = (0, 0, 0.06)
    studio.assign(seam, seam_mat)
    light = cylinder("Status", 0.012, 0.01, (0, 0.19, -0.05))
    studio.assign(light, led)
    parent([seam, light], body)
    return body, 0.75


BUILDERS = {"device": build_device, "bottle": build_bottle, "earbuds-case": build_case}


def main():
    ap = argparse.ArgumentParser(prog="product_turntable.py", description="Procedural product shot (see the file header).")
    ap.add_argument("--out", required=True)
    ap.add_argument("--name")
    ap.add_argument("--product", choices=sorted(BUILDERS), default="device")
    ap.add_argument("--look", choices=sorted(studio.LOOKS), default="graphite")
    ap.add_argument("--frames", type=int, default=180)
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--res", default="1080x1920")
    ap.add_argument("--engine", choices=["eevee", "cycles"], default="eevee")
    ap.add_argument("--samples", type=int)
    ap.add_argument("--turn", type=float, default=50, help="degrees the product turns over the shot")
    ap.add_argument("--orbit", type=float, default=12, help="degrees the camera swings around it")
    ap.add_argument("--lens", type=float, default=70)
    ap.add_argument("--only", choices=["plate", "cutout"])
    ap.add_argument("--save-blend")
    ap.add_argument("--no-render", action="store_true", help="build (and --save-blend) the scene without rendering")
    args = ap.parse_args(studio.script_args())

    w, h = (int(v) for v in args.res.lower().split("x"))
    look = studio.LOOKS[args.look]
    studio.reset()
    samples = args.samples or (48 if args.engine == "cycles" else 32)
    studio.setup_render(args.engine, samples, (w, h), args.fps, args.frames)
    studio.world(look["world"])
    backdrop = studio.backdrop(look)

    product, _ = BUILDERS[args.product](look)
    # Measure the real object (cap, camera bump and all) and float it just above the floor.
    lo, hi = studio.bounds(product)
    height, width = hi.z - lo.z, max(hi.x - lo.x, hi.y - lo.y)
    lift = 0.12
    center_z = lift + height / 2
    pivot_offset = (lo.z + hi.z) / 2 - product.location.z
    product.location = (0, 0, center_z - pivot_offset)
    product.rotation_euler = (math.radians(4), 0, math.radians(-args.turn * 0.6))
    product.keyframe_insert("rotation_euler", frame=1)
    product.rotation_euler = (math.radians(2), 0, math.radians(args.turn * 0.4))
    product.keyframe_insert("rotation_euler", frame=args.frames)
    # Gentle float: up and back down once over the shot.
    base_z = product.location.z
    for f, dz in ((1, 0.0), (args.frames // 2, 0.025), (args.frames, 0.0)):
        product.location = (0, 0, base_z + dz)
        product.keyframe_insert("location", frame=f)
    studio.ease_keys(product)

    studio.lights(look, center=(0, 0, center_z))
    dist0 = studio.framing_distance(width, height, args.lens, (w, h))
    studio.camera(
        args.frames,
        lens=args.lens,
        start=(dist0 * 0.08, dist0 * 1.12, center_z + 0.12),
        end=(-dist0 * 0.03, dist0 * 0.92, center_z + 0.04),
        target=(0, 0, center_z),
        orbit_deg=args.orbit,
    )
    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save_blend))
    if args.no_render:
        print("[studio] scene built, not rendered (--no-render)")
        return
    name = args.name or os.path.basename(os.path.normpath(args.out))
    studio.render_passes(
        args.out, name, [backdrop], args.fps, args.frames, f"blender:product_turntable:{args.product}",
        skip_plate=args.only == "cutout", skip_cutout=args.only == "plate",
    )


if __name__ == "__main__":
    main()
