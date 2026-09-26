"""Pixel-art sprites for The Harvester particles (Reaper x Plague Doctor).

Every sprite is a list of frames; a frame is an RGBA numpy array (h, w, 4).
Grayscale sprites are tinted by the particle JSON, colored ones are drawn in their final palette.
"""
import math

import numpy as np


def hexc(value, alpha=255):
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def canvas(w, h):
    return np.zeros((h, w, 4), dtype=np.uint8)


def put(img, x, y, color):
    h, w = img.shape[:2]
    x, y = int(x), int(y)
    if 0 <= x < w and 0 <= y < h:
        img[y, x] = color


def hash01(x, y, salt=0):
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def gray(v, a=255):
    v = int(max(0, min(255, v)))
    return (v, v, v, int(max(0, min(255, a))))


def ramp(palette, t):
    """Pick a palette entry for t in [0, 1] (0 = first entry)."""
    t = max(0.0, min(0.999, t))
    return palette[int(t * len(palette))]


def from_ascii(rows, legend):
    h, w = len(rows), max(len(r) for r in rows)
    img = canvas(w, h)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in legend:
                img[y, x] = legend[ch]
    return img


def outline(img, color):
    """Add a 1px outline around opaque pixels (4-neighbourhood)."""
    h, w = img.shape[:2]
    alpha = img[..., 3] > 0
    out = img.copy()
    for y in range(h):
        for x in range(w):
            if alpha[y, x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and alpha[ny, nx]:
                    out[y, x] = color
                    break
    return out


# ---------------------------------------------------------------------------
# Palettes
# ---------------------------------------------------------------------------

SOUL = [hexc("#0E5C52"), hexc("#17917F"), hexc("#2FD6A8"), hexc("#7CFFD4"), hexc("#E6FFF7")]
PLAGUE = [hexc("#1E2B0F"), hexc("#3F5A17"), hexc("#6E8F2A"), hexc("#A8C94A"), hexc("#DDEB8A")]
BONE = [hexc("#5E5747"), hexc("#8A826E"), hexc("#BDB6A2"), hexc("#E3DDCB"), hexc("#F7F3E6")]
STONE = [hexc("#2E3033"), hexc("#474A4F"), hexc("#62666C"), hexc("#80858B"), hexc("#A2A7AD")]
CROW = [hexc("#07070A"), hexc("#111118"), hexc("#1E1E2A"), hexc("#34344A")]
EYE = hexc("#D8F06A")


# ---------------------------------------------------------------------------
# Souls
# ---------------------------------------------------------------------------

def soul_frame(frame):
    """Soul flame wisp, 16x16, teal with a white core."""
    img = canvas(16, 16)
    phase = frame * math.pi / 2
    for y in range(16):
        for x in range(16):
            px, py = x + 0.5, y + 0.5
            # round body at the bottom
            body = math.hypot(px - 8, py - 11.0) / 4.2
            # flame tongue rising from the body, swaying with the frame
            k = (11.0 - py) / 9.5
            shape = 1e9
            if 0 <= k <= 1:
                cx = 8 + math.sin(py * 0.8 + phase) * 1.6 * k
                half = 4.2 * (1 - k) ** 0.8 + 0.4
                shape = abs(px - cx) / half
            d = min(body, shape)
            if d > 1:
                continue
            flick = hash01(x, y, frame) * 0.12
            t = 1 - d + flick
            img[y, x] = ramp(SOUL, t * 1.05)
    return img


def wraith_frame(frame):
    """Harvested soul with a face: ghost head, two dark eyes, wavy tail."""
    img = canvas(16, 16)
    phase = frame * math.pi / 2
    for y in range(16):
        for x in range(16):
            px, py = x + 0.5, y + 0.5
            head = math.hypot(px - 8, (py - 6) * 1.05) / 4.2
            d = head
            if py > 6:
                k = (py - 6) / 9.5
                if k <= 1:
                    cx = 8 + math.sin(py * 0.9 + phase) * 1.6 * k
                    half = 4.2 * (1 - k) ** 1.1 + 0.2
                    d = min(d, abs(px - cx) / half)
            if d > 1:
                continue
            t = 1 - d * 0.9 + hash01(x, y, frame + 7) * 0.1
            img[y, x] = ramp(SOUL, t)
    for ex, ey in ((6, 5), (9, 5), (6, 6), (9, 6)):
        img[ey, ex] = (0, 0, 0, 0)
    img[8, 7] = (0, 0, 0, 0)
    img[8, 8] = (0, 0, 0, 0)
    return img


# ---------------------------------------------------------------------------
# Gas, smoke, liquid
# ---------------------------------------------------------------------------

def miasma_frame(frame):
    """Billowing gas puff, grayscale (tinted in JSON), 32x32."""
    img = canvas(32, 32)
    blobs = []
    for i in range(6):
        a = i * math.pi / 3 + frame * math.pi / 8
        r = 5.5 + 1.2 * math.sin(frame * 1.3 + i)
        blobs.append((16 + math.cos(a) * 6.5, 16 + math.sin(a) * 5.5, r))
    blobs.append((16, 16, 8.5 + 0.6 * math.sin(frame)))
    for y in range(32):
        for x in range(32):
            px, py = x + 0.5, y + 0.5
            best = min(math.hypot(px - bx, py - by) / br for bx, by, br in blobs)
            if best > 1:
                continue
            n = hash01(x, y, frame)
            edge = 1 - best
            # soft dithered edge
            if edge < 0.18 and n > edge / 0.18:
                continue
            light = 105 + 150 * (1 - (px + py) / 64) * (0.55 + 0.45 * edge) + 30 * (n - 0.5)
            alpha = 150 if edge < 0.3 else 215
            img[y, x] = gray(light, alpha)
    return img


def splash_frame(frame):
    """Liquid splat bursting outward, grayscale, 32x32."""
    img = canvas(32, 32)
    grow = 0.8 + frame * 0.18
    for y in range(32):
        for x in range(32):
            px, py = x + 0.5 - 16, y + 0.5 - 16
            ang = math.atan2(py, px)
            r = math.hypot(px, py)
            lobes = 6.5 * grow * (1 + 0.28 * math.sin(ang * 7 + 1.1) + 0.15 * math.sin(ang * 3))
            hole = 3.0 * frame  # splat thins in the middle as it spreads
            if hole < r < lobes and (frame < 3 or hash01(x, y, 3) > 0.35):
                img[y, x] = gray(200 + 55 * (1 - r / max(lobes, 1)), 230)
    # droplets flying out
    for i in range(9):
        ang = i * 2 * math.pi / 9 + 0.4
        dist = (8 + hash01(i, 1) * 3) * grow * 1.25
        dx, dy = 16 + math.cos(ang) * dist, 16 + math.sin(ang) * dist
        size = 2 if frame < 2 else 1
        for oy in range(size):
            for ox in range(size):
                put(img, dx + ox, dy + oy, gray(240, 240))
    return img


# ---------------------------------------------------------------------------
# Slashes, rings, sigils
# ---------------------------------------------------------------------------

def slash_frame(frame):
    """Crescent scythe slash, grayscale, 32x32; thins out over 4 frames."""
    img = canvas(32, 32)
    inner_shift = 6.5 - frame * 1.4
    for y in range(32):
        for x in range(32):
            px, py = x + 0.5, y + 0.5
            ro = math.hypot(px - 16, py - 22) / 15.2
            ri = math.hypot(px - 16, py - 22 - inner_shift) / 14.6
            if ro <= 1 and ri > 1:
                ang = math.degrees(math.atan2(py - 22, px - 16))
                if -178 < ang < -2:
                    tip = min(abs(ang + 178), abs(ang + 2)) / 55
                    if tip < 1 and hash01(x, y, frame) > tip:
                        continue
                    edge = (1 - ro) * 15.2
                    v = 255 if edge < 1.2 else 205 - edge * 14
                    img[y, x] = gray(v, 255 if v > 150 else 190)
    return img


def ring_sprite(size=64, thickness=2.2, glow=7.0):
    img = canvas(size, size)
    c = size / 2
    rad = c - 1.5
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + 0.5 - c, y + 0.5 - c)
            if abs(d - rad) <= thickness / 2:
                img[y, x] = gray(255)
            elif rad - glow < d < rad:
                k = (rad - d) / glow
                if hash01(x, y, 9) > k * 0.9:
                    img[y, x] = gray(150 * (1 - k) + 40, 170)
    return img


