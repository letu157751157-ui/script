"""Pixel-art sprites for The Harvester particles, in the vanilla Minecraft particle style:
tiny sprites (mostly 8x8, like particles.png), a few flat colours per sprite, hard pixel edges,
no gradients, no dithering noise.

Every sprite is a list of frames; a frame is an RGBA numpy array (h, w, 4).
Grayscale sprites (smoke, rings, tiles, slashes...) are tinted by the particle JSON.
"""
import math

import numpy as np


def hexc(value, alpha=255):
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def gray(v, a=255):
    return (v, v, v, a)


def canvas(w, h):
    return np.zeros((h, w, 4), dtype=np.uint8)


def put(img, x, y, color):
    h, w = img.shape[:2]
    x, y = int(x), int(y)
    if 0 <= x < w and 0 <= y < h:
        img[y, x] = color


def from_ascii(rows, legend):
    h, w = len(rows), max(len(r) for r in rows)
    img = canvas(w, h)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in legend:
                img[y, x] = legend[ch]
    return img


def pixel_circle(img, cx, cy, r, color):
    """1-pixel circle outline (no anti-aliasing)."""
    steps = int(r * 16)
    for i in range(steps):
        a = i / steps * math.tau
        put(img, round(cx + math.cos(a) * r), round(cy + math.sin(a) * r), color)


# ---------------------------------------------------------------------------
# Colours (3-4 per sprite, like vanilla particles)
# ---------------------------------------------------------------------------

TEAL_D = hexc("#159A84")
TEAL = hexc("#4FE3BB")
TEAL_L = hexc("#C9FFF0")
PLAGUE_D = hexc("#4A6B1A")
PLAGUE = hexc("#8DB33A")
PLAGUE_L = hexc("#D2E87A")
BLACK = hexc("#141418")
DARK = hexc("#2C2C36")
EYE = hexc("#D8F06A")

SOUL = {"o": TEAL_D, "L": TEAL, "W": TEAL_L}

# ---------------------------------------------------------------------------
# Souls
# ---------------------------------------------------------------------------

SOUL_FRAMES = [
    ["...o....",
     "...oo...",
     "..oLo...",
     "..oLLo..",
     ".oLWLo..",
     ".oLWWLo.",
     ".oLWWLo.",
     "..oooo.."],
    ["....o...",
     "...oo...",
     "...oLo..",
     "..oLLo..",
     "..oLWLo.",
     ".oLWWLo.",
     ".oLWWLo.",
     "..oooo.."],
    ["....o...",
     "....o...",
     "...oLo..",
     "..oLLLo.",
     "..oLWLo.",
     ".oLWWLo.",
     ".oLWWLo.",
     "..oooo.."],
    ["..o.....",
     "..oo....",
     "..oLo...",
     "..oLLo..",
     ".oLWLo..",
     ".oLWWLo.",
     ".oLWWLo.",
     "..oooo.."],
]

WRAITH_HEAD = [
    "..oooo..",
    ".oLLLLo.",
    "oL.LL.Lo",
    "oLLLLLLo",
    "oLLWWLLo",
    ".oLLLLo.",
]
WRAITH_TAILS = [
    [".oLo.oLo", "..o...o."],
    [".oLLoLo.", "..o..o.."],
    ["oLo.oLo.", ".o...o.."],
    [".oLoLLo.", "..o..o.."],
]


def soul_frame(frame):
    return from_ascii(SOUL_FRAMES[frame], SOUL)


def wraith_frame(frame):
    return from_ascii(WRAITH_HEAD + WRAITH_TAILS[frame], SOUL)


# ---------------------------------------------------------------------------
# Smoke / gas: vanilla "generic" smoke — a round puff shrinking over 8 frames
# ---------------------------------------------------------------------------

PUFFS = {
    8: ["..xxxx..", ".xxxxxx.", "xxxxxxxx", "xxxxxxxx", "xxxxxxxx", "xxxxxxxx", ".xxxxxx.", "..xxxx.."],
    7: [".xxxxx.", "xxxxxxx", "xxxxxxx", "xxxxxxx", "xxxxxxx", "xxxxxxx", ".xxxxx."],
    6: [".xxxx.", "xxxxxx", "xxxxxx", "xxxxxx", "xxxxxx", ".xxxx."],
    5: [".xxx.", "xxxxx", "xxxxx", "xxxxx", ".xxx."],
    4: [".xx.", "xxxx", "xxxx", ".xx."],
    3: [".x.", "xxx", ".x."],
    2: ["xx", "xx"],
    1: ["x"],
}


