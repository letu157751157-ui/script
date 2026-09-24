"""Model 3D Quỷ Kiếm Darkin (phong cách khối Minecraft) + texture HD.

Mỗi khối được khai báo một lần ở CUBES; script tự xếp UV, vẽ texture và xuất
file geometry cho resource pack, nên sửa model chỉ cần sửa danh sách bên dưới.

- Toạ độ tính bằng pixel (16 px = 1 block). Tâm chuôi kiếm (chỗ tay cầm) nằm ở
  y = GRIP_Y, trùng điểm xoay của bone gốc giống model cây đinh ba của Minecraft.
  Lưỡi chĩa theo +Y, bề rộng theo X, bề dày theo Z.
- Texture vẽ ở độ phân giải gấp TEXEL_SCALE lần kích thước UV (texture HD),
  Minecraft tự co giãn theo texture_width/texture_height khai báo trong geometry.
- Các khối kiểu "lava"/"eye"/"gem" được tách sang geometry phát sáng riêng,
  vẽ bằng material entity_emissive nên luôn sáng kể cả ban đêm.
"""
import json
import math
import os
import random

GRIP_Y = 24
UV_SIZE = (128, 128)  # kích thước UV khai báo trong geometry
TEXEL_SCALE = 4  # texture thật = 512x512
GLOW_STYLES = {"lava", "eye", "gem"}

