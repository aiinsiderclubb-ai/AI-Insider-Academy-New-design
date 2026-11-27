"""Shared studio for the Blender scripts in this folder: not run on its own.

Builds what every product shot needs, the way a 3D artist sets up a
Cinema 4D / Blender studio scene:

  - render engine (EEVEE by default, Cycles for final glass and caustics),
    AgX colour management so highlights roll off like film;
  - a seamless sweep backdrop with a light pool, invisible to the camera in
    the cutout pass but still lighting and reflecting into the product;
  - softbox lighting: big top box, key, two cool rims, a backdrop kicker;
  - a camera on a slow orbit + push-in with eased keyframes;
  - two passes per frame range: plate/ (with backdrop) and cutout/ (RGBA,
    product only, film transparent) as frame_00001.png sequences, plus
    meta.json — the layout the Remotion template and footage-composite use.

Works on Blender 4.2 – 5.x (EEVEE Next is called BLENDER_EEVEE_NEXT in
4.2–4.4 and BLENDER_EEVEE again from 5.0; both are detected).
"""
from __future__ import annotations

import json
import math
import os
import shutil
import sys
import time

import bpy
from mathutils import Vector

LOOKS = {
    # backdrop colour, pool strength, rim colour, world strength, key strength
    "graphite": {"backdrop": (0.011, 0.012, 0.014), "pool": 70, "rim": (0.55, 0.7, 1.0), "world": 0.01, "key": 0.5},
    "studio-white": {"backdrop": (0.8, 0.8, 0.8), "pool": 220, "rim": (1.0, 1.0, 1.0), "world": 0.4, "key": 1.0},
    "warm": {"backdrop": (0.04, 0.024, 0.015), "pool": 90, "rim": (1.0, 0.7, 0.45), "world": 0.015, "key": 0.6},
    "night-blue": {"backdrop": (0.006, 0.009, 0.02), "pool": 60, "rim": (0.3, 0.55, 1.0), "world": 0.01, "key": 0.45},
}


def script_args():
    """Arguments after the '--' that Blender leaves to the script."""
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(engine, samples, res, fps, frames):
    scene = bpy.context.scene
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    if engine == "cycles":
        scene.render.engine = "CYCLES"
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        try:  # GPU when there is one; Metal on Apple Silicon.
            prefs = bpy.context.preferences.addons["cycles"].preferences
            for backend in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
                try:
                    prefs.compute_device_type = backend
                    prefs.get_devices()
                    if any(d.type == backend for d in prefs.devices):
                        for d in prefs.devices:
                            d.use = True
                        scene.cycles.device = "GPU"
                        break
                except TypeError:
                    continue
        except Exception:
            pass
    else:
        scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in ids else "BLENDER_EEVEE"
        ee = scene.eevee
        ee.taa_render_samples = samples
        for prop, value in (("use_raytracing", True), ("use_shadows", True), ("use_gtao", True), ("use_bloom", False)):
            if hasattr(ee, prop):
                setattr(ee, prop, value)
    w, h = res
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.fps = int(round(fps))
    scene.render.fps_base = scene.render.fps / fps
    scene.frame_start, scene.frame_end = 1, frames
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.compression = 30
    for vt, look in (("AgX", "AgX - Medium High Contrast"), ("AgX", "None"), ("Filmic", "Medium High Contrast")):
        try:
            scene.view_settings.view_transform = vt
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    return scene


