"""Vẽ lại icon item (pixel art 32x32) + model 3D & texture của Zombie Hammer (ytaun:zombieaxe).
Chạy: python3 zombie_boss/tools/gen_items.py"""
import json, math, os, random
from PIL import Image, ImageDraw

RP = os.path.join(os.path.dirname(__file__), "..", "ytaun_zombie_pack_resource_pack")
ITEMS = os.path.join(RP, "textures", "items", "pamobile")
random.seed(5)

def hx(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
PAL = {
    "wood": ["#3a2618", "#4a3222", "#5c3d28", "#6e4a31"],
    "wrap": ["#23401a", "#2e5421", "#3f6b2a", "#56903a"],
    "iron": ["#4a4e53", "#6b7075", "#8a8f94", "#b4b9be"],
    "flesh": ["#33481f", "#435f2a", "#577a36", "#6e9444"],
    "crystal": ["#3fae2a", "#6ee04a", "#9cff6a", "#e0ffc8"],
    "bone": ["#8e8468", "#b0a585", "#cfc4a6", "#efe8d4"],
    "glass": ["#6c8c96", "#9fc3cc", "#cfe8ee", "#ffffff"],
    "meat": ["#4a2a1c", "#6b3a26", "#8a4c32", "#a8674a"],
    "rot": ["#3d4f24", "#56702e", "#6f8f3a", "#8fb04c"],
    "cork": ["#5a3e22", "#7a5630", "#9a7040", "#b88c58"],
}
def col(mat, i): return hx(PAL[mat][max(0, min(3, i))])

def outline(im, color=(22, 26, 18, 255)):
    px = im.load(); w, h = im.size; out = im.copy(); o = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0 and any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] > 0
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                o[x, y] = color
    return out

def shade(im, mat, light=(-1, -1)):
    """Tô lại theo vật liệu: sáng ở cạnh trên-trái, tối ở dưới-phải, có nhiễu pixel."""
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0 or px[x, y][:3] != (255, 0, 255): continue
            def solid(a, b): return 0 <= a < w and 0 <= b < h and px[a, b][3] > 0
            lvl = 2
            if not solid(x + light[0], y + light[1]): lvl = 3
            elif not solid(x - light[0], y - light[1]): lvl = 0
            elif random.random() < 0.18: lvl = 1
            px[x, y] = col(mat, lvl)

MAG = (255, 0, 255, 255)
def layer(draw_fn, mat, size=32):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0)); draw_fn(ImageDraw.Draw(im)); shade(im, mat); return im

def stack(*layers):
    base = Image.new("RGBA", layers[0].size, (0, 0, 0, 0))
    for l in layers: base.alpha_composite(l)
    return base

# ---------- ICON: Zombie Hammer ----------
def hammer_icon():
    # Khớp model "đầu zombie": cán xương đùi quấn giẻ, đầu zombie vuông, đai sắt gỉ, đinh gỉ
    hd, pd = (0.707, -0.707), (0.707, 0.707)
    cx, cy = 20, 11
    def P(t, s): return (cx + hd[0] * t + pd[0] * s, cy + hd[1] * t + pd[1] * s)
    def quad(d, t0, t1, s0, s1): d.polygon([P(t0, s0), P(t0, s1), P(t1, s1), P(t1, s0)], fill=MAG)
    shaft = layer(lambda d: d.line([P(-20, 0), P(-5, 0)], fill=MAG, width=3), "bone")
    knob = layer(lambda d: (quad(d, -23, -20, -2.5, 2.5)), "bone")
    rag = layer(lambda d: d.line([P(-18, 0), P(-12, 0)], fill=MAG, width=4), "cork")
    head = Image.new("RGBA", (32, 32)); d = ImageDraw.Draw(head)
    d.rectangle([12, 3, 27, 18], fill=MAG); shade(head, "rot")                              # đầu zombie nhìn thẳng
    face = ImageDraw.Draw(head)
    face.rectangle([14, 8, 17, 9], fill=hx("#10160c")); face.rectangle([22, 8, 25, 9], fill=hx("#10160c"))
    face.point([(15, 8), (23, 8)], fill=hx("#b01e16"))
    face.rectangle([19, 10, 20, 11], fill=col("flesh", 0))
    face.rectangle([16, 14, 23, 15], fill=hx("#10160c")); face.point([(16, 13), (23, 13)], fill=hx("#10160c"))
    face.point([(18, 15), (21, 15)], fill=col("bone", 3))
    band = Image.new("RGBA", (32, 32)); ImageDraw.Draw(band).rectangle([11, 5, 28, 6], fill=MAG); shade(band, "cork")
    nails = Image.new("RGBA", (32, 32)); nd = ImageDraw.Draw(nails)
    for (x0, y0, x1, y1) in ((19, 0, 19, 2), (14, 1, 14, 2), (25, 1, 25, 2), (28, 6, 30, 6), (9, 14, 11, 14), (28, 15, 30, 15)):
        nd.line([(x0, y0), (x1, y1)], fill=MAG)
    shade(nails, "cork")
    img = outline(stack(shaft, knob, rag, head, band, nails))
    gp = img.load(); gp[25, 4] = gp[14, 5] = col("crystal", 3)
    return img

