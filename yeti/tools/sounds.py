"""Custom sounds for the Yeti boss, synthesized from scratch (no samples, no dependencies).

Every sound is built from a few simple pieces: noise bursts through filters (cracks, crunch, wind, rumble),
pitch-swept sines (booms, thumps), bell-like inharmonic partials (ice ringing, chimes), a formant voice
(roars, growls) and a small Schroeder reverb for the space around it. Most sounds have 2-3 variants that
Minecraft picks at random, so repeated hits never sound identical.

    write_sounds(rp_root, render=False)
        always rewrites sounds/sound_definitions.json and the entity sounds in sounds.json;
        with render=True (build.py --sounds, or when a file is missing) it also synthesizes every sound
        and encodes it to .ogg with `oggenc` (vorbis-tools). The .ogg files are kept in the pack, so a
        normal build does not need oggenc.
"""
import json
import math
import os
import random
import shutil
import struct
import subprocess
import tempfile
import wave

SR = 44100
TAU = 2 * math.pi
FOLDER = "sounds/yeti"


# ---------------------------------------------------------------------------
# DSP building blocks (plain lists of floats)
# ---------------------------------------------------------------------------


def n_of(seconds):
    return int(seconds * SR)


def zeros(seconds):
    return [0.0] * n_of(seconds)


def add_into(dst, src, at=0.0, gain=1.0):
    """Mix src into dst starting at `at` seconds (dst grows if needed)."""
    start = n_of(at)
    end = start + len(src)
    if end > len(dst):
        dst.extend([0.0] * (end - len(dst)))
    for i, v in enumerate(src):
        dst[start + i] += v * gain
    return dst


def noise(seconds, rng):
    r = rng.random
    return [r() * 2 - 1 for _ in range(n_of(seconds))]


def env_exp(seconds, attack, tau, hold=0.0):
    """Linear attack, optional hold, then exponential decay with time constant tau (s)."""
    out = []
    a, h = max(1, n_of(attack)), n_of(hold)
    k = math.exp(-1 / (tau * SR))
    level = 1.0
    for i in range(n_of(seconds)):
        if i < a:
            out.append(i / a)
        elif i < a + h:
            out.append(1.0)
        else:
            level *= k
            out.append(level)
    return out


def env_shape(seconds, points):
    """Piecewise linear envelope through (time, level) points."""
    out = []
    j = 0
    for i in range(n_of(seconds)):
        t = i / SR
        while j < len(points) - 2 and t > points[j + 1][0]:
            j += 1
        (t0, v0), (t1, v1) = points[j], points[j + 1]
        f = 0 if t1 == t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
        out.append(v0 + (v1 - v0) * f)
    return out


def mul(a, b):
    return [x * y for x, y in zip(a, b)]


def lowpass(x, cutoff):
    """One-pole lowpass; cutoff may be a number or a function of time (s)."""
    y, out = 0.0, []
    if callable(cutoff):
        a = 0.0
        for i, v in enumerate(x):
            if i % 64 == 0:
                a = math.exp(-TAU * cutoff(i / SR) / SR)
            y = (1 - a) * v + a * y
            out.append(y)
        return out
    a = math.exp(-TAU * cutoff / SR)
    b = 1 - a
    for v in x:
        y = b * v + a * y
        out.append(y)
    return out


def highpass(x, cutoff):
    return [v - l for v, l in zip(x, lowpass(x, cutoff))]


def bandpass(x, freq, q):
    """RBJ biquad band-pass (0 dB peak); freq may be a function of time (s)."""
    out = []
    x1 = x2 = y1 = y2 = 0.0
    b0 = b2 = a1 = a2 = 0.0

    def coeffs(f):
        w = TAU * min(f, SR * 0.45) / SR
        alpha = math.sin(w) / (2 * q)
        a0 = 1 + alpha
        return alpha / a0, -alpha / a0, -2 * math.cos(w) / a0, (1 - alpha) / a0

    if not callable(freq):
        b0, b2, a1, a2 = coeffs(freq)
    for i, v in enumerate(x):
        if callable(freq) and i % 32 == 0:
            b0, b2, a1, a2 = coeffs(freq(i / SR))
        y = b0 * v + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, v
        y2, y1 = y1, y
        out.append(y)
    return out


