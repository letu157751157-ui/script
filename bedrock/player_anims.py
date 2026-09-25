"""Player animations when casting skills (played with Entity.playAnimation from the script).

Each keyframe has two parts:
- Third person: extra rotation/offset for the player bones (rightarm, leftarm,
  body, head, rightleg, leftleg, root), in Bedrock units (degrees, pixels).
- First person: describes the blade on screen (hand offset from the normal hold,
  blade direction). solve_first_person() inverts that into rightarm rotation/offset,
  because the first-person arm is already rotated [95, -45, 115] and hard to pose directly.

In game every value is the Molang expression "v.is_first_person ? <first> : <third>":
the caster sees the first-person animation, everyone else sees the third-person one.

First-person coordinates (model space with X flipped, like Blockbench):
camera at the eye looking along +Z, +X is the LEFT of the screen, +Y is up.
"""
import json
import math
import os

HOLD_FP_FILE = "AatroxRP/animations/darkin_blade.animation.json"
PLAYER_SCALE = 0.9375  # player model scale (player.entity.json)
EYE = (0.0, 1.62 * 16, 0.0)
FP_ARM_POS = (13.5, -10.0, 12.0)  # animation.player.first_person.empty_hand
FP_ARM_ROT = (95.0, -45.0, 115.0)
FP_ITEM_POS = (0.0, 0.0, -1.0)  # rightitem: 22 - 15 - 7, -1
ARM_PIVOT = (-5.0, 22.0, 0.0)
ITEM_PIVOT = (-6.0, 15.0, 1.0)

# ---------------------------------------------------------------------------
# Small matrix math (Bedrock -> three.js convention like Blockbench: flip X, ZYX rotation order)
# ---------------------------------------------------------------------------


def v3(p):
    return (-p[0], p[1], p[2])


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def mat_vec(m, v):
    return tuple(sum(m[i][k] * v[k] for k in range(3)) for i in range(3))


def transpose(m):
    return [list(r) for r in zip(*m)]


def rotation(rot):
    a, b, c = (math.radians(-rot[0]), math.radians(-rot[1]), math.radians(rot[2]))
    rx = [[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]]
    ry = [[math.cos(b), 0, math.sin(b)], [0, 1, 0], [-math.sin(b), 0, math.cos(b)]]
    rz = [[math.cos(c), -math.sin(c), 0], [math.sin(c), math.cos(c), 0], [0, 0, 1]]
    return mat_mul(rz, mat_mul(ry, rx))


def euler(m):
    b = math.asin(max(-1.0, min(1.0, -m[2][0])))
    a = math.atan2(m[2][1], m[2][2])
    c = math.atan2(m[1][0], m[0][0])
    return (-math.degrees(a), -math.degrees(b), math.degrees(c))


def norm(v):
    length = math.sqrt(sum(x * x for x in v))
    return tuple(x / length for x in v)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def add(a, b, s=1.0):
    return tuple(x + y * s for x, y in zip(a, b))


# ---------------------------------------------------------------------------
# Inverse solve for the right arm in first person
# ---------------------------------------------------------------------------


def load_hold(root, view="first_person"):
    with open(os.path.join(root, HOLD_FP_FILE), encoding="utf-8") as f:
        bone = json.load(f)["animations"][f"animation.aatrox.darkin_blade.hold_{view}"]["bones"]["darkin_blade"]
    return bone["position"], bone["rotation"]


def grip_point(hold_pos):
    """Grip point (grip center) in the absolute coordinates of the rightarm bone."""
    return add(add(v3(FP_ITEM_POS), v3(ITEM_PIVOT)), v3(hold_pos))


def grip_world(arm_pos, arm_rot, hold_pos):
    pivot = v3(ARM_PIVOT)
    local = mat_vec(rotation(arm_rot), add(grip_point(hold_pos), pivot, -1))
    return tuple(PLAYER_SCALE * x for x in add(add(v3(arm_pos), pivot), local))


def axis_angle(axis, angle):
    x, y, z = norm(axis)
    c, s, t = math.cos(angle), math.sin(angle), 1 - math.cos(angle)
    return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
            [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
            [t * x * z - s * y, t * y * z + s * x, t * z * z + c]]


