"""Build the Harvester particle atlas and every `harvester:*` particle effect.

Writes:
  TheHarvesterRP/textures/particle/harvester_particles.png
  TheHarvesterRP/particles/harvester_*.json

Script-side Molang variables (set with MolangVariableMap.setFloat):
  v.dir_x / v.dir_y / v.dir_z, v.speed, v.life   flying particles (souls)
  v.radius, v.duration, v.life                   areas, rings, burning ground
  v.cr / v.cg / v.cb                             telegraph colour (0..1)
  v.spin                                         scythe arcs, footprints, coffins
  v.stacks (1..5), v.frame                       plague pips, hourglass / candle frame
  v.a0, v.r0, v.w, v.shrink                      Danse Macabre dancers (angle deg, radius, deg/s, blocks/s)
The soulfire_* emitters loop forever: the resource pack attaches them to the boss (see animations.py).
"""
import json
import os

import numpy as np
from PIL import Image

import art

ATLAS = 256
TEXTURE = "textures/particle/harvester_particles"


def pack(sprites):
    """Shelf-pack every sprite (frames side by side) into one atlas. Returns image and uv table."""
    atlas = np.zeros((ATLAS, ATLAS, 4), dtype=np.uint8)
    order = sorted(sprites.items(), key=lambda kv: (-kv[1][0].shape[0], -len(kv[1]) * kv[1][0].shape[1]))
    x = y = shelf = 0
    table = {}
    for name, frames in order:
        h, w = frames[0].shape[:2]
        total = w * len(frames)
        if x + total > ATLAS:
            x, y = 0, y + shelf
            shelf = 0
        if y + h > ATLAS:
            raise ValueError("atlas full at " + name)
        for i, frame in enumerate(frames):
            atlas[y:y + h, x + i * w:x + (i + 1) * w] = frame
        table[name] = {"u": x, "v": y, "w": w, "h": h, "frames": len(frames)}
        x += total
        shelf = max(shelf, h)
    return atlas, table


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------

UV = {}


def flipbook(name, fps=10, loop=True, stretch=False):
    s = UV[name]
    book = {
        "base_UV": [s["u"], s["v"]],
        "size_UV": [s["w"], s["h"]],
        "step_UV": [s["w"], 0],
        "frames_per_second": fps,
        "max_frame": s["frames"],
        "loop": loop,
    }
    if stretch:
        book["stretch_to_lifetime"] = True
        book.pop("frames_per_second")
    return {"texture_width": ATLAS, "texture_height": ATLAS, "flipbook": book}


def still(name, frame_expr=None):
    s = UV[name]
    u = s["u"] if frame_expr is None else "%d + math.clamp(%s, 0, %d) * %d" % (s["u"], frame_expr, s["frames"] - 1, s["w"])
    return {"texture_width": ATLAS, "texture_height": ATLAS, "uv": [u, s["v"]], "uv_size": [s["w"], s["h"]]}


def billboard(size, uv, facing="rotate_xyz"):
    if not isinstance(size, (list, tuple)):
        size = [size, size]
    return {"minecraft:particle_appearance_billboard": {"size": list(size), "facing_camera_mode": facing, "uv": uv}}


def tint(gradient):
    return {"minecraft:particle_appearance_tinting": {"color": {
        "interpolant": "v.particle_age / v.particle_lifetime", "gradient": gradient}}}


def tint_vars(alpha):
    return {"minecraft:particle_appearance_tinting": {"color": ["v.cr", "v.cg", "v.cb", alpha]}}


def once(n=1, active=0.05):
    return {
        "minecraft:emitter_rate_instant": {"num_particles": n},
        "minecraft:emitter_lifetime_once": {"active_time": active},
    }


def steady(rate, max_particles, active):
    return {
        "minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": max_particles},
        "minecraft:emitter_lifetime_once": {"active_time": active},
    }


def point(direction=None, offset=None):
    shape = {}
    if direction is not None:
        shape["direction"] = direction
    if offset is not None:
        shape["offset"] = offset
    return {"minecraft:emitter_shape_point": shape}


def sphere(radius, direction="outwards", surface=False, offset=None):
    shape = {"radius": radius, "direction": direction}
    if surface:
        shape["surface_only"] = True
    if offset:
        shape["offset"] = offset
    return {"minecraft:emitter_shape_sphere": shape}