def material(name, color=(0.8, 0.8, 0.8), metallic=0.0, roughness=0.4, coat=0.0, transmission=0.0,
             ior=1.45, emission=None, emission_strength=0.0, alpha=1.0, anisotropic=0.0, specular=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    sockets = bsdf.inputs

    def put(names, value):
        for n in names:
            if n in sockets:
                sockets[n].default_value = value
                return

    put(["Base Color"], (*color, 1.0))
    put(["Metallic"], metallic)
    put(["Roughness"], roughness)
    put(["Coat Weight", "Clearcoat"], coat)
    put(["Coat Roughness", "Clearcoat Roughness"], 0.04)
    put(["Transmission Weight", "Transmission"], transmission)
    put(["IOR"], ior)
    put(["Anisotropic"], anisotropic)
    put(["Specular IOR Level", "Specular"], specular)
    put(["Alpha"], alpha)
    if emission:
        put(["Emission Color", "Emission"], (*emission, 1.0))
        put(["Emission Strength"], emission_strength)
    if transmission > 0:
        # EEVEE needs refraction switched on per material, or glass renders black.
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "DITHERED"
        for prop in ("use_raytrace_refraction", "use_screen_refraction"):
            if hasattr(mat, prop):
                setattr(mat, prop, True)
        if hasattr(mat, "thickness_mode"):
            mat.thickness_mode = "SPHERE"
    return mat


def bounds(root):
    """World-space bounding box of an object and its children: (min Vector, max Vector)."""
    bpy.context.view_layer.update()
    objs = [root] + list(root.children_recursive)
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def framing_distance(width, height, lens, res, fill_h=0.62, fill_w=0.7):
    """Camera distance so the subject fills fill_h of the frame height and at most fill_w of its width."""
    w, h = res
    # Blender's sensor (AUTO fit) spans the longer side of the frame.
    v_sensor = 36.0 if h >= w else 36.0 * h / w
    h_sensor = 36.0 * w / h if h >= w else 36.0
    return max((height / fill_h) / (v_sensor / lens), (width / fill_w) / (h_sensor / lens))


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def smooth(obj, angle=35):
    """Smooth shading with sharp edges kept — the clean CG product look."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except (AttributeError, RuntimeError, TypeError):
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
        except (AttributeError, RuntimeError, TypeError):
            bpy.ops.object.shade_smooth()
    obj.select_set(False)


def world(strength, color=(0.02, 0.022, 0.026)):
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*color, 1.0)
    bg.inputs["Strength"].default_value = strength


def backdrop(look, floor_y=0.0, depth=-3.2):
    """Seamless sweep: floor curving up into a wall, like a photo studio cyc."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    obj = bpy.context.object
    obj.name = "Backdrop"
    mesh = obj.data
    import bmesh

    bm = bmesh.new()
    radius, width, segs = 1.6, 14.0, 24
    verts = []
    # Profile in (y, z): floor from front to the curve, then up the wall.
    profile = [(4.0, floor_y), (depth + radius, floor_y)]
    for i in range(1, segs):
        a = (i / segs) * (math.pi / 2)
        profile.append((depth + radius - math.sin(a) * radius, floor_y + radius - math.cos(a) * radius))
    profile += [(depth, floor_y + radius), (depth, floor_y + 9.0)]
    for x in (-width / 2, width / 2):
        verts.append([bm.verts.new((x, y, z)) for y, z in profile])
    for i in range(len(profile) - 1):
        bm.faces.new((verts[0][i], verts[1][i], verts[1][i + 1], verts[0][i + 1]))
    bm.to_mesh(mesh)
    bm.free()
    smooth(obj, 80)
    # Matte and nearly non-specular: a glossy sweep would mirror the softboxes
    # and turn a dark studio grey. The light pool gives the gradient instead.
    assign(obj, material("Backdrop", look["backdrop"], roughness=0.92, specular=0.15))
    return obj


def area(name, location, target, size, power, color=(1, 1, 1), shape="RECTANGLE", size_y=None):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.color = color
    data.shape = shape
    data.size = size
    if size_y and shape in ("RECTANGLE", "ELLIPSE"):
        data.size_y = size_y
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    direction = Vector(target) - Vector(location)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


def lights(look, center=(0, 0, 0.9)):
    """Product softbox rig. Rims are cool and strong: they draw the silhouette."""
    k = look["key"]
    c = Vector(center)
    area("Top", c + Vector((0, 0.3, 2.6)), c, 2.4, 260 * k, size_y=1.6)
    area("Key", c + Vector((-2.2, 2.4, 0.8)), c, 1.6, 220 * k, size_y=2.2)
    area("Fill", c + Vector((2.6, 2.0, 0.2)), c, 2.0, 30 * k)
    area("RimL", c + Vector((-1.6, -1.4, 0.6)), c, 0.3, 240, look["rim"], size_y=2.8)
    area("RimR", c + Vector((1.7, -1.3, 0.9)), c, 0.3, 280, look["rim"], size_y=2.8)
    area("Pool", (0, -1.6, 4.2), (0, -3.2, 1.2), 1.6, look["pool"] * 2, shape="ELLIPSE", size_y=1.6)


def camera(frames, lens=70, start=(0.35, 4.4, 1.05), end=(-0.15, 3.5, 0.98), target=(0, 0, 0.9), orbit_deg=0.0):
    """Eased move from start to end, optionally swinging around the target."""
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = lens
    cam_data.sensor_width = 36
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 4.0
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    aim = bpy.data.objects.new("Aim", None)
    bpy.context.collection.objects.link(aim)
    aim.location = target
    con = cam.constraints.new("TRACK_TO")
    con.target = aim
    con.track_axis, con.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    cam_data.dof.focus_object = aim

    def place(p, swing):
        v = Vector(p) - Vector(target)
        a = math.radians(swing)
        rot = Vector((v.x * math.cos(a) - v.y * math.sin(a), v.x * math.sin(a) + v.y * math.cos(a), v.z))
        return Vector(target) + rot

    cam.location = place(start, -orbit_deg / 2)
    cam.keyframe_insert("location", frame=1)
    cam.location = place(end, orbit_deg / 2)
    cam.keyframe_insert("location", frame=frames)
    ease_keys(cam)
    return cam, aim


def ease_keys(obj, easing="AUTO", interpolation="BEZIER"):
    """Bézier keys with auto-clamped handles: slow in, slow out, no overshoot."""
    ad = obj.animation_data
    if not ad or not ad.action:
        return
    curves = []
    try:
        curves = list(ad.action.fcurves)
    except AttributeError:
        pass
    if not curves:  # Blender 5 layered actions
        try:
            for layer in ad.action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        curves += list(bag.fcurves)
        except AttributeError:
            pass
    for fc in curves:
        for kp in fc.keyframe_points:
            kp.interpolation = interpolation
            kp.easing = easing
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"


def render_passes(out_dir, name, hide_for_cutout, fps, frames, source, skip_plate=False, skip_cutout=False):
    """plate/ with everything; cutout/ with the backdrop invisible to camera and transparent film."""
    scene = bpy.context.scene
    seq = os.path.abspath(out_dir)
    os.makedirs(seq, exist_ok=True)
    timings = {}
    for label in ("plate", "cutout"):
        if (label == "plate" and skip_plate) or (label == "cutout" and skip_cutout):
            continue
        folder = os.path.join(seq, label)
        if os.path.isdir(folder):
            shutil.rmtree(folder)
        os.makedirs(folder)
        cut = label == "cutout"
        scene.render.film_transparent = cut
        scene.render.image_settings.color_mode = "RGBA" if cut else "RGB"
        for obj in hide_for_cutout:
            # Invisible to the camera, still in reflections and bounce light:
            # the product is shaded exactly as in the plate, so it sits back on it seamlessly.
            obj.visible_camera = not cut
        scene.render.filepath = os.path.join(folder, "frame_#####")
        t0 = time.time()
        bpy.ops.render.render(animation=True)
        timings[label] = time.time() - t0
    meta = {
        "name": name,
        "fps": fps,
        "count": frames,
        "width": scene.render.resolution_x,
        "height": scene.render.resolution_y,
        "source": source,
        "engine": scene.render.engine,
    }
    with open(os.path.join(seq, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    for label, secs in timings.items():
        print(f"[studio] {label}: {frames} frames in {secs:.1f} s ({secs / frames:.2f} s/frame)")
    print(f"[studio] wrote {seq}/plate, cutout, meta.json")
    return timings
