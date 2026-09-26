"""Build the Harvester particle atlas and every `harvester:*` particle effect.

Writes:
  TheHarvesterRP/textures/particle/harvester_particles.png
  TheHarvesterRP/particles/harvester_*.json

Script-side Molang variables (set with MolangVariableMap.setFloat):
  v.dir_x / v.dir_y / v.dir_z, v.speed, v.life   flying particles (souls, crows, flask)
  v.grav                                         flask gravity
  v.radius, v.duration                           areas, rings, fields
  v.cr / v.cg / v.cb                             telegraph colour (0..1)
  v.spin                                         slash rotation
  v.stacks (1..5), v.frame (0..7)                plague pips, hourglass frame
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
SOUL_FADE = {"0.0": "#FFFFFFFF", "0.6": "#E6FFFFFF", "1.0": "#00FFFFFF"}
PLAGUE_GAS = {"0.0": "#00A8C94A", "0.15": "#B08DB33A", "0.7": "#8C6E8F2A", "1.0": "#003F5A17"}
DARK_GAS = {"0.0": "#001A1F14", "0.2": "#D01A1F14", "0.75": "#B0101408", "1.0": "#000B0E08"}
BLACK_SMOKE = {"0.0": "#E00E0E12", "0.6": "#B0141418", "1.0": "#00141418"}
TEAL = {"0.0": "#FFE6FFF7", "0.3": "#FF7CFFD4", "1.0": "#002FD6A8"}
TEAL_SPARK = {"0.0": "#FFFFFFFF", "0.4": "#FF7CFFD4", "1.0": "#002FD6A8"}
PLAGUE_BRIGHT = {"0.0": "#FFDDEB8A", "0.5": "#E0A8C94A", "1.0": "#006E8F2A"}


def fade_in_out(fin=0.1, fout=0.8):
    return {"0.0": "#00FFFFFF", str(fin): "#FFFFFFFF", str(fout): "#FFFFFFFF", "1.0": "#00FFFFFF"}


def effects():
    E = {}

    # ---------------------------------------------------------------- souls
    E["soul_wisp"] = ("particles_add", {
        **once(1), **point(["math.random(-0.3, 0.3)", 1, "math.random(-0.3, 0.3)"]),
        **life("math.random(0.9, 1.4)"), **speed(0.8), **dynamic((0, 0.6, 0), 0.9),
        **billboard(["0.22 * (1 - 0.5 * %s)" % T] * 2, flipbook("soul", 10)),
        **tint(SOUL_FADE),
    })
    E["soul_burst"] = ("particles_add", {
        **once(14), **sphere(0.4), **life("math.random(0.8, 1.4)"), **speed("math.random(3, 5.5)"),
        **dynamic((0, 1.8, 0), 3.0),
        **billboard(0.24, flipbook("wraith", 10)), **tint(SOUL_FADE),
    })
    E["soul_stream"] = ("particles_add", {
        **once(1), **point(["v.dir_x", "v.dir_y", "v.dir_z"]), **life("v.life"), **speed("v.speed"),
        **billboard(0.26, flipbook("wraith", 12)),
        **tint({"0.0": "#FFFFFFFF", "0.85": "#FFFFFFFF", "1.0": "#00FFFFFF"}),
    })
    E["soul_pillar"] = ("particles_add", {
        **steady(45, 140, "v.duration"), **disc(1.3, [0, 1, 0]),
        **life("math.random(1.2, 2.0)"), **speed("math.random(2.5, 4.5)"), **dynamic((0, 0.5, 0), 0.4),
        **billboard(0.26, flipbook("soul", 10)), **tint(SOUL_FADE),
    })
    E["ember"] = ("particles_add", {
        **once(10), **sphere(0.2), **life("math.random(0.4, 0.7)"), **speed(5), **dynamic((0, -2, 0), 2.5),
        **billboard(0.08, flipbook("spark", stretch=True, loop=False)), **tint(TEAL_SPARK),
    })
    E["gem_pulse"] = ("particles_add", {
        **once(1), **point(), **life(0.35),
        **billboard(["0.2 + 0.3 * %s" % T] * 2, still("spark")), **tint(TEAL_SPARK),
    })
    E["eye_glow"] = ("particles_add", {
        **once(1), **point([0, 1, 0]), **life(0.4), **speed(0.6),
        **billboard(0.06, flipbook("soul", 12)), **tint(SOUL_FADE),
    })

    # ---------------------------------------------------------------- scythe
    E["scythe_trail"] = ("particles_add", {
        **once(1), **point(), **life(0.28), **spin("v.spin"),
        **billboard(["0.9 + 0.35 * %s" % T] * 2, flipbook("slash", stretch=True, loop=False)),
        **tint(TEAL),
    })
    E["scythe_trail_big"] = ("particles_add", {
        **once(1), **point(), **life(0.36), **spin("v.spin"),
        **billboard(["2.0 + 0.6 * %s" % T] * 2, flipbook("slash", stretch=True, loop=False)),
        **tint(TEAL),
    })
    E["spectral_scythe"] = ("particles_add", {
        **once(1), **point(), **life(0.62), **spin(-75, 300),
        **parametric([0, "1.1 - math.min(v.particle_age * 3, 1) * 0.9", 0]),
        **billboard(1.5, still("scythe"), "lookat_y"),
        **tint({"0.0": "#00FFFFFF", "0.12": "#FFFFFFFF", "0.7": "#FFFFFFFF", "1.0": "#00FFFFFF"}),
    })

    # ---------------------------------------------------------------- plague gas
    gas_size = "0.3 + 0.45 * math.sqrt(%s)" % T
    E["miasma"] = ("particles_blend", {
        **once(4), **sphere(0.45), **life("math.random(1.6, 2.4)"), **speed(0.35),
        **dynamic((0, 0.25, 0), 0.6), **spin("math.random(0, 360)", "math.random(-40, 40)"),
        **billboard([gas_size] * 2, flipbook("miasma", 3)), **tint(PLAGUE_GAS),
    })
    E["miasma_field"] = ("particles_blend", {
        **steady("v.radius * 7", 90, "v.duration"), **disc("v.radius", [0, 1, 0], [0, 0.25, 0]),
        **life("math.random(2.0, 3.0)"), **speed(0.25), **dynamic((0, 0.1, 0), 0.5),
        **spin("math.random(0, 360)", "math.random(-30, 30)"),
        **billboard(["0.55 + 0.55 * math.sqrt(%s)" % T] * 2, flipbook("miasma", 3)), **tint(PLAGUE_GAS),
    })
    E["blackdeath_field"] = ("particles_blend", {
        **steady("v.radius * 9", 160, "v.duration"), **disc("v.radius", [0, 1, 0], [0, 0.3, 0]),
        **life("math.random(2.0, 3.2)"), **speed(0.4), **dynamic((0, 0.2, 0), 0.4),
        **spin("math.random(0, 360)", "math.random(-25, 25)"),
        **billboard(["0.8 + 0.7 * math.sqrt(%s)" % T] * 2, flipbook("miasma", 3)), **tint(DARK_GAS),
    })
    E["black_smoke"] = ("particles_blend", {
        **once(14), **sphere(0.7), **life("math.random(0.7, 1.2)"), **speed(2.5),
        **dynamic((0, 0.8, 0), 3.0), **spin("math.random(0, 360)", "math.random(-90, 90)"),
        **billboard(["0.35 + 0.55 * %s" % T] * 2, flipbook("miasma", 4)), **tint(BLACK_SMOKE),
    })
    E["aura_mist"] = ("particles_blend", {
        **once(3), **disc(1.6, "outwards", [0, 0.15, 0]), **life("math.random(1.2, 1.6)"), **speed(0.3),
        **spin("math.random(0, 360)", "math.random(-30, 30)"),
        **billboard(["0.4 + 0.4 * %s" % T] * 2, flipbook("miasma", 3)),
        **tint({"0.0": "#002B3A14", "0.3": "#902B3A14", "1.0": "#001A220C"}),
    })
    E["black_rain"] = ("particles_blend", {
        **steady("v.radius * 10", 160, "v.duration"), **disc("v.radius", [0, -1, 0], [0, 7, 0]),
        **life(0.5), **speed(14),
        **billboard([0.035, 0.2], still("drop"), "lookat_y"),
        **tint({"0.0": "#C02B3A14", "1.0": "#A0141A0A"}),
    })

    # ---------------------------------------------------------------- flask
    E["flask"] = ("particles_blend", {
        **once(1), **point(["v.dir_x", "v.dir_y", "v.dir_z"]), **life("v.life"), **speed("v.speed"),
        **dynamic((0, "-v.grav", 0), 0), **spin(0, 720),
        **billboard(0.24, still("flask")),
    })
    E["plague_drip"] = ("particles_blend", {
        **once(1), **point([0, -1, 0]), **life(0.5), **speed(0.5), **dynamic((0, -9, 0), 0.5),
        **billboard(0.05, still("spark")), **tint(PLAGUE_BRIGHT),
    })
    E["glass_shards"] = ("particles_alpha", {
        **once(9), **sphere(0.2), **life("math.random(0.6, 0.9)"), **speed("math.random(2.5, 4.5)"),
        **dynamic((0, -14, 0), 0.5), **spin("math.random(0, 360)", "math.random(-600, 600)"),
        **billboard(0.08, still("shard", "math.floor(v.particle_random_1 * 2)")),
    })
    E["plague_splash"] = ("particles_blend", {
        **once(1), **point(), **life(0.45),
        **billboard(1.4, flipbook("splash", stretch=True, loop=False), "emitter_transform_xz"),
        **tint(PLAGUE_BRIGHT),
    })

    # ---------------------------------------------------------------- ground telegraphs
    pulse = "math.clamp(0.25 + 0.6 * %s + 0.15 * math.sin(v.particle_age * 900), 0, 1)" % T
    E["ground_warn"] = ("particles_add", {
        **once(1), **point(), **life("v.life"),
        **billboard(0.38, still("tile"), "emitter_transform_xz"), **tint_vars(pulse),
    })
    E["ring_warn"] = ("particles_add", {
        **once(1), **point(), **life("v.life"),
        **billboard("v.radius", still("ring"), "emitter_transform_xz"), **tint_vars(pulse),
    })
    E["rune_circle"] = ("particles_add", {
        **once(1), **point(), **life("v.life"), **spin("math.random(0, 360)", 35),
        **billboard("v.radius", still("rune_circle"), "emitter_transform_xz"),
        **tint_vars("math.clamp(math.min(v.particle_age * 4, (v.particle_lifetime - v.particle_age) * 3), 0, 0.95)"),
    })
    E["shockwave"] = ("particles_add", {
        **once(1), **point(), **life("v.life"),
        **billboard(["0.3 + (v.radius - 0.3) * %s" % T] * 2, still("ring"), "emitter_transform_xz"),
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
        **billboard([0.2, 0.4], still("hourglass", "v.frame"), "lookat_y"),
    })
    E["beak_sigil"] = ("particles_blend", {
        **once(1), **point(), **life(1.6),
        **parametric([0, "math.min(v.particle_age * 1.5, 1) * 0.8", 0]),
        **billboard(["0.6 + 0.5 * math.min(v.particle_age * 3, 1)"] * 2, still("beak"), "lookat_y"),
        **tint(fade_in_out(0.1, 0.7)),
    })

    # ---------------------------------------------------------------- graves
    E["grave_rise"] = ("particles_blend", {
        **once(1), **point(), **life("v.life"),
        **parametric([0, "-0.75 + math.min(v.particle_age * 1.6, 1) * 0.75", 0]),
        **billboard([0.35, 0.7], still("grave"), "lookat_y"),
        **tint({"0.0": "#FFFFFFFF", "0.85": "#FFFFFFFF", "1.0": "#00FFFFFF"}),
    })
    E["dirt_burst"] = ("particles_alpha", {
        **once(12), **disc(0.5, ["math.random(-0.5, 0.5)", 1, "math.random(-0.5, 0.5)"]),
        **life("math.random(0.6, 0.9)"), **speed("math.random(2.5, 4.5)"), **dynamic((0, -12, 0), 0.3),
        **billboard(0.07, still("dirt", "math.floor(v.particle_random_1 * 2)")),
    })
    E["lantern"] = ("particles_blend", {
        **once(1), **point(), **life("v.life"),
        **parametric([0, "math.sin(v.particle_age * 200) * 0.08", 0]),
        **billboard(0.25, flipbook("lantern", 5), "lookat_y"), **tint(fade_in_out(0.1, 0.85)),
    })

    # ---------------------------------------------------------------- crows
    E["crow"] = ("particles_alpha", {
        **once(1), **point(["v.dir_x", "v.dir_y", "v.dir_z"]), **life("v.life"), **speed("v.speed"),
        **billboard(0.32, flipbook("crow", 14)),
    })
    E["crow_flock"] = ("particles_alpha", {
        **once(8), **sphere(1.2, ["math.random(-1, 1)", "math.random(0.3, 1)", "math.random(-1, 1)"]),
        **life("math.random(1.2, 1.8)"), **speed("math.random(3, 4.5)"), **dynamic((0, 1.2, 0), 0.8),
        **billboard(0.3, flipbook("crow", 14)),
    })
    E["feathers"] = ("particles_alpha", {
        **once(8), **sphere(0.4), **life("math.random(1.2, 1.8)"), **speed(2),
        **dynamic((0, -1.8, 0), 1.8), **spin("math.random(0, 360)", "math.random(-300, 300)"),
        **billboard(0.09, still("feather")),
    })

    # ---------------------------------------------------------------- tethers
    E["chain_link"] = ("particles_blend", {
        **once(1), **point(), **life(0.2), **spin("math.random(0, 360)"),
        **billboard(0.1, still("chain")),
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
