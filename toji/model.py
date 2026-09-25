"""3D model of the Inverted Spear of Heaven (Toji Fushiguro, Jujutsu Kaisen) + its pixel art textures.

The spear is built from cubes in model pixels. Model point (0, 24, 0) is the grip center (it sits in the hand,
see the attachable/hold animations), the blade points along +Y.

Shape (after the anime/manga design):
- a short, straight double-edged blade with a raised center ridge and a sharp tip
- a hooked side prong rising from the guard next to the blade (like a jitte)
- a small rectangular dark guard
- a cloth-wrapped grip with metal bands
- a pommel with a ring that holds the long chain (a few links dangle from it)

Every face samples a 16x16 texture patch of its material; the column is the face lighting
(top = light, front/back = mid, sides/bottom = dark), like vanilla blocks.
The awakened version adds an emissive layer (entity_emissive, low alpha = glowing) along the edges.
"""
import json
import math
import os

# name: (patch palette seed, [light, mid, dark] base colors)
MATERIALS = {
    "steel": [(214, 222, 232), (170, 178, 192), (118, 124, 140)],
    "edge": [(250, 252, 255), (226, 232, 242), (180, 188, 204)],
    "ridge": [(196, 186, 220), (150, 140, 180), (100, 92, 128)],
    "dark": [(70, 66, 78), (48, 44, 54), (30, 28, 36)],
    "wrap": [(92, 60, 110), (64, 40, 80), (40, 24, 52)],
    "brass": [(226, 190, 112), (184, 144, 70), (130, 96, 44)],
    "chain": [(160, 164, 172), (116, 120, 130), (76, 78, 88)],
}
MAT_ROW = {name: i for i, name in enumerate(MATERIALS)}
TEX_W, TEX_H = 64, 128


def cube(origin, size, mat, inflate=0.0):
    return {"origin": list(origin), "size": list(size), "mat": mat, "inflate": inflate}


def spear_cubes():
    c = []
    # Grip (y 17..31), cloth wrap with 3 metal bands
    c.append(cube((-1, 17, -1), (2, 14, 2), "wrap"))
    for y in (18, 23.5, 29):
        c.append(cube((-1.25, y, -1.25), (2.5, 1, 2.5), "brass"))
    # Pommel + ring for the chain
    c.append(cube((-1.5, 14.5, -1.5), (3, 2.5, 3), "dark"))
    c.append(cube((-0.5, 13, -0.5), (1, 1.5, 1), "brass"))
    c.append(cube((-2.5, 12, -0.5), (5, 1, 1), "brass"))
    c.append(cube((-2.5, 7, -0.5), (1, 5, 1), "brass"))
    c.append(cube((1.5, 7, -0.5), (1, 5, 1), "brass"))
    c.append(cube((-2.5, 6, -0.5), (5, 1, 1), "brass"))
    # Chain links dangling from the ring (alternating orientation)
    y = 6
    for i in range(4):
        if i % 2 == 0:
            c.append(cube((-0.4, y - 3, -1), (0.8, 3, 2), "chain"))
        else:
            c.append(cube((-1, y - 3, -0.4), (2, 3, 0.8), "chain"))
        y -= 2.5
    # Guard
    c.append(cube((-3, 31, -1.5), (6, 2, 3), "dark"))
    c.append(cube((-3.5, 31.5, -1), (7, 1, 2), "dark"))
    # Hooked side prong (left side): out from the guard, up along the blade, tip curling in
    c.append(cube((-5.5, 31.5, -0.5), (2.5, 1.5, 1), "steel"))
    c.append(cube((-5.5, 33, -0.5), (1.5, 6, 1), "steel"))
    c.append(cube((-5, 39, -0.5), (1.5, 2, 1), "steel"))
    c.append(cube((-4.2, 41, -0.5), (1.2, 1.5, 1), "edge"))
    # Blade (y 33..60): tapering steel with bright edges and a violet-steel center ridge
    c.append(cube((-1.75, 33, -0.5), (3.5, 19, 1), "steel"))
    c.append(cube((-2.25, 33, -0.4), (0.5, 19, 0.8), "edge"))
    c.append(cube((1.75, 33, -0.4), (0.5, 19, 0.8), "edge"))
    c.append(cube((-1.5, 52, -0.5), (3, 3, 1), "steel"))
    c.append(cube((-2, 52, -0.4), (0.5, 3, 0.8), "edge"))
    c.append(cube((1.5, 52, -0.4), (0.5, 3, 0.8), "edge"))
    c.append(cube((-1.1, 55, -0.45), (2.2, 2.5, 0.9), "edge"))
    c.append(cube((-0.7, 57.5, -0.4), (1.4, 2, 0.8), "edge"))
    c.append(cube((-0.35, 59.5, -0.35), (0.7, 1.5, 0.7), "edge"))
    c.append(cube((-0.5, 33, -0.75), (1, 21, 1.5), "ridge"))
    return c