# (bone, tên, origin, size, kiểu tô, xoay: (pivot, rotation) hoặc None)
# origin.y tính từ tâm chuôi; GRIP_Y được cộng khi xuất file.
CUBES = [
    # --- Núm chuôi: viên ngọc máu kẹp trong 4 móng vuốt ---
    ("hilt", "pommel_base", (-2, -11, -2), (4, 2, 4), "metal", None),
    ("hilt", "pommel_gem", (-1.5, -13, -1.5), (3, 2, 3), "gem", None),
    ("hilt", "pommel_claw_w", (-2.5, -14, -0.5), (1, 4, 1), "metal_dark", ((-2, -11, 0), (0, 0, 15))),
    ("hilt", "pommel_claw_e", (1.5, -14, -0.5), (1, 4, 1), "metal_dark", ((2, -11, 0), (0, 0, -15))),
    ("hilt", "pommel_claw_n", (-0.5, -14, -2.5), (1, 4, 1), "metal_dark", ((0, -11, -2), (-15, 0, 0))),
    ("hilt", "pommel_claw_s", (-0.5, -14, 1.5), (1, 4, 1), "metal_dark", ((0, -11, 2), (15, 0, 0))),
    ("hilt", "pommel_tip", (-0.5, -15, -0.5), (1, 1, 1), "bone", None),
    # --- Tay cầm quấn da, 3 vòng kim loại ---
    ("hilt", "grip", (-1, -9, -1), (2, 13, 2), "leather", None),
    ("hilt", "grip_ring_low", (-1.5, -9, -1.5), (3, 1, 3), "metal", None),
    ("hilt", "grip_ring_mid", (-1.5, -3, -1.5), (3, 1, 3), "metal", None),
    ("hilt", "grip_ring_top", (-1.5, 3, -1.5), (3, 1, 3), "metal", None),
    # --- Chắn kiếm: sừng cong 2 tầng + nanh xương ---
    ("hilt", "guard_core", (-6, 4, -2.5), (12, 3, 5), "metal", None),
    ("hilt", "guard_under", (-4, 3, -2), (8, 1, 4), "metal_dark", None),
    ("hilt", "guard_horn_l", (-10, 5, -1), (4, 2, 2), "metal_dark", ((-6, 6, 0), (0, 0, 30))),
    ("hilt", "guard_horn_r", (6, 5, -1), (4, 2, 2), "metal_dark", ((6, 6, 0), (0, 0, -30))),
    ("hilt", "guard_horn_l_tip", (-12.5, 7.5, -0.5), (3, 1, 1), "bone", ((-9.5, 8, 0), (0, 0, 60))),
    ("hilt", "guard_horn_r_tip", (9.5, 7.5, -0.5), (3, 1, 1), "bone", ((9.5, 8, 0), (0, 0, -60))),
    ("hilt", "fang_l", (-5, 1, -0.5), (1, 3, 1), "bone", None),
    ("hilt", "fang_r", (4, 1, -0.5), (1, 3, 1), "bone", None),
    # --- Hốc mắt Darkin ---
    ("hilt", "socket", (-5, 7, -2), (10, 10, 4), "flesh", None),
    ("hilt", "socket_rim_top", (-4, 16, -2.5), (8, 1, 5), "metal_dark", None),
    ("hilt", "socket_rim_bottom", (-4, 7, -2.5), (8, 1, 5), "metal_dark", None),
    ("hilt", "socket_side_l", (-6, 8, -1.5), (1, 8, 3), "spine", None),
    ("hilt", "socket_side_r", (5, 8, -1.5), (1, 8, 3), "spine", None),
    ("hilt", "eye_lid_top", (-3, 14, -2.5), (6, 1, 5), "flesh_dark", None),
    ("hilt", "eye_lid_bottom", (-3, 8, -2.5), (6, 1, 5), "flesh_dark", None),
    ("hilt", "eye", (-2.5, 9, -2.5), (5, 5, 5), "eye", None),
    # --- Lưỡi kiếm ---
    ("blade", "blade_core", (-4, 17, -1), (8, 23, 2), "crimson", None),
    ("blade", "blade_ridge", (-2, 19, -1.5), (3, 19, 3), "crimson_dark", None),
    ("blade", "sinew_l", (-3, 17, -1.5), (1, 5, 3), "flesh", None),
    ("blade", "sinew_r", (2, 17, -1.5), (1, 5, 3), "flesh", None),
    ("blade", "vein_main", (-1, 19, -2), (1, 18, 4), "lava", None),
    ("blade", "vein_branch_1", (1, 23, -1.5), (3, 1, 3), "lava", ((0, 23, 0), (0, 0, 35))),
    ("blade", "vein_branch_2", (-4, 27, -1.5), (3, 1, 3), "lava", ((-1, 27, 0), (0, 0, -35))),
    ("blade", "vein_branch_3", (1, 31, -1.5), (3, 1, 3), "lava", ((0, 31, 0), (0, 0, 35))),
    ("blade", "edge", (4, 17, -0.5), (1, 22, 1), "edge", None),
    ("blade", "serration_1", (5, 19, -0.5), (1, 1, 1), "edge", None),
    ("blade", "serration_2", (5, 23, -0.5), (1, 1, 1), "edge", None),
    ("blade", "serration_3", (5, 27, -0.5), (1, 1, 1), "edge", None),
    ("blade", "serration_4", (5, 31, -0.5), (1, 1, 1), "edge", None),
    ("blade", "serration_5", (5, 35, -0.5), (1, 1, 1), "edge", None),
    ("blade", "spine", (-6, 17, -1.5), (2, 21, 3), "spine", None),
    ("blade", "spine_tendon", (-7, 20, -1), (1, 14, 2), "flesh", None),
    ("blade", "spike_1", (-10, 18, -0.5), (4, 2, 1), "bone_red", ((-6, 19, 0), (0, 0, -35))),
    ("blade", "spike_2", (-10, 22, -0.5), (4, 2, 1), "bone_red", ((-6, 23, 0), (0, 0, -35))),
    ("blade", "spike_3", (-10, 26, -0.5), (4, 2, 1), "bone_red", ((-6, 27, 0), (0, 0, -35))),
    ("blade", "spike_4", (-10, 30, -0.5), (4, 2, 1), "bone_red", ((-6, 31, 0), (0, 0, -35))),
    ("blade", "spike_5", (-10, 34, -0.5), (4, 2, 1), "bone_red", ((-6, 35, 0), (0, 0, -35))),
    # --- Mũi kiếm cong ---
    ("tip", "tip_1", (-5, 40, -1), (9, 4, 2), "crimson", None),
    ("tip", "tip_2", (-4, 44, -1), (7, 4, 2), "crimson", None),
    ("tip", "tip_3", (-3, 48, -1), (5, 3, 2), "crimson", None),
    ("tip", "tip_4", (-2, 51, -1), (3, 3, 2), "edge", None),
    ("tip", "tip_edge_1", (4, 40, -0.5), (1, 4, 1), "edge", None),
    ("tip", "tip_edge_2", (3, 44, -0.5), (1, 3, 1), "edge", None),
    ("tip", "tip_vein", (-1, 40, -2), (1, 8, 4), "lava", None),
    ("tip", "tip_hook", (-6, 53, -0.5), (3, 2, 1), "spine", None),
    ("tip", "tip_hook_barb", (-7, 51, -0.5), (1, 2, 1), "bone_red", None),
]