def sweep(seconds, f0, f1, shape="exp", wave_="sine"):
    """Oscillator gliding from f0 to f1 (exponential or linear)."""
    out, phase = [], 0.0
    n = n_of(seconds)
    for i in range(n):
        t = i / max(1, n - 1)
        f = f0 * (f1 / f0) ** t if shape == "exp" else f0 + (f1 - f0) * t
        phase += f / SR
        if wave_ == "sine":
            out.append(math.sin(TAU * phase))
        else:
            out.append(2 * (phase % 1) - 1)
    return out


def saturate(x, drive):
    norm = math.tanh(drive)
    return [math.tanh(v * drive) / norm for v in x]


def smooth_noise(seconds, rate, rng):
    """Slow random wobble in [-1, 1] (for jitter, flicker, wind)."""
    out, cur, target = [], 0.0, rng.uniform(-1, 1)
    step = max(1, int(SR / rate))
    for i in range(n_of(seconds)):
        if i % step == 0:
            cur, target = target, rng.uniform(-1, 1)
            base = cur
        out.append(base + (target - base) * ((i % step) / step))
    return out


def reverb(x, wet=0.25, room=0.8, damp=0.35, tail=1.0):
    """Small Schroeder reverb: 4 damped combs in parallel, 2 all-passes in series."""
    x = x + [0.0] * n_of(tail)
    acc = [0.0] * len(x)
    for delay in (1116, 1188, 1277, 1356):
        buf, idx, store = [0.0] * delay, 0, 0.0
        for i, v in enumerate(x):
            outv = buf[idx]
            store = outv * (1 - damp) + store * damp
            buf[idx] = v + store * room
            idx = idx + 1 if idx + 1 < delay else 0
            acc[i] += outv
    for delay in (556, 441):
        buf, idx = [0.0] * delay, 0
        for i, v in enumerate(acc):
            b = buf[idx]
            buf[idx] = v + b * 0.5
            acc[i] = b - v
            idx = idx + 1 if idx + 1 < delay else 0
    return [d + a * wet * 0.25 for d, a in zip(x, acc)]


