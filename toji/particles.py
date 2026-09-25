"""Custom particles of the Inverted Spear of Heaven: pixel art texture atlas + resource pack JSON files.

Style: hard-edged pixels like vanilla particles. Toji has no cursed energy, so his effects are
cold steel (white -> steel blue) and the spear's "nullify" power is shown as broken violet rune rings
and shattering glass shards (the target's techniques/effects breaking).
Most sprites are flipbooks stretched over the particle lifetime.
"""
import json
import math
import os

import model

ATLAS = 256
TEXTURE = "textures/particle/toji_particles"

STEEL = {"W": (255, 255, 255), "L": (206, 222, 245), "B": (140, 162, 206), "V": (150, 110, 230), "D": (70, 44, 120)}
NULL = {"W": (250, 240, 255), "V": (190, 140, 255), "P": (120, 60, 210), "D": (60, 20, 110)}
GRAY = {"#": (255, 255, 255), "+": (190, 190, 190), "-": (125, 125, 125)}
DUST = {"L": (190, 178, 164), "M": (140, 128, 116), "D": (96, 86, 78)}
CRACK = {"K": (24, 20, 28), "D": (70, 60, 72), "V": (170, 120, 255)}
BLOOD = {"H": (236, 70, 70), "R": (170, 16, 30), "D": (96, 6, 16)}
SHADOW = {"K": (22, 16, 30), "D": (48, 34, 70), "V": (110, 80, 170)}


def hash01(x, y, salt=0):
    return model.hash01(x, y, salt)


def grid(w, h, fn):
    return ["".join(fn(x, y) for x in range(w)) for y in range(h)]


def steel_char(heat):
    for limit, char in ((0.8, "W"), (0.6, "L"), (0.4, "B"), (0.22, "V"), (0.08, "D")):
        if heat > limit:
            return char
    return "."


# ---------------------------------------------------------------------------
# Sprites
# ---------------------------------------------------------------------------


def slash_frame(frame):
    """32x32 thin crescent: white-hot cutting edge, steel blue then violet trailing; frays apart."""
    c1, r1 = (16.0, 18.0), 14.5
    c2, r2 = (19.0, 14.0), 13.2
    fade = (1.0, 0.85, 0.55)[frame]
    holes = (0.0, 0.2, 0.55)[frame]

    def pixel(x, y):
        px, py = x + 0.5, y + 0.5
        d1 = math.hypot(px - c1[0], py - c1[1])
        d2 = math.hypot(px - c2[0], py - c2[1])
        if d1 > r1 or d2 < r2:
            return "."
        outer, inner = r1 - d1, d2 - r2
        heat = (1 - 0.95 * outer / (outer + inner + 1e-6)) * fade
        if hash01(x, y, 3 + frame) < holes:
            return "."
        return steel_char(heat)

    return grid(32, 32, pixel)


def streak():
    """8x32 thrust streak: sharp white head, thinning steel tail."""
    def pixel(x, y):
        t = y / 31  # 0 = head (top), 1 = tail
        width = 3.6 * (1 - t) ** 0.7 + 0.4
        off = abs(x + 0.5 - 4)
        if off > width / 2:
            return "."
        return steel_char((1 - t) * (1 - 0.5 * off / (width / 2 + 1e-6)) + 0.1)

    return grid(8, 32, pixel)


def null_ring():
    """32x32 broken rune ring: cracked outer circle, 6 inverted spikes pointing at the center."""
    def pixel(x, y):
        px, py = x + 0.5 - 16, y + 0.5 - 16
        d = math.hypot(px, py)
        a = math.atan2(py, px)
        seg = (a / (2 * math.pi) * 6) % 1  # position inside one of 6 sectors
        if 14 <= d <= 15.5 and not seg < 0.08:
            return "#"
        if 11.8 <= d <= 12.6 and not 0.46 < seg < 0.54:
            return "+"
        # spikes: wide at the inner circle, sharp tip toward the center (inverted)
        if 4.5 <= d < 11.8 and abs(seg - 0.5) < 0.2 * (d - 4.5) / 7.3:
            return "#" if abs(seg - 0.5) < 0.08 * (d - 4.5) / 7.3 else "+"
        if 2 <= d <= 3.2:
            return "-"
        return "."

    return grid(32, 32, pixel)


