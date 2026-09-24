"""Model 3D Quỷ Kiếm Darkin (phong cách khối Minecraft) + texture box-UV.

Mỗi khối được khai báo một lần ở CUBES; script tự xếp UV, vẽ texture và xuất
file geometry cho resource pack, nên sửa model chỉ cần sửa danh sách bên dưới.

Toạ độ tính bằng pixel (16 px = 1 block). Tâm chuôi kiếm (chỗ tay cầm) nằm ở
y = GRIP_Y, trùng điểm xoay của bone gốc giống model cây đinh ba của Minecraft.
Lưỡi kiếm chĩa theo +Y, bề rộng theo X, bề dày theo Z.
"""
import json
import os
import random

GRIP_Y = 24
TEXTURE_SIZE = (64, 128)

# Bảng màu
LEATHER = (70, 34, 26)
LEATHER_DARK = (40, 18, 14)
METAL = (78, 16, 22)
METAL_DARK = (40, 6, 10)
FLESH = (58, 6, 14)
CRIMSON = (150, 16, 28)
EDGE = (222, 72, 56)
SPINE = (68, 8, 16)
LAVA = (240, 110, 30)
EYE = (255, 196, 48)
PUPIL = (40, 0, 4)
IRIS = (230, 70, 20)

# (bone, tên, origin, size, kiểu tô, xoay: (pivot, rotation) hoặc None)
# origin.y tính từ tâm chuôi; GRIP_Y được cộng khi xuất file.
CUBES = [
    # Chuôi
    ("hilt", "pommel_spike", (-1, -14, -1), (2, 3, 2), "metal_dark", None),
    ("hilt", "pommel", (-2, -11, -2), (4, 3, 4), "metal", None),
    ("hilt", "grip", (-1, -8, -1), (2, 12, 2), "leather", None),
    ("hilt", "guard", (-6, 4, -2), (12, 3, 4), "metal", None),
    ("hilt", "guard_wing_left", (-10, 5, -1), (4, 2, 2), "metal_dark", ((-6, 6, 0), (0, 0, -30))),
    ("hilt", "guard_wing_right", (6, 5, -1), (4, 2, 2), "metal_dark", ((6, 6, 0), (0, 0, 30))),
    # Hốc mắt Darkin ở gốc lưỡi
    ("hilt", "eye_socket", (-5, 7, -2), (10, 9, 4), "flesh", None),
    ("hilt", "eye_lid", (-4, 14, -2.5), (8, 1, 5), "metal_dark", None),
    ("hilt", "eye", (-2.5, 9, -2.5), (5, 5, 5), "eye", None),
    # Lưỡi
    ("blade", "blade", (-4, 16, -1), (8, 22, 2), "crimson", None),
    ("blade", "edge", (4, 16, -1), (1, 21, 2), "edge", None),
    ("blade", "spine", (-6, 16, -1.5), (2, 20, 3), "spine", None),
    ("blade", "vein", (-1, 18, -1.5), (1, 17, 3), "lava", None),
    ("blade", "vein_branch", (1, 22, -1.25), (2, 1, 3), "lava", ((1, 22, 0), (0, 0, 35))),
    ("blade", "spike_low", (-10, 18, -0.5), (4, 2, 1), "spine", ((-6, 19, 0), (0, 0, -35))),
    ("blade", "spike_mid", (-10, 25, -0.5), (4, 2, 1), "spine", ((-6, 26, 0), (0, 0, -35))),
    ("blade", "spike_high", (-10, 32, -0.5), (4, 2, 1), "spine", ((-6, 33, 0), (0, 0, -35))),
    # Mũi kiếm cong về phía sống
    ("tip", "tip_1", (-5, 38, -1), (9, 4, 2), "crimson", None),
    ("tip", "tip_edge", (4, 38, -1), (1, 3, 2), "edge", None),
    ("tip", "tip_2", (-4, 42, -1), (7, 4, 2), "crimson", None),
    ("tip", "tip_3", (-3, 46, -1), (5, 3, 2), "crimson", None),
    ("tip", "tip_4", (-2, 49, -1), (3, 3, 2), "edge", None),
    ("tip", "tip_hook", (-5, 51, -0.5), (3, 2, 1), "spine", None),
]

BONES = [
    # (tên, cha, pivot (y tính từ tâm chuôi), rotation)
    ("hilt", "darkin_blade", (0, 0, 0), None),
    ("blade", "darkin_blade", (0, 0, 0), None),
    ("tip", "blade", (0, 38, 0), (0, 0, 10)),
]


def shift(point):
    return [point[0], point[1] + GRIP_Y, point[2]]


