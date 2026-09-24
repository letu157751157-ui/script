"""Particle riêng của Quỷ Kiếm Darkin: texture atlas + file JSON cho resource pack.

Sprite vẽ màu trắng, hình dạng nằm ở kênh alpha; màu thật do tinting của từng
particle quyết định, nên một sprite dùng được cho nhiều hiệu ứng.
"""
import json
import math
import os

ATLAS = 128  # atlas 128x128, mỗi sprite 32x32
TEXTURE = "textures/particle/aatrox_particles"

SPRITES = {
    "glow": (0, 0),
    "spark": (32, 0),
    "ring": (64, 0),
    "slash": (96, 0),
    "tile": (0, 32),
    "flame": (32, 32),
    "drop": (64, 32),
}


def smooth(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def sprite_alpha(name, x, y):
    """x, y trong [-1, 1] tính từ tâm sprite."""
    r = math.hypot(x, y)
    if name == "glow":
        return (1 - smooth(0.0, 1.0, r)) ** 1.6
    if name == "spark":
        return max(0.0, 1 - abs(x) * 5 - abs(y) * 1.05) ** 0.8
    if name == "ring":
        return max(0.0, 1 - abs(r - 0.8) / 0.14) ** 1.3
    if name == "slash":
        # Lưỡi liềm: hình tròn trừ đi hình tròn lệch tâm
        outer = 1 - smooth(0.82, 0.95, r)
        inner = smooth(0.62, 0.8, math.hypot(x - 0.28, y + 0.12))
        return outer * inner * smooth(-0.9, -0.2, x + 0.6)
    if name == "tile":
        edge = max(abs(x), abs(y))
        return 0.28 + 0.72 * smooth(0.6, 0.92, edge) * (1 - smooth(0.93, 1.0, edge))
    if name == "flame":
        # Giọt lửa: đáy tròn, đỉnh nhọn
        if y < -0.3:
            return 1 - smooth(0.45, 0.62, math.hypot(x, (y + 0.3) * 1.1))
        width = 0.55 * (1 - (y + 0.3) / 1.3) ** 0.9
        return 1 - smooth(width * 0.6, width + 0.04, abs(x))
    if name == "drop":
        # Giọt máu: đáy tròn, đỉnh nhọn
        if y < 0:
            return 1 - smooth(0.5, 0.66, math.hypot(x, y * 1.1))
        width = 0.58 * (1 - y / 0.95)
        return 1 - smooth(width * 0.7, width + 0.04, abs(x)) if y < 0.95 else 0.0
    raise ValueError(name)


def build_atlas():
    pixels = [[(255, 255, 255, 0)] * ATLAS for _ in range(ATLAS)]
    for name, (ox, oy) in SPRITES.items():
        for j in range(32):
            for i in range(32):
                x, y = (i + 0.5) / 16 - 1, 1 - (j + 0.5) / 16
                alpha = max(0.0, min(1.0, sprite_alpha(name, x, y)))
                pixels[oy + j][ox + i] = (255, 255, 255, int(alpha * 255))
    return pixels


# ---------------------------------------------------------------------------
# Định nghĩa particle
# ---------------------------------------------------------------------------

AGE = "v.particle_age / v.particle_lifetime"


def uv(sprite):
    return {"texture_width": ATLAS, "texture_height": ATLAS, "uv": list(SPRITES[sprite]), "uv_size": [32, 32]}


def tint(stops):
    return {"color": {"interpolant": AGE, "gradient": stops}}


def particle(identifier, material, components):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": identifier,
                "basic_render_parameters": {"material": material, "texture": TEXTURE},
            },
            "components": components,
        },
    }


def burst(count, active=0.05):
    return {
        "minecraft:emitter_rate_instant": {"num_particles": count},
        "minecraft:emitter_lifetime_once": {"active_time": active},
    }


