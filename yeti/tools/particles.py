"""New Yeti particles: pixel-art ice texture atlas + resource pack particle JSON files.

Every sprite is drawn in code with a small ice palette (white -> pale cyan -> cyan -> blue -> deep blue)
and hard pixel edges like vanilla particles. Dark blue outlines keep the effects readable on snow.
Multi-frame sprites are flipbooks stretched over the particle lifetime.

Scripts can pass Molang variables when spawning (MolangVariableMap):
  variable.radius   - size of rings, telegraphs, cracks, auras (blocks)
  variable.duration - how long a telegraph / prison stays (seconds)
  variable.dir_x/y/z - direction of frost breath / claw slash
"""
import json
import math
import os

from PIL import Image

ATLAS = 256
TEXTURE = "textures/particle/ytaun_yeti_fx"

ICE = {
    "W": (250, 254, 255),
    "L": (206, 242, 255),
    "C": (140, 214, 250),
    "B": (82, 164, 236),
    "D": (46, 104, 200),
    "N": (28, 58, 138),
}


def hash01(x, y, salt=0):
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def rgba(char, alpha=255):
    r, g, b = ICE[char]
    return (r, g, b, alpha)


def new(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def shade(level):
    """0..1 brightness -> ice color char."""
    for limit, char in ((0.85, "W"), (0.66, "L"), (0.48, "C"), (0.3, "B"), (0.14, "D")):
        if level > limit:
            return char
    return "N"


# ---------------------------------------------------------------------------
# Sprites (each returns a list of frames)
# ---------------------------------------------------------------------------


def shockwave():
    """Flat ground ring: thick and bright, then thins out and shatters."""
    frames = []
    for f in range(4):
        img = new(32, 32)
        radius = (11.5, 13.0, 14.0, 14.8)[f]
        width = (4.5, 3.6, 2.6, 1.8)[f]
        holes = (0.0, 0.08, 0.3, 0.55)[f]
        for y in range(32):
            for x in range(32):
                d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
                t = abs(d - radius) / width
                if t > 1 or hash01(x, y, f + 3) < holes:
                    continue
                if t > 0.78:
                    img.putpixel((x, y), rgba("D"))
                else:
                    edge = 1 - t + (hash01(x, y, 7) - 0.5) * 0.25
                    img.putpixel((x, y), rgba(shade(0.35 + edge * 0.65)))
        frames.append(img)
    return frames


def telegraph():
    """Warning circle (gray-scale, tinted in JSON): dark outline, dashed inner ring, soft fill."""
    img = new(32, 32)
    for y in range(32):
        for x in range(32):
            dx, dy = x + 0.5 - 16, y + 0.5 - 16
            d = math.hypot(dx, dy)
            angle = math.degrees(math.atan2(dy, dx)) % 360
            if 14.2 <= d < 15.6:
                img.putpixel((x, y), (60, 60, 60, 255))
            elif 12.6 <= d < 14.2:
                img.putpixel((x, y), (255, 255, 255, 255))
            elif 9.0 <= d < 10.2 and int(angle / 22.5) % 2 == 0:
                img.putpixel((x, y), (235, 235, 235, 230))
            elif d < 12.6:
                img.putpixel((x, y), (255, 255, 255, 70 if (x + y) % 2 else 50))
    return [img]


def crack():
    """Glowing ice fracture spreading from the center (flat on the ground)."""
    img = new(32, 32)
    cells = set()
    for arm in range(7):
        angle = arm * (360 / 7) + hash01(arm, 1, 9) * 30
        x, y = 16.0, 16.0
        length = 10 + hash01(arm, 2, 9) * 5
        steps = int(length)
        for s in range(steps):
            angle += (hash01(arm, s, 11) - 0.5) * 50
            x += math.cos(math.radians(angle))
            y += math.sin(math.radians(angle))
            cells.add((int(x), int(y)))
            if s == steps // 2:
                bx, by, ba = x, y, angle + (35 if hash01(arm, 5, 3) > 0.5 else -35)
                for _ in range(4):
                    bx += math.cos(math.radians(ba))
                    by += math.sin(math.radians(ba))
                    cells.add((int(bx), int(by)))
    for (x, y) in cells:
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + ox, y + oy)
            if 0 <= p[0] < 32 and 0 <= p[1] < 32 and p not in cells:
                img.putpixel(p, rgba("C", 200))
    for (x, y) in cells:
        if 0 <= x < 32 and 0 <= y < 32:
            img.putpixel((x, y), rgba("N"))
    for y in range(13, 19):
        for x in range(13, 19):
            if math.hypot(x + 0.5 - 16, y + 0.5 - 16) < 3:
                img.putpixel((x, y), rgba("L" if (x + y) % 2 else "W"))
    return [img]