def shard_frame(frame):
    """8x8 glass shard tumbling: diamond -> tilted -> thin splinter."""
    shapes = [
        ["...W....", "..WVV...", ".WVVPP..", "WVVPPPD.", ".VPPPD..", "..PPD...", "...D....", "........"],
        ["........", ".WW.....", ".WVVV...", "..VVPP..", "...PPPD.", "....PDD.", ".....D..", "........"],
        ["........", "........", "..W.....", "...V....", "....P...", ".....D..", "........", "........"],
    ]
    return shapes[frame]


SPARK = [".WW.", "WWWL", ".WL.", ".LL.", ".LB.", ".BB.", ".BV.", ".V..", "..V.", ".D..", "..D.", "...."]
CHAIN = ["..BB..", ".B..B.", "L....B", "L....B", ".L..B.", "..LL.."]
DROP = ["....D...", "...DR...", "...RRD..", "..RRRRD.", ".DRHRRRD", ".DRHRRRD", "..DRRRD.", "...DDD.."]


def dust_frame(frame):
    """16x16 dust puff, growing and thinning."""
    radius = (4.5, 6.0, 7.0, 7.5)[frame]
    holes = (0.05, 0.2, 0.45, 0.7)[frame]

    def pixel(x, y):
        d = 0
        for cx, cy, r in ((8, 9, radius), (5.5, 7, radius * 0.7), (10.5, 6.5, radius * 0.65)):
            d = max(d, 1 - math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r)
        if d <= 0 or hash01(x, y, 30 + frame) < holes:
            return "."
        return "L" if d > 0.55 else "M" if d > 0.25 else "D"

    return grid(16, 16, pixel)


def ring_frame(frame):
    """32x32 white shockwave: thick -> thin -> shattered."""
    radius, thick, heat, holes = ((10.5, 4.0, 1.0, 0.0), (13.0, 2.6, 0.75, 0.15), (14.5, 1.6, 0.5, 0.5))[frame]

    def pixel(x, y):
        d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
        off = abs(d - radius)
        if off > thick / 2 or hash01(x, y, 50 + frame) < holes:
            return "."
        return steel_char(heat * (1 - 0.6 * off / (thick / 2)))

    return grid(32, 32, pixel)


def crack():
    """32x32 cracked ground: jagged dark cracks radiating out, violet glow in the deepest ones."""
    cells = {}
    for i in range(9):
        angle = i / 9 * 2 * math.pi + hash01(i, 1, 9) * 0.5
        x, y = 16.0, 16.0
        for step in range(15):
            angle += (hash01(i, step, 11) - 0.5) * 0.9
            x += math.cos(angle)
            y += math.sin(angle)
            ix, iy = int(x), int(y)
            if 0 <= ix < 32 and 0 <= iy < 32:
                cells[(ix, iy)] = "V" if step < 4 else "K" if step < 11 else "D"
                if step < 6 and 0 <= ix + 1 < 32:
                    cells.setdefault((ix + 1, iy), "K")
    for x in range(13, 19):
        for y in range(13, 19):
            if math.hypot(x - 15.5, y - 15.5) < 3:
                cells[(x, y)] = "V" if math.hypot(x - 15.5, y - 15.5) < 1.6 else "K"
    return grid(32, 32, lambda x, y: cells.get((x, y), "."))


def wind_frame(frame):
    """8x16 speed line (Heavenly Restriction aura): stretches then thins."""
    length = (10, 15, 12)[frame]
    fade = (1.0, 0.8, 0.45)[frame]

    def pixel(x, y):
        if x not in (3, 4) or y >= length:
            return "."
        heat = fade * (1 - y / length) + 0.1
        return steel_char(heat if x == 3 else heat * 0.7)

    return grid(8, 16, pixel)


