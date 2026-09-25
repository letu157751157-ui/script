"""Front-view drawing (pixel art) of The Darkin Blade.

Each pixel is 1 model unit (16 px = 1 block), matching Minecraft texture density.
model.py extrudes this drawing into 3D cubes, each material with its own depth.

Based on Aatrox's blade after the 2018 rework (base splash, Sea Hunter/Justicar
splashes redrawn with the new blade, Q and passive icons):
- Blade widens toward the tip, angled tip, big serrated spine and a hook near the tip.
- Dark metal frame around the edge, dark red veined flesh core, a bright lava vein down the middle.
- Darkin eye in the guard, claws wrapping around it, black horns rising on both sides of the blade base.

Coordinates: pixel (x, y) covers [x, x+1) x [y, y+1); y = 0 is the grip center, the blade points +Y.
The blade is symmetric about x = 0 (between pixels -1 and 0); the mirror of x is -1 - x.
"""
import math

# Materials: depth (along Z) and whether they glow
MATERIALS = {
    "frame": {"depth": 3, "glow": False},  # dark metal frame
    "core": {"depth": 2, "glow": False},  # dark red flesh core
    "lava": {"depth": 3, "glow": True},  # glowing lava vein
    "socket": {"depth": 4, "glow": False},  # flesh socket around the eye
    "eye": {"depth": 5, "glow": True},  # Darkin eye
    "horn": {"depth": 4, "glow": False},  # horns, claws
    "guard": {"depth": 5, "glow": False},  # crossguard
    "grip": {"depth": 2, "glow": False},  # leather-wrapped grip
    "band": {"depth": 4, "glow": False},  # metal bands
    "pommel": {"depth": 4, "glow": False},  # pommel
    "spike": {"depth": 2, "glow": False},  # pommel spike
}

BLADE_START = 18  # y where the blade starts
BLADE_LENGTH = 40


def mirror(x):
    return -1 - x


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def blade_span(b):
    """Left (spine) and right (cutting edge) bounds of the blade at row b (0 = blade base)."""
    back = -4 - 3.5 * smooth(b / 14)  # spine widens out to -7.5
    front = 4 + 4 * smooth(b / 16)  # cutting edge widens out to 8
    if b >= 30:  # angled tip from the spine up to the edge side
        t = (b - 30) / 9
        back = back + (5.5 - back) * t
        front = front + (6.5 - front) * t * t
    return math.floor(back + 0.5), math.floor(front + 0.5)