def rune_circle_sprite():
    """Plague circle: outer ring, inner ring, tick marks, six plague sigils and a hexagram."""
    size = 64
    img = canvas(size, size)
    c = size / 2
    for y in range(size):
        for x in range(size):
            px, py = x + 0.5 - c, y + 0.5 - c
            d = math.hypot(px, py)
            ang = math.degrees(math.atan2(py, px)) % 360
            if 29.2 <= d <= 31.2:
                img[y, x] = gray(255)
            elif 22.6 <= d <= 23.6:
                img[y, x] = gray(220)
            elif 24.5 < d < 28.5 and (ang % 15) < 1.6:
                img[y, x] = gray(180)
    # hexagram
    pts = [(c + math.cos(math.radians(a - 90)) * 22.5, c + math.sin(math.radians(a - 90)) * 22.5)
           for a in range(0, 360, 60)]
    for tri in ((0, 2, 4), (1, 3, 5)):
        for i in range(3):
            ax, ay = pts[tri[i]]
            bx, by = pts[tri[(i + 1) % 3]]
            steps = int(math.hypot(bx - ax, by - ay) * 2)
            for s in range(steps + 1):
                t = s / steps
                put(img, ax + (bx - ax) * t, ay + (by - ay) * t, gray(200))
    # small sigils (three-dot plague mark) between the rings
    for k in range(6):
        a = math.radians(k * 60 + 30 - 90)
        sx, sy = c + math.cos(a) * 26.5, c + math.sin(a) * 26.5
        for ox, oy in ((0, -1), (-1, 1), (1, 1), (0, 0)):
            put(img, sx + ox, sy + oy, gray(255))
    # center: small skull-ish dot
    for ox in range(-2, 3):
        for oy in range(-2, 3):
            if ox * ox + oy * oy <= 5:
                put(img, c + ox - 0.5, c + oy - 0.5, gray(235))
    return img