def hand_icon():
    sleeve = layer(lambda d: d.polygon([(3, 29), (10, 22), (15, 27), (8, 31)], fill=MAG), "cork")
    def palm(d):
        d.polygon([(9, 23), (15, 14), (22, 17), (16, 27)], fill=MAG)
        for (x0, y0, x1, y1) in ((15, 14, 18, 4), (18, 15, 23, 6), (20, 16, 27, 10), (22, 18, 28, 16), (10, 21, 7, 13)):
            d.line([(x0, y0), (x1, y1)], fill=MAG, width=3)
    skin = layer(palm, "rot")
    nails = Image.new("RGBA", (32, 32)); p = nails.load()
    for x, y in ((18, 4), (23, 6), (27, 10), (28, 16), (7, 13)):
        p[x, y] = col("bone", 3)
    wound = Image.new("RGBA", (32, 32)); p = wound.load()
    for x, y in ((15, 20), (16, 21), (17, 20), (14, 22)):
        p[x, y] = hx("#8a2a22")
    img = outline(stack(sleeve, skin, wound)); img.alpha_composite(nails); return img

def potion_icon():
    glass = layer(lambda d: (d.ellipse([6, 12, 26, 31], fill=MAG), d.rectangle([13, 6, 19, 14], fill=MAG)), "glass")
    liquid = layer(lambda d: d.ellipse([8, 17, 24, 29], fill=MAG), "crystal")
    cork = layer(lambda d: d.rectangle([12, 3, 20, 7], fill=MAG), "cork")
    label = Image.new("RGBA", (32, 32)); d = ImageDraw.Draw(label)
    d.rectangle([13, 20, 19, 25], fill=col("bone", 2))
    p = label.load(); p[14, 22] = p[18, 22] = hx("#1a1a14"); p[16, 24] = hx("#1a1a14")
    bub = Image.new("RGBA", (32, 32)); p = bub.load()
    for x, y in ((11, 19), (21, 18), (20, 27), (10, 25)): p[x, y] = col("crystal", 3)
    shine = Image.new("RGBA", (32, 32)); p = shine.load()
    for y in range(15, 22): p[8 if y > 17 else 9, y] = (255, 255, 255, 200)
    img = outline(stack(glass, liquid, cork, label)); img.alpha_composite(bub); img.alpha_composite(shine); return img

def heart_icon():
    def hs(d):
        d.ellipse([3, 5, 17, 19], fill=MAG); d.ellipse([15, 5, 29, 19], fill=MAG)
        d.polygon([(4, 14), (28, 14), (16, 29)], fill=MAG)
    heart = layer(hs, "rot")
    veins = Image.new("RGBA", (32, 32)); d = ImageDraw.Draw(veins)
    d.line([(10, 9), (13, 14), (12, 20), (15, 24)], fill=col("flesh", 0), width=1)
    d.line([(22, 8), (19, 13), (21, 19)], fill=col("flesh", 0), width=1)
    stitch = Image.new("RGBA", (32, 32)); d = ImageDraw.Draw(stitch)
    d.line([(16, 8), (16, 26)], fill=hx("#2a1c12"), width=1)
    for y in range(10, 26, 3): d.line([(15, y), (17, y)], fill=col("bone", 2))
    glow = Image.new("RGBA", (32, 32)); p = glow.load()
    for x, y in ((8, 9), (9, 8), (22, 10), (12, 17)): p[x, y] = col("crystal", 3)
    img = outline(stack(heart, veins, stitch)); img.alpha_composite(glow); return img

