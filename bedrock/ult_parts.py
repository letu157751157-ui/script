"""Phần 3D chỉ hiện khi biến hình Kẻ Diệt Thế (R): cặp cánh quỷ sau lưng và cặp sừng trên đầu.

Các khối gắn vào bone body/head của người chơi qua attachable của kiếm phiên bản Diệt Thế.
Attachable gắn điểm (0, 24, 0) của model vào điểm xoay của bone được gắn; body và head của
người chơi đều có điểm xoay (0, 24, 0), nên toạ độ ở đây trùng toạ độ model người chơi.

Cánh được vẽ như sword_art: một bản vẽ pixel (u = khoảng cách ra ngoài, v = độ cao so với gốc
cánh) rồi đùn thành khối. Xương cánh dày 2, màng cánh dày 1, mép màng phát sáng.
"""
import math

WING_PIVOT = (-2, 21, 2.5)  # gốc cánh phải (bên phải người chơi là -X trong Bedrock)
BONE_ANGLES = (56, 26, 0, -24)  # các nan xương cánh (độ, so với phương ngang)
WING_MATERIALS = {
    "wbone": {"depth": 2, "glow": False},
    "membrane": {"depth": 1, "glow": False},
    "wedge": {"depth": 1, "glow": True},
}


def wing_art():
    art = {}
    for u in range(22):
        for v in range(-9, 18):
            px, py = u + 0.5, v + 0.5
            r = math.hypot(px, py)
            theta = math.degrees(math.atan2(py, px))
            if not -30 <= theta <= 60:
                continue
            reach = 21 - (60 - theta) * 0.09
            gap = min(abs(theta - b) for b in BONE_ANGLES)
            if theta < BONE_ANGLES[0]:
                reach -= gap * 0.22  # mép sau lượn sóng giữa các nan
            if r > reach:
                continue
            on_bone = any(abs(r * math.sin(math.radians(theta - b))) < 0.75 and math.cos(math.radians(theta - b)) > 0
                          for b in BONE_ANGLES)
            if r < 2 or on_bone:
                art[(u, v)] = "wbone"
            elif reach - r < 1.3:
                art[(u, v)] = "wedge"
            else:
                art[(u, v)] = "membrane"
    return art


WING_ART = wing_art()

# Sừng phải (x âm); sừng trái đối xứng. (origin, size) trong toạ độ model người chơi
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
    """Khối của cánh và sừng. wing_color(material, u, v) / horn_color(x, y) trả màu mặt trước."""
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


# bone của phần biến hình: (tên, cha, binding, pivot)
ULT_BONES = [
    ("ult_body", None, "'body'", (0, 24, 0)),
    ("wing_r", "ult_body", None, WING_PIVOT),
    ("wing_l", "ult_body", None, (-WING_PIVOT[0], WING_PIVOT[1], WING_PIVOT[2])),
    ("ult_head", None, "'head'", (0, 24, 0)),
]
