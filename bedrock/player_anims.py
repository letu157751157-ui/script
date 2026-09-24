"""Animation của người chơi khi dùng chiêu (phát bằng Entity.playAnimation trong script).

Mỗi keyframe có hai phần:
- Góc nhìn thứ 3: độ xoay/dịch cộng thêm cho các bone của người chơi (rightarm, leftarm,
  body, head, rightleg, leftleg, root), đơn vị Bedrock (độ, pixel).
- Góc nhìn thứ nhất: mô tả kiếm trên màn hình (dịch nắm tay so với lúc cầm bình thường,
  hướng lưỡi kiếm). Hàm solve_first_person() tính ngược ra độ xoay/dịch của rightarm,
  vì tay ở góc nhìn thứ nhất đã bị xoay sẵn [95, -45, 115] nên khó chỉnh tay trực tiếp.

Trong game, mỗi giá trị là biểu thức Molang "v.is_first_person ? <thứ nhất> : <thứ 3>":
người dùng chiêu thấy animation góc nhìn thứ nhất, người xung quanh thấy góc nhìn thứ 3.

Toạ độ góc nhìn thứ nhất (không gian model đã lật trục X như Blockbench):
camera ở mắt nhìn theo +Z, +X là bên TRÁI màn hình, +Y là phía trên.
"""
import json
import math
import os

HOLD_FP_FILE = "AatroxRP/animations/darkin_blade.animation.json"
PLAYER_SCALE = 0.9375  # scale của model người chơi (player.entity.json)
EYE = (0.0, 1.62 * 16, 0.0)
FP_ARM_POS = (13.5, -10.0, 12.0)  # animation.player.first_person.empty_hand
FP_ARM_ROT = (95.0, -45.0, 115.0)
FP_ITEM_POS = (0.0, 0.0, -1.0)  # rightitem: 22 - 15 - 7, -1
ARM_PIVOT = (-5.0, 22.0, 0.0)
ITEM_PIVOT = (-6.0, 15.0, 1.0)

# ---------------------------------------------------------------------------
# Toán ma trận nhỏ (quy ước Bedrock -> three.js giống Blockbench: lật X, xoay thứ tự ZYX)
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
# Giải ngược tay phải ở góc nhìn thứ nhất
# ---------------------------------------------------------------------------


def load_hold(root, view="first_person"):
    with open(os.path.join(root, HOLD_FP_FILE), encoding="utf-8") as f:
        bone = json.load(f)["animations"][f"animation.aatrox.darkin_blade.hold_{view}"]["bones"]["darkin_blade"]
    return bone["position"], bone["rotation"]


def grip_point(hold_pos):
    """Điểm nắm (tâm tay cầm) trong toạ độ tuyệt đối của bone rightarm."""
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
    """Phép quay nhỏ nhất đưa hướng d0 về d (kiếm vung theo cung tròn, không bị vặn mặt)."""
    d0, d = norm(d0), norm(d)
    axis = cross(d0, d)
    sin = math.sqrt(sum(a * a for a in axis))
    cos = sum(a * b for a, b in zip(d0, d))
    if sin < 1e-9:
        return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    return axis_angle(axis, math.atan2(sin, cos))


def solve_first_person(hold, offset, blade, roll=0.0):
    """Kiếm nằm ở (vị trí nắm lúc nghỉ + offset), lưỡi theo hướng `blade` (vung từ tư thế nghỉ theo
    cung ngắn nhất, rồi lật mặt kiếm thêm `roll` độ quanh lưỡi).

    Tay giữ nguyên độ xoay gốc (chỉ dịch chuyển), kiếm xoay quanh nắm tay bằng bone rightitem.
    Trả về (độ xoay rightitem, độ dịch cộng thêm cho rightarm)."""
    hold_pos, hold_rot = hold
    rest = grip_world(FP_ARM_POS, FP_ARM_ROT, hold_pos)
    target = add(rest, offset)
    arm = rotation(FP_ARM_ROT)
    rest_blade = tuple(mat_mul(arm, rotation(hold_rot))[i][1] for i in range(3))
    turn = mat_mul(axis_angle(blade, math.radians(roll)), swing(rest_blade, blade))
    item = mat_mul(transpose(arm), mat_mul(turn, arm))  # phép quay thế giới đổi sang khung của tay
    # Điểm nắm khi rightitem xoay quanh pivot của nó
    grip = add(add(v3(FP_ITEM_POS), v3(ITEM_PIVOT)), mat_vec(item, v3(hold_pos)))
    pivot = v3(ARM_PIVOT)
    local = mat_vec(arm, add(grip, pivot, -1))
    at_zero = tuple(PLAYER_SCALE * x for x in add(pivot, local))
    pos_three = tuple((t - g) / PLAYER_SCALE for t, g in zip(target, at_zero))
    pos = (-pos_three[0], pos_three[1], pos_three[2])
    return euler(item), tuple(p - b for p, b in zip(pos, FP_ARM_POS))


