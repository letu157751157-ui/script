"""Sinh particle tùy chỉnh cho Giant Zombie boss (resource pack).
Chạy: python3 zombie_boss/tools/gen_particles.py
Dùng texture vanilla textures/particle/particles (flipbook khói hàng 0) nên không cần ảnh riêng."""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "ytaun_zombie_pack_resource_pack", "particles")
TEX = "textures/particle/particles"
AGE = "v.particle_age / v.particle_lifetime"

def smoke_uv(size):
    # flipbook 8 frame khói/bụi của vanilla (x 56 -> 0, hàng 0)
    return {"texture_width": 128, "texture_height": 128,
            "flipbook": {"base_UV": [56, 0], "size_UV": [8, 8], "step_UV": [-8, 0],
                         "frames_per_second": 8, "max_frame": 8, "stretch_to_lifetime": True, "loop": False}}

def spark_uv():
    # ô "critical hit"/tia lửa (hàng 4)
    return {"texture_width": 128, "texture_height": 128, "uv": [8, 32], "uv_size": [8, 8]}

def tint(stops):
    return {"minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": stops}}}

def effect(name, comps, material="particles_alpha"):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": f"ytaun:{name}",
                        "basic_render_parameters": {"material": material, "texture": TEX}},
        "components": comps}}

def once(n, t=0.05):
    return {"minecraft:emitter_rate_instant": {"num_particles": n},
            "minecraft:emitter_lifetime_once": {"active_time": t}}

def steady(rate, maxp, t):
    return {"minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": maxp},
            "minecraft:emitter_lifetime_once": {"active_time": t}}

P = {}

# Vòng sóng xung kích lan ra mặt đất (slam / leap / grab impact). v.radius = bán kính cuối
P["shockwave"] = effect("shockwave", {
    **once(90),
    "minecraft:emitter_initialization": {"creation_expression": "v.r = v.radius ?? 6;"},
    "minecraft:emitter_shape_disc": {"offset": [0, 0.15, 0], "radius": 0.6, "surface_only": True,
                                     "direction": "outwards", "plane_normal": "y"},
    "minecraft:particle_initial_speed": "v.r * 1.6",
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.2},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.9},
    "minecraft:particle_appearance_billboard": {"size": ["0.55 + v.particle_age", "0.55 + v.particle_age"],
                                                "facing_camera_mode": "lookat_xyz", "uv": smoke_uv(8)},
    **tint({"0.0": "#FFD9C3A0", "0.5": "#CC8A7458", "1.0": "#00574B3A"}),
})

# Bụi đất + đá văng tung
P["dust_burst"] = effect("dust_burst", {
    **once(40),
    "minecraft:emitter_shape_sphere": {"radius": 1.2, "direction": ["math.random(-1,1)", "math.random(0.6,1.6)", "math.random(-1,1)"]},
    "minecraft:particle_initial_speed": "math.random(3, 7)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -9, 0], "linear_drag_coefficient": 1.5},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.4)"},
    "minecraft:particle_appearance_billboard": {"size": ["0.3 + v.particle_random_1 * 0.4", "0.3 + v.particle_random_1 * 0.4"],
                                                "facing_camera_mode": "rotate_xyz", "uv": smoke_uv(8)},
    "minecraft:particle_motion_collision": {"coefficient_of_restitution": 0.2, "collision_radius": 0.1, "collision_drag": 4},
    **tint({"0.0": "#FF7A6A55", "1.0": "#004A3F33"}),
})

# Vòng cảnh báo đỏ trên mặt đất trước khi chiêu nổ (v.radius)
P["telegraph"] = effect("telegraph", {
    **once(64),
    "minecraft:emitter_initialization": {"creation_expression": "v.r = v.radius ?? 3;"},
    "minecraft:emitter_shape_disc": {"offset": [0, 0.1, 0], "radius": "v.r", "surface_only": True,
                                     "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": 0.4,
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.55},
    "minecraft:particle_appearance_billboard": {"size": [0.22, 0.22], "facing_camera_mode": "lookat_xyz", "uv": spark_uv()},
    **tint({"0.0": "#FFFF2A1A", "0.6": "#FFFF7A1A", "1.0": "#00FF2A1A"}),
}, material="particles_add")