def smoke_frame(frame):
    """Vanilla-style smoke puff: frame 0 is a full 8x8 puff, frame 7 a single pixel."""
    size = 8 - frame
    img = canvas(8, 8)
    off = (8 - size) // 2
    for y, row in enumerate(PUFFS[size]):
        for x, ch in enumerate(row):
            if ch == "x":
                img[off + y, off + x] = gray(205)
    # one or two highlight pixels near the top-left edge
    if size >= 4:
        img[off + 1, off + 1] = gray(255)
    if size >= 6:
        img[off + 1, off + 2] = gray(255)
        img[off + 2, off + 1] = gray(255)
    return img


SPLASH_FRAMES = [
    ["........",
     "........",
     "...xx...",
     "..xxxx..",
     "..xxxx..",
     "...xx...",
     "........",
     "........"],
    ["........",
     "..x..x..",
     "........",
     ".x.xx.x.",
     ".x.xx.x.",
     "........",
     "..x..x..",
     "........"],
    [".x....x.",
     "........",
     "x......x",
     "........",
     "........",
     "x......x",
     "........",
     ".x....x."],
    ["x......x",
     "........",
     "........",
     "........",
     "........",
     "........",
     "........",
     "x......x"],
]


def splash_frame(frame):
    return from_ascii(SPLASH_FRAMES[frame], {"x": gray(255)})


# ---------------------------------------------------------------------------
# Slashes, rings, ground marks
# ---------------------------------------------------------------------------

def slash_frame(frame):
    """16x16 sweep crescent, 2px white edge + 1px gray, shrinking like the vanilla sweep."""
    img = canvas(16, 16)
    reach = [150, 130, 100, 70][frame]
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - 8, y + 0.5 - 11
            d = math.hypot(dx, dy)
            ang = math.degrees(math.atan2(-dy, dx))  # 90 = straight up
            if abs(ang - 90) > reach / 2 or dy > 0:
                continue
            if 6.2 <= d < 7.6:
                img[y, x] = gray(255)
            elif 5.2 <= d < 6.2 and frame < 3:
                img[y, x] = gray(170)
    return img


def ring_sprite():
    img = canvas(32, 32)
    pixel_circle(img, 15.5, 15.5, 15, gray(255))
    return img


def rune_circle_sprite():
    img = canvas(32, 32)
    pixel_circle(img, 15.5, 15.5, 15, gray(255))
    pixel_circle(img, 15.5, 15.5, 11, gray(200))
    # 8 marks between the rings
    for k in range(8):
        a = k * math.tau / 8
        for r in (12.5, 13.5):
            put(img, round(15.5 + math.cos(a) * r), round(15.5 + math.sin(a) * r), gray(255))
    # small cross in the middle
    for i in range(-2, 3):
        put(img, 15 + i, 15, gray(220))
        put(img, 15, 15 + i, gray(220))
    return img


def tile_sprite():
    img = canvas(8, 8)
    img[:, :] = gray(120)
    img[0, :] = img[-1, :] = img[:, 0] = img[:, -1] = gray(255)
    return img


SPARK_FRAMES = [
    ["........",
     "...x....",
     "...x....",
     ".xxxxx..",
     "...x....",
     "...x....",
     "........",
     "........"],
    ["........",
     "........",
     "...x....",
     "..xxx...",
     "...x....",
     "........",
     "........",
     "........"],
    ["........",
     "........",
     "........",
     "...x....",
     "........",
     "........",
     "........",
     "........"],
]


def spark_frame(frame):
    return from_ascii(SPARK_FRAMES[frame], {"x": gray(255)})


def drop_sprite():
    return from_ascii(["........", "...x....", "...x....", "...x....", "........", "........", "........", "........"],
                      {"x": gray(255)})


# ---------------------------------------------------------------------------
# Reaper props
# ---------------------------------------------------------------------------