def disc(radius, direction="outwards", offset=None):
    shape = {"radius": radius, "plane_normal": "y", "direction": direction}
    if offset:
        shape["offset"] = offset
    return {"minecraft:emitter_shape_disc": shape}


def life(expr):
    return {"minecraft:particle_lifetime_expression": {"max_lifetime": expr}}


def speed(expr):
    return {"minecraft:particle_initial_speed": expr}


def spin(rotation=0, rate=0):
    return {"minecraft:particle_initial_spin": {"rotation": rotation, "rotation_rate": rate}}


def dynamic(accel=(0, 0, 0), drag=0, rot_drag=None):
    motion = {"linear_acceleration": list(accel), "linear_drag_coefficient": drag}
    if rot_drag is not None:
        motion["rotation_drag_coefficient"] = rot_drag
    return {"minecraft:particle_motion_dynamic": motion}


def parametric(relative_position):
    return {"minecraft:particle_motion_parametric": {"relative_position": relative_position}}


def local_space():
    return {"minecraft:emitter_local_space": {"position": True, "rotation": False}}


T = "v.particle_age / v.particle_lifetime"

WHITE_FADE = {"0.0": "#FFFFFFFF", "0.7": "#FFFFFFFF", "1.0": "#00FFFFFF"}
FLAME_FADE = {"0.0": "#00FFFFFF", "0.12": "#FFFFFFFF", "0.7": "#FFFFFFFF", "1.0": "#00FFFFFF"}
SOUL_FADE = {"0.0": "#FFFFFFFF", "0.6": "#E6FFFFFF", "1.0": "#00FFFFFF"}
# every tint is drawn from the model's teal (1DE9B6 / 32AF8E / 00695C) and its near-black robe
PLAGUE_GAS = {"0.0": "#0040B08A", "0.15": "#C0309A76", "0.7": "#9C1E6E56", "1.0": "#000E3A2E"}
DARK_GAS = {"0.0": "#00102422", "0.2": "#D8102422", "0.75": "#B0081614", "1.0": "#00040C0A"}
TEAL_SMOKE = {"0.0": "#E01C4A44", "0.6": "#B0102C28", "1.0": "#00102C28"}
PLAGUE_BRIGHT = {"0.0": "#FF9CE8C4", "0.5": "#E040B08A", "1.0": "#001E6E56"}


def fade_in_out(fin=0.1, fout=0.8, alpha="FF"):
    return {"0.0": "#00FFFFFF", str(fin): "#%sFFFFFF" % alpha, str(fout): "#%sFFFFFF" % alpha, "1.0": "#00FFFFFF"}


def looping(rate, max_particles):
    return {
        "minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": max_particles},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
    }


def body_fire(rate, shape, size, life_range, rise, sprite="flame", tall=False, turbulence=1.4):
    """Soul fire that never stops pouring off the boss, Ghost Rider style: a looping emitter bound to a
    locator, flames that shoot up, wobble sideways and shrink away. World-space, so they trail behind
    him when he moves."""
    w = "(%s + %s * v.particle_random_2) * (1 - 0.5 * %s)" % (size[0], size[1] - size[0], T)
    wobble = "math.sin(v.particle_age * 700 + v.particle_random_3 * 360) * %s" % turbulence
    wobble_z = "math.cos(v.particle_age * 640 + v.particle_random_4 * 360) * %s" % turbulence
    return ("particles_blend", {
        **looping(rate, int(rate * 1.2) + 6), **shape,
        **life("math.random(%s, %s)" % life_range), **speed("math.random(%s, %s)" % rise),
        **{"minecraft:particle_motion_dynamic": {"linear_acceleration": [wobble, 2.4, wobble_z],
                                                 "linear_drag_coefficient": 1.3}},
        **billboard([w, "2 * " + w] if tall else [w, w], flipbook(sprite, 14), "lookat_y"),
        **tint(FLAME_FADE),
    })


