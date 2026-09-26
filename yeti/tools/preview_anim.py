"""Render key poses of the Yeti skill animations to preview_animation.png (pure Python, no dependencies).

Draws the real yeti_1 geometry with the average texture color of every cube face, posed with the sampled
keyframes from animations.py, in a 3/4 front view. Used to check the animation conventions (arms raise
forward, spread outward, knees bend backward...) without starting the game, and as the README preview.
"""
import json
import math
import os
import struct
import zlib

import animations

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "boss-YETI_resource_pack")
CELL_W, CELL_H, SCALE = 185, 215, 1.55
BG = (26, 32, 46, 255)

FRAMES = [
    ("neutral", None, 0), ("roar", "roar", 0.35), ("roar", "roar", 0.62), ("leap: crouch", "leap_slam", 0.45),
    ("leap: air", "leap_slam", 1.0), ("leap: slam", "leap_slam", 1.35), ("throw: wind-up", "throw", 0.45),
    ("throw: release", "throw", 0.6), ("stomp: lift", "stomp", 0.5), ("stomp", "stomp", 0.65),
    ("slam: raise", "double_slam", 0.55), ("slam: impact", "double_slam", 0.75), ("summon", "summon", 0.5),
    ("summon: sweep", "summon", 1.4), ("regen: kneel", "channel", 1.0), ("breath: left", "breath", 0.75),
    ("breath: right", "breath", 1.5), ("charge: scrape", "charge", 0.25), ("charge: run", "charge", 0.82),
    ("charge: uppercut", "charge", 1.42), ("chain throw", "chain_throw", 0.5), ("chain pull", "chain_pull", 0.25),
    ("stagger", "stagger", 0.45), ("phase rise: low", "phase_rise", 0.2), ("phase rise: roar", "phase_rise", 1.5),
    ("armor: guard", "armor_up", 0.4), ("armor: flex", "armor_up", 0.8), ("ultimate: rise", "ultimate", 3.0),
    ("ultimate: slam", "ultimate", 3.2), ("barrage", "barrage", 0.8),
]


# ---------------------------------------------------------------- PNG in/out

def read_png(path):
    data = open(path, "rb").read()
    pos, chunks = 8, []
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        chunks.append((data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]))
        pos += 12 + length
    ihdr = next(c for k, c in chunks if k == b"IHDR")
    w, h, depth, ctype = struct.unpack(">IIBB", ihdr[:10])
    assert depth == 8 and ctype in (2, 6), (depth, ctype)
    bpp = 4 if ctype == 6 else 3
    raw = zlib.decompress(b"".join(c for k, c in chunks if k == b"IDAT"))
    stride, rows, prev = w * bpp, [], bytearray(w * bpp)
    for y in range(h):
        f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b, c = prev[i], prev[i - bpp] if i >= bpp else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append([tuple(line[x * bpp:x * bpp + 3]) + ((line[x * bpp + 3],) if bpp == 4 else (255,)) for x in range(w)])
        prev = line
    return rows