def tile_sprite():
    """Ground warning tile, grayscale: bright border, dithered body."""
    img = canvas(16, 16)
    for y in range(16):
        for x in range(16):
            edge = min(x, y, 15 - x, 15 - y)
            if edge == 0:
                img[y, x] = gray(255)
            elif edge == 1:
                img[y, x] = gray(170)
            else:
                img[y, x] = gray(95 + 35 * ((x + y) % 2), 255)
    return img


def spark_frame(frame):
    img = canvas(8, 8)
    arm = 3 - frame
    for i in range(-arm, arm + 1):
        v = 255 - abs(i) * 50
        put(img, 3.5 + i, 3.5, gray(v))
        put(img, 3.5, 3.5 + i, gray(v))
    if frame == 0:
        for ox, oy in ((-1, -1), (1, 1), (-1, 1), (1, -1)):
            put(img, 3.5 + ox, 3.5 + oy, gray(160))
    return img


def drop_sprite():
    img = canvas(8, 8)
    for y in range(1, 7):
        put(img, 3, y, gray(120 + y * 22))
    put(img, 4, 6, gray(160))
    return img


def skull_sprite():
    """Death sigil skull, 32x32, bone palette with teal glowing eyes."""
    img = canvas(32, 32)
    for y in range(32):
        for x in range(32):
            px, py = x + 0.5, y + 0.5
            cran = math.hypot((px - 16) / 11.0, (py - 13) / 10.5)
            jaw = abs(px - 16) <= 7.2 - max(0, py - 24) * 0.9 and 19 <= py <= 29
            cheek = abs(px - 16) <= 9.5 and 17 <= py <= 22
            if cran <= 1 or jaw or cheek:
                shade = 0.75 - 0.35 * cran + 0.12 * (16 - px) / 16 - 0.1 * (py > 22)
                img[y, x] = ramp(BONE, shade + hash01(x, y, 4) * 0.1)
    # eye sockets glowing teal
    for cx in (11.5, 20.5):
        for y in range(12, 20):
            for x in range(6, 26):
                d = math.hypot((x + 0.5 - cx) / 3.1, (y + 0.5 - 15.8) / 2.8)
                if d <= 1:
                    img[y, x] = ramp(SOUL, 1 - d + 0.05) if d < 0.55 else hexc("#0B1512")
    # nose
    for y, xs in ((20, (15, 16)), (21, (15, 16)), (22, (16,))):
        for x in xs:
            img[y, x] = hexc("#1A1A16")
    # teeth
    for x in range(10, 22):
        if x % 2 == 0:
            for y in (25, 26):
                img[y, x] = hexc("#2A2720")
    img[24, 10:22] = hexc("#2A2720")
    return outline(img, hexc("#16140F"))