def build_art():
    art = {}

    def put(x, y, material, overwrite=True):
        if overwrite or (x, y) not in art:
            art[(x, y)] = material

    def taper(points, r0, r1, material):
        """Curved stroke thick at the base, sharp at the tip: fill pixels inside circles along the path."""
        lengths = [0.0]
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            lengths.append(lengths[-1] + math.hypot(x1 - x0, y1 - y0))
        total = lengths[-1]
        for (x0, y0), (x1, y1), l0, l1 in zip(points, points[1:], lengths, lengths[1:]):
            steps = int((l1 - l0) * 4) + 1
            for i in range(steps + 1):
                t = i / steps
                cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                r = r0 + (r1 - r0) * ((l0 + (l1 - l0) * t) / total)
                for px in range(math.floor(cx - r - 1), math.ceil(cx + r + 1)):
                    for py in range(math.floor(cy - r - 1), math.ceil(cy + r + 1)):
                        if math.hypot(px + 0.5 - cx, py + 0.5 - cy) <= r + 0.15:
                            put(px, py, material, overwrite=(material != "horn" or (px, py) not in art))

    def line(points, material, width=1):
        """Draw a (possibly thick) polyline through the points."""
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            steps = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
            for i in range(steps + 1):
                t = i / steps
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                for dx in range(width):
                    put(math.floor(x) + dx, math.floor(y), material)

    # --- Blade ---
    blade = set()
    for b in range(BLADE_LENGTH):
        left, right = blade_span(b)
        for x in range(left, right):
            blade.add((x, BLADE_START + b))

    # Big serrated teeth on the spine, leaning toward the tip
    for start in (3, 10, 17, 24):
        for i in range(5):
            y = BLADE_START + start + i
            left = min(x for x, yy in blade if yy == y)
            for j in range(1, (i * 4) // 5 + 1):
                blade.add((left - j, y))

    # Big hook on the spine near the tip
    for x, y in ((-8, 47), (-9, 48), (-8, 48), (-10, 49), (-9, 49), (-10, 50), (-11, 51), (-10, 51), (-11, 52)):
        blade.add((x, y))

    # Small notches along the cutting edge
    for b in range(3, 30, 4):
        y = BLADE_START + b
        right = max(x for x, yy in blade if yy == y)
        blade.discard((right, y))

    # Frame: pixels near the edge (spine 2 thick, edge 1, tip 2)
    def is_empty(x, y):
        return (x, y) not in blade

    for x, y in blade:
        b = y - BLADE_START
        reach = 2 if (x < 0 or b >= 28) else 1
        near_edge = any(
            is_empty(x + dx, y + dy)
            for dx in range(-reach, reach + 1)
            for dy in range(-reach, reach + 1)
            if abs(dx) + abs(dy) <= reach and (dx, dy) != (0, 0) and y + dy >= BLADE_START
        )
        art[(x, y)] = "frame" if near_edge else "core"

    # Lava vein down the middle of the blade + branches
    for y in range(BLADE_START, BLADE_START + 22):
        put(-1, y, "lava")
        put(0, y, "lava")
    for y in range(BLADE_START + 22, BLADE_START + 28):
        put(0, y, "lava")
    for branch in (
        [(0, 21), (3, 25)],
        [(-1, 26), (-4, 30)],
        [(0, 31), (4, 37)],
        [(-1, 35), (-4, 40)],
        [(0, 40), (2, 44)],
    ):
        (x0, y0), (x1, y1) = branch
        steps = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(steps + 1):
            x = round(x0 + (x1 - x0) * i / steps)
            y = round(y0 + (y1 - y0) * i / steps)
            if art.get((x, y)) == "core":
                art[(x, y)] = "lava"

    # --- Guard: eye socket, eye, horns, claws ---
    for x in range(-6, 6):
        for y in range(8, 18):
            if ((x + 0.5) / 5.4) ** 2 + ((y + 0.5 - 12.8) / 4.8) ** 2 <= 1:
                put(x, y, "socket")
    for x in range(-3, 3):
        for y in range(10, 16):
            if ((x + 0.5) / 3.1) ** 2 + ((y + 0.5 - 12.8) / 2.6) ** 2 <= 1:
                put(x, y, "eye")

    # Horns and claws: tapering curved strokes (radius shrinks from base to tip)
    # Big horns rising around both sides of the blade base
    taper([(-5, 15), (-6.5, 17.5), (-8, 20.5), (-8.5, 24), (-7.5, 27.5)], 1.6, 0.35, "horn")
    # Spikes pointing sideways from the sides of the eye socket
    taper([(-5, 13), (-7.5, 13.8), (-10, 15.5)], 1.2, 0.3, "horn")
    # Lower claws curling toward the grip
    taper([(-4.5, 10), (-7, 9), (-8.3, 6.5), (-7.5, 4), (-5.5, 3)], 1.3, 0.3, "horn")

    # Mirror horns/claws to the right side
    for (x, y), material in list(art.items()):
        if material == "horn":
            put(mirror(x), y, "horn", overwrite=False)

    # Crossguard under the eye socket
    for x in range(-4, 4):
        for y in (7, 8):
            put(x, y, "guard")

    # --- Grip ---
    for y in range(-8, 7):
        put(-1, y, "grip")
        put(0, y, "grip")
    for y0 in (5, -2, -8):
        for x in range(-2, 2):
            put(x, y0, "band")
    # Pommel + spike
    for x in range(-2, 2):
        for y in range(-12, -9):
            put(x, y, "pommel")
    put(-3, -11, "pommel")
    put(2, -11, "pommel")
    for y in range(-15, -12):
        put(-1, y, "spike")
        put(0, y, "spike")

    return art


ART = build_art()
