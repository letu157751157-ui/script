"""Tổng hợp âm thanh boss (.ogg) bằng numpy + khai báo sound_definitions.json.
Chạy: python3 zombie_boss/tools/gen_sounds.py  (cần: pip install numpy soundfile)"""
import json, os
import numpy as np
import soundfile as sf

SR = 22050
RP = os.path.join(os.path.dirname(__file__), "..", "ytaun_zombie_pack_resource_pack")
OUT = os.path.join(RP, "sounds", "ytaun")
rng = np.random.default_rng(11)

def t(d): return np.arange(int(SR * d)) / SR
def noise(d): return rng.uniform(-1, 1, int(SR * d))
def env(n, a, r, curve=2.0):
    x = np.ones(n); na, nr = int(SR * a), int(SR * r)
    if na: x[:na] = np.linspace(0, 1, na)
    if nr: x[-nr:] *= np.linspace(1, 0, nr) ** curve
    return x
def lowpass(x, fc):
    fc = np.broadcast_to(fc, x.shape); y = np.zeros_like(x); s = 0.0
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y
def bandpass(x, f, q=4):
    return lowpass(x, f * (1 + 1 / q)) - lowpass(x, f * (1 - 1 / q))
def saw(freq):
    ph = np.cumsum(freq) / SR
    return 2 * (ph % 1) - 1
def drive(x, k=3): return np.tanh(x * k) / np.tanh(k)
def norm(x, peak=0.9): return x / (np.max(np.abs(x)) + 1e-9) * peak
def growl(d, f0, f1, rough=0.4):
    tt = t(d); f = np.linspace(f0, f1, len(tt)) * (1 + rough * 0.15 * np.sin(2 * np.pi * 23 * tt) + 0.05 * rng.standard_normal(len(tt)).cumsum() / np.sqrt(len(tt)) * 3)
    v = saw(f) * (0.6 + rough * np.abs(np.sin(2 * np.pi * 31 * tt)))
    v = bandpass(v, 420, 2) * 1.5 + bandpass(v, 900, 3) + lowpass(v, 250)
    return v

S = {}
S["boss_roar"] = drive(norm(growl(2.2, 70, 48, 0.8) + 0.4 * bandpass(noise(2.2), 700, 2)) * env(int(SR * 2.2), 0.15, 1.0), 3)
tt = t(1.3)
S["boss_slam"] = norm(np.sin(2 * np.pi * np.cumsum(np.linspace(90, 28, len(tt))) / SR) * np.exp(-tt * 4)
                      + 0.7 * lowpass(noise(1.3), 900) * np.exp(-tt * 7) + 0.25 * lowpass(noise(1.3), 3000) * np.exp(-tt * 18))
tt = t(0.9); grains = np.zeros(len(tt))
for _ in range(70):
    p = rng.integers(0, len(tt) - 800); grains[p:p + 800] += rng.uniform(-1, 1, 800) * np.exp(-np.arange(800) / 90) * rng.uniform(0.3, 1)
S["rock_crumble"] = norm(lowpass(grains, 2500) * env(len(tt), 0.01, 0.4))
tt = t(1.6)
gurg = bandpass(noise(1.6), 350, 1.5) * (0.5 + 0.5 * np.sin(2 * np.pi * (9 + 5 * np.sin(2 * np.pi * 1.3 * tt)) * tt)) ** 2
S["bile_vomit"] = drive(norm(gurg + 0.5 * growl(1.6, 110, 80, 1.0) + 0.4 * lowpass(noise(1.6), 1500)) * env(len(tt), 0.05, 0.5), 2.5)
tt = t(1.8); hiss = (noise(1.8) - lowpass(noise(1.8), 3000))
pops = np.zeros(len(tt))
for _ in range(60):
    p = rng.integers(0, len(tt) - 200); pops[p:p + 200] += np.sin(np.arange(200) * rng.uniform(0.3, 0.8)) * np.exp(-np.arange(200) / 30)