def skull_sprite():
    return from_ascii([
        "................",
        "....wwwwwwww....",
        "...wwwwwwwwwg...",
        "..wwwwwwwwwwwg..",
        "..wwwwwwwwwwwg..",
        "..wkkkwwwkkkwg..",
        "..wkttwwwkttwg..",
        "..wkkkwwwkkkwg..",
        "..wwwwwkwwwwwg..",
        "...wwwkkkwwwg...",
        "....wwwwwwwg....",
        "....wkwkwkwg....",
        "....wwwwwwwg....",
        ".....ggggggg....",
        "................",
        "................",
    ], {"w": hexc("#E6E1CF"), "g": hexc("#A39D88"), "k": hexc("#1E1E22"), "t": TEAL})


def scythe_sprite():
    return from_ascii([
        "................",
        "....WWWWWW......",
        "..WWLLLLLLWb....",
        ".WLL......Lb....",
        "WL........bb....",
        "W........b.b....",
        "........b.......",
        ".......b........",
        "......b.........",
        ".....b..........",
        "....bb..........",
        "....b...........",
        "...b............",
        "..b.............",
        ".b..............",
        "................",
    ], {"W": TEAL_L, "L": TEAL, "b": TEAL_D})


# ---------------------------------------------------------------------------
# Crows and feathers
# ---------------------------------------------------------------------------

CROW_FRAMES = [
    ["k......k",
     "kk....kk",
     ".kkddkk.",
     "..kyyk..",
     "..kddk..",
     "...kk...",
     "..k..k..",
     "........"],
    ["........",
     "........",
     "kkkddkkk",
     ".kkyykk.",
     "..kddk..",
     "...kk...",
     "..k..k..",
     "........"],
    ["........",
     "........",
     "...dd...",
     "..kyyk..",
     ".kkddkk.",
     "kk.kk.kk",
     "k..kk..k",
     "..k..k.."],
]


def crow_frame(frame):
    return from_ascii(CROW_FRAMES[[0, 1, 2, 1][frame]], {"k": BLACK, "d": DARK, "y": EYE})


def feather_sprite():
    return from_ascii([
        "......gk",
        ".....gk.",
        "....gk..",
        "...gk...",
        "..gk....",
        ".gk.....",
        "k.......",
        "........",
    ], {"k": BLACK, "g": hexc("#4A4A56")})


# ---------------------------------------------------------------------------
# Plague doctor props
# ---------------------------------------------------------------------------

def flask_sprite():
    return from_ascii([
        "...cc...",
        "...gg...",
        "..g..g..",
        ".gLLLLg.",
        ".gWLLLg.",
        ".gLLLLg.",
        "..gggg..",
        "........",
    ], {"c": hexc("#7A5230"), "g": hexc("#CDEFF2"), "L": PLAGUE, "W": PLAGUE_L})


SHARD_FRAMES = [
    ["........", "........", "...w....", "..wb....", "...b....", "........", "........", "........"],
    ["........", "........", "..wb....", "...bb...", "........", "........", "........", "........"],
]


def shard_frame(frame):
    return from_ascii(SHARD_FRAMES[frame], {"w": gray(255), "b": hexc("#A8E0E8")})


DIRT_FRAMES = [
    ["........", "........", "...ab...", "...bb...", "........", "........", "........", "........"],
    ["........", "........", "..ab....", "..bbb...", "........", "........", "........", "........"],
]


def dirt_frame(frame):
    return from_ascii(DIRT_FRAMES[frame], {"a": hexc("#8A6A48"), "b": hexc("#5E4630")})


HOURGLASS = [
    "dddddddd",
    ".gTTTTg.",
    ".gTTTTg.",
    "..gTTg..",
    "..gTTg..",
    "...gg...",
    "...gg...",
    "..gBBg..",
    "..gBBg..",
    ".gBBBBg.",
    ".gBBBBg.",
    "dddddddd",
]


def hourglass_frame(frame, frames=8):
    """8x12 hourglass; frame 0 = full top chamber, last frame = all sand at the bottom."""
    p = frame / (frames - 1)
    top = [(x, y) for y, row in enumerate(HOURGLASS) for x, ch in enumerate(row) if ch == "T"]
    bottom = [(x, y) for y, row in enumerate(HOURGLASS) for x, ch in enumerate(row) if ch == "B"]
    top.sort(key=lambda c: -c[1])      # the top chamber empties from the top down
    bottom.sort(key=lambda c: -c[1])   # the bottom chamber fills from the floor up
    keep_top = set(top[:round(len(top) * (1 - p))])
    fill_bottom = set(bottom[:round(len(bottom) * p)])
    img = from_ascii(HOURGLASS, {"d": hexc("#5C3F24"), "g": hexc("#BFEFEA")})
    for c in keep_top | fill_bottom:
        img[c[1], c[0]] = TEAL
    if 0 < p < 1:
        img[5, 3] = TEAL_L
        img[6, 4] = TEAL_L
    return img