def scythe_sprite():
    """Spectral scythe, 64x64, ghostly teal, drawn for additive blending."""
    img = canvas(64, 64)
    # snath (handle): from bottom-left to top-right, slight curve
    for s in range(0, 181):
        t = s / 180
        x = 14 + t * 32 + math.sin(t * math.pi) * 3
        y = 61 - t * 53
        for ox in (-1, 0, 1):
            for oy in (-1, 0):
                v = 0.55 + 0.3 * (ox == 0)
                cur = img[int(y + oy), int(x + ox)] if 0 <= int(x + ox) < 64 and 0 <= int(y + oy) < 64 else None
                if cur is not None and cur[3] == 0:
                    put(img, x + ox, y + oy, ramp(SOUL, v))
    # grips
    for gy, gx in ((44, 23), (27, 34)):
        for ox in range(-2, 3):
            put(img, gx + ox, gy, ramp(SOUL, 0.95))
            put(img, gx + ox, gy + 1, ramp(SOUL, 0.7))
    # blade: crescent sweeping left from the top of the snath
    for y in range(64):
        for x in range(64):
            px, py = x + 0.5, y + 0.5
            ro = math.hypot((px - 30) / 26.0, (py - 34) / 25.0)
            ri = math.hypot((px - 31) / 25.0, (py - 42.5) / 25.0)
            if ro <= 1 and ri > 1 and py < 26 and px < 49 and px > 3:
                edge = ri - 1
                t = 0.6 + min(edge * 9, 0.4)
                if px < 12:  # tip fades to a point
                    t -= (12 - px) * 0.04
                img[y, x] = ramp(SOUL, t)
    # tang/collar where the blade meets the snath
    for oy in range(-2, 3):
        for ox in range(-2, 2):
            put(img, 46 + ox, 9 + oy, ramp(SOUL, 0.85))
    return img


# ---------------------------------------------------------------------------
# Crows and feathers
# ---------------------------------------------------------------------------

