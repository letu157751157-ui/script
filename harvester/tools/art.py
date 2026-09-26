"""Pixel-art sprites for The Harvester particles — the boss's own look.

Art direction: "memento mori woodcut + soul fire".
* Soul fire is the Harvester's element: blue — white core, ice cyan, soul blue, indigo and a deep
  violet rim. Flames are curling tongues with hooked tips.
* Gradients are ordered-dithered with a 4x4 Bayer matrix instead of being cut into flat bands,
  and sprites dissolve through the same matrix, so they break up into a regular checker like a print.
* Objects (skull, candle, coffin, hourglass, lantern, plague mask, dancer, scythe) are drawn like the
  woodcuts of a Danse Macabre: ink outline, bone/parchment fill, diagonal hatching on the shadow side.
* Plague is a sickly yellow-green, dithered the same way. Smoke is drawn as curls, not round puffs.
Grayscale sprites (smoke, dial ring, sigil, tile, flame wave) are coloured by tinting in the JSON.

Every sprite is a list of frames; a frame is an RGBA numpy array (h, w, 4).
"""
import math

import numpy as np

# ---------------------------------------------------------------------------
# Palettes (character -> RGB)
# ---------------------------------------------------------------------------

FIRE = {"V": (44, 26, 112), "I": (62, 78, 214), "B": (76, 158, 255), "C": (162, 230, 255), "W": (246, 252, 255)}
PLAGUE = {"D": (46, 64, 20), "M": (100, 132, 36), "G": (158, 192, 62), "Y": (222, 238, 130)}
GRAY = {"1": (86, 86, 86), "2": (150, 150, 150), "3": (208, 208, 208), "4": (255, 255, 255)}
INK = (20, 14, 28)
# woodcut objects: ink, bone (light / hatch / deep), robe & wood darks, plus the fire and plague colours
WOODCUT = {"K": INK, "P": (236, 224, 196), "Q": (184, 168, 134), "R": (124, 108, 84),
           "D": (40, 32, 54), "E": (72, 58, 86), "F": (104, 88, 118),
           "Z": (90, 60, 40), "X": (132, 92, 58),
           **FIRE, "G": PLAGUE["G"], "Y": PLAGUE["Y"], "M": PLAGUE["M"]}
ASH = {"1": (70, 66, 78), "2": (128, 124, 136), "3": (196, 192, 204)}

FIRE_RAMP = "VIBCW"
PLAGUE_RAMP = "DMGY"
GRAY_RAMP = "1234"

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def bayer(x, y):
    return (BAYER[y % 4][x % 4] + 0.5) / 16


def hash01(x, y, salt=0):
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def dither(ramp, heat, x, y):
    """heat 0..1 -> ramp character (ramp[0] = darkest), ordered-dithered, transparent at the edge."""
    if heat <= 0:
        return "."
    i = int(math.floor(heat * len(ramp) + bayer(x, y) - 0.5))
    return "." if i < 0 else ramp[min(i, len(ramp) - 1)]


def grid(w, h, fn):
    return ["".join(fn(x, y) for x in range(w)) for y in range(h)]


def to_rgba(rows, palette):
    h, w = len(rows), max(len(r) for r in rows)
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in palette:
                img[y, x, :3] = palette[ch]
                img[y, x, 3] = 255
    return img


def heat_sprite(w, h, heat, ramp=FIRE_RAMP, palette=FIRE):
    return to_rgba(grid(w, h, lambda x, y: dither(ramp, heat(x + 0.5, y + 0.5), x, y)), palette)


def dissolve(img, amount):
    """Ordered dissolve: drop the pixels whose Bayer threshold is under `amount`."""
    out = img.copy()
    for y in range(out.shape[0]):
        for x in range(out.shape[1]):
            if bayer(x, y) < amount:
                out[y, x, 3] = 0
    return out


def outline(rows, fill_chars, ink="K"):
    """Ink a 1-pixel outline around every pixel whose char is in fill_chars."""
    h, w = len(rows), len(rows[0])
    out = [list(r) for r in rows]
    for y in range(h):
        for x in range(w):
            if rows[y][x] != ".":
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and rows[ny][nx] in fill_chars:
                    out[y][x] = ink
                    break
    return ["".join(r) for r in out]


# ---------------------------------------------------------------------------
# Soul fire
# ---------------------------------------------------------------------------