def swing(d0, d):
    """Smallest rotation taking direction d0 to d (the blade swings along an arc without twisting)."""
    d0, d = norm(d0), norm(d)
    axis = cross(d0, d)
    sin = math.sqrt(sum(a * a for a in axis))
    cos = sum(a * b for a, b in zip(d0, d))
    if sin < 1e-9:
        return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    return axis_angle(axis, math.atan2(sin, cos))


def solve_first_person(hold, offset, blade, roll=0.0):
    """The blade sits at (rest grip position + offset), pointing along `blade` (swung from the rest pose along
    the shortest arc, then rolled by `roll` degrees around the blade).

    The arm keeps its base rotation (only moves); the blade turns around the fist via the rightitem bone.
    Returns (rightitem rotation, extra rightarm offset)."""
    hold_pos, hold_rot = hold
    rest = grip_world(FP_ARM_POS, FP_ARM_ROT, hold_pos)
    target = add(rest, offset)
    arm = rotation(FP_ARM_ROT)
    rest_blade = tuple(mat_mul(arm, rotation(hold_rot))[i][1] for i in range(3))
    turn = mat_mul(axis_angle(blade, math.radians(roll)), swing(rest_blade, blade))
    item = mat_mul(transpose(arm), mat_mul(turn, arm))  # world rotation converted to the arm frame
    # Grip point when rightitem rotates around its pivot
    grip = add(add(v3(FP_ITEM_POS), v3(ITEM_PIVOT)), mat_vec(item, v3(hold_pos)))
    pivot = v3(ARM_PIVOT)
    local = mat_vec(arm, add(grip, pivot, -1))
    at_zero = tuple(PLAYER_SCALE * x for x in add(pivot, local))
    pos_three = tuple((t - g) / PLAYER_SCALE for t, g in zip(target, at_zero))
    pos = (-pos_three[0], pos_three[1], pos_three[2])
    return euler(item), tuple(p - b for p, b in zip(pos, FP_ARM_POS))


TP_ARM_REST = (-18.0, 0.0, 0.0)  # animation.player.holding: arms holding an item raised 18 degrees forward


def solve_third_person(hold, tp, blade, roll=0.0):
    """Wrist (rightitem) rotation so the blade points along `blade` with the body/arm in pose `tp`."""
    _, hold_rot = hold
    rest = rotation(TP_ARM_REST)
    rest_blade = tuple(mat_mul(rest, rotation(hold_rot))[i][1] for i in range(3))
    turn = mat_mul(axis_angle(blade, math.radians(roll)), swing(rest_blade, blade))
    body = rotation(tp.get("body", {}).get("rot", (0, 0, 0)))
    arm = rotation(add(TP_ARM_REST, tp.get("rightarm", {}).get("rot", (0, 0, 0))))
    return euler(mat_mul(transpose(mat_mul(body, arm)), mat_mul(turn, rest)))


def closest_euler(rot, previous):
    """The ZYX sets (x, y, z) and (x+180, 180-y, z+180) give the same orientation: pick the one (+/-360)
    closest to the previous keyframe so interpolation does not spin around."""
    best = None
    for cand in (list(rot), [rot[0] + 180, 180 - rot[1], rot[2] + 180]):
        for i in range(3):
            while cand[i] - previous[i] > 180:
                cand[i] -= 360
            while cand[i] - previous[i] < -180:
                cand[i] += 360
        cost = sum(abs(c - p) for c, p in zip(cand, previous))
        if best is None or cost < best[0]:
            best = (cost, cand)
    return best[1]


# ---------------------------------------------------------------------------
# Animation design
# ---------------------------------------------------------------------------
# Each keyframe:
#   "tp": {bone: {"rot": [...], "pos": [...]}} added on top of the current pose (third person)
#   "tp_blade": world blade direction in third person (+X right, +Y up, -Z in front of
#               the character); the wrist (rightitem) is solved so the blade points this way
#   "fp": (hand offset [x left, y up, z away from camera], blade direction [x left, y up, z forward])
# Keyframes without "tp_blade"/"fp" keep the blade in the normal hold.

ARM_UP = -150  # arm raised overhead


def key(tp=None, tp_blade=None, fp=None):
    return {"tp": tp or {}, "tp_blade": tp_blade, "fp": fp}