def loudness(x):
    """Loudest 100 ms window (RMS): how loud the sound feels, unlike the peak of a sharp crack."""
    w = n_of(0.1)
    best = 0.0
    for start in range(0, max(1, len(x) - w), w // 2):
        seg = x[start:start + w]
        best = max(best, math.sqrt(sum(v * v for v in seg) / max(1, len(seg))))
    return best or 1.0


def finish(x, target=0.32, ceiling=0.82, fade=0.05):
    """Remove DC, trim silence at the end, short fade-out, bring to a common loudness, soft-limit the peaks."""
    mean = sum(x) / max(1, len(x))
    x = [v - mean for v in x]
    top = max(abs(v) for v in x) or 1.0
    last = len(x)
    while last > 1 and abs(x[last - 1]) < top * 0.002:
        last -= 1
    x = x[:last]
    f = min(len(x), n_of(fade))
    for i in range(f):
        x[len(x) - f + i] *= 1 - i / f
    gain = target / loudness(x)
    return [math.tanh(v * gain / ceiling) * ceiling for v in x]


# ---------------------------------------------------------------------------
# Reusable layers
# ---------------------------------------------------------------------------


def crack(rng, length=0.012, tone=1800, gain=1.0):
    """Sharp transient at the start of a break."""
    return [v * gain for v in mul(highpass(noise(length, rng), tone), env_exp(length, 0.0005, length / 3))]


def grains(rng, count, spread, freq_range, dur_range, q=1.2, decay_power=1.5, total=None):
    """Many tiny band-passed noise bursts (crunch, crackle, debris)."""
    out = zeros(total or spread + dur_range[1] + 0.05)
    for _ in range(count):
        at = spread * rng.random() ** decay_power
        d = rng.uniform(*dur_range)
        g = mul(noise(d, rng), env_exp(d, 0.0005, d / 3))
        g = bandpass(g, rng.uniform(*freq_range), q)
        add_into(out, g, at, (1 - at / (spread + 0.1)) * rng.uniform(0.5, 1.0) * 2.5)
    return out


def ring(rng, base, seconds, tau, ratios=(1, 1.52, 2.33, 3.17, 4.4), glide=0.0, gain=0.25):
    """Inharmonic bell partials: the ringing of a big piece of ice."""
    out = zeros(seconds)
    for k, r in enumerate(ratios):
        f = base * r * rng.uniform(0.985, 1.015)
        e = env_exp(seconds, 0.003, tau / (1 + k * 0.45))
        s = sweep(seconds, f, f * (1 + glide))
        add_into(out, mul(s, e), 0, gain / (1 + k * 0.35))
    return out


def tinkles(rng, count, spread, seconds, lo=2500, hi=8000):
    """Small ice pieces falling and clinking."""
    out = zeros(seconds)
    for _ in range(count):
        at = spread * rng.random() ** 1.6
        f = rng.uniform(lo, hi)
        d = rng.uniform(0.04, 0.12)
        e = env_exp(d, 0.0008, d / 4)
        p = zeros(d)
        for r, g in ((1, 1), (1.41, 0.5), (2.2, 0.3)):
            add_into(p, mul(sweep(d, f * r, f * r), e), 0, g)
        add_into(out, p, at, 0.35 * (1 - at / (spread + 0.2)))
    return out


def thump(rng, f0, f1, seconds, tau, drive=2.0):
    """Low sine drop: the weight of a slam / footstep."""
    body = mul(sweep(seconds, f0, f1), env_exp(seconds, 0.002, tau))
    return saturate(body, drive)


def rumble(rng, seconds, cutoff, tau, attack=0.005):
    return mul(lowpass(lowpass(noise(seconds, rng), cutoff), cutoff), env_exp(seconds, attack, tau))


def whoosh_layer(rng, seconds, f_from, f_peak, f_to, peak_at=0.45, q=1.3):
    def centre(t):
        u = t / seconds
        if u < peak_at:
            return f_from * (f_peak / f_from) ** (u / peak_at)
        return f_peak * (f_to / f_peak) ** ((u - peak_at) / (1 - peak_at))
    env = env_shape(seconds, [(0, 0), (seconds * peak_at, 1), (seconds, 0)])
    env = [v * v for v in env]
    return mul(bandpass(noise(seconds, rng), centre, q), env)


def voice(rng, seconds, f0_points, amp_points, formant_scale=0.8, vowel=((700, 1), (1150, 0.55), (2500, 0.25)),
          vowel_end=None, rasp=0.35, fry=0.35, rough_hz=28, drive=3.0):
    """Monster voice: jittery sawtooth + sub-octave fry + raspy noise through formant band-passes."""
    n = n_of(seconds)
    f0 = env_shape(seconds, f0_points)
    amp = env_shape(seconds, amp_points)
    jitter = smooth_noise(seconds, 14, rng)
    src, phase, sub = [], 0.0, 0.0
    r = rng.random
    for i in range(n):
        f = f0[i] * (1 + 0.035 * jitter[i] + 0.012 * math.sin(TAU * 5.5 * i / SR))
        phase += f / SR
        sub += f / 2 / SR
        saw = 2 * (phase % 1) - 1
        fr = 1.0 if (sub % 1) < 0.5 else -1.0
        pulse = 1 - (phase % 1)                                   # raspy noise strongest at each glottal pulse
        rough = 0.75 + 0.25 * math.sin(TAU * rough_hz * i / SR)
        src.append((saw + fry * fr + rasp * (r() * 2 - 1) * (0.4 + pulse)) * rough * amp[i])
    out = [0.0] * n
    end = vowel_end or vowel
    for (fa, ga), (fb, _) in zip(vowel, end):
        fa, fb = fa * formant_scale, fb * formant_scale
        band = bandpass(src, lambda t, fa=fa, fb=fb: fa + (fb - fa) * (t / seconds), 5.0)
        for i, v in enumerate(band):
            out[i] += v * ga
    chest = bandpass(src, 260 * formant_scale, 1.5)
    for i, v in enumerate(chest):
        out[i] += v * 0.7
    out = saturate([v * 1.5 for v in out], drive)
    return highpass(lowpass(lowpass(out, 3400), 3400), 45)


# ---------------------------------------------------------------------------
# Sounds
# ---------------------------------------------------------------------------


def spike_erupt(rng):
    """Ice spike bursting out of the ground: crack, crunch of ice, a thump and a rising crystal 'shing'."""
    out = zeros(1.0)
    add_into(out, crack(rng, 0.01, 2200), 0, 0.9)
    add_into(out, grains(rng, 45, 0.25, (1500, 5000), (0.002, 0.006)), 0.004, 0.35)
    add_into(out, thump(rng, 95, 42, 0.3, 0.09, 2.5), 0, 0.8)
    add_into(out, whoosh_layer(rng, 0.18, 700, 3800, 2500, 0.6), 0, 0.5)
    add_into(out, ring(rng, rng.uniform(1050, 1300), 0.9, 0.32, glide=0.05, gain=0.22), 0.01)
    return reverb(out, 0.22, 0.75, tail=0.5)


def ice_shatter(rng):
    """Ice breaking apart (spikes, shells, shards): crack + a rain of ice pieces clinking."""
    out = zeros(1.0)
    add_into(out, crack(rng, 0.015, 1500), 0, 0.9)
    add_into(out, grains(rng, 30, 0.12, (600, 2200), (0.003, 0.01)), 0, 0.45)
    add_into(out, tinkles(rng, 28, 0.55, 0.9), 0.01)
    add_into(out, rumble(rng, 0.25, 400, 0.05), 0, 0.3)
    return reverb(out, 0.2, 0.7, tail=0.5)


def ice_impact(rng):
    """Heavy slam on ice: sub boom, rumble, crack, debris crackle and shards clinking."""
    out = zeros(2.0)
    add_into(out, thump(rng, 72, 30, 1.4, 0.35, 2.2), 0, 1.0)
    add_into(out, rumble(rng, 1.6, 180, 0.45), 0, 1.1)
    add_into(out, crack(rng, 0.02, 900), 0, 0.8)
    add_into(out, grains(rng, 40, 0.5, (1500, 6000), (0.002, 0.007)), 0.01, 0.35)
    add_into(out, tinkles(rng, 12, 0.4, 0.8), 0.06, 0.8)
    return reverb(out, 0.32, 0.84, tail=1.2)


def boom(rng):
    """Massive frozen explosion (ultimate / cataclysm)."""
    out = zeros(3.0)
    add_into(out, thump(rng, 60, 24, 2.5, 0.7, 3.0), 0, 1.0)
    add_into(out, rumble(rng, 2.8, 110, 0.9, 0.01), 0, 1.4)
    add_into(out, rumble(rng, 1.2, 600, 0.25), 0, 0.5)
    add_into(out, crack(rng, 0.03, 700), 0, 0.9)
    add_into(out, grains(rng, 60, 1.0, (1200, 5000), (0.002, 0.008)), 0.02, 0.3)
    add_into(out, tinkles(rng, 20, 1.0, 1.6), 0.1, 0.7)
    add_into(out, ring(rng, 420, 2.4, 1.2, gain=0.12), 0.02)
    return reverb(out, 0.42, 0.88, tail=1.8)


def roar(rng):
    """Full roar: rises, holds with a shaking throat, falls off (awaken, enrage, phase change, big skills)."""
    s = 2.4
    v = voice(rng, s, [(0, 52), (0.35, 76), (1.3, 70), (2.0, 58), (s, 44)],
              [(0, 0), (0.18, 0.9), (0.5, 1.0), (1.6, 0.95), (s, 0)], formant_scale=0.72,
              vowel=((720, 1), (1180, 0.5), (2450, 0.22)), vowel_end=((560, 1), (900, 0.5), (2300, 0.2)),
              rasp=0.45, fry=0.45, rough_hz=31, drive=3.2)
    out = add_into(zeros(s), v)
    add_into(out, mul(sweep(s, 40, 30), env_shape(s, [(0, 0), (0.25, 0.5), (1.8, 0.4), (s, 0)])), 0, 0.5)
    return reverb(out, 0.3, 0.85, tail=1.2)


def roar_short(rng):
    """Warning snarl before a skill."""
    s = 1.2
    v = voice(rng, s, [(0, 60), (0.25, 88), (0.8, 74), (s, 56)], [(0, 0), (0.12, 1), (0.7, 0.85), (s, 0)],
              formant_scale=0.78, vowel=((650, 1), (1100, 0.5), (2400, 0.25)), rasp=0.5, fry=0.4, rough_hz=26)
    return reverb(v, 0.25, 0.8, tail=0.8)


def growl(rng):
    """Ambient: low rumbling growl with a rough throat."""
    s = rng.uniform(1.2, 1.6)
    v = voice(rng, s, [(0, 42), (s * 0.4, 50), (s, 40)], [(0, 0), (0.25, 0.8), (s * 0.7, 0.7), (s, 0)],
              formant_scale=0.65, vowel=((600, 1), (950, 0.4), (2300, 0.15)), rasp=0.3, fry=0.6, rough_hz=17, drive=2.2)
    return reverb(v, 0.2, 0.75, tail=0.6)


def hurt(rng):
    """Short pained bark."""
    s = 0.55
    v = voice(rng, s, [(0, 95), (0.08, 110), (s, 62)], [(0, 0), (0.03, 1), (0.25, 0.7), (s, 0)],
              formant_scale=0.8, vowel=((780, 1), (1250, 0.55), (2600, 0.3)), rasp=0.6, fry=0.25, rough_hz=35)
    out = add_into(v, thump(rng, 110, 60, 0.2, 0.05), 0, 0.3)
    return reverb(out, 0.18, 0.7, tail=0.4)


def death(rng):
    """Long dying roar sinking into a gurgle, then the ice body cracking."""
    s = 3.2
    v = voice(rng, s, [(0, 70), (0.4, 84), (1.5, 60), (s, 26)], [(0, 0), (0.2, 1), (1.4, 0.8), (2.6, 0.35), (s, 0)],
              formant_scale=0.7, vowel=((720, 1), (1150, 0.5), (2400, 0.2)), vowel_end=((480, 1), (800, 0.4), (2200, 0.1)),
              rasp=0.55, fry=0.6, rough_hz=12, drive=3.0)
    out = add_into(zeros(s + 1), v)
    add_into(out, crack(rng, 0.02, 1200), 2.4, 0.6)
    add_into(out, tinkles(rng, 18, 0.7, 1.0), 2.42, 0.8)
    return reverb(out, 0.35, 0.86, tail=1.4)


def snow_crunch(rng):
    """Heavy snow crunch (ground torn up, sliding, landing)."""
    out = zeros(0.6)
    add_into(out, grains(rng, 32, 0.28, (500, 2600), (0.003, 0.012), q=0.9, decay_power=1.0), 0, 0.6)
    add_into(out, rumble(rng, 0.3, 300, 0.07), 0, 0.5)
    return reverb(out, 0.12, 0.6, tail=0.3)


def whoosh(rng):
    """Heavy swing / throw."""
    s = rng.uniform(0.55, 0.7)
    out = add_into(zeros(s), whoosh_layer(rng, s, 220, rng.uniform(1100, 1500), 300, 0.5, 1.4))
    add_into(out, mul(rumble(rng, s, 160, s), env_shape(s, [(0, 0), (s * 0.5, 1), (s, 0)])), 0, 0.6)
    return reverb(out, 0.15, 0.6, tail=0.3)


def wind_gust(rng):
    """Gust of icy wind with a howl (wings of the blizzard, hovering Yeti, vortex)."""
    s = rng.uniform(1.1, 1.4)
    wob = smooth_noise(s, 3, rng)
    howl = bandpass(noise(s, rng), lambda t: 520 + 260 * wob[min(len(wob) - 1, int(t * SR))], 6)
    hiss = highpass(noise(s, rng), 2500)
    env = env_shape(s, [(0, 0), (s * 0.35, 1), (s * 0.6, 0.8), (s, 0)])
    out = zeros(s)
    add_into(out, mul(howl, env), 0, 1.6)
    add_into(out, mul(hiss, env), 0, 0.12)
    add_into(out, mul(rumble(rng, s, 150, s), env), 0, 0.8)
    return reverb(out, 0.25, 0.8, tail=0.6)


def frost_charge(rng):
    """Frost energy building up: detuned rising tones, faster and faster tremolo, sparkles."""
    s = 1.6
    out = zeros(s)
    for det in (1.0, 1.007, 0.993):
        tone = sweep(s, 200 * det, 640 * det)
        add_into(out, tone, 0, 0.18)
        add_into(out, sweep(s, 400 * det, 1280 * det), 0, 0.06)
    trem = []
    phase = 0.0
    for i in range(n_of(s)):
        phase += (6 + 16 * (i / n_of(s)) ** 2) / SR
        trem.append(0.65 + 0.35 * math.sin(TAU * phase))
    env = env_shape(s, [(0, 0), (1.3, 1), (s, 0)])
    out = mul(mul(out, trem), env)
    spark = grains(rng, 40, s * 0.9, (5000, 9000), (0.002, 0.005), decay_power=0.5, total=s)
    add_into(out, mul(spark, env), 0, 0.3)
    return reverb(out, 0.35, 0.82, tail=0.8)


def frost_cast(rng):
    """Frost magic released: bright chord of ice bells over a rising rush."""
    out = zeros(1.4)
    add_into(out, whoosh_layer(rng, 0.35, 900, 6000, 4000, 0.7, 1.0), 0, 0.45)
    base = rng.uniform(820, 900)
    add_into(out, ring(rng, base, 1.3, 0.55, ratios=(1, 2.76, 5.4, 8.93), gain=0.3), 0.05)
    add_into(out, ring(rng, base * 1.5, 1.2, 0.45, ratios=(1, 2.76, 5.4), gain=0.2), 0.09)
    add_into(out, tinkles(rng, 14, 0.6, 1.0, 4000, 9000), 0.05, 0.6)
    return reverb(out, 0.38, 0.85, tail=0.9)


def frost_shoot(rng):
    """Ice projectile launched: snap, rising rush and a ping."""
    out = zeros(0.7)
    add_into(out, crack(rng, 0.008, 2500), 0, 0.6)
    add_into(out, whoosh_layer(rng, 0.4, 600, 3200, 1500, 0.35, 1.2), 0, 0.8)
    add_into(out, ring(rng, rng.uniform(1400, 1700), 0.5, 0.18, ratios=(1, 2.1, 3.3), gain=0.25), 0.01)
    return reverb(out, 0.2, 0.7, tail=0.4)


def frost_thunder(rng):
    """Icy thunder: a splitting crack, then rolling rumble with crackle."""
    s = 2.6
    out = zeros(s)
    add_into(out, crack(rng, 0.04, 800), 0, 0.3)
    roll = rumble(rng, s, 140, 0.9, 0.02)
    flick = smooth_noise(s, 9, rng)
    add_into(out, [v * (0.6 + 0.4 * f) for v, f in zip(roll, flick)], 0, 1.6)
    add_into(out, grains(rng, 70, 1.4, (700, 3000), (0.003, 0.012)), 0.02, 0.35)
    return reverb(out, 0.4, 0.86, tail=1.2)


def chime(rng):
    """Pitched ice chime (played in rising sequences)."""
    out = ring(rng, 740, 1.6, 0.7, ratios=(1, 2.0, 3.0, 4.2), gain=0.35)
    add_into(out, ring(rng, 741.5, 1.6, 0.7, ratios=(1,), gain=0.2))
    return reverb(out, 0.35, 0.82, tail=0.8)


def frost_breath(rng):
    """Freezing breath: hiss with frost crackle over a low rush."""
    s = 1.8
    env = env_shape(s, [(0, 0), (0.2, 1), (1.3, 0.9), (s, 0)])
    wob = smooth_noise(s, 6, rng)
    hiss = bandpass(noise(s, rng), lambda t: 4800 + 1500 * wob[min(len(wob) - 1, int(t * SR))], 1.2)
    out = mul(hiss, env)
    add_into(out, mul(rumble(rng, s, 250, s), env), 0, 1.2)
    add_into(out, mul(grains(rng, 60, s * 0.9, (3000, 8000), (0.001, 0.004), decay_power=1.0, total=s), env), 0, 0.3)
    return reverb(out, 0.2, 0.75, tail=0.6)


def stomp(rng):
    """Heavy stomp on snow."""
    out = zeros(0.8)
    add_into(out, thump(rng, rng.uniform(78, 90), 38, 0.5, 0.12, 2.5), 0, 1.0)
    add_into(out, rumble(rng, 0.4, 220, 0.08), 0, 0.9)
    add_into(out, grains(rng, 14, 0.12, (600, 2200), (0.003, 0.01), q=0.9), 0, 0.35)
    return reverb(out, 0.18, 0.7, tail=0.5)


def hit(rng):
    """Blow landing: punchy thump + ice crack."""
    out = zeros(0.5)
    add_into(out, thump(rng, rng.uniform(120, 140), 60, 0.25, 0.05, 3.0), 0, 1.0)
    add_into(out, mul(bandpass(noise(0.08, rng), 1300, 0.9), env_exp(0.08, 0.001, 0.02)), 0, 0.9)
    add_into(out, crack(rng, 0.01, 2000), 0.003, 0.5)
    add_into(out, tinkles(rng, 5, 0.1, 0.35), 0.01, 0.6)
    return reverb(out, 0.12, 0.6, tail=0.3)


def step(rng):
    """Heavy footstep (quiet, plays often)."""
    out = zeros(0.4)
    add_into(out, thump(rng, rng.uniform(62, 72), 40, 0.3, 0.06, 1.8), 0, 1.0)
    add_into(out, grains(rng, 8, 0.07, (500, 1800), (0.003, 0.008), q=0.9), 0, 0.3)
    return out


# name -> (recipe, number of variants, max hearing distance in blocks, volume, loudness); played as "yeti.<name>".
# Loudness is the RMS of the loudest 100 ms the file is normalized to (big hits louder, footsteps quieter).
SOUNDS = {
    "spike.erupt": (spike_erupt, 3, 40, 1.0, 0.36),
    "ice.shatter": (ice_shatter, 3, 40, 0.9, 0.3),
    "ice.impact": (ice_impact, 3, 64, 1.0, 0.45),
    "boom": (boom, 1, 96, 1.0, 0.5),
    "roar": (roar, 2, 96, 1.0, 0.4),
    "roar.short": (roar_short, 2, 64, 1.0, 0.38),
    "growl": (growl, 3, 24, 0.8, 0.3),
    "hurt": (hurt, 3, 32, 1.0, 0.36),
    "death": (death, 1, 96, 1.0, 0.4),
    "snow.crunch": (snow_crunch, 3, 32, 1.0, 0.3),
    "whoosh": (whoosh, 2, 32, 1.0, 0.3),
    "wind.gust": (wind_gust, 2, 48, 1.0, 0.3),
    "frost.charge": (frost_charge, 1, 48, 1.0, 0.32),
    "frost.cast": (frost_cast, 2, 48, 1.0, 0.32),
    "frost.shoot": (frost_shoot, 2, 40, 1.0, 0.32),
    "frost.thunder": (frost_thunder, 1, 96, 1.0, 0.4),
    "chime": (chime, 1, 48, 0.9, 0.3),
    "frost.breath": (frost_breath, 1, 40, 1.0, 0.3),
    "stomp": (stomp, 3, 48, 1.0, 0.42),
    "hit": (hit, 3, 32, 1.0, 0.4),
    "step": (step, 3, 20, 0.6, 0.35),
}

# Entity sounds (sounds.json). The Yeti phases get the custom voice; the ice minions borrow vanilla sounds
# at a lower pitch so they are no longer silent.
YETI_VOICE = {
    "ambient": {"sound": "yeti.growl", "volume": 1.0, "pitch": [0.9, 1.05]},
    "hurt": {"sound": "yeti.hurt", "volume": 1.0, "pitch": [0.9, 1.1]},
    "death": {"sound": "yeti.death", "volume": 1.5, "pitch": 1.0},
    "step": {"sound": "yeti.step", "volume": 0.5, "pitch": [0.9, 1.1]},
}
ENTITY_SOUNDS = {
    # phases 1-3 only "die" to turn into the next phase (which roars when it rises): a pained bark, not the death roar
    "ytaun:yeti_1": {"volume": 1.0, "pitch": 1.1, "events": {**YETI_VOICE, "death": {"sound": "yeti.hurt", "volume": 1.5}}},
    "ytaun:yeti_2": {"volume": 1.0, "pitch": 1.0, "events": {**YETI_VOICE, "death": {"sound": "yeti.hurt", "volume": 1.5}}},
    "ytaun:yeti_3": {"volume": 1.1, "pitch": 0.9, "events": {**YETI_VOICE, "death": {"sound": "yeti.hurt", "volume": 1.5}}},
    "ytaun:yeti_death": {"volume": 1.1, "pitch": 0.8, "events": {**YETI_VOICE, "step": {"sound": "yeti.step", "volume": 0.3}}},
    "ytaun:frost_wolf": {"volume": 1.0, "pitch": [0.75, 0.85], "events": {
        "ambient": "mob.wolf.growl", "hurt": "mob.wolf.hurt", "death": "mob.wolf.death", "step": "mob.wolf.step"}},
    "ytaun:frost_wraith": {"volume": 0.9, "pitch": [0.6, 0.7], "events": {
        "ambient": "mob.vex.ambient", "hurt": "mob.vex.hurt", "death": "mob.vex.death"}},
    "ytaun:frost_golem": {"volume": 1.0, "pitch": [0.7, 0.8], "events": {
        "hurt": "mob.irongolem.hit", "death": "mob.irongolem.death", "step": {"sound": "yeti.step", "volume": 0.4}}},
}


def files_of(name, variants):
    base = name.replace(".", "_")
    return [f"{FOLDER}/{base}" if variants == 1 else f"{FOLDER}/{base}_{i + 1}" for i in range(variants)]


def definitions():
    defs = {}
    for name, (_, variants, max_distance, volume, _) in SOUNDS.items():
        defs[f"yeti.{name}"] = {
            "category": "hostile",
            "min_distance": 2.0,
            "max_distance": float(max_distance),
            "sounds": [{"name": f, "volume": volume, "load_on_low_memory": True} for f in files_of(name, variants)],
        }
    return {"format_version": "1.20.20", "sound_definitions": defs}


def write_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1.0, min(1.0, v)) * 32767)) for v in samples))