# Điểm cảnh báo lấp đầy vùng (tâm chiêu)
P["telegraph_fill"] = effect("telegraph_fill", {
    **once(30),
    "minecraft:emitter_initialization": {"creation_expression": "v.r = v.radius ?? 3;"},
    "minecraft:emitter_shape_disc": {"offset": [0, 0.08, 0], "radius": "v.r", "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": 0.15,
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
    "minecraft:particle_appearance_billboard": {"size": [0.35, 0.35], "facing_camera_mode": "direction_y", "uv": smoke_uv(8)},
    **tint({"0.0": "#88FF3020", "1.0": "#00FF3020"}),
}, material="particles_add")

# Đám mây độc lan ra (poison aura), kéo dài 4 giây
P["poison_cloud"] = effect("poison_cloud", {
    **steady(60, 220, 4),
    "minecraft:emitter_shape_disc": {"offset": [0, 0.4, 0], "radius": 6, "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": "math.random(0.2, 0.8)",
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.6},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.2, 2.2)"},
    "minecraft:particle_appearance_billboard": {"size": ["0.6 + v.particle_age * 0.8", "0.6 + v.particle_age * 0.8"],
                                                "facing_camera_mode": "rotate_xyz", "uv": smoke_uv(8)},
    **tint({"0.0": "#0055D12E", "0.2": "#AA3FA82A", "0.8": "#77406B1C", "1.0": "#00203A10"}),
})

# Bong bóng độc nhỏ bốc lên
P["poison_bubble"] = effect("poison_bubble", {
    **once(20),
    "minecraft:emitter_shape_sphere": {"radius": 0.8, "direction": [0, 1, 0]},
    "minecraft:particle_initial_speed": "math.random(0.5, 1.5)",
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.0},
    "minecraft:particle_appearance_billboard": {"size": [0.15, 0.15], "facing_camera_mode": "lookat_xyz",
                                                "uv": {"texture_width": 128, "texture_height": 128, "uv": [0, 16], "uv_size": [8, 8]}},
    **tint({"0.0": "#FF9CFF4A", "1.0": "#002F7A18"}),
}, material="particles_add")

# Hào quang cuồng nộ bốc lên quanh boss (script gọi lặp lại)
P["rage_aura"] = effect("rage_aura", {
    **once(18),
    "minecraft:emitter_shape_disc": {"offset": [0, 0.2, 0], "radius": 1.6, "surface_only": True,
                                     "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": "math.random(2, 4)",
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.0},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.0)"},
    "minecraft:particle_appearance_billboard": {"size": [0.25, 0.25], "facing_camera_mode": "lookat_xyz", "uv": spark_uv()},
    **tint({"0.0": "#FFFFCC33", "0.4": "#FFFF3311", "1.0": "#00550000"}),
}, material="particles_add")

# Vụ nổ đỏ lúc chuyển giai đoạn (rage / final fury)
P["rage_burst"] = effect("rage_burst", {
    **once(120),
    "minecraft:emitter_shape_sphere": {"offset": [0, 2, 0], "radius": 0.5, "direction": "outwards"},
    "minecraft:particle_initial_speed": "math.random(6, 12)",
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2.5},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.5)"},
    "minecraft:particle_appearance_billboard": {"size": [0.35, 0.35], "facing_camera_mode": "lookat_xyz", "uv": spark_uv()},
    **tint({"0.0": "#FFFFF2A0", "0.3": "#FFFF4A1A", "1.0": "#00400000"}),
}, material="particles_add")

# Gai đá trồi lên (ground spikes)
P["spike"] = effect("spike", {
    **once(6),
    "minecraft:emitter_shape_disc": {"radius": 0.5, "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.1},
    "minecraft:particle_appearance_billboard": {
        "size": ["0.25 * (1 - v.particle_age / v.particle_lifetime * 0.5)",
                 "math.min(v.particle_age * 12, 1.6) * (1 - math.pow(v.particle_age / v.particle_lifetime, 4))"],
        "facing_camera_mode": "rotate_y",
        "uv": {"texture_width": 128, "texture_height": 128, "uv": [0, 0], "uv_size": [8, 8]}},
    **tint({"0.0": "#FF4B4038", "0.8": "#FF2E2722", "1.0": "#002E2722"}),
})

# Mảnh đá văng khi gai trồi lên
P["rock_debris"] = effect("rock_debris", {
    **once(14),
    "minecraft:emitter_shape_point": {"direction": ["math.random(-1,1)", "math.random(1.5,3)", "math.random(-1,1)"]},
    "minecraft:particle_initial_speed": "math.random(3, 6)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -18, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.2},
    "minecraft:particle_motion_collision": {"coefficient_of_restitution": 0.3, "collision_radius": 0.08, "collision_drag": 6},
    "minecraft:particle_appearance_billboard": {"size": ["0.08 + v.particle_random_1 * 0.12", "0.08 + v.particle_random_1 * 0.12"],
                                                "facing_camera_mode": "rotate_xyz",
                                                "uv": {"texture_width": 128, "texture_height": 128, "uv": [0, 0], "uv_size": [8, 8]}},
    **tint({"0.0": "#FF5E544A", "1.0": "#FF3A332C"}),
})

# Vệt khói theo tảng đá bị ném
P["rock_trail"] = effect("rock_trail", {
    **once(4),
    "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
    "minecraft:particle_initial_speed": 0.2,
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
    "minecraft:particle_appearance_billboard": {"size": ["0.4 + v.particle_age", "0.4 + v.particle_age"],
                                                "facing_camera_mode": "rotate_xyz", "uv": smoke_uv(8)},
    **tint({"0.0": "#CC6B6258", "1.0": "#00342F2A"}),
})

# Tảng đá (lõi) — khối vuông tối màu to, 1 particle, script spawn mỗi tick
P["rock_core"] = effect("rock_core", {
    **once(1),
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.06},
    "minecraft:particle_appearance_billboard": {"size": [0.9, 0.9], "facing_camera_mode": "rotate_xyz",
                                                "uv": {"texture_width": 128, "texture_height": 128, "uv": [0, 0], "uv_size": [8, 8]}},
    "minecraft:particle_appearance_tinting": {"color": [0.3, 0.27, 0.23, 1.0]},
})