def pose(right=None, left=None, body=None, head=None, rleg=None, lleg=None, root=None):
    out = {}
    for bone, value in (("rightarm", right), ("leftarm", left), ("body", body), ("head", head),
                        ("rightleg", rleg), ("leftleg", lleg)):
        if value:
            out[bone] = {"rot": list(value)}
    if root:
        out["root"] = {"pos": list(root)}
    return out


# Every skill has the full rhythm: anticipation -> swing -> mid-swing -> impact -> overshoot -> hold -> recover.
# Catmull-Rom interpolation between keyframes makes the motion curved and smooth.
ANIMATIONS = {
    # Q cast 1: raise the blade over the right shoulder, then slash diagonally down to the left
    "q1": {"length": 0.85, "keys": {
        0.0: key(),
        0.1: key(pose(right=(12, 0, 8), body=(6, 8, 0), rleg=(8, 0, 0), lleg=(-6, 0, 0)),
                 (0.3, 0.1, -0.95), ((-1, -2, -1), (0.2, 0.9, 0.3))),
        0.28: key(pose(right=(ARM_UP, 10, 30), left=(-30, 0, -15), body=(-4, 20, 0), head=(-8, 0, 0),
                       rleg=(10, 0, 0), lleg=(-8, 0, 0)),
                  (0.35, 0.6, 0.7), ((-2, 5, 2), (-0.2, 0.9, 0.3))),
        0.38: key(pose(right=(-110, -5, 10), left=(-10, 0, -12), body=(4, 0, 0), rleg=(-5, 0, 0), lleg=(5, 0, 0)),
                  (0.0, 0.35, -0.95), ((3, 4, 5), (0.35, 0.65, 0.7))),
        0.45: key(pose(right=(-55, -30, -10), left=(10, 0, -10), body=(12, -22, 0), head=(6, -8, 0),
                       rleg=(-15, 0, 0), lleg=(15, 0, 0), root=(0, -0.5, 0)),
                  (-0.5, -0.45, -0.75), ((8, 1, 6), (0.9, -0.2, 0.4))),
        0.52: key(pose(right=(-40, -42, -18), left=(15, 0, -12), body=(16, -28, 0), head=(8, -10, 0),
                       rleg=(-18, 0, 0), lleg=(18, 0, 0), root=(0, -0.8, 0)),
                  (-0.6, -0.55, -0.6), ((10, -1, 6), (0.9, -0.35, 0.35))),
        0.64: key(pose(right=(-45, -35, -12), left=(12, 0, -10), body=(13, -24, 0), head=(6, -8, 0),
                       rleg=(-15, 0, 0), lleg=(15, 0, 0), root=(0, -0.6, 0)),
                  (-0.55, -0.5, -0.7), ((9, 0, 6), (0.9, -0.3, 0.4))),
        0.85: key(),
    }},
    # Q cast 2: horizontal sweep from right to left
    "q2": {"length": 0.85, "keys": {
        0.0: key(),
        0.1: key(pose(right=(-20, 20, 10), body=(0, 12, 0)), (0.4, 0.1, -0.9), ((-1, 0, 0), (-0.2, 0.9, 0.35))),
        0.28: key(pose(right=(-75, 55, 20), left=(-20, 0, -20), body=(0, 32, 0), head=(0, -10, 0),
                       rleg=(8, 0, 0), lleg=(-8, 0, 0)),
                  (0.8, 0.15, 0.5), ((-3, 2, 3), (-0.8, 0.3, 0.5))),
        0.38: key(pose(right=(-85, 5, 10), left=(-5, 0, -18), body=(2, 5, 0)),
                  (0.1, 0.1, -1.0), ((3, 1, 5), (0.1, 0.3, 0.95))),
        0.45: key(pose(right=(-80, -65, 0), left=(10, 0, -15), body=(5, -30, 0), head=(0, 8, 0),
                       rleg=(-10, 0, 0), lleg=(10, 0, 0)),
                  (-0.85, 0.05, -0.5), ((9, 0, 5), (0.95, 0.1, 0.3))),
        0.52: key(pose(right=(-76, -78, -5), left=(14, 0, -15), body=(6, -38, 0), head=(0, 10, 0),
                       rleg=(-12, 0, 0), lleg=(12, 0, 0)),
                  (-0.95, 0.0, -0.25), ((11, -1, 5), (0.97, 0.0, 0.2))),
        0.64: key(pose(right=(-78, -70, 0), left=(10, 0, -15), body=(5, -33, 0), rleg=(-10, 0, 0), lleg=(10, 0, 0)),
                  (-0.9, 0.0, -0.4), ((10, -1, 5), (0.95, 0.0, 0.3))),
        0.85: key(),
    }},
    # Q cast 3: crouch, leap, raise the blade overhead with both hands, then slam the ground
    "q3": {"length": 0.95, "keys": {
        0.0: key(),
        0.1: key(pose(right=(10, 0, 5), left=(10, 0, -5), body=(12, 0, 0), rleg=(-20, 0, 0), lleg=(-20, 0, 0),
                      root=(0, -1.2, 0)),
                 (0.2, -0.2, -0.95), ((0, -3, 0), (0.2, 0.85, 0.45))),
        0.25: key(pose(right=(-170, 0, 10), left=(-170, 0, -10), body=(-12, 0, 0), head=(-12, 0, 0),
                       rleg=(-25, 0, 0), lleg=(-10, 0, 0), root=(0, 2.8, 0)),
                  (0.0, 0.5, 0.85), ((3, 8, 5), (0.05, 0.95, 0.3))),
        0.36: key(pose(right=(-120, -5, 5), left=(-120, 5, -5), body=(8, 0, 0), rleg=(-30, 0, 0), lleg=(10, 0, 0),
                       root=(0, 1.5, 0)),
                  (0.0, 0.3, -0.95), ((5, 8, 7), (0.3, 0.2, 0.93))),
        0.45: key(pose(right=(-45, -10, 0), left=(-45, 10, 0), body=(28, 0, 0), head=(10, 0, 0),
                       rleg=(-35, 0, 0), lleg=(25, 0, 0), root=(0, -1.5, 0)),
                  (0.0, -0.6, -0.8), ((8, 7, 8), (0.5, -0.8, 0.35))),
        0.52: key(pose(right=(-38, -12, 0), left=(-38, 12, 0), body=(33, 0, 0), head=(14, 0, 0),
                       rleg=(-40, 0, 0), lleg=(30, 0, 0), root=(0, -2.2, 0)),
                  (0.0, -0.7, -0.7), ((8, 6, 8), (0.5, -0.84, 0.3))),
        0.68: key(pose(right=(-45, -10, 0), left=(-45, 10, 0), body=(26, 0, 0), head=(8, 0, 0),
                       rleg=(-32, 0, 0), lleg=(24, 0, 0), root=(0, -1.6, 0)),
                  (0.0, -0.65, -0.75), ((8, 6, 8), (0.5, -0.82, 0.3))),
        0.95: key(),
    }},
    # E: gather, lunge forward, blade dragging behind
    "e": {"length": 0.6, "keys": {
        0.0: key(),
        0.05: key(pose(body=(-8, 0, 0), right=(-10, 0, 5), rleg=(8, 0, 0), lleg=(-8, 0, 0), root=(0, -0.5, 0)),
                  (0.2, 0.3, -0.9), ((0, -1, 0), (0.25, 0.9, 0.35))),
        0.12: key(pose(body=(32, 0, 0), right=(48, 0, 15), left=(48, 0, -15), head=(-15, 0, 0),
                       rleg=(-42, 0, 0), lleg=(38, 0, 0), root=(0, -1, 0)),
                  (0.3, -0.3, 0.9), ((-1, -3, -2), (0.2, 0.35, 0.9))),
        0.36: key(pose(body=(28, 0, 0), right=(40, 0, 12), left=(40, 0, -12), head=(-12, 0, 0),
                       rleg=(-36, 0, 0), lleg=(32, 0, 0), root=(0, -1, 0)),
                  (0.3, -0.35, 0.88), ((-1, -3, -2), (0.2, 0.35, 0.9))),
        0.46: key(pose(body=(-5, 0, 0), right=(-5, 0, 5), rleg=(10, 0, 0), lleg=(-10, 0, 0), root=(0, -0.3, 0)),
                  None, ((0, -1, 0), (0.2, 0.9, 0.35))),
        0.6: key(),
    }},
    # W: pull the left arm back, then throw the chain forward
    "w": {"length": 0.75, "keys": {
        0.0: key(),
        0.12: key(pose(left=(35, 0, -25), body=(0, -18, 0), right=(10, 0, 0), head=(0, 8, 0)),
                  None, ((-1, -3, -2), (0.2, 0.9, 0.3))),
        0.22: key(pose(left=(-80, -5, 0), body=(2, 10, 0), right=(12, 0, 3)), None, ((-2, -4, -3), (0.2, 0.9, 0.3))),
        0.28: key(pose(left=(-105, -12, 6), body=(4, 24, 0), right=(15, 0, 5), head=(0, -6, 0), lleg=(-12, 0, 0),
                       rleg=(10, 0, 0)),
                  None, ((-2, -5, -3), (0.2, 0.9, 0.3))),
        0.5: key(pose(left=(-100, -10, 5), body=(2, 20, 0), right=(15, 0, 5), lleg=(-10, 0, 0), rleg=(8, 0, 0)),
                 None, ((-2, -5, -3), (0.2, 0.9, 0.3))),
        0.75: key(),
    }},
    # R: crouch to gather power, then roar, spreading the arms with the blade raised to the sky
    "r": {"length": 1.25, "keys": {
        0.0: key(),
        0.15: key(pose(body=(22, 0, 0), head=(15, 0, 0), right=(-15, 0, 12), left=(-15, 0, -12),
                       rleg=(-20, 0, 0), lleg=(-20, 0, 0), root=(0, -1.5, 0)),
                  None, ((0, -3, 0), (0.2, 0.9, 0.35))),
        0.3: key(pose(right=(-120, 0, 25), left=(-120, 0, -25), body=(-5, 0, 0), root=(0, 0.3, 0)),
                 (0.25, 0.8, -0.5), ((3, 5, 3), (0.1, 0.95, 0.3))),
        0.4: key(pose(right=(-170, 0, 32), left=(-170, 0, -32), body=(-18, 0, 0), head=(-35, 0, 0), root=(0, 0.8, 0)),
                 (0.25, 0.95, 0.1), ((5, 8, 5), (0.1, 0.97, 0.2))),
        0.9: key(pose(right=(-162, 0, 28), left=(-162, 0, -28), body=(-14, 0, 0), head=(-28, 0, 0), root=(0, 0.5, 0)),
                 (0.25, 0.95, 0.1), ((5, 9, 5), (0.1, 0.97, 0.2))),
        1.25: key(),
    }},
}
BONES = ["root", "body", "head", "rightarm", "rightitem", "leftarm", "rightleg", "leftleg"]