def meat_icon():
    top = layer(lambda d: d.polygon([(3, 12), (17, 5), (29, 10), (15, 17)], fill=MAG), "meat")
    mold = Image.new("RGBA", (32, 32)); p = mold.load()
    for x, y in ((9, 10), (10, 10), (10, 11), (18, 8), (19, 8), (22, 11), (14, 13), (24, 18), (6, 19)): p[x, y] = col("rot", 2)
    side_l = layer(lambda d: d.polygon([(3, 12), (15, 17), (15, 28), (3, 23)], fill=MAG), "meat")
    side_r = layer(lambda d: d.polygon([(15, 17), (29, 10), (29, 21), (15, 28)], fill=MAG), "meat")
    marb = Image.new("RGBA", (32, 32)); d = ImageDraw.Draw(marb)
    d.line([(5, 17), (13, 21)], fill=hx("#d9b8a0")); d.line([(18, 22), (27, 17)], fill=hx("#d9b8a0"))
    d.line([(6, 21), (10, 23)], fill=hx("#d9b8a0"))
    fly = Image.new("RGBA", (32, 32)); p = fly.load()
    for x, y in ((22, 2), (26, 4)): p[x, y] = hx("#141414"); p[x - 1, y - 1] = (220, 220, 255, 160); p[x + 1, y - 1] = (220, 220, 255, 160)
    img = outline(stack(top, side_l, side_r, marb, mold)); img.alpha_composite(fly); return img

# Chỉ vẽ icon búa (khớp model 3D); các item khác giữ icon gốc
ICONS = {"ytaun_zombieaxe": hammer_icon}
for name, fn in ICONS.items():
    fn().save(os.path.join(ITEMS, f"{name}.png"))

# ---------- MODEL 3D: Zombie Hammer (vẽ lại từ đầu, texture HD 4 pixel / đơn vị) ----------
TW, K = 128, 2
random.seed(9)
M = {  # vật liệu: 7 sắc độ tối -> sáng
    "wood": ["#1e130b", "#2b1c10", "#3a2616", "#4a321d", "#5c3f25", "#6f4d2e", "#835c38"],
    "leather": ["#1a100a", "#2a1a10", "#3b2616", "#4d331e", "#604128", "#745034", "#8a6142"],
    "iron": ["#262a2e", "#3a3f44", "#50565c", "#687076", "#838b91", "#a2aaaf", "#c8cfd3"],
    "flesh": ["#1b2610", "#263618", "#344a20", "#44602a", "#557636", "#6b8f44", "#86a957"],
    "bone": ["#5e5642", "#7a7056", "#978c6e", "#b3a888", "#cbc1a2", "#e0d8bd", "#f4efdc"],
    "crystal": ["#0f4a12", "#1d7a1f", "#2fa82b", "#4fd23c", "#7ef060", "#b4ff94", "#eaffdc"],
    "skin": ["#1f3a14", "#2b4f1b", "#3a6624", "#4a7d2e", "#5a9338", "#6fa845", "#88bf58"],
    "rag": ["#1c1a14", "#2a261c", "#3a3426", "#4c4432", "#5e5440", "#72674e", "#887c5e"],
    "rust": ["#2a130a", "#40200f", "#5a2e14", "#76401c", "#915426", "#ab6a34", "#c78648"],
}
def C(m, i): return hx(M[m][max(0, min(6, int(round(i))))])
LIGHTF = {"up": 1.4, "down": -1.6, "north": 0.3, "south": -0.4, "east": -0.8, "west": -0.2}

