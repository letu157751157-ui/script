"""The Darkin Blade 3D model + Minecraft-style pixel art texture.

The shape comes from the front-view drawing in sword_art.py: each pixel is extruded into
a cube using its material depth, then pixels of the same material are merged into the
largest possible rectangles to reduce the cube count.

The texture uses 1 texel per model unit (16 px = 1 block) like vanilla Minecraft
textures: a limited palette per material, lit top-left edges, shaded bottom-right
edges, and positional dither so surfaces are not flat.
Front and back faces are colored by their true position on the blade, so patterns
stay continuous across cubes.

Glowing materials (lava, eye) are exported to a separate geometry drawn with the
entity_emissive material and its own .tga texture: entity_emissive uses the alpha channel
as emissive strength (lower alpha = brighter, like the vanilla blaze texture).

The Darkin eyelid is its own bone (eyelid) covering the eye; an animation scales it on Y
so the eye blinks.
"""
import json
import os
import struct

from sword_art import ART, MATERIALS
from ult_parts import ULT_BONES, ult_cubes

# Point (0, 24, 0) of an attachable model sits exactly in the hand (the rightItem pivot),
# so putting the grip center there means animations only rotate the blade around the fist.
GRIP_Y = 24
GLOW_ALPHA = 24  # alpha of the glow layer: 0 = fully bright, 255 = not glowing
EYE_PIXELS = sorted(p for p, m in ART.items() if m == "eye")
EYE_TOP = max(y for _, y in EYE_PIXELS) + 1
LID_DEPTH = MATERIALS["eye"]["depth"]
LID_INFLATE = 0.2  # eyelid slightly overlaps the eye

# Palettes from dark to light
PALETTES = {
    "frame": [(26, 26, 33), (40, 41, 51), (56, 58, 71), (78, 81, 98), (110, 115, 136)],
    "horn": [(16, 15, 20), (28, 27, 35), (42, 42, 53), (64, 66, 81), (98, 102, 124)],
    "core": [(48, 5, 13), (74, 9, 21), (102, 15, 29), (132, 23, 37), (164, 36, 46)],
    "lava": [(178, 36, 12), (224, 74, 20), (255, 122, 34), (255, 176, 64), (255, 222, 128)],
    "socket": [(34, 3, 9), (54, 7, 15), (78, 13, 23), (104, 21, 31), (130, 32, 40)],
    "eye": [(170, 40, 10), (238, 96, 22), (255, 170, 54), (255, 214, 96), (255, 244, 180)],
    "guard": [(26, 26, 33), (40, 42, 52), (56, 59, 72), (78, 82, 99), (108, 113, 134)],
    "grip": [(30, 17, 13), (48, 29, 21), (68, 43, 30), (90, 59, 40), (114, 78, 54)],
    "band": [(30, 30, 38), (46, 48, 59), (66, 69, 84), (92, 96, 114), (128, 133, 154)],
    "pommel": [(26, 26, 33), (40, 42, 52), (58, 61, 75), (82, 86, 104), (116, 121, 142)],
    "spike": [(14, 14, 18), (24, 24, 31), (38, 39, 48), (58, 60, 73), (86, 90, 108)],
    "lid": [(30, 3, 8), (52, 7, 14), (78, 13, 22), (106, 22, 30), (140, 38, 44)],
    "membrane": [(38, 4, 10), (58, 8, 16), (84, 12, 22), (112, 20, 30), (142, 32, 38)],
    "wbone": [(16, 15, 20), (28, 27, 35), (42, 42, 53), (64, 66, 81), (98, 102, 124)],
    "wedge": [(178, 36, 12), (224, 74, 20), (255, 122, 34), (255, 176, 64), (255, 222, 128)],
    "uhorn": [(16, 15, 20), (28, 27, 35), (42, 42, 53), (64, 66, 81), (98, 102, 124)],
}
PUPIL = (22, 2, 5)
BASE_SHADE = {"frame": 2, "horn": 1, "core": 2, "lava": 2, "socket": 2, "eye": 3,
              "guard": 2, "grip": 2, "band": 2, "pommel": 2, "spike": 1, "lid": 2,
              "membrane": 2, "wbone": 1, "wedge": 3, "uhorn": 1}
