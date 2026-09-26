"""Yeti boss particles (v1.4): pixel-art ice texture atlas + resource pack particle JSON files.

Every sprite is drawn in code with a small ice palette (white -> pale cyan -> cyan -> blue -> deep blue)
and hard pixel edges like vanilla particles. Dark blue outlines keep the effects readable on snow.
Multi-frame sprites are flipbooks stretched over the particle lifetime.

Scripts pass Molang variables when spawning (MolangVariableMap):
  variable.radius   - size of rings, telegraphs, cracks, auras, bursts (blocks)
  variable.duration - how long a telegraph / prison / rune circle stays (seconds)
  variable.dir_x/y/z - direction of the frost breath
Particles whose short name starts with fx_ are attached to model locators by the animations
(mouth, eyes, hands, feet, chest).
"""
import json
import math
import os

from PIL import Image

ATLAS = 512
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


def outline(img, char="N"):
    """Dark 1px outline around the opaque pixels."""
    base = img.copy()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if base.getpixel((x, y))[3] == 0:
                continue
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                qx, qy = x + ox, y + oy
                if not (0 <= qx < w and 0 <= qy < h) or base.getpixel((qx, qy))[3] == 0:
                    img.putpixel((x, y), rgba(char))
                    break
    return img


def polygon_mask(points, x, y):
    c = False
    j = len(points) - 1
    for i in range(len(points)):
        xi, yi = points[i]
        xj, yj = points[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            c = not c
        j = i
    return c


# ---------------------------------------------------------------------------
# Sprites (each returns a list of frames)
# ---------------------------------------------------------------------------


def shockwave():
    """64px flat ground ring, 6 frames: thick bright ring with a glowing inner edge, thinning out, shattering."""
    frames = []
    for f in range(6):
        img = new(64, 64)
        radius = (22, 25, 27.5, 29, 30, 30.8)[f]
        width = (9, 7.5, 6, 4.5, 3.2, 2.2)[f]
        holes = (0, 0.02, 0.08, 0.22, 0.42, 0.62)[f]
        for y in range(64):
            for x in range(64):
                dx, dy = x + 0.5 - 32, y + 0.5 - 32
                d = math.hypot(dx, dy)
                t = (d - radius) / width
                if abs(t) > 1 or hash01(x, y, f + 3) < holes:
                    continue
                angle = math.atan2(dy, dx)
                streak = 0.12 * math.sin(angle * 11 + f)
                if t > 0.8:
                    img.putpixel((x, y), rgba("D"))
                elif t < -0.85:
                    img.putpixel((x, y), rgba("B", 200))
                else:
                    edge = 1 - abs(t + 0.25) + streak + (hash01(x, y, 7) - 0.5) * 0.2
                    img.putpixel((x, y), rgba(shade(0.3 + edge * 0.75)))
        frames.append(img)
    return frames


def telegraph():
    """64px warning ring (gray-scale, tinted in JSON): dark outline, bright ring, tick marks, dashed inner ring."""
    img = new(64, 64)
    for y in range(64):
        for x in range(64):
            dx, dy = x + 0.5 - 32, y + 0.5 - 32
            d = math.hypot(dx, dy)
            angle = math.degrees(math.atan2(dy, dx)) % 360
            if 30.3 <= d < 31.8:
                img.putpixel((x, y), (40, 40, 40, 255))
            elif 27.2 <= d < 30.3:
                img.putpixel((x, y), (255, 255, 255, 255))
            elif 25.6 <= d < 27.2:
                img.putpixel((x, y), (60, 60, 60, 255))
            elif 21 <= d < 25.6 and (angle % 30) < 3.2:
                img.putpixel((x, y), (235, 235, 235, 255))
            elif 18.5 <= d < 20 and int(angle / 11.25) % 2 == 0:
                img.putpixel((x, y), (220, 220, 220, 220))
    return [img]


def fill_disc():
    """Soft disc that grows inside a telegraph to show when the hit lands."""
    img = new(32, 32)
    for y in range(32):
        for x in range(32):
            d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
            if d < 14.5:
                a = 150 if d > 13 else (95 if (x + y) % 2 else 80)
                img.putpixel((x, y), (255, 255, 255, a))
    return [img]


def crack():
    """64px glowing ice fracture: branching cracks with a bright core, flat on the ground."""
    img = new(64, 64)
    cells = set()

    def walk(x, y, angle, length, depth, salt):
        for s in range(int(length)):
            angle += (hash01(salt, s, 11) - 0.5) * 45
            x += math.cos(math.radians(angle))
            y += math.sin(math.radians(angle))
            cells.add((int(x), int(y)))
            if depth < 2 and s > 3 and hash01(salt, s, 5) < 0.12:
                walk(x, y, angle + (40 if hash01(salt, s, 6) > 0.5 else -40), length * 0.45, depth + 1, salt * 7 + s)

    for arm in range(9):
        walk(32.0, 32.0, arm * 40 + hash01(arm, 1, 9) * 25, 20 + hash01(arm, 2, 9) * 9, 0, arm + 1)
    for (x, y) in list(cells):
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + ox, y + oy)
            if 0 <= p[0] < 64 and 0 <= p[1] < 64 and p not in cells:
                d = math.hypot(p[0] - 32, p[1] - 32)
                img.putpixel(p, rgba("C" if d < 18 else "B", 210))
    for (x, y) in cells:
        if 0 <= x < 64 and 0 <= y < 64:
            d = math.hypot(x - 32, y - 32)
            img.putpixel((x, y), rgba("L" if d < 10 else ("D" if d < 22 else "N")))
    for y in range(26, 38):
        for x in range(26, 38):
            d = math.hypot(x + 0.5 - 32, y + 0.5 - 32)
            if d < 5.5 and hash01(x, y, 3) > 0.2:
                img.putpixel((x, y), rgba("W" if d < 3 else "L"))
    return [img]