def crow_frame(frame):
    """Plague crow seen from the front, wings flapping (up, mid, down, mid)."""
    img = canvas(16, 16)
    tip_angle = [-48, -8, 38, -8][frame]
    for side in (-1, 1):
        a = math.radians(tip_angle)
        sx, sy = 8 + side * 0.8, 8.2
        for s in range(0, 61):
            t = s / 60
            # wing arcs slightly (bent at the wrist)
            bend = math.sin(t * math.pi) * (1.2 if frame != 2 else -0.6)
            x = sx + side * math.cos(a) * 7.2 * t
            y = sy + math.sin(a) * 7.2 * t - bend
            thick = 1.6 * (1 - t) + 0.5
            for oy in np.arange(-thick, thick + 0.01, 0.5):
                c = CROW[2] if oy < -0.6 else CROW[1]
                put(img, x, y + oy, c)
        # primary feathers at the tip (jagged)
        tx = sx + side * math.cos(a) * 7.0
        ty = sy + math.sin(a) * 7.0
        for k in range(3):
            put(img, tx - side * k * 0.9, ty + 1 + k * 0.4, CROW[0])
    # body and tail
    for y in range(16):
        for x in range(16):
            px, py = x + 0.5, y + 0.5
            if math.hypot((px - 8) / 1.9, (py - 9.5) / 3.0) <= 1:
                img[y, x] = CROW[1] if px > 8 else CROW[2]
            if 11.5 <= py <= 14 and abs(px - 8) <= (py - 11.5) * 0.9 + 0.6:
                img[y, x] = CROW[0]
            if math.hypot(px - 8, py - 6.2) <= 1.8:
                img[y, x] = CROW[2]
    img[6, 7] = EYE
    img[6, 8] = EYE
    img[7, 7] = hexc("#5A5A60")
    img[7, 8] = hexc("#3A3A40")
    return img


def feather_sprite():
    return from_ascii([
        "......a.",
        ".....bba",
        "....bbb.",
        "...bbc..",
        "..bbc...",
        ".bbc....",
        ".bc.....",
        "c.......",
    ], {"a": CROW[3], "b": CROW[1], "c": hexc("#6A6A70")})


# ---------------------------------------------------------------------------
# Plague doctor props
# ---------------------------------------------------------------------------

def flask_sprite():
    """Plague flask: round glass bulb, cork, bubbling green liquid."""
    img = canvas(16, 16)
    glass = hexc("#CFEFF2")
    glass_dark = hexc("#7FB6BF")
    for y in range(16):
        for x in range(16):
            px, py = x + 0.5, y + 0.5
            d = math.hypot(px - 8, py - 10.2) / 4.8
            neck = abs(px - 8) <= 1.5 and 2.5 <= py <= 6.5
            if d <= 1 or neck:
                if d > 0.8 or (neck and abs(px - 8) > 0.9 and d > 1):
                    img[y, x] = glass if px < 8 else glass_dark
                elif py >= 8.6:
                    shade = 0.45 + 0.4 * (1 - d) + 0.15 * (px < 7)
                    img[y, x] = ramp(PLAGUE, shade)
                else:
                    img[y, x] = hexc("#9FD8E0", 110)
    # cork
    for y in (1, 2):
        for x in (7, 8):
            img[y, x] = hexc("#7A5230") if x == 7 else hexc("#5C3C22")
    # highlight and bubbles
    img[9, 6] = hexc("#FFFFFF")
    img[10, 5] = hexc("#FFFFFF")
    img[11, 9] = ramp(PLAGUE, 0.95)
    img[12, 10] = ramp(PLAGUE, 0.95)
    return outline(img, hexc("#1B2A2C"))


def shard_frame(frame):
    rows = [
        ["...a....", "..aab...", "..abb...", ".abbb...", ".abbbc..", "abbbc...", "..cc....", "........"],
        ["........", ".aa.....", ".abbb...", "..abbb..", "...abbc.", "....bc..", ".....c..", "........"],
    ][frame]
    return from_ascii(rows, {"a": hexc("#FFFFFF"), "b": hexc("#BDE8EE", 220), "c": hexc("#6FA9B3")})


def dirt_frame(frame):
    rows = [
        ["........", "..aab...", ".abbbc..", ".bbbcc..", "..bcc...", "........", "........", "........"],
        ["........", "........", "...ab...", "..abbc..", "..bccc..", "...cc...", "........", "........"],
    ][frame]
    return from_ascii(rows, {"a": hexc("#8A6A48"), "b": hexc("#5E4630"), "c": hexc("#3A2A1C")})