def tongue(px, py, bx, by, height, width, sway, phase, curl):
    """Heat of one flame tongue rising from (bx, by): sways, thins, hooks sideways at the tip."""
    t = (by - py) / height
    if t < 0 or t > 1:
        return 0.0
    cx = bx + sway * math.sin(phase + t * 2.6) * t + curl * max(0.0, t - 0.65) * 6
    w = width * (1 - t) ** 0.75 + 0.35
    d = abs(px - cx) / w
    return (1 - d) ** 0.7 * (1 - 0.62 * t) if d < 1 else 0.0


def bulb(px, py, bx, by, r):
    d = math.hypot((px - bx) / r, (py - by) / (r * 0.85))
    return (1 - d) ** 0.6 if d < 1 else 0.0


def flame_frame(frame, frames=8):
    """16x16 soul flame, looping flicker: a fat base, one tall curling tongue and two small ones."""
    ph = frame / frames * 2 * math.pi

    def heat(px, py):
        h = max(
            bulb(px, py, 8, 12.3, 4.1),
            tongue(px, py, 8, 12.5, 10.5 + math.sin(ph) * 1.2, 3.5, 1.7, ph, 0.7 if math.sin(ph * 2) > 0 else -0.7),
            tongue(px, py, 5.6, 12.2, 5.5 + math.cos(ph) * 1.3, 1.6, 1.0, ph + 1.7, -0.9),
            tongue(px, py, 10.4, 12.2, 5 + math.sin(ph + 2.2) * 1.3, 1.5, 1.0, ph + 3.1, 0.9),
        )
        if math.sin(ph) > 0.2:  # a flame lick breaking off the top
            h = max(h, 0.5 * bulb(px, py, 8 + 1.6 * math.cos(ph), 2.2 + (frame % 3), 1.3))
        return min(1.0, h + 0.3 * max(0.0, 1 - math.hypot(px - 8, py - 11.8) / 2.8))

    return heat_sprite(16, 16, heat)


def flame_tall_frame(frame, frames=6):
    """16x32 column of soul fire for pillars, pyres and eruptions."""
    ph = frame / frames * 2 * math.pi

    def heat(px, py):
        h = max(
            bulb(px, py, 8, 27.5, 5.2),
            tongue(px, py, 8, 28, 24 + 2 * math.sin(ph), 4.6, 2.2, ph, 0.8 if frame % 2 else -0.8),
            tongue(px, py, 5, 27, 13 + 2 * math.cos(ph), 2.1, 1.5, ph + 2, -1.0),
            tongue(px, py, 11, 27, 15 + 2 * math.sin(ph + 1), 2.1, 1.5, ph + 4, 1.0),
        )
        h = max(h, 0.55 * bulb(px, py, 8 + 2 * math.sin(ph), 3 + 2 * (frame % 3), 1.6))
        return min(1.0, h + 0.35 * max(0.0, 1 - math.hypot(px - 8, py - 26) / 4))

    return heat_sprite(16, 32, heat)


def wisp_frame(frame):
    """16x16 will-o'-the-wisp (ma troi): a round ghost-fire orb, a short flickering tail, hollow eyes."""
    ph = frame / 4 * 2 * math.pi
    r = 4.9 + 0.35 * math.sin(ph)

    def heat(px, py):
        orb = bulb(px, py, 8, 10, r) * 0.8
        tail = tongue(px, py, 8 + 0.8 * math.sin(ph), 7, 6, 2.4, 1.8, ph, 0.9)
        return min(1.0, max(orb, tail) + 0.3 * max(0.0, 1 - math.hypot(px - 8, py - 10.5) / 3.2))

    rows = [list(r) for r in grid(16, 16, lambda x, y: dither(FIRE_RAMP, heat(x + 0.5, y + 0.5), x, y))]
    eyes = ((6, 9), (9, 9)) if frame == 2 else ((6, 9), (6, 10), (9, 9), (9, 10))
    for x, y in eyes:
        rows[y][x] = "V"
    rows[12][7] = rows[12][8] = "I"
    return to_rgba(["".join(r) for r in rows], FIRE)