def flash_frame(frame):
    """16x16 four-pointed star flash."""
    size = (5.5, 7.5, 6.0)[frame]
    fade = (1.0, 0.85, 0.45)[frame]

    def pixel(x, y):
        dx, dy = abs(x + 0.5 - 8), abs(y + 0.5 - 8)
        v = max(1 - (dx * 3 + dy) / (size * 3), 1 - (dy * 3 + dx) / (size * 3), 1 - math.hypot(dx, dy) / (size * 0.45))
        return steel_char(v * fade * 1.3) if v > 0 else "."

    return grid(16, 16, pixel)


def afterimage():
    """16x32 silhouette of Toji lunging (dark violet, translucent in game)."""
    rows = [
        "......KK........",
        ".....KKKK.......",
        ".....KKKK.......",
        "......KK........",
        "....KKKKKK......",
        "...KKDDDDKK.....",
        "..KKDDDDDDKKVV..",
        "..KDDDDDDDKKVVV.",
        "..KDDDDDDDK..VV.",
        "..KDDDDDDDK.....",
        "..KKDDDDDKK.....",
        "...KDDDDDK......",
        "...KDDDDDK......",
        "...KKDDDKK......",
        "...KDDKDDK......",
        "...KDDKKDDK.....",
        "..KDDK..KDDK....",
        "..KDK....KDDK...",
        ".KDK......KDK...",
        ".KDK......KDK...",
        "KDK........KDK..",
        "KK..........KK..",
    ]
    rows = ["." * 16] * 6 + rows + ["." * 16] * 4
    return rows


def spear_sprite():
    """8x32 RGBA render of the spear (tip up) for the thrown spear projectile."""
    cubes = model.spear_cubes()
    out = []
    for y in range(32):
        row = []
        for x in range(8):
            my = 62 - (y + 0.5) * (62 - 4) / 32
            mx = (x + 0.5 - 5) * (62 - 4) / 32 / 3.2
            color = model.front_color(mx, my, cubes)
            row.append((*color, 255) if color else (0, 0, 0, 0))
        out.append(row)
    return out


INFINITY = {"W": (240, 250, 255), "L": (150, 210, 255), "B": (70, 140, 240), "D": (30, 60, 150)}
BLUE_SHARD = {"W": (240, 250, 255), "V": (150, 210, 255), "P": (70, 140, 240), "D": (30, 60, 150)}
WORM = {"K": (30, 20, 30), "D": (86, 62, 84), "M": (132, 100, 124), "L": (184, 150, 170), "R": (190, 40, 60), "W": (240, 230, 220)}


