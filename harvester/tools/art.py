"""Pixel-art sprites for The Harvester particles.

Same style as the other addons of this repository (Aatrox's Darkin Blade, Toji, Giant Zombie):
hard-edged pixels, one hand-picked 4-5 colour ramp per effect, shading picked from a "heat" value
(bright core -> dark edge) so it comes out in flat bands, and multi-frame flipbooks that break apart
into loose pixels at the end instead of fading smoothly.
Slashes and rings are 32x32, most sprites 16x16, shards/drops 8x8, the rune circle 64x64.
Grayscale sprites (smoke, rings, tiles, sparks...) are coloured by tinting in the particle JSON.

Every sprite is a list of frames; a frame is an RGBA numpy array (h, w, 4).
"""
import math

import numpy as np

# ---------------------------------------------------------------------------
# Palettes (character -> RGB)
# ---------------------------------------------------------------------------

SOUL = {"W": (236, 255, 249), "L": (140, 255, 214), "T": (52, 214, 176), "B": (18, 146, 128), "D": (10, 78, 72)}
PLAGUE = {"W": (242, 250, 206), "Y": (204, 232, 112), "G": (140, 180, 58), "M": (84, 120, 34), "D": (40, 60, 18)}
GRAY = {"#": (255, 255, 255), "+": (185, 185, 185), "-": (120, 120, 120)}
SMOKE = {"H": (255, 255, 255), "A": (212, 212, 212), "B": (156, 156, 156), "C": (104, 104, 104)}
BONE = {"W": (240, 236, 220), "L": (205, 198, 176), "M": (150, 142, 120), "K": (28, 26, 32), "T": (78, 234, 196)}
CROW = {"K": (18, 16, 24), "D": (42, 36, 56), "V": (86, 72, 114), "Y": (216, 240, 106), "G": (120, 120, 128)}
GLASS = {"W": (255, 255, 255), "L": (206, 240, 246), "B": (126, 194, 208), "D": (62, 110, 128)}
WOOD = {"K": (48, 30, 18), "M": (92, 62, 36), "L": (138, 98, 58)}
STONE = {"L": (160, 164, 170), "M": (118, 122, 130), "D": (78, 82, 90), "K": (44, 46, 52)}
EARTH = {"K": (46, 32, 22), "S": (94, 70, 48), "L": (138, 106, 74), "R": (84, 120, 34)}
LEATHER = {"K": (16, 13, 12), "D": (38, 32, 28), "M": (62, 52, 44), "L": (96, 82, 68)}


def hash01(x, y, salt=0):
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def ramp_char(chars, limits=(0.82, 0.62, 0.42, 0.24, 0.1)):
    """Heat -> palette character, hard edges (bright core, dark rim)."""
    def pick(heat):
        for limit, char in zip(limits, chars):
            if heat > limit:
                return char
        return "."
    return pick


soul_char = ramp_char("WLTBD")
plague_char = ramp_char("WYGMD")
gray_char = ramp_char("#+-", (0.66, 0.4, 0.15))


def grid(w, h, fn):
    return ["".join(fn(x, y) for x in range(w)) for y in range(h)]


def to_rgba(rows, palette, alpha=None):
    h, w = len(rows), max(len(r) for r in rows)
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in palette:
                img[y, x, :3] = palette[ch]
                img[y, x, 3] = (alpha or {}).get(ch, 255)
    return img


