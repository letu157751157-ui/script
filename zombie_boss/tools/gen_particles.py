"""Sinh particle cho Giant Zombie boss (resource pack), dùng atlas riêng textures/particle/ytaun_boss.png
(vẽ bởi tools/gen_texture.py). Chạy: python3 zombie_boss/tools/gen_particles.py"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "ytaun_zombie_pack_resource_pack", "particles")
TEX = "textures/particle/ytaun_boss"
AGE = "v.particle_age / v.particle_lifetime"
_NAMES = ["glow", "smoke", "ring", "star", "spike", "rock", "rune", "bubble", "crack", "flame", "streak", "shard"]
CELLS = {n: ((i % 4) * 16, (i // 4) * 16) for i, n in enumerate(_NAMES)}

def uv(name):
    return {"texture_width": 64, "texture_height": 48, "uv": list(CELLS[name]), "uv_size": [16, 16]}

def bb(size, cell, mode="lookat_xyz", **extra):
    w, h = size if isinstance(size, (list, tuple)) else (size, size)
    return {"minecraft:particle_appearance_billboard": {"size": [w, h], "facing_camera_mode": mode, "uv": uv(cell), **extra}}

def tint(stops):
    return {"minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": stops}}}

def life(t):
    return {"minecraft:particle_lifetime_expression": {"max_lifetime": t}}

def once(n, t=0.05):
    return {"minecraft:emitter_rate_instant": {"num_particles": n}, "minecraft:emitter_lifetime_once": {"active_time": t}}

def steady(rate, maxp, t):
    return {"minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": maxp},
            "minecraft:emitter_lifetime_once": {"active_time": t}}

RADIUS = {"minecraft:emitter_initialization": {"creation_expression": "v.r = v.radius ?? 4;"}}
SPIN = {"minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-240, 240)"}}

def effect(name, comps, material="particles_alpha"):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": f"ytaun:{name}", "basic_render_parameters": {"material": material, "texture": TEX}},
        "components": comps}}

ADD, BLEND = "particles_add", "particles_blend"
P = {}

# ---------- Lớp chung dùng ghép hiệu ứng ----------
P["flash"] = effect("flash", {**once(1), **RADIUS, "minecraft:emitter_shape_point": {"offset": [0, 0.6, 0]}, **life(0.3),
    **bb(["v.r * (0.6 + v.particle_age * 3)", "v.r * (0.6 + v.particle_age * 3)"], "glow"),
    **tint({"0.0": "#FFFFF4D0", "0.4": "#AAFFA040", "1.0": "#00FF4010"})}, ADD)

P["ground_ring"] = effect("ground_ring", {**once(1), **RADIUS, "minecraft:emitter_shape_point": {"offset": [0, 0.12, 0]},
    **life(0.6),
    **bb(["v.r * math.pow(v.particle_age / v.particle_lifetime, 0.5) * 1.15", "v.r * math.pow(v.particle_age / v.particle_lifetime, 0.5) * 1.15"],
         "ring", "emitter_transform_xz"),
    **tint({"0.0": "#FFFFF0C0", "0.5": "#DDFF8A30", "1.0": "#00AA3010"})}, ADD)

P["sparks"] = effect("sparks", {**once(45), "minecraft:emitter_shape_sphere": {"offset": [0, 0.5, 0], "radius": 0.4,
    "direction": ["math.random(-1,1)", "math.random(0.3,1.5)", "math.random(-1,1)"]},
    "minecraft:particle_initial_speed": "math.random(6, 13)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -14, 0], "linear_drag_coefficient": 1.8},
    **life("math.random(0.4, 0.9)"),
    **bb([0.06, "0.25 + v.particle_random_1 * 0.3"], "streak", "lookat_direction"),
    **tint({"0.0": "#FFFFFFE0", "0.3": "#FFFFB040", "1.0": "#00FF3000"})}, ADD)

P["crack_decal"] = effect("crack_decal", {**once(1), **RADIUS, "minecraft:emitter_shape_point": {"offset": [0, 0.06, 0]},
    **life(2.5), **bb(["v.r", "v.r"], "crack", "emitter_transform_xz"),
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
    **tint({"0.0": "#FFFF7A20", "0.15": "#EE3A2418", "0.8": "#CC1E140E", "1.0": "#001E140E"})}, BLEND)

P["ember"] = effect("ember", {**once(24), "minecraft:emitter_shape_disc": {"offset": [0, 0.3, 0], "radius": 2.2, "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": "math.random(1.5, 4)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 400) * 2", 1, 0], "linear_drag_coefficient": 0.8},
    **life("math.random(0.8, 1.6)"), **bb(["0.12 * (1 - v.particle_age / v.particle_lifetime) + 0.03"] * 2, "glow"),
    **tint({"0.0": "#FFFFE08A", "0.4": "#FFFF5A14", "1.0": "#00800000"})}, ADD)

# ---------- Hiệu ứng chính (tên giữ nguyên để script dùng) ----------
P["shockwave"] = effect("shockwave", {**once(160), **RADIUS,
    "minecraft:emitter_shape_disc": {"offset": [0, 0.2, 0], "radius": 0.8, "surface_only": True, "direction": "outwards", "plane_normal": "y"},
    "minecraft:particle_initial_speed": "v.r * math.random(1.6, 2.4)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0], "linear_drag_coefficient": 1.6},
    **life("math.random(0.8, 1.3)"), **SPIN,
    **bb(["0.5 + v.particle_age * 1.6", "0.5 + v.particle_age * 1.6"], "smoke", "rotate_xyz"),
    **tint({"0.0": "#F0D8C8A8", "0.4": "#B0907A5E", "1.0": "#004A3E30"})}, BLEND)

P["dust_burst"] = effect("dust_burst", {**once(70),
    "minecraft:emitter_shape_sphere": {"radius": 1.3, "direction": ["math.random(-1,1)", "math.random(0.5,1.8)", "math.random(-1,1)"]},
    "minecraft:particle_initial_speed": "math.random(3, 8)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -3, 0], "linear_drag_coefficient": 2.2},
    **life("math.random(1.0, 1.8)"), **SPIN,
    **bb(["0.5 + v.particle_random_1 * 0.6 + v.particle_age", "0.5 + v.particle_random_1 * 0.6 + v.particle_age"], "smoke", "rotate_xyz"),
    **tint({"0.0": "#E08C7A62", "1.0": "#004A3F33"})}, BLEND)

P["telegraph"] = effect("telegraph", {**once(1), **RADIUS, "minecraft:emitter_shape_point": {"offset": [0, 0.08, 0]},
    **life(0.3), **bb(["v.r * 1.08", "v.r * 1.08"], "ring", "emitter_transform_xz"),
    **tint({"0.0": "#FFFF3A1A", "1.0": "#AAFF2010"})}, ADD)

P["telegraph_fill"] = effect("telegraph_fill", {**once(1), **RADIUS, "minecraft:emitter_shape_point": {"offset": [0, 0.07, 0]},
    **life(0.3), **bb(["v.r * (0.15 + 0.9 * v.particle_age / v.particle_lifetime)"] * 2, "glow", "emitter_transform_xz"),
    **tint({"0.0": "#77FF2A10", "1.0": "#44FF2A10"})}, ADD)

P["poison_cloud"] = effect("poison_cloud", {**steady(90, 400, 4), "minecraft:emitter_shape_disc": {"offset": [0, 0.3, 0], "radius": 6, "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": "math.random(0.2, 0.9)",
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.7},
    **life("math.random(1.4, 2.4)"), **SPIN,
    **bb(["0.8 + v.particle_age * 1.1", "0.8 + v.particle_age * 1.1"], "smoke", "rotate_xyz"),
    **tint({"0.0": "#0060E030", "0.2": "#B048B02C", "0.7": "#80407020", "1.0": "#00183008"})}, BLEND)

P["poison_bubble"] = effect("poison_bubble", {**once(26), "minecraft:emitter_shape_sphere": {"radius": 1.0, "direction": [0, 1, 0]},
    "minecraft:particle_initial_speed": "math.random(0.6, 1.8)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 500) * 1.5", 0.5, 0]},
    **life("math.random(0.8, 1.5)"),
    **bb(["0.1 + v.particle_random_1 * 0.15"] * 2, "bubble"),
    **tint({"0.0": "#FFB4FF5A", "0.85": "#FF5ACF30", "1.0": "#005ACF30"})}, BLEND)

P["rage_aura"] = effect("rage_aura", {**once(14), "minecraft:emitter_shape_disc": {"offset": [0, 0.2, 0], "radius": 1.8, "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": "math.random(2, 4.5)",
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.2},
    **life("math.random(0.5, 0.9)"),
    **bb([0.35, "0.55 + v.particle_random_1 * 0.3"], "flame", "rotate_y"),
    **tint({"0.0": "#FFFFE080", "0.3": "#FFFF4A14", "1.0": "#00500000"})}, ADD)

P["rage_burst"] = effect("rage_burst", {**once(160), "minecraft:emitter_shape_sphere": {"offset": [0, 2.2, 0], "radius": 0.6, "direction": "outwards"},
    "minecraft:particle_initial_speed": "math.random(7, 15)",
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2.8},
    **life("math.random(0.8, 1.6)"),
    **bb([0.08, "0.4 + v.particle_random_1 * 0.5"], "streak", "lookat_direction"),
    **tint({"0.0": "#FFFFF6B0", "0.3": "#FFFF4A1A", "1.0": "#00400000"})}, ADD)

P["spike"] = effect("spike", {**once(4), "minecraft:emitter_shape_disc": {"radius": 0.45, "direction": [0, 1, 0], "plane_normal": "y"},
    **life("1.3 + v.particle_random_2 * 0.3"),
    **bb(["0.35 + v.particle_random_1 * 0.15",
          "(1.3 + v.particle_random_1 * 0.8) * math.min(v.particle_age * 10, 1) * (1 - math.pow(v.particle_age / v.particle_lifetime, 5))"],
         "spike", "rotate_y"),
    "minecraft:particle_appearance_lighting": {},
    **tint({"0.0": "#FFFFFFFF", "0.9": "#FFE0E0E0", "1.0": "#00E0E0E0"})})

P["rock_debris"] = effect("rock_debris", {**once(22), "minecraft:emitter_shape_point": {"direction": ["math.random(-1,1)", "math.random(1.5,3)", "math.random(-1,1)"]},
    "minecraft:particle_initial_speed": "math.random(4, 8)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -20, 0]},
    **life("math.random(1.0, 1.6)"), **SPIN,
    "minecraft:particle_motion_collision": {"coefficient_of_restitution": 0.35, "collision_radius": 0.1, "collision_drag": 5},
    **bb(["0.12 + v.particle_random_1 * 0.22"] * 2, "rock", "rotate_xyz"),
    "minecraft:particle_appearance_lighting": {},
    **tint({"0.0": "#FFFFFFFF", "0.85": "#FFFFFFFF", "1.0": "#00FFFFFF"})})

P["rock_trail"] = effect("rock_trail", {**once(5), "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": "outwards"},
    "minecraft:particle_initial_speed": 0.3, **life("math.random(0.6, 1.0)"), **SPIN,
    **bb(["0.45 + v.particle_age * 1.2"] * 2, "smoke", "rotate_xyz"),
    **tint({"0.0": "#C0786A5C", "1.0": "#00342F2A"})}, BLEND)

P["rock_core"] = effect("rock_core", {**once(1), "minecraft:emitter_shape_point": {}, **life(0.07),
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 540},
    **bb([1.1, 1.1], "rock", "rotate_xyz"), "minecraft:particle_appearance_lighting": {}})

P["summon_rune"] = effect("summon_rune", {**once(1), "minecraft:emitter_shape_point": {"offset": [0, 0.1, 0]},
    **life(1.8), "minecraft:particle_initial_spin": {"rotation": 0, "rotation_rate": 120},
    **bb(["1.6 * math.min(v.particle_age * 4, 1)"] * 2, "rune", "emitter_transform_xz"),
    **tint({"0.0": "#FFB6FF5A", "0.6": "#FF3FEF4A", "1.0": "#0010AA08"})}, ADD)

P["rune_sparks"] = effect("rune_sparks", {**steady(40, 70, 1.4), "minecraft:emitter_shape_disc": {"radius": 1.5, "surface_only": True, "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": "math.random(1, 3)", "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.8},
    **life(1.0), **bb([0.18, 0.18], "star"),
    **tint({"0.0": "#FFD0FF80", "0.5": "#FF3FBF2A", "1.0": "#00104A08"})}, ADD)

P["ground_crack"] = effect("ground_crack", {**once(30), "minecraft:emitter_shape_disc": {"radius": 0.8, "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": "math.random(2, 4.5)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -9, 0], "linear_drag_coefficient": 1},
    **life("math.random(0.7, 1.1)"), **SPIN,
    **bb(["0.3 + v.particle_random_1 * 0.3"] * 2, "smoke", "rotate_xyz"),
    **tint({"0.0": "#F05A4632", "1.0": "#00201810"})}, BLEND)

P["roar_wave"] = effect("roar_wave", {**once(1), "minecraft:emitter_shape_point": {"offset": [0, 2.5, 0]},
    **life(0.7), **bb(["1 + v.particle_age * 22", "1 + v.particle_age * 22"], "ring", "emitter_transform_xz"),
    **tint({"0.0": "#FFE8FFFF", "1.0": "#0060A0FF"})}, ADD)

P["heal_spiral"] = effect("heal_spiral", {**steady(50, 100, 1.6),
    "minecraft:emitter_shape_custom": {"offset": ["math.cos(v.emitter_age * 720) * 1.8", "v.emitter_age * 2.8", "math.sin(v.emitter_age * 720) * 1.8"], "direction": [0, 1, 0]},
    "minecraft:particle_initial_speed": 0.5, **life(1.1), **bb([0.25, 0.25], "star"),
    **tint({"0.0": "#FFD4FFB0", "0.5": "#FF4AE04A", "1.0": "#0020A020"})}, ADD)

P["death_burst"] = effect("death_burst", {**steady(160, 400, 2.0), "minecraft:emitter_shape_sphere": {"offset": [0, 2.5, 0], "radius": 2.5, "direction": "outwards"},
    "minecraft:particle_initial_speed": "math.random(2, 7)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.5, 0], "linear_drag_coefficient": 1.5},
    **life("math.random(1, 2)"), **SPIN,
    **bb(["0.5 + v.particle_random_1 * 0.6"] * 2, "smoke", "rotate_xyz"),
    **tint({"0.0": "#FFFFE08A", "0.4": "#C04FB33A", "1.0": "#00203010"})}, ADD)

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".json"): os.remove(os.path.join(OUT, f))
for name, data in P.items():
    with open(os.path.join(OUT, f"{name}.json"), "w") as f:
        json.dump(data, f, indent=2)
print(len(P), "particles ->", os.path.normpath(OUT))