TP_ARM_REST = (-18.0, 0.0, 0.0)  # animation.player.holding: tay cầm đồ nâng ra trước 18 độ


def solve_third_person(hold, tp, blade, roll=0.0):
    """Độ xoay cổ tay (rightitem) để lưỡi kiếm chĩa theo `blade` khi thân/tay ở tư thế `tp`."""
    _, hold_rot = hold
    rest = rotation(TP_ARM_REST)
    rest_blade = tuple(mat_mul(rest, rotation(hold_rot))[i][1] for i in range(3))
    turn = mat_mul(axis_angle(blade, math.radians(roll)), swing(rest_blade, blade))
    body = rotation(tp.get("body", {}).get("rot", (0, 0, 0)))
    arm = rotation(add(TP_ARM_REST, tp.get("rightarm", {}).get("rot", (0, 0, 0))))
    return euler(mat_mul(transpose(mat_mul(body, arm)), mat_mul(turn, rest)))


def closest_euler(rot, previous):
    """Hai bộ góc ZYX (x, y, z) và (x+180, 180-y, z+180) cho cùng một hướng: chọn bộ (đã cộng/trừ 360)
    gần keyframe trước nhất để nội suy không xoay vòng."""
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
# Thiết kế animation
# ---------------------------------------------------------------------------
# Mỗi keyframe:
#   "tp": {bone: {"rot": [...], "pos": [...]}} cộng thêm vào tư thế hiện có (góc nhìn thứ 3)
#   "tp_blade": hướng lưỡi kiếm trong thế giới ở góc nhìn thứ 3 (+X phải, +Y lên, -Z phía trước
#               nhân vật); cổ tay (rightitem) được giải ngược để lưỡi chĩa đúng hướng này
#   "fp": (dịch nắm tay [x trái, y lên, z xa camera], hướng lưỡi [x trái, y lên, z tới])
# Keyframe thiếu "tp_blade"/"fp" thì kiếm ở tư thế cầm bình thường.

ARM_UP = -150  # giơ tay qua đầu


def key(tp=None, tp_blade=None, fp=None):
    return {"tp": tp or {}, "tp_blade": tp_blade, "fp": fp}


Q1_STRIKE = {"rightarm": {"rot": [-55, -30, -10]}, "leftarm": {"rot": [10, 0, -10]}, "body": {"rot": [12, -22, 0]},
             "rightleg": {"rot": [-15, 0, 0]}, "leftleg": {"rot": [15, 0, 0]}}
Q2_STRIKE = {"rightarm": {"rot": [-80, -65, 0]}, "leftarm": {"rot": [10, 0, -15]}, "body": {"rot": [5, -30, 0]},
             "rightleg": {"rot": [-10, 0, 0]}, "leftleg": {"rot": [10, 0, 0]}}
Q3_SLAM = {"rightarm": {"rot": [-45, -10, 0]}, "leftarm": {"rot": [-45, 10, 0]}, "body": {"rot": [28, 0, 0]},
           "root": {"pos": [0, -1.5, 0]}, "rightleg": {"rot": [-35, 0, 0]}, "leftleg": {"rot": [25, 0, 0]}}
E_DASH = {"body": {"rot": [30, 0, 0]}, "rightarm": {"rot": [45, 0, 15]}, "leftarm": {"rot": [45, 0, -15]},
          "rightleg": {"rot": [-40, 0, 0]}, "leftleg": {"rot": [35, 0, 0]}, "root": {"pos": [0, -1, 0]}}