def infinity_frame(frame):
    """32x32 Gojo's Infinity barrier: a hexagon lattice, cracking then shattering as the spear passes."""
    cracks = (0.0, 0.25, 0.6)[frame]

    def pixel(x, y):
        px, py = x + 0.5 - 16, y + 0.5 - 16
        # hexagon outline of the panel
        hexd = max(abs(px) * 0.866 + abs(py) * 0.5, abs(py))
        if hexd > 15:
            return "."
        if hash01(x // 3, y // 3, 70 + frame) < cracks:
            return "."
        if hexd > 13.8:
            return "W"
        # inner hex cells
        q = (px * 0.577 - py / 3) / 4
        r = (py * 2 / 3) / 4
        fq, fr = q - math.floor(q), r - math.floor(r)
        edge = min(fq, 1 - fq, fr, 1 - fr, abs(fq + fr - 1))
        if edge < 0.09:
            return "L"
        # radial crack lines from the impact point in the center
        a = math.atan2(py, px)
        if frame and abs(math.sin(a * 5)) < 0.08 and math.hypot(px, py) < 14:
            return "W"
        return "B" if hash01(x, y, 90) < 0.5 else "D"

    return grid(32, 32, pixel)


def x_slash_frame(frame):
    """32x32 giant X cut: two thin steel crescents crossing; frays apart."""
    fade = (1.0, 0.8, 0.5)[frame]
    holes = (0.0, 0.2, 0.55)[frame]

    def cut(px, py, sign):
        # distance to the diagonal line, the cut is widest in the middle
        t = (px + sign * py) / math.sqrt(2)
        d = abs(px - sign * py) / math.sqrt(2)
        width = 2.4 * (1 - (t / 15) ** 2)
        return 1 - d / width if width > 0 and d < width else 0

    def pixel(x, y):
        px, py = x + 0.5 - 16, y + 0.5 - 16
        heat = max(cut(px, py, 1), cut(px, py, -1)) * fade
        if heat <= 0 or hash01(x, y, 110 + frame) < holes:
            return "."
        return steel_char(heat + 0.15)

    return grid(32, 32, pixel)


def worm_body():
    """16x16 segment of the Inventory Curse (the worm Toji stores his weapons in): ringed, fleshy."""
    def pixel(x, y):
        d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
        if d > 7:
            return "."
        if d > 6.2:
            return "K"
        if (x + 1) % 5 == 0:
            return "D"
        return "L" if y < 6 else "M" if y < 11 else "D"

    return grid(16, 16, pixel)


def worm_head():
    """16x16 worm head: round, a wide red mouth with teeth, two small eyes."""
    def pixel(x, y):
        px, py = x + 0.5 - 8, y + 0.5 - 8
        d = math.hypot(px, py)
        if d > 7.5:
            return "."
        if d > 6.7:
            return "K"
        if py > 0.5 and abs(px) < 5 and py < 5:
            return "W" if py < 1.8 and x % 2 == 0 else "R"
        if py < -2 and py > -4 and abs(abs(px) - 3) < 1:
            return "K"
        return "L" if py < -3 else "M"

    return grid(16, 16, pixel)


# name: (x, y, frames, palette or None for raw RGBA frames)
SPRITES = {
    "slash": (0, 0, [slash_frame(i) for i in range(3)], STEEL),
    "ring": (0, 32, [ring_frame(i) for i in range(3)], STEEL),
    "null": (96, 0, [null_ring()], GRAY),
    "crack": (96, 32, [crack()], CRACK),
    "streak": (0, 64, [streak()], STEEL),
    "spear": (8, 64, [spear_sprite()], None),
    "afterimage": (16, 64, [afterimage()], SHADOW),
    "dust": (32, 64, [dust_frame(i) for i in range(4)], DUST),
    "flash": (32, 80, [flash_frame(i) for i in range(3)], STEEL),
    "wind": (80, 80, [wind_frame(i) for i in range(3)], STEEL),
    "shard": (0, 96, [shard_frame(i) for i in range(3)], NULL),
    "spark": (24, 96, [SPARK], STEEL),
    "chain": (28, 96, [CHAIN], STEEL),
    "drop": (34, 96, [DROP], BLOOD),
    "x_slash": (128, 0, [x_slash_frame(i) for i in range(3)], STEEL),
    "infinity": (128, 32, [infinity_frame(i) for i in range(3)], INFINITY),
    "shard_blue": (224, 32, [shard_frame(i) for i in range(3)], BLUE_SHARD),
    "worm_body": (128, 64, [worm_body()], WORM),
    "worm_head": (144, 64, [worm_head()], WORM),
}


def build_atlas():
    pixels = [[(0, 0, 0, 0)] * ATLAS for _ in range(ATLAS)]
    for name, (ox, oy, frames, palette) in SPRITES.items():
        for f, rows in enumerate(frames):
            w = len(rows[0])
            for j, row in enumerate(rows):
                for i, ch in enumerate(row):
                    if palette is None:
                        if ch[3]:
                            pixels[oy + j][ox + f * w + i] = ch
                    elif ch != ".":
                        pixels[oy + j][ox + f * w + i] = (*palette[ch], 255)
    return pixels


def check_layout():
    used = {}
    for name, (ox, oy, frames, _) in SPRITES.items():
        w, h = len(frames[0][0]), len(frames[0])
        for f in range(len(frames)):
            for y in range(oy, oy + h):
                for x in range(ox + f * w, ox + (f + 1) * w):
                    if x >= ATLAS or y >= ATLAS:
                        raise ValueError(f"{name} outside the atlas")
                    if (x, y) in used:
                        raise ValueError(f"{name} overlaps {used[(x, y)]}")
                    used[(x, y)] = name


# ---------------------------------------------------------------------------
# Particle definitions
# ---------------------------------------------------------------------------

AGE = "v.particle_age / v.particle_lifetime"


def uv(sprite, fps=12):
    ox, oy, frames, _ = SPRITES[sprite]
    w, h = len(frames[0][0]), len(frames[0])
    base = {"texture_width": ATLAS, "texture_height": ATLAS}
    if len(frames) == 1:
        return {**base, "uv": [ox, oy], "uv_size": [w, h]}
    return {**base, "flipbook": {
        "base_UV": [ox, oy], "size_UV": [w, h], "step_UV": [w, 0],
        "frames_per_second": fps, "max_frame": len(frames), "stretch_to_lifetime": True, "loop": False,
    }}


def tint(stops):
    return {"color": {"interpolant": AGE, "gradient": stops}}


FADE = tint({"0.0": "#FFFFFFFF", "0.7": "#FFFFFFFF", "1.0": "#00FFFFFF"})
DIR = ["v.dir_x", "v.dir_y", "v.dir_z"]


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


def flat(sprite, size, life, color=FADE, material="particles_add", spin=None):
    """A single sprite lying flat on the ground, size may use v.radius."""
    comps = {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": life},
        "minecraft:particle_appearance_billboard": {
            "size": [size, size], "facing_camera_mode": "emitter_transform_xz", "uv": uv(sprite),
        },
        "minecraft:particle_appearance_tinting": color,
    }
    if spin is not None:
        comps["minecraft:particle_initial_spin"] = {"rotation": "math.random(0, 360)", "rotation_rate": spin}
    return particle(f"toji:{sprite}", material, comps)


PARTICLES = {
    # Steel crescent slash (dash slashes, ult)
    "slash": particle("toji:slash", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.24},
        "minecraft:particle_initial_spin": {"rotation": "math.random(-180, 180)"},
        "minecraft:particle_appearance_billboard": {
            "size": [f"1.3 + {AGE} * 0.5", f"1.3 + {AGE} * 0.5"], "facing_camera_mode": "rotate_xyz", "uv": uv("slash"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Thrust streaks shooting along the stab direction (v.dir_*)
    "thrust": particle("toji:thrust", "particles_add", {
        **burst(10),
        "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": DIR},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.15, 0.3)"},
        "minecraft:particle_initial_speed": "math.random(14, 26)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 6},
        "minecraft:particle_appearance_billboard": {
            "size": [0.07, f"0.9 * (1 - {AGE} * 0.6)"],
            "facing_camera_mode": "lookat_direction", "direction": {"mode": "derive_from_velocity"},
            "uv": uv("streak"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Nullify: broken violet rune ring flashing on the target, spinning and shrinking
    "null_ring": particle("toji:null_ring", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 260},
        "minecraft:particle_appearance_billboard": {
            "size": [f"1.4 - {AGE} * 0.7", f"1.4 - {AGE} * 0.7"], "facing_camera_mode": "rotate_xyz", "uv": uv("null"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFFFFF", "0.25": "#FFBE8CFF", "1.0": "#008040E0"}),
    }),
    # Nullify: the ring on the ground under the target
    "null_ground": particle("toji:null_ground", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.8},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": -90},
        "minecraft:particle_appearance_billboard": {
            "size": [f"v.radius * (0.6 + 0.4 * math.sqrt({AGE}))", f"v.radius * (0.6 + 0.4 * math.sqrt({AGE}))"],
            "facing_camera_mode": "emitter_transform_xz", "uv": uv("null"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFD2AAFF", "0.6": "#CC9A60F0", "1.0": "#006030C0"}),
    }),
    # Nullify: glass shards bursting out (the target's effects/technique shattering)
    "shard": particle("toji:shard", "particles_add", {
        **burst(14),
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
        "minecraft:particle_initial_speed": "math.random(3, 6)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-400, 400)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -9, 0], "linear_drag_coefficient": 2.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.14, 0.14], "facing_camera_mode": "rotate_xyz", "uv": uv("shard"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Steel sparks on every hit
    "spark": particle("toji:spark", "particles_add", {
        **burst(12),
        "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.15, 0.35)"},
        "minecraft:particle_initial_speed": "math.random(6, 10)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -8, 0], "linear_drag_coefficient": 5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.05, f"0.24 * (1 - {AGE} * 0.5)"],
            "facing_camera_mode": "lookat_direction", "direction": {"mode": "derive_from_velocity"},
            "uv": uv("spark"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Chain link of the Thousand-Mile Chain
    "chain_link": particle("toji:chain_link", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.12},
        "minecraft:particle_initial_spin": {"rotation": "math.random(-30, 30)"},
        "minecraft:particle_appearance_billboard": {
            "size": [0.12, 0.12], "facing_camera_mode": "rotate_xyz", "uv": uv("chain"),
        },
    }),
    # The thrown spear itself, pointing along its flight (v.dir_*)
    "spear": particle("toji:spear", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {"direction": DIR},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.1},
        "minecraft:particle_initial_speed": 0.5,
        "minecraft:particle_appearance_billboard": {
            "size": [0.2, 0.8], "facing_camera_mode": "lookat_direction", "direction": {"mode": "derive_from_velocity"},
            "uv": uv("spear"),
        },
    }),
    # Afterimage of Toji left behind when dashing
    "afterimage": particle("toji:afterimage", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.4},
        "minecraft:particle_appearance_billboard": {
            "size": [0.9, 1.8], "facing_camera_mode": "lookat_y", "uv": uv("afterimage"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#AAFFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # Dust kicked up by dashes and the ult landing
    "dust": particle("toji:dust", "particles_alpha", {
        **burst(8),
        "minecraft:emitter_shape_disc": {"radius": 0.6, "plane_normal": "y", "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.1)"},
        "minecraft:particle_initial_speed": "math.random(1.5, 3.5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0], "linear_drag_coefficient": 3},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.35 + {AGE} * 0.4", f"0.35 + {AGE} * 0.4"], "facing_camera_mode": "rotate_xyz", "uv": uv("dust"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#DDFFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # Cracked ground (radius in v.radius)
    "crack": particle("toji:crack", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 2.5},
        "minecraft:particle_appearance_billboard": {
            "size": ["v.radius", "v.radius"], "facing_camera_mode": "emitter_transform_xz", "uv": uv("crack"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFFFFF", "0.8": "#FFFFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # White shockwave ring spreading on the ground (radius in v.radius)
    "shock_ring": particle("toji:shock_ring", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.4},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.3 + (v.radius - 0.3) * math.sqrt({AGE})", f"0.3 + (v.radius - 0.3) * math.sqrt({AGE})"],
            "facing_camera_mode": "emitter_transform_xz", "uv": uv("ring"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Heavenly Restriction aura: speed lines rushing up around the body
    "aura": particle("toji:aura", "particles_add", {
        **burst(5),
        "minecraft:emitter_shape_disc": {"radius": 0.55, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.25, 0.45)"},
        "minecraft:particle_initial_speed": "math.random(4, 7)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2},
        "minecraft:particle_appearance_billboard": {
            "size": [0.05, 0.5], "facing_camera_mode": "lookat_direction", "direction": {"mode": "derive_from_velocity"},
            "uv": uv("wind"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FFFFFF", "0.2": "#CCFFFFFF", "1.0": "#00B4C8FF"}),
    }),
    # Wind gathering into the spear (awakening charge, ult)
    "charge": particle("toji:charge", "particles_add", {
        **burst(16),
        "minecraft:emitter_shape_sphere": {"radius": 2.2, "direction": "inwards", "surface_only": True},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.3},
        "minecraft:particle_initial_speed": 7,
        "minecraft:particle_appearance_billboard": {
            "size": [0.05, 0.45], "facing_camera_mode": "lookat_direction", "direction": {"mode": "derive_from_velocity"},
            "uv": uv("wind"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FFFFFF", "0.3": "#FFFFFFFF", "1.0": "#88C8B4FF"}),
    }),
    # Star flash at impact points
    "flash": particle("toji:flash", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.22},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.8 + {AGE} * 1.0", f"0.8 + {AGE} * 1.0"], "facing_camera_mode": "rotate_xyz", "uv": uv("flash"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Blood spray on strong hits
    "blood": particle("toji:blood", "particles_alpha", {
        **burst(12),
        "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.4, 0.8)"},
        "minecraft:particle_initial_speed": "math.random(2, 4.5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -14, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_motion_collision": {"collision_radius": 0.05, "coefficient_of_restitution": 0.1,
                                                "collision_drag": 6},
        "minecraft:particle_appearance_billboard": {
            "size": [0.1, 0.1], "facing_camera_mode": "rotate_xyz", "uv": uv("drop"),
        },
    }),
    # Rock/dust column erupting upward at the ult landing
    "debris": particle("toji:debris", "particles_alpha", {
        **burst(14),
        "minecraft:emitter_shape_disc": {"radius": 0.8, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.0)"},
        "minecraft:particle_initial_speed": "math.random(5, 10)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -18, 0], "linear_drag_coefficient": 1},
        "minecraft:particle_motion_collision": {"collision_radius": 0.1, "coefficient_of_restitution": 0.3,
                                                "collision_drag": 4},
        "minecraft:particle_appearance_billboard": {
            "size": [0.18, 0.18], "facing_camera_mode": "rotate_xyz", "uv": uv("dust"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FF9A8A80", "1.0": "#FF6A5E58"}),
    }),
    # Pierce: Gojo's Infinity barrier appears in front of the target and shatters
    "infinity": particle("toji:infinity", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
        "minecraft:particle_appearance_billboard": {
            "size": [f"1.1 + {AGE} * 0.4", f"1.1 + {AGE} * 0.4"], "facing_camera_mode": "rotate_xyz", "uv": uv("infinity"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#EEFFFFFF", "0.7": "#CCFFFFFF", "1.0": "#00FFFFFF"}),
    }),
    "shard_blue": particle("toji:shard_blue", "particles_add", {
        **burst(22),
        "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 1.0)"},
        "minecraft:particle_initial_speed": "math.random(4, 8)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-500, 500)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -10, 0], "linear_drag_coefficient": 2.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.16, 0.16], "facing_camera_mode": "rotate_xyz", "uv": uv("shard_blue"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Giant X cut (Heavenly Ambush, plunge impact); size in v.radius
    "x_slash": particle("toji:x_slash", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35},
        "minecraft:particle_initial_spin": {"rotation": "math.random(-15, 15)"},
        "minecraft:particle_appearance_billboard": {
            "size": [f"v.radius * (0.8 + {AGE} * 0.3)", f"v.radius * (0.8 + {AGE} * 0.3)"],
            "facing_camera_mode": "rotate_xyz", "uv": uv("x_slash"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Inventory Curse worm: segments/head spawned every tick along its path (short-lived so it moves smoothly)
    "worm_body": particle("toji:worm_body", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.12},
        "minecraft:particle_appearance_billboard": {
            "size": ["v.radius", "v.radius"], "facing_camera_mode": "rotate_xyz", "uv": uv("worm_body"),
        },
    }),
    "worm_head": particle("toji:worm_head", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.12},
        "minecraft:particle_appearance_billboard": {
            "size": [0.34, 0.34], "facing_camera_mode": "rotate_xyz", "uv": uv("worm_head"),
        },
    }),
    # Vanishing: dark smoke burst where Toji disappears (no cursed energy: he just vanishes)
    "vanish": particle("toji:vanish", "particles_alpha", {
        **burst(16),
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.4, 0.8)"},
        "minecraft:particle_initial_speed": "math.random(1, 3)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.5, 0], "linear_drag_coefficient": 3},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.4 + {AGE} * 0.5", f"0.4 + {AGE} * 0.5"], "facing_camera_mode": "rotate_xyz", "uv": uv("dust"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#EE201830", "1.0": "#00100C18"}),
    }),
}


def write_particles(root, write_png):
    check_layout()
    write_png(os.path.join(root, "TojiRP", TEXTURE + ".png"), build_atlas())
    folder = os.path.join(root, "TojiRP/particles")
    os.makedirs(folder, exist_ok=True)
    for name, data in PARTICLES.items():
        with open(os.path.join(folder, f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
    print(f"Particles: {len(PARTICLES)} effects")
