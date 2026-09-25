"""Preview images for the README (needs Pillow: pip install pillow). Not part of the addon build.

- preview.png            the spear model rendered in 3D from its .geo.json + texture (normal, awakened, thrown)
- preview_particles.png  every particle sprite, enlarged and labeled

Run after build.py: python3 preview.py
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFont

import particles

ROOT = os.path.dirname(os.path.abspath(__file__))
RP = os.path.join(ROOT, "TojiRP")
BG_TOP, BG_BOTTOM = (38, 30, 58), (14, 12, 22)
LIGHT = {"up": 1.0, "down": 0.5, "north": 0.82, "south": 0.82, "east": 0.66, "west": 0.66}


def load_geo(name):
    with open(os.path.join(RP, "models/entity", name), encoding="utf-8") as f:
        geo = json.load(f)["minecraft:geometry"][0]
    return [c for bone in geo["bones"] for c in bone.get("cubes", [])]


def face_quads(cube):
    """The 6 faces of a cube: (face name, 4 corners, texture u/v axes along the corners)."""
    (x, y, z), (w, h, d) = cube["origin"], cube["size"]
    k = cube.get("inflate", 0)
    x0, y0, z0, x1, y1, z1 = x - k, y - k, z - k, x + w + k, y + h + k, z + d + k
    return {
        "north": [(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)],
        "south": [(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)],
        "east": [(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)],
        "west": [(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)],
        "up": [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],
        "down": [(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)],
    }


def project(p, yaw, pitch, scale, center):
    x, y, z = p
    cy, sy = math.cos(yaw), math.sin(yaw)
    x, z = x * cy - z * sy, x * sy + z * cy
    cp, sp = math.cos(pitch), math.sin(pitch)
    y, z = y * cp - z * sp, y * sp + z * cp
    return (center[0] + x * scale, center[1] - y * scale, z)


def render(image, cubes, texture, yaw, pitch, scale, center, glow=False):
    """Painter's algorithm: every face is split into texture-pixel cells, drawn back to front."""
    draw = ImageDraw.Draw(image, "RGBA")
    cells = []
    for cube in cubes:
        for face, corners in face_quads(cube).items():
            uv = cube["uv"][face]
            (u0, v0), (us, vs) = uv["uv"], uv["uv_size"]
            a, b, _, dcorner = corners
            n_u = max(1, round(abs(us)))
            n_v = max(1, round(abs(vs)))
            for i in range(n_u):
                for j in range(n_v):
                    def at(s, t):
                        return tuple(a[k] + (b[k] - a[k]) * s + (dcorner[k] - a[k]) * t for k in range(3))
                    quad = [at(i / n_u, j / n_v), at((i + 1) / n_u, j / n_v),
                            at((i + 1) / n_u, (j + 1) / n_v), at(i / n_u, (j + 1) / n_v)]
                    px = texture.getpixel((min(texture.width - 1, int(u0 + i)), min(texture.height - 1, int(v0 + j))))
                    if px[3] == 0 and not glow:
                        continue
                    pts = [project(p, yaw, pitch, scale, center) for p in quad]
                    depth = sum(p[2] for p in pts) / 4
                    if glow:
                        color = (px[0], px[1], px[2], 150)
                    else:
                        light = LIGHT[face]
                        color = tuple(min(255, round(c * light)) for c in px[:3]) + (255,)
                    cells.append((depth, [(p[0], p[1]) for p in pts], color))
    for _, pts, color in sorted(cells, key=lambda c: -c[0]):
        draw.polygon(pts, fill=color)


def background(w, h):
    image = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(image)
    for y in range(h):
        t = y / (h - 1)
        draw.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)) + (255,))
    return image


def label(image, text, x, y, size=18):
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", size)
    except OSError:
        font = ImageFont.load_default()
    w = draw.textlength(text, font=font)
    draw.text((max(4, x - w / 2), y), text, fill=(235, 230, 245, 255), font=font)


def preview_model():
    texture = Image.open(os.path.join(RP, "textures/entity/isoh.png")).convert("RGBA")
    glow_texture = Image.open(os.path.join(RP, "textures/entity/isoh_glow.tga")).convert("RGBA")
    spear, glow, thrown = load_geo("isoh.geo.json"), load_geo("isoh_glow.geo.json"), load_geo("isoh_thrown.geo.json")
    w, h = 900, 720
    image = background(w, h)
    views = [
        ("Front", spear, None, 0.0, 0.0, (150, 640)),
        ("3/4 view", spear, None, 0.7, 0.3, (380, 640)),
        ("Awakened", spear, glow, 0.7, 0.3, (610, 640)),
        ("Thrown (chain)", thrown, None, 0.7, 0.3, (800, 640)),
    ]
    for name, cubes, glow_cubes, yaw, pitch, (cx, cy) in views:
        render(image, cubes, texture, yaw, pitch, 9, (cx, cy + 20))
        if glow_cubes:
            halo = Image.new("RGBA", image.size, (0, 0, 0, 0))
            render(halo, glow_cubes, glow_texture, yaw, pitch, 9, (cx, cy + 20), glow=True)
            image.alpha_composite(halo)
        label(image, name, cx, 20)
    image.convert("RGB").save(os.path.join(ROOT, "preview.png"))


def preview_particles():
    atlas = particles.build_atlas()
    sheet = Image.new("RGBA", (particles.ATLAS, particles.ATLAS))
    for y, row in enumerate(atlas):
        for x, px in enumerate(row):
            sheet.putpixel((x, y), px)
    zoom = 4
    tiles = []
    for name, (ox, oy, frames, _) in particles.SPRITES.items():
        fw, fh = len(frames[0][0]), len(frames[0])
        crop = sheet.crop((ox, oy, ox + fw * len(frames), oy + fh))
        tiles.append((name, crop.resize((crop.width * zoom, crop.height * zoom), Image.NEAREST)))
    cols, pad = 3, 16
    cell_w = max(t.width for _, t in tiles) + pad
    cell_h = max(t.height for _, t in tiles) + pad + 26
    rows = math.ceil(len(tiles) / cols)
    image = background(cols * cell_w + pad, rows * cell_h + pad)
    for i, (name, tile) in enumerate(tiles):
        x = pad + (i % cols) * cell_w
        y = pad + (i // cols) * cell_h
        label(image, name, x + tile.width / 2, y, 16)
        image.alpha_composite(tile, (x, y + 24))
    image.convert("RGB").save(os.path.join(ROOT, "preview_particles.png"))


if __name__ == "__main__":
    preview_model()
    preview_particles()
    print("Wrote preview.png and preview_particles.png")