def euler_candidates(rot):
    """Every equivalent ZYX set (2 branches, +/-360 on each axis)."""
    out = []
    for base in (list(rot), [rot[0] + 180, 180 - rot[1], rot[2] + 180]):
        for dx in (-360, 0, 360):
            for dy in (-360, 0, 360):
                for dz in (-360, 0, 360):
                    out.append([base[0] + dx, base[1] + dy, base[2] + dz])
    return out


def smooth_path(rotations):
    """Pick an angle set for each keyframe minimizing the total rotation, with the first and last exactly 0
    (prevents the arm/blade from spinning during interpolation or while the animation blends out)."""
    zero = [[0.0, 0.0, 0.0]]
    layers = [zero] + [euler_candidates(r) for r in rotations[1:-1]] + [zero]
    cost = [0.0]
    back = [[]]
    for i in range(1, len(layers)):
        cur_cost, cur_back = [], []
        for c in layers[i]:
            best = min(range(len(layers[i - 1])),
                       key=lambda j: cost[j] + sum(abs(x - y) for x, y in zip(c, layers[i - 1][j])))
            cur_cost.append(cost[best] + sum(abs(x - y) for x, y in zip(c, layers[i - 1][best])))
            cur_back.append(best)
        cost, back = cur_cost, back + [cur_back]
    path, j = [], 0
    for i in range(len(layers) - 1, -1, -1):
        path.append(layers[i][j])
        if i:
            j = back[i][j]
    return path[::-1]