BONES = [
    # (tên, cha, pivot (y tính từ tâm chuôi), rotation)
    ("hilt", "darkin_blade", (0, 0, 0), None),
    ("blade", "darkin_blade", (0, 0, 0), None),
    ("tip", "blade", (0, 40, 0), (0, 0, 10)),
]

# ---------------------------------------------------------------------------
# Bảng màu
# ---------------------------------------------------------------------------

CRIMSON_TOP = (182, 26, 38)
CRIMSON_BASE = (92, 8, 18)
EDGE_LIGHT = (250, 128, 104)
EDGE_DARK = (196, 48, 44)
SPINE = (58, 8, 14)
BONE_RED_TIP = (196, 96, 78)
BONE_RED_BASE = (104, 22, 26)
BONE = (226, 210, 184)
FLESH = (78, 12, 22)
FLESH_DARK = (40, 4, 10)
METAL = (84, 20, 26)
METAL_DARK = (38, 8, 12)
LEATHER = (74, 38, 28)
LAVA_CORE = (255, 236, 150)
LAVA_MID = (255, 132, 32)
LAVA_EDGE = (206, 36, 18)
EYE_GLOW = (255, 214, 90)
IRIS = (240, 84, 18)
PUPIL = (26, 0, 4)


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def scale(color, factor):
    return tuple(c * factor for c in color)


def clamp(value):
    return max(0, min(255, int(round(value))))


class ValueNoise:
    """Nhiễu mượt 2D để tạo vân hữu cơ (thớ thịt, gân máu)."""

    def __init__(self, seed, cells=8):
        rng = random.Random(seed)
        self.cells = cells
        self.grid = [[rng.random() for _ in range(cells + 1)] for _ in range(cells + 1)]

    def __call__(self, x, y):
        x, y = (x % 1) * self.cells, (y % 1) * self.cells
        ix, iy = int(x), int(y)
        fx, fy = x - ix, y - iy
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        g = self.grid
        top = g[iy][ix] + (g[iy][ix + 1] - g[iy][ix]) * fx
        bottom = g[iy + 1][ix] + (g[iy + 1][ix + 1] - g[iy + 1][ix]) * fx
        return top + (bottom - top) * fy


def shade_bevel(color, u, v, pw, ph, strength=1.0):
    """Viền sáng trên-trái, tối dưới-phải để khối trông có cạnh vát."""
    edge = 1.0 / max(pw, 1), 1.0 / max(ph, 1)
    if u < edge[0] * 1.5 or v < edge[1] * 1.5:
        return scale(color, 1 + 0.28 * strength)
    if u > 1 - edge[0] * 1.5 or v > 1 - edge[1] * 1.5:
        return scale(color, 1 - 0.4 * strength)
    return color