def glow_cubes():
    """Emissive layer for the awakened spear: blade edges, tip, ridge and prong."""
    return [
        cube((-2.25, 33, -0.4), (0.5, 19, 0.8), "glow", 0.12),
        cube((1.75, 33, -0.4), (0.5, 19, 0.8), "glow", 0.12),
        cube((-2, 52, -0.4), (0.5, 3, 0.8), "glow", 0.12),
        cube((1.5, 52, -0.4), (0.5, 3, 0.8), "glow", 0.12),
        cube((-1.1, 55, -0.45), (2.2, 2.5, 0.9), "glow", 0.12),
        cube((-0.7, 57.5, -0.4), (1.4, 2, 0.8), "glow", 0.12),
        cube((-0.35, 59.5, -0.35), (0.7, 1.5, 0.7), "glow", 0.12),
        cube((-0.5, 33, -0.75), (1, 21, 1.5), "glow", 0.08),
        cube((-5.5, 33, -0.5), (1.5, 6, 1), "glow", 0.1),
        cube((-4.2, 41, -0.5), (1.2, 1.5, 1), "glow", 0.1),
    ]


# ---------------------------------------------------------------------------
# Texture
# ---------------------------------------------------------------------------


def hash01(x, y, salt=0):
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def shade(color, k):
    return tuple(max(0, min(255, round(ch * k))) for ch in color)


def paint_patch(name, base, x, y, salt):
    """One pixel of a 16x16 patch: dithered noise like vanilla textures, plus a material pattern."""
    k = 0.92 + 0.16 * hash01(x, y, salt)
    if name in ("steel", "edge", "ridge"):
        k *= 1.08 - 0.16 * (y / 15)  # polished sheen: bright near the top of the patch
        if (x + y) % 7 == 0:
            k *= 1.08
    elif name == "wrap":
        # Diamond cloth wrap
        if (x + y) % 4 == 0 or (x - y) % 4 == 0:
            k *= 1.35
    elif name == "chain" or name == "brass":
        if x in (0, 15) or y in (0, 15):
            k *= 0.8
    return (*shade(base, k), 255)


def build_texture():
    pixels = [[(0, 0, 0, 0)] * TEX_W for _ in range(TEX_H)]
    for name, shades in MATERIALS.items():
        row = MAT_ROW[name]
        for col, base in enumerate(shades):
            for y in range(16):
                for x in range(16):
                    pixels[row * 16 + y][col * 16 + x] = paint_patch(name, base, x, y, row * 3 + col)
    return pixels


def build_glow_texture():
    """16x16 violet-white emissive patch (alpha 0 = full glow for entity_emissive)."""
    pixels = []
    for y in range(16):
        row = []
        for x in range(16):
            k = 0.85 + 0.15 * hash01(x, y, 99)
            row.append((round(236 * k), round(222 * k), 255, 20))
        pixels.append(row)
    return pixels


# ---------------------------------------------------------------------------
# Geometry export
# ---------------------------------------------------------------------------

FACE_COL = {"up": 0, "north": 1, "south": 1, "east": 2, "west": 2, "down": 2}


def face_uv(c, glow=False):
    w, h, d = c["size"]
    dims = {"north": (w, h), "south": (w, h), "east": (d, h), "west": (d, h), "up": (w, d), "down": (w, d)}
    out = {}
    for face, (fw, fh) in dims.items():
        if glow:
            u, v = 0, 0
        else:
            u, v = FACE_COL[face] * 16, MAT_ROW[c["mat"]] * 16
        size = [max(0.5, min(fw, 16)), max(0.5, min(fh, 16))]
        out[face] = {"uv": [u, v], "uv_size": size}
    return out