def sample_keys(root):
    """All solved keyframes: {anim: {time: {"tp": {bone: {rot,pos}}, "fp": {"rot","pos"}}}}.
    tp also has rightitem.rot (wrist); fp.rot is the rightitem rotation, fp.pos the extra rightarm
    offset in first person."""
    hold_fp, hold_tp = load_hold(root, "first_person"), load_hold(root, "third_person")
    result = {}
    for name, anim in ANIMATIONS.items():
        times = sorted(anim["keys"])
        fp_rot, fp_pos, tp_rot = [], [], []
        for t in times:
            k = anim["keys"][t]
            r, p = solve_first_person(hold_fp, *k["fp"]) if k["fp"] else ((0.0, 0.0, 0.0), (0, 0, 0))
            fp_rot.append(r)
            fp_pos.append(p)
            tp_rot.append(solve_third_person(hold_tp, k["tp"], k["tp_blade"]) if k["tp_blade"] else (0.0, 0.0, 0.0))
        for t, k in ((times[0], anim["keys"][times[0]]), (times[-1], anim["keys"][times[-1]])):
            if k["fp"] or k["tp_blade"]:
                raise ValueError(f"{name}: first/last keyframe must be the rest pose")
        fp_rot, tp_rot = smooth_path(fp_rot), smooth_path(tp_rot)
        frames = {}
        for i, t in enumerate(times):
            tp = {bone: dict(v) for bone, v in anim["keys"][t]["tp"].items()}
            tp["rightitem"] = {"rot": list(tp_rot[i])}
            frames[t] = {"tp": tp, "fp": {"rot": list(fp_rot[i]), "pos": list(fp_pos[i])}}
        result[name] = frames
    return result