def face_color(tex, u, v, w, h):
    tw, th = len(tex[0]), len(tex)
    acc, n = [0, 0, 0], 0
    for y in range(int(v), int(v + max(1, h))):
        for x in range(int(u), int(u + max(1, w))):
            if 0 <= x < tw and 0 <= y < th and tex[y][x][3] > 0:
                for i in range(3):
                    acc[i] += tex[y][x][i]
                n += 1
    return tuple(a // n for a in acc) if n else None


# ---------------------------------------------------------------- math (Bedrock -> right-handed, X flipped)

def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def translate(x, y, z):
    return [[1, 0, 0, x], [0, 1, 0, y], [0, 0, 1, z], [0, 0, 0, 1]]


def rotate(rot):
    a, b, c = math.radians(-rot[0]), math.radians(-rot[1]), math.radians(rot[2])
    rx = [[1, 0, 0, 0], [0, math.cos(a), -math.sin(a), 0], [0, math.sin(a), math.cos(a), 0], [0, 0, 0, 1]]
    ry = [[math.cos(b), 0, math.sin(b), 0], [0, 1, 0, 0], [-math.sin(b), 0, math.cos(b), 0], [0, 0, 0, 1]]
    rz = [[math.cos(c), -math.sin(c), 0, 0], [math.sin(c), math.cos(c), 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    return mat_mul(rz, mat_mul(ry, rx))


def apply(m, p):
    return tuple(m[i][0] * p[0] + m[i][1] * p[1] + m[i][2] * p[2] + m[i][3] for i in range(3))


def flip(p):
    return (-p[0], p[1], p[2])


# ---------------------------------------------------------------- pose sampling

def sample(channel, t):
    if isinstance(channel, list):
        return channel
    keys = sorted((float(k), v) for k, v in channel.items())
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 0
            return [a + (b - a) * u for a, b in zip(v0, v1)]
    return keys[-1][1]


def pose_at(anim, t):
    pose = {}
    if not anim:
        return pose
    for bone, chans in anim["bones"].items():
        out = {}
        for ch, value in chans.items():
            v = sample(value, t)
            v = [x if isinstance(x, (int, float)) else 0 for x in v]
            out[ch] = v
        pose[bone] = out
    if anim is ANIMS.get("spin"):
        u = min(1, max(0, (t - 0.5) / 4.0))
        pose.setdefault("bone79", {})["rotation"] = [0, -((2520 * u * u * (3 - 2 * u)) % 360), 0]
    return pose


# ---------------------------------------------------------------- render

def quads(geo, tex, pose, yaw):
    bones = {b["name"]: b for b in geo["bones"]}
    world = {}

    def matrix(name):
        if name in world:
            return world[name]
        b = bones[name]
        parent = matrix(b["parent"]) if b.get("parent") in bones else translate(0, 0, 0)
        piv = flip(b.get("pivot", [0, 0, 0]))
        anim = pose.get(name, {})
        rot = [x + y for x, y in zip(b.get("rotation", [0, 0, 0]), anim.get("rotation", [0, 0, 0]))]
        off = anim.get("position", [0, 0, 0])
        m = mat_mul(parent, mat_mul(translate(-off[0], off[1], off[2]),
                                    mat_mul(translate(*piv), mat_mul(rotate(rot), translate(*[-x for x in piv])))))
        world[name] = m
        return m

    view = rotate((0, yaw, 0))
    out = []
    for b in geo["bones"]:
        m = mat_mul(view, matrix(b["name"]))
        for cube in b.get("cubes", []):
            o, s = cube["origin"], cube["size"]
            x0, x1 = -(o[0] + s[0]), -o[0]
            y0, y1, z0, z1 = o[1], o[1] + s[1], o[2], o[2] + s[2]
            cm = m
            if "rotation" in cube:
                cp = flip(cube.get("pivot", [0, 0, 0]))
                cm = mat_mul(m, mat_mul(translate(*cp), mat_mul(rotate(cube["rotation"]), translate(*[-x for x in cp]))))
            corners = {(i, j, k): apply(cm, (x1 if i else x0, y1 if j else y0, z1 if k else z0))
                       for i in (0, 1) for j in (0, 1) for k in (0, 1)}
            u, v = cube["uv"] if isinstance(cube.get("uv"), list) else (0, 0)
            w, h, d = s
            faces = {
                "north": ([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], (u + d, v + d, w, h)),
                "south": ([(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)], (u + 2 * d + w, v + d, w, h)),
                "east": ([(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)], (u, v + d, d, h)),
                "west": ([(1, 0, 0), (1, 0, 1), (1, 1, 1), (1, 1, 0)], (u + d + w, v + d, d, h)),
                "up": ([(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)], (u + d, v, w, d)),
                "down": ([(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)], (u + d + w, v, w, d)),
            }
            for name, (idx, rect) in faces.items():
                if isinstance(cube.get("uv"), dict):
                    fuv = cube["uv"].get(name)
                    if not fuv:
                        continue
                    rect = (*fuv["uv"], *fuv["uv_size"])
                    rect = (min(rect[0], rect[0] + rect[2]), min(rect[1], rect[1] + rect[3]), abs(rect[2]), abs(rect[3]))
                color = face_color(tex, *rect) or (200, 210, 220)
                pts = [corners[i] for i in idx]
                ax, ay, az = [pts[1][k] - pts[0][k] for k in range(3)]
                bx, by, bz = [pts[3][k] - pts[0][k] for k in range(3)]
                nx, ny, nz = ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx
                ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1
                light = 0.55 + 0.45 * abs((-0.4 * nx + 0.7 * ny - 0.6 * nz) / ln)
                out.append((sum(p[2] for p in pts) / 4, pts, tuple(min(255, int(c * light)) for c in color) + (255,)))
    return out


def fill(img, pts, color, ox, oy, clip):
    x_min, y_min, x_max, y_max = clip
    xy = [(ox - p[0] * SCALE, oy - p[1] * SCALE) for p in pts]
    ys = [p[1] for p in xy]
    for y in range(max(y_min, int(min(ys))), min(y_max, int(max(ys)) + 1)):
        xs = []
        for (x0, y0), (x1, y1) in zip(xy, xy[1:] + xy[:1]):
            if (y0 <= y + 0.5 < y1) or (y1 <= y + 0.5 < y0):
                xs.append(x0 + (y + 0.5 - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            for x in range(max(x_min, int(a + 0.5)), min(x_max, int(b + 0.5))):
                img[y][x] = color


FONT = {  # 3x5 pixel font for the captions
    "a": "010101111101101", "b": "110101110101110", "c": "011100100100011", "d": "110101101101110", "e": "111100110100111",
    "f": "111100110100100", "g": "011100101101011", "h": "101101111101101", "i": "111010010010111", "k": "101101110101101",
    "l": "100100100100111", "m": "101111111101101", "n": "110101101101101", "o": "010101101101010", "p": "110101110100100",
    "r": "110101110101101", "s": "011100010001110", "t": "111010010010010", "u": "101101101101111", "w": "101101111111101",
    "x": "101101010101101", "y": "101101010010010", "z": "111001010100111", "v": "101101101101010", ":": "000010000010000",
    "-": "000000111000000", " ": "000000000000000", "q": "010101101110011", "j": "001001001101010",
}


def text(img, s, x, y, color=(220, 230, 245, 255)):
    for ch in s.lower():
        glyph = FONT.get(ch, FONT[" "])
        for i, bit in enumerate(glyph):
            if bit == "1":
                for dy in range(2):
                    for dx in range(2):
                        img[y + (i // 3) * 2 + dy][x + (i % 3) * 2 + dx] = color
        x += 8


def render(write_png, out_path):
    geo = json.load(open(os.path.join(RP, "models/entity/ytaun_yeti_1.json")))["minecraft:geometry"][0]
    tex = read_png(os.path.join(RP, "textures/entity/pamobile/ytaun_yeti_1.png"))
    cols = 6
    rows_n = math.ceil(len(FRAMES) / cols)
    img = [[BG] * (CELL_W * cols) for _ in range(CELL_H * rows_n)]
    for n, (label, anim, t) in enumerate(FRAMES):
        cx, cy = (n % cols) * CELL_W, (n // cols) * CELL_H
        pose = pose_at(ANIMS.get(anim), t)
        faces = quads(geo, tex, pose, yaw=-35)
        faces.sort(key=lambda f: -f[0])
        for _, pts, color in faces:
            fill(img, pts, color, cx + CELL_W / 2, cy + CELL_H - 30, (cx, cy, cx + CELL_W, cy + CELL_H))
        text(img, label, cx + 6, cy + CELL_H - 16)
    write_png(out_path, img)


ANIMS = {}


def write_preview(write_png):
    ANIMS.update({name: fn().to_json() for name, fn in animations.BOSS_ANIMATIONS.items()})
    render(write_png, os.path.join(ROOT, "preview_animation.png"))
    print("Rendered preview_animation.png")


MINION_FRAMES = [
    ("frost_wolf", 5.0, [("", None, 0, -35), ("side", None, 0, -90), ("pounce", "pounce", 0.15, -90), ("bite", "bite", 0.12, -35)]),
    ("frost_wraith", 3.2, [("", None, 0, -35), ("side", None, 0, -90), ("cast", "cast", 0.35, -35), ("slash", "slash", 0.28, -35)]),
    ("frost_golem", 3.0, [("", None, 0, -35), ("side", None, 0, -90), ("slam", "slam", 0.5, -35), ("punch", "punch", 0.28, -35)]),
]


def write_minion_preview(write_png, minion_anims):
    """preview_minions.png: every new minion from the front and side, plus its skill poses."""
    global SCALE
    geos = {g["description"]["identifier"]: g
            for g in json.load(open(os.path.join(RP, "models/entity/yeti_minions.geo.json")))["minecraft:geometry"]}
    w, h = 200, 180
    img = [[BG] * (w * 4) for _ in range(h * len(MINION_FRAMES))]
    for r, (ident, scale, frames) in enumerate(MINION_FRAMES):
        geo = geos[f"geometry.ytaun.{ident}"]
        tex = read_png(os.path.join(RP, f"textures/entity/minions/{ident}.png"))
        SCALE = scale
        for c, (label, anim, t, yaw) in enumerate(frames):
            pose = pose_at(minion_anims.get(f"animation.ytaun.{ident}.{anim}") if anim else None, t)
            faces = quads(geo, tex, pose, yaw=yaw)
            faces.sort(key=lambda f: -f[0])
            cx, cy = c * w, r * h
            for _, pts, color in faces:
                fill(img, pts, color, cx + w / 2, cy + h - 24, (cx, cy, cx + w, cy + h))
            text(img, f"{ident.replace('_', ' ')} {label}".strip(), cx + 4, cy + h - 14)
    write_png(os.path.join(ROOT, "preview_minions.png"), img)
    print("Rendered preview_minions.png")