S["acid_sizzle"] = norm(0.6 * hiss + pops) * env(len(tt), 0.05, 0.8)
tt = t(0.45)
S["spit"] = norm(bandpass(noise(0.45), 1200, 1.5) * np.exp(-tt * 12) + 0.5 * np.sin(2 * np.pi * np.cumsum(np.linspace(500, 150, len(tt))) / SR) * np.exp(-tt * 15))
tt = t(0.5)
S["tongue_whip"] = norm(bandpass(noise(0.5), np.linspace(400, 3000, len(tt)) , 3) * env(len(tt), 0.02, 0.3)
                        + 0.6 * lowpass(noise(0.5), 600) * np.exp(-(tt - 0.3) ** 2 / 0.001))
moan = np.zeros(int(SR * 2.4))
for i in range(4):
    d = rng.uniform(1.4, 2.0); st = int(rng.uniform(0, 0.4) * SR); g = growl(d, rng.uniform(95, 140), rng.uniform(70, 100), 0.3)
    g = bandpass(g, rng.uniform(450, 650), 3) * 2 + bandpass(g, rng.uniform(900, 1100), 4)
    moan[st:st + len(g)] += g * env(len(g), 0.3, 0.8) * rng.uniform(0.6, 1)
S["horde_moan"] = norm(moan)
S["general_shout"] = drive(norm(growl(1.1, 150, 105, 0.6) * env(int(SR * 1.1), 0.05, 0.5)), 2.5)
tt = t(2.8)
beat = np.zeros(len(tt))
for bt in (0.0, 0.25, 0.9, 1.15):
    idx = int(bt * SR); seg = np.sin(2 * np.pi * 50 * np.arange(3000) / SR) * np.exp(-np.arange(3000) / 900)
    beat[idx:idx + 3000] += seg
rise = growl(2.8, 45, 95, 1.0) * np.linspace(0, 1, len(tt)) ** 2
S["transform"] = drive(norm(beat * 1.2 + rise + 0.3 * bandpass(noise(2.8), np.linspace(200, 2000, len(tt)), 2) * np.linspace(0, 1, len(tt))), 2)
tt = t(2.0)
buzz = saw(210 + 25 * np.sin(2 * np.pi * 3 * tt) + 8 * np.sin(2 * np.pi * 17 * tt)) + saw(230 + 20 * np.sin(2 * np.pi * 2.3 * tt))
S["flies"] = norm(bandpass(buzz, 600, 2) * env(len(tt), 0.3, 0.6), 0.5)
tt = t(0.9)
S["axe_smash"] = norm(S["boss_slam"][: len(tt)] * 0.8 + 0.6 * bandpass(noise(0.9), 2500, 2) * np.exp(-tt * 20))
tt = t(1.2)
S["soul_drain"] = norm(bandpass(noise(1.2), np.linspace(2500, 300, len(tt)), 5) * env(len(tt), 0.1, 0.5) * 1.5
                       + 0.5 * np.sin(2 * np.pi * np.cumsum(np.linspace(900, 200, len(tt))) / SR) * env(len(tt), 0.1, 0.6))
tt = t(0.7)
S["imp_scream"] = norm(bandpass(saw(np.linspace(520, 380, len(tt)) * (1 + 0.04 * np.sin(2 * np.pi * 12 * tt))), 1400, 2) * env(len(tt), 0.03, 0.3))

os.makedirs(OUT, exist_ok=True)
for name, x in S.items():
    sf.write(os.path.join(OUT, f"{name}.ogg"), np.clip(x * 0.85, -1, 1).astype(np.float32), SR, format="OGG", subtype="VORBIS")

CAT = {"axe_smash": "player", "soul_drain": "player"}
defs = {"format_version": "1.14.0", "sound_definitions": {
    f"ytaun.{n}": {"category": CAT.get(n, "hostile"), "min_distance": 4, "max_distance": 64 if n.startswith(("boss", "transform", "horde")) else 32,
                  "sounds": [{"name": f"sounds/ytaun/{n}", "volume": 1.0, "load_on_low_memory": True}]} for n in S}}
json.dump(defs, open(os.path.join(RP, "sounds", "sound_definitions.json"), "w"), indent=2)
print(len(S), "sounds ->", os.path.normpath(OUT))