def rune_circle():
    """64px magic circle: double ring, rune marks, hexagram, snowflake in the middle (additive glow)."""
    img = new(64, 64)
    pts = [(32 + math.cos(math.radians(a)) * 21, 32 + math.sin(math.radians(a)) * 21) for a in range(-90, 270, 60)]

    def seg_dist(px, py, a, b):
        ax, ay = a
        bx, by = b
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - ax - dx * t, py - ay - dy * t)

    tri1 = [pts[0], pts[2], pts[4]]
    tri2 = [pts[1], pts[3], pts[5]]
    for y in range(64):
        for x in range(64):
            px, py = x + 0.5, y + 0.5
            dx, dy = px - 32, py - 32
            d = math.hypot(dx, dy)
            angle = math.degrees(math.atan2(dy, dx)) % 360
            on = None
            if 29.5 <= d < 31:
                on = "W"
            elif 26 <= d < 27:
                on = "L"
            elif 27 <= d < 29.5 and (angle % 22.5) < 9 and int(angle / 22.5) % 2 == 0:
                on = "C"  # rune blocks between the rings
            elif 27 <= d < 29.5 and (angle % 22.5) < 3:
                on = "B"
            else:
                for tri in (tri1, tri2):
                    for i in range(3):
                        if seg_dist(px, py, tri[i], tri[(i + 1) % 3]) < 0.7:
                            on = "L"
                if d < 8:
                    for k in range(6):
                        a = math.radians(k * 60)
                        if seg_dist(px, py, (32, 32), (32 + math.cos(a) * 7.5, 32 + math.sin(a) * 7.5)) < 0.7:
                            on = "W"
                if 12.5 <= d < 13.5:
                    on = on or "B"
            if on:
                img.putpixel((x, y), rgba(on))
    return [img]