def effects():
    E = {}

    # ---------------------------------------------------------------- soul fire (the Harvester's element)
    up_cone = ["math.random(-0.25, 0.25)", 1, "math.random(-0.25, 0.25)"]
    # Ghost Rider: the skull is a torch, fire pours off shoulders, hands, back and the whole scythe
    E["soulfire_skull"] = body_fire(26, disc(0.42, up_cone), (0.2, 0.3), (0.45, 0.7), (1.6, 2.8), "flame_tall", True)
    E["soulfire_skull_big"] = body_fire(42, disc(0.52, up_cone), (0.24, 0.36), (0.5, 0.85), (1.8, 3.2), "flame_tall", True, 1.8)
    E["soulfire_crown"] = body_fire(16, disc(0.48, up_cone), (0.1, 0.17), (0.35, 0.6), (0.8, 1.6))
    E["soulfire_hem"] = body_fire(24, disc(0.8, [0, 1, 0]), (0.14, 0.23), (0.55, 0.9), (0.9, 1.8))
    E["soulfire_hem_big"] = body_fire(40, disc(1.0, [0, 1, 0]), (0.18, 0.3), (0.6, 1.1), (1.2, 2.4), "flame", False, 1.8)
    E["soulfire_hand"] = body_fire(9, sphere(0.16, up_cone), (0.1, 0.17), (0.4, 0.65), (0.8, 1.5))
    E["soulfire_blade"] = body_fire(11, sphere(0.2, up_cone), (0.1, 0.16), (0.35, 0.6), (0.6, 1.3))
    E["soulfire_back"] = body_fire(14, disc(0.4, up_cone), (0.16, 0.26), (0.5, 0.8), (1.2, 2.2), "flame_tall", True)
    E["soulfire_embers"] = ("particles_blend", {
        **looping(12, 24), **sphere(0.7, up_cone),
        **life("math.random(0.8, 1.4)"), **speed("math.random(1.5, 3)"),
        **{"minecraft:particle_motion_dynamic": {
            "linear_acceleration": ["math.sin(v.particle_age * 500 + v.particle_random_3 * 360) * 2.5", 1.2,
                                    "math.cos(v.particle_age * 450 + v.particle_random_4 * 360) * 2.5"],
            "linear_drag_coefficient": 0.9}},
        **billboard("0.04 + 0.03 * v.particle_random_2", flipbook("ember", stretch=True, loop=False), "lookat_y"),
        **tint(WHITE_FADE),
    })
    E["soulfire_smoke"] = ("particles_blend", {
        **looping(6, 12), **disc(0.35, up_cone),
        **life("math.random(1.1, 1.6)"), **speed("math.random(1.4, 2.2)"), **dynamic((0, 0.6, 0), 1.2),
        **spin("math.random(0, 360)", "math.random(-60, 60)"),
        **billboard(["0.22 + 0.25 * %s" % T] * 2, flipbook("smoke", stretch=True, loop=False)),
        **tint(TEAL_SMOKE),
    })

    E["soul_flames"] = ("particles_blend", {
        **once(10), **disc(0.6, up_cone),
        **life("math.random(0.5, 0.9)"), **speed("math.random(2.5, 5)"), **dynamic((0, 0.5, 0), 2.4),
        **billboard(["(0.18 + 0.08 * v.particle_random_2) * (1 - 0.5 * %s)" % T] * 2, flipbook("flame", 14), "lookat_y"),
        **tint(FLAME_FADE),
    })
    E["fire_patch"] = ("particles_blend", {
        **steady("v.radius * 12 + 4", 140, "v.duration"), **disc("v.radius", [0, 1, 0], [0, 0.05, 0]),
        **life("math.random(0.5, 0.9)"), **speed("math.random(1.0, 2.0)"), **dynamic((0, 1.6, 0), 1.2),
        **billboard(["(0.14 + 0.1 * v.particle_random_2) * (1 - 0.5 * %s)" % T] * 2, flipbook("flame", 14), "lookat_y"),
        **tint(FLAME_FADE),
    })
    E["fire_column"] = ("particles_blend", {
        **once(5), **disc(0.35, [0, 1, 0]),
        **life("math.random(0.55, 0.8)"), **speed("math.random(1, 2.2)"), **dynamic((0, 1.5, 0), 1.5),
        **billboard(["0.42 + 0.12 * v.particle_random_2", "0.84 + 0.24 * v.particle_random_2"],
                    flipbook("flame_tall", 12), "lookat_y"),
        **tint(FLAME_FADE),
    })
    E["soul_pillar"] = ("particles_blend", {
        **steady(30, 100, "v.duration"), **disc(1.3, [0, 1, 0]),
        **life("math.random(1.0, 1.6)"), **speed("math.random(2.5, 4.5)"), **dynamic((0, 0.5, 0), 0.4),
        **billboard(["0.25 + 0.1 * v.particle_random_2", "0.5 + 0.2 * v.particle_random_2"],
                    flipbook("flame_tall", 12), "lookat_y"),
        **tint(FLAME_FADE),
    })
    E["ember"] = ("particles_blend", {
        **once(10), **sphere(0.2), **life("math.random(0.4, 0.8)"), **speed(4.5), **dynamic((0, 1.5, 0), 2.8),
        **billboard(0.07, flipbook("ember", stretch=True, loop=False), "lookat_y"), **tint(WHITE_FADE),
    })
    E["gem_pulse"] = ("particles_blend", {
        **once(1), **point(), **life(0.35),
        **billboard(["0.1 + 0.18 * %s" % T] * 2, still("ember"), "lookat_y"), **tint(WHITE_FADE),
    })
    E["eye_glow"] = ("particles_blend", {
        **once(1), **point([0, 1, 0]), **life(0.4), **speed(0.6),
        **billboard(0.06, flipbook("flame", 16), "lookat_y"), **tint(FLAME_FADE),
    })

    # ---------------------------------------------------------------- souls
    E["soul_wisp"] = ("particles_blend", {
        **once(1), **point(["math.random(-0.3, 0.3)", 1, "math.random(-0.3, 0.3)"]),
        **life("math.random(0.9, 1.4)"), **speed(0.8), **dynamic((0, 0.6, 0), 0.9),
        **billboard(["0.16 * (1 - 0.4 * %s)" % T] * 2, flipbook("ghost", 8)), **tint(SOUL_FADE),
    })
    E["soul_burst"] = ("particles_blend", {
        **once(12), **sphere(0.4), **life("math.random(0.8, 1.4)"), **speed("math.random(3, 5.5)"),
        **dynamic((0, 1.8, 0), 3.0),
        **billboard(0.2, flipbook("ghost", 8)), **tint(SOUL_FADE),
    })
    E["soul_stream"] = ("particles_blend", {
        **once(1), **point(["v.dir_x", "v.dir_y", "v.dir_z"]), **life("v.life"), **speed("v.speed"),
        **billboard(0.22, flipbook("ghost", 10)),
        **tint({"0.0": "#FFFFFFFF", "0.85": "#FFFFFFFF", "1.0": "#00FFFFFF"}),
    })

    # ---------------------------------------------------------------- scythe
    E["scythe_trail"] = ("particles_blend", {
        **once(1), **point(), **life(0.3), **spin("v.spin"),
        **billboard(["0.9 + 0.35 * %s" % T] * 2, flipbook("arc", stretch=True, loop=False)),
        **tint(WHITE_FADE),
    })
    E["scythe_trail_big"] = ("particles_blend", {
        **once(1), **point(), **life(0.4), **spin("v.spin"),
        **billboard(["2.0 + 0.6 * %s" % T] * 2, flipbook("arc", stretch=True, loop=False)),
        **tint(WHITE_FADE),
    })
    E["spectral_scythe"] = ("particles_blend", {
        **once(1), **point(), **life(0.62), **spin(-75, 300),
        **parametric([0, "1.1 - math.min(v.particle_age * 3, 1) * 0.9", 0]),
        **billboard(1.5, still("scythe"), "lookat_y"),
        **tint({"0.0": "#00FFFFFF", "0.12": "#FFFFFFFF", "0.7": "#FFFFFFFF", "1.0": "#00FFFFFF"}),
    })

    # ---------------------------------------------------------------- plague and smoke (curls)
    curl = lambda size: billboard(["%s + 0.12 * v.particle_random_2" % size] * 2,  # noqa: E731
                                  flipbook("smoke", stretch=True, loop=False))
    E["miasma"] = ("particles_blend", {
        **once(4), **sphere(0.45), **life("math.random(1.6, 2.4)"), **speed(0.35),
        **dynamic((0, 0.25, 0), 0.6), **spin("math.random(0, 360)", "math.random(-40, 40)"),
        **curl(0.35), **tint(PLAGUE_GAS),
    })
    E["blackdeath_field"] = ("particles_blend", {
        **steady("v.radius * 9", 160, "v.duration"), **disc("v.radius", [0, 1, 0], [0, 0.3, 0]),
        **life("math.random(2.0, 3.2)"), **speed(0.4), **dynamic((0, 0.2, 0), 0.4),
        **spin("math.random(0, 360)", "math.random(-25, 25)"),
        **curl(0.85), **tint(DARK_GAS),
    })
    E["black_smoke"] = ("particles_blend", {
        **once(12), **sphere(0.7), **life("math.random(0.7, 1.2)"), **speed(2.5),
        **dynamic((0, 0.8, 0), 3.0), **spin("math.random(0, 360)", "math.random(-90, 90)"),
        **curl(0.4), **tint(TEAL_SMOKE),
    })
    E["aura_mist"] = ("particles_blend", {
        **once(3), **disc(1.6, "outwards", [0, 0.15, 0]), **life("math.random(1.2, 1.6)"), **speed(0.3),
        **spin("math.random(0, 360)", "math.random(-30, 30)"),
        **curl(0.45), **tint({"0.0": "#00123A30", "0.3": "#90123A30", "1.0": "#000A221C"}),
    })
    E["black_rain"] = ("particles_blend", {
        **steady("v.radius * 10", 160, "v.duration"), **disc("v.radius", [0, -1, 0], [0, 7, 0]),
        **life(0.5), **speed(14),
        **billboard([0.035, 0.2], still("drop"), "lookat_y"),
        **tint({"0.0": "#C0123A30", "1.0": "#A00A1C18"}),
    })
    E["plague_drip"] = ("particles_blend", {
        **once(1), **point([0, -1, 0]), **life(0.5), **speed(0.5), **dynamic((0, -9, 0), 0.5),
        **billboard(0.06, still("drop")), **tint(PLAGUE_BRIGHT),
    })
    E["plague_splash"] = ("particles_blend", {
        **once(1), **point(), **life(0.45),
        **billboard(1.4, flipbook("splash", stretch=True, loop=False), "emitter_transform_xz"),
        **tint(WHITE_FADE),
    })
    E["ash_burst"] = ("particles_alpha", {
        **once(12), **disc(0.5, ["math.random(-0.5, 0.5)", 1, "math.random(-0.5, 0.5)"]),
        **life("math.random(0.8, 1.2)"), **speed("math.random(2, 3.5)"), **dynamic((0, -5, 0), 1.2),
        **spin("math.random(0, 360)", "math.random(-180, 180)"),
        **billboard(0.06, still("ash", "math.floor(v.particle_random_1 * 3)")),
    })

    # ---------------------------------------------------------------- ground telegraphs (engraved)
    pulse = "math.clamp(0.25 + 0.6 * %s + 0.15 * math.sin(v.particle_age * 900), 0, 1)" % T
    E["ground_warn"] = ("particles_add", {
        **once(1), **point(), **life("v.life"),
        **billboard(0.38, still("tile"), "emitter_transform_xz"), **tint_vars(pulse),
    })
    E["ring_warn"] = ("particles_add", {
        **once(1), **point(), **life("v.life"), **spin("math.random(0, 360)", 30),
        **billboard("v.radius", still("ring"), "emitter_transform_xz"), **tint_vars(pulse),
    })
    E["rune_circle"] = ("particles_add", {
        **once(1), **point(), **life("v.life"), **spin("math.random(0, 360)", 20),
        **billboard("v.radius", still("sigil"), "emitter_transform_xz"),
        **tint_vars("math.clamp(math.min(v.particle_age * 4, (v.particle_lifetime - v.particle_age) * 3), 0, 0.95)"),
    })
    E["shockwave"] = ("particles_add", {
        **once(1), **point(), **life("v.life"),
        **billboard(["0.3 + (v.radius - 0.3) * %s" % T] * 2, flipbook("wave", stretch=True, loop=False), "emitter_transform_xz"),
        **tint_vars("1 - math.pow(%s, 3)" % T),
    })
    E["skull_sigil"] = ("particles_blend", {
        **once(1), **point(), **life("v.life"),
        **billboard(["0.75 + 0.08 * math.sin(v.particle_age * 720)"] * 2, still("skull"), "emitter_transform_xz"),
        **tint(fade_in_out(0.15, 0.85)),
    })

    # ---------------------------------------------------------------- markers above heads
    E["plague_pips"] = ("particles_blend", {
        **once(1), **point(), **life(0.3),
        **billboard(0.2, still("pips", "v.stacks - 1"), "lookat_y"),
    })
    E["hourglass"] = ("particles_blend", {
        **once(1), **point(), **life(0.14),
        **billboard(0.24, still("hourglass", "v.frame"), "lookat_y"),
    })
    E["beak_sigil"] = ("particles_blend", {
        **once(1), **point(), **life(1.6),
        **parametric([0, "math.min(v.particle_age * 1.5, 1) * 0.8", 0]),
        **billboard(["0.6 + 0.5 * math.min(v.particle_age * 3, 1)"] * 2, still("beak"), "lookat_y"),
        **tint(fade_in_out(0.1, 0.7)),
    })
    E["death_mark"] = ("particles_blend", {
        **once(1), **point(), **life(0.3),
        **billboard(0.2, still("skull"), "lookat_y"),
    })
    E["lantern"] = ("particles_blend", {
        **once(1), **point(), **life("v.life"),
        **parametric([0, "math.sin(v.particle_age * 200) * 0.08", 0]),
        **billboard(0.28, flipbook("lantern", 5), "lookat_y"), **tint(fade_in_out(0.1, 0.85)),
    })

    # ---------------------------------------------------------------- the Harvester's rites (v1.5 skills)
    E["soul_wheat"] = ("particles_blend", {
        **once(1), **point(), **life("v.life"),
        **parametric([0, "-0.35 + math.min(v.particle_age * 3, 1) * 0.35", 0]),
        **billboard(0.32, flipbook("wheat", 6), "lookat_y"), **tint(fade_in_out(0.08, 0.9)),
    })
    E["wheat_burst"] = ("particles_blend", {
        **once(4), **point(up_cone), **life("math.random(0.35, 0.55)"), **speed("math.random(3, 5)"),
        **dynamic((0, 0, 0), 2.5),
        **billboard(["0.2 * (1 - 0.5 * %s)" % T] * 2, flipbook("flame", 14), "lookat_y"), **tint(FLAME_FADE),
    })
    E["candle"] = ("particles_blend", {
        **once(1), **point(), **life("v.life"),
        **billboard(0.3, still("candle", "v.frame"), "lookat_y"),
    })
    E["will_o_wisp"] = ("particles_blend", {
        **once(1), **point(), **life(0.3),
        **billboard(["0.34 * (1 - 0.5 * %s)" % T] * 2, flipbook("wisp", 12)),
        **tint({"0.0": "#FFFFFFFF", "0.35": "#FFFFFFFF", "1.0": "#00FFFFFF"}),
    })
    E["footprint"] = ("particles_blend", {
        **once(1), **point(), **life("v.life"), **spin("v.spin"),
        **billboard(0.2, still("footprint"), "emitter_transform_xz"), **tint(fade_in_out(0.1, 0.85, "C8")),
    })
    E["coffin"] = ("particles_blend", {
        **once(1), **point(), **life("v.life"), **spin("v.spin"),
        **billboard([1.0, 2.0], still("coffin"), "emitter_transform_xz"), **tint(fade_in_out(0.08, 0.92)),
    })
    orbit = "(v.a0 + v.particle_age * v.w)"
    radius = "math.max(v.r0 - v.particle_age * v.shrink, 0)"
    E["dancer"] = ("particles_blend", {
        **once(1), **point(), **life("v.life"),
        **parametric(["math.cos(%s) * %s" % (orbit, radius), "0.95 + 0.08 * math.sin(v.particle_age * 540)",
                      "math.sin(%s) * %s" % (orbit, radius)]),
        **billboard([0.5, 1.0], flipbook("dancer", 4), "lookat_y"), **tint(fade_in_out(0.08, 0.92)),
    })
    return E


def build(rp_root):
    global UV
    atlas, UV = pack(art.SPRITES)
    tex_path = os.path.join(rp_root, TEXTURE + ".png")
    os.makedirs(os.path.dirname(tex_path), exist_ok=True)
    Image.fromarray(atlas, "RGBA").save(tex_path)

    out_dir = os.path.join(rp_root, "particles")
    os.makedirs(out_dir, exist_ok=True)
    for old in os.listdir(out_dir):
        if old.startswith("harvester_") and old.endswith(".json"):
            os.remove(os.path.join(out_dir, old))
    all_effects = effects()
    for name, (material, components) in all_effects.items():
        data = {
            "format_version": "1.10.0",
            "particle_effect": {
                "description": {
                    "identifier": "harvester:" + name,
                    "basic_render_parameters": {"material": material, "texture": TEXTURE},
                },
                "components": components,
            },
        }
        with open(os.path.join(out_dir, "harvester_" + name + ".json"), "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
    return sorted(all_effects)


if __name__ == "__main__":
    root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "TheHarvesterRP")
    names = build(root)
    print(len(names), "particles:", ", ".join(names))