def hourglass_frame(frame, frames=8):
    """Death's hourglass, 16x32. Frame 0 = full top, last frame = empty top."""
    p = frame / (frames - 1)
    img = canvas(16, 32)
    wood = [hexc("#2A1E16"), hexc("#46321F"), hexc("#6B4C2E")]
    sand_hi, sand = ramp(SOUL, 0.85), ramp(SOUL, 0.6)
    # caps
    for y in (1, 2, 29, 30):
        for x in range(2, 14):
            img[y, x] = wood[1] if y in (1, 29) else wood[0]
    for x in range(3, 13):
        img[1 if x % 3 else 2, x] = wood[2]
    # posts
    for y in range(3, 29):
        img[y, 2] = wood[1]
        img[y, 13] = wood[0]

    def half_width(y):
        # bulbs: widest near caps, neck at y = 15.5
        k = abs(y + 0.5 - 15.5) / 12.5
        return 0.8 + 4.2 * math.sin(min(k, 1) * math.pi / 2) ** 0.8

    top_rows = [y for y in range(3, 15)]
    bottom_rows = [y for y in range(17, 29)]
    top_fill = int(round((1 - p) * 9))
    bottom_fill = int(round(p * 9))
    for y in range(3, 29):
        hw = half_width(y)
        for x in range(3, 13):
            dx = abs(x + 0.5 - 8)
            if dx > hw + 0.5:
                continue
            is_edge = dx > hw - 0.6
            filled = (y in top_rows and y >= 15 - top_fill) or (y in bottom_rows and y >= 29 - bottom_fill)
            if is_edge:
                img[y, x] = hexc("#D9F7F2", 200)
            elif filled:
                img[y, x] = sand_hi if (x + y) % 3 == 0 else sand
            else:
                img[y, x] = hexc("#9FD8E0", 60)
    if 0 < p < 1:
        for y in range(15, 29 - bottom_fill):
            img[y, 8] = sand_hi
    return img