def ember_frame(frame):
    """8x8 flake of soul fire, shrinking."""
    height, width = ((5.5, 1.9), (4.0, 1.4), (2.4, 0.9))[frame]
    return heat_sprite(8, 8, lambda px, py: min(1.0, 0.25 + tongue(px, py, 4, 6.8, height, width, 0.6, frame, 0.4))
                       if tongue(px, py, 4, 6.8, height, width, 0.6, frame, 0.4) > 0 else 0.0)


def ghost_frame(frame):
    """16x16 harvested soul: a little ghost with hollow eyes and a wagging tail."""
    ph = frame / 4 * 2 * math.pi

    def heat(px, py):
        head = bulb(px, py, 8, 6.2, 4.4)
        body = 0.0
        if 6 <= py <= 15:
            t = (py - 6) / 9
            cx = 8 + 1.8 * math.sin(ph + t * 4.5) * t
            w = 4.2 * (1 - t) ** 0.9 + 0.3
            d = abs(px - cx) / w
            body = (1 - d) * (1 - 0.7 * t) if d < 1 else 0.0
        return min(1.0, max(head, body) + 0.2 * max(0.0, 1 - math.hypot(px - 8, py - 5) / 3))

    rows = [list(r) for r in grid(16, 16, lambda x, y: dither(FIRE_RAMP, heat(x + 0.5, y + 0.5), x, y))]
    for x, y in ((6, 5), (6, 6), (9, 5), (9, 6), (7, 8), (8, 8)):
        rows[y][x] = "V"
    return to_rgba(["".join(r) for r in rows], FIRE)


def footprint_sprite():
    """8x8 glowing footprint left behind by Footsteps of the Dead."""
    rows = [
        "..IBBI..",
        ".IBCCBI.",
        ".BCWCCB.",
        ".IBCCBI.",
        "..IBBI..",
        "........",
        "..IBBI..",
        "..IBCI..",
    ]
    return to_rgba(rows, FIRE)


# ---------------------------------------------------------------------------
# Smoke and plague (curls)
# ---------------------------------------------------------------------------

def spiral_heat(px, py, cx, cy, scale, rot, turns=1.75):
    best = 99.0
    best_t = 0.0
    steps = 90
    for i in range(steps + 1):
        t = i / steps
        a = rot + t * turns * 2 * math.pi
        r = scale * (0.8 + 4.6 * t)
        d = math.hypot(px - (cx + r * math.cos(a)), py - (cy + r * math.sin(a)))
        if d < best:
            best, best_t = d, t
    thick = 2.3 - 1.3 * best_t
    return (1 - best / thick) * (1 - 0.35 * best_t) if best < thick else 0.0


def smoke_frame(frame):
    """16x16 curl of smoke (grayscale): a spiral that widens, turns and dissolves."""
    scale = 0.85 + 0.12 * frame
    rot = frame * 0.45

    def heat(px, py):
        return min(1.0, max(spiral_heat(px, py, 8, 8.5, scale, rot), 0.9 * bulb(px, py, 8, 8.5, 2.6 - 0.3 * frame)))

    img = heat_sprite(16, 16, heat, GRAY_RAMP, GRAY)
    return dissolve(img, (0.0, 0.08, 0.25, 0.5, 0.72)[frame])


def splash_frame(frame):
    """16x16 plague splat: a blob and flung droplets that dissolve."""
    def heat(px, py):
        h = bulb(px, py, 8, 8.5, 3.2 + 0.7 * frame)
        for k in range(7):
            a = k / 7 * 2 * math.pi + 0.4
            r = 4.2 + 1.5 * frame + hash01(k, 3, 5) * 1.5
            h = max(h, 0.8 * bulb(px, py, 8 + r * math.cos(a), 8.5 + r * math.sin(a), 1.3 - 0.15 * frame))
        return h

    img = heat_sprite(16, 16, heat, PLAGUE_RAMP, PLAGUE)
    return dissolve(img, (0.0, 0.0, 0.3, 0.62)[frame])


def drop_sprite():
    rows = ["........", "...Y....", "...Y....", "..YGG...", "..GGM...", "..GMM...", "...MD...", "........"]
    return to_rgba(rows, PLAGUE)


def ash_frame(frame):
    """8x8 flake of ash (replaces dirt: the Harvester burns what it touches)."""
    shapes = [
        ["........", "...33...", "..3322..", "..3221..", "...21...", "........", "........", "........"],
        ["........", "........", "...32...", "..321...", "...1....", "........", "........", "........"],
        ["........", "........", "...3....", "...21...", "........", "........", "........", "........"],
    ]
    return to_rgba(shapes[frame], ASH)


