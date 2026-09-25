"""3D parts shown only in the World Ender form (R): demon wings on the back and horns on the head.

The cubes are bound to the player's body/head bones through the World Ender blade's attachable.
An attachable puts model point (0, 24, 0) at the pivot of the bone it binds to; the player's body
and head both pivot at (0, 24, 0), so coordinates here match the player model coordinates.

Wings are drawn like sword_art: a pixel drawing (u = distance outward, v = height above the wing
root) extruded into cubes. Wing bones are 2 thick, the membrane 1, the membrane edge glows.
"""
import math

WING_PIVOT = (-2, 20, 2.5)  # right wing root (the player's right side is -X in Bedrock)
WING_MATERIALS = {
    "wbone": {"depth": 2, "glow": False},
    "membrane": {"depth": 1, "glow": False},
    "wedge": {"depth": 1, "glow": True},
}

# Bat/dragon wing frame (u outward, v up, wing root at (0, 0))
WRIST = (10.0, 15.0)  # wrist joint: the arm bone runs from the root up to here
FINGER_TIPS = [(27.0, 17.0), (27.0, 5.0), (22.0, -6.0), (13.0, -12.0)]  # 4 fanned finger bones
LOWER_TIP = (2.0, -13.0)  # membrane edge next to the body
CLAW = [(10.0, 15.0), (8.5, 18.5), (10.5, 20.0)]  # hooked claw at the wrist


def _seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    t = max(0.0, min(1.0, ((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
    return math.hypot(p[0] - ax - t * (bx - ax), p[1] - ay - t * (by - ay)), t


def _in_triangle(p, a, b, c):
    def side(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    d1, d2, d3 = side(p, a, b), side(p, b, c), side(p, c, a)
    return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))


def wing_art():
    """Membrane stretched between fingers (scalloped trailing edge like a bat), tapering arm + finger bones,
    glowing lava veins spreading from the wrist, glowing scalloped edge."""
    root = (0.0, 0.0)
    # Membrane panels: between adjacent fingers (apex at the wrist), and between the last finger and the body
    panels = [(WRIST, FINGER_TIPS[i], FINGER_TIPS[i + 1]) for i in range(len(FINGER_TIPS) - 1)]
    panels += [(WRIST, FINGER_TIPS[-1], root), (root, FINGER_TIPS[-1], LOWER_TIP)]
    # Scalloped edge: each outer edge is cut by a circle offset outward
    edges = [(FINGER_TIPS[i], FINGER_TIPS[i + 1]) for i in range(len(FINGER_TIPS) - 1)] + [(FINGER_TIPS[-1], LOWER_TIP)]
    cuts = []
    for (ax, ay), (bx, by) in edges:
        mx, my = (ax + bx) / 2, (ay + by) / 2
        length = math.hypot(bx - ax, by - ay)
        nx, ny = (by - ay) / length, -(bx - ax) / length  # outward normal (away from the wrist)
        if (mx - WRIST[0]) * nx + (my - WRIST[1]) * ny < 0:
            nx, ny = -nx, -ny
        depth = length * 0.22
        radius = (length / 2) ** 2 / (2 * depth) + depth / 2
        cuts.append((mx + nx * (radius - depth), my + ny * (radius - depth), radius))
    bones = [(root, WRIST, 1.5, 1.1)] + [(WRIST, tip, 1.1, 0.45) for tip in FINGER_TIPS]
    veins = [(WRIST, ((FINGER_TIPS[i][0] + FINGER_TIPS[i + 1][0]) / 2, (FINGER_TIPS[i][1] + FINGER_TIPS[i + 1][1]) / 2))
             for i in range(len(FINGER_TIPS) - 1)]
    art = {}
    for u in range(0, 29):
        for v in range(-15, 22):
            p = (u + 0.5, v + 0.5)
            bone = False
            for a, b, w0, w1 in bones:
                d, t = _seg_dist(p, a, b)
                if d <= w0 + (w1 - w0) * t:
                    bone = True
            if any(_seg_dist(p, CLAW[i], CLAW[i + 1])[0] <= 0.7 for i in range(len(CLAW) - 1)):
                bone = True
            if bone:
                art[(u, v)] = "wbone"
                continue
            if not any(_in_triangle(p, *tri) for tri in panels):
                continue
            inside_cut = [math.hypot(p[0] - cx, p[1] - cy) - r for cx, cy, r in cuts]
            if min(inside_cut) < 0:
                continue
            if min(inside_cut) < 1.0:
                art[(u, v)] = "wedge"
            elif any(_seg_dist(p, a, b)[0] < 0.55 and _seg_dist(p, a, b)[1] < 0.8 for a, b in veins):
                art[(u, v)] = "wedge"
            else:
                art[(u, v)] = "membrane"
    return art


WING_ART = wing_art()

# Right horn (negative x); the left horn is mirrored. (origin, size) in player model coordinates
HORN_CUBES = [
    ((-5, 29, -2), (2, 3, 3)),
    ((-6, 31, -1), (2, 3, 2)),
    ((-7, 33, 0), (2, 3, 2)),
    ((-7, 35, 1), (1, 3, 1)),
    ((-7, 37, 2), (1, 2, 1)),
]


def rectangles(pixels):
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


def ult_cubes(wing_color, horn_color):
    """Wing and horn cubes. wing_color(material, u, v) / horn_color(x, y) return the front-face color."""
    cubes = []
    px, py, pz = WING_PIVOT
    for material, info in WING_MATERIALS.items():
        pixels = [p for p, m in WING_ART.items() if m == material]
        d = info["depth"]
        for u, v, w, h in rectangles(pixels):
            for side, bone in ((-1, "wing_r"), (1, "wing_l")):
                if side < 0:
                    ox = px - (u + w)
                    face = (lambda m, ox0: lambda x, y: wing_color(m, int(ox0 - x - 1), int(y - py)))(material, px)
                else:
                    ox = -px + u
                    face = (lambda m: lambda x, y: wing_color(m, int(x + px), int(y - py)))(material)
                cubes.append({"material": material, "glow": info["glow"], "bone": bone, "abs": True, "face": face,
                              "origin": (ox, py + v, pz - d / 2), "size": (w, h, d)})
    for (x, y, z), (w, h, d) in HORN_CUBES:
        for ox in (x, -x - w):
            cubes.append({"material": "uhorn", "glow": False, "bone": "ult_head", "abs": True,
                          "face": horn_color, "origin": (ox, y, z), "size": (w, h, d)})
    return cubes


# Transformation bones: (name, parent, binding, pivot)
ULT_BONES = [
    ("ult_body", None, "'body'", (0, 24, 0)),
    ("wing_r", "ult_body", None, WING_PIVOT),
    ("wing_l", "ult_body", None, (-WING_PIVOT[0], WING_PIVOT[1], WING_PIVOT[2])),
    ("ult_head", None, "'head'", (0, 24, 0)),
]