W_THROW = {"leftarm": {"rot": [-100, -10, 5]}, "body": {"rot": [0, 20, 0]}, "rightarm": {"rot": [15, 0, 5]}}
R_ROAR = {"rightarm": {"rot": [-165, 0, 30]}, "leftarm": {"rot": [-165, 0, -30]}, "body": {"rot": [-15, 0, 0]},
          "head": {"rot": [-30, 0, 0]}, "root": {"pos": [0, 0.5, 0]}}

ANIMATIONS = {
    # Q lần 1: giơ kiếm qua vai phải rồi chém chéo xuống bên trái
    "q1": {"length": 0.8, "keys": {
        0.0: key(),
        0.28: key({"rightarm": {"rot": [ARM_UP, 10, 30]}, "leftarm": {"rot": [-30, 0, -15]}, "body": {"rot": [0, 18, 0]}},
                  (0.35, 0.6, 0.7), ((-2, 5, 2), (-0.2, 0.9, 0.3))),
        0.45: key(Q1_STRIKE, (-0.5, -0.45, -0.75), ((8, 1, 6), (0.9, -0.2, 0.4))),
        0.56: key(Q1_STRIKE, (-0.55, -0.5, -0.7), ((9, 0, 6), (0.9, -0.3, 0.4))),
        0.8: key(),
    }},
    # Q lần 2: quét ngang từ phải sang trái
    "q2": {"length": 0.8, "keys": {
        0.0: key(),
        0.28: key({"rightarm": {"rot": [-75, 55, 20]}, "leftarm": {"rot": [-20, 0, -20]}, "body": {"rot": [0, 30, 0]}},
                  (0.8, 0.15, 0.5), ((-3, 2, 3), (-0.8, 0.3, 0.5))),
        0.45: key(Q2_STRIKE, (-0.85, 0.05, -0.5), ((9, 0, 5), (0.95, 0.1, 0.3))),
        0.56: key(Q2_STRIKE, (-0.9, 0.0, -0.4), ((10, -1, 5), (0.95, 0.0, 0.3))),
        0.8: key(),
    }},
    # Q lần 3: nhảy lên, hai tay giơ kiếm qua đầu rồi nện xuống đất
    "q3": {"length": 0.85, "keys": {
        0.0: key(),
        0.25: key({"rightarm": {"rot": [-170, 0, 10]}, "leftarm": {"rot": [-170, 0, -10]}, "body": {"rot": [-10, 0, 0]},
                   "root": {"pos": [0, 2.5, 0]}, "rightleg": {"rot": [-25, 0, 0]}, "leftleg": {"rot": [-10, 0, 0]}},
                  (0.0, 0.5, 0.85), ((3, 8, 5), (0.05, 0.95, 0.3))),
        0.45: key(Q3_SLAM, (0.0, -0.6, -0.8), ((8, 7, 8), (0.5, -0.8, 0.35))),
        0.6: key(Q3_SLAM, (0.0, -0.65, -0.75), ((8, 6, 8), (0.5, -0.82, 0.3))),
        0.85: key(),
    }},
    # E: lao người về trước, kiếm kéo lê phía sau
    "e": {"length": 0.5, "keys": {
        0.0: key(),
        0.08: key(E_DASH, (0.3, -0.3, 0.9), ((-1, -3, -2), (0.2, 0.35, 0.9))),
        0.32: key(E_DASH, (0.3, -0.3, 0.9), ((-1, -3, -2), (0.2, 0.35, 0.9))),
        0.5: key(),
    }},
    # W: tay trái phóng xích về phía trước
    "w": {"length": 0.65, "keys": {
        0.0: key(),
        0.12: key({"leftarm": {"rot": [35, 0, -25]}, "body": {"rot": [0, -15, 0]}, "rightarm": {"rot": [10, 0, 0]}},
                  None, ((-1, -3, -2), (0.45, 0.75, 0.5))),
        0.25: key(W_THROW, None, ((-2, -5, -3), (0.4, 0.75, 0.55))),
        0.45: key(W_THROW, None, ((-2, -5, -3), (0.4, 0.75, 0.55))),
        0.65: key(),
    }},
    # R: khom người rồi gầm lên, dang tay giơ kiếm lên trời
    "r": {"length": 1.1, "keys": {
        0.0: key(),
        0.12: key({"body": {"rot": [15, 0, 0]}, "root": {"pos": [0, -1, 0]}, "rightarm": {"rot": [-20, 0, 10]},
                   "leftarm": {"rot": [-20, 0, -10]}}, None, ((0, -3, 0), (0.5, 0.7, 0.6))),
        0.35: key(R_ROAR, (0.25, 0.95, 0.1), ((5, 8, 5), (0.1, 0.97, 0.2))),
        0.8: key(R_ROAR, (0.25, 0.95, 0.1), ((5, 9, 5), (0.1, 0.97, 0.2))),
        1.1: key(),
    }},
}
BONES = ["root", "body", "head", "rightarm", "rightitem", "leftarm", "rightleg", "leftleg"]