def paint(tp, mat, fname, x0, y0, fw, fh, special=None):
    for y in range(fh):
        for x in range(fw):
            tx, ty = x / max(1, fw - 1), y / max(1, fh - 1)
            lvl = 3.2 + LIGHTF[fname] - ty * 0.8
            edge = x in (0, fw - 1) or y in (0, fh - 1)
            if mat == "wood":
                lvl += 0.7 * math.sin(x * 2.1 + math.sin(y * 0.07) * 0.8)                  # vân gỗ dọc
                if random.random() < 0.05: lvl -= 1.5
            elif mat == "leather":
                if (x + y) % 8 < 2 or (x - y) % 8 < 2: lvl -= 1.3                          # dây quấn chéo
                lvl += random.choice((0, 0, 0.5, -0.5))
            elif mat == "iron":
                lvl += random.choice((0, 0, 0, 0.4, -0.4))
                if random.random() < 0.02: lvl -= 2                                         # vết xước / gỉ
                if fh > 12 and fw > 12 and (x % 12 in (2, 3)) and (y % 12 in (2, 3)): lvl = 6  # đinh tán
            elif mat == "flesh":
                lvl += random.choice((0, 0, 0.6, -0.6))
                v = math.sin(x * 0.35 + y * 0.2) * math.sin(y * 0.3 - x * 0.1)
                if abs(v) < 0.06: tp[x0 + x, y0 + y] = hx("#5a1e1a"); continue            # mạch máu
                if random.random() < 0.012: tp[x0 + x, y0 + y] = hx("#b8d85a"); continue   # mụn mủ
            elif mat == "bone":
                lvl = 5.2 - ty * 1.8 + LIGHTF[fname] * 0.5 + random.choice((0, 0, -0.5))
                if random.random() < 0.03: lvl -= 2
            elif mat == "skin":
                lvl += random.choice((0, 0, 0, 0.7, -0.7))
                if random.random() < 0.03: lvl -= 2                                         # đốm thối
            elif mat == "rag":
                if y % 6 == 5: lvl -= 1
                lvl += random.choice((0, 0.5, -0.5))
            elif mat == "rust":
                lvl += random.choice((0, 0, 0.6, -0.6, -1.2))
            elif mat == "crystal":
                lvl = 6 - abs(tx - 0.5) * 5 - ty * 1.5 + LIGHTF[fname] * 0.4
            if edge and mat not in ("crystal",): lvl -= 1.2
            tp[x0 + x, y0 + y] = C(mat, lvl)
    if special == "zface":                                                                 # mặt zombie kiểu Minecraft
        u = fw / 8
        def blk(bx, by, bw, bh, c_):
            for yy in range(int(by * u), int((by + bh) * u)):
                for xx in range(int(bx * u), int((bx + bw) * u)): tp[x0 + xx, y0 + yy] = c_
        blk(1, 3, 2, 1, hx("#10160c")); blk(5, 3, 2, 1, hx("#10160c"))                        # mắt
        blk(2, 3, 1, 1, hx("#9a1a14")); blk(5, 3, 1, 1, hx("#9a1a14"))                        # đồng tử đỏ
        blk(3, 4, 2, 1, C("skin", 1))                                                         # mũi
        blk(2, 6, 4, 1, hx("#10160c")); blk(2, 5, 1, 1, hx("#10160c")); blk(5, 5, 1, 1, hx("#10160c"))  # miệng
        blk(3, 6, 1, 1, C("bone", 5)); blk(4, 6, 1, 1, C("bone", 4))                          # răng
    if special == "skull":                                                                  # mặt đầu lâu
        dark = hx("#141410")
        def dot(fx_, fy_, w_=1, h_=1, c_=dark):
            for yy in range(int(fy_ * fh), int(fy_ * fh) + h_):
                for xx in range(int(fx_ * fw), int(fx_ * fw) + w_): tp[x0 + xx, y0 + yy] = c_
        dot(0.15, 0.25, 3, 3); dot(0.6, 0.25, 3, 3)                                         # hốc mắt
        dot(0.25, 0.33, 1, 1, C("crystal", 6)); dot(0.7, 0.33, 1, 1, C("crystal", 6))      # mắt phát sáng
        dot(0.45, 0.55, 1, 2)                                                               # mũi
        for fx_ in (0.2, 0.4, 0.6, 0.8): dot(fx_, 0.78, 1, 2)                               # răng