def render(rp_root, names=None):
    encoder = shutil.which("oggenc")
    if not encoder:
        raise SystemExit("oggenc not found: install vorbis-tools to render the Yeti sounds")
    os.makedirs(os.path.join(rp_root, FOLDER), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name, (recipe, variants, _, _, target) in SOUNDS.items():
            if names and name not in names:
                continue
            for i, rel in enumerate(files_of(name, variants)):
                rng = random.Random(f"{name}#{i}")
                samples = finish(recipe(rng), target)
                wav = os.path.join(tmp, os.path.basename(rel) + ".wav")
                write_wav(wav, samples)
                subprocess.run([encoder, "-Q", "-q", "5", "--serial", str(1000 + len(rel) * 7 + i), "-o",
                                os.path.join(rp_root, rel + ".ogg"), wav], check=True)
            print(f"  sound yeti.{name}: {variants} variant(s)")


def write_sounds(rp_root, render_all=False):
    missing = [name for name, (_, variants, *_) in SOUNDS.items()
               if any(not os.path.exists(os.path.join(rp_root, f + ".ogg")) for f in files_of(name, variants))]
    if render_all or missing:
        render(rp_root, None if render_all else missing)
    with open(os.path.join(rp_root, "sounds", "sound_definitions.json"), "w", encoding="utf-8") as f:
        json.dump(definitions(), f, indent=2)
        f.write("\n")
    path = os.path.join(rp_root, "sounds.json")
    data = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    data.setdefault("entity_sounds", {}).setdefault("entities", {}).update(ENTITY_SOUNDS)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    return len(SOUNDS), sum(v for _, v, *_ in SOUNDS.values())
