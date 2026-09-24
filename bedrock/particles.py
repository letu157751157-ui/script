"""Particle riêng của Quỷ Kiếm Darkin: texture atlas pixel art + file JSON cho resource pack.

Sprite vẽ theo kiểu particle gốc của Minecraft: pixel cạnh cứng, bảng màu lửa giới hạn
(trắng vàng -> vàng -> cam -> đỏ -> đỏ thẫm). Phần lớn hiệu ứng là flipbook nhiều khung hình
(nhát chém loé lên rồi tan thành tia lửa, vòng xung kích mỏng dần rồi vỡ, ngọn lửa bập bùng...),
khung hình chạy hết trong đúng thời gian sống của particle (stretch_to_lifetime).

Ô rune dưới đất vẽ bằng thang xám để tô màu bằng tinting (đỏ = vùng chém, cam = điểm ngọt).
"""
import json
import math
import os

ATLAS = 256
TEXTURE = "textures/particle/aatrox_particles"

FIRE = {
    "W": (255, 250, 225),
    "Y": (255, 214, 92),
    "O": (255, 138, 36),
    "R": (214, 46, 28),
    "D": (122, 14, 18),
}
GRAY = {"#": (255, 255, 255), "+": (185, 185, 185), "-": (120, 120, 120)}
BLOOD = {"H": (236, 70, 70), "R": (170, 16, 30), "D": (96, 6, 16)}
HOT_IRON = {"K": (74, 18, 12), "M": (168, 50, 22), "L": (255, 128, 44), "W": (255, 214, 130)}


def hash01(x, y, salt=0):
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def fire_char(heat):
    """Mức nhiệt -> màu lửa, cạnh cứng như pixel art."""
    for limit, char in ((0.82, "W"), (0.62, "Y"), (0.42, "O"), (0.24, "R"), (0.1, "D")):
        if heat > limit:
            return char
    return "."


def grid(w, h, fn):
    return ["".join(fn(x, y) for x in range(w)) for y in range(h)]


# ---------------------------------------------------------------------------
# Sprite
# ---------------------------------------------------------------------------


def slash_frame(frame):
    """Nhát chém lưỡi liềm 32x32: mép ngoài trắng rực, trong đỏ; loé lên rồi tan thành tia lửa."""
    c1, r1 = (16.0, 17.0), 14.5
    c2, r2 = (20.5, 12.5), 12.5
    fade = (1.0, 1.0, 0.8, 0.55)[frame]
    holes = (0.0, 0.0, 0.22, 0.6)[frame]

    def pixel(x, y):
        px, py = x + 0.5, y + 0.5
        d1 = math.hypot(px - c1[0], py - c1[1])
        d2 = math.hypot(px - c2[0], py - c2[1])
        if d1 > r1 or d2 < r2:
            return "."
        outer, inner = r1 - d1, d2 - r2
        heat = (1 - 0.95 * outer / (outer + inner + 1e-6)) * fade
        angle = math.atan2(py - c1[1], px - c1[0])  # quét từ trên phải vòng qua trái xuống dưới
        sweep = ((angle - 0.3) % (2 * math.pi)) / (2 * math.pi)
        if frame == 0 and sweep > 0.55:
            return "."
        if frame == 0:
            heat *= 0.7 + 0.3 * (sweep / 0.55)
        if hash01(x, y, frame) < holes:
            return "."
        return fire_char(heat)

    return grid(32, 32, pixel)


def ring_frame(frame):
    """Vòng sóng xung kích 32x32: dày và rực, mỏng dần rồi vỡ vụn."""
    radius, thick, heat_max, holes = ((10.5, 4.5, 1.0, 0.0), (13.0, 3.0, 0.8, 0.12), (14.5, 2.0, 0.55, 0.45))[frame]

    def pixel(x, y):
        d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
        off = abs(d - radius)
        if off > thick / 2:
            # vài mảnh vụn văng ra ngoài vòng
            if frame and radius + thick / 2 < d < radius + thick / 2 + 2 and hash01(x, y, 40 + frame) < 0.06:
                return "R"
            return "."
        if hash01(x, y, 20 + frame) < holes:
            return "."
        return fire_char(heat_max * (1 - 0.7 * off / (thick / 2)))

    return grid(32, 32, pixel)


