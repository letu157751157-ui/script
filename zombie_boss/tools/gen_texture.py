"""Vẽ atlas particle kiểu PIXEL ART (giống vanilla): 64x64, ô 16px, không khử răng cưa, không blur.
Màu trắng/xám để particle tự tô màu (tint). Ra: textures/particle/ytaun_boss.png
Hàng 0: glow, smoke, ring, star | 1: spike, rock, rune, bubble | 2: crack, flame, streak, shard"""
import math, os, random
from PIL import Image

N = 16
OUT = os.path.join(os.path.dirname(__file__), "..", "ytaun_zombie_pack_resource_pack", "textures", "particle", "ytaun_boss.png")
random.seed(3)
W, L, M, D, K = (255, 255, 255, 255), (214, 214, 214, 255), (160, 160, 160, 255), (110, 110, 110, 255), (70, 70, 70, 255)
A = {1: (255, 255, 255, 110), 2: (255, 255, 255, 190)}

def grid(fn):
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0)); px = im.load()
    for y in range(N):
        for x in range(N):
            cx, cy = x - 7.5, y - 7.5
            c = fn(x, y, math.hypot(cx, cy), math.atan2(cy, cx))
            if c: px[x, y] = c
    return im

def art(rows, pal):
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0)); px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in pal: px[x, y] = pal[ch]
    return im

glow = grid(lambda x, y, r, t: W if r < 2.5 else A[2] if r < 4.5 else A[1] if r < 6.5 else None)
blob = [(5, 6, 4), (10, 6, 4), (7.5, 10, 4.5), (5, 10, 3), (10.5, 9.5, 3.5)]
def smoke_fn(x, y, r, t):
    d = min(math.hypot(x - bx, y - by) - br for bx, by, br in blob)
    if d > 0.3: return None
    return D if d > -1 else M if (x + y) % 5 == 0 else L if y > 8 else W
smoke = grid(smoke_fn)
ring = grid(lambda x, y, r, t: W if 6 <= r < 7.5 else A[1] if 4.5 <= r < 5.5 else None)
star = art(["................", "................", ".......W........", ".......W........",
            ".......W........", "......LWL.......", ".......W........", "..WWWWWWWWWWW...",
            ".......W........", "......LWL.......", ".......W........", ".......W........",
            ".......W........", "................", "................", "................"], {"W": W, "L": A[2]})
spike = art([".......L........", ".......LM.......", "......LLM.......", "......LMD.......",
             "......LMD.......", ".....LLMD.......", ".....LMMDD......", ".....LMKMD......",
             "....LLMMDD......", "....LMMMDD......", "....LMKMDDD.....", "...LLMMMDKD.....",
             "...LMMMMDDD.....", "..LLMKMMMDDD....", "..LMMMMMDDKD....", ".LLMMMMMMDDDD..."],
            {"L": L, "M": M, "D": D, "K": K})
rock = art(["................", "................", ".....LLLL.......", "....LLLLLM......",
            "...LLWLLMMM.....", "..LLLLLMMMMD....", "..LLLLMMMMDD....", "..LLMMMMMDDD....",
            "..LMMMMMKDDD....", "...MMMMMDDDK....", "...MMMKDDDDK....", "....DDDDDKK.....",
            ".....DDKKK......", "................", "................", "................"],
           {"W": W, "L": L, "M": M, "D": D, "K": K})
def rune_fn(x, y, r, t):
    if 6.6 <= r < 7.6: return W
    ang = (t + math.pi / 2) % (2 * math.pi / 3)
    if 4.8 <= r < 5.8 and (ang < 0.25 or ang > 2 * math.pi / 3 - 0.25): return W
    if 3 <= r < 3.9: return A[2]
    if r < 1.2: return W
    return None
rune = grid(rune_fn)
bubble = grid(lambda x, y, r, t: (W if (x, y) in ((5, 5), (6, 5), (5, 6)) else L if 5.8 <= r < 7 else A[1] if r < 5.8 else None))
crack = art(["................", "..W.........W...", "...W.......W....", "....W.....W.....",
             ".....W...WW.....", "......W.W.......", "..WWW..W........", ".....WWWW.......",
             "........WWWWW...", ".......W.....W..", "......W.W......W", ".....W...W......",
             "....W.....W.....", "...W.......W....", "..W..............", "................"], {"W": W})
flame = art(["................", ".......L........", "......LL........", "......LWL.......",
             ".....LWWL.......", ".....LWWWL......", "....LWWWWL......", "....LWWMWWL.....",
             "...LWWMMWWL.....", "...LWMMMMWL.....", "...LWMMMMWL.....", "...LWWMMWWL.....",
             "....LWWWWL......", ".....LLLL.......", "................", "................"],
            {"W": W, "L": A[2], "M": L})
streak = art(["................"] * 2 + [".......W........"] * 3 + [".......L........"] * 6 + [".......M........"] * 3 + ["................"] * 2,
             {"W": W, "L": L, "M": A[2]})
shard = art(["................", ".......W........", "......WWL.......", "......WWL.......",
             ".....WWWLL......", ".....WWWLL......", "....WWWWLLL.....", "....WWWWLLL.....",
             ".....WWWLL......", ".....WWWLL......", "......WWL.......", "......WWL.......",
             ".......W........", "................", "................", "................"], {"W": W, "L": M})

atlas = Image.new("RGBA", (N * 4, N * 3), (0, 0, 0, 0))
for i, im in enumerate([glow, smoke, ring, star, spike, rock, rune, bubble, crack, flame, streak, shard]):
    atlas.paste(im, ((i % 4) * N, (i // 4) * N))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
atlas.save(OUT)
print("texture ->", os.path.normpath(OUT))