def paint_pixel(style, face, u, v, pw, ph, noise, fine, rng):
    """u, v trong [0, 1] trên mặt; v = 0 là phía mũi kiếm (+Y) với các mặt bên."""
    grain = (fine(u * 3.1, v * 3.7) - 0.5) * 0.18
    side = face not in ("up", "down")

    if style in ("crimson", "crimson_dark"):
        t = v if side else 0.5
        color = lerp(CRIMSON_TOP, CRIMSON_BASE, t * 0.9)
        if style == "crimson_dark":
            color = scale(color, 0.78)
        # Mạng gân sẫm như thớ thịt sống
        n = noise(u * 0.9, v * 1.6)
        if abs(n - 0.5) < 0.035:
            color = scale(color, 0.55)
        elif abs(n - 0.5) < 0.07:
            color = scale(color, 0.8)
        color = scale(color, 1 + grain)
        return shade_bevel(color, u, v, pw, ph, 0.8)

    if style == "edge":
        color = lerp(EDGE_LIGHT, EDGE_DARK, v if side else 0.3)
        if side and abs(u - 0.5) < 0.18:
            color = lerp(color, (255, 226, 210), 0.45)  # đường sáng lưỡi bén
        return scale(color, 1 + grain * 0.5)

    if style == "spine":
        ridge = (v * ph / TEXEL_SCALE) % 3  # đốt sống mỗi 3 px
        color = scale(SPINE, 1.25 if ridge < 0.5 else 1.0)
        if 0.5 <= ridge < 0.8:
            color = scale(SPINE, 0.6)
        return shade_bevel(scale(color, 1 + grain), u, v, pw, ph)

    if style == "bone_red":
        color = lerp(BONE_RED_TIP, BONE_RED_BASE, u)
        return shade_bevel(scale(color, 1 + grain), u, v, pw, ph)

    if style == "bone":
        color = scale(BONE, 0.95 - 0.25 * v + grain * 0.6)
        return shade_bevel(color, u, v, pw, ph, 0.6)

    if style in ("flesh", "flesh_dark"):
        base = FLESH if style == "flesh" else FLESH_DARK
        # Thớ cơ dọc hơi gợn sóng
        wave = math.sin((u * 7 + math.sin(v * 9) * 0.35) * math.pi * 2)
        color = scale(base, 1 + 0.22 * wave + grain)
        return shade_bevel(color, u, v, pw, ph, 0.7)

    if style in ("metal", "metal_dark"):
        base = METAL if style == "metal" else METAL_DARK
        color = scale(base, 1 + grain * 1.4)
        if rng.random() < 0.012:
            color = scale(base, 1.8)  # vết xước sáng
        # Đinh tán ở 4 góc mặt lớn
        if pw >= 12 and ph >= 12:
            for cu, cv in ((0.18, 0.25), (0.82, 0.25), (0.18, 0.75), (0.82, 0.75)):
                if math.hypot((u - cu) * pw, (v - cv) * ph) < TEXEL_SCALE * 0.45:
                    color = (150, 110, 90)
        return shade_bevel(color, u, v, pw, ph, 1.2)

    if style == "leather":
        band = ((u * pw + v * ph) / TEXEL_SCALE) % 3  # dây quấn chéo
        color = scale(LEATHER, 1.15 if band < 1.6 else 0.72)
        if 1.6 <= band < 1.9:
            color = scale(LEATHER, 0.45)
        return scale(color, 1 + grain)

    if style in ("lava", "gem"):
        # Lõi vàng sáng ở giữa, cam rồi đỏ ra mép, có chớp lửa nhỏ
        across = abs(u - 0.5) * 2 if face not in ("east", "west") or style == "gem" else abs(v - 0.5) * 2
        across = min(1.0, across + (noise(u * 2, v * 2) - 0.5) * 0.35)
        color = lerp(LAVA_CORE, LAVA_MID, min(1, across * 1.6)) if across < 0.62 else lerp(LAVA_MID, LAVA_EDGE, (across - 0.62) / 0.38)
        if style == "gem" and math.hypot(u - 0.32, v - 0.3) < 0.12:
            color = (255, 250, 230)  # điểm phản chiếu trên viên ngọc
        return color

    if style == "eye":
        if face in ("north", "south"):
            dx, dy = (u - 0.5) * 2, (v - 0.5) * 2
            r = math.hypot(dx, dy)
            if abs(dx) < 0.13 * (1 - dy * dy * 0.7) and abs(dy) < 0.85:
                return PUPIL  # đồng tử dọc
            if abs(dx) < 0.2 and abs(dy) < 0.9:
                return (255, 80, 30)  # viền sáng quanh đồng tử
            if r < 0.72:
                return lerp(IRIS, EYE_GLOW, max(0, (r - 0.2) / 0.52))
            color = lerp(EYE_GLOW, (230, 120, 40), min(1, (r - 0.72) / 0.5))
            if abs(noise(u * 2.3, v * 2.3) - 0.5) < 0.03:
                color = (190, 30, 20)  # mạch máu
            return color
        return lerp(IRIS, (120, 20, 12), 0.5)

    raise ValueError(f"Không có kiểu tô: {style}")