def sample_keys(root):
    """Toàn bộ keyframe đã giải: {anim: {time: {"tp": {bone: {rot,pos}}, "fp": {"rot","pos"}}}}.
    tp có thêm rightitem.rot (cổ tay); fp.rot là độ xoay rightitem, fp.pos là độ dịch cộng thêm
    của rightarm ở góc nhìn thứ nhất."""
    hold_fp, hold_tp = load_hold(root, "first_person"), load_hold(root, "third_person")
    result = {}
    for name, anim in ANIMATIONS.items():
        frames = {}
        prev_fp, prev_tp = [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]
        for t in sorted(anim["keys"]):
            k = anim["keys"][t]
            fp_rot, fp_pos = solve_first_person(hold_fp, *k["fp"]) if k["fp"] else ((0.0, 0.0, 0.0), (0, 0, 0))
            tp_rot = solve_third_person(hold_tp, k["tp"], k["tp_blade"]) if k["tp_blade"] else (0.0, 0.0, 0.0)
            prev_fp, prev_tp = closest_euler(fp_rot, prev_fp), closest_euler(tp_rot, prev_tp)
            tp = {bone: dict(v) for bone, v in k["tp"].items()}
            tp["rightitem"] = {"rot": list(prev_tp)}
            frames[t] = {"tp": tp, "fp": {"rot": list(prev_fp), "pos": list(fp_pos)}}
        if any(abs(v) > 1e-6 for v in prev_fp + prev_tp):
            raise ValueError(f"{name}: keyframe cuối không về 0, cần thêm keyframe trung gian")
        result[name] = frames
    return result


def fmt(x):
    return float(f"{x:.2f}")


def molang(fp, tp):
    fp, tp = fmt(fp), fmt(tp)
    if fp == tp:
        return tp
    return f"v.is_first_person ? {fp} : {tp}"


def build_animations(root):
    keys = sample_keys(root)
    animations = {}
    for name, anim in ANIMATIONS.items():
        bones = {}
        for bone in BONES:
            for channel, key in (("rotation", "rot"), ("position", "pos")):
                track = {}
                used = False
                for t, frame in keys[name].items():
                    tp = frame["tp"].get(bone, {}).get(key, [0, 0, 0])
                    if (bone, key) == ("rightarm", "pos"):
                        fp = frame["fp"]["pos"]
                    elif (bone, key) == ("rightitem", "rot"):
                        fp = frame["fp"]["rot"]
                    else:
                        fp = [0, 0, 0]  # góc nhìn thứ nhất chỉ thấy tay phải
                    used = used or any(abs(v) > 1e-6 for v in list(tp) + list(fp))
                    track[f"{t:.2f}"] = [molang(f, p) for f, p in zip(fp, tp)]
                if used:
                    bones.setdefault(bone, {})[channel] = track
        animations[f"animation.aatrox.{name}"] = {"loop": False, "animation_length": anim["length"], "bones": bones}
    return {"format_version": "1.10.0", "animations": animations}


def write_player_animations(root):
    data = build_animations(root)
    path = os.path.join(root, "AatroxRP/animations/aatrox_player.animation.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
        f.write("\n")
    print(f"Animation người chơi: {len(data['animations'])} chiêu")