# ---------------------------------------------------------------------------
# Scythe arcs, rings, sigils (ground and air)
# ---------------------------------------------------------------------------

def arc_frame(frame):
    """32x32 swing of the scythe: a crescent of soul fire, white on the cutting edge,
    with flame tongues licking off its back. Sweeps in, burns, breaks into a checker."""
    reach = (0.55, 1.0, 1.0, 1.0)[frame]
    tongue_len = (0.6, 1.0, 1.5, 1.2)[frame]

    def heat(px, py):
        dx, dy = px - 16, py - 17
        r = math.hypot(dx, dy)
        a = math.degrees(math.atan2(-dy, dx)) % 360
        if not 15 <= a <= 165:
            return 0.0
        u = (a - 15) / 150
        if u > reach:
            return 0.0
        thick = 1.2 + 4.3 * math.sin(math.pi * u)
        r_out = 13.5
        r_in = r_out - thick
        h = 0.0
        if r_in <= r <= r_out:
            h = (1 - 0.75 * (r - r_in) / thick) * (0.5 + 0.5 * math.sin(math.pi * u))
        for k in range(9):
            ak = 22 + k * 17 + frame * 5
            uk = (ak - 15) / 150
            if uk > reach:
                continue
            length = (1.5 + 3 * hash01(k, frame, 21)) * math.sin(math.pi * uk) * tongue_len
            along = r - r_out
            if 0 <= along <= length:
                width = 1.4 * (1 - along / length)
                if abs(math.radians(a - ak)) * r < width:
                    h = max(h, 0.55 * (1 - along / length))
        return h

    img = heat_sprite(32, 32, heat)
    return dissolve(img, (0.0, 0.0, 0.2, 0.55)[frame])


def dial_ring_sprite():
    """32x32 telegraph ring drawn like a clock dial: double rim and twelve hour ticks (grayscale)."""
    def px(x, y):
        dx, dy = x + 0.5 - 16, y + 0.5 - 16
        r = math.hypot(dx, dy)
        a = math.degrees(math.atan2(dy, dx)) % 360
        k = round(a / 30) % 12
        off = abs(((a - k * 30) + 180) % 360 - 180)
        tick = math.radians(off) * r
        if abs(r - 15) < 0.6:
            return "4"
        if 12.2 <= r <= 15 and tick < (0.9 if k % 3 == 0 else 0.55) and (k % 3 == 0 or r >= 13.2):
            return "4"
        if abs(r - 12.6) < 0.5 and (x + y) % 2 == 0:
            return "2"
        return "."

    return to_rgba(grid(32, 32, px), GRAY)


def flame_wave_frame(frame):
    """32x32 ring of flame tongues pointing outward (grayscale): a soul-fire shockwave."""
    def heat(px, py):
        dx, dy = px - 16, py - 16
        r = math.hypot(dx, dy)
        a = math.degrees(math.atan2(dy, dx)) % 360
        h = 0.75 * max(0.0, 1 - abs(r - 11.5) / 1.3)
        for k in range(16):
            ak = k * 22.5 + frame * 6 + hash01(k, 1, 31) * 8
            length = (2.5 + 2 * hash01(k, 2, 31)) * (1 - 0.3 * frame)
            along = r - 11.5
            off = abs(((a - ak) + 180) % 360 - 180)
            if 0 <= along <= length and math.radians(off) * r < 1.5 * (1 - along / length):
                h = max(h, 0.85 * (1 - along / length) + 0.15)
        return min(1.0, h)

    img = heat_sprite(32, 32, heat, GRAY_RAMP, GRAY)
    return dissolve(img, (0.0, 0.18, 0.5)[frame])


GLYPHS = [
    ["#.#", ".#.", "#.#"], ["###", "..#", ".#."], ["#..", "###", "..#"], [".#.", "###", ".#."],
    ["##.", "#.#", "##."], ["#.#", "###", "#.#"], [".##", "#..", ".##"], ["#..", "#..", "###"],
]