def lantern_frame(frame):
    return from_ascii([
        "..dddd..",
        "..d..d..",
        ".dddddd.",
        ".dLWWLd." if frame == 0 else ".dLLWLd.",
        ".dLWLLd." if frame == 0 else ".dLWWLd.",
        ".dLLLLd.",
        ".dddddd.",
        "........",
    ], {"d": hexc("#2A2A33"), "L": TEAL, "W": TEAL_L})


PIPS_ICON = [
    ".....hhhhhh.....",
    "...hhhhhhhhhh...",
    ".....mmmmm......",
    ".....mlmmmbb....",
    ".....mmmmbbbb...",
    "......mm...bb...",
    "................",
]


def plague_pips_frame(stacks):
    """16x10: a tiny plague doctor mask and 5 slots, `stacks` of them lit green."""
    img = canvas(16, 10)
    img[0:7] = from_ascii(PIPS_ICON, {"h": BLACK, "m": hexc("#3A322C"), "b": hexc("#6A5A4C"), "l": EYE})
    for i in range(5):
        color = PLAGUE_L if i < stacks else hexc("#26262C", 200)
        for y in (8, 9):
            for x in (1 + i * 3, 2 + i * 3):
                img[y, x] = color
    return img


def grave_sprite():
    return from_ascii([
        "..ssss..",
        ".sSSSSs.",
        ".sSdSSs.",
        ".sdddSs.",
        ".sSdSSs.",
        ".sSdSSs.",
        ".sSSSSs.",
        ".sSSSSs.",
        ".sSSSSs.",
        "mmbmmbmm",
        "bbbbbbbb",
        "........",
    ], {"S": hexc("#8A8F96"), "s": hexc("#5A5E64"), "d": hexc("#3A3D42"), "m": PLAGUE_D, "b": hexc("#5E4630")})


def chain_sprite():
    return from_ascii([
        "........",
        "..oooo..",
        ".o....o.",
        ".o....o.",
        ".o....o.",
        "..oooo..",
        "........",
        "........",
    ], {"o": TEAL})


def beak_sprite():
    return from_ascii([
        "................",
        "....hhhhhh......",
        "....hhhhhh......",
        ".hhhhhhhhhhhh...",
        "....mmmmmm......",
        "...mmmmmmmm.....",
        "...mllmmmmmbb...",
        "...mllmmmmbbbb..",
        "...mmmmmmbbbbbb.",
        "....mmmmmm..bbbb",
        ".....mmmm.....bb",
        "................",
        "................",
        "................",
        "................",
        "................",
    ], {"h": BLACK, "m": hexc("#3A322C"), "b": hexc("#6A5A4C"), "l": EYE})


SPRITES = {
    "soul": [soul_frame(f) for f in range(4)],
    "wraith": [wraith_frame(f) for f in range(4)],
    "miasma": [smoke_frame(f) for f in range(8)],
    "splash": [splash_frame(f) for f in range(4)],
    "slash": [slash_frame(f) for f in range(4)],
    "ring": [ring_sprite()],
    "rune_circle": [rune_circle_sprite()],
    "tile": [tile_sprite()],
    "spark": [spark_frame(f) for f in range(3)],
    "drop": [drop_sprite()],
    "skull": [skull_sprite()],
    "scythe": [scythe_sprite()],
    "crow": [crow_frame(f) for f in range(4)],
    "feather": [feather_sprite()],
    "flask": [flask_sprite()],
    "shard": [shard_frame(f) for f in range(2)],
    "dirt": [dirt_frame(f) for f in range(2)],
    "hourglass": [hourglass_frame(f) for f in range(8)],
    "lantern": [lantern_frame(f) for f in range(2)],
    "pips": [plague_pips_frame(n) for n in range(1, 6)],
    "grave": [grave_sprite()],
    "chain": [chain_sprite()],
    "beak": [beak_sprite()],
}