def claw_slash():
    """Three curved claw streaks: flash in, full, fading, shattered."""
    frames = []
    a, b = (27.0, 4.0), (5.0, 27.0)
    length = math.hypot(b[0] - a[0], b[1] - a[1])
    tx, ty = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    nx, ny = ty, -tx
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
                    mx, my = (v0[0] + v1[0]) / 2 - core[0], (v0[1] + v1[1]) / 2 - core[1]
                    ln = math.hypot(mx, my) or 1
                    light = 0.62 + (-mx / ln - my / ln) * 0.28 + (hash01(x, y, 70 + variant) - 0.5) * 0.12
                    img.putpixel((x, y), rgba(shade(light)))
                    break
    outline(img)
    for i in range(5):
        img.putpixel((11 + i // 2, 10 + i % 2), rgba("W"))
    return img


def flash():
    """Bright 8-ray star flash (additive): pops, peaks, fades."""
    frames = []
    for f in range(4):
        img = new(32, 32)
        size = (6, 14, 12, 7)[f]
        core = (4, 6, 4, 2)[f]
        for y in range(32):
            for x in range(32):
                dx, dy = x + 0.5 - 16, y + 0.5 - 16
                d = math.hypot(dx, dy)
                angle = math.atan2(dy, dx)
                ray = abs(math.cos(angle * 4)) ** 6
                reach = core + (size - core) * ray
                if d < reach:
                    lvl = 1 - d / (reach + 0.01)
                    img.putpixel((x, y), rgba("W" if lvl > 0.5 else ("L" if lvl > 0.25 else "C"), int(255 * min(1, 0.4 + lvl))))
        frames.append(img)
    return frames


def comet(variant):
    """Falling ice comet head: bright core inside a faceted rock with a short glow tail upward."""
    img = new(32, 32)
    for y in range(32):
        for x in range(32):
            dx, dy = x + 0.5 - 16, y + 0.5 - 19
            d = math.hypot(dx, dy)
            tail = dy < 0 and abs(dx) < 5 * (1 + dy / 19) + 0.5
            if d < 9 + hash01(x, y, 90 + variant) * 1.5:
                img.putpixel((x, y), rgba("W" if d < 3.5 else ("L" if d < 6 else "C")))
            elif tail and hash01(x, y, 91 + variant) < 0.6 + dy / 40:
                img.putpixel((x, y), rgba("C" if abs(dx) < 2 else "B", 180))
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
    """Ice crystal pillar, point up (16x32)."""
    img = new(16, 32)
    for y in range(32):
        half = (6.5 * y / 8) if y < 8 else 6.5
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


def spike_cluster(variant):
    """Ice Spike (replaces the old spike mob): a cluster of 3 jagged spikes, 32x64, point up."""
    img = new(32, 64)
    spikes = [
        [(16, 2), (22, 30), (20, 63), (11, 63), (10, 30)],
        [(6, 22), (12, 40), (12, 63), (3, 63), (2, 42)],
        [(26, 16), (30, 38), (29, 63), (20, 63), (21, 40)],
    ]
    if variant:
        spikes = [[(31 - px, py) for px, py in s] for s in spikes]
    for k, poly in enumerate(spikes):
        for y in range(64):
            for x in range(32):
                if not polygon_mask(poly, x + 0.5, y + 0.5):
                    continue
                cx = sum(p[0] for p in poly) / len(poly)
                light = 0.75 - (x + 0.5 - cx) / 14 - y / 200 + (hash01(x, y, 30 + k + variant * 3) - 0.5) * 0.15
                if abs(x + 0.5 - cx) < 0.9 and y % 7 != 0:
                    light += 0.25
                img.putpixel((x, y), rgba(shade(light)))
    outline(img)
    return img


def beam():
    """Vertical light beam (16x64), bright core, fading toward the top."""
    img = new(16, 64)
    for y in range(64):
        fade = 0.25 + 0.75 * (y / 63)
        for x in range(16):
            core = 1 - abs(x + 0.5 - 8) / 8
            level = core * fade
            if core <= 0 or level < 0.12:
                continue
            char = "W" if level > 0.6 else ("L" if level > 0.4 else ("C" if level > 0.22 else "B"))
            img.putpixel((x, y), rgba(char, int(255 * min(1, level * 1.6))))
    return img


def flame():
    """Blue frost flame (16x32), 6 frames flickering upward (additive)."""
    frames = []
    for f in range(6):
        img = new(16, 32)
        for y in range(32):
            for x in range(16):
                t = y / 31  # 0 top, 1 bottom
                sway = math.sin(t * 5 + f * 1.1) * (1 - t) * 2.2
                width = 6.5 * math.sin(min(math.pi, t * math.pi * 1.1)) ** 0.8 * (0.95 + 0.05 * math.sin(f))
                dx = abs(x + 0.5 - 8 - sway)
                if dx > width or (t < 0.25 and hash01(x, y, f + 40) < 0.4 - t):
                    continue
                heat = (1 - dx / (width + 0.01)) * (0.4 + 0.6 * t)
                img.putpixel((x, y), rgba("W" if heat > 0.62 else ("L" if heat > 0.42 else ("C" if heat > 0.22 else "B")),
                                          int(255 * min(1, 0.35 + heat))))
        frames.append(img)
    return frames


def ice_block():
    """Translucent ice block (32x32) used to encase frozen victims."""
    img = new(32, 32)
    for y in range(32):
        for x in range(32):
            edge = x < 2 or y < 2 or x > 29 or y > 29
            diag = abs((x - y) - 6) < 2 or abs((x - y) + 10) < 1.2
            if edge:
                img.putpixel((x, y), rgba("L" if (x < 2 or y < 2) else "B", 235))
            elif diag:
                img.putpixel((x, y), rgba("W", 200))
            else:
                img.putpixel((x, y), rgba("C" if hash01(x, y, 5) > 0.15 else "L", 120))
    return [img]


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
    for y in range(16):
        for x in range(16):
            if polygon_mask(poly, x + 0.5, y + 0.5):
                light = 1 - (x + y) / 30 + (hash01(x, y, variant) - 0.5) * 0.2
                img.putpixel((x, y), rgba(shade(0.3 + light * 0.7)))
    outline(img, "D")
    return img


def debris(variant):
    """Small isometric ice cube chunk (16x16)."""
    img = new(16, 16)
    s = (5, 6, 4, 5)[variant]
    cx, cy = 8, 9
    top = [(cx, cy - s), (cx + s, cy - s // 2), (cx, cy), (cx - s, cy - s // 2)]
    left = [(cx - s, cy - s // 2), (cx, cy), (cx, cy + s), (cx - s, cy + s // 2)]
    right = [(cx, cy), (cx + s, cy - s // 2), (cx + s, cy + s // 2), (cx, cy + s)]
    for y in range(16):
        for x in range(16):
            p = (x + 0.5, y + 0.5)
            for poly, char in ((top, "L"), (left, "C"), (right, "B")):
                if polygon_mask(poly, *p):
                    img.putpixel((x, y), rgba(char if hash01(x, y, variant + 50) > 0.12 else "W"))
    outline(img)
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
                img.putpixel((x, y), rgba("W" if a <= arm * 0.35 else ("L" if a <= arm * 0.7 else "C")))
        if f in (1, 2):
            for x, y in ((7, 7), (9, 7), (7, 9), (9, 9)):
                img.putpixel((x, y), rgba("L"))
        frames.append(img)
    return frames


def orb():
    """Soft glowing orb (16x16), 4 frames pulsing (additive)."""
    frames = []
    for f in range(4):
        img = new(16, 16)
        r = (5.5, 6.5, 7.2, 6.2)[f]
        for y in range(16):
            for x in range(16):
                d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
                if d < r:
                    lvl = 1 - d / r
                    img.putpixel((x, y), rgba("W" if lvl > 0.6 else ("L" if lvl > 0.35 else "C"), int(255 * min(1, lvl * 1.5))))
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
    """Frost mist: pale, transparent, swelling."""
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
                    img.putpixel((x, y), rgba("N" if d > size - 0.8 else ("W" if x < 8 and y < 8 else "C")))
        if f in (1, 2):
            for p in ((12, 3), (13, 3), (12, 2), (11, 3), (12, 4)):
                img.putpixel(p, rgba("W"))
        frames.append(img)
    return frames


def footprint():
    """Frost patch left by the boss's steps (16x16, flat)."""
    img = new(16, 16)
    for y in range(16):
        for x in range(16):
            d = math.hypot((x + 0.5 - 8) * 1.3, y + 0.5 - 8) + (hash01(x, y, 77) - 0.5) * 2
            if d < 6.5:
                img.putpixel((x, y), rgba("L" if d < 3 else ("C" if d < 5 else "B"), 200 if d < 5 else 150))
    return [img]


# ---------------------------------------------------------------------------
# Atlas layout: (x, y) of the first frame; frames go left to right
# ---------------------------------------------------------------------------

SPRITES = {
    # name: (builder, frame width, frame height)
    "shockwave": (shockwave, 64, 64),
    "telegraph": (telegraph, 64, 64),
    "rune": (rune_circle, 64, 64),
    "crack": (crack, 64, 64),
    "claw": (claw_slash, 32, 32),
    "boulder": (lambda: [boulder(0), boulder(1)], 32, 32),
    "flash": (flash, 32, 32),
    "comet": (lambda: [comet(0), comet(1)], 32, 32),
    "block": (ice_block, 32, 32),
    "fill": (fill_disc, 32, 32),
    "spike": (lambda: [spike_cluster(0), spike_cluster(1)], 32, 64),
    "beam": (lambda: [beam()], 16, 64),
    "flame": (flame, 16, 32),
    "icicle": (lambda: [icicle()], 16, 32),
    "pillar": (lambda: [pillar()], 16, 32),
    "puff": (puff, 16, 16),
    "shard": (lambda: [shard(i) for i in range(4)], 16, 16),
    "debris": (lambda: [debris(i) for i in range(4)], 16, 16),
    "glint": (glint, 16, 16),
    "orb": (orb, 16, 16),
    "snowflake": (lambda: [snowflake(i) for i in range(4)], 16, 16),
    "mist": (mist, 16, 16),
    "heal": (heal, 16, 16),
    "footprint": (footprint, 16, 16),
}

LAYOUT = {
    "shockwave": (0, 0),      # 6 x 64
    "telegraph": (384, 0),
    "rune": (448, 0),
    "crack": (0, 64),
    "claw": (128, 64),        # 4 x 32
    "boulder": (256, 64),     # 2 x 32
    "flash": (320, 64),       # 4 x 32
    "comet": (128, 96),       # 2 x 32
    "block": (192, 96),
    "fill": (224, 96),
    "spike": (256, 96),       # 2 x 32x64
    "beam": (320, 96),        # 16x64
    "flame": (336, 96),       # 6 x 16x32
    "icicle": (432, 96),
    "pillar": (448, 96),
    "puff": (0, 128),         # 4 x 16
    "shard": (64, 128),
    "debris": (128, 128),
    "glint": (192, 128),
    "orb": (0, 144),
    "snowflake": (64, 144),
    "mist": (128, 144),
    "heal": (192, 144),
    "footprint": (464, 96),
}


def minecraftify(img):
    """Vanilla Minecraft particle look: chunky pixels (8-16 px sprites), hard alpha, small palette."""
    w, h = img.size
    f = 4 if max(w, h) >= 32 else 2
    small = img.resize((max(1, w // f), max(1, h // f)), Image.BOX)
    px = small.load()
    for y in range(small.height):
        for x in range(small.width):
            r, g, b, a = px[x, y]
            if a < 90:
                px[x, y] = (0, 0, 0, 0)
            elif abs(r - g) < 8 and abs(g - b) < 8:
                px[x, y] = (r, g, b, 255)  # gray sprites are tinted in JSON (telegraphs)
            else:
                lum = (r + g + b) / 765
                px[x, y] = rgba(shade(lum * 0.9 + 0.08))
    return small.resize((w, h), Image.NEAREST)


def build_atlas():
    atlas = new(ATLAS, ATLAS)
    used = []
    for name, (builder, w, h) in SPRITES.items():
        frames = builder()
        x0, y0 = LAYOUT[name]
        box = (x0, y0, x0 + w * len(frames), y0 + h)
        for other, obox in used:
            assert box[2] <= obox[0] or box[0] >= obox[2] or box[3] <= obox[1] or box[1] >= obox[3], (name, other)
        assert box[2] <= ATLAS and box[3] <= ATLAS, name
        used.append((name, box))
        for i, frame in enumerate(frames):
            assert frame.size == (w, h), name
            frame = minecraftify(frame)
            atlas.paste(frame, (x0 + i * w, y0), frame)
    return atlas


# ---------------------------------------------------------------------------
# Particle JSON
# ---------------------------------------------------------------------------


def uv_flip(name, frames, fps=12, stretch=True, loop=False):
    x, y = LAYOUT[name]
    _, w, h = SPRITES[name]
    return {"texture_width": ATLAS, "texture_height": ATLAS, "flipbook": {
        "base_UV": [x, y], "size_UV": [w, h], "step_UV": [w, 0], "max_frame": frames,
        "stretch_to_lifetime": stretch, "loop": loop, "frames_per_second": fps}}


def uv_static(name, variants=1):
    x, y = LAYOUT[name]
    _, w, h = SPRITES[name]
    u = x if variants == 1 else f"{x} + math.floor(v.particle_random_2 * {variants}) * {w}"
    return {"texture_width": ATLAS, "texture_height": ATLAS, "uv": [u, y], "uv_size": [w, h]}


def fade(start=0.6, color="FFFFFF"):
    return {"color": {"interpolant": "v.particle_age / v.particle_lifetime",
                      "gradient": {"0.0": f"#FF{color}", f"{start}": f"#FF{color}", "1.0": f"#00{color}"}}}


def fade_in_out(color="FFFFFF", peak=1.0):
    a = format(int(255 * peak), "02X")
    return {"color": {"interpolant": "v.particle_age / v.particle_lifetime",
                      "gradient": {"0.0": f"#00{color}", "0.1": f"#{a}{color}", "0.8": f"#{a}{color}", "1.0": f"#00{color}"}}}


def particle(identifier, material, components):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": identifier, "basic_render_parameters": {"material": material, "texture": TEXTURE}},
        "components": components}}


def once(n=1, time=0.05):
    return {"minecraft:emitter_rate_instant": {"num_particles": n}, "minecraft:emitter_lifetime_once": {"active_time": time}}


def steady(rate, max_particles, time):
    return {"minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": max_particles},
            "minecraft:emitter_lifetime_once": {"active_time": time}}


LOCAL = {"minecraft:emitter_local_space": {"position": True, "rotation": False}}
RADIUS = "(v.radius > 0 ? v.radius : {d})"
DURATION = "(v.duration > 0 ? v.duration : {d})"


def flat(size, uv, spin=None):
    comp = {"minecraft:particle_appearance_billboard": {"size": size, "facing_camera_mode": "emitter_transform_xz", "uv": uv}}
    if spin:
        comp["minecraft:particle_initial_spin"] = spin
    return comp


def board(size, uv, mode="rotate_xyz"):
    return {"minecraft:particle_appearance_billboard": {"size": size, "facing_camera_mode": mode, "uv": uv}}


def merge(*parts):
    out = {}
    for p in parts:
        out.update(p)
    return out


def effects():
    fx = {}
    R = RADIUS.format

    # ---------------- ground layers ----------------
    grow = f"0.4 + ({R(d=4)} - 0.4) * math.sqrt(v.particle_age / v.particle_lifetime)"
    fx["ytaun:frost_shockwave"] = merge(once(), {"minecraft:emitter_shape_point": {"offset": [0, 0.12, 0]},
                                                 "minecraft:particle_lifetime_expression": {"max_lifetime": 0.65}},
                                        flat([grow, grow], uv_flip("shockwave", 6)),
                                        {"minecraft:particle_appearance_tinting": fade(0.55)}), "particles_alpha"

    for name, color in (("ytaun:telegraph", "8FD8FF"), ("ytaun:telegraph_danger", "FF4A3A")):
        rgb = [round(int(color[i:i + 2], 16) / 255, 3) for i in (0, 2, 4)]
        fx[name] = merge(once(), {"minecraft:emitter_shape_point": {"offset": [0, 0.08, 0]},
                                  "minecraft:particle_lifetime_expression": {"max_lifetime": DURATION.format(d=1)}},
                         flat([f"{R(d=3)} * math.min(1, 0.3 + v.particle_age * 6)"] * 2, uv_static("telegraph"),
                              {"rotation": 0, "rotation_rate": 25}),
                         {"minecraft:particle_appearance_tinting": {"color": rgb + ["0.6 + 0.35 * math.sin(v.particle_age * 900)"]}}), "particles_alpha"
        # the fill grows from the centre and reaches the ring exactly when the hit lands
        fill = name + "_fill"
        fx[fill] = merge(once(), {"minecraft:emitter_shape_point": {"offset": [0, 0.07, 0]},
                                  "minecraft:particle_lifetime_expression": {"max_lifetime": DURATION.format(d=1)}},
                         flat([f"{R(d=3)} * 0.93 * v.particle_age / v.particle_lifetime"] * 2, uv_static("fill")),
                         {"minecraft:particle_appearance_tinting": {"color": rgb + [0.75]}}), "particles_alpha"

    fx["ytaun:ground_crack"] = merge(once(), {"minecraft:emitter_shape_point": {"offset": [0, 0.06, 0]},
                                              "minecraft:particle_lifetime_expression": {"max_lifetime": 3.5}},
                                     flat([R(d=2.5), R(d=2.5)], uv_static("crack"), {"rotation": "v.particle_random_1 * 360"}),
                                     {"minecraft:particle_appearance_tinting": fade(0.7)}), "particles_alpha"

    fx["ytaun:rune_circle"] = merge(once(), {"minecraft:emitter_shape_point": {"offset": [0, 0.1, 0]},
                                             "minecraft:particle_lifetime_expression": {"max_lifetime": DURATION.format(d=2)}},
                                    flat([f"{R(d=5)} * math.min(1, v.particle_age * 3)"] * 2, uv_static("rune"),
                                         {"rotation": 0, "rotation_rate": 45}),
                                    {"minecraft:particle_appearance_tinting": fade_in_out("A8E8FF")}), "particles_alpha"

    fx["ytaun:footprint"] = merge(once(), {"minecraft:emitter_shape_point": {"offset": [0, 0.05, 0]},
                                           "minecraft:particle_lifetime_expression": {"max_lifetime": 4}},
                                  flat([0.45, 0.45], uv_static("footprint"), {"rotation": "v.particle_random_1 * 360"}),
                                  {"minecraft:particle_appearance_tinting": fade(0.6)}), "particles_alpha"

    # ---------------- bursts ----------------
    fx["ytaun:ice_shards"] = merge(once("10 + v.radius * 3"), {
        "minecraft:emitter_shape_sphere": {"offset": [0, 0.4, 0], "radius": "0.3 + v.radius * 0.15", "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.9 + v.particle_random_1 * 0.6"},
        "minecraft:particle_initial_speed": "5 + v.particle_random_3 * 5",
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_1 * 360", "rotation_rate": "(v.particle_random_4 - 0.5) * 900"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -22, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_motion_collision": {"collision_drag": 6, "coefficient_of_restitution": 0.3, "collision_radius": 0.1}},
        board(["0.12 + v.particle_random_3 * 0.12"] * 2, uv_static("shard", 4))), "particles_alpha"

    fx["ytaun:ice_debris"] = merge(once("6 + v.radius * 2"), {
        "minecraft:emitter_shape_disc": {"offset": [0, 0.5, 0], "radius": "0.3 + v.radius * 0.3", "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1.6 + v.particle_random_1 * 1.0"},
        "minecraft:particle_initial_speed": "3 + v.particle_random_3 * 4 + v.radius",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -20, 0], "linear_drag_coefficient": 0.6},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_1 * 360", "rotation_rate": "(v.particle_random_4 - 0.5) * 600"},
        "minecraft:particle_motion_collision": {"collision_drag": 8, "coefficient_of_restitution": 0.35, "collision_radius": 0.15},
        "minecraft:particle_appearance_tinting": fade(0.75)},
        board(["0.18 + v.particle_random_3 * 0.16"] * 2, uv_static("debris", 4))), "particles_alpha"

    fx["ytaun:snow_burst"] = merge(once("8 + v.radius * 3"), {
        "minecraft:emitter_shape_disc": {"offset": [0, 0.3, 0], "radius": "0.5 + v.radius * 0.4", "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.8 + v.particle_random_1 * 0.6"},
        "minecraft:particle_initial_speed": "2 + v.particle_random_2 * 3 + v.radius * 0.6",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.2, 0], "linear_drag_coefficient": 3.5},
        "minecraft:particle_appearance_tinting": fade(0.5)},
        board(["0.35 + v.particle_random_3 * 0.35"] * 2, uv_flip("puff", 4))), "particles_alpha"

    fx["ytaun:ground_mist"] = merge(once("14 + v.radius * 4"), {
        "minecraft:emitter_shape_disc": {"offset": [0, 0.4, 0], "radius": "0.4 + v.radius * 0.25", "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1.4 + v.particle_random_1 * 0.8"},
        "minecraft:particle_initial_speed": "v.radius * (1.1 + v.particle_random_2 * 0.6)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.4, 0], "linear_drag_coefficient": 1.6},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_4 * 360", "rotation_rate": 30},
        "minecraft:particle_appearance_tinting": fade_in_out("E6F6FF", 0.8)},
        board(["0.7 + v.particle_age * 0.9", "0.7 + v.particle_age * 0.9"], uv_flip("mist", 4))), "particles_alpha"

    fx["ytaun:ice_flash"] = merge(once(), {"minecraft:emitter_shape_point": {"offset": [0, 1, 0]},
                                           "minecraft:particle_lifetime_expression": {"max_lifetime": 0.3},
                                           "minecraft:particle_initial_spin": {"rotation": "v.particle_random_1 * 90"}},
                                  board([R(d=2), R(d=2)], uv_flip("flash", 4), "lookat_xyz")), "particles_alpha"

    fx["ytaun:ice_spike"] = merge(once(), {"minecraft:emitter_shape_point": {},
                                           "minecraft:particle_lifetime_expression": {"max_lifetime": DURATION.format(d=1.6)},
                                           # grows out of the ground in 0.12 s, stays, then sinks back
                                           "minecraft:particle_motion_parametric": {"relative_position": [0, (
                                               f"{R(d=1)} * 1.25 * (math.min(1, v.particle_age * 8) - math.max(0, (v.particle_age - v.particle_lifetime + 0.3) / 0.3)) - {R(d=1)} * 0.05"), 0]}},
                                  board([f"{R(d=1)} * 0.62", f"{R(d=1)} * 1.25 * (math.min(1, v.particle_age * 8) * 0.9 + 0.1)"],
                                        uv_static("spike", 2), "lookat_y")), "particles_alpha"

    fx["ytaun:claw_slash"] = merge(once(), {"minecraft:emitter_shape_point": {},
                                            "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35},
                                            "minecraft:particle_initial_spin": {"rotation": "(v.particle_random_1 - 0.5) * 50"}},
                                   board([R(d=1.8), R(d=1.8)], uv_flip("claw", 4), "lookat_xyz")), "particles_alpha"

    fx["ytaun:phase_beam"] = merge(once(), {"minecraft:emitter_shape_point": {"offset": [0, 5, 0]},
                                            "minecraft:particle_lifetime_expression": {"max_lifetime": 1.6},
                                            "minecraft:particle_appearance_tinting": fade(0.4)},
                                   board(["1.6 * (1 - math.pow(v.particle_age / v.particle_lifetime, 2)) + 0.1", "5.5"],
                                         uv_static("beam"), "lookat_y")), "particles_alpha"

    # ---------------- area / auras ----------------
    swirl_pos = [f"math.cos(v.particle_random_1 * 360 + v.particle_age * 400) * {R(d=4)} * (0.4 + v.particle_random_2 * 0.6)",
                 "v.particle_age * (2 + v.particle_random_3 * 3)",
                 f"math.sin(v.particle_random_1 * 360 + v.particle_age * 400) * {R(d=4)} * (0.4 + v.particle_random_2 * 0.6)"]
    fx["ytaun:blizzard_swirl"] = merge(steady(40, 80, 1.0), {"minecraft:emitter_shape_point": {},
                                                               "minecraft:particle_lifetime_expression": {"max_lifetime": 1.4},
                                                               "minecraft:particle_motion_parametric": {"relative_position": swirl_pos},
                                                               "minecraft:particle_initial_spin": {"rotation": "v.particle_random_4 * 360", "rotation_rate": 200}},
                                       board(["0.12 + v.particle_random_3 * 0.1"] * 2, uv_static("snowflake", 4))), "particles_alpha"

    tornado = [f"math.cos(v.particle_random_1 * 360 + v.particle_age * 520) * {R(d=2)} * (0.3 + v.particle_age * 0.55)",
               "v.particle_age * (6 + v.particle_random_3 * 3)",
               f"math.sin(v.particle_random_1 * 360 + v.particle_age * 520) * {R(d=2)} * (0.3 + v.particle_age * 0.55)"]
    fx["ytaun:snow_tornado"] = merge(steady(70, 140, 1.0), {"minecraft:emitter_shape_point": {},
                                                             "minecraft:particle_lifetime_expression": {"max_lifetime": 1.6},
                                                             "minecraft:particle_motion_parametric": {"relative_position": tornado},
                                                             "minecraft:particle_initial_spin": {"rotation": "v.particle_random_4 * 360", "rotation_rate": 160},
                                                             "minecraft:particle_appearance_tinting": fade_in_out("F0FAFF", 0.9)},
                                     board(["0.25 + v.particle_age * 0.35"] * 2, uv_flip("puff", 4))), "particles_alpha"

    fx["ytaun:snowfall"] = merge(steady(50, 160, 1.0), {
        "minecraft:emitter_shape_disc": {"offset": [0, 7, 0], "radius": R(d=10)},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 2.5},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [2.5, -4, 1.2], "linear_drag_coefficient": 0.8},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_4 * 360", "rotation_rate": 90}},
        board(["0.07 + v.particle_random_3 * 0.07"] * 2, uv_static("snowflake", 4))), "particles_alpha"

    fx["ytaun:frost_aura"] = merge(steady(24, 40, 1.0), {
        "minecraft:emitter_shape_disc": {"radius": R(d=1.6), "surface_only": True, "offset": [0, 0.2, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1 + v.particle_random_1 * 0.6"},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, "2.5 + v.particle_random_2 * 2", 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_appearance_tinting": fade(0.6, "9FE6FF")},
        board(["0.1 + v.particle_random_3 * 0.12"] * 2, uv_flip("glint", 4, fps=10, stretch=False, loop=True))), "particles_alpha"

    fx["ytaun:frost_flame"] = merge(steady(28, 50, 1.0), {
        "minecraft:emitter_shape_box": {"offset": [0, 2.2, 0], "half_dimensions": [R(d=1.1), 2.2, R(d=1.1)], "surface_only": False},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.6 + v.particle_random_1 * 0.4"},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 3, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_tinting": fade(0.5, "B8ECFF")},
        board(["0.22 + v.particle_random_3 * 0.12", "0.44 + v.particle_random_3 * 0.24"], uv_flip("flame", 6), "lookat_y")), "particles_alpha"

    fx["ytaun:frost_heal"] = merge(once(8), {
        "minecraft:emitter_shape_disc": {"radius": R(d=1.5), "offset": [0, 0.5, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1 + v.particle_random_1 * 0.5"},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 3, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_tinting": fade(0.6, "A8FFE8")},
        board([0.2, 0.2], uv_flip("heal", 4))), "particles_alpha"

    fx["ytaun:frozen_block"] = merge(once(), {"minecraft:emitter_shape_point": {"offset": [0, 1, 0]},
                                              "minecraft:particle_lifetime_expression": {"max_lifetime": DURATION.format(d=2)},
                                              "minecraft:particle_appearance_tinting": fade(0.85)},
                                     board([0.75, 1.05], uv_static("block"), "lookat_xyz")), "particles_alpha"

    fx["ytaun:ice_prison"] = merge(once(10), {
        "minecraft:emitter_shape_disc": {"offset": [0, 1.2, 0], "radius": R(d=1.3), "surface_only": True, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": DURATION.format(d=2.5)},
        "minecraft:particle_initial_speed": 0},
        board(["0.32 + v.particle_random_1 * 0.12", "(1.1 + v.particle_random_2 * 0.5) * math.min(1, v.particle_age * 7)"],
              uv_static("pillar"), "lookat_y")), "particles_alpha"

    # ---------------- projectiles / trails ----------------
    fx["ytaun:ice_trail"] = merge(once(3), {
        "minecraft:emitter_shape_sphere": {"radius": 0.35, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.4 + v.particle_random_1 * 0.3"},
        "minecraft:particle_initial_speed": 0.6,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -0.8, 0], "linear_drag_coefficient": 1.5}},
        board(["0.12 + v.particle_random_2 * 0.1"] * 2, uv_flip("glint", 4))), "particles_alpha"

    fx["ytaun:beam_spark"] = merge(once(), {"minecraft:emitter_shape_point": {},
                                            "minecraft:particle_lifetime_expression": {"max_lifetime": 0.22}},
                                   board([0.2, 0.2], uv_flip("orb", 4))), "particles_alpha"

    fx["ytaun:ice_boulder"] = merge(once(), {"minecraft:emitter_shape_point": {},
                                             "minecraft:particle_lifetime_expression": {"max_lifetime": 0.1},
                                             "minecraft:particle_initial_spin": {"rotation": "v.emitter_random_1 * 360"}},
                                    board([0.75, 0.75], uv_static("boulder", 2))), "particles_alpha"

    fx["ytaun:comet"] = merge(once(), {"minecraft:emitter_shape_point": {},
                                       "minecraft:particle_lifetime_expression": {"max_lifetime": 0.1}},
                              board([1.1, 1.1], uv_static("comet", 2), "lookat_xyz")), "particles_alpha"

    fx["ytaun:icicle_fall"] = merge(once(), {"minecraft:emitter_shape_point": {"direction": [0, -1, 0]},
                                             "minecraft:particle_lifetime_expression": {"max_lifetime": 0.88},
                                             "minecraft:particle_initial_speed": 2,
                                             "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -27, 0]}},
                                    board([0.45, 0.9], uv_static("icicle"), "lookat_y")), "particles_alpha"

    fx["ytaun:frost_breath"] = merge(once(6), {
        "minecraft:emitter_shape_point": {"direction": ["v.dir_x + (v.particle_random_1 - 0.5) * 0.45",
                                                        "v.dir_y + (v.particle_random_2 - 0.5) * 0.25",
                                                        "v.dir_z + (v.particle_random_3 - 0.5) * 0.45"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.7 + v.particle_random_4 * 0.25"},
        "minecraft:particle_initial_speed": "14 + v.particle_random_1 * 4",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.2, "linear_acceleration": [0, -1.5, 0]},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_2 * 360", "rotation_rate": 120},
        "minecraft:particle_appearance_tinting": fade(0.45)},
        board(["0.25 + v.particle_age * 1.6"] * 2, uv_flip("mist", 4))), "particles_alpha"

    # ---------------- attached to model locators (animations) ----------------
    fx["ytaun:eye_glow"] = merge(LOCAL, once(), {"minecraft:emitter_shape_point": {},
                                                 "minecraft:particle_lifetime_expression": {"max_lifetime": 3.2},
                                                 "minecraft:particle_appearance_tinting": {"color": [0.65, 0.95, 1, 1]}},
                                 board(["0.09 + math.sin(v.particle_age * 360) * 0.015"] * 2,
                                       uv_flip("orb", 4, fps=6, stretch=False, loop=True), "lookat_xyz")), "particles_alpha"
    fx["ytaun:eye_glow_red"] = merge(LOCAL, once(), {"minecraft:emitter_shape_point": {},
                                                     "minecraft:particle_lifetime_expression": {"max_lifetime": 3.2},
                                                     "minecraft:particle_appearance_tinting": {"color": [1, 0.35, 0.3, 1]}},
                                     board(["0.1 + math.sin(v.particle_age * 360) * 0.015"] * 2,
                                           uv_flip("orb", 4, fps=6, stretch=False, loop=True), "lookat_xyz")), "particles_alpha"

    fx["ytaun:breath_puff"] = merge(once(5), {
        "minecraft:emitter_shape_sphere": {"radius": 0.15, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1 + v.particle_random_1 * 0.5"},
        "minecraft:particle_initial_speed": 0.5,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.5, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_tinting": fade_in_out("F2FBFF", 0.7)},
        board(["0.15 + v.particle_age * 0.3"] * 2, uv_flip("mist", 4))), "particles_alpha"

    fx["ytaun:roar_mist"] = merge(once(16), {
        "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.7 + v.particle_random_1 * 0.4"},
        "minecraft:particle_initial_speed": "3 + v.particle_random_2 * 3",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2.5},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_3 * 360", "rotation_rate": 90},
        "minecraft:particle_appearance_tinting": fade(0.4)},
        board(["0.2 + v.particle_age * 0.8"] * 2, uv_flip("mist", 4))), "particles_alpha"

    fx["ytaun:hand_glow"] = merge(LOCAL, steady(26, 30, 0.8), {
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "surface_only": True, "direction": "inwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
        "minecraft:particle_initial_speed": 1.3,
        "minecraft:particle_appearance_tinting": fade(0.5, "B0F0FF")},
        board(["0.08 + v.particle_random_1 * 0.07"] * 2, uv_flip("glint", 4))), "particles_alpha"

    fx["ytaun:chest_glow"] = merge(LOCAL, steady(10, 12, 1.2), {
        "minecraft:emitter_shape_sphere": {"radius": 0.3},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.8},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_appearance_tinting": fade_in_out("9FE6FF", 0.9)},
        board(["0.3 + v.particle_random_1 * 0.25"] * 2, uv_flip("orb", 4), "lookat_xyz")), "particles_alpha"

    fx["ytaun:breath_core"] = merge(LOCAL, steady(24, 20, 0.6), {
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35},
        "minecraft:particle_initial_speed": 0.9,
        "minecraft:particle_appearance_tinting": fade(0.3, "E6FAFF")},
        board(["0.18 + v.particle_random_1 * 0.12"] * 2, uv_flip("orb", 4), "lookat_xyz")), "particles_alpha"

    fx["ytaun:claw_trail"] = merge(steady(70, 40, 0.3), {
        "minecraft:emitter_shape_sphere": {"radius": 0.25},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_appearance_tinting": fade(0.2, "D8F6FF")},
        board(["0.14 + v.particle_random_1 * 0.08"] * 2, uv_flip("glint", 4))), "particles_alpha"

    fx["ytaun:snow_step"] = merge(once(8), {
        "minecraft:emitter_shape_disc": {"radius": 0.3, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.6 + v.particle_random_1 * 0.4"},
        "minecraft:particle_initial_speed": "2 + v.particle_random_2 * 2",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1, 0], "linear_drag_coefficient": 3},
        "minecraft:particle_appearance_tinting": fade(0.5)},
        board(["0.25 + v.particle_random_3 * 0.2"] * 2, uv_flip("puff", 4))), "particles_alpha"

    fx["ytaun:boulder_held"] = merge(LOCAL, once(), {"minecraft:emitter_shape_point": {"offset": [0, -0.2, 0]},
                                                     "minecraft:particle_lifetime_expression": {"max_lifetime": 0.36},
                                                     "minecraft:particle_initial_spin": {"rotation": 20}},
                                     board([0.6, 0.6], uv_static("boulder"))), "particles_alpha"

    return {k: particle(k, material, comps) for k, (comps, material) in fx.items()}


def write_particles(rp_root):
    atlas = build_atlas()
    tex_path = os.path.join(rp_root, TEXTURE + ".png")
    os.makedirs(os.path.dirname(tex_path), exist_ok=True)
    atlas.save(tex_path)
    out_dir = os.path.join(rp_root, "particles")
    os.makedirs(out_dir, exist_ok=True)
    for old in os.listdir(out_dir):
        if old.startswith("ytaun_") and old.endswith(".json"):
            os.remove(os.path.join(out_dir, old))
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
    ("ytaun:frost_shockwave", "Sóng xung kích", "shockwave", 6),
    ("ytaun:telegraph(+_fill, _danger)", "Vòng cảnh báo", "telegraph", 1),
    ("ytaun:rune_circle", "Vòng rune", "rune", 1),
    ("ytaun:ground_crack", "Vết nứt băng", "crack", 1),
    ("ytaun:ice_spike", "Gai băng (thay mob)", "spike", 2),
    ("ytaun:claw_slash", "Vết vuốt", "claw", 4),
    ("ytaun:ice_flash", "Chớp sáng", "flash", 4),
    ("ytaun:ice_boulder / boulder_held", "Tảng băng ném", "boulder", 2),
    ("ytaun:comet", "Thiên thạch băng", "comet", 2),
    ("ytaun:frost_flame", "Lửa băng", "flame", 6),
    ("ytaun:frozen_block", "Khối băng đóng", "block", 1),
    ("ytaun:icicle_fall / ice_prison", "Băng nhọn, cột ngục", "icicle", 1),
    ("ytaun:phase_beam", "Cột sáng", "beam", 1),
    ("ytaun:ice_debris", "Khối vụn", "debris", 4),
    ("ytaun:ice_shards", "Mảnh băng", "shard", 4),
    ("ytaun:snow_burst / tornado / step", "Bụi tuyết", "puff", 4),
    ("ytaun:frost_breath / mist / roar", "Hơi băng", "mist", 4),
    ("ytaun:hand/eye/chest glow", "Quầng sáng", "orb", 4),
    ("ytaun:ice_trail / aura / claw_trail", "Ánh băng", "glint", 4),
    ("ytaun:blizzard_swirl / snowfall", "Bông tuyết", "snowflake", 4),
    ("ytaun:frost_heal", "Tinh thể hồi máu", "heal", 4),
]


def write_preview(path, atlas=None):
    from PIL import ImageDraw, ImageFont

    atlas = atlas or build_atlas()
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
        small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except OSError:
        font = small = ImageFont.load_default()
    cols, cell_w, cell_h = 2, 560, 160
    rows = (len(PREVIEW) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (36, 44, 60, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (pid, label, name, frames) in enumerate(PREVIEW):
        cx, cy = (i % cols) * cell_w, (i // cols) * cell_h
        draw.rectangle([cx + 4, cy + 4, cx + cell_w - 4, cy + cell_h - 4], fill=(52, 62, 84, 255), outline=(90, 110, 140, 255))
        draw.text((cx + 14, cy + 10), label, font=font, fill=(235, 245, 255, 255))
        draw.text((cx + 14, cy + 30), pid, font=small, fill=(160, 200, 235, 255))
        _, w, h = SPRITES[name]
        x0, y0 = LAYOUT[name]
        scale = min(4.0, 104 / h)
        x = cx + 14
        for f in range(frames):
            sprite = atlas.crop((x0 + f * w, y0, x0 + (f + 1) * w, y0 + h))
            tints = ((143, 216, 255), (255, 74, 58)) if name == "telegraph" else (None,)
            for tint in tints:
                if tint:
                    t = Image.new("RGBA", sprite.size)
                    t.putdata([(r * tint[0] // 255, g * tint[1] // 255, b * tint[2] // 255, a) for r, g, b, a in sprite.getdata()])
                else:
                    t = sprite
                big = t.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.NEAREST)
                if x + big.width > cx + cell_w - 8:
                    break
                sheet.alpha_composite(big, (x, cy + 50))
                x += big.width + 8
    sheet.convert("RGB").save(path, optimize=True)