def sigil_sprite():
    """64x64 Harvest Seal (grayscale): clock-dial rim, a ring of glyphs, and an hourglass
    crossed by a scythe in the middle — memento mori."""
    img = [["." for _ in range(64)] for _ in range(64)]

    def put(x, y, c):
        if 0 <= x < 64 and 0 <= y < 64:
            img[y][x] = c

    for y in range(64):
        for x in range(64):
            dx, dy = x + 0.5 - 32, y + 0.5 - 32
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx)) % 360
            if abs(r - 30.8) < 0.6:
                put(x, y, "4")
            elif abs(r - 28.3) < 0.5:
                put(x, y, "3")
            elif abs(r - 19.5) < 0.55:
                put(x, y, "3")
            elif 28.3 < r < 30.8:
                off = abs(((a % 6) + 3) % 6 - 3)
                if math.radians(off) * r < 0.45:
                    put(x, y, "2")
            # hour ticks crossing into the glyph band
            k = round(a / 30) % 12
            off = abs(((a - k * 30) + 180) % 360 - 180)
            if 25.5 <= r <= 28.3 and math.radians(off) * r < 0.6:
                put(x, y, "4")
    # glyphs between the hour ticks
    for k in range(12):
        a = math.radians(k * 30 + 15)
        gx, gy = 32 + 24 * math.cos(a), 32 + 24 * math.sin(a)
        g = GLYPHS[k % len(GLYPHS)]
        for j, row in enumerate(g):
            for i, ch in enumerate(row):
                if ch == "#":
                    put(int(gx) - 1 + i, int(gy) - 1 + j, "4")
    # hourglass
    for y in range(20, 45):
        t = abs(y + 0.5 - 32) / 12
        hw = 7 * t
        for x in (int(round(32 - hw - 0.5)), int(round(32 + hw - 0.5))):
            put(x, y, "4")
    for x in range(23, 41):
        put(x, 19, "4")
        put(x, 44, "4")
    for y in range(36, 44):  # sand in the lower bulb
        hw = 7 * abs(y + 0.5 - 32) / 12 - 1.2
        for x in range(int(32 - hw), int(32 + hw) + 1):
            if (x + y) % 2 == 0:
                put(x, y, "2")
    # scythe across it: snath from lower left to upper right, blade hooking left over the top
    for i in range(60):
        t = i / 59
        put(int(round(17 + 28 * t)), int(round(48 - 32 * t)), "3")
    for i in range(80):
        t = i / 79
        a = math.radians(-30 - 150 * t)
        r = 13 - 2 * t
        x, y = 36 + r * math.cos(a), 25 + r * math.sin(a) * 0.55
        put(int(round(x)), int(round(y)), "4")
        if t < 0.8:
            put(int(round(x)), int(round(y)) + 1, "3")
    return to_rgba(["".join(r) for r in img], GRAY)


def tile_sprite():
    """16x16 telegraph tile (grayscale): an engraved diamond with a dithered fill."""
    def px(x, y):
        d = abs(x + 0.5 - 8) + abs(y + 0.5 - 8)
        if 6.2 < d <= 7.4:
            return "4"
        if d <= 6.2:
            if d < 1.6:
                return "3"
            return "2" if bayer(x, y) < 0.35 else "."
        return "."

    return to_rgba(grid(16, 16, px), GRAY)


# ---------------------------------------------------------------------------
# Woodcut objects
# ---------------------------------------------------------------------------

SKULL = [
    "................",
    ".....KKKKKK.....",
    "....KPPPPPPK....",
    "...KPPPPPPQQK...",
    "..KPPPPPPPQPRK..",
    "..KPPPPPPQPQRK..",
    "..KPKKKPPKKKRK..",
    "..KKCWKPPKCWKK..",
    "..KKBCKPQKBCKK..",
    "...KKKPKKPKKK...",
    "....KPQKKQRK....",
    "....KPKPKPKK....",
    "....KKPKPKRK....",
    ".....KKKKKK.....",
    "................",
    "................",
]


def skull_sprite():
    return to_rgba(SKULL, WOODCUT)