# ---------------------------------------------------------------------------
# UV, texture, geometry
# ---------------------------------------------------------------------------


def uv_size(size):
    """Kích thước ô box-UV (làm tròn lên cho khối có cạnh lẻ)."""
    w, h, d = (math.ceil(s) for s in size)
    return w, h, d


def pack_uvs():
    """Xếp vùng box-UV của từng khối lên texture theo từng hàng."""
    width, height = UV_SIZE
    x = y = row_height = 0
    uvs = []
    for cube in CUBES:
        w, h, d = uv_size(cube[3])
        region_w, region_h = 2 * (w + d), d + h
        if x + region_w > width:
            x, y, row_height = 0, y + row_height, 0
        if y + region_h > height:
            raise ValueError("Texture quá nhỏ, tăng UV_SIZE")
        uvs.append((x, y))
        x += region_w
        row_height = max(row_height, region_h)
    return uvs


def face_rects(u, v, size):
    """Các mặt của box-UV: tên -> (x, y, rộng, cao) theo đơn vị UV."""
    w, h, d = uv_size(size)
    return {
        "up": (u + d, v, w, d),
        "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h),
        "south": (u + 2 * d + w, v + d, w, h),
    }


def build_texture():
    width, height = UV_SIZE[0] * TEXEL_SCALE, UV_SIZE[1] * TEXEL_SCALE
    pixels = [[(0, 0, 0, 0)] * width for _ in range(height)]
    uvs = pack_uvs()
    for index, (cube, (u0, v0)) in enumerate(zip(CUBES, uvs)):
        style = cube[4]
        rng = random.Random(index * 7919)  # cố định để texture không đổi mỗi lần build
        noise = ValueNoise(index * 31 + 7, cells=6)
        fine = ValueNoise(index * 17 + 3, cells=16)
        for face, (fx, fy, fw, fh) in face_rects(u0, v0, cube[3]).items():
            pw, ph = fw * TEXEL_SCALE, fh * TEXEL_SCALE
            for j in range(ph):
                for i in range(pw):
                    color = paint_pixel(style, face, (i + 0.5) / pw, (j + 0.5) / ph, pw, ph, noise, fine, rng)
                    pixels[fy * TEXEL_SCALE + j][fx * TEXEL_SCALE + i] = (*(clamp(c) for c in color), 255)
    return pixels, uvs


def build_geometry(identifier, uvs, glow):
    """glow=False: phần thường; glow=True: chỉ các khối phát sáng."""
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

    for (bone, _name, origin, size, style, turn), uv in zip(CUBES, uvs):
        if (style in GLOW_STYLES) != glow:
            continue
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
                    "identifier": identifier,
                    "texture_width": UV_SIZE[0],
                    "texture_height": UV_SIZE[1],
                    "visible_bounds_width": 6,
                    "visible_bounds_height": 6,
                    "visible_bounds_offset": [0, 1.5, 0],
                },
                "bones": bones,
            }
        ],
    }


def shift(point):
    return [point[0], point[1] + GRIP_Y, point[2]]


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def write_model(root, write_png):
    pixels, uvs = build_texture()
    write_png(os.path.join(root, "AatroxRP/textures/entity/darkin_blade.png"), pixels)
    models = os.path.join(root, "AatroxRP/models/entity")
    write_json(os.path.join(models, "darkin_blade.geo.json"), build_geometry("geometry.aatrox.darkin_blade", uvs, glow=False))
    write_json(os.path.join(models, "darkin_blade_glow.geo.json"), build_geometry("geometry.aatrox.darkin_blade_glow", uvs, glow=True))
    print(f"Model: {len(CUBES)} khối, texture {len(pixels[0])}x{len(pixels)}")
