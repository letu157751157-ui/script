"""Model 3D Quỷ Kiếm Darkin + texture pixel art kiểu Minecraft.

Hình dáng lấy từ bản vẽ mặt trước trong sword_art.py: mỗi pixel được đùn thành
khối theo độ dày của vật liệu, rồi các pixel cùng vật liệu được gộp thành khối
chữ nhật lớn nhất có thể để giảm số khối.

Texture vẽ 1 texel cho mỗi đơn vị model (16 px = 1 block) giống texture gốc
của Minecraft: bảng màu giới hạn theo từng vật liệu, sáng ở mép trên-trái,
tối ở mép dưới-phải, nhiễu dither theo vị trí để bề mặt không bị phẳng lì.
Mặt trước và mặt sau cùng lấy màu theo toạ độ thật trên thanh kiếm nên hoa
văn liền mạch qua các khối.

Các vật liệu phát sáng (dung nham, mắt) được xuất sang geometry riêng, vẽ bằng
material entity_emissive nên sáng rực cả ban đêm.
"""
import json
import os

from sword_art import ART, MATERIALS

GRIP_Y = 24  # tâm tay cầm trùng điểm xoay bone gốc (giống model cây đinh ba)

# Bảng màu từ tối tới sáng
PALETTES = {
    "frame": [(26, 26, 33), (40, 41, 51), (56, 58, 71), (78, 81, 98), (110, 115, 136)],
    "horn": [(16, 15, 20), (28, 27, 35), (42, 42, 53), (64, 66, 81), (98, 102, 124)],
    "core": [(48, 5, 13), (74, 9, 21), (102, 15, 29), (132, 23, 37), (164, 36, 46)],
    "lava": [(178, 36, 12), (224, 74, 20), (255, 122, 34), (255, 176, 64), (255, 222, 128)],
    "socket": [(34, 3, 9), (54, 7, 15), (78, 13, 23), (104, 21, 31), (130, 32, 40)],
    "eye": [(170, 40, 10), (238, 96, 22), (255, 170, 54), (255, 214, 96), (255, 244, 180)],
    "guard": [(26, 26, 33), (40, 42, 52), (56, 59, 72), (78, 82, 99), (108, 113, 134)],
    "grip": [(30, 17, 13), (48, 29, 21), (68, 43, 30), (90, 59, 40), (114, 78, 54)],
    "band": [(30, 30, 38), (46, 48, 59), (66, 69, 84), (92, 96, 114), (128, 133, 154)],
    "pommel": [(26, 26, 33), (40, 42, 52), (58, 61, 75), (82, 86, 104), (116, 121, 142)],
    "spike": [(14, 14, 18), (24, 24, 31), (38, 39, 48), (58, 60, 73), (86, 90, 108)],
}
PUPIL = (22, 2, 5)
BASE_SHADE = {"frame": 2, "horn": 1, "core": 2, "lava": 2, "socket": 2, "eye": 3,
              "guard": 2, "grip": 2, "band": 2, "pommel": 2, "spike": 1}
DITHER = {"frame": 0.18, "horn": 0.14, "core": 0.22, "socket": 0.2, "guard": 0.12,
          "pommel": 0.12, "band": 0.1, "spike": 0.1, "grip": 0.0, "lava": 0.0, "eye": 0.0}


def hash01(x, y, salt=0):
    """Nhiễu cố định theo vị trí (0..1) để texture không đổi giữa các lần build."""
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def depth_at(x, y):
    material = ART.get((x, y))
    return MATERIALS[material]["depth"] if material else 0


