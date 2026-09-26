"""Ice particles for the Yeti boss: pixel art texture atlas + resource pack JSON files.

Same approach as bedrock/particles.py (The Darkin Blade): hard-edged pixels, a limited palette,
multi-frame flipbooks stretched over the particle lifetime. The palette is ice instead of fire:
white -> pale cyan -> aqua -> blue -> deep blue -> navy outline.

Ground decals used as telegraphs (warning circle, fill, tiles, summon rune) are drawn in
grayscale and colored by tinting, so one sprite serves several colors.

Variables the script passes through MolangVariableMap:
- v.radius   size of rings, decals, vortex, blizzard area (blocks)
- v.life     lifetime of telegraphs / portals (seconds), so the warning ends exactly on impact
- v.yaw      rotation of a ground tile (degrees), lined up with a charge path / spike lane
- v.dir_x/y/z, v.speed   direction and speed of breath / thrown shards
- v.spin     rotation of a rolling snowball / flying boulder (degrees)
- v.variant  ground type of a boulder and its debris: 0 snow, 1 ice, 2 stone, 3 dirt
"""
import json
import math
import os

ATLAS = 256
TEXTURE = "textures/particle/yeti_particles"
NAMESPACE = "yeti"

ICE = {
    "W": (250, 254, 255),
    "C": (196, 238, 255),
    "A": (128, 206, 248),
    "B": (72, 148, 226),
    "D": (38, 84, 172),
    "N": (22, 40, 98),
}
GRAY = {"#": (255, 255, 255), "+": (190, 190, 190), "-": (128, 128, 128)}
SNOW = {"W": (250, 252, 255), "S": (214, 228, 240), "G": (160, 182, 206), "D": (104, 126, 158)}
HEAL = {"W": (240, 255, 250), "M": (150, 255, 214), "T": (60, 210, 190)}


def hash01(x, y, salt=0):
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def ice_char(heat):
    """Brightness -> ice color, hard edges like pixel art."""
    for limit, char in ((0.84, "W"), (0.66, "C"), (0.46, "A"), (0.28, "B"), (0.12, "D")):
        if heat > limit:
            return char
    return "."


def grid(w, h, fn):
    return ["".join(fn(x, y) for x in range(w)) for y in range(h)]


def blank(w, h):
    return [["."] * w for _ in range(h)]


def rows(canvas):
    return ["".join(r) for r in canvas]


def plot(canvas, x, y, ch):
    if 0 <= y < len(canvas) and 0 <= x < len(canvas[0]):
        canvas[y][x] = ch


def line(canvas, x0, y0, x1, y1, ch):
    x0, y0, x1, y1 = round(x0), round(y0), round(x1), round(y1)
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        plot(canvas, x0, y0, ch)
        if x0 == x1 and y0 == y1:
            return
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


# ---------------------------------------------------------------------------
# Sprites
# ---------------------------------------------------------------------------


def ring_frame(frame):
    """32x32 frost shockwave: a thick bright ring with crystal teeth, thinning out, then shattering."""
    radius, thick, bright, holes = ((10.5, 5.0, 1.0, 0.0), (13.0, 3.2, 0.85, 0.1), (14.5, 2.0, 0.6, 0.45))[frame]

    def pixel(x, y):
        px, py = x + 0.5 - 16, y + 0.5 - 16
        d = math.hypot(px, py)
        angle = math.degrees(math.atan2(py, px)) % 360
        tooth = max(0.0, 1 - (angle % 30) / 6) if frame < 2 else 0  # crystal tooth every 30 degrees
        outer = radius + thick / 2 + tooth * (3 - frame)
        if d > outer or d < radius - thick / 2:
            if frame and outer < d < outer + 2 and hash01(x, y, 70 + frame) < 0.07:
                return "B"
            return "."
        if hash01(x, y, 50 + frame) < holes:
            return "."
        edge = 1 - abs(d - radius) / (thick / 2 + tooth * 3 + 1e-6)
        return ice_char(bright * (0.35 + 0.65 * max(0.0, edge)))

    return grid(32, 32, pixel)


def ground_crack():
    """32x32 cracked ice: branching navy cracks with glowing cyan light inside."""
    c = blank(32, 32)
    for branch in range(7):
        angle = branch * (2 * math.pi / 7) + hash01(branch, 1, 9) * 0.6
        x, y, length = 16.0, 16.0, 10 + hash01(branch, 2, 9) * 6
        for step in range(int(length)):
            angle += (hash01(branch, step, 11) - 0.5) * 0.7
            nx, ny = x + math.cos(angle), y + math.sin(angle)
            line(c, x, y, nx, ny, "N")
            if step < length * 0.6 and hash01(branch, step, 12) < 0.55:
                plot(c, round(nx), round(ny) - 1, "A")
            if step == int(length * 0.5):
                side = angle + (0.9 if hash01(branch, 3, 13) < 0.5 else -0.9)
                sx, sy = nx, ny
                for s in range(4):
                    tx, ty = sx + math.cos(side), sy + math.sin(side)
                    line(c, sx, sy, tx, ty, "D")
                    sx, sy = tx, ty
            x, y = nx, ny
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if dx * dx + dy * dy <= 4:
                plot(c, 16 + dx, 16 + dy, "W" if dx * dx + dy * dy <= 1 else "C")
    return rows(c)


def frost_field():
    """32x32 frozen ground patch: frost crystals, dense in the middle, sparse at the rim."""
    def pixel(x, y):
        d = math.hypot(x + 0.5 - 16, y + 0.5 - 16) / 16
        if d > 1:
            return "."
        n = hash01(x, y, 21)
        if n > 0.35 + d * 0.55:
            return "C" if hash01(x, y, 22) < 0.35 else ("A" if hash01(x, y, 23) < 0.6 else "B")
        if 0.92 < d <= 1 and hash01(x, y, 24) < 0.5:
            return "W"
        return "."

    return grid(32, 32, pixel)