def scythe_sprite():
    """32x32 spectral scythe: a hatched bone snath and a blade of soul fire, inked."""
    rows = [["." for _ in range(32)] for _ in range(32)]
    # blade: crescent hooking left from the top of the snath
    for y in range(32):
        for x in range(32):
            px, py = x + 0.5, y + 0.5
            outer = math.hypot(px - 14, py - 14.5) <= 11.5
            inner = math.hypot(px - 12.5, py - 18.5) <= 12
            if outer and not inner and py < 12.5 and px > 3:
                edge = 12 - math.hypot(px - 12.5, py - 18.5)
                rows[y][x] = dither(FIRE_RAMP, min(1.0, 1.05 + edge * 0.35), x, y)
    # snath
    for i in range(80):
        t = i / 79
        x, y = 9 + 14 * t, 30 - 27 * t
        rows[int(y)][int(x)] = "P"
        if int(x) + 1 < 32 and rows[int(y)][int(x) + 1] == ".":
            rows[int(y)][int(x) + 1] = "Q" if int(y) % 2 else "R"
    for t in (0.35, 0.68):  # grips
        x, y = int(9 + 14 * t), int(30 - 27 * t)
        for d in (-2, -1, 1):
            if 0 <= x + d < 32:
                rows[y][x + d] = "Q" if d < 0 else "P"
    rows = outline(["".join(r) for r in rows], "PQRVIBCW")
    return to_rgba(rows, WOODCUT)


def hourglass_frame(frame, frames=8):
    """16x16 woodcut hourglass with glowing soul sand running out."""
    f = frame / (frames - 1)
    half = {2: 4.5, 3: 4.5, 4: 4, 5: 3, 6: 2, 7: 0.6}
    rows = [["." for _ in range(16)] for _ in range(16)]
    for x in range(2, 14):
        rows[0][x] = rows[15][x] = "K"
        rows[1][x] = "Q" if x in (2, 13) else "P"
        rows[14][x] = "R" if x in (2, 13) else "Q"
    rows[1][2] = rows[1][13] = rows[14][2] = rows[14][13] = "K"
    for y in range(2, 14):
        rows[y][2] = "K"
        rows[y][13] = "K"
        hw = half.get(y, half.get(15 - y, 0.6))
        l, r = int(round(7.5 - hw)), int(round(8.5 + hw)) - 1
        rows[y][l] = rows[y][r] = "F"
    top_fill = round(4 * (1 - f))
    bottom_fill = round(5 * f)
    for y in range(2, 14):
        hw = half.get(y, half.get(15 - y, 0.6))
        l, r = int(round(7.5 - hw)) + 1, int(round(8.5 + hw)) - 2
        sand = (y <= 6 and y > 6 - top_fill) or (y >= 13 - bottom_fill + 1 and y >= 8)
        for x in range(l, r + 1):
            if sand:
                rows[y][x] = "W" if (y == 7 - top_fill or y == 14 - bottom_fill) else dither("IBC", 0.7, x, y)
    if 0 < f < 1:
        for y in range(7, 14 - bottom_fill):
            rows[y][7] = "C" if y % 2 else "W"
            rows[y][8] = "B" if y % 2 == 0 else rows[y][8]
    return to_rgba(["".join(r) for r in rows], WOODCUT)


def lantern_frame(frame):
    """16x16 the plague doctor's iron lantern with a blue flame inside."""
    ph = frame * math.pi
    rows = [["." for _ in range(16)] for _ in range(16)]
    for x in range(6, 10):
        rows[0][x] = "K"
    rows[1][5] = rows[1][10] = "K"
    for x in range(5, 11):
        rows[2][x] = "K"
    for x in range(4, 12):
        rows[3][x] = "K"
        rows[4][x] = "Q" if x in (4, 11) else "P"
        rows[12][x] = "K"
    rows[4][4] = rows[4][11] = "K"
    for x in range(5, 11):
        rows[13][x] = "K"
    for y in range(5, 12):
        for x in range(4, 12):
            if x in (4, 11):
                rows[y][x] = "K"
            elif x == 8:
                rows[y][x] = "E"
            else:
                h = tongue(x + 0.5, y + 0.5, 7.2, 11.6, 6.2, 2.1, 0.8, ph, 0.5 if frame else -0.5)
                h = max(h, 0.35)
                rows[y][x] = dither(FIRE_RAMP, h, x, y)
    return to_rgba(["".join(r) for r in rows], WOODCUT)


MASK_ICON = [
    "..KKKKKK..",
    ".KKKKKKKK.",
    "...KPPK...",
    "..KPCPPK..",
    "..KPPPPQK.",
    "...KPPQRK.",
    "....KKQRK.",
    "......KK..",
]