def fmt(x):
    return float(f"{x:.2f}")


def molang(fp, tp):
    fp, tp = fmt(fp), fmt(tp)
    if fp == tp:
        return tp
    return f"v.is_first_person ? {fp} : {tp}"


SAMPLE_STEP = 0.04  # seconds between two linear keyframes when sampling the curve


def catmull(values, times, t):
    """Catmull-Rom interpolation (a curve through every keyframe) for one numeric channel."""
    i = max(k for k in range(len(times) - 1) if times[k] <= t) if t < times[-1] else len(times) - 2
    t0, t1 = times[i], times[i + 1]
    u = (t - t0) / (t1 - t0)
    p0 = values[max(i - 1, 0)]
    p1, p2 = values[i], values[i + 1]
    p3 = values[min(i + 2, len(values) - 1)]
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)


def build_animations(root):
    """Minecraft only allows curved interpolation when keyframes are constant numbers, but here every value
    is an expression choosing first/third person. So the Catmull-Rom curve is computed up front, sampled
    every SAMPLE_STEP seconds and exported as linear keyframes."""
    keys = sample_keys(root)
    animations = {}
    for name, anim in ANIMATIONS.items():
        times = sorted(keys[name])
        steps = max(1, round(anim["length"] / SAMPLE_STEP))
        sample_times = sorted(set([round(anim["length"] * i / steps, 3) for i in range(steps + 1)] + times))
        bones = {}
        for bone in BONES:
            for channel, key in (("rotation", "rot"), ("position", "pos")):
                tp_keys, fp_keys = [], []
                for t in times:
                    frame = keys[name][t]
                    tp_keys.append(list(frame["tp"].get(bone, {}).get(key, [0, 0, 0])))
                    if (bone, key) == ("rightarm", "pos"):
                        fp_keys.append(list(frame["fp"]["pos"]))
                    elif (bone, key) == ("rightitem", "rot"):
                        fp_keys.append(list(frame["fp"]["rot"]))
                    else:
                        fp_keys.append([0, 0, 0])  # first person only shows the right arm
                if not any(abs(v) > 1e-6 for row in tp_keys + fp_keys for v in row):
                    continue
                track = {}
                for t in sample_times:
                    tp = [catmull([k[c] for k in tp_keys], times, t) for c in range(3)]
                    fp = [catmull([k[c] for k in fp_keys], times, t) for c in range(3)]
                    track[f"{t:.2f}"] = [molang(f, p) for f, p in zip(fp, tp)]
                bones.setdefault(bone, {})[channel] = track
        animations[f"animation.aatrox.{name}"] = {"loop": False, "animation_length": anim["length"], "bones": bones}
    return {"format_version": "1.10.0", "animations": animations}


def write_player_animations(root):
    data = build_animations(root)
    path = os.path.join(root, "AatroxRP/animations/aatrox_player.animation.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
        f.write("\n")
    print(f"Player animations: {len(data['animations'])} skills")