BONES = {  # KIỂU "ĐẦU ZOMBIE": cán xương đùi quấn giẻ, đầu búa là đầu zombie có đai sắt gỉ + đinh
    "rightitem": (None, [0, 0, 0], [
        ([-1.25, -11, -1.25], [2.5, 28, 2.5], "bone", {}),
        ([-2, -14, -2], [4, 3, 4], "bone", {}),                        # đầu khớp xương dưới
        ([-2.5, -13.5, -1], [1, 2, 2], "bone", {}), ([1.5, -13.5, -1], [1, 2, 2], "bone", {}),
        ([-1.5, -9, -1.5], [3, 8, 3], "rag", {}),                      # giẻ quấn tay cầm
        ([-1.5, 6, -1.5], [3, 2, 3], "rag", {}),
        ([-2, 15.5, -2], [4, 2, 4], "rust", {}),                       # vòng sắt gỉ nối đầu
    ]),
    "hammer_head": ("rightitem", [0, 22, 0], [
        ([-4.5, 17, -4.5], [9, 9, 9], "skin", {"special": "zface"}),
        ([-5, 24.6, -5], [10, 1.2, 10], "rust", {}),                   # đai sắt ngang (trán)
        ([-0.5, 26, -0.5], [1, 3, 1], "rust", {}),                     # đinh trên đỉnh
        ([-3, 26, 1.5], [1, 2, 1], "rust", {}), ([2, 26, -2.5], [1, 2.5, 1], "rust", {}),
        ([-7, 22, -0.5], [2.5, 1, 1], "rust", {}), ([4.5, 22, -0.5], [2.5, 1, 1], "rust", {}),  # đinh 2 bên
        ([-6.5, 18.5, 1.5], [2, 1, 1], "rust", {}), ([4.5, 24, -2], [2, 1, 1], "rust", {}),
        ([-1.5, 21, 4.5], [3, 3, 1.5], "bone", {}),                   # xương thò ra sau đầu
    ]),
    "gems": ("hammer_head", [0, 26, 0], [
        ([1.5, 26, 1.5], [1.5, 1.5, 1.5], "crystal", {}),              # mụn mủ phát sáng trên đầu
        ([-3, 26, -3], [1, 1, 1], "crystal", {}),
    ]),
    "chain_l": ("hammer_head", [-4.5, 20, 0], [
        ([-5, 18, -0.5], [1, 2, 1], "rust", {}), ([-5, 16, -0.5], [1, 2, 1], "rust", {}),
        ([-5, 14, -0.5], [1, 2, 1], "rust", {}),
    ]),
    "chain_r": ("hammer_head", [4.5, 20, 0], [
        ([4, 18, -0.5], [1, 2, 1], "rust", {}), ([4, 16, -0.5], [1, 2, 1], "rust", {}),
        ([3.5, 13.5, -1], [2, 2.5, 2], "bone", {}),
    ]),
}
tex = Image.new("RGBA", (TW * K, TW * K), (0, 0, 0, 0)); tp = tex.load()
cu = cv = rowh = 0
bones = []
for bname, (parent, pivot, cubes) in BONES.items():
    bone = {"name": bname, "pivot": pivot, "cubes": []}
    if parent: bone["parent"] = parent
    else: bone["binding"] = "q.item_slot_to_bone_name(c.item_slot)"
    for origin, size, mat, extra in cubes:
        w, h, d = [max(1, math.ceil(v)) for v in size]
        uw, uh = 2 * (d + w), d + h
        if cu + uw > TW: cu, cv, rowh = 0, cv + rowh, 0
        for fname, (fx, fy, fw, fh) in {"up": (cu + d, cv, w, d), "down": (cu + d + w, cv, w, d), "east": (cu, cv + d, d, h),
                                        "north": (cu + d, cv + d, w, h), "west": (cu + d + w, cv + d, d, h),
                                        "south": (cu + 2 * d + w, cv + d, w, h)}.items():
            sp = extra.get("special") if fname in ("north", "south") else None
            paint(tp, mat, fname, fx * K, fy * K, fw * K, fh * K, sp)
        c = {"origin": origin, "size": size, "uv": [cu, cv]}
        if "rotation" in extra: c["rotation"] = extra["rotation"]; c["pivot"] = [origin[0] + size[0] / 2, origin[1], origin[2] + size[2] / 2]
        bone["cubes"].append(c)
        cu += uw; rowh = max(rowh, uh)
    bones.append(bone)
assert cv + rowh <= TW, ("texture overflow", cv + rowh)
tex.save(os.path.join(RP, "textures", "entity", "pamobile", "ytaun_zombieaxe.png"))
geo = {"format_version": "1.16.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.ytaun_zombieaxe", "texture_width": TW, "texture_height": TW,
                    "visible_bounds_width": 3, "visible_bounds_height": 5, "visible_bounds_offset": [0, 1.5, 0]},
    "bones": bones}]}
json.dump(geo, open(os.path.join(RP, "models", "entity", "ytaun_zombieaxe.json"), "w"), indent=2)

# ---------- Animation cầm búa: pha lê xoay + lơ lửng, xích đung đưa ----------
AP = os.path.join(RP, "animations", "ytaun_zombieaxe.animation.json")
anim = json.load(open(AP))
anim["animations"]["animation.ytaun_zombieaxe.alive"] = {"loop": True, "bones": {
    "gems": {"scale": "1 + math.sin(q.life_time * 240) * 0.15"},
    "hammer_head": {"rotation": [0, 0, "math.sin(q.life_time * 60) * 1.5"]},
    "chain_l": {"rotation": ["math.sin(q.life_time * 120) * 8", 0, "math.sin(q.life_time * 150) * 12"]},
    "chain_r": {"rotation": ["math.sin(q.life_time * 120 + 60) * 8", 0, "math.sin(q.life_time * 150 + 90) * 12"]},
}}
json.dump(anim, open(AP, "w"), indent=2)
AT = os.path.join(RP, "attachables", "ytaun_zombieaxe.json")
att = json.load(open(AT)); desc = att["minecraft:attachable"]["description"]
desc["animations"]["alive"] = "animation.ytaun_zombieaxe.alive"
if "alive" not in desc["scripts"]["animate"]: desc["scripts"]["animate"].append("alive")
json.dump(att, open(AT, "w"), indent=2)
print("hammer model/texture/anim rebuilt")