DITHER = {"frame": 0.18, "horn": 0.14, "core": 0.22, "socket": 0.2, "guard": 0.12,
          "pommel": 0.12, "band": 0.1, "spike": 0.1, "grip": 0.0, "lava": 0.0, "eye": 0.0, "lid": 0.2,
          "membrane": 0.25, "wbone": 0.12, "wedge": 0.0, "uhorn": 0.14}


def hash01(x, y, salt=0):
    """Fixed positional noise (0..1) so the texture is identical between builds."""
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def depth_at(x, y):
    material = ART.get((x, y))
    return MATERIALS[material]["depth"] if material else 0


def front_color(x, y):
    """Front-face pixel color at (x, y), Minecraft pixel art style."""
    material = ART[(x, y)]
    palette = PALETTES[material]
    depth = depth_at(x, y)

    if material == "eye":
        # 2 px vertical pupil in the middle, red-orange iris around it, glowing yellow sclera
        if x in (-1, 0) and 11 <= y <= 14:
            return PUPIL
        if x in (-2, 1) and 11 <= y <= 14:
            return palette[1]
        if y in (10, 15):
            return palette[2]
        return palette[4] if (x, y) in ((-3, 13), (-2, 14)) else palette[3]

    shade = BASE_SHADE[material]
    # Raised top-left edges are lit, bottom-right edges are shaded
    if depth_at(x - 1, y) < depth or depth_at(x, y + 1) < depth:
        shade += 2 if material in ("horn", "frame") else 1
    if depth_at(x + 1, y) < depth or depth_at(x, y - 1) < depth:
        shade -= 1

    if material == "core":
        neighbors = [ART.get((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        if "lava" in neighbors:
            shade = 4  # lava glow reflected on the surrounding flesh
        elif "frame" in neighbors:
            shade = min(shade, 1)  # flesh darkens next to the frame
        elif hash01(x, y, 7) < 0.12:
            shade = 0  # dark sinew streaks
    elif material == "lava":
        run = sum(ART.get((x + dx, y)) == "lava" for dx in (-1, 1))
        shade = 4 if run and y < 32 else 3 if run or y < 36 else 2
    elif material == "grip":
        shade = 0 if (x + y) % 3 == 0 else (3 if x == -1 else 2)  # cross-wrapped leather strap
    elif material == "horn" and hash01(x, y, 3) < 0.1:
        shade += 1  # glossy highlight on the horns

    dither = DITHER[material]
    if dither:
        n = hash01(x, y)
        if n < dither / 2:
            shade -= 1
        elif n > 1 - dither / 2:
            shade += 1
    return palette[max(0, min(len(palette) - 1, shade))]


def lid_color(x, y):
    """Eyelid: dark lash line at the bottom, bright ridge above it, dark flesh elsewhere."""
    palette = PALETTES["lid"]
    bottom = min(yy for xx, yy in EYE_PIXELS if xx == x)
    if y == bottom:
        return palette[0]
    if y == bottom + 1:
        return palette[3]
    n = hash01(x, y, 5)
    return palette[1] if n < 0.2 else palette[2]


def wing_color(material, u, v):
    """Wings: membrane darkens toward the edge, bright highlights along the bones, fiery edge."""
    palette = PALETTES[material]
    shade = BASE_SHADE[material]
    if material == "membrane":
        shade = 3 if (u + v) % 7 == 0 else 2 if u < 12 else 1
    elif material == "wbone":
        shade = 3 if v > 0 and u < 6 else 2
    elif material == "wedge":
        shade = 3 if (u + v) % 3 else 4
    dither = DITHER[material]
    if dither:
        n = hash01(u, v, 21)
        shade += -1 if n < dither / 2 else 1 if n > 1 - dither / 2 else 0
    return palette[max(0, min(4, shade))]


def ult_horn_color(x, y):
    """Transformation horns: dark base, lighter toward the tip, with glossy streaks."""
    palette = PALETTES["uhorn"]
    shade = 1 + (1 if y >= 33 else 0) + (1 if y >= 36 else 0)
    if hash01(x, y, 31) < 0.15:
        shade += 1
    return palette[min(4, shade)]


def side_color(material, x, y, face):
    """Side faces (thickness): darker than the front, the top face is lighter."""
    palette = PALETTES[material]
    if material == "eye":
        return palette[1]
    shade = max(BASE_SHADE[material], 2) + {"up": 1, "down": -1}.get(face, 0)
    if material == "lava":
        shade = 2
    if hash01(x, y, 11) < 0.15:
        shade -= 1
    return palette[max(0, min(len(palette) - 1, shade))]


# ---------------------------------------------------------------------------
# Merge pixels into cubes
# ---------------------------------------------------------------------------


def rectangles(pixels):
    """Merge a pixel set into rectangles (scan each row, then extend upward)."""
    remaining = set(pixels)
    rects = []
    for x, y in sorted(pixels, key=lambda p: (p[1], p[0])):
        if (x, y) not in remaining:
            continue
        w = 1
        while (x + w, y) in remaining:
            w += 1
        h = 1
        while all((x + i, y + h) in remaining for i in range(w)):
            h += 1
        for i in range(w):
            for j in range(h):
                remaining.discard((x + i, y + j))
        rects.append((x, y, w, h))
    return rects


def build_cubes():
    cubes = []
    for material, info in MATERIALS.items():
        pixels = [p for p, m in ART.items() if m == material]
        for x, y, w, h in rectangles(pixels):
            d = info["depth"]
            cubes.append({"material": material, "glow": info["glow"], "bone": "sword",
                          "origin": (x, y, -d / 2), "size": (w, h, d)})
    for x, y, w, h in rectangles(EYE_PIXELS):
        cubes.append({"material": "lid", "glow": False, "bone": "eyelid", "inflate": LID_INFLATE,
                      "origin": (x, y, -LID_DEPTH / 2), "size": (w, h, LID_DEPTH)})
    return cubes + ult_cubes(wing_color, ult_horn_color)


def pack_uvs(cubes):
    """Pack box-UV regions in rows (tallest cubes first) into the smallest texture that fits."""
    order = sorted(range(len(cubes)), key=lambda i: -(cubes[i]["size"][2] + cubes[i]["size"][1]))
    for width in (64, 128, 256, 512):
        x = y = row_height = 0
        uvs = [None] * len(cubes)
        fits = True
        for i in order:
            w, h, d = cubes[i]["size"]
            region_w, region_h = 2 * (w + d), d + h
            if region_w > width:
                fits = False
                break
            if x + region_w > width:
                x, y, row_height = 0, y + row_height, 0
            uvs[i] = (x, y)
            x += region_w
            row_height = max(row_height, region_h)
        if fits and y + row_height <= width:
            return uvs, (width, width)
    raise ValueError("Model too large for a 512x512 texture")


def build_texture(cubes, uvs, size):
    width, height = size
    pixels = [[(0, 0, 0, 0)] * width for _ in range(height)]

    def put(u, v, color):
        pixels[v][u] = (*color, 255)

    for cube, (u, v) in zip(cubes, uvs):
        ox, oy, _ = cube["origin"]
        w, h, d = cube["size"]
        material = cube["material"]
        face = cube.get("face") or (lid_color if material == "lid" else front_color)
        for j in range(h):
            y = oy + h - 1 - j  # top row of the face = top of the cube
            for i in range(w):
                put(u + d + i, v + d + j, face(ox + i, y))  # north face: left -> right = increasing x
                put(u + 2 * d + w + i, v + d + j, face(ox + w - 1 - i, y))  # south face: decreasing x
            for k in range(d):
                put(u + k, v + d + j, side_color(material, ox, y, "east"))
                put(u + d + w + k, v + d + j, side_color(material, ox + w - 1, y, "west"))
        for i in range(w):
            for k in range(d):
                put(u + d + i, v + k, side_color(material, ox + i, oy + h - 1, "up"))
                put(u + d + w + i, v + k, side_color(material, ox + i, oy, "down"))
    return pixels


def build_geometry(identifier, cubes, uvs, size, glow, ult=False):
    """glow=False: regular parts + eyelid; glow=True: glowing cubes only.
    ult=True: add the transformation wings and horns (bound to the player body/head)."""
    entries = {}
    for cube, uv in zip(cubes, uvs):
        if cube["glow"] != glow:
            continue
        ox, oy, oz = cube["origin"]
        entry = {"origin": [ox, oy if cube.get("abs") else oy + GRIP_Y, oz], "size": list(cube["size"]), "uv": list(uv)}
        if cube.get("inflate"):
            entry["inflate"] = cube["inflate"]
        entries.setdefault(cube["bone"], []).append(entry)
    bones = [
        {
            "name": "darkin_blade",
            # Bind to the bone of the hand holding the item (rightitem / leftitem)
            "binding": "q.item_slot_to_bone_name(c.item_slot)",
            "pivot": [0, GRIP_Y, 0],
        },
        {"name": "sword", "parent": "darkin_blade", "pivot": [0, GRIP_Y, 0], "cubes": entries.get("sword", [])},
    ]
    if entries.get("eyelid"):
        bones.append({"name": "eyelid", "parent": "sword", "pivot": [0, EYE_TOP + GRIP_Y, 0], "cubes": entries["eyelid"]})
    if ult:
        for name, parent, binding, pivot in ULT_BONES:
            bone = {"name": name, "pivot": list(pivot)}
            if parent:
                bone["parent"] = parent
            if binding:
                bone["binding"] = binding
            if entries.get(name):
                bone["cubes"] = entries[name]
            bones.append(bone)
    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": identifier,
                    "texture_width": size[0],
                    "texture_height": size[1],
                    "visible_bounds_width": 6,
                    "visible_bounds_height": 6,
                    "visible_bounds_offset": [0, 1.5, 0],
                },
                "bones": bones,
            }
        ],
    }


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
        f.write("\n")