def warn_circle():
    """32x32 telegraph circle (grayscale, tinted in game): solid rim, dashed inner ring, 4 ticks."""
    def pixel(x, y):
        px, py = x + 0.5 - 16, y + 0.5 - 16
        d = math.hypot(px, py)
        angle = math.degrees(math.atan2(py, px)) % 360
        if 14.3 <= d <= 16:
            return "#"
        if 12.2 <= d <= 13.2 and (angle % 20) < 11:
            return "+"
        if d < 14.3 and any(abs(((angle - a + 180) % 360) - 180) < 4 for a in (0, 90, 180, 270)) and d > 10:
            return "#"
        return "."

    return grid(32, 32, pixel)


def warn_fill():
    """32x32 filled disc with a checker dither; grows under the telegraph circle until impact."""
    def pixel(x, y):
        d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
        if d > 16:
            return "."
        if d > 14.8:
            return "#"
        return "+" if (x + y) % 2 == 0 else "-"

    return grid(32, 32, pixel)


def rune_circle():
    """32x32 frost summoning circle: double ring, hexagram and six crystal dots (grayscale)."""
    c = blank(32, 32)
    for y in range(32):
        for x in range(32):
            d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
            if 14.6 <= d <= 16:
                c[y][x] = "#"
            elif 11 <= d <= 11.9:
                c[y][x] = "+"
    points = [(16 + 11 * math.cos(math.radians(a - 90)), 16 + 11 * math.sin(math.radians(a - 90))) for a in range(0, 360, 60)]
    for i in range(6):
        ax, ay = points[i]
        bx, by = points[(i + 2) % 6]
        line(c, ax - 0.5, ay - 0.5, bx - 0.5, by - 0.5, "#")
    for a in range(30, 390, 60):
        x = 16 + 13.3 * math.cos(math.radians(a - 90))
        y = 16 + 13.3 * math.sin(math.radians(a - 90))
        for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0), (0, -1)):
            plot(c, round(x - 0.5) + dx, round(y - 0.5) + dy, "#" if (dx, dy) == (0, 0) else "+")
    for dy in range(-2, 2):
        for dx in range(-2, 2):
            plot(c, 16 + dx, 16 + dy, "#")
    return rows(c)