def shade_mask(mask, w, h, bias):
    """Tô nhiệt cho một hình: càng sâu vào trong càng nóng (khoảng cách tới mép), cộng thêm bias(x, y)."""
    depth = {}
    frontier = [(x, y) for y in range(h) for x in range(w) if mask(x, y) and any(
        not mask(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for p in frontier:
        depth[p] = 1
    level = 1
    while frontier:
        nxt = []
        for x, y in frontier:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if 0 <= q[0] < w and 0 <= q[1] < h and mask(*q) and q not in depth:
                    depth[q] = level + 1
                    nxt.append(q)
        frontier = nxt
        level += 1
    top = max(depth.values()) if depth else 1
    return lambda x, y: (depth.get((x, y), 0) / top + bias(x, y)) if (x, y) in depth else -1


def flame_frame(frame):
    """Ngọn lửa 16x16 bập bùng: đáy tròn, lưỡi lửa lắc qua lại, lõi vàng trắng."""
    sway = (0.0, 1.2, 0.3, -1.0)[frame]

    def inside(x, y):
        if not (0 <= x < 16 and 0 <= y < 16):
            return False
        px, py = x + 0.5, y + 0.5
        if math.hypot(px - 8, py - 11.2) <= 4.3:
            return True
        if 1.5 <= py <= 11.2:
            t = (11.2 - py) / 9.7  # 0 ở đáy lưỡi lửa, 1 ở đỉnh
            center = 8 + sway * t * t * 2
            width = 4.3 * (1 - t) ** 0.8
            return abs(px - center) <= width and hash01(x, y, 60 + frame) > 0.12 * t
        return False

    heat = shade_mask(inside, 16, 16, lambda x, y: 0.3 * (y / 15) - 0.1)
    return grid(16, 16, lambda x, y: fire_char(0.12 + 0.72 * heat(x, y)) if heat(x, y) >= 0 else ".")


EMBER = [
    ["........", "...YY...", "..YWWY..", ".YWWWWY.", ".YWWWWY.", "..YWWY..", "...YY...", "........"],
    ["........", "........", "...OY...", "..OYYO..", "..OYYO..", "...OO...", "........", "........"],
    ["........", "........", "........", "...RO...", "...OR...", "........", "........", "........"],
    ["........", "........", "........", "...D....", "....D...", "........", "........", "........"],
]

SPARK = [
    ".YY.",
    "YWWY",
    "YWWY",
    ".WW.",
    ".WY.",
    ".YY.",
    ".YO.",
    ".OO.",
    ".OO.",
    ".OR.",
    ".RR.",
    ".R..",
    "..R.",
    ".D..",
    "..D.",
    "....",
]

DROP = [
    "....D...",
    "...DR...",
    "...RRD..",
    "..RRRRD.",
    ".DRHRRRD",
    ".DRHRRRD",
    "..DRRRD.",
    "...DDD..",
]

RUNE = [
    "################",
    "#++++++++++++++#",
    "#+-..........-+#",
    "#+.....##.....+#",
    "#+....#++#....+#",
    "#+...#+--+#...+#",
    "#+..#+-..-+#..+#",
    "#+.#+-.##.-+#.+#",
    "#+.#+-.##.-+#.+#",
    "#+..#+-..-+#..+#",
    "#+...#+--+#...+#",
    "#+....#++#....+#",
    "#+.....##.....+#",
    "#+-..........-+#",
    "#++++++++++++++#",
    "################",
]


def rune_frame(frame):
    """Ô rune báo trước vùng chém: hiện khung -> hình thoi -> lõi, như thanh nạp."""
    def pixel(x, y):
        c = RUNE[y][x]
        if c == ".":
            return "."
        border = x < 2 or y < 2 or x > 13 or y > 13
        centre = 6 <= x <= 9 and 6 <= y <= 9
        if frame == 0 and not border:
            return "."
        if frame == 1 and centre:
            return "."
        return c

    return grid(16, 16, pixel)


def chain_link():
    """Mắt xích nung đỏ 16x16: viền sắt tối, trong lòng rực cam."""
    def pixel(x, y):
        nx, ny = (x + 0.5 - 8) / 5.4, (y + 0.5 - 8) / 7.4
        d = math.hypot(nx, ny)
        if not 0.56 <= d <= 1.0:
            return "."
        if d > 0.88:
            return "K"
        if d < 0.68:
            return "W" if ny < 0 else "L"
        return "L" if nx < -0.2 and ny < 0.2 else "M"

    return grid(16, 16, pixel)


def flash_frame(frame):
    """Chớp sáng hình sao 16x16: sao nhỏ -> sao lớn -> vòng tan."""
    arm, diag, core, ring = ((4.5, 0, 2.2, 0), (7.5, 3.5, 2.8, 0), (0, 0, 1.2, 6.3))[frame]

    def pixel(x, y):
        dx, dy = x + 0.5 - 8, y + 0.5 - 8
        heat = 0.0
        if abs(dy) < 1 and arm:
            heat = max(heat, 1 - abs(dx) / arm)
        if abs(dx) < 1 and arm:
            heat = max(heat, 1 - abs(dy) / arm)
        if diag and abs(abs(dx) - abs(dy)) < 0.8:
            heat = max(heat, 0.7 * (1 - abs(dx) / diag))
        heat = max(heat, 1 - math.hypot(dx, dy) / core)
        if ring and abs(math.hypot(dx, dy) - ring) < 0.8 and hash01(x, y, 90) > 0.35:
            heat = max(heat, 0.45)
        return fire_char(heat)

    return grid(16, 16, pixel)


SMOKE = {"H": (112, 46, 40), "A": (72, 26, 26), "B": (46, 16, 18), "C": (28, 10, 12)}
ROCK = {"K": (48, 42, 44), "S": (92, 84, 86), "L": (140, 132, 134), "R": (240, 96, 36)}
CRACK = {"K": (26, 8, 8), "D": (84, 16, 12), "O": (255, 120, 40), "Y": (255, 214, 110)}
GHOST = {"D": (96, 8, 16), "R": (190, 28, 38), "O": (255, 112, 48)}
WING = {"K": (22, 8, 10), "D": (92, 10, 18), "R": (168, 24, 30), "O": (255, 110, 40)}


def smoke_frame(frame):
    """Cụm khói đỏ đen 16x16: nở ra rồi tan thành lỗ chỗ."""
    radius, holes = ((3.6, 0.0), (5.0, 0.08), (6.2, 0.3), (7.0, 0.58))[frame]
    blobs = ((8, 9, 1.0), (5.5, 7, 0.75), (10.5, 6.5, 0.7), (8, 5, 0.6))

    def pixel(x, y):
        best = min(math.hypot(x + 0.5 - bx, y + 0.5 - by) / (radius * s) for bx, by, s in blobs)
        if best > 1 or hash01(x, y, 70 + frame) < holes:
            return "."
        if best > 0.82:
            return "C"
        light = (x - 8) + (y - 8)  # sáng trên-trái, tối dưới-phải
        return "H" if light < -5 and best < 0.6 else "B" if light > 4 else "A"

    return grid(16, 16, pixel)


DEBRIS = [
    ["........", "..KSS...", ".KSLLS..", ".KSSLSK.", ".KKSSSK.", "..KKKK..", "........", "........"],
    ["........", "........", "...SL...", "..KSSS..", "..KKSK..", "...KK...", "........", "........"],
    ["........", ".KSS....", ".KSRS...", ".KSSSK..", "..KKK...", "........", "........", "........"],
]

CHAIN_HEAD = [
    "................",
    ".......WW.......",
    "......WLLW......",
    "......LMML......",
    ".....LMKKML.....",
    ".....MK..KM.....",
    "....LMK..KML....",
    "....MK....KM....",
    "...LMK....KML...",
    "...MMKK..KKMM...",
    "....KKM..MKK....",
    ".......MM.......",
    ".......MM.......",
    ".......KK.......",
    ".......KK.......",
    "................",
]

AFTERIMAGE = [
    "................",
    "..............O.",
    ".............RO.",
    ".............RR.",
    ".....DDDD....RR.",
    "....DRRRRD...RR.",
    "....DRRRRD...RR.",
    "....DRRRRD...RR.",
    "....DRRRRD..DRR.",
    ".....DDDD...DRR.",
    "...DDDDDDDD.DRR.",
    "..DRRRRRRRRDDRD.",
    "..DRDRRRRDRRRD..",
    "..DRDRRRRDRRD...",
    "..DRDRRRRDDDD...",
    "..DRDRRRRD......",
    "..DRDRRRRD......",
    "..DD.RRRR.......",
    ".....RRRR.......",
    ".....RRRR.......",
    ".....RRRR.......",
    ".....RR.RR......",
    ".....RR.RR......",
    ".....RR.RR......",
    ".....RR.RR......",
    ".....RR.RR......",
    ".....RR.RR......",
    ".....RR.RR......",
    ".....DD.DD......",
    "................",
    "................",
    "................",
]


def x_slash_frame(frame):
    """Vết chém chữ X 32x32 của nội tại: nhát thứ nhất -> đủ hai nhát -> tan."""
    fade, holes = ((1.0, 0.0), (1.0, 0.0), (0.7, 0.4))[frame]

    def stroke(dx, dy, sign):
        along = (dx + sign * dy) / math.sqrt(2)
        across = abs(dx - sign * dy) / math.sqrt(2)
        if abs(along) > 13:
            return 0.0
        thick = 2.3 * (1 - (along / 13) ** 2)
        return max(0.0, 1 - across / thick) if thick > 0 else 0.0

    def pixel(x, y):
        dx, dy = x + 0.5 - 16, y + 0.5 - 16
        heat = stroke(dx, dy, 1)
        if frame:
            heat = max(heat, stroke(dx, dy, -1))
        if hash01(x, y, 110 + frame) < holes:
            return "."
        return fire_char(heat * fade)

    return grid(32, 32, pixel)


def ground_crack():
    """Đất nứt 32x32: các vết nứt ngoằn ngoèo toả ra từ tâm, gần tâm còn rực dung nham."""
    cells = {}
    for ray in range(7):
        angle = ray / 7 * 2 * math.pi + hash01(ray, 1, 5) * 0.6
        x, y = 16.0, 16.0
        for step in range(15):
            angle += (hash01(ray, step, 6) - 0.5) * 0.9
            x += math.cos(angle)
            y += math.sin(angle)
            if not (1 <= x < 31 and 1 <= y < 31):
                break
            core = "Y" if step < 3 else "O" if step < 7 else "D"
            cells[(int(x), int(y))] = core
    out = []
    for yy in range(32):
        row = ""
        for xx in range(32):
            if (xx, yy) in cells:
                row += cells[(xx, yy)]
            elif any((xx + dx, yy + dy) in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                row += "K"
            else:
                row += "."
        out.append(row)
    return out


def bind_circle():
    """Vòng rune trói 32x32 (thang xám, tô đỏ bằng tinting): hai vòng tròn, 6 ký tự, ngôi sao sáu cánh."""
    marks = [(16 + 12.7 * math.cos(k * math.pi / 3), 16 + 12.7 * math.sin(k * math.pi / 3)) for k in range(6)]
    star = [(16 + 10 * math.cos(k * math.pi / 3 + math.pi / 6), 16 + 10 * math.sin(k * math.pi / 3 + math.pi / 6)) for k in range(6)]

    def near_segment(px, py, a, b):
        ax, ay = a
        bx, by = b
        t = max(0, min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
        return math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay)) < 0.6

    def pixel(x, y):
        px, py = x + 0.5, y + 0.5
        d = math.hypot(px - 16, py - 16)
        if abs(d - 15) < 0.7:
            return "#"
        if abs(d - 10.8) < 0.5:
            return "+"
        if any(abs(px - mx) < 1.3 and abs(py - my) < 1.3 and (x + y) % 2 == 0 for mx, my in marks):
            return "#"
        if any(near_segment(px, py, star[k], star[(k + 2) % 6]) for k in range(6)):
            return "-"
        return "."

    return grid(32, 32, pixel)


def wings():
    """Cặp cánh quỷ 48x24 đối xứng: xương đen, màng đỏ thẫm, mép rực lửa."""
    bones = [-28, -8, 12, 32]  # góc (độ) của các nan xương, âm = chếch lên

    def half(x, y):
        rx, ry = x + 0.5, y + 0.5 - 12  # gốc cánh ở giữa mép trái của nửa phải
        r = math.hypot(rx, ry)
        theta = math.degrees(math.atan2(ry, rx))
        if r < 1.5 or not -34 <= theta <= 40:
            return "."
        reach = 23 - (theta + 34) * 0.16
        # mép sau lượn sóng giữa các nan xương
        gap = min(abs(theta - b) for b in bones)
        reach -= 0.18 * gap * (1 if theta > bones[0] else 0)
        if r > reach:
            return "."
        if any(abs(r * math.sin(math.radians(theta - b))) < 0.7 and math.cos(math.radians(theta - b)) > 0 for b in bones):
            return "K"
        if reach - r < 1.0:
            return "O"
        if reach - r < 2.2:
            return "R"
        return "D"

    rows = []
    for y in range(24):
        right = "".join(half(x, y) for x in range(24))
        rows.append(right[::-1] + right)
    return rows


# (tên, x, y, danh sách khung, bảng màu); các khung xếp liền nhau theo chiều ngang
SPRITES = {
    "smoke": (128, 0, [smoke_frame(i) for i in range(4)], SMOKE),
    "debris": (192, 0, DEBRIS, ROCK),
    "chain_head": (224, 0, [CHAIN_HEAD], HOT_IRON),
    "x_slash": (128, 32, [x_slash_frame(i) for i in range(3)], FIRE),
    "crack": (128, 64, [ground_crack()], CRACK),
    "bind": (160, 64, [bind_circle()], GRAY),
    "afterimage": (192, 64, [AFTERIMAGE], GHOST),
    "wings": (128, 96, [wings()], WING),
    "slash": (0, 0, [slash_frame(i) for i in range(4)], FIRE),
    "ring": (0, 32, [ring_frame(i) for i in range(3)], FIRE),
    "flame": (0, 64, [flame_frame(i) for i in range(4)], FIRE),
    "ember": (64, 64, EMBER, FIRE),
    "rune": (0, 80, [rune_frame(i) for i in range(3)], GRAY),
    "chain": (48, 80, [chain_link()], HOT_IRON),
    "drop": (64, 80, [DROP], BLOOD),
    "spark": (72, 80, [SPARK], FIRE),
    "flash": (0, 96, [flash_frame(i) for i in range(3)], FIRE),
}


def build_atlas():
    pixels = [[(0, 0, 0, 0)] * ATLAS for _ in range(ATLAS)]
    for name, (ox, oy, frames, palette) in SPRITES.items():
        for f, rows in enumerate(frames):
            w = len(rows[0])
            for j, row in enumerate(rows):
                for i, ch in enumerate(row):
                    if ch != ".":
                        pixels[oy + j][ox + f * w + i] = (*palette[ch], 255)
    return pixels


# ---------------------------------------------------------------------------
# Định nghĩa particle
# ---------------------------------------------------------------------------

AGE = "v.particle_age / v.particle_lifetime"


def uv(sprite, fps=12):
    """UV một khung, hoặc flipbook chạy hết các khung trong thời gian sống của particle."""
    ox, oy, frames, _ = SPRITES[sprite]
    w, h = len(frames[0][0]), len(frames[0])
    base = {"texture_width": ATLAS, "texture_height": ATLAS}
    if len(frames) == 1:
        return {**base, "uv": [ox, oy], "uv_size": [w, h]}
    return {**base, "flipbook": {
        "base_UV": [ox, oy], "size_UV": [w, h], "step_UV": [w, 0],
        "frames_per_second": fps, "max_frame": len(frames), "stretch_to_lifetime": True, "loop": False,
    }}


def tint(stops):
    return {"color": {"interpolant": AGE, "gradient": stops}}


FADE = tint({"0.0": "#FFFFFFFF", "0.7": "#FFFFFFFF", "1.0": "#00FFFFFF"})


def particle(identifier, material, components):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": identifier,
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


PARTICLES = {
    # Tàn lửa bay lên (quanh kiếm, vệt lướt, hút máu): cháy sáng rồi tàn thành đốm đỏ
    "ember": particle("aatrox:ember", "particles_add", {
        **burst(3),
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 1.0)"},
        "minecraft:particle_initial_speed": 0.4,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.4, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_appearance_billboard": {
            "size": [0.1, 0.1], "facing_camera_mode": "rotate_xyz", "uv": uv("ember"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Tia lửa bắn ra khi chém trúng
    "hit_spark": particle("aatrox:hit_spark", "particles_add", {
        **burst(14),
        "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.2, 0.4)"},
        "minecraft:particle_initial_speed": "math.random(5, 9)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -6, 0], "linear_drag_coefficient": 5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.05, f"0.22 * (1 - {AGE} * 0.5)"],
            "facing_camera_mode": "lookat_direction",
            "direction": {"mode": "derive_from_velocity"},
            "uv": uv("spark"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Máu văng (điểm ngọt Q, nội tại, kéo xích): giọt máu pixel đặc như particle gốc
    "blood_burst": particle("aatrox:blood_burst", "particles_alpha", {
        **burst(18),
        "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
        "minecraft:particle_initial_speed": "math.random(2.5, 5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -14, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_motion_collision": {"collision_radius": 0.05, "coefficient_of_restitution": 0.1,
                                                "collision_drag": 6},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.12 * (1 - {AGE} * 0.5)", f"0.12 * (1 - {AGE} * 0.5)"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv("drop"),
        },
    }),
    # Chớp sáng hình sao tại điểm nổ
    "flash": particle("aatrox:flash", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.25},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.8 + {AGE} * 0.9", f"0.8 + {AGE} * 0.9"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv("flash"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Nhát chém lưỡi liềm: loé lên rồi vỡ thành tia lửa
    "slash": particle("aatrox:slash", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.28},
        "minecraft:particle_initial_spin": {"rotation": "math.random(-50, 50)"},
        "minecraft:particle_appearance_billboard": {
            "size": [f"1.2 + {AGE} * 0.4", f"1.2 + {AGE} * 0.4"],
            "facing_camera_mode": "rotate_xyz",
            "uv": uv("slash"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Ô rune báo trước vùng chém Q (đỏ) và điểm ngọt (cam): hiện dần khung -> hình thoi -> lõi
    "ground_mark": particle("aatrox:ground_mark", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.38, 0.38], "facing_camera_mode": "emitter_transform_xz", "uv": uv("rune"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#66C8141E", "0.3": "#DDC8141E", "0.85": "#FFFF3020", "1.0": "#00FF3020"}),
    }),
    "ground_mark_sweet": particle("aatrox:ground_mark_sweet", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.38, 0.38], "facing_camera_mode": "emitter_transform_xz", "uv": uv("rune"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#66FF8C28", "0.3": "#EEFF8C28", "0.85": "#FFFFD25A", "1.0": "#00FFD25A"}),
    }),
    # Vòng sóng xung kích lan trên mặt đất; bán kính truyền từ script qua variable.radius
    "shock_ring": particle("aatrox:shock_ring", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.3 + (v.radius - 0.3) * math.sqrt({AGE})", f"0.3 + (v.radius - 0.3) * math.sqrt({AGE})"],
            "facing_camera_mode": "emitter_transform_xz",
            "uv": uv("ring"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Mắt xích nung đỏ của W
    "chain_link": particle("aatrox:chain_link", "particles_alpha", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.14},
        "minecraft:particle_initial_spin": {"rotation": "math.random(-20, 20)"},
        "minecraft:particle_appearance_billboard": {
            "size": [0.13, 0.13], "facing_camera_mode": "rotate_xyz", "uv": uv("chain"),
        },
    }),
    # Hào quang lửa khi biến hình: ngọn lửa bập bùng bốc lên quanh người
    "ult_aura": particle("aatrox:ult_aura", "particles_add", {
        **burst(6),
        "minecraft:emitter_shape_disc": {"radius": 0.7, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
        "minecraft:particle_initial_speed": 0.6,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 2.2, 0], "linear_drag_coefficient": 1},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.22 * (1 - {AGE} * 0.5)", f"0.22 * (1 - {AGE} * 0.5)"],
            "facing_camera_mode": "lookat_y",
            "uv": uv("flame"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFFFFF", "0.5": "#FFFF9A8A", "1.0": "#00A0302A"}),
    }),
    # Khói đỏ đen (lướt E, biến hình R, xích đứt)
    "smoke": particle("aatrox:smoke", "particles_blend", {
        **burst(5),
        "minecraft:emitter_shape_sphere": {"radius": 0.35, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.0)"},
        "minecraft:particle_initial_speed": "math.random(0.3, 0.9)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0], "linear_drag_coefficient": 2.5},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.3 + {AGE} * 0.25", f"0.3 + {AGE} * 0.25"], "facing_camera_mode": "rotate_xyz", "uv": uv("smoke"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#E6FFFFFF", "0.6": "#B3FFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # Đất nứt dưới chân (điểm chém Q, Q3, R); bán kính truyền qua variable.radius
    "ground_crack": particle("aatrox:ground_crack", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.6},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
        "minecraft:particle_appearance_billboard": {
            "size": ["v.radius", "v.radius"], "facing_camera_mode": "emitter_transform_xz", "uv": uv("crack"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFFFFF", "0.6": "#FFFFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # Đá văng lên rồi rơi, nảy trên mặt đất
    "debris": particle("aatrox:debris", "particles_alpha", {
        **burst(12),
        "minecraft:emitter_shape_disc": {"radius": 0.6, "plane_normal": "y", "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.7, 1.2)"},
        "minecraft:particle_initial_speed": "math.random(2, 4)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-360, 360)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -18, 0]},
        "minecraft:particle_motion_collision": {"collision_radius": 0.06, "coefficient_of_restitution": 0.35,
                                                "collision_drag": 4},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.06 + v.particle_random_2 * 0.05", "0.06 + v.particle_random_2 * 0.05"],
            "facing_camera_mode": "rotate_xyz",
            "uv": {"texture_width": ATLAS, "texture_height": ATLAS,
                   "uv": ["192 + math.floor(v.particle_random_1 * 2.99) * 8", 0], "uv_size": [8, 8]},
        },
    }),
    # Cột lửa phun thẳng lên (điểm nện Q3, biến hình R)
    "fire_pillar": particle("aatrox:fire_pillar", "particles_add", {
        **burst(18, 0.15),
        "minecraft:emitter_shape_disc": {"radius": 0.3, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.4, 0.7)"},
        "minecraft:particle_initial_speed": "math.random(4, 7)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -2, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.3 * (1 - {AGE} * 0.6)", f"0.3 * (1 - {AGE} * 0.6)"], "facing_camera_mode": "lookat_y", "uv": uv("flame"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Năng lượng tụ về lưỡi kiếm khi vung Q
    "charge": particle("aatrox:charge", "particles_add", {
        **burst(10),
        "minecraft:emitter_shape_sphere": {"radius": 1.3, "surface_only": True, "direction": "inwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35},
        "minecraft:particle_initial_speed": 3.5,
        "minecraft:particle_appearance_billboard": {
            "size": [0.09, 0.09], "facing_camera_mode": "rotate_xyz", "uv": uv("ember"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FFFFFF", "0.3": "#FFFFFFFF", "1.0": "#FFFFFFFF"}),
    }),
    # Bóng mờ đỏ thẫm để lại phía sau khi lướt E
    "afterimage": particle("aatrox:afterimage", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.4},
        "minecraft:particle_appearance_billboard": {
            "size": [0.5, 1.0], "facing_camera_mode": "rotate_y", "uv": uv("afterimage"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#B3FFFFFF", "1.0": "#00FFFFFF"}),
    }),
    # Đầu móc rực lửa ở mũi sợi xích W
    "chain_head": particle("aatrox:chain_head", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.1},
        "minecraft:particle_appearance_billboard": {
            "size": [0.22, 0.22], "facing_camera_mode": "rotate_xyz", "uv": uv("chain_head"),
        },
    }),
    # Vòng rune trói dưới chân mục tiêu trúng W, xoay chậm; bán kính qua variable.radius
    "bind_circle": particle("aatrox:bind_circle", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.5},
        "minecraft:particle_initial_spin": {"rotation": 0, "rotation_rate": 60},
        "minecraft:particle_appearance_billboard": {
            "size": ["v.radius", "v.radius"], "facing_camera_mode": "emitter_transform_xz", "uv": uv("bind"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#00FF281E", "0.15": "#FFFF281E", "0.85": "#FFFF6428", "1.0": "#00FFB450"}),
    }),
    # Cánh quỷ sau lưng khi biến hình R (script sinh liên tục mỗi 2 tick)
    "wings": particle("aatrox:wings", "particles_blend", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.14},
        "minecraft:particle_appearance_billboard": {
            "size": ["1.15 + v.flap * 0.1", "0.58 + v.flap * 0.06"],
            "facing_camera_mode": "rotate_y",
            "uv": uv("wings"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#E6FFFFFF", "1.0": "#99FFFFFF"}),
    }),
    # Vết chém chữ X khi nội tại phát nổ
    "x_slash": particle("aatrox:x_slash", "particles_add", {
        **burst(1),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.3},
        "minecraft:particle_initial_spin": {"rotation": "math.random(-20, 20)"},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.7 + {AGE} * 0.3", f"0.7 + {AGE} * 0.3"], "facing_camera_mode": "rotate_xyz", "uv": uv("x_slash"),
        },
        "minecraft:particle_appearance_tinting": FADE,
    }),
    # Cầu máu bay từ mục tiêu về người dùng khi hút máu; hướng và tốc độ do script truyền vào
    "blood_orb": particle("aatrox:blood_orb", "particles_add", {
        **burst(5),
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": ["v.dir_x", "v.dir_y", "v.dir_z"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
        "minecraft:particle_initial_speed": "v.speed * math.random(0.85, 1.1)",
        "minecraft:particle_appearance_billboard": {
            "size": [0.1, 0.1], "facing_camera_mode": "rotate_xyz", "uv": uv("drop"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFF8C8C", "0.8": "#FFFF4646", "1.0": "#00FF4646"}),
    }),
    # Hút máu: giọt máu phát sáng bay lên quanh người
    "lifesteal": particle("aatrox:lifesteal", "particles_add", {
        **burst(5),
        "minecraft:emitter_shape_disc": {"radius": 0.45, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.8)"},
        "minecraft:particle_initial_speed": 1.2,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": [0.1, 0.1], "facing_camera_mode": "lookat_y", "uv": uv("drop"),
        },
        "minecraft:particle_appearance_tinting": tint({"0.0": "#FFFFB4B4", "1.0": "#00FF5050"}),
    }),
}


def write_particles(root, write_png):
    write_png(os.path.join(root, "AatroxRP", TEXTURE + ".png"), build_atlas())
    folder = os.path.join(root, "AatroxRP/particles")
    os.makedirs(folder, exist_ok=True)
    for name, data in PARTICLES.items():
        with open(os.path.join(folder, f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
    print(f"Particle: {len(PARTICLES)} hiệu ứng")