def plague_pips_frame(stacks):
    """16x16 plague stacks over a head: a small beak mask and five boils, lit by the stack count."""
    rows = [["." for _ in range(16)] for _ in range(16)]
    for y, row in enumerate(MASK_ICON):
        for x, ch in enumerate(row):
            if ch != ".":
                rows[y + 1][x + 3] = ch
    for i in range(5):
        x0 = 1 + i * 3
        lit = i < stacks
        for dy in range(2):
            for dx in range(2):
                rows[11 + dy][x0 + dx] = ("Y" if dy == 0 and dx == 0 else "G") if lit else "K"
        if lit:
            rows[13][x0] = rows[13][x0 + 1] = "M"
    return to_rgba(["".join(r) for r in rows], WOODCUT)


BEAK = [
    "................",
    ".....KKKKKK.....",
    "....KDDDDDDK....",
    "....KDEEEEDK....",
    "..KKKKKKKKKKKK..",
    "....KPPPPPPK....",
    "...KPPPPPPPQK...",
    "...KKKKPPPPQK...",
    "...KCWKPPPQQK...",
    "...KBCKPPPQRQK..",
    "...KKKKPPQQRRQK.",
    ".....KPPPQRRKRQK",
    "......KKQQRK.KKK",
    ".......KQRRK....",
    "........KRK.....",
    ".........K......",
]


def beak_sprite():
    return to_rgba(BEAK, WOODCUT)


def candle_frame(frame, frames=6):
    """16x16 bone-white candle on an iron dish, burning down, a blue flame on the wick."""
    height = round(10 - frame * 7 / (frames - 1))
    top = 13 - height
    rows = [["." for _ in range(16)] for _ in range(16)]
    for x in range(3, 13):
        rows[14][x] = "K"
    for x in range(4, 12):
        rows[13][x] = "F" if x in (4, 11) else "E"
    rows[13][3] = rows[13][12] = "K"
    for y in range(top, 13):
        rows[y][5] = "K"
        rows[y][10] = "K"
        for x in range(6, 10):
            rows[y][x] = "P" if x < 8 else ("Q" if (x + y) % 3 else "R")
    for x in range(5, 11):
        rows[top - 1][x] = "K"
    # wax drips
    rows[top][6] = "P"
    if top + 2 < 13:
        rows[top + 1][5] = "P"
        rows[top + 2][5] = "Q"
    rows[top - 1][7] = "P"
    rows[top - 2][8] = "K"  # wick
    ph = frame * 1.9
    for y in range(max(0, top - 8), top - 1):
        for x in range(4, 12):
            h = max(tongue(x + 0.5, y + 0.5, 8.2, top - 1.2, 5.5, 1.8, 0.8, ph, 0.6 if frame % 2 else -0.6),
                    bulb(x + 0.5, y + 0.5, 8.2, top - 2.2, 1.6))
            c = dither(FIRE_RAMP, h, x, y)
            if c != ".":
                rows[y][x] = c
    return to_rgba(["".join(r) for r in rows], WOODCUT)


def coffin_sprite():
    """16x32 coffin lid seen from above (ground decal): tapered planks and a cross of soul fire."""
    def half(y):
        if y < 8:
            return 3.2 + (7.2 - 3.2) * y / 8
        return 7.2 - (7.2 - 4.3) * (y - 8) / 22

    rows = [["." for _ in range(16)] for _ in range(32)]
    for y in range(1, 31):
        hw = half(y - 1)
        for x in range(16):
            dx = x + 0.5 - 8
            if abs(dx) <= hw:
                plank = (x - 1) % 4 == 0
                shade = dx > 1 and (x - y) % 3 == 0
                rows[y][x] = "Z" if plank or shade else "X" if dx < -2 else "Z" if dx > 3 else "X"
    rows = outline(["".join(r) for r in rows], "XZ")
    rows = [list(r) for r in rows]
    for y in range(7, 25):
        for x in range(7, 9):
            rows[y][x] = dither(FIRE_RAMP, 1.0 - abs(y - 12) / 20, x, y)
    for x in range(4, 12):
        for y in (12, 13):
            rows[y][x] = dither(FIRE_RAMP, 1.0 - abs(x + 0.5 - 8) / 10, x, y)
    for x, y in ((4, 4), (11, 4), (3, 12), (12, 12), (5, 27), (10, 27)):
        rows[y][x] = "P"
    return to_rgba(["".join(r) for r in rows], WOODCUT)