def front_color(x, y):
    """Màu pixel mặt trước tại (x, y) theo phong cách pixel art Minecraft."""
    material = ART[(x, y)]
    palette = PALETTES[material]
    depth = depth_at(x, y)

    if material == "eye":
        # Đồng tử dọc 2 px ở giữa, mống mắt cam đỏ bao quanh, lòng mắt vàng rực
        if x in (-1, 0) and 11 <= y <= 14:
            return PUPIL
        if x in (-2, 1) and 11 <= y <= 14:
            return palette[1]
        if y in (10, 15):
            return palette[2]
        return palette[4] if (x, y) in ((-3, 13), (-2, 14)) else palette[3]

    shade = BASE_SHADE[material]
    # Mép trên-trái nhô ra được chiếu sáng, mép dưới-phải khuất tối
    if depth_at(x - 1, y) < depth or depth_at(x, y + 1) < depth:
        shade += 2 if material in ("horn", "frame") else 1
    if depth_at(x + 1, y) < depth or depth_at(x, y - 1) < depth:
        shade -= 1

    if material == "core":
        neighbors = [ART.get((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        if "lava" in neighbors:
            shade = 4  # ánh dung nham hắt lên thịt xung quanh
        elif "frame" in neighbors:
            shade = min(shade, 1)  # thịt sẫm lại sát khung
        elif hash01(x, y, 7) < 0.12:
            shade = 0  # thớ gân sẫm
    elif material == "lava":
        run = sum(ART.get((x + dx, y)) == "lava" for dx in (-1, 1))
        shade = 4 if run and y < 32 else 3 if run or y < 36 else 2
    elif material == "grip":
        shade = 0 if (x + y) % 3 == 0 else (3 if x == -1 else 2)  # dây da quấn chéo
    elif material == "horn" and hash01(x, y, 3) < 0.1:
        shade += 1  # ánh bóng loáng trên sừng

    dither = DITHER[material]
    if dither:
        n = hash01(x, y)
        if n < dither / 2:
            shade -= 1
        elif n > 1 - dither / 2:
            shade += 1
    return palette[max(0, min(len(palette) - 1, shade))]


def side_color(material, x, y, face):
    """Màu các mặt bên (độ dày): tối hơn mặt trước, mặt trên sáng hơn."""
    palette = PALETTES[material]
    if material == "eye":
        return palette[1]
    shade = max(BASE_SHADE[material], 2) + {"up": 1, "down": -1}.get(face, 0)
    if material == "lava":
        shade = 2
    if hash01(x, y, 11) < 0.15:
        shade -= 1
    return palette[max(0, min(len(palette) - 1, shade))]


# ---------------------------------------------------------------------------
# Gộp pixel thành khối
# ---------------------------------------------------------------------------


def rectangles(pixels):
    """Gộp tập pixel thành các hình chữ nhật (quét từng hàng rồi kéo lên trên)."""
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


def build_cubes():
    cubes = []
    for material, info in MATERIALS.items():
        pixels = [p for p, m in ART.items() if m == material]
        for x, y, w, h in rectangles(pixels):
            d = info["depth"]
            cubes.append({"material": material, "glow": info["glow"],
                          "origin": (x, y, -d / 2), "size": (w, h, d)})
    return cubes


def pack_uvs(cubes):
    """Xếp ô box-UV theo hàng (khối cao xếp trước) vào texture nhỏ nhất vừa đủ."""
    order = sorted(range(len(cubes)), key=lambda i: -(cubes[i]["size"][2] + cubes[i]["size"][1]))
    for width in (64, 128, 256, 512):
        x = y = row_height = 0
        uvs = [None] * len(cubes)
        fits = True
        for i in order:
            w, h, d = cubes[i]["size"]
            region_w, region_h = 2 * (w + d), d + h
            if region_w > width:
                fits = False
                break
            if x + region_w > width:
                x, y, row_height = 0, y + row_height, 0
            uvs[i] = (x, y)
            x += region_w
            row_height = max(row_height, region_h)
        if fits and y + row_height <= width:
            return uvs, (width, width)
    raise ValueError("Model quá lớn cho texture 512x512")


def build_texture(cubes, uvs, size):
    width, height = size
    pixels = [[(0, 0, 0, 0)] * width for _ in range(height)]

    def put(u, v, color):
        pixels[v][u] = (*color, 255)

    for cube, (u, v) in zip(cubes, uvs):
        ox, oy, _ = cube["origin"]
        w, h, d = cube["size"]
        material = cube["material"]
        for j in range(h):
            y = oy + h - 1 - j  # hàng trên cùng của mặt = đỉnh khối
            for i in range(w):
                put(u + d + i, v + d + j, front_color(ox + i, y))  # mặt bắc: trái -> phải = x tăng
                put(u + 2 * d + w + i, v + d + j, front_color(ox + w - 1 - i, y))  # mặt nam: x giảm
            for k in range(d):
                put(u + k, v + d + j, side_color(material, ox, y, "east"))
                put(u + d + w + k, v + d + j, side_color(material, ox + w - 1, y, "west"))
        for i in range(w):
            for k in range(d):
                put(u + d + i, v + k, side_color(material, ox + i, oy + h - 1, "up"))
                put(u + d + w + i, v + k, side_color(material, ox + i, oy, "down"))
    return pixels


def build_geometry(identifier, cubes, uvs, size, glow):
    """glow=False: phần thường; glow=True: chỉ các khối phát sáng."""
    entries = []
    for cube, uv in zip(cubes, uvs):
        if cube["glow"] != glow:
            continue
        ox, oy, oz = cube["origin"]
        entries.append({"origin": [ox, oy + GRIP_Y, oz], "size": list(cube["size"]), "uv": list(uv)})
    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": identifier,
                    "texture_width": size[0],
                    "texture_height": size[1],
                    "visible_bounds_width": 6,
                    "visible_bounds_height": 6,
                    "visible_bounds_offset": [0, 1.5, 0],
                },
                "bones": [
                    {
                        "name": "darkin_blade",
                        # Gắn vào xương tay đang cầm (rightitem / leftitem)
                        "binding": "q.item_slot_to_bone_name(c.item_slot)",
                        "pivot": [0, GRIP_Y, 0],
                    },
                    {"name": "sword", "parent": "darkin_blade", "pivot": [0, GRIP_Y, 0], "cubes": entries},
                ],
            }
        ],
    }


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
        f.write("\n")


def write_model(root, write_png):
    cubes = build_cubes()
    uvs, size = pack_uvs(cubes)
    write_png(os.path.join(root, "AatroxRP/textures/entity/darkin_blade.png"), build_texture(cubes, uvs, size))
    models = os.path.join(root, "AatroxRP/models/entity")
    write_json(os.path.join(models, "darkin_blade.geo.json"),
               build_geometry("geometry.aatrox.darkin_blade", cubes, uvs, size, glow=False))
    write_json(os.path.join(models, "darkin_blade_glow.geo.json"),
               build_geometry("geometry.aatrox.darkin_blade_glow", cubes, uvs, size, glow=True))
    print(f"Model: {len(ART)} pixel -> {len(cubes)} khối, texture {size[0]}x{size[1]}")
