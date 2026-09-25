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
    handle = layer(lambda d: d.line([(4, 28), (18, 14)], fill=MAG, width=3), "wood")
    wraps = Image.new("RGBA", (32, 32)); d = ImageDraw.Draw(wraps)
    for t in (0.25, 0.45, 0.65):
        x, y = 4 + 14 * t, 28 - 14 * t
        d.line([(x - 2, y - 2), (x + 2, y + 2)], fill=MAG, width=2)
    shade(wraps, "wrap")
    pommel = layer(lambda d: d.rectangle([2, 27, 5, 30], fill=MAG), "iron")
    cx, cy, L, T = 19, 12, 11, 5
    def rect(d, l, t, fill=MAG):
        a = math.radians(45); ux, uy = math.cos(a), math.sin(a); vx, vy = -uy, ux
        pts = [(cx + ux * sx * l + vx * sy * t, cy + uy * sx * l + vy * sy * t) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        d.polygon(pts, fill=fill)
    head = layer(lambda d: rect(d, L, T), "flesh")
    bands = Image.new("RGBA", (32, 32)); d = ImageDraw.Draw(bands)
    for s, half in ((-5, 4.5), (5, 4.5), (-10, 4), (10, 4)):
        bx, by = cx + s * 0.707, cy + s * 0.707
        d.line([(bx - half * 0.707, by + half * 0.707), (bx + half * 0.707, by - half * 0.707)], fill=MAG, width=2)
    shade(bands, "iron")
    skull = Image.new("RGBA", (32, 32)); d = ImageDraw.Draw(skull)
    d.rectangle([18, 9, 22, 13], fill=MAG); shade(skull, "bone")
    p = skull.load(); p[19, 11] = p[21, 11] = hx("#1a1a14"); p[20, 13] = hx("#1a1a14")
    gems = Image.new("RGBA", (32, 32)); p = gems.load()
    for x, y in ((23, 3), (24, 4), (27, 7), (14, 10), (26, 13)):
        p[x, y] = col("crystal", 3 if (x + y) % 2 else 2)
    img = outline(stack(handle, wraps, pommel, head, bands, skull))
    img.alpha_composite(gems)
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

ICONS = {"ytaun_zombieaxe": hammer_icon, "ytaun_handgiantzombie": hand_icon, "ytaun_waterofzombie": potion_icon,
         "ytaun_zombie_heart": heart_icon, "ytaun_thitthoiran": meat_icon}
for name, fn in ICONS.items():
    fn().save(os.path.join(ITEMS, f"{name}.png"))

# ---------- MODEL 3D: Zombie Hammer ----------
CUBES = [  # (origin, size, material, extra)
    ([-1, -8, -1], [2, 26, 2], "wood", {}),
    ([-1, -4, -1], [2, 2, 2], "wrap", {"inflate": 0.25}),
    ([-1, 1, -1], [2, 2, 2], "wrap", {"inflate": 0.25}),
    ([-1, 6, -1], [2, 2, 2], "wrap", {"inflate": 0.25}),
    ([-1.5, -10, -1.5], [3, 2, 3], "iron", {}),
    ([-0.5, -11, -0.5], [1, 1, 1], "crystal", {}),
    ([-1.5, 15.5, -1.5], [3, 1.5, 3], "iron", {}),
    ([-6, 17, -3.5], [12, 8, 7], "flesh", {}),
    ([-4.5, 16.5, -4], [1.5, 9, 8], "iron", {}),
    ([3, 16.5, -4], [1.5, 9, 8], "iron", {}),
    ([-7.5, 17.5, -3], [1.5, 7, 6], "iron", {}),
    ([6, 17.5, -3], [1.5, 7, 6], "iron", {}),
    ([-2, 18.5, -4.5], [4, 5, 1], "skull", {}),
    ([-2, 18.5, 3.5], [4, 5, 1], "skull", {}),
    ([-1, 25, -1], [2, 4, 2], "crystal", {"rotation": [0, 45, 0], "pivot": [0, 25, 0]}),
    ([2.5, 25, -0.5], [1, 2.5, 1], "crystal", {"rotation": [0, 0, -20], "pivot": [3, 25, 0]}),
    ([-3.5, 25, 0], [1, 2, 1], "crystal", {"rotation": [0, 0, 20], "pivot": [-3, 25, 0]}),
    ([-9.5, 20, -0.5], [2, 1, 1], "bone", {}),
    ([7.5, 20, -0.5], [2, 1, 1], "bone", {}),
]
TW = 128
tex = Image.new("RGBA", (TW, TW), (0, 0, 0, 0)); tp = tex.load()
cur_x, cur_y, row_h = 0, 0, 0
cubes = []
for origin, size, mat, extra in CUBES:
    w, h, d = [max(1, math.ceil(s)) for s in size]
    uw, uh = 2 * (d + w), d + h
    if cur_x + uw > TW: cur_x, cur_y, row_h = 0, cur_y + row_h, 0
    u, v = cur_x, cur_y
    cur_x += uw; row_h = max(row_h, uh)
    m = "bone" if mat == "skull" else mat
    for y in range(v, v + uh):
        for x in range(u, u + uw):
            if y < v + d and not (u + d <= x < u + d + 2 * w): continue
            lx = x - u; ly = y - v
            top = y < v + d
            edge = (ly == d or ly == uh - 1) if not top else False
            lvl = 3 if top else (0 if edge else 2 if random.random() > 0.2 else 1)
            if mat == "flesh" and random.random() < 0.06: tp[x, y] = hx("#7a2a22"); continue
            if mat == "wood" and not top and (lx % 3 == 0): lvl = 1
            tp[x, y] = col(m, lvl)
    if mat == "skull":  # mặt đầu lâu trên mặt north
        fx, fy = u + d, v + d
        for (a, b) in ((0, 1), (3, 1), (1, 3), (2, 3)): tp[fx + a, fy + b] = hx("#1a1a14")
        tp[fx + 1, fy + 1] = tp[fx + 2, fy + 1] = col("crystal", 3)
    c = {"origin": origin, "size": size, "uv": [u, v]}
    c.update(extra)
    cubes.append(c)
assert cur_y + row_h <= TW, "texture overflow"
tex.save(os.path.join(RP, "textures", "entity", "pamobile", "ytaun_zombieaxe.png"))
geo = {"format_version": "1.16.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.ytaun_zombieaxe", "texture_width": TW, "texture_height": TW,
                    "visible_bounds_width": 3, "visible_bounds_height": 5, "visible_bounds_offset": [0, 1.5, 0]},
    "bones": [{"name": "rightitem", "pivot": [0, 0, 0], "binding": "q.item_slot_to_bone_name(c.item_slot)", "cubes": cubes}]}]}
json.dump(geo, open(os.path.join(RP, "models", "entity", "ytaun_zombieaxe.json"), "w"), indent=2)
print("icons + hammer model ok, uv rows used:", cur_y + row_h)
