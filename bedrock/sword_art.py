"""Bản vẽ mặt trước (pixel art) của Quỷ Kiếm Darkin.

Mỗi pixel là 1 đơn vị model (16 px = 1 block), đúng mật độ texture của
Minecraft. model.py đùn bản vẽ này thành khối 3D, mỗi vật liệu có độ dày riêng.

Tham khảo thiết kế kiếm của Aatrox sau bản làm lại 2018 (splash gốc, splash
Sea Hunter/Justicar do họa sĩ vẽ lại theo kiếm mới, icon Q và nội tại):
- Lưỡi rộng dần về phía mũi, mũi vát chéo, sống lưỡi răng cưa lớn và ngạnh móc gần mũi.
- Khung kim loại tối viền ngoài, lõi là thịt đỏ thẫm có gân, dòng dung nham sáng chảy dọc giữa.
- Mắt Darkin ở chắn kiếm, móng vuốt ôm quanh, cặp sừng đen vươn lên hai bên gốc lưỡi.

Toạ độ: pixel (x, y) phủ ô [x, x+1) x [y, y+1); y = 0 là tâm tay cầm, lưỡi hướng +Y.
Kiếm đối xứng qua x = 0 (ranh giới giữa pixel -1 và 0), gương của x là -1 - x.
"""
import math

# Vật liệu: độ dày (theo trục Z) và có phát sáng không
MATERIALS = {
    "frame": {"depth": 3, "glow": False},  # khung kim loại tối
    "core": {"depth": 2, "glow": False},  # lõi thịt đỏ thẫm
    "lava": {"depth": 3, "glow": True},  # dòng dung nham sáng
    "socket": {"depth": 4, "glow": False},  # hốc thịt quanh mắt
    "eye": {"depth": 5, "glow": True},  # mắt Darkin
    "horn": {"depth": 4, "glow": False},  # sừng, móng vuốt
    "guard": {"depth": 5, "glow": False},  # thanh chắn
    "grip": {"depth": 2, "glow": False},  # tay cầm quấn da
    "band": {"depth": 4, "glow": False},  # vòng kim loại
    "pommel": {"depth": 4, "glow": False},  # núm chuôi
    "spike": {"depth": 2, "glow": False},  # gai núm chuôi
}

BLADE_START = 18  # y bắt đầu lưỡi
BLADE_LENGTH = 40


def mirror(x):
    return -1 - x


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def blade_span(b):
    """Biên trái (sống) và phải (lưỡi bén) của lưỡi ở hàng b (0 = gốc lưỡi)."""
    back = -4 - 3.5 * smooth(b / 14)  # sống lưỡi phình ra tới -7.5
    front = 4 + 4 * smooth(b / 16)  # lưỡi bén phình ra tới 8
    if b >= 30:  # mũi vát chéo từ sống lên đỉnh phía lưỡi bén
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
        """Nét cong dày ở gốc, nhọn ở đỉnh: tô các pixel nằm trong vòng tròn dọc đường."""
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
        """Vẽ đường gấp khúc (có thể dày) qua các điểm."""
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            steps = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
            for i in range(steps + 1):
                t = i / steps
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                for dx in range(width):
                    put(math.floor(x) + dx, math.floor(y), material)

    # --- Lưỡi ---
    blade = set()
    for b in range(BLADE_LENGTH):
        left, right = blade_span(b)
        for x in range(left, right):
            blade.add((x, BLADE_START + b))

    # Răng cưa lớn trên sống lưỡi, nghiêng về phía mũi
    for start in (3, 10, 17, 24):
        for i in range(5):
            y = BLADE_START + start + i
            left = min(x for x, yy in blade if yy == y)
            for j in range(1, (i * 4) // 5 + 1):
                blade.add((left - j, y))

    # Ngạnh móc lớn ở sống, gần mũi
    for x, y in ((-8, 47), (-9, 48), (-8, 48), (-10, 49), (-9, 49), (-10, 50), (-11, 51), (-10, 51), (-11, 52)):
        blade.add((x, y))

    # Khía nhỏ dọc lưỡi bén
    for b in range(3, 30, 4):
        y = BLADE_START + b
        right = max(x for x, yy in blade if yy == y)
        blade.discard((right, y))

    # Khung: pixel gần mép (sống dày 2, lưỡi bén dày 1, mũi dày 2)
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

    # Dòng dung nham giữa lưỡi + các nhánh
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

    # --- Chắn kiếm: hốc mắt, mắt, sừng, móng vuốt ---
    for x in range(-6, 6):
        for y in range(8, 18):
            if ((x + 0.5) / 5.4) ** 2 + ((y + 0.5 - 12.8) / 4.8) ** 2 <= 1:
                put(x, y, "socket")
    for x in range(-3, 3):
        for y in range(10, 16):
            if ((x + 0.5) / 3.1) ** 2 + ((y + 0.5 - 12.8) / 2.6) ** 2 <= 1:
                put(x, y, "eye")

    # Sừng và móng vuốt: nét cong thuôn nhọn (bán kính giảm dần từ gốc tới đỉnh)
    # Sừng lớn vươn lên ôm hai bên gốc lưỡi
    taper([(-5, 15), (-6.5, 17.5), (-8, 20.5), (-8.5, 24), (-7.5, 27.5)], 1.6, 0.35, "horn")
    # Gai chĩa ngang ra ngoài từ hông hốc mắt
    taper([(-5, 13), (-7.5, 13.8), (-10, 15.5)], 1.2, 0.3, "horn")
    # Móng vuốt dưới quặp vào phía tay cầm
    taper([(-4.5, 10), (-7, 9), (-8.3, 6.5), (-7.5, 4), (-5.5, 3)], 1.3, 0.3, "horn")

    # Đối xứng sừng/móng sang bên phải
    for (x, y), material in list(art.items()):
        if material == "horn":
            put(mirror(x), y, "horn", overwrite=False)

    # Thanh chắn dưới hốc mắt
    for x in range(-4, 4):
        for y in (7, 8):
            put(x, y, "guard")

    # --- Tay cầm ---
    for y in range(-8, 7):
        put(-1, y, "grip")
        put(0, y, "grip")
    for y0 in (5, -2, -8):
        for x in range(-2, 2):
            put(x, y0, "band")
    # Núm chuôi + gai
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