PARTICLES = {
    # Tàn lửa đỏ bay lên (quanh kiếm, vệt lướt, hút máu)
    "ember": particle("aatrox:ember", "particles_add", {
        **burst(3),
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 1.0)"},
        "minecraft:particle_initial_speed": 0.4,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.4, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.07 * (1 - {AGE})", f"0.07 * (1 - {AGE})"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv("glow"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFD27A", "0.4": "#FFFF4A1C", "1.0": "#00780A10"}),
    }),
    # Tia lửa bắn ra khi chém trúng
    "hit_spark": particle("aatrox:hit_spark", "particles_add", {
        **burst(14),
        "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.2, 0.4)"},
        "minecraft:particle_initial_speed": "math.random(5, 9)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -6, 0], "linear_drag_coefficient": 5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.035, f"0.22 * (1 - {AGE})"],
            "facing_camera_mode": "lookat_direction",
            "direction": {"mode": "derive_from_velocity"},
            "uv": uv("spark"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFF0C0", "0.5": "#FFFF7A28", "1.0": "#00C8141E"}),
    }),
    # Máu văng (điểm ngọt Q, nội tại, kéo xích)
    "blood_burst": particle("aatrox:blood_burst", "particles_blend", {
        **burst(18),
        "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
        "minecraft:particle_initial_speed": "math.random(2.5, 5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -14, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.11 * (1 - {AGE} * 0.6)", f"0.11 * (1 - {AGE} * 0.6)"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv("drop"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFB4101C", "0.7": "#FF6E0612", "1.0": "#00400208"}),
    }),
    # Chớp sáng lớn tại điểm nổ
    "flash": particle("aatrox:flash", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.22},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.4 + {AGE} * 1.1", f"0.4 + {AGE} * 1.1"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv("glow"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFE6A0", "0.4": "#FFFF3C1E", "1.0": "#00640008"}),
    }),
    # Nhát chém hình lưỡi liềm
    "slash": particle("aatrox:slash", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.2},
        "minecraft:particle_initial_spin": {"rotation": "math.random(-50, 50)"},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.9 + {AGE} * 0.5", f"0.9 + {AGE} * 0.5"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv("slash"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFC8A0", "0.3": "#FFFF2A28", "1.0": "#00780010"}),
    }),
    # Ô đánh dấu vùng chiêu Q trên mặt đất (đỏ) và điểm ngọt (cam)
    "ground_mark": particle("aatrox:ground_mark", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.4, 0.4],
            "facing_camera_mode": "emitter_transform_xz",
            "uv": uv("tile"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00C8141E", "0.3": "#CCC8141E", "0.85": "#FFFF3020", "1.0": "#00FF3020"}),
    }),
    "ground_mark_sweet": particle("aatrox:ground_mark_sweet", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.4, 0.4],
            "facing_camera_mode": "emitter_transform_xz",
            "uv": uv("tile"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FF8C28", "0.3": "#DDFF8C28", "0.85": "#FFFFD25A", "1.0": "#00FFD25A"}),
    }),
    # Vòng sóng xung kích lan trên mặt đất; bán kính truyền từ script qua variable.radius
    "shock_ring": particle("aatrox:shock_ring", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.3 + (v.radius - 0.3) * math.sqrt({AGE})", f"0.3 + (v.radius - 0.3) * math.sqrt({AGE})"],
            "facing_camera_mode": "emitter_transform_xz",
            "uv": uv("ring"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFB45A", "0.35": "#FFFF281E", "1.0": "#00500008"}),
    }),
    # Mắt xích lửa
    "chain_link": particle("aatrox:chain_link", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.14},
        "minecraft:particle_appearance_billboard": {
            "size": [0.1, 0.1],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv("glow"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFF6428", "1.0": "#80B4141E"}),
    }),
    # Hào quang lửa đỏ đen khi biến hình
    "ult_aura": particle("aatrox:ult_aura", "particles_add", {
        **burst(6),
        "minecraft:emitter_shape_disc": {"radius": 0.7, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
        "minecraft:particle_initial_speed": 0.6,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 2.2, 0], "linear_drag_coefficient": 1},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.16 * (1 - {AGE} * 0.7)", f"0.24 * (1 - {AGE} * 0.7)"],
            "facing_camera_mode": "lookat_y",
            "uv": uv("flame"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFF7828", "0.35": "#FFD21423", "1.0": "#00300005"}),
    }),
    # Hút máu: giọt máu phát sáng bay lên quanh người
    "lifesteal": particle("aatrox:lifesteal", "particles_add", {
        **burst(5),
        "minecraft:emitter_shape_disc": {"radius": 0.45, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.8)"},
        "minecraft:particle_initial_speed": 1.2,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.06, 0.08],
            "facing_camera_mode": "lookat_y",
            "uv": uv("drop"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFF3C46", "1.0": "#00A00A1E"}),
    }),
}


def write_particles(root, write_png):
    write_png(os.path.join(root, "AatroxRP", TEXTURE + ".png"), build_atlas())
    folder = os.path.join(root, "AatroxRP/particles")
    os.makedirs(folder, exist_ok=True)
    for name, data in PARTICLES.items():
        with open(os.path.join(folder, f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
    print(f"Particle: {len(PARTICLES)} hiệu ứng")