def claw_slash():
    """Three curved claw streaks: flash in, full, fading, shattered."""
    frames = []
    a, b = (27.0, 4.0), (5.0, 27.0)
    length = math.hypot(b[0] - a[0], b[1] - a[1])
    tx, ty = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    nx, ny = ty, -tx  # bulge toward the top-left
    for f in range(4):
        img = new(32, 32)
        holes = (0.0, 0.0, 0.25, 0.6)[f]
        thick = (0.9, 1.5, 1.2, 0.9)[f]
        reach = (0.55, 1.0, 1.0, 1.0)[f]
        for i, off in enumerate((-5.0, 0.0, 5.0)):
            for s in range(80):
                t = s / 79
                if t > reach:
                    continue
                bulge = math.sin(t * math.pi) * 5
                x = a[0] + tx * length * t + nx * (bulge + off)
                y = a[1] + ty * length * t + ny * (bulge + off)
                w = thick * math.sin(t * math.pi) * (1.4 if off == 0 else 1.0) + 0.35
                for yy in range(int(y - w - 1), int(y + w + 2)):
                    for xx in range(int(x - w - 1), int(x + w + 2)):
                        if not (0 <= xx < 32 and 0 <= yy < 32):
                            continue
                        d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
                        if d > w or hash01(xx, yy, f * 5 + i) < holes:
                            continue
                        char = "W" if d < w * 0.45 else ("L" if d < w * 0.8 else "B")
                        cur = img.getpixel((xx, yy))
                        if cur[3] == 0 or char == "W":
                            img.putpixel((xx, yy), rgba(char))
        frames.append(img)
    return frames


def puff():
    """Soft snow cloud that grows and breaks apart."""
    frames = []
    for f in range(4):
        img = new(16, 16)
        radius = (4.5, 6.0, 6.8, 7.2)[f]
        holes = (0.0, 0.1, 0.35, 0.65)[f]
        for y in range(16):
            for x in range(16):
                d = math.hypot(x + 0.5 - 8, y + 0.5 - 8) + (hash01(x, y, 21) - 0.5) * 2.2
                if d > radius or hash01(x, y, f + 30) < holes:
                    continue
                level = 1 - d / radius * 0.55 - (y / 16) * 0.25
                img.putpixel((x, y), rgba(shade(0.4 + level * 0.6), 235))
        frames.append(img)
    return frames