def geometry(identifier, bone, cubes, tex_w, tex_h, glow=False):
    cube_json = []
    for c in cubes:
        entry = {"origin": c["origin"], "size": c["size"], "uv": face_uv(c, glow)}
        if c["inflate"]:
            entry["inflate"] = c["inflate"]
        cube_json.append(entry)
    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": identifier,
                "texture_width": tex_w,
                "texture_height": tex_h,
                "visible_bounds_width": 4,
                "visible_bounds_height": 4,
                "visible_bounds_offset": [0, 1.5, 0],
            },
            "bones": [
                {"name": bone, "pivot": [0, 24, 0]},
                {"name": "spear", "parent": bone, "pivot": [0, 24, 0], "cubes": cube_json},
            ],
        }],
    }


# ---------------------------------------------------------------------------
# Icons (rendered from the model's front view, rotated 45 degrees like vanilla swords)
# ---------------------------------------------------------------------------

OUTLINE = (20, 16, 26, 255)


def front_color(px, py, cubes):
    """Color of the frontmost cube at model point (px, py) in the front view."""
    best = None
    for c in cubes:
        (x0, y0, z0), (w, h, d) = c["origin"], c["size"]
        if x0 <= px < x0 + w and y0 <= py < y0 + h:
            if best is None or z0 < best[0]:
                best = (z0, c)
    if not best:
        return None
    c = best[1]
    (x0, y0, _), (w, h, _) = c["origin"], c["size"]
    shades = MATERIALS[c["mat"]]
    u = (px - x0) / w
    # lit from the top-left like vanilla item icons
    if u < 0.34:
        return shades[0]
    if u > 0.7:
        return shades[2]
    return shades[1]


def render_icon(size, cubes, span=(3, 62), background=None):
    lo, hi = span
    length = hi - lo
    pixels = [[background[y][x] if background else (0, 0, 0, 0) for x in range(size)] for y in range(size)]
    body = [[None] * size for _ in range(size)]
    margin = size * 0.06
    scale = (size - 2 * margin) * math.sqrt(2) / length
    for y in range(size):
        for x in range(size):
            # icon: tip at the top right, pommel at the bottom left
            cx, cy = x + 0.5 - size / 2, size / 2 - (y + 0.5)
            along = (cx + cy) / math.sqrt(2) / scale + (lo + hi) / 2
            side = (cx - cy) / math.sqrt(2) / scale * -1
            color = front_color(side, along, cubes)
            if color:
                body[y][x] = (*color, 255)
    for y in range(size):
        for x in range(size):
            if body[y][x]:
                pixels[y][x] = body[y][x]
            elif any(0 <= x + dx < size and 0 <= y + dy < size and body[y + dy][x + dx]
                     for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                pixels[y][x] = OUTLINE
    return pixels


def pack_icon_background(size):
    """Dark violet radial glow with a white slash streak behind the spear."""
    out = []
    for y in range(size):
        row = []
        for x in range(size):
            d = math.hypot(x - size / 2, y - size / 2) / (size / 2)
            k = max(0.0, 1 - d)
            streak = max(0.0, 1 - abs((x - (size - 1 - y))) / (size * 0.06))
            r = 18 + 70 * k + 140 * streak * k
            g = 12 + 34 * k + 140 * streak * k
            b = 28 + 110 * k + 150 * streak * k
            n = 0.94 + 0.12 * hash01(x // 4, y // 4, 7)
            row.append((min(255, round(r * n)), min(255, round(g * n)), min(255, round(b * n)), 255))
        out.append(row)
    return out


def write_tga(path, pixels):
    h, w = len(pixels), len(pixels[0])
    header = bytes([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 32, 8 | 32])
    body = bytearray()
    for row in pixels:
        for r, g, b, a in row:
            body += bytes((b, g, r, a))
    with open(path, "wb") as f:
        f.write(header + body)


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
        f.write("\n")


def write_model(root, write_png):
    cubes = spear_cubes()
    rp = os.path.join(root, "TojiRP")
    write_png(os.path.join(rp, "textures/entity/isoh.png"), build_texture())
    write_tga(os.path.join(rp, "textures/entity/isoh_glow.tga"), build_glow_texture())
    write_json(os.path.join(rp, "models/entity/isoh.geo.json"),
               geometry("geometry.toji.isoh", "isoh", cubes, TEX_W, TEX_H))
    write_json(os.path.join(rp, "models/entity/isoh_glow.geo.json"),
               geometry("geometry.toji.isoh_glow", "isoh", glow_cubes(), 16, 16, glow=True))
    item_icon = render_icon(32, cubes)
    write_png(os.path.join(root, "art/item_icon.png"), item_icon)
    write_png(os.path.join(root, "art/pack_icon.png"), render_icon(128, cubes, background=pack_icon_background(128)))
    print(f"Model: {len(cubes)} cubes")