WHEAT = [
    "......I.I.I.....",
    ".......I.I......",
    "......BCB.......",
    ".....BWCWB......",
    "......CWC.......",
    ".....BCWCB......",
    "......CWC.......",
    ".....BCWCB......",
    "......BCB.......",
    ".......V........",
    ".......V.I......",
    "......VV..I.....",
    ".....V.V........",
    ".......V........",
    ".......V........",
    ".......V........",
]


def wheat_frame(frame):
    """16x16 soul wheat: a dark stalk swaying, its ear made of little blue flames."""
    sway = 2.0 * math.sin(frame / 4 * 2 * math.pi)
    rows = []
    for y, row in enumerate(WHEAT):
        shift = int(round(sway * ((15 - y) / 15) ** 2))
        row = row[-shift:] + row[:-shift] if shift > 0 else row[-shift:] + row[:-shift] if shift < 0 else row
        rows.append(row)
    return to_rgba(rows, FIRE)


DANCER = [
    "............CW..",
    "...........BCWB.",
    "............BI..",
    "............PQ..",
    "............PR..",
    ".....KKKK...KK..",
    "....KDDDDK..KP..",
    "...KDDDDDDK.KQ..",
    "...KDKPPKDK.KE..",
    "...KDPKPKDKKEK..",
    "...KDPPPPDKEEK..",
    "....KDKKDDEEK...",
    "...KDDDDDDEK....",
    "..KPKDDDDDDK....",
    ".KPK.KDDDEDDK...",
    ".KK..KDDDEDDK...",
    ".....KDDDEDDDK..",
    "....KDDDEDDDDK..",
    "....KDDDEDDDDDK.",
    "...KDDDEDDDDDDK.",
    "...KDDDEDDDFDDK.",
    "..KDDDEDDDDFDDDK",
    "..KDDDEDDDDFDDDK",
    "..KDDEDDDDDFDDDK",
    ".KDDDEDDDDDDFDDK",
    ".KDDEDDDDDDDFDDK",
    ".KDDEDDDDDDDFDK.",
    "KDDEDDDDDDDDFDDK",
    "KDDDDDDDDDDDDDK.",
    ".KDKDDKDKDDKDK..",
    "..K.KK.K.KK.K...",
    "................",
]


def dancer_frame(frame):
    """16x32 Danse Macabre dancer: a hooded skeleton in a robe, a soul candle raised overhead.
    Frame 1 swings the hem the other way."""
    rows = [list(r) for r in DANCER]
    if frame:
        for y in range(23, 31):
            rows[y] = ["."] + rows[y][:-1]
        rows[0][12], rows[0][13] = "W", "C"
        rows[1][11], rows[1][14] = "I", "B"
    return to_rgba(["".join(r) for r in rows], WOODCUT)


SPRITES = {
    "flame": [flame_frame(f) for f in range(8)],
    "flame_tall": [flame_tall_frame(f) for f in range(6)],
    "wisp": [wisp_frame(f) for f in range(4)],
    "ember": [ember_frame(f) for f in range(3)],
    "ghost": [ghost_frame(f) for f in range(4)],
    "footprint": [footprint_sprite()],
    "smoke": [smoke_frame(f) for f in range(5)],
    "splash": [splash_frame(f) for f in range(4)],
    "drop": [drop_sprite()],
    "ash": [ash_frame(f) for f in range(3)],
    "arc": [arc_frame(f) for f in range(4)],
    "ring": [dial_ring_sprite()],
    "wave": [flame_wave_frame(f) for f in range(3)],
    "sigil": [sigil_sprite()],
    "tile": [tile_sprite()],
    "skull": [skull_sprite()],
    "scythe": [scythe_sprite()],
    "hourglass": [hourglass_frame(f) for f in range(8)],
    "lantern": [lantern_frame(f) for f in range(2)],
    "pips": [plague_pips_frame(n) for n in range(1, 6)],
    "beak": [beak_sprite()],
    "candle": [candle_frame(f) for f in range(6)],
    "coffin": [coffin_sprite()],
    "wheat": [wheat_frame(f) for f in range(4)],
    "dancer": [dancer_frame(f) for f in range(2)],
}