def shard(variant):
    """Jagged ice shard, lit top-left."""
    img = new(16, 16)
    pts = [
        [(8, 1), (12, 7), (9, 15), (4, 9)],
        [(3, 2), (13, 5), (11, 12), (5, 13)],
        [(7, 0), (11, 4), (10, 15), (5, 11), (6, 4)],
        [(2, 8), (8, 2), (14, 6), (9, 14)],
    ][variant]
    poly = [(px + 0.5, py + 0.5) for px, py in pts]

    def inside(x, y):
        c = False
        j = len(poly) - 1
        for i in range(len(poly)):
            xi, yi = poly[i]
            xj, yj = poly[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
                c = not c
            j = i
        return c

    for y in range(16):
        for x in range(16):
            if not inside(x + 0.5, y + 0.5):
                continue
            edge = not all(inside(x + 0.5 + ox, y + 0.5 + oy) for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                img.putpixel((x, y), rgba("D"))
            else:
                light = 1 - (x + y) / 30 + (hash01(x, y, variant) - 0.5) * 0.2
                img.putpixel((x, y), rgba(shade(0.3 + light * 0.7)))
    return img


def glint():
    """Four-point star twinkle: grows, peaks, shrinks."""
    frames = []
    for f in range(4):
        img = new(16, 16)
        arm = (2, 5, 7, 3)[f]
        for i in range(-arm, arm + 1):
            for x, y in ((8 + i, 8), (8, 8 + i)):
                a = abs(i)
                char = "W" if a <= arm * 0.35 else ("L" if a <= arm * 0.7 else "C")
                img.putpixel((x, y), rgba(char))
        if f in (1, 2):
            for x, y in ((7, 7), (9, 7), (7, 9), (9, 9)):
                img.putpixel((x, y), rgba("L"))
        frames.append(img)
    return frames


def snowflake(variant):
    """Six-armed pixel snowflake."""
    img = new(16, 16)
    arm_len = (6, 5, 7, 6)[variant]
    branch_at = (3, 2, 4, 3)[variant]
    for k in range(6):
        a = math.radians(k * 60 + 90)
        for s in range(arm_len + 1):
            x, y = 8 + math.cos(a) * s, 8 - math.sin(a) * s
            px, py = min(15, max(0, int(round(x - 0.01)))), min(15, max(0, int(round(y - 0.01))))
            img.putpixel((px, py), rgba("W" if s < 3 else "L"))
            if s == branch_at:
                for side in (-1, 1):
                    ba = a + side * math.radians(55)
                    for b in range(1, 3):
                        bx, by = x + math.cos(ba) * b, y - math.sin(ba) * b
                        if 0 <= bx < 16 and 0 <= by < 16:
                            img.putpixel((int(bx), int(by)), rgba("C"))
    return img


def mist():
    """Frost breath mist: pale, transparent, swelling."""
    frames = []
    for f in range(4):
        img = new(16, 16)
        radius = (3.5, 5.0, 6.5, 7.5)[f]
        alpha = (230, 210, 170, 120)[f]
        for y in range(16):
            for x in range(16):
                d = math.hypot(x + 0.5 - 8, y + 0.5 - 8) + (hash01(x, y, 41 + f) - 0.5) * 2.5
                if d > radius or (f >= 2 and hash01(x, y, 50 + f) < 0.25 * (f - 1)):
                    continue
                img.putpixel((x, y), rgba("W" if d < radius * 0.35 else ("L" if d < radius * 0.7 else "C"), alpha))
        frames.append(img)
    return frames


def heal():
    """Small rising ice crystal (diamond) with a sparkle."""
    frames = []
    for f in range(4):
        img = new(16, 16)
        size = (3, 4, 4, 3)[f]
        for y in range(16):
            for x in range(16):
                d = abs(x + 0.5 - 8) + abs(y + 0.5 - 8) * 0.7
                if d <= size:
                    char = "N" if d > size - 0.8 else ("W" if x < 8 and y < 8 else "C")
                    img.putpixel((x, y), rgba(char))
        if f in (1, 2):
            for p in ((12, 3), (13, 3), (12, 2), (11, 3), (12, 4)):
                img.putpixel(p, rgba("W"))
        frames.append(img)
    return frames


def boulder(variant):
    """Chunky ice boulder: irregular polygon split into flat-shaded facets, lit top-left."""
    img = new(32, 32)
    n = 7
    verts = []
    for i in range(n):
        ang = (i + hash01(i, variant, 60) * 0.5) / n * 2 * math.pi
        r = 10.5 + hash01(i, variant, 61) * 4.5
        verts.append((16 + math.cos(ang) * r, 16 + math.sin(ang) * r))
    core = (14.5 + variant, 14.0)

    def tri_shade(p0, p1):
        # facet normal ~ direction from core to the edge middle; light comes from the top-left
        mx, my = (p0[0] + p1[0]) / 2 - core[0], (p0[1] + p1[1]) / 2 - core[1]
        ln = math.hypot(mx, my) or 1
        return 0.62 + (-mx / ln - my / ln) * 0.28

    def in_tri(p, a, b, c):
        def sign(p1, p2, p3):
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
        d1, d2, d3 = sign(p, a, b), sign(p, b, c), sign(p, c, a)
        return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))

    for y in range(32):
        for x in range(32):
            p = (x + 0.5, y + 0.5)
            for i in range(n):
                v0, v1 = verts[i], verts[(i + 1) % n]
                if in_tri(p, core, v0, v1):
                    light = tri_shade(v0, v1) + (hash01(x, y, 70 + variant) - 0.5) * 0.12
                    img.putpixel((x, y), rgba(shade(light)))
                    break
    # dark outline around the silhouette
    base = img.copy()
    for y in range(32):
        for x in range(32):
            if base.getpixel((x, y))[3] == 0:
                continue
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                qx, qy = x + ox, y + oy
                if not (0 <= qx < 32 and 0 <= qy < 32) or base.getpixel((qx, qy))[3] == 0:
                    img.putpixel((x, y), rgba("N"))
                    break
    for i in range(5):
        img.putpixel((11 + i // 2, 10 + i % 2), rgba("W"))
    return img


def icicle():
    """Falling icicle, point down (16x32)."""
    img = new(16, 32)
    for y in range(32):
        half = 6.5 * (1 - y / 31) ** 0.9
        for x in range(16):
            dx = x + 0.5 - 8
            if abs(dx) > half:
                continue
            if abs(dx) > half - 1:
                img.putpixel((x, y), rgba("D"))
            else:
                img.putpixel((x, y), rgba("W" if dx < -half * 0.3 else ("L" if dx < half * 0.3 else "C")))
    return img


def pillar():
    """Ice crystal pillar, point up (16x32): used for the Ice Prison cage."""
    img = new(16, 32)
    for y in range(32):
        top = y < 8
        half = (6.5 * y / 8) if top else 6.5
        for x in range(16):
            dx = x + 0.5 - 8
            if abs(dx) > half:
                continue
            if abs(dx) > half - 1 or y == 31:
                img.putpixel((x, y), rgba("N"))
            elif abs(dx) < 0.8:
                img.putpixel((x, y), rgba("W"))
            else:
                char = "L" if dx < 0 else "B"
                if (y + int(dx)) % 9 == 0:
                    char = "C"
                img.putpixel((x, y), rgba(char))
    return img


def beam():
    """Vertical light beam (16x64), bright core, fading toward the top."""
    img = new(16, 64)
    for y in range(64):
        fade = 0.25 + 0.75 * (y / 63)
        for x in range(16):
            dx = abs(x + 0.5 - 8)
            core = 1 - dx / 8
            if core <= 0:
                continue
            level = core * fade
            if level < 0.12:
                continue
            char = "W" if level > 0.6 else ("L" if level > 0.4 else ("C" if level > 0.22 else "B"))
            img.putpixel((x, y), rgba(char, int(255 * min(1, level * 1.6))))
    return img


# ---------------------------------------------------------------------------
# Atlas layout (x, y) of the first frame; frames are laid out left to right
# ---------------------------------------------------------------------------

LAYOUT = {
    "shockwave": (0, 0),     # 4 x 32x32
    "claw": (128, 0),        # 4 x 32x32
    "telegraph": (0, 32),    # 32x32
    "crack": (32, 32),       # 32x32
    "boulder": (64, 32),     # 2 x 32x32
    "beam": (128, 32),       # 16x64
    "icicle": (144, 32),     # 16x32
    "pillar": (160, 32),     # 16x32
    "puff": (0, 64),         # 4 x 16x16
    "shard": (64, 64),       # 4 x 16x16 (variants)
    "glint": (0, 80),        # 4 x 16x16
    "snowflake": (64, 80),   # 4 x 16x16 (variants)
    "mist": (0, 96),         # 4 x 16x16
    "heal": (64, 96),        # 4 x 16x16
}


def build_atlas():
    atlas = new(ATLAS, ATLAS)

    def place(name, frames):
        x0, y0 = LAYOUT[name]
        for i, frame in enumerate(frames):
            atlas.paste(frame, (x0 + i * frame.width, y0), frame)

    place("shockwave", shockwave())
    place("claw", claw_slash())
    place("telegraph", telegraph())
    place("crack", crack())
    place("boulder", [boulder(0), boulder(1)])
    place("beam", [beam()])
    place("icicle", [icicle()])
    place("pillar", [pillar()])
    place("puff", puff())
    place("shard", [shard(i) for i in range(4)])
    place("glint", glint())
    place("snowflake", [snowflake(i) for i in range(4)])
    place("mist", mist())
    place("heal", heal())
    return atlas


# ---------------------------------------------------------------------------
# Particle JSON
# ---------------------------------------------------------------------------


def uv_flip(name, size, frames, fps=12, stretch=True, loop=False):
    x, y = LAYOUT[name]
    flip = {
        "base_UV": [x, y],
        "size_UV": [size[0], size[1]],
        "step_UV": [size[0], 0],
        "max_frame": frames,
        "stretch_to_lifetime": stretch,
        "loop": loop,
        "frames_per_second": fps,
    }
    return {"texture_width": ATLAS, "texture_height": ATLAS, "flipbook": flip}


def uv_static(name, size, variants=1):
    x, y = LAYOUT[name]
    u = x if variants == 1 else f"{x} + math.floor(v.particle_random_2 * {variants}) * {size[0]}"
    return {"texture_width": ATLAS, "texture_height": ATLAS, "uv": [u, y], "uv_size": [size[0], size[1]]}


def fade(start=0.6, color="FFFFFF"):
    return {
        "color": {
            "interpolant": "v.particle_age / v.particle_lifetime",
            "gradient": {"0.0": f"#FF{color}", f"{start}": f"#FF{color}", "1.0": f"#00{color}"},
        }
    }


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


RADIUS = "(v.radius > 0 ? v.radius : {d})"
DURATION = "(v.duration > 0 ? v.duration : {d})"


def effects():
    fx = {}

    # Ground shockwave ring that expands to variable.radius
    fx["ytaun:frost_shockwave"] = particle("ytaun:frost_shockwave", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 0.12, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6},
        "minecraft:particle_appearance_billboard": {
            "size": [
                f"0.4 + ({RADIUS.format(d=4)} - 0.4) * math.sqrt(v.particle_age / v.particle_lifetime)",
                f"0.4 + ({RADIUS.format(d=4)} - 0.4) * math.sqrt(v.particle_age / v.particle_lifetime)",
            ],
            "facing_camera_mode": "emitter_transform_xz",
            "uv": uv_flip("shockwave", (32, 32), 4),
        },
        "minecraft:particle_appearance_tinting": fade(0.55),
    })

    # Ground warning circles (blue = normal, red = heavy hit). Stays for variable.duration.
    for name, color in (("ytaun:telegraph", "8FD8FF"), ("ytaun:telegraph_danger", "FF5A4A")):
        fx[name] = particle(name, "particles_blend", {
            "minecraft:emitter_rate_instant": {"num_particles": 1},
            "minecraft:emitter_lifetime_once": {"active_time": 0.05},
            "minecraft:emitter_shape_point": {"offset": [0, 0.08, 0]},
            "minecraft:particle_lifetime_expression": {"max_lifetime": DURATION.format(d=1)},
            "minecraft:particle_appearance_billboard": {
                "size": [
                    f"{RADIUS.format(d=3)} * math.min(1, 0.3 + v.particle_age * 5)",
                    f"{RADIUS.format(d=3)} * math.min(1, 0.3 + v.particle_age * 5)",
                ],
                "facing_camera_mode": "emitter_transform_xz",
                "uv": uv_static("telegraph", (32, 32)),
            },
            "minecraft:particle_appearance_tinting": {
                "color": [
                    round(int(color[0:2], 16) / 255, 3), round(int(color[2:4], 16) / 255, 3), round(int(color[4:6], 16) / 255, 3),
                    "0.55 + 0.35 * math.sin(v.particle_age * 900)",
                ]
            },
        })

    # Glowing ice fracture decal on the ground
    fx["ytaun:ground_crack"] = particle("ytaun:ground_crack", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 0.06, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 3.0},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_1 * 360"},
        "minecraft:particle_appearance_billboard": {
            "size": [RADIUS.format(d=2.5), RADIUS.format(d=2.5)],
            "facing_camera_mode": "emitter_transform_xz",
            "uv": uv_static("crack", (32, 32)),
        },
        "minecraft:particle_appearance_tinting": fade(0.7),
    })

    # Burst of ice shards that fly out, fall and bounce on the ground
    fx["ytaun:ice_shards"] = particle("ytaun:ice_shards", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": "10 + v.radius * 3"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"offset": [0, 0.4, 0], "radius": "0.3 + v.radius * 0.15", "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.9 + v.particle_random_1 * 0.6"},
        "minecraft:particle_initial_speed": "5 + v.particle_random_3 * 5",
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_1 * 360", "rotation_rate": "(v.particle_random_4 - 0.5) * 900"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -22, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_motion_collision": {"collision_drag": 6, "coefficient_of_restitution": 0.3, "collision_radius": 0.1},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.12 + v.particle_random_3 * 0.12", "0.12 + v.particle_random_3 * 0.12"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv_static("shard", (16, 16), variants=4),
        },
    })

    # Snow dust cloud
    fx["ytaun:snow_burst"] = particle("ytaun:snow_burst", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": "8 + v.radius * 3"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_disc": {"offset": [0, 0.3, 0], "radius": "0.5 + v.radius * 0.4", "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.8 + v.particle_random_1 * 0.6"},
        "minecraft:particle_initial_speed": "2 + v.particle_random_2 * 3 + v.radius * 0.6",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.2, 0], "linear_drag_coefficient": 3.5},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.35 + v.particle_random_3 * 0.35", "0.35 + v.particle_random_3 * 0.35"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv_flip("puff", (16, 16), 4),
        },
        "minecraft:particle_appearance_tinting": fade(0.5),
    })

    # Frost breath: one puff of the stream, pushed along variable.dir_x/y/z
    fx["ytaun:frost_breath"] = particle("ytaun:frost_breath", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": 6},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {
            "direction": [
                "v.dir_x + (v.particle_random_1 - 0.5) * 0.45",
                "v.dir_y + (v.particle_random_2 - 0.5) * 0.25",
                "v.dir_z + (v.particle_random_3 - 0.5) * 0.45",
            ]
        },
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.7 + v.particle_random_4 * 0.25"},
        "minecraft:particle_initial_speed": "14 + v.particle_random_1 * 4",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.2, "linear_acceleration": [0, -1.5, 0]},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_2 * 360", "rotation_rate": 120},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.25 + v.particle_age * 1.6", "0.25 + v.particle_age * 1.6"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv_flip("mist", (16, 16), 4),
        },
        "minecraft:particle_appearance_tinting": fade(0.45),
    })

    # Claw slash crescent facing the camera
    fx["ytaun:claw_slash"] = particle("ytaun:claw_slash", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35},
        "minecraft:particle_initial_spin": {"rotation": "(v.particle_random_1 - 0.5) * 50"},
        "minecraft:particle_appearance_billboard": {
            "size": [RADIUS.format(d=1.8), RADIUS.format(d=1.8)],
            "facing_camera_mode": "lookat_xyz",
            "uv": uv_flip("claw", (32, 32), 4),
        },
    })

    # Tall pillar of frost light (phase change / enrage)
    fx["ytaun:phase_beam"] = particle("ytaun:phase_beam", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 5, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.6},
        "minecraft:particle_appearance_billboard": {
            "size": [
                "1.6 * (1 - math.pow(v.particle_age / v.particle_lifetime, 2)) + 0.1",
                "5.5",
            ],
            "facing_camera_mode": "lookat_y",
            "uv": uv_static("beam", (16, 64)),
        },
        "minecraft:particle_appearance_tinting": fade(0.4),
    })

    # Snow swirling up in a spiral around the emitter (vortex / blizzard)
    fx["ytaun:blizzard_swirl"] = particle("ytaun:blizzard_swirl", "particles_alpha", {
        "minecraft:emitter_rate_steady": {"spawn_rate": 40, "max_particles": 80},
        "minecraft:emitter_lifetime_once": {"active_time": 1.0},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.4},
        "minecraft:particle_motion_parametric": {
            "relative_position": [
                f"math.cos(v.particle_random_1 * 360 + v.particle_age * 400) * {RADIUS.format(d=4)} * (0.4 + v.particle_random_2 * 0.6)",
                "v.particle_age * (2 + v.particle_random_3 * 3)",
                f"math.sin(v.particle_random_1 * 360 + v.particle_age * 400) * {RADIUS.format(d=4)} * (0.4 + v.particle_random_2 * 0.6)",
            ]
        },
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_4 * 360", "rotation_rate": 200},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.12 + v.particle_random_3 * 0.1", "0.12 + v.particle_random_3 * 0.1"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv_static("snowflake", (16, 16), variants=4),
        },
    })

    # Small twinkle used for trails (boulder, chains, dash)
    fx["ytaun:ice_trail"] = particle("ytaun:ice_trail", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 3},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.35, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.4 + v.particle_random_1 * 0.3"},
        "minecraft:particle_initial_speed": 0.6,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -0.8, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.12 + v.particle_random_2 * 0.1", "0.12 + v.particle_random_2 * 0.1"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv_flip("glint", (16, 16), 4),
        },
    })

    # The thrown ice boulder itself (respawned every tick along its path)
    fx["ytaun:ice_boulder"] = particle("ytaun:ice_boulder", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.1},
        "minecraft:particle_initial_spin": {"rotation": "v.emitter_random_1 * 360"},
        "minecraft:particle_appearance_billboard": {
            "size": [0.75, 0.75],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv_static("boulder", (32, 32), variants=2),
        },
    })

    # Icicle falling from the sky (spawned ~12 blocks up, reaches the ground in ~0.9 s)
    fx["ytaun:icicle_fall"] = particle("ytaun:icicle_fall", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"direction": [0, -1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.88},
        "minecraft:particle_initial_speed": 2,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -27, 0]},
        "minecraft:particle_appearance_billboard": {
            "size": [0.45, 0.9],
            "facing_camera_mode": "lookat_y",
            "uv": uv_static("icicle", (16, 32)),
        },
    })

    # Ice crystal pillars erupting in a ring (Ice Prison), last variable.duration
    fx["ytaun:ice_prison"] = particle("ytaun:ice_prison", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 10},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        # billboards are centered on the particle: lift them so the pillars stand on the ground
        "minecraft:emitter_shape_disc": {"offset": [0, 1.2, 0], "radius": RADIUS.format(d=1.3), "surface_only": True, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": DURATION.format(d=2.5)},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_appearance_billboard": {
            "size": [
                "0.32 + v.particle_random_1 * 0.12",
                "(1.1 + v.particle_random_2 * 0.5) * math.min(1, v.particle_age * 7)",
            ],
            "facing_camera_mode": "lookat_y",
            "uv": uv_static("pillar", (16, 32)),
        },
    })

    # Rising frost motes around the boss (enrage / frost armor aura)
    fx["ytaun:frost_aura"] = particle("ytaun:frost_aura", "particles_add", {
        "minecraft:emitter_rate_steady": {"spawn_rate": 24, "max_particles": 40},
        "minecraft:emitter_lifetime_once": {"active_time": 1.0},
        "minecraft:emitter_shape_disc": {"radius": RADIUS.format(d=1.6), "surface_only": True, "offset": [0, 0.2, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1 + v.particle_random_1 * 0.6"},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, "2.5 + v.particle_random_2 * 2", 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.1 + v.particle_random_3 * 0.12", "0.1 + v.particle_random_3 * 0.12"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv_flip("glint", (16, 16), 4, fps=10, stretch=False, loop=True),
        },
        "minecraft:particle_appearance_tinting": fade(0.6, "9FE6FF"),
    })

    # Healing crystals rising around the boss (Ice Regeneration)
    fx["ytaun:frost_heal"] = particle("ytaun:frost_heal", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": 8},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_disc": {"radius": RADIUS.format(d=1.5), "offset": [0, 0.5, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1 + v.particle_random_1 * 0.5"},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 3, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.2, 0.2],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv_flip("heal", (16, 16), 4),
        },
        "minecraft:particle_appearance_tinting": fade(0.6, "A8FFE8"),
    })

    return fx


def write_particles(rp_root):
    atlas = build_atlas()
    tex_path = os.path.join(rp_root, TEXTURE + ".png")
    os.makedirs(os.path.dirname(tex_path), exist_ok=True)
    atlas.save(tex_path)
    out_dir = os.path.join(rp_root, "particles")
    os.makedirs(out_dir, exist_ok=True)
    fx = effects()
    for identifier, data in fx.items():
        name = identifier.split(":")[1]
        with open(os.path.join(out_dir, f"ytaun_{name}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
    return atlas, sorted(fx)


# ---------------------------------------------------------------------------
# Preview sheet (for the README)
# ---------------------------------------------------------------------------

PREVIEW = [
    ("ytaun:frost_shockwave", "Sóng xung kích", "shockwave", (32, 32), 4),
    ("ytaun:telegraph(_danger)", "Vòng cảnh báo", "telegraph", (32, 32), 1),
    ("ytaun:ground_crack", "Vết nứt băng", "crack", (32, 32), 1),
    ("ytaun:claw_slash", "Vết vuốt", "claw", (32, 32), 4),
    ("ytaun:ice_boulder", "Tảng băng ném", "boulder", (32, 32), 2),
    ("ytaun:icicle_fall", "Băng nhọn rơi", "icicle", (16, 32), 1),
    ("ytaun:ice_prison", "Cột ngục băng", "pillar", (16, 32), 1),
    ("ytaun:phase_beam", "Cột sáng băng", "beam", (16, 64), 1),
    ("ytaun:snow_burst", "Bụi tuyết", "puff", (16, 16), 4),
    ("ytaun:ice_shards", "Mảnh băng", "shard", (16, 16), 4),
    ("ytaun:ice_trail / frost_aura", "Ánh băng", "glint", (16, 16), 4),
    ("ytaun:blizzard_swirl", "Bông tuyết xoáy", "snowflake", (16, 16), 4),
    ("ytaun:frost_breath", "Hơi thở băng", "mist", (16, 16), 4),
    ("ytaun:frost_heal", "Tinh thể hồi máu", "heal", (16, 16), 4),
]


def write_preview(path, atlas=None):
    from PIL import ImageDraw, ImageFont

    atlas = atlas or build_atlas()
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
        small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except OSError:
        font = small = ImageFont.load_default()
    cols, cell_w, cell_h = 2, 520, 150
    rows = (len(PREVIEW) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (36, 44, 60, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (pid, label, name, (w, h), frames) in enumerate(PREVIEW):
        cx, cy = (i % cols) * cell_w, (i // cols) * cell_h
        draw.rectangle([cx + 4, cy + 4, cx + cell_w - 4, cy + cell_h - 4], fill=(52, 62, 84, 255), outline=(90, 110, 140, 255))
        draw.text((cx + 14, cy + 10), label, font=font, fill=(235, 245, 255, 255))
        draw.text((cx + 14, cy + 30), pid, font=small, fill=(160, 200, 235, 255))
        x0, y0 = LAYOUT[name]
        scale = max(1, min(3, 96 // h)) if h <= 32 else 2
        for f in range(frames):
            sprite = atlas.crop((x0 + f * w, y0, x0 + (f + 1) * w, y0 + h))
            if name == "telegraph":  # show both tints
                for k, tint in enumerate(((143, 216, 255), (255, 90, 74))):
                    tinted = Image.new("RGBA", sprite.size)
                    tinted.putdata([(r * tint[0] // 255, g * tint[1] // 255, b * tint[2] // 255, a) for r, g, b, a in sprite.getdata()])
                    big = tinted.resize((w * scale, h * scale), Image.NEAREST)
                    sheet.alpha_composite(big, (cx + 14 + k * (w * scale + 10), cy + 48))
                continue
            big = sprite.resize((w * scale, h * scale), Image.NEAREST)
            pos = (cx + 14 + f * (w * scale + 10), cy + 48) if h * scale <= 96 else (cx + 300, cy + 10)
            sheet.alpha_composite(big, pos)
    sheet.convert("RGB").save(path, optimize=True)