def write_tga(path, grid, alpha):
    """Uncompressed 32-bit TGA, bottom-left origin like vanilla textures; colored pixels get the given alpha."""
    height, width = len(grid), len(grid[0])
    header = struct.pack("<BBBHHBHHHHBB", 0, 0, 2, 0, 0, 0, 0, 0, width, height, 32, 8)
    body = bytearray()
    for row in reversed(grid):
        for r, g, b, a in row:
            body += bytes((b, g, r, alpha if a else 0))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(header + bytes(body))


def write_model(root, write_png):
    cubes = build_cubes()
    uvs, size = pack_uvs(cubes)
    texture = build_texture(cubes, uvs, size)
    write_png(os.path.join(root, "AatroxRP/textures/entity/darkin_blade.png"), texture)
    write_tga(os.path.join(root, "AatroxRP/textures/entity/darkin_blade_glow.tga"), texture, GLOW_ALPHA)
    models = os.path.join(root, "AatroxRP/models/entity")
    write_json(os.path.join(models, "darkin_blade.geo.json"),
               build_geometry("geometry.aatrox.darkin_blade", cubes, uvs, size, glow=False))
    write_json(os.path.join(models, "darkin_blade_glow.geo.json"),
               build_geometry("geometry.aatrox.darkin_blade_glow", cubes, uvs, size, glow=True))
    write_json(os.path.join(models, "darkin_blade_ult.geo.json"),
               build_geometry("geometry.aatrox.darkin_blade_ult", cubes, uvs, size, glow=False, ult=True))
    write_json(os.path.join(models, "darkin_blade_ult_glow.geo.json"),
               build_geometry("geometry.aatrox.darkin_blade_ult_glow", cubes, uvs, size, glow=True, ult=True))
    print(f"Model: {len(ART)} pixels -> {len(cubes)} cubes, texture {size[0]}x{size[1]}")