def mist_frame(frame):
    """16x16 frost mist puff: dense and round, spreading and breaking into wisps."""
    radius = (4.5, 5.8, 6.8, 7.4)[frame]
    holes = (0.05, 0.2, 0.42, 0.66)[frame]

    def pixel(x, y):
        d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
        wobble = (hash01(x // 2, y // 2, 30) - 0.5) * 1.6
        if d > radius + wobble or hash01(x, y, 31 + frame) < holes:
            return "."
        shade = 1 - d / (radius + 1)
        return "W" if shade > 0.55 else ("S" if shade > 0.25 else "G")

    return grid(16, 16, pixel)


def flash_frame(frame):
    """16x16 ice star: 4 long points + 4 short diagonal points, thinning out."""
    reach, width = ((7.5, 1.6), (6.5, 1.1), (4.5, 0.7))[frame]

    def pixel(x, y):
        px, py = x + 0.5 - 8, y + 0.5 - 8
        ax, ay = abs(px), abs(py)
        main = max(0.0, 1 - min(ax / (width * (1 - ay / reach) + 0.35) if ay < reach else 9,
                                ay / (width * (1 - ax / reach) + 0.35) if ax < reach else 9))
        diag = 0.0
        if frame < 2:
            u, v = (px + py) / 1.414, (px - py) / 1.414
            for a, b in ((u, v), (v, u)):
                if abs(a) < reach * 0.55:
                    diag = max(diag, 1 - abs(b) / (0.6 * (1 - abs(a) / (reach * 0.55)) + 0.3))
        core = max(0.0, 1 - math.hypot(px, py) / (2.8 - frame * 0.7))
        heat = max(main, diag * 0.7, core)
        return ice_char(heat * (1.0, 0.9, 0.75)[frame]) if heat > 0.15 else "."

    return grid(16, 16, pixel)


def orb_frame(frame):
    """16x16 frost orb: faceted sphere lit from the top left, glowing core; 2 frames pulse."""
    radius = (6.5, 6.0)[frame]

    def pixel(x, y):
        px, py = x + 0.5 - 8, y + 0.5 - 8
        d = math.hypot(px, py)
        if d > radius:
            return "."
        if d > radius - 1.1:
            return "D" if px + py > 0 else "B"
        light = 1 - math.hypot(px + 2.2, py + 2.2) / (radius * 1.6)
        facet = 0.12 if (int((math.degrees(math.atan2(py, px)) + 360) // 60) % 2) else 0
        return ice_char(0.35 + light * 0.75 + facet + frame * 0.08)

    return grid(16, 16, pixel)


FROZEN_ICON = [
    ".......NN.......",
    "......NCCN......",
    ".....NCWWCN.....",
    "....NCA..ACN....",
    "...NCA.WW.ACN...",
    "..NCA.W..W.ACN..",
    ".NCA.W.CC.W.ACN.",
    "NCW.WWCWWCWW.WCN",
    "NCW.WWCWWCWW.WCN",
    ".NCA.W.CC.W.ACN.",
    "..NCA.W..W.ACN..",
    "...NCA.WW.ACN...",
    "....NCA..ACN....",
    ".....NCWWCN.....",
    "......NCCN......",
    ".......NN.......",
]

SHARDS = [
    ["........", "......W.", ".....WC.", "....WCA.", "...CAB..", "..CAB...", ".ABD....", ".D......"],
    ["........", "...W....", "..WCA...", "..CAB...", "..CAB...", "..ABD...", "...BD...", "...D...."],
    ["........", "........", ".W......", ".CCA....", "..CAAB..", "...ABBD.", ".....DD.", "........"],
]

SNOWFLAKES = [
    ["...W....", ".W.W.W..", "..WCW...", "WWCACWW.", "..WCW...", ".W.W.W..", "...W....", "........"],
    ["........", "..W.W...", "...C....", ".WCACW..", "...C....", "..W.W...", "........", "........"],
]

TILE = ["...##...", "..#++#..", ".#+--+#.", "#+-##-+#", "#+-##-+#", ".#+--+#.", "..#++#..", "...##..."]
CHAIN = ["..BAAB..", ".BC..CB.", "BC....CB", "A......A", "A......A", "BC....CB", ".BC..CB.", "..BAAB.."]
HEAL_FRAMES = [
    ["...W....", "...M....", "...T....", "WMTWTMW.", "...T....", "...M....", "...W....", "........"],
    ["........", "........", "...M....", "..MWM...", "...M....", "........", "........", "........"],
]
DUST = [
    ["........", "........", "...WS...", "..WSSG..", "..SSGD..", "...GD...", "........", "........"],
    ["........", "........", "........", "...WS...", "...SG...", "........", "........", "........"],
    ["........", "..W.....", ".WSS....", "..SGG...", "...GD.S.", "......G.", "........", "........"],
]
GLYPHS = [
    ["........", ".######.", "....#...", "..#.#.#.", "...###..", "....#...", "...#.#..", "........"],
    ["........", "...#....", "..###...", ".#.#.#..", "...#....", ".#####..", "...#....", "........"],
    ["........", ".#...#..", "..#.#...", "...#....", "..#.#...", ".#...#..", ".#####..", "........"],
    ["........", "..###...", ".#...#..", ".#.#.#..", ".#...#..", "..###...", "...#....", "........"],
]
SPARKLES = [
    ["...W....", "...C....", "...C....", "WCCWCCW.", "...C....", "...C....", "...W....", "........"],
    ["........", ".A...A..", "..C.C...", "...W....", "..C.C...", ".A...A..", "........", "........"],
]
SPARK = ["W", "W", "C", "C", "A", "A", "B", "D"]


def pillar():
    """8x32 vertical frost beam: white core, aqua edges, fading to the top."""
    def pixel(x, y):
        edge = abs(x + 0.5 - 4) / 4
        top = y / 31
        heat = (1 - edge ** 1.5) * (0.25 + 0.75 * top)
        if hash01(x, y, 80) < 0.18 * (1 - top):
            return "."
        return ice_char(heat)

    return grid(8, 32, pixel)


def icicle():
    """8x16 falling icicle: wide at the top, sharp tip at the bottom, lit on the left."""
    def pixel(x, y):
        half = 3.6 * (1 - y / 15) ** 0.8
        px = x + 0.5 - 4
        if abs(px) > half:
            return "."
        if abs(px) > half - 0.9:
            return "D" if px > 0 else "B"
        return ice_char(0.95 - (px + half) / (2 * half + 1e-6) * 0.5 - y / 15 * 0.2)

    return grid(8, 16, pixel)


def crystal():
    """8x16 hexagonal crystal floating in the air: pointed ends, bright left facet."""
    def pixel(x, y):
        px = x + 0.5 - 4
        yy = y + 0.5
        half = min(3.5, yy * 0.9, (16 - yy) * 0.9)
        if abs(px) > half:
            return "."
        if abs(px) > half - 0.9:
            return "N" if px > 0 else "B"
        if px < -0.5:
            return "W" if yy < 9 else "C"
        return "A" if px < 1 else "B"

    return grid(8, 16, pixel)


def snowball():
    """16x16 giant snowball: packed snow lit from the top left, darker chunks, blue shadow at the rim."""
    def pixel(x, y):
        px, py = x + 0.5 - 8, y + 0.5 - 8
        d = math.hypot(px, py)
        if d > 7.6:
            return "."
        if d > 6.7:
            return "D" if px + py > 1 else "G"
        light = 1 - math.hypot(px + 3, py + 3) / 12.5 + (hash01(x // 2, y // 2, 140) - 0.5) * 0.3
        return "W" if light > 0.55 else ("S" if light > 0.3 else "G")

    return grid(16, 16, pixel)


BOULDER_PALETTES = {
    # O outline, D dark, M mid, L light, H highlight, T top cap (snow / grass)
    "snow": {"O": (70, 92, 128), "D": (150, 172, 200), "M": (200, 216, 234), "L": (232, 240, 250), "H": (255, 255, 255), "T": (255, 255, 255)},
    "ice": {"O": (22, 50, 104), "D": (58, 112, 184), "M": (98, 164, 226), "L": (150, 210, 246), "H": (226, 248, 255), "T": (200, 240, 255)},
    "stone": {"O": (38, 38, 44), "D": (78, 78, 86), "M": (112, 112, 120), "L": (146, 146, 154), "H": (182, 182, 190), "T": (232, 238, 246)},
    "dirt": {"O": (44, 28, 16), "D": (88, 58, 34), "M": (118, 82, 50), "L": (146, 106, 68), "H": (170, 128, 86), "T": (96, 160, 64)},
}
BOULDER_ORDER = ["snow", "ice", "stone", "dirt"]  # v.variant 0..3
AURORA = {"G": (110, 255, 180), "C": (100, 225, 255), "V": (170, 140, 255), "W": (225, 255, 240)}


def boulder():
    """24x24 chunk of ground ripped out by the Yeti: lumpy outline, lit top left, cracks, a cap of snow / grass."""
    def pixel(x, y):
        px, py = x + 0.5 - 12, y + 0.5 - 12.5
        angle = math.atan2(py, px)
        lump = 9.6 + 1.3 * math.sin(angle * 3 + 0.7) + 0.8 * math.sin(angle * 5 + 2.1)
        d = math.hypot(px, py * 1.08)
        if d > lump:
            return "."
        if d > lump - 1.1:
            return "O"
        if py < -lump * 0.45 + math.sin(px * 0.9) * 1.2:
            return "T" if hash01(x, y, 170) > 0.15 else "L"
        light = 1 - math.hypot(px + 4, py + 4) / 17 + (hash01(x // 2, y // 2, 171) - 0.5) * 0.3
        if abs((px * 0.8 + py) - 3) < 0.6 and d < lump - 3:
            return "D"                                           # crack across the rock
        return "H" if light > 0.72 else ("L" if light > 0.5 else ("M" if light > 0.28 else "D"))

    return grid(24, 24, pixel)


DEBRIS = [
    ["........", "..##....", ".#++#...", ".++-+#..", "..+--+..", "...++...", "........", "........"],
    ["........", "........", "...#+...", "..#+-...", "...--...", "........", "........", "........"],
    ["........", ".#......", ".++#....", "..+-+...", "...+--..", "....-...", "........", "........"],
]


def ice_spike():
    """16x32 crystal cluster: a tall main spike and two smaller ones, lit on the left, dark outline."""
    c = blank(16, 32)
    for cx, base_w, height in ((8, 9.0, 31), (3.5, 5.0, 17), (12.5, 5.0, 21)):
        for y in range(32):
            h = 31 - y                                             # height above the bottom row
            if h > height:
                continue
            half = base_w / 2 * (1 - h / height) ** 0.85
            for x in range(16):
                dx = x + 0.5 - cx
                if abs(dx) > half:
                    continue
                if abs(dx) > half - 0.9:
                    ch = "N" if dx > 0 else "B"
                elif dx < -half * 0.2:
                    ch = "W" if h > height * 0.55 else "C"
                elif dx < half * 0.35:
                    ch = "A"
                else:
                    ch = "B"
                if c[y][x] == "." or ch in "WC":
                    c[y][x] = ch
    return rows(c)


def shockwave():
    """32x32 dusty shockwave: soft ragged ring of snow thrown up by a slam."""
    def pixel(x, y):
        d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
        wobble = (hash01(x // 2, y // 2, 180) - 0.5) * 2.2
        if abs(d - 13 + wobble * 0.5) > 2.6 + wobble * 0.4 or hash01(x, y, 181) < 0.18:
            return "."
        t = abs(d - 13) / 2.6
        return "W" if t < 0.35 else ("S" if t < 0.7 else "G")

    return grid(32, 32, pixel)


def aurora_frame(frame):
    """16x32 aurora curtain: shimmering vertical rays, green at the bottom to violet at the top."""
    def pixel(x, y):
        ray = math.sin(x * 1.3 + frame * 1.7) * 0.5 + 0.5
        fade = 1 - abs(y - 20) / 20
        if ray * fade < 0.25 + hash01(x, y, 190 + frame) * 0.2:
            return "."
        if y > 22:
            return "G" if ray > 0.6 else "C"
        if y > 10:
            return "W" if ray > 0.9 else "C"
        return "V"

    return grid(16, 32, pixel)


SPRITES = {
    "ring": (0, 0, [ring_frame(i) for i in range(3)], ICE),
    "crack": (96, 0, [ground_crack()], ICE),
    "warn_circle": (128, 0, [warn_circle()], GRAY),
    "warn_fill": (160, 0, [warn_fill()], GRAY),
    "rune": (192, 0, [rune_circle()], GRAY),
    "frost_field": (224, 0, [frost_field()], ICE),
    "mist": (0, 32, [mist_frame(i) for i in range(4)], SNOW),
    "flash": (64, 32, [flash_frame(i) for i in range(3)], ICE),
    "orb": (112, 32, [orb_frame(i) for i in range(2)], ICE),
    "frozen": (144, 32, [FROZEN_ICON], ICE),
    "shard": (0, 48, SHARDS, ICE),
    "snowflake": (24, 48, SNOWFLAKES, ICE),
    "tile": (48, 48, [TILE], GRAY),
    "chain": (56, 48, [CHAIN], ICE),
    "heal": (64, 48, HEAL_FRAMES, HEAL),
    "dust": (80, 48, DUST, SNOW),
    "glyph": (104, 48, GLYPHS, GRAY),
    "sparkle": (136, 48, SPARKLES, ICE),
    "spark": (152, 48, [SPARK], ICE),
    "pillar": (0, 64, [pillar()], ICE),
    "icicle": (8, 64, [icicle()], ICE),
    "crystal": (16, 64, [crystal()], ICE),
    "snowball": (32, 64, [snowball()], SNOW),
    "spike": (48, 64, [ice_spike()], ICE),
    **{f"boulder_{name}": (24 * i, 96, [boulder()], BOULDER_PALETTES[name]) for i, name in enumerate(BOULDER_ORDER)},
    "debris": (96, 96, DEBRIS, GRAY),
    "shockwave": (128, 96, [shockwave()], SNOW),
    "aurora": (160, 96, [aurora_frame(i) for i in range(2)], AURORA),
}


def build_atlas():
    pixels = [[(0, 0, 0, 0)] * ATLAS for _ in range(ATLAS)]
    used = {}
    for name, (ox, oy, frames, palette) in SPRITES.items():
        for f, sprite in enumerate(frames):
            w = len(sprite[0])
            for j, row in enumerate(sprite):
                assert len(row) == w, (name, f, j)
                for i, ch in enumerate(row):
                    px, py = ox + f * w + i, oy + j
                    assert (px, py) not in used, f"{name} overlaps {used[(px, py)]}"
                    used[(px, py)] = name
                    if ch != ".":
                        pixels[py][px] = (*palette[ch], 255)
    return pixels


# ---------------------------------------------------------------------------
# Particle definitions
# ---------------------------------------------------------------------------

AGE = "v.particle_age / v.particle_lifetime"


def uv(sprite, fps=12):
    """UV of a single frame, or a flipbook running through all frames over the particle lifetime."""
    ox, oy, frames, _ = SPRITES[sprite]
    w, h = len(frames[0][0]), len(frames[0])
    base = {"texture_width": ATLAS, "texture_height": ATLAS}
    if len(frames) == 1:
        return {**base, "uv": [ox, oy], "uv_size": [w, h]}
    return {**base, "flipbook": {
        "base_UV": [ox, oy], "size_UV": [w, h], "step_UV": [w, 0],
        "frames_per_second": fps, "max_frame": len(frames), "stretch_to_lifetime": True, "loop": False,
    }}


def uv_variant(sprite):
    """Pick one of the sprite's frames at random for each particle (shards, dust, glyphs)."""
    ox, oy, frames, _ = SPRITES[sprite]
    w, h = len(frames[0][0]), len(frames[0])
    return {"texture_width": ATLAS, "texture_height": ATLAS,
            "uv": [f"{ox} + math.floor(v.particle_random_3 * {len(frames) - 0.01}) * {w}", oy], "uv_size": [w, h]}


def tint(stops):
    return {"color": {"interpolant": AGE, "gradient": stops}}


FADE = tint({"0.0": "#FFFFFFFF", "0.7": "#FFFFFFFF", "1.0": "#00FFFFFF"})
# Ice spike height over its life: shoots up past full height, settles, then sinks during the last 0.4 s
SPIKE_H = ("(v.radius * 1.9 * math.min(math.min(v.particle_age / 0.12 * 1.15, "
           "1.15 - math.clamp((v.particle_age - 0.12) / 0.1, 0, 1) * 0.15), "
           "math.clamp((v.particle_lifetime - v.particle_age) / 0.4, 0, 1)))")
# Telegraph red: pulses faster and faster, then flashes white right before the impact
WARN_PULSE = f"(0.55 + 0.45 * math.sin(v.particle_age * (400 + 900 * {AGE})))"


def particle(name, material, components):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": f"{NAMESPACE}:{name}",
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


def flat(size_x, size_y, sprite, **extra):
    """Billboard lying flat on the ground (ground decals and telegraphs)."""
    return {"size": [size_x, size_y], "facing_camera_mode": "emitter_transform_xz", "uv": uv(sprite), **extra}


PARTICLES = {
    # ---- Impacts -----------------------------------------------------------------
    # Ice shards flying out, falling and bouncing on the ground (3 shapes picked at random)
    "ice_shard": particle("ice_shard", "particles_alpha", {
        **burst(16),
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.7, 1.3)"},
        "minecraft:particle_initial_speed": "math.random(3, 7)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-540, 540)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -16, 0], "linear_drag_coefficient": 0.8,
                                              "rotation_drag_coefficient": 1.5},
        "minecraft:particle_motion_collision": {"collision_radius": 0.05, "coefficient_of_restitution": 0.3,
                                                "collision_drag": 5},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.08 + v.particle_random_2 * 0.08", "0.08 + v.particle_random_2 * 0.08"],
            "facing_camera_mode": "rotate_xyz", "uv": uv_variant("shard"),
        },
    }),
    # Big 4-point ice star flash at the impact point
    "ice_burst": particle("ice_burst", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.3},
        "minecraft:particle_initial_spin": {"rotation": "math.random(-15, 15)"},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.9 + {AGE} * 1.1", f"0.9 + {AGE} * 1.1"], "facing_camera_mode": "rotate_xyz", "uv": uv("flash"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Frost shockwave ring spreading on the ground; radius via v.radius
    "frost_ring": particle("frost_ring", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
        "minecraft:particle_appearance_billboard": flat(
            f"0.3 + (v.radius - 0.3) * math.sqrt({AGE})", f"0.3 + (v.radius - 0.3) * math.sqrt({AGE})", "ring"),
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Cracked ice on the ground (slams, spikes, landing); radius via v.radius
    "ice_crack": particle("ice_crack", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 2.2},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
        "minecraft:particle_appearance_billboard": flat("v.radius", "v.radius", "crack"),
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFFFFF", "0.7": "#FFFFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # Frozen ground patch (Freeze Ground, Absolute Zero aftermath); lifetime via v.life
    "frost_field": particle("frost_field", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life"},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
        "minecraft:particle_appearance_billboard": flat(
            f"v.radius * math.min(1, {AGE} * 8)", f"v.radius * math.min(1, {AGE} * 8)", "frost_field"),
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FFFFFF", "0.1": "#E6FFFFFF", "0.85": "#E6FFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # Snow and ice chunks kicked up (dash trail, landings, footsteps)
    "snow_dust": particle("snow_dust", "particles_alpha", {
        **burst(8),
        "minecraft:emitter_shape_disc": {"radius": 0.7, "plane_normal": "y", "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
        "minecraft:particle_initial_speed": "math.random(1.5, 3)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-200, 200)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -10, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_motion_collision": {"collision_radius": 0.05, "coefficient_of_restitution": 0.2,
                                                "collision_drag": 6},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.07 + v.particle_random_2 * 0.07", "0.07 + v.particle_random_2 * 0.07"],
            "facing_camera_mode": "rotate_xyz", "uv": uv_variant("dust"),
        },
    }),
    # Frost mist puffs spreading (hits, landings, breath)
    "frost_mist": particle("frost_mist", "particles_blend", {
        **burst(6),
        "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.7, 1.2)"},
        "minecraft:particle_initial_speed": "math.random(0.4, 1.4)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.3, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.35 + {AGE} * 0.4", f"0.35 + {AGE} * 0.4"], "facing_camera_mode": "rotate_xyz", "uv": uv("mist"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#D9E6F8FF", "0.6": "#A6E6F8FF", "1.0": "#00E6F8FF"}),
    }),
    # Ice eruption: shards and sparkles shooting up (spikes, glacier rift, summons)
    "ice_pillar": particle("ice_pillar", "particles_add", {
        **burst(18, 0.12),
        "minecraft:emitter_shape_disc": {"radius": 0.35, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.4, 0.75)"},
        "minecraft:particle_initial_speed": "math.random(5, 9)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -4, 0], "linear_drag_coefficient": 1.8},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.1 * (1 - {AGE} * 0.5)", f"0.1 * (1 - {AGE} * 0.5)"], "facing_camera_mode": "rotate_xyz",
            "uv": uv("sparkle"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Vertical frost beam (phase change, Absolute Zero, summons)
    "light_beam": particle("light_beam", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.8},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.6 * (1 - {AGE} * 0.7)", f"v.radius * math.min(1, {AGE} * 6)"],
            "facing_camera_mode": "lookat_y", "uv": uv("pillar"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Long sparks flying along their velocity when a hit lands
    "hit_spark": particle("hit_spark", "particles_add", {
        **burst(12),
        "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.2, 0.4)"},
        "minecraft:particle_initial_speed": "math.random(5, 9)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -5, 0], "linear_drag_coefficient": 5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.04, f"0.22 * (1 - {AGE} * 0.5)"],
            "facing_camera_mode": "lookat_direction", "direction": {"mode": "derive_from_velocity"},
            "uv": uv("spark"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),

    # ---- Telegraphs (always red so they read clearly on snow) ---------------------
    # Danger circle: solid rim + dashed ring, pulsing faster until the impact; v.radius, v.life
    "warning_circle": particle("warning_circle", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life"},
        "minecraft:particle_appearance_billboard": flat("v.radius", "v.radius", "warn_circle"),
        "minecraft:particle_appearance_tinting": {"color": [
            1.0, f"0.25 + 0.75 * math.pow({AGE}, 6)", f"0.2 + 0.8 * math.pow({AGE}, 6)",
            f"math.min(1, {AGE} * 6) * {WARN_PULSE}"]},
    }),
    # Fill growing from the center under the circle: when it reaches the rim, the hit lands
    "warning_fill": particle("warning_fill", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life"},
        "minecraft:particle_appearance_billboard": flat(f"v.radius * {AGE}", f"v.radius * {AGE}", "warn_fill"),
        "minecraft:particle_appearance_tinting": {"color": [1.0, 0.22, 0.18, f"0.2 + 0.25 * {AGE}"]},
    }),
    # Small rune tile marking where an ice spike is about to erupt
    "warning_tile": particle("warning_tile", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life"},
        "minecraft:particle_initial_spin": {"rotation": "v.yaw"},
        "minecraft:particle_appearance_billboard": flat(0.4, 0.4, "tile"),
        "minecraft:particle_appearance_tinting": {"color": [1.0, 0.34, 0.24, f"math.min(1, {AGE} * 5) * {WARN_PULSE}"]},
    }),
    # Wall of frost rising along a circle (edge of Absolute Zero); v.radius
    "dome_edge": particle("dome_edge", "particles_add", {
        **burst("math.min(90, v.radius * 5)"),
        "minecraft:emitter_shape_disc": {"radius": "v.radius", "plane_normal": "y", "surface_only": True,
                                         "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.2)"},
        "minecraft:particle_initial_speed": "math.random(1.5, 3)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.2},
        "minecraft:particle_appearance_billboard": {
            "size": [0.12, 0.12], "facing_camera_mode": "rotate_xyz", "uv": uv("sparkle"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FF5040", "0.2": "#FFFF6A50", "0.7": "#FFC8F0FF", "1.0": "#00C8F0FF"}),
    }),

    # ---- Projectiles and channelled effects --------------------------------------
    # Frost orb core: respawned every tick by the script along the flight path
    "frost_orb": particle("frost_orb", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.1},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
        "minecraft:particle_appearance_billboard": {
            "size": ["v.radius", "v.radius"], "facing_camera_mode": "rotate_xyz", "uv": uv("orb", 20),
        },
    }),
    # Sparkles left behind a flying orb / crystal / chain
    "orb_trail": particle("orb_trail", "particles_add", {
        **burst(3),
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.3, 0.6)"},
        "minecraft:particle_initial_speed": 0.4,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -1.5, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.09 * (1 - {AGE})", f"0.09 * (1 - {AGE})"], "facing_camera_mode": "rotate_xyz", "uv": uv("sparkle"),
        },
    }),
    # Crystal floating around the Yeti before Crystal Barrage fires it (respawned every tick)
    "crystal": particle("crystal", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.1},
        "minecraft:particle_appearance_billboard": {
            "size": [0.18, 0.36], "facing_camera_mode": "lookat_y", "uv": uv("crystal"),
        },
    }),
    # Giant rolling snowball (Avalanche): respawned every tick, grows via v.radius, rolls via v.spin
    "snowball": particle("snowball", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.1},
        "minecraft:particle_initial_spin": {"rotation": "v.spin"},
        "minecraft:particle_appearance_billboard": {
            "size": ["v.radius", "v.radius"], "facing_camera_mode": "rotate_xyz", "uv": uv("snowball"),
        },
    }),
    # Ice spike erupting from the ground (replaces the old ice spike entity): shoots up with an overshoot, holds,
    # sinks back at the end of v.life. Height via v.radius (1 = about 1.9 blocks). Faces the camera around Y.
    "ice_spike": particle("ice_spike", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life"},
        "minecraft:particle_motion_parametric": {"relative_position": [0, f"{SPIKE_H} * 0.5", 0]},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.42 * v.radius", f"{SPIKE_H} * 0.5 + 0.001"], "facing_camera_mode": "lookat_y", "uv": uv("spike"),
        },
    }),
    # Chunk of ground the Yeti rips up and throws (Boulder Hurl): respawned every tick along its flight.
    # v.variant picks the ground type (0 snow, 1 ice, 2 stone, 3 dirt/grass), v.radius the size, v.spin the roll.
    "boulder": particle("boulder", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.1},
        "minecraft:particle_initial_spin": {"rotation": "v.spin"},
        "minecraft:particle_appearance_billboard": {
            "size": ["v.radius", "v.radius"], "facing_camera_mode": "rotate_xyz",
            "uv": {"texture_width": ATLAS, "texture_height": ATLAS, "uv": ["math.floor(v.variant) * 24", 96], "uv_size": [24, 24]},
        },
    }),
    # Rock / snow chunks blasted up, falling and bouncing; colored by v.variant like the boulder
    "rock_debris": particle("rock_debris", "particles_alpha", {
        **burst(16),
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "direction": [
            "math.random(-1, 1)", "math.random(0.7, 1.8)", "math.random(-1, 1)"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.4)"},
        "minecraft:particle_initial_speed": "math.random(3, 7)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-400, 400)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -18, 0], "linear_drag_coefficient": 0.6},
        "minecraft:particle_motion_collision": {"collision_radius": 0.08, "coefficient_of_restitution": 0.3,
                                                "collision_drag": 5},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.08 + v.particle_random_2 * 0.12", "0.08 + v.particle_random_2 * 0.12"],
            "facing_camera_mode": "rotate_xyz", "uv": uv_variant("debris"),
        },
        "minecraft:particle_appearance_tinting": {"color": [
            "v.variant < 0.5 ? 0.95 : (v.variant < 1.5 ? 0.62 : (v.variant < 2.5 ? 0.6 : 0.5))",
            "v.variant < 0.5 ? 0.97 : (v.variant < 1.5 ? 0.86 : (v.variant < 2.5 ? 0.6 : 0.36))",
            "v.variant < 0.5 ? 1.0 : (v.variant < 1.5 ? 1.0 : (v.variant < 2.5 ? 0.64 : 0.24))", 1]},
    }),
    # Dust shockwave racing along the ground after big slams; v.radius
    "shockwave": particle("shockwave", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
        "minecraft:particle_appearance_billboard": flat(
            f"0.5 + (v.radius - 0.5) * math.sqrt({AGE})", f"0.5 + (v.radius - 0.5) * math.sqrt({AGE})", "shockwave"),
        "minecraft:particle_appearance_tinting": tint({"0.0": "#F2FFFFFF", "0.5": "#B3F0F8FF", "1.0": "#00E6F0FF"}),
    }),
    # Aurora curtain shimmering around the Yeti's grand skills (Frozen Domain wall, Glacial Cataclysm sky)
    "aurora": particle("aurora", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.2},
        "minecraft:particle_motion_parametric": {"relative_position": [0, f"math.sin({AGE} * 180) * 0.4", 0]},
        "minecraft:particle_appearance_billboard": {
            "size": [0.7, 2.4], "facing_camera_mode": "lookat_y",
            "uv": {**uv("aurora", 4), "flipbook": {**uv("aurora", 4)["flipbook"], "stretch_to_lifetime": False, "loop": True}},
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FFFFFF", "0.3": "#CCFFFFFF", "0.7": "#CCFFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # Icicle falling from the sky (Blizzard); disappears when it hits the ground
    "icicle": particle("icicle", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.5},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -24, 0]},
        "minecraft:particle_motion_collision": {"collision_radius": 0.2, "expire_on_contact": True},
        "minecraft:particle_appearance_billboard": {
            "size": [0.3, 0.6], "facing_camera_mode": "lookat_y", "uv": uv("icicle"),
        },
    }),
    # Ice chain link (Ice Chains), respawned every tick along the chain
    "chain_link": particle("chain_link", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.12},
        "minecraft:particle_initial_spin": {"rotation": "math.random(-25, 25)"},
        "minecraft:particle_appearance_billboard": {
            "size": [0.13, 0.13], "facing_camera_mode": "rotate_xyz", "uv": uv("chain"),
        },
    }),
    # Freezing breath: mist blown along v.dir with a random spread, speed via v.speed
    "breath": particle("breath", "particles_blend", {
        **burst(8),
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": [
            "v.dir_x + math.random(-0.22, 0.22)", "v.dir_y + math.random(-0.12, 0.12)", "v.dir_z + math.random(-0.22, 0.22)"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 0.9)"},
        "minecraft:particle_initial_speed": "v.speed * math.random(0.8, 1.15)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-90, 90)"},
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.3},
        "minecraft:particle_motion_collision": {"collision_radius": 0.1, "collision_drag": 2},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.2 + {AGE} * 0.9", f"0.2 + {AGE} * 0.9"], "facing_camera_mode": "rotate_xyz", "uv": uv("mist"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#F0FFFFFF", "0.5": "#B3D2F0FF", "1.0": "#00AAD8FF"}),
    }),
    # Blizzard: snow streaks driven by wind over an area; v.radius (half width), lasts ~1.1 s
    "blizzard": particle("blizzard", "particles_add", {
        "minecraft:emitter_rate_steady": {"spawn_rate": "math.min(90, v.radius * 6)", "max_particles": 140},
        "minecraft:emitter_lifetime_once": {"active_time": 1.1},
        "minecraft:emitter_shape_box": {"half_dimensions": ["v.radius", 3, "v.radius"], "offset": [0, 3, 0],
                                        "direction": [1, -0.6, 0.35]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.0)"},
        "minecraft:particle_initial_speed": "math.random(7, 11)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -2, 0]},
        "minecraft:particle_appearance_billboard": {
            "size": [0.035, 0.2], "facing_camera_mode": "lookat_direction", "direction": {"mode": "derive_from_velocity"},
            "uv": uv("spark"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FFFFFF", "0.15": "#E6FFFFFF", "0.8": "#E6FFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # Polar Vortex: snow spiralling inward and upward around the Yeti; v.radius
    "vortex": particle("vortex", "particles_add", {
        **burst(28),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.1)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"math.cos(v.particle_random_1 * 360 + v.particle_age * 420) * v.radius * (1 - {AGE} * 0.85)",
            f"v.particle_random_2 * 1.5 + {AGE} * 4",
            f"math.sin(v.particle_random_1 * 360 + v.particle_age * 420) * v.radius * (1 - {AGE} * 0.85)"]},
        "minecraft:particle_appearance_billboard": {
            "size": [0.1, 0.1], "facing_camera_mode": "rotate_xyz", "uv": uv("snowflake"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FFFFFF", "0.2": "#FFFFFFFF", "0.8": "#FFC8F0FF", "1.0": "#00C8F0FF"}),
    }),
    # Energy gathering into the Yeti's fists before a big attack
    "charge_gather": particle("charge_gather", "particles_add", {
        **burst(14),
        "minecraft:emitter_shape_sphere": {"radius": 2.2, "surface_only": True, "direction": "inwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
        "minecraft:particle_initial_speed": 4.8,
        "minecraft:particle_appearance_billboard": {
            "size": [0.1, 0.1], "facing_camera_mode": "rotate_xyz", "uv": uv("sparkle"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FFFFFF", "0.3": "#FFFFFFFF", "1.0": "#FFAEE6FF"}),
    }),
    # Summoning portal: frost rune circle spinning on the ground; v.radius, v.life
    "rune_circle": particle("rune_circle", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life"},
        "minecraft:particle_initial_spin": {"rotation": 0, "rotation_rate": 120},
        "minecraft:particle_appearance_billboard": flat(
            f"v.radius * math.min(1, {AGE} * 5)", f"v.radius * math.min(1, {AGE} * 5)", "rune"),
        "minecraft:particle_appearance_tinting": tint({"0.0": "#0078DCFF", "0.15": "#FF78DCFF", "0.85": "#FFC8F5FF", "1.0": "#00FFFFFF"}),
    }),
    # Frost runes rising (summons, Frost Armor)
    "glyph": particle("glyph", "particles_add", {
        **burst(5),
        "minecraft:emitter_shape_disc": {"radius": 1.0, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.7, 1.1)"},
        "minecraft:particle_initial_speed": "math.random(0.5, 1.1)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.8},
        "minecraft:particle_appearance_billboard": {
            "size": [0.13, 0.13], "facing_camera_mode": "rotate_xyz", "uv": uv_variant("glyph"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#0082E6FF", "0.2": "#FF82E6FF", "0.7": "#FFD2F8FF", "1.0": "#00D2F8FF"}),
    }),
    # Healing crystals rising around the Yeti (Ice Regeneration)
    "heal": particle("heal", "particles_add", {
        **burst(5),
        "minecraft:emitter_shape_disc": {"radius": 1.4, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.7, 1.1)"},
        "minecraft:particle_initial_speed": "math.random(1.2, 2)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.2},
        "minecraft:particle_appearance_billboard": {
            "size": [0.13, 0.13], "facing_camera_mode": "rotate_xyz", "uv": uv("heal"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Twinkling sparkle (armor shimmer, orb trail, generic)
    "sparkle": particle("sparkle", "particles_add", {
        **burst(4),
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.3, 0.6)"},
        "minecraft:particle_initial_speed": 0.3,
        "minecraft:particle_appearance_billboard": {
            "size": [0.1, 0.1], "facing_camera_mode": "rotate_xyz", "uv": uv("sparkle"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Snowflakes drifting down, swaying (ambient, blizzard, freeze)
    "snowflake": particle("snowflake", "particles_alpha", {
        **burst(6),
        "minecraft:emitter_shape_sphere": {"radius": 1.2, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.0, 1.8)"},
        "minecraft:particle_initial_speed": 0.4,
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-90, 90)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [
            "math.sin(v.particle_age * 300 + v.particle_random_1 * 360) * 1.5", -1.2, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.07, 0.07], "facing_camera_mode": "rotate_xyz", "uv": uv_variant("snowflake"),
        },
    }),
    # Frozen marker floating above a frozen / chained player
    "frozen_mark": particle("frozen_mark", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.55},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.22 + math.sin({AGE} * 540) * 0.02", f"0.22 + math.sin({AGE} * 540) * 0.02"],
            "facing_camera_mode": "rotate_xyz", "uv": uv("frozen"),
        },
    }),

    # ---- Ambient effects attached to the Yeti on the client (entity particle_effects) ----
    # Snowflakes circling around the Yeti all the time
    "aura": particle("aura", "particles_alpha", {
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_steady": {"spawn_rate": 7, "max_particles": 30},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_disc": {"radius": 2.2, "plane_normal": "y", "surface_only": True, "offset": [0, 0.3, 0],
                                         "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.2, 2.0)"},
        "minecraft:particle_initial_speed": "math.random(0.6, 1.2)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 90},
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.6},
        "minecraft:particle_appearance_billboard": {
            "size": [0.08, 0.08], "facing_camera_mode": "rotate_xyz", "uv": uv_variant("snowflake"),
        },
    }),
    # Enraged (low health): blue frost flames and sparkles bursting up around the Yeti
    "aura_enraged": particle("aura_enraged", "particles_add", {
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_steady": {"spawn_rate": 16, "max_particles": 50},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_disc": {"radius": 1.6, "plane_normal": "y", "offset": [0, 0.2, 0], "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.0)"},
        "minecraft:particle_initial_speed": "math.random(2, 3.5)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.12 * (1 - {AGE} * 0.6)", f"0.12 * (1 - {AGE} * 0.6)"], "facing_camera_mode": "rotate_xyz",
            "uv": uv("sparkle"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFFFFF", "0.5": "#FF7FD4FF", "1.0": "#003C8CFF"}),
    }),
    # Frost breath puffs from the Yeti's mouth (mouth locator)
    "breath_puff": particle("breath_puff", "particles_blend", {
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_steady": {"spawn_rate": 2, "max_particles": 6},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_sphere": {"radius": 0.1, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.2)"},
        "minecraft:particle_initial_speed": 0.35,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.25, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.12 + {AGE} * 0.25", f"0.12 + {AGE} * 0.25"], "facing_camera_mode": "rotate_xyz", "uv": uv("mist"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#B3FFFFFF", "1.0": "#00FFFFFF"}),
    }),
}


def write_particles(rp_root, write_png):
    write_png(os.path.join(rp_root, TEXTURE + ".png"), build_atlas())
    folder = os.path.join(rp_root, "particles")
    os.makedirs(folder, exist_ok=True)
    for name, data in PARTICLES.items():
        with open(os.path.join(folder, f"yeti_{name}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
    print(f"Particles: {len(PARTICLES)} effects")