# Trận pháp triệu hồi xanh lục xoáy lên (summon horde)
P["summon_rune"] = effect("summon_rune", {
    **steady(40, 80, 1.2),
    "minecraft:emitter_shape_disc": {"radius": 1.0, "surface_only": True, "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": "math.random(1, 2.5)",
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.8},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.0},
    "minecraft:particle_appearance_billboard": {"size": [0.2, 0.2], "facing_camera_mode": "lookat_xyz", "uv": spark_uv()},
    **tint({"0.0": "#FFB6FF5A", "0.5": "#FF3FBF2A", "1.0": "#00104A08"}),
}, material="particles_add")

# Đất nứt khi zombie chui lên
P["ground_crack"] = effect("ground_crack", {
    **once(25),
    "minecraft:emitter_shape_disc": {"radius": 0.7, "direction": [0, 1, 0], "plane_normal": "y"},
    "minecraft:particle_initial_speed": "math.random(1.5, 3.5)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -6, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.9},
    "minecraft:particle_appearance_billboard": {"size": [0.3, 0.3], "facing_camera_mode": "rotate_xyz", "uv": smoke_uv(8)},
    **tint({"0.0": "#FF4A3A2A", "1.0": "#00201810"}),
})

# Sóng âm gầm (war roar) — vòng đứng, lan ra
P["roar_wave"] = effect("roar_wave", {
    **once(70),
    "minecraft:emitter_shape_disc": {"offset": [0, 2.5, 0], "radius": 0.5, "surface_only": True,
                                     "direction": "outwards", "plane_normal": "y"},
    "minecraft:particle_initial_speed": 14,
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2.2},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.8},
    "minecraft:particle_appearance_billboard": {"size": [0.5, 0.5], "facing_camera_mode": "lookat_xyz", "uv": smoke_uv(8)},
    **tint({"0.0": "#CCE8FFD8", "1.0": "#0070A060"}),
}, material="particles_add")

# Hồi máu: vòng xoắn xanh lá bay lên quanh boss
P["heal_spiral"] = effect("heal_spiral", {
    **steady(30, 60, 1.5),
    "minecraft:emitter_shape_custom": {
        "offset": ["math.cos(v.emitter_age * 720) * 1.8", "v.emitter_age * 2.5", "math.sin(v.emitter_age * 720) * 1.8"],
        "direction": [0, 1, 0]},
    "minecraft:particle_initial_speed": 0.6,
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.0},
    "minecraft:particle_appearance_billboard": {"size": [0.2, 0.2], "facing_camera_mode": "lookat_xyz", "uv": spark_uv()},
    **tint({"0.0": "#FF9CFF9C", "1.0": "#0020A020"}),
}, material="particles_add")

# Nổ lúc boss chết
P["death_burst"] = effect("death_burst", {
    **steady(120, 300, 2.0),
    "minecraft:emitter_shape_sphere": {"offset": [0, 2.5, 0], "radius": 2.5, "direction": "outwards"},
    "minecraft:particle_initial_speed": "math.random(2, 6)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.5, 0], "linear_drag_coefficient": 1.5},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1, 2)"},
    "minecraft:particle_appearance_billboard": {"size": ["0.4 + v.particle_random_1 * 0.5", "0.4 + v.particle_random_1 * 0.5"],
                                                "facing_camera_mode": "rotate_xyz", "uv": smoke_uv(8)},
    **tint({"0.0": "#FFFFE08A", "0.4": "#CC4FB33A", "1.0": "#00203010"}),
}, material="particles_add")

os.makedirs(OUT, exist_ok=True)
for name, data in P.items():
    with open(os.path.join(OUT, f"{name}.json"), "w") as f:
        json.dump(data, f, indent=2)
print(len(P), "particles ->", os.path.normpath(OUT))
