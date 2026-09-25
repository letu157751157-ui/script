"""Nâng cấp model + texture Giant Zombie & Zombie General (từ bản gốc trong tools/orig).
- Texture: tô bóng theo từng mặt khối (trên sáng, dưới tối, viền AO), da thịt thối, vải rách, nhiễu pixel.
- Model boss: thêm gai xương vai, gai lưng, dải vải rách ở hông (bone mới, không đổi rig cũ).
Chạy: python3 zombie_boss/tools/gen_models.py"""
import colorsys, json, math, os, random, copy
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
ORIG = os.path.join(os.path.dirname(__file__), "orig")
RP = os.path.join(ROOT, "ytaun_zombie_pack_resource_pack")
TEX = os.path.join(RP, "textures", "entity", "pamobile")
random.seed(21)

def hx(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
PALS = {
    "skin": [hx(c) for c in ("#1f2d14", "#2c3d1c", "#3d5427", "#526e32", "#6a8a3f", "#88a653", "#a6c46a")],
    "cloth": [hx(c) for c in ("#12262b", "#1b3a40", "#24505a", "#2f6670", "#3f7e86", "#5a9aa0", "#7cb8ba")],
    "purple": [hx(c) for c in ("#17122e", "#221a45", "#30265e", "#3e3278", "#4f4392", "#6658ad", "#8274c6")],
    "bone": [hx(c) for c in ("#6e6650", "#8e8468", "#b0a585", "#cfc4a6", "#e3dac0", "#efe8d4", "#fffaf0")],
    "rag": [hx(c) for c in ("#1c1a14", "#2a261c", "#3a3426", "#4c4432", "#5e5440", "#72674e", "#887c5e")],
}

def classify(c):
    r, g, b, a = c
    if a == 0: return None
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if s < 0.18: return None
    if 0.18 < h < 0.42: return "skin"
    if 0.42 <= h < 0.58: return "cloth"
    if 0.62 < h < 0.8: return "purple"
    return None

def level_of(c):
    return max(0, min(6, round(colorsys.rgb_to_hsv(*[x / 255 for x in c[:3]])[2] * 7.5) - 1))

def faces(u, v, w, h, d):
    return {"up": (u + d, v, w, d), "down": (u + d + w, v, w, d), "east": (u, v + d, d, h),
            "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}
LIGHT = {"up": 1.5, "down": -1.5, "north": 0, "south": -0.5, "east": -0.8, "west": -0.8}

def cubes_of(geo):
    for b in geo["bones"]:
        for c in b.get("cubes", []):
            yield c

def enhance(src, geo, tw, out):
    im = Image.open(src).convert("RGBA"); px = im.load()
    k = im.size[0] / tw
    done = set()
    for c in cubes_of(geo):
        if not isinstance(c.get("uv"), list): continue
        w, h, d = [max(0, math.floor(s + 1e-6)) for s in c["size"]]
        for name, (fx, fy, fw, fh) in faces(c["uv"][0], c["uv"][1], w, h, d).items():
            x0, y0, x1, y1 = int(fx * k), int(fy * k), int((fx + fw) * k), int((fy + fh) * k)
            for y in range(y0, y1):
                for x in range(x0, x1):
                    if (x, y) in done or not (0 <= x < im.size[0] and 0 <= y < im.size[1]): continue
                    col = px[x, y]; mat = classify(col)
                    if not mat: continue
                    done.add((x, y))
                    lvl = level_of(col) + LIGHT[name]
                    if x == x0 or y == y0 or x == x1 - 1 or y == y1 - 1: lvl -= 1          # viền tối (AO)
                    if name != "up" and y - y0 < (y1 - y0) * 0.18: lvl += 0.5              # mép trên sáng
                    if random.random() < 0.13: lvl += random.choice((-1, 1))              # nhiễu
                    if mat == "skin" and random.random() < 0.035: lvl -= 2.5              # đốm thối
                    if mat == "cloth":
                        if (y - y0) % 5 == 4: lvl -= 1                                    # đường khâu
                        if y > y1 - 3 and random.random() < 0.35: lvl -= 2                 # mép rách
                    px[x, y] = PALS[mat][max(0, min(6, round(lvl)))]
    im.save(out)
    return im

# ---------- Giant Zombie ----------
base = json.load(open(os.path.join(ORIG, "ytaun_giant_zombie.json")))
g = base["minecraft:geometry"][0]
tw = g["description"]["texture_width"]
ADD = [  # (bone, parent, pivot, cubes[(origin, size, rot, mat)])
    ("ytaun_spike_r", "rightArm", [-4, 37, -2], [([-5, 36.5, -3], [2, 4, 2], [0, 0, 25], "bone"),
                                                 ([-3.8, 36.5, -0.5], [1.5, 3, 1.5], [0, 0, 15], "bone")]),
    ("ytaun_spike_l", "leftArm", [4.5, 37, -2], [([3.5, 36.5, -3], [2, 4, 2], [0, 0, -25], "bone"),
                                                 ([4, 36.5, -0.5], [1.5, 3, 1.5], [0, 0, -15], "bone")]),
    ("ytaun_back_spines", "body", [0, 31, 3], [([-3.5, 30, 2.5], [1.5, 4, 1.5], [-35, 0, 0], "bone"),
                                                ([-0.75, 27, 3.5], [1.5, 5, 1.5], [-40, 0, 0], "bone"),
                                                ([2, 30, 2.5], [1.5, 4, 1.5], [-35, 0, 0], "bone")]),
    ("ytaun_rag_f", "bone18", [0, 20, -2.4], [([-3.5, 14, -2.4], [3, 6, 0], [0, 0, 0], "rag"),
                                              ([0.5, 15, -2.4], [3, 5, 0], [0, 0, 0], "rag")]),
    ("ytaun_rag_b", "bone18", [0, 20, 5.3], [([-3, 14.5, 5.3], [6, 5.5, 0], [0, 0, 0], "rag")]),
]
im = enhance(os.path.join(ORIG, "ytaun_giant_zombie.png"), g, tw, os.path.join(TEX, "ytaun_giant_zombie.png"))
px = im.load(); k = im.size[0] / tw
cu, cv, rowh = 0, 92, 0
for name, parent, pivot, cubes in ADD:
    bone = {"name": name, "parent": parent, "pivot": pivot, "cubes": []}
    for origin, size, rot, mat in cubes:
        w, h, d = [max(0, math.floor(s)) for s in size]
        uw, uh = 2 * (d + w), d + h
        if cu + uw > tw: cu, cv, rowh = 0, cv + rowh, 0
        for fname, (fx, fy, fw, fh) in faces(cu, cv, w, h, d).items():
            for y in range(int(fy * k), int((fy + fh) * k)):
                for x in range(int(fx * k), int((fx + fw) * k)):
                    t = (y - fy * k) / max(1, fh * k)
                    lvl = (5 - t * 3 if mat == "bone" else 3 - t) + LIGHT[fname] * 0.6 + random.choice((0, 0, -1, 1))
                    if mat == "rag" and t > 0.8 and random.random() < 0.5: continue       # mép vải rách (trong suốt)
                    px[x, y] = PALS[mat][max(0, min(6, round(lvl)))]
        cube = {"origin": origin, "size": size, "uv": [cu, cv], "pivot": pivot}
        if any(rot): cube["rotation"] = rot
        bone["cubes"].append(cube)
        cu += uw; rowh = max(rowh, uh)
    g["bones"].append(bone)
im.save(os.path.join(TEX, "ytaun_giant_zombie.png"))
json.dump(base, open(os.path.join(RP, "models", "entity", "ytaun_giant_zombie.json"), "w"), indent=2)

# ---------- Zombie General ----------
gm = json.load(open(os.path.join(RP, "models", "entity", "ytaun_zombie_geneal.json")))
gg = gm["geometry.ytaun_zombie_geneal_default"]
enhance(os.path.join(ORIG, "ytaun_zombie_geneal.png"), gg, gg["texturewidth"], os.path.join(TEX, "ytaun_zombie_geneal.png"))
print("models/textures upgraded")

# ---------- Animation sống động (thở, lắc đầu, bước nặng, vải bay) ----------
T = "q.life_time"
BOSS_IDLE = {"loop": True, "bones": {
    "bone8": {"rotation": [f"math.sin({T} * 80) * 2", 0, f"math.sin({T} * 40) * 1.2"]},
    "head": {"rotation": [f"math.sin({T} * 80 + 40) * 3", f"math.sin({T} * 30) * 5", f"math.sin({T} * 55) * 3"]},
    "rightArm": {"rotation": [f"math.sin({T} * 80 + 20) * 2", 0, f"-math.sin({T} * 80) * 2.5"]},
    "leftArm": {"rotation": [f"math.sin({T} * 80 + 60) * 2", 0, f"math.sin({T} * 80) * 2.5"]},
    "waist": {"position": [0, "-math.abs(math.sin(q.modified_distance_moved * 13.5)) * math.min(q.modified_move_speed, 0.6) * 2.5", 0]},
    "ytaun_rag_f": {"rotation": [f"math.sin({T} * 200) * 5 - math.min(q.modified_move_speed, 0.6) * 40", 0, 0]},
    "ytaun_rag_b": {"rotation": [f"math.sin({T} * 180 + 30) * 5 + math.min(q.modified_move_speed, 0.6) * 40", 0, 0]},
}}
GEN_IDLE = {"loop": True, "bones": {
    "head": {"rotation": [f"math.sin({T} * 90) * 3", f"math.sin({T} * 35) * 6", 0]},
    "bone8": {"rotation": [f"math.sin({T} * 90 + 30) * 2", 0, 0]},
    "rightArm": {"rotation": [0, 0, f"-math.sin({T} * 90) * 3"]},
    "leftArm": {"rotation": [0, 0, f"math.sin({T} * 90) * 3"]},
}}
for fname, key, anim, ent in (("ytaun_giant_zombie", "animation.ytaun_giant_zombie.alive", BOSS_IDLE, "ytaun_giant_zombie"),
                              ("ytaun_zombie_geneal", "animation.ytaun_zombie_geneal.alive", GEN_IDLE, "ytaun_zombie_geneal")):
    ap = os.path.join(RP, "animations", f"{fname}.animation.json")
    a = json.load(open(ap)); a["animations"][key] = anim; json.dump(a, open(ap, "w"), indent=2)
    ep = os.path.join(RP, "entity", f"{ent}.json")
    e = json.load(open(ep)); desc = e["minecraft:client_entity"]["description"]
    desc["animations"]["alive"] = key
    lst = desc["scripts"]["animate"]
    if "alive" not in lst: lst.append("alive")
    json.dump(e, open(ep, "w"), indent=2)
print("alive animations added")