def lantern_frame(frame):
    """Soul lantern marking a safe zone during the Black Death."""
    iron = [hexc("#1C1D22"), hexc("#34363E"), hexc("#50535E")]
    img = canvas(16, 16)
    for x in range(6, 10):
        img[0, x] = iron[1]
    img[1, 6] = iron[1]
    img[1, 9] = iron[1]
    for x in range(4, 12):
        img[2, x] = iron[2]
        img[3, x] = iron[1]
        img[13, x] = iron[1]
        img[14, x] = iron[0]
    for y in range(4, 13):
        img[y, 4] = iron[2]
        img[y, 11] = iron[0]
        for x in range(5, 11):
            img[y, x] = hexc("#0C2622", 200)
    flame = soul_frame(frame * 2)
    for y in range(16):
        for x in range(16):
            if flame[y, x, 3] and 4 <= (y // 2 + 5) <= 12:
                fy, fx = y // 2 + 5, x // 2 + 4
                if 5 <= fx <= 10:
                    img[fy, fx] = flame[y, x]
    for y in range(4, 13):
        if y % 3 == 0:
            img[y, 7] = iron[1]
    return img


def plague_pips_frame(stacks):
    """Plague stack indicator: plague doctor mask icon + `stacks` of 5 pips."""
    leather = [hexc("#141210"), hexc("#2B2420"), hexc("#4A3F36")]
    rows = [
        "....hhhhhh......",
        "....hHHHHh......",
        "..hhhhhhhhhh....",
        "....mmmmm.......",
        "...mMMMMMm......",
        "...mMllMMMbb....",
        "...mMllMMMBbb...",
        "....mMMMMBBBbb..",
        ".....mmm...BBbb.",
        "............Bb..",
    ]
    img = from_ascii(rows, {
        "h": leather[0], "H": leather[1],
        "m": leather[1], "M": leather[2],
        "b": leather[1], "B": leather[2],
        "l": EYE,
    })
    full = np.zeros((16, 16, 4), dtype=np.uint8)
    full[0:10] = img
    for i in range(5):
        x0 = 1 + i * 3
        color = ramp(PLAGUE, 0.85) if i < stacks else hexc("#1A1A1A", 170)
        for y in (12, 13):
            for x in (x0, x0 + 1):
                full[y, x] = color
        if i < stacks:
            full[12, x0] = ramp(PLAGUE, 0.99)
    return full


def grave_sprite():
    """Tombstone rising from the ground (16x32)."""
    img = canvas(16, 32)
    for y in range(32):
        for x in range(16):
            px, py = x + 0.5, y + 0.5
            top = math.hypot((px - 8) / 6.0, (py - 9) / 6.0) <= 1 and py <= 9
            body = 2 <= px <= 14 and 9 <= py <= 27
            if top or body:
                shade = 0.62 - 0.25 * (px - 8) / 8 + (hash01(x, y, 11) - 0.5) * 0.25
                img[y, x] = ramp(STONE, shade)
    # engraved cross
    for y in range(8, 20):
        img[y, 7] = STONE[0]
        img[y, 8] = STONE[1]
    for x in range(5, 11):
        img[11, x] = STONE[0]
    # cracks and plague moss
    for y, x in ((14, 11), (15, 12), (16, 12), (17, 13), (21, 4), (22, 4), (23, 5)):
        img[y, x] = STONE[0]
    for x in range(2, 15):
        for y in range(24, 28):
            if hash01(x, y, 5) < (y - 23) * 0.22:
                img[y, x] = ramp(PLAGUE, 0.35 + hash01(x, y, 6) * 0.4)
    # dirt mound
    for x in range(0, 16):
        for y in range(27, 32):
            if abs(x + 0.5 - 8) <= 8 - (y - 27) * 0.2:
                img[y, x] = hexc("#3A2A1C") if hash01(x, y, 2) < 0.5 else hexc("#5E4630")
    return outline(img, hexc("#121315"))


def chain_sprite():
    return from_ascii([
        "..abba..",
        ".a....b.",
        "a......b",
        "a......c",
        "b......c",
        ".b....c.",
        "..bccc..",
        "........",
    ], {"a": ramp(SOUL, 0.99), "b": ramp(SOUL, 0.7), "c": ramp(SOUL, 0.35)})


def beak_sprite():
    """Plague doctor beak mask, 32x32, used for the phase-change sigil."""
    leather = [hexc("#0F0D0C"), hexc("#221D1A"), hexc("#3A322C"), hexc("#574A40")]
    img = canvas(32, 32)
    for y in range(32):
        for x in range(32):
            px, py = x + 0.5, y + 0.5
            head = math.hypot((px - 12) / 8.5, (py - 13) / 9.5) <= 1
            # beak: curved cone from the face toward the lower right
            t = (px - 14) / 16
            beak = False
            if 0 <= t <= 1:
                cy = 16 + t * 9 + t * t * 3
                half = 5.2 * (1 - t) + 0.4
                beak = abs(py - cy) <= half
            if head or beak:
                shade = 0.5 + 0.35 * (1 - (px + py) / 64) + (hash01(x, y, 3) - 0.5) * 0.15
                img[y, x] = ramp(leather, shade)
    # hat brim and crown
    for x in range(1, 25):
        img[4, x] = leather[0]
        img[5, x] = leather[1]
    for y in range(0, 4):
        for x in range(6, 19):
            img[y, x] = leather[1] if x < 16 else leather[0]
    # glass lens (sickly glow)
    for y in range(9, 17):
        for x in range(6, 16):
            d = math.hypot(x + 0.5 - 10.5, y + 0.5 - 12.5)
            if d <= 3.4:
                img[y, x] = hexc("#2A2F12") if d > 2.6 else ramp(PLAGUE, 1 - d / 3 + 0.2)
    # stitches along the beak
    for i in range(4):
        put(img, 17 + i * 3, 19 + i * 2.4, leather[3])
    return outline(img, hexc("#050404"))


SPRITES = {
    # name: (frames, grayscale?)
    "soul": [soul_frame(f) for f in range(4)],
    "wraith": [wraith_frame(f) for f in range(4)],
    "miasma": [miasma_frame(f) for f in range(4)],
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