def pack_uvs():
    """Xếp vùng box-UV của từng khối lên texture theo từng hàng."""
    width, height = TEXTURE_SIZE
    x = y = row_height = 0
    uvs = []
    for cube in CUBES:
        w, h, d = cube[3]
        region_w, region_h = 2 * (w + d), d + h
        if x + region_w > width:
            x, y, row_height = 0, y + row_height, 0
        if y + region_h > height:
            raise ValueError("Texture quá nhỏ, tăng TEXTURE_SIZE")
        uvs.append((x, y))
        x += region_w
        row_height = max(row_height, region_h)
    return uvs


def clamp(value):
    return max(0, min(255, int(value)))


def shade(color, amount):
    return tuple(clamp(c + amount) for c in color)


def face_rects(u, v, size):
    """Các mặt của box-UV: tên -> (x, y, rộng, cao)."""
    w, h, d = size
    return {
        "up": (u + d, v, w, d),
        "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h),
        "south": (u + 2 * d + w, v + d, w, h),
    }


def paint_face(pixels, rect, style, face, rng):
    fx, fy, fw, fh = rect
    for j in range(fh):
        for i in range(fw):
            t = j / max(fh - 1, 1)  # 0 = đỉnh mặt, 1 = đáy mặt
            border = i == 0 or j == 0 or i == fw - 1 or j == fh - 1
            noise = rng.randint(-8, 8)

            if style == "leather":
                color = LEATHER_DARK if j % 3 == 0 else shade(LEATHER, noise)
            elif style == "eye":
                if face in ("north", "south"):
                    offset = abs(i - (fw - 1) / 2)
                    if offset < 0.6 and 0 < j < fh - 1:
                        color = PUPIL  # đồng tử dọc
                    elif offset < 1.6 and 0 < j < fh - 1:
                        color = IRIS
                    elif j in (0, fh - 1):
                        color = shade(FLESH, 10)
                    else:
                        color = shade(EYE, noise)
                else:
                    color = shade(EYE, -40 + noise)
            elif style == "lava":
                color = shade(LAVA, 30 if 0 < i < fw - 1 else noise)
            elif style == "crimson":
                # Tối dần về phía chuôi, thêm vết sẫm như thớ thịt
                color = shade(CRIMSON, -int(t * 30) + noise)
                if rng.random() < 0.08:
                    color = shade(CRIMSON, -55)
            else:
                base = {
                    "metal": METAL,
                    "metal_dark": METAL_DARK,
                    "flesh": FLESH,
                    "edge": EDGE,
                    "spine": SPINE,
                }[style]
                color = shade(base, noise)

            if border and style not in ("eye", "lava", "leather"):
                color = shade(color, -25)
            pixels[fy + j][fx + i] = (*color, 255)


def build_texture():
    rng = random.Random(1337)  # cố định để texture không đổi mỗi lần build
    width, height = TEXTURE_SIZE
    pixels = [[(0, 0, 0, 0)] * width for _ in range(height)]
    uvs = pack_uvs()
    for cube, (u, v) in zip(CUBES, uvs):
        for face, rect in face_rects(u, v, cube[3]).items():
            paint_face(pixels, rect, cube[4], face, rng)
    return pixels, uvs


def build_geometry(uvs):
    bones = [
        {
            "name": "darkin_blade",
            # Gắn vào xương tay đang cầm (rightitem / leftitem)
            "binding": "q.item_slot_to_bone_name(c.item_slot)",
            "pivot": [0, GRIP_Y, 0],
        }
    ]
    for name, parent, pivot, rotation in BONES:
        bone = {"name": name, "parent": parent, "pivot": shift(pivot), "cubes": []}
        if rotation:
            bone["rotation"] = list(rotation)
        bones.append(bone)
    by_name = {bone["name"]: bone for bone in bones}

    for (bone, _name, origin, size, _style, turn), uv in zip(CUBES, uvs):
        cube = {"origin": shift(origin), "size": list(size), "uv": list(uv)}
        if turn:
            cube["pivot"] = shift(turn[0])
            cube["rotation"] = list(turn[1])
        by_name[bone]["cubes"].append(cube)

    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": "geometry.aatrox.darkin_blade",
                    "texture_width": TEXTURE_SIZE[0],
                    "texture_height": TEXTURE_SIZE[1],
                    "visible_bounds_width": 6,
                    "visible_bounds_height": 6,
                    "visible_bounds_offset": [0, 1.5, 0],
                },
                "bones": bones,
            }
        ],
    }


def write_model(root, write_png):
    pixels, uvs = build_texture()
    write_png(os.path.join(root, "AatroxRP/textures/entity/darkin_blade.png"), pixels)
    path = os.path.join(root, "AatroxRP/models/entity/darkin_blade.geo.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(build_geometry(uvs), f, indent=2)
        f.write("\n")