def shade_mask(mask, w, h, bias):
    """Heat of a shape: hotter the deeper inside it (distance to the edge), plus bias(x, y)."""
    depth = {}
    frontier = [(x, y) for y in range(h) for x in range(w) if mask(x, y) and any(
        not mask(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for p in frontier:
        depth[p] = 1
    level = 1
    while frontier:
        nxt = []
        for x, y in frontier:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if 0 <= q[0] < w and 0 <= q[1] < h and mask(*q) and q not in depth:
                    depth[q] = level + 1
                    nxt.append(q)
        frontier = nxt
        level += 1
    top = max(depth.values()) if depth else 1
    return lambda x, y: (depth.get((x, y), 0) / top + bias(x, y)) if (x, y) in depth else -1


# ---------------------------------------------------------------------------
# Souls
# ---------------------------------------------------------------------------

def soul_frame(frame):
    """16x16 soul fire: round base, swaying tongue, white core -> teal -> dark rim."""
    sway = (0.0, 1.2, 0.3, -1.0)[frame]

    def inside(x, y):
        if not (0 <= x < 16 and 0 <= y < 16):
            return False
        px, py = x + 0.5, y + 0.5
        if math.hypot(px - 8, py - 11.2) <= 4.3:
            return True
        if 1.5 <= py <= 11.2:
            t = (11.2 - py) / 9.7
            center = 8 + sway * t * t * 2
            return abs(px - center) <= 4.3 * (1 - t) ** 0.8 and hash01(x, y, 60 + frame) > 0.12 * t
        return False

    heat = shade_mask(inside, 16, 16, lambda x, y: 0.3 * (y / 15) - 0.1)
    return to_rgba(grid(16, 16, lambda x, y: soul_char(0.12 + 0.72 * heat(x, y)) if heat(x, y) >= 0 else "."), SOUL)


def wraith_frame(frame):
    """16x16 harvested soul: a wailing ghost face with a swaying tail."""
    sway = (0, 1, 0, -1)[frame]

    def pixel(x, y):
        px, py = x + 0.5 - 8, y + 0.5
        head = math.hypot(px, py - 6) <= 4.4
        tail = 9 <= py <= 15.5 and abs(px - sway * (py - 9) / 3) <= 3.4 * (1 - (py - 9) / 7)
        if not (head or tail):
            return "."
        if head and (abs(px + 1.8) < 0.8 or abs(px - 1.8) < 0.8) and 5 <= py <= 6.6:
            return "K"
        if head and abs(px) < 1.2 and 7.6 <= py <= 9 + frame % 2:
            return "K"
        if head and math.hypot(px, py - 6) > 3.4:
            return "T"
        if tail:
            return "B" if py > 12.5 else "T" if abs(px - sway * (py - 9) / 3) > 1.6 else "L"
        return "W" if py < 4.5 and px < 0 else "L"

    return to_rgba(grid(16, 16, pixel), {**SOUL, "K": (0, 0, 0)}, {"K": 0})


# ---------------------------------------------------------------------------
# Gas, smoke, liquid (grayscale, tinted in JSON)
# ---------------------------------------------------------------------------

def smoke_frame(frame):
    """16x16 puff: expands, then breaks apart (like the Aatrox / Toji smoke)."""
    radius, holes = ((3.6, 0.0), (5.0, 0.08), (6.2, 0.3), (7.0, 0.58))[frame]
    blobs = ((8, 9, 1.0), (5.5, 7, 0.75), (10.5, 6.5, 0.7), (8, 5, 0.6))

    def pixel(x, y):
        best = min(math.hypot(x + 0.5 - bx, y + 0.5 - by) / (radius * s) for bx, by, s in blobs)
        if best > 1 or hash01(x, y, 70 + frame) < holes:
            return "."
        if best > 0.82:
            return "C"
        light = (x - 8) + (y - 8)  # lit top-left, shaded bottom-right
        return "H" if light < -5 and best < 0.6 else "B" if light > 4 else "A"

    return to_rgba(grid(16, 16, pixel), SMOKE)


SPLAT = ["................", "..W.......W.....", "...W..WW...W....", "....WWWWW.......",
         "..WWWWWWWWW..W..", ".WWWWWLWWWWW....", "..WWWLLLWWWWW...", "WWWWWLLLLWWW....",
         "..WWWWLLWWWWWW..", "...WWWWWWWWW....", "..W.WWWWWWW.....", ".....WW..WW.W...",
         "...W........W...", "..........W.....", "................", "................"]


def splash_frame(frame):
    """16x16 splat (Giant Zombie style) that dries up into droplets."""
    holes = (0.0, 0.25, 0.55, 0.8)[frame]
    rows = ["".join("." if ch != "." and hash01(x, y, 90 + frame) < holes else ch for x, ch in enumerate(row))
            for y, row in enumerate(SPLAT)]
    return to_rgba(rows, {"W": (255, 255, 255), "L": (200, 200, 200)})


DROP = ["........", "...#....", "...#....", "..#+#...", "..#++...", "..++-...", "...--...", "........"]


def drop_sprite():
    return to_rgba(DROP, GRAY)


# ---------------------------------------------------------------------------
# Slashes, rings, ground marks
# ---------------------------------------------------------------------------

def slash_frame(frame):
    """32x32 soul crescent: white edge, teal body, dark trailing rim; flares then breaks into sparks."""
    c1, r1 = (16.0, 17.0), 14.5
    c2, r2 = (20.5, 12.5), 12.5
    fade = (1.0, 1.0, 0.8, 0.55)[frame]
    holes = (0.0, 0.0, 0.22, 0.6)[frame]

    def pixel(x, y):
        px, py = x + 0.5, y + 0.5
        d1 = math.hypot(px - c1[0], py - c1[1])
        d2 = math.hypot(px - c2[0], py - c2[1])
        if d1 > r1 or d2 < r2:
            return "."
        outer, inner = r1 - d1, d2 - r2
        heat = (1 - 0.95 * outer / (outer + inner + 1e-6)) * fade
        angle = math.atan2(py - c1[1], px - c1[0])
        sweep = ((angle - 0.3) % (2 * math.pi)) / (2 * math.pi)
        if frame == 0 and sweep > 0.55:
            return "."
        if frame == 0:
            heat *= 0.7 + 0.3 * (sweep / 0.55)
        if hash01(x, y, frame) < holes:
            return "."
        return soul_char(heat)

    return to_rgba(grid(32, 32, pixel), SOUL)


def ring_sprite():
    """32x32 warning ring (Giant Zombie style): bright outer ring, faint inner ring."""
    def pixel(x, y):
        d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
        if 14 <= d < 15.6:
            return "#"
        if 11.6 <= d < 12.6:
            return "-"
        return "."
    return to_rgba(grid(32, 32, pixel), GRAY)


def wave_frame(frame):
    """32x32 shockwave: thick and bright, thinning out, then shattering."""
    radius, thick, heat_max, holes = ((10.5, 4.5, 1.0, 0.0), (13.0, 3.0, 0.8, 0.12), (14.5, 2.0, 0.55, 0.45))[frame]

    def pixel(x, y):
        d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
        off = abs(d - radius)
        if off > thick / 2:
            if frame and radius + thick / 2 < d < radius + thick / 2 + 2 and hash01(x, y, 40 + frame) < 0.06:
                return "-"
            return "."
        if hash01(x, y, 20 + frame) < holes:
            return "."
        return gray_char(heat_max * (1 - 0.7 * off / (thick / 2)))

    return to_rgba(grid(32, 32, pixel), GRAY)


def rune_circle_sprite():
    """64x64 plague circle: notched outer ring, gray inner ring, 8 spokes, crescent marks, centre sigil."""
    def pixel(x, y):
        px, py = x + 0.5 - 32, y + 0.5 - 32
        d = math.hypot(px, py)
        a = math.atan2(py, px) % (2 * math.pi)
        seg = (a / (2 * math.pi) * 8) % 1
        if 29.5 <= d < 31.5:
            return "." if abs(seg - 0.5) < 0.04 else "#"
        if 27 <= d < 28 and abs(seg - 0.5) < 0.12:
            return "#"
        if 20 <= d < 21.2:
            return "+"
        if 21.2 <= d < 27 and seg < 0.03:
            return "-"
        # three-dot plague marks between the rings
        mark = 24.2
        for k in range(8):
            ca = (k + 0.5) / 8 * 2 * math.pi
            cx, cy = math.cos(ca) * mark, math.sin(ca) * mark
            if math.hypot(px - cx, py - cy) < 1.3:
                return "#"
        # inner hexagram-ish star made of spokes
        if d < 20 and seg < 0.025:
            return "-"
        if 6 <= d < 7.2:
            return "+"
        if d < 2.5:
            return "#"
        return "."

    return to_rgba(grid(64, 64, pixel), GRAY)


RUNE_TILE = [
    "################",
    "#++++++++++++++#",
    "#+-..........-+#",
    "#+.....##.....+#",
    "#+....#++#....+#",
    "#+...#+--+#...+#",
    "#+..#+-..-+#..+#",
    "#+.#+-....-+#.+#",
    "#+.#+-....-+#.+#",
    "#+..#+-..-+#..+#",
    "#+...#+--+#...+#",
    "#+....#++#....+#",
    "#+.....##.....+#",
    "#+-..........-+#",
    "#++++++++++++++#",
    "################",
]


def tile_sprite():
    """16x16 ground warning tile, like the Aatrox rune tiles (grayscale, tinted)."""
    return to_rgba(RUNE_TILE, GRAY)


SPARK_FRAMES = [
    ["................", "................", ".......#........", ".......#........",
     ".......#........", "......+#+.......", ".......#........", "..###########...",
     ".......#........", "......+#+.......", ".......#........", ".......#........",
     ".......#........", "................", "................", "................"],
    ["................", "................", "................", "................",
     "................", ".......#........", "......+#+.......", "....#######.....",
     "......+#+.......", ".......#........", "................", "................",
     "................", "................", "................", "................"],
    ["................", "................", "................", "................",
     "................", "................", ".......+........", "......+#+.......",
     ".......+........", "................", "................", "................",
     "................", "................", "................", "................"],
]


def spark_frame(frame):
    return to_rgba(SPARK_FRAMES[frame], GRAY)


# ---------------------------------------------------------------------------
# Reaper props
# ---------------------------------------------------------------------------

SKULL = ["................", "....LWWWWWL.....", "...WWWWWWWWW....", "..LWWWWWWWWWL...",
         "..WWWWWWWWWWW...", "..WKKWWWWKKWW...", "..WKTKWWWKTKW...", "..WKKWWWWWKKW...",
         "..LWWWWKWWWWL...", "...WWWKKKWWW....", "...LWWWWWWWL....", "....WKWKWKW.....",
         "....WWWWWWW.....", ".....MMMMM......", "................", "................"]


def skull_sprite():
    return to_rgba(SKULL, BONE)


def scythe_sprite():
    """32x32 spectral scythe: dark teal snath, crescent blade with a white edge."""
    c1, r1 = (18.0, 17.5), 14.0
    c2, r2 = (19.0, 21.5), 13.0

    def pixel(x, y):
        px, py = x + 0.5, y + 0.5
        # blade: crescent in the top half, sweeping to the left
        d1 = math.hypot(px - c1[0], py - c1[1])
        d2 = math.hypot(px - c2[0], py - c2[1])
        if d1 <= r1 and d2 > r2 and py < 14 and 2 < px < 25:
            outer, inner = r1 - d1, d2 - r2
            return soul_char(1 - 0.9 * outer / (outer + inner + 1e-6))
        # snath: from the blade's heel down to the bottom left
        t = (py - 3) / 27
        if 0 <= t <= 1:
            cx = 24.5 - t * 17
            if abs(px - cx) <= 1.0:
                return "B" if px < cx else "D"
            if abs(py - 11) < 0.6 and abs(px - (24.5 - (11 - 3) / 27 * 17)) <= 2.5:
                return "T"  # grip
            if abs(py - 21) < 0.6 and abs(px - (24.5 - (21 - 3) / 27 * 17)) <= 2.5:
                return "T"
        return "."

    return to_rgba(grid(32, 32, pixel), SOUL)


# ---------------------------------------------------------------------------
# Crows and feathers
# ---------------------------------------------------------------------------

CROW_FRAMES = [
    ["................", "..K..........K..", "..KK........KK..", "...KV......VK...",
     "...KVV....VVK...", "....KVDKKDVK....", ".....KDKKDK.....", "......KYYK......",
     "......KDDK......", ".......DD.......", "......KDDK......", ".....K.KK.K.....",
     "................", "................", "................", "................"],
    ["................", "................", "................", "................",
     "................", "KKVVV..KK..VVVKK", ".KKDDVKKKKVDDKK.", "..KKDDKYYKDDKK..",
     "......KDDK......", ".......DD.......", "......KDDK......", ".....K.KK.K.....",
     "................", "................", "................", "................"],
    ["................", "................", "................", "................",
     "................", ".......KK.......", "......KYYK......", ".....KDKKDK.....",
     "....KDVKKVDK....", "...KDV.DD.VDK...", "..KDV.KDDK.VDK..", "..KK..K..K..KK..",
     ".K............K.", "................", "................", "................"],
]


def crow_frame(frame):
    return to_rgba(CROW_FRAMES[[0, 1, 2, 1][frame]], CROW)


FEATHER = ["......VK", ".....VDK", "....VDK.", "...VDK..", "..VDK...", ".VDK....", "GK......", "G......."]


def feather_sprite():
    return to_rgba(FEATHER, CROW)


# ---------------------------------------------------------------------------
# Plague doctor props
# ---------------------------------------------------------------------------

FLASK = ["................", "......KK........", "......LM........", ".....BWWB.......",
         ".....B..B.......", "....B....B......", "...B......B.....", "..BWYYGGGGMB....",
         "..BYYGGGGGMB....", "..BWGGGGGMMB....", "..BGGGGGMMMB....", "...BGGMMMMB.....",
         "....BMMMMB......", ".....BBBB.......", "................", "................"]


def flask_sprite():
    pal = {**PLAGUE, "B": GLASS["B"], "K": WOOD["K"], "L": WOOD["L"]}
    pal["M"] = PLAGUE["M"]
    pal["W"] = GLASS["W"]
    return to_rgba(FLASK, pal)


SHARDS = [
    ["...W....", "..WLL...", ".WLLBB..", "WLLBBBD.", ".LBBBD..", "..BBD...", "...D....", "........"],
    ["........", ".WW.....", ".WLLL...", "..LLBB..", "...BBBD.", "....BDD.", ".....D..", "........"],
    ["........", "........", "..W.....", "...L....", "....B...", ".....D..", "........", "........"],
]


def shard_frame(frame):
    return to_rgba(SHARDS[frame], GLASS)


DEBRIS = [
    ["........", "..KSS...", ".KSLLS..", ".KSSLSK.", ".KKSSSK.", "..KKKK..", "........", "........"],
    ["........", "........", "...SL...", "..KSSS..", "..KKSK..", "...KK...", "........", "........"],
    ["........", ".KSS....", ".KSRS...", ".KSSSK..", "..KKK...", "........", "........", "........"],
]


def dirt_frame(frame):
    return to_rgba(DEBRIS[frame], EARTH)


HOURGLASS = [
    "..KMMMMMMMMMMK..",
    "..KLLLLLLLLLLK..",
    "...G........G...",
    "...GTTTTTTTTG...",
    "....GTTTTTTG....",
    ".....GTTTTG.....",
    "......GTTG......",
    ".......GG.......",
    ".......GG.......",
    "......GBBG......",
    ".....GBBBBG.....",
    "....GBBBBBBG....",
    "...GBBBBBBBBG...",
    "...GBBBBBBBBG...",
    "..KLLLLLLLLLLK..",
    "..KMMMMMMMMMMK..",
]


def hourglass_frame(frame, frames=8):
    """16x16 hourglass; frame 0 = full top chamber, last frame = all sand at the bottom."""
    p = frame / (frames - 1)
    top = sorted(((x, y) for y, r in enumerate(HOURGLASS) for x, c in enumerate(r) if c == "T"), key=lambda c: c[1])
    bottom = sorted(((x, y) for y, r in enumerate(HOURGLASS) for x, c in enumerate(r) if c == "B"), key=lambda c: -c[1])
    gone = set(top[:round(len(top) * p)])            # the top chamber empties from the top down
    fill = set(bottom[:round(len(bottom) * p)])      # the bottom chamber fills from the floor up
    rows = []
    for y, row in enumerate(HOURGLASS):
        out = []
        for x, c in enumerate(row):
            if c == "T":
                out.append("." if (x, y) in gone else ("W" if y == max(yy for xx, yy in top if (xx, yy) not in gone) else "S"))
            elif c == "B":
                out.append("S" if (x, y) in fill else ".")
            else:
                out.append(c)
        rows.append("".join(out))
    if 0 < p < 1:
        rows[7] = rows[7][:7] + "W" + rows[7][8:]
        rows[8] = rows[8][:8] + "S" + rows[8][9:]
    pal = {**WOOD, "G": GLASS["L"], "S": SOUL["T"], "W": SOUL["L"]}
    return to_rgba(rows, pal)


LANTERN = [
    "......KKKK......", ".....K....K.....", "......KKKK......", "....KMMMMMMK....",
    "....KKKKKKKK....", "....KD....DK....", "....KD.{}.DK....", "....KD{}DK....",
    "....KD{}DK....", "....KD.{}.DK....", "....KD....DK....", "....KKKKKKKK....",
    "....KMMMMMMK....", "................", "................", "................",
]


def lantern_frame(frame):
    flame = [("LW", "TLLT", "TWWT", "BT"), ("WL", "TLWT", "TLLT", "TB")][frame]
    rows = []
    for y, row in enumerate(LANTERN):
        if "{}" in row:
            part = flame[[6, 7, 8, 9].index(y)]
            row = row.replace("{}", part)
        rows.append(row)
    pal = {"K": (30, 30, 38), "M": (70, 70, 84), "D": (22, 60, 56), **{k: SOUL[k] for k in "WLTB"}}
    return to_rgba(rows, pal)


MASK_ICON = [
    "....KKKKKK......", "....KDDDDK......", "..KKKKKKKKKK....", "....MMMMMM......",
    "...MLMMMMMM.....", "...MYYMMMMLLL...", "...MYYMMMLLLLL..", "....MMMMMLLLLLL.",
    ".....MMMM...LLL.", "................",
]


def plague_pips_frame(stacks):
    """16x16: plague doctor mask + 5 slots, `stacks` of them lit."""
    rows = [r for r in MASK_ICON] + ["................"] * 2
    pips = ""
    for i in range(5):
        pips += ("PP" if i < stacks else "ee") + "."
    rows += ["." + pips, "." + pips, "................", "................"]
    pal = {**LEATHER, "Y": PLAGUE["Y"], "P": PLAGUE["Y"], "e": (38, 38, 44)}
    return to_rgba(rows, pal, {"e": 200})


GRAVE = ["................", ".....LLLLL......", "....LLLMMMM.....", "...LLLMMMMMD....",
         "...LLMMKMMMD....", "...LMMMKMMMD....", "...LMKKKKKMD....", "...LMMMKMMMD....",
         "...LMMMKMMMD....", "...LMMMMMMMD....", "...LMMMMMMDD....", "...MMMMMMMDD....",
         ".RRSRRMRRSRRR...", "SSSKSSSSKSSSSK..", ".KKSKKKKSKKK....", "................"]


def grave_sprite():
    return to_rgba(GRAVE, {**STONE, "R": EARTH["R"], "S": EARTH["S"]})


CHAIN = ["........", "..TTLL..", ".T....L.", ".B....L.", ".B....T.", "..BBTT..", "........", "........"]


def chain_sprite():
    return to_rgba(CHAIN, SOUL)


def beak_sprite():
    """32x32 plague doctor mask sigil (phase change / death)."""
    def pixel(x, y):
        px, py = x + 0.5, y + 0.5
        if 1 <= py < 6 and 8 <= px < 20:
            return "K" if py < 5 else "D"               # hat crown
        if 6 <= py < 8 and 2 <= px < 27:
            return "K"                                   # brim
        head = math.hypot((px - 13) / 8, (py - 15) / 7.5) <= 1
        t = (px - 15) / 16
        beak = False
        if 0 <= t <= 1:
            cy = 17 + t * 8 + t * t * 3
            beak = abs(py - cy) <= 4.6 * (1 - t) + 0.5
        lens = math.hypot(px - 11, py - 14) <= 3
        if lens:
            return "W" if math.hypot(px - 10.2, py - 13.2) < 1.1 else "Y" if math.hypot(px - 11, py - 14) < 2.2 else "K"
        if head:
            return "L" if px + py < 22 else "M" if px + py < 34 else "D"
        if beak:
            return "L" if py < 17 + t * 8 + t * t * 3 - 1.5 else "M" if py < 17 + t * 8 + t * t * 3 + 1 else "D"
        return "."

    return to_rgba(grid(32, 32, pixel), {**LEATHER, "Y": PLAGUE["Y"], "W": PLAGUE["W"]})


SPRITES = {
    "soul": [soul_frame(f) for f in range(4)],
    "wraith": [wraith_frame(f) for f in range(4)],
    "miasma": [smoke_frame(f) for f in range(4)],
    "splash": [splash_frame(f) for f in range(4)],
    "slash": [slash_frame(f) for f in range(4)],
    "ring": [ring_sprite()],
    "wave": [wave_frame(f) for f in range(3)],
    "rune_circle": [rune_circle_sprite()],
    "tile": [tile_sprite()],
    "spark": [spark_frame(f) for f in range(3)],
    "drop": [drop_sprite()],
    "skull": [skull_sprite()],
    "scythe": [scythe_sprite()],
    "crow": [crow_frame(f) for f in range(4)],
    "feather": [feather_sprite()],
    "flask": [flask_sprite()],
    "shard": [shard_frame(f) for f in range(3)],
    "dirt": [dirt_frame(f) for f in range(3)],
    "hourglass": [hourglass_frame(f) for f in range(8)],
    "lantern": [lantern_frame(f) for f in range(2)],
    "pips": [plague_pips_frame(n) for n in range(1, 6)],
    "grave": [grave_sprite()],
    "chain": [chain_sprite()],
    "beak": [beak_sprite()],
}
