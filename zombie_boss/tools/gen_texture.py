"""Vẽ atlas texture particle 256x256 (ô 64px) cho boss: textures/particle/ytaun_boss.png
Hàng 0: glow, smoke, ring, star | Hàng 1: spike, rock, rune, bubble | Hàng 2: crack, flame, spark streak, shard"""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter

C = 64
OUT = os.path.join(os.path.dirname(__file__), "..", "ytaun_zombie_pack_resource_pack", "textures", "particle", "ytaun_boss.png")
random.seed(7)
atlas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))

def cell():
    return Image.new("RGBA", (C, C), (0, 0, 0, 0))

def radial(fn):
    im = cell(); px = im.load()
    for y in range(C):
        for x in range(C):
            dx, dy = (x + 0.5 - C / 2) / (C / 2), (y + 0.5 - C / 2) / (C / 2)
            r = math.hypot(dx, dy)
            a = fn(r, math.atan2(dy, dx), x, y)
            if a:
                px[x, y] = a
    return im

def white(a): return (255, 255, 255, max(0, min(255, int(a * 255))))

glow = radial(lambda r, t, x, y: white((1 - r) ** 2.2) if r < 1 else None)

noise = [[random.random() for _ in range(C)] for _ in range(C)]
def smoke_fn(r, t, x, y):
    wob = 0.88 + 0.06 * math.sin(t * 5 + 1) + 0.04 * math.sin(t * 9)
    if r > wob: return None
    a = (1 - r / wob) ** 0.8 * (0.65 + 0.35 * noise[y][x])
    g = int(200 + 55 * (1 - r))
    return (g, g, g, int(a * 230))
smoke = radial(smoke_fn).filter(ImageFilter.GaussianBlur(1.2))

ring = radial(lambda r, t, x, y: white(math.exp(-((r - 0.86) / 0.07) ** 2) + 0.25 * math.exp(-((r - 0.6) / 0.05) ** 2)) if r < 1 else None)

def star_fn(r, t, x, y):
    if r >= 1: return None
    arms = abs(math.cos(t * 2)) ** 18
    a = max((1 - r) ** 3 * 1.2, arms * (1 - r) ** 1.5) + (0.9 if r < 0.12 else 0)
    return white(a) if r < 1 else None
star = radial(star_fn)

# gai đá: tam giác dài, tô bóng trái sáng phải tối
spike = cell(); d = ImageDraw.Draw(spike)
d.polygon([(32, 2), (50, 63), (14, 63)], fill=(150, 140, 128, 255))
d.polygon([(32, 2), (50, 63), (33, 63)], fill=(96, 88, 80, 255))
for i in range(40):
    y = random.randint(10, 62); x = 32 + random.randint(-int((y - 2) * 0.28), int((y - 2) * 0.28))
    d.point((x, y), fill=(70, 64, 58, 255))
d.line([(32, 2), (30, 30), (34, 45), (31, 63)], fill=(60, 54, 48, 255), width=1)

# tảng đá: đa giác lởm chởm tô bóng
rock = cell(); d = ImageDraw.Draw(rock)
pts = [(32 + math.cos(a) * r, 32 + math.sin(a) * r) for a, r in
       [(i / 9 * 2 * math.pi, 22 + random.randint(-6, 6)) for i in range(9)]]
d.polygon(pts, fill=(120, 112, 102, 255))
d.polygon([(p[0] + 4, p[1] + 4) for p in pts[2:6]] + [(32, 32)], fill=(82, 76, 70, 255))
d.polygon([(p[0] - 2, p[1] - 2) for p in pts[6:9]] + [(32, 32)], fill=(158, 150, 138, 255))
rock = rock.filter(ImageFilter.SMOOTH)

# rune: 2 vòng tròn + 6 ký hiệu + ngôi sao 6 cánh
rune = cell(); d = ImageDraw.Draw(rune)
d.ellipse([3, 3, 60, 60], outline=(255, 255, 255, 255), width=2)
d.ellipse([10, 10, 53, 53], outline=(255, 255, 255, 200), width=1)
for k in (0, 1):
    tri = [(32 + 21 * math.cos(-math.pi / 2 + k * math.pi + i * 2 * math.pi / 3),
            32 + 21 * math.sin(-math.pi / 2 + k * math.pi + i * 2 * math.pi / 3)) for i in range(3)]
    d.polygon(tri, outline=(255, 255, 255, 230))
for i in range(6):
    a = i / 6 * 2 * math.pi
    cx, cy = 32 + 26 * math.cos(a), 32 + 26 * math.sin(a)
    d.rectangle([cx - 2, cy - 2, cx + 2, cy + 2], outline=(255, 255, 255, 255))
rune = Image.alpha_composite(rune.filter(ImageFilter.GaussianBlur(1.5)), rune)

bubble = radial(lambda r, t, x, y: white(0.25 + 0.75 * max(0, (r - 0.7) / 0.3) ** 2 +
                                         (0.9 if math.hypot(x - 22, y - 22) < 5 else 0)) if r < 1 else None)

# vết nứt đất: các nhánh ngoằn ngoèo từ tâm
crack = cell(); d = ImageDraw.Draw(crack)
for i in range(7):
    a = i / 7 * 2 * math.pi + random.random() * 0.5
    x, y = 32, 32
    for s in range(6):
        a += random.uniform(-0.5, 0.5)
        nx, ny = x + math.cos(a) * 5, y + math.sin(a) * 5
        d.line([(x, y), (nx, ny)], fill=(255, 255, 255, 255), width=max(1, 3 - s // 2))
        x, y = nx, ny
crack = Image.alpha_composite(crack.filter(ImageFilter.GaussianBlur(1)), crack)

def flame_fn(r, t, x, y):
    fx, fy = (x - 32) / 18, (y - 40) / 24
    v = fx * fx + (fy if fy > 0 else fy * 0.45) ** 2
    return white((1 - v) ** 1.5) if v < 1 else None
flame = radial(flame_fn).filter(ImageFilter.GaussianBlur(1))

streak = cell(); d = ImageDraw.Draw(streak)
for w, a in ((9, 60), (5, 140), (2, 255)):
    d.line([(32, 4), (32, 60)], fill=(255, 255, 255, a), width=w)
streak = streak.filter(ImageFilter.GaussianBlur(1))

shard = cell(); d = ImageDraw.Draw(shard)
d.polygon([(32, 6), (46, 30), (34, 58), (20, 34)], fill=(255, 255, 255, 255))
d.polygon([(32, 6), (46, 30), (34, 58)], fill=(200, 200, 200, 255))

for i, im in enumerate([glow, smoke, ring, star, spike, rock, rune, bubble, crack, flame, streak, shard]):
    atlas.paste(im, ((i % 4) * C, (i // 4) * C))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
atlas.save(OUT)
print("texture ->", os.path.normpath(OUT))
