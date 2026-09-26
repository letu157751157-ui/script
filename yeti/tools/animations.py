"""New Yeti skill animations (shared by yeti_1, yeti_2 and yeti_3) + idle animations for yeti_death.

The three boss models share the same main bones, so one set of animations works for every phase:
  body   - root (only moved up/down/forward, its pivot is high up)
  bone79 - torso (lean / twist), parent of head and arms
  head, bone46 (jaw) - look up/down, open the mouth
  arm0 (right arm, holds the club in phase 1/2), arm1 (left arm), leg0, leg1
Sign conventions (Bedrock animation space): arm/leg x < 0 raises the limb forward/up,
arm0 z > 0 and arm1 z < 0 spread the arms outward, bone79 x > 0 leans forward,
bone79 y > 0 turns the torso toward the Yeti's right, bone46 x > 0 opens the jaw,
body position y < 0 crouches and z < 0 moves forward.

Skill animations are played from the scripts with entity.playAnimation() and add on top of the
normal walk/idle animations (the club stays on the shoulder). Key poses are interpolated with a
monotone cubic curve (no overshoot past the key poses) and baked every 0.04 s.
"""
import json
import os

STEP = 0.04


def _hermite_tangents(times, values):
    n = len(times)
    slopes = [(values[i + 1] - values[i]) / (times[i + 1] - times[i]) for i in range(n - 1)]
    tangents = [0.0] * n
    for i in range(1, n - 1):
        if slopes[i - 1] * slopes[i] <= 0:
            tangents[i] = 0.0  # local extreme or hold: stop there, no overshoot
        else:
            tangents[i] = (slopes[i - 1] + slopes[i]) / 2
            limit = 3 * min(abs(slopes[i - 1]), abs(slopes[i]))
            tangents[i] = max(-limit, min(limit, tangents[i]))
    return tangents


def _sample(keys, t, linear=False):
    times = [k[0] for k in keys]
    if t <= times[0]:
        return list(keys[0][1])
    if t >= times[-1]:
        return list(keys[-1][1])
    i = max(j for j in range(len(times) - 1) if times[j] <= t)
    t0, t1 = times[i], times[i + 1]
    s = (t - t0) / (t1 - t0)
    out = []
    for c in range(3):
        values = [k[1][c] for k in keys]
        if linear:
            out.append(values[i] + (values[i + 1] - values[i]) * s)
            continue
        m = _hermite_tangents(times, values)
        h = t1 - t0
        h00 = 2 * s ** 3 - 3 * s ** 2 + 1
        h10 = s ** 3 - 2 * s ** 2 + s
        h01 = -2 * s ** 3 + 3 * s ** 2
        h11 = s ** 3 - s ** 2
        out.append(h00 * values[i] + h10 * h * m[i] + h01 * values[i + 1] + h11 * h * m[i + 1])
    return out


def bake(length, channels, loop=False, linear=()):
    """channels: {bone: {"rotation"|"position": [(t, (x, y, z)), ...]}}"""
    bones = {}
    samples = sorted({round(i * STEP, 4) for i in range(int(length / STEP) + 1)} | {length})
    for bone, chans in channels.items():
        out = {}
        for kind, keys in chans.items():
            keys = sorted(keys)
            key_times = {round(k[0], 4) for k in keys}
            frames = {}
            for t in sorted(set(samples) | key_times):
                if t > length + 1e-6:
                    continue
                v = _sample(keys, t, linear=(bone, kind) in linear)
                frames[f"{t:.2f}".rstrip("0").rstrip(".") if t else "0.0"] = [round(x, 2) + 0.0 for x in v]
            out[kind] = frames
        bones[bone] = out
    anim = {"animation_length": length, "bones": bones}
    if loop:
        anim["loop"] = True
    return anim


Z = (0, 0, 0)


def mirror(keys):
    """Right-arm keys -> left-arm keys (flip y/z)."""
    return [(t, (x, -y, -z)) for t, (x, y, z) in keys]


def roar():
    arm0 = [(0, Z), (0.3, (25, 0, -10)), (0.55, (-35, 0, 70)), (1.3, (-40, 0, 64)), (1.8, Z)]
    return bake(1.8, {
        "body": {"position": [(0, Z), (0.3, (0, -3, 0)), (0.55, (0, 1, 0)), (1.3, (0, 0.5, 0)), (1.8, Z)]},
        "bone79": {"rotation": [(0, Z), (0.3, (18, 0, 0)), (0.55, (-28, 0, 0)), (1.3, (-24, 0, 0)), (1.8, Z)]},
        "head": {"rotation": [(0, Z), (0.3, (12, 0, 0)), (0.55, (-30, 0, 0)), (0.75, (-26, 7, 0)), (0.95, (-30, -7, 0)),
                              (1.15, (-26, 6, 0)), (1.3, (-28, 0, 0)), (1.8, Z)]},
        "bone46": {"rotation": [(0, Z), (0.3, Z), (0.55, (38, 0, 0)), (1.3, (34, 0, 0)), (1.55, Z), (1.8, Z)]},
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": mirror(arm0)},
    })


def slam():
    """Both fists overhead then smash the ground. Impact at 0.7 s."""
    arm0 = [(0, Z), (0.5, (-165, 0, 15)), (0.62, (-150, 0, 12)), (0.7, (-45, 0, 5)), (0.95, (-50, 0, 5)), (1.5, Z)]
    return bake(1.5, {
        "body": {"position": [(0, Z), (0.5, (0, 2, 0)), (0.7, (0, -5, -2)), (0.95, (0, -4, -2)), (1.5, Z)]},
        "bone79": {"rotation": [(0, Z), (0.5, (-22, 0, 0)), (0.7, (40, 0, 0)), (0.95, (36, 0, 0)), (1.5, Z)]},
        "head": {"rotation": [(0, Z), (0.5, (-15, 0, 0)), (0.7, (-22, 0, 0)), (0.95, (-18, 0, 0)), (1.5, Z)]},
        "bone46": {"rotation": [(0, Z), (0.5, (20, 0, 0)), (0.7, (36, 0, 0)), (1.0, (10, 0, 0)), (1.5, Z)]},
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": mirror(arm0)},
    })


def leap():
    """Crouch, jump with the arms up, land with a double-fist smash. Landing at 1.1 s."""
    arm0 = [(0, Z), (0.35, (35, 0, 10)), (0.45, (-150, 0, 20)), (0.9, (-170, 0, 15)), (1.1, (-40, 0, 8)),
            (1.3, (-45, 0, 8)), (1.7, Z)]
    return bake(1.7, {
        "body": {"position": [(0, Z), (0.35, (0, -7, 0)), (0.45, (0, 4, 0)), (0.9, (0, 3, 0)), (1.1, (0, -6, -2)),
                              (1.3, (0, -5, -2)), (1.7, Z)]},
        "bone79": {"rotation": [(0, Z), (0.35, (30, 0, 0)), (0.45, (-15, 0, 0)), (0.9, (-20, 0, 0)), (1.1, (40, 0, 0)),
                                (1.3, (35, 0, 0)), (1.7, Z)]},
        "head": {"rotation": [(0, Z), (0.35, (-20, 0, 0)), (0.9, (-10, 0, 0)), (1.1, (-25, 0, 0)), (1.7, Z)]},
        "bone46": {"rotation": [(0, Z), (0.35, Z), (0.45, (30, 0, 0)), (1.1, (40, 0, 0)), (1.4, Z), (1.7, Z)]},
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": mirror(arm0)},
        "leg0": {"rotation": [(0, Z), (0.35, Z), (0.45, (-35, 0, 0)), (0.9, (-30, 0, 0)), (1.1, Z), (1.7, Z)]},
        "leg1": {"rotation": [(0, Z), (0.35, Z), (0.45, (-20, 0, 0)), (0.9, (-35, 0, 0)), (1.1, Z), (1.7, Z)]},
    })


def throw():
    """Left arm lifts a boulder behind the head and hurls it. Release at 0.6 s."""
    return bake(1.4, {
        "arm1": {"rotation": [(0, Z), (0.2, (-60, 0, -20)), (0.5, (-175, 0, -10)), (0.6, (-60, 0, 5)),
                              (0.75, (-20, 0, 10)), (1.4, Z)]},
        "arm0": {"rotation": [(0, Z), (0.5, (15, 0, 15)), (0.6, (-20, 0, 20)), (1.4, Z)]},
        "bone79": {"rotation": [(0, Z), (0.2, (15, 0, 0)), (0.5, (-25, -25, 0)), (0.6, (25, 20, 0)), (0.8, (20, 15, 0)),
                                (1.4, Z)]},
        "head": {"rotation": [(0, Z), (0.5, (-10, 15, 0)), (0.6, (-15, -10, 0)), (1.4, Z)]},
        "bone46": {"rotation": [(0, Z), (0.5, (10, 0, 0)), (0.6, (32, 0, 0)), (1.0, Z), (1.4, Z)]},
        "leg1": {"rotation": [(0, Z), (0.5, (10, 0, 0)), (0.6, (-25, 0, 0)), (1.0, Z), (1.4, Z)]},
    })


BREATH_SWEEP = [(0.6, 0), (1.1, -20), (1.6, 20), (2.1, 0)]  # torso yaw during the breath (deg)


def breath():
    """Inhale, lunge forward with the jaw wide open and sweep the frost breath left then right."""
    arm0 = [(0, Z), (0.45, (-20, 0, 45)), (0.6, (20, 0, 25)), (2.1, (20, 0, 25)), (2.6, Z)]
    torso = [(0, Z), (0.45, (-25, 0, 0))] + [(t, (22, y, 0)) for t, y in BREATH_SWEEP] + [(2.6, Z)]
    return bake(2.6, {
        "body": {"position": [(0, Z), (0.45, (0, 1, 0)), (0.6, (0, -2, -1)), (2.1, (0, -2, -1)), (2.6, Z)]},
        "bone79": {"rotation": torso},
        "head": {"rotation": [(0, Z), (0.45, (-30, 0, 0)), (0.6, (-12, 0, 0)), (2.1, (-12, 0, 0)), (2.6, Z)]},
        "bone46": {"rotation": [(0, Z), (0.45, (5, 0, 0)), (0.6, (42, 0, 0)), (2.1, (40, 0, 0)), (2.4, Z), (2.6, Z)]},
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": mirror(arm0)},
    })


def summon():
    """Raise both arms to the sky, then smash the ground to call the storm/minions. Smash at 1.22 s."""
    arm0 = [(0, Z), (1.0, (-170, 0, 35)), (1.1, (-165, 0, 30)), (1.22, (-40, 0, 5)), (1.5, (-45, 0, 5)), (2.2, Z)]
    return bake(2.2, {
        "body": {"position": [(0, Z), (1.0, (0, 2, 0)), (1.22, (0, -5, -2)), (1.5, (0, -4, -2)), (2.2, Z)]},
        "bone79": {"rotation": [(0, Z), (1.0, (-25, 0, 0)), (1.22, (40, 0, 0)), (1.5, (35, 0, 0)), (2.2, Z)]},
        "head": {"rotation": [(0, Z), (1.0, (-35, 0, 0)), (1.22, (-20, 0, 0)), (2.2, Z)]},
        "bone46": {"rotation": [(0, Z), (0.9, (35, 0, 0)), (1.22, (30, 0, 0)), (1.6, Z), (2.2, Z)]},
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": mirror(arm0)},
    })


def regen():
    """Hunch with the arms crossed over the chest, breathing heavily."""
    arm0 = [(0, Z), (0.4, (-75, 0, -35)), (2.0, (-75, 0, -35)), (2.5, Z)]
    return bake(2.5, {
        "body": {"position": [(0, Z), (0.4, (0, -4, 0)), (0.9, (0, -3, 0)), (1.4, (0, -4.5, 0)), (1.9, (0, -3, 0)),
                              (2.5, Z)]},
        "bone79": {"rotation": [(0, Z), (0.4, (25, 0, 0)), (0.9, (20, 0, 0)), (1.4, (28, 0, 0)), (1.9, (21, 0, 0)),
                                (2.5, Z)]},
        "head": {"rotation": [(0, Z), (0.4, (22, 0, 0)), (2.0, (22, 0, 0)), (2.5, Z)]},
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": mirror(arm0)},
    })


def swipe():
    """Right claw swipe (hit at 0.38 s) then left claw swipe (hit at 0.78 s)."""
    return bake(1.3, {
        "arm0": {"rotation": [(0, Z), (0.25, (-110, 0, 55)), (0.38, (-60, 0, -40)), (0.5, (-50, 0, -35)),
                              (0.8, (-10, 0, 0)), (1.3, Z)]},
        "arm1": {"rotation": [(0, Z), (0.4, Z), (0.65, (-110, 0, -55)), (0.78, (-60, 0, 40)), (0.9, (-50, 0, 35)),
                              (1.3, Z)]},
        "bone79": {"rotation": [(0, Z), (0.25, (10, 25, 0)), (0.38, (20, -25, 0)), (0.55, (15, -20, 0)),
                                (0.65, (10, -28, 0)), (0.78, (20, 25, 0)), (0.9, (15, 20, 0)), (1.3, Z)]},
        "head": {"rotation": [(0, Z), (0.38, (5, -15, 0)), (0.78, (5, 15, 0)), (1.3, Z)]},
        "bone46": {"rotation": [(0, Z), (0.38, (25, 0, 0)), (0.55, (5, 0, 0)), (0.78, (25, 0, 0)), (1.0, Z), (1.3, Z)]},
        "body": {"position": [(0, Z), (0.38, (0, -2, -3)), (0.6, (0, -1, -3)), (0.78, (0, -2, -5)), (1.3, Z)]},
    })


def chest_beat():
    """Gorilla chest beat: four alternating beats while roaring at the sky."""
    out0, in0 = (-45, 0, 35), (-80, 0, -55)
    out1, in1 = mirror([(0, out0)])[0][1], mirror([(0, in0)])[0][1]
    arm0 = [(0, Z), (0.3, out0), (0.45, in0), (0.6, out0), (0.9, out0), (1.05, in0), (1.2, out0), (1.6, out0), (2.0, Z)]
    arm1 = [(0, Z), (0.3, out1), (0.6, out1), (0.75, in1), (0.9, out1), (1.2, out1), (1.35, in1), (1.5, out1), (2.0, Z)]
    bounce = [(0, Z)] + [(t, (0, -1.5 if i % 2 == 0 else 0.5, 0)) for i, t in enumerate((0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.35, 1.5))] + [(2.0, Z)]
    return bake(2.0, {
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": arm1},
        "bone79": {"rotation": [(0, Z), (0.3, (-15, 0, 0)), (1.6, (-15, 0, 0)), (2.0, Z)]},
        "head": {"rotation": [(0, Z), (0.3, (-30, 0, 0)), (1.6, (-28, 0, 0)), (2.0, Z)]},
        "bone46": {"rotation": [(0, Z), (0.3, (35, 0, 0)), (1.6, (32, 0, 0)), (1.85, Z), (2.0, Z)]},
        "body": {"position": bounce},
    })


def spin():
    """Arms out, torso spins two full turns (vortex / blizzard)."""
    arm0 = [(0, Z), (0.25, (-10, 0, 80)), (1.25, (-10, 0, 80)), (1.6, Z)]
    return bake(1.6, {
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": mirror(arm0)},
        "bone79": {"rotation": [(0, Z), (0.25, Z), (1.25, (0, 720, 0)), (1.6, (0, 720, 0))]},
        "head": {"rotation": [(0, Z), (0.25, (-10, 0, 0)), (1.25, (-10, 0, 0)), (1.6, Z)]},
        "bone46": {"rotation": [(0, Z), (0.25, (25, 0, 0)), (1.25, (25, 0, 0)), (1.6, Z)]},
        "body": {"position": [(0, Z), (0.25, (0, 1, 0)), (1.25, (0, 1, 0)), (1.6, Z)]},
    }, linear={("bone79", "rotation")})


def cast():
    """Thrust both arms forward and channel (chains / prison / absolute zero)."""
    arm0 = [(0, Z), (0.35, (-120, 0, 15)), (0.55, (-90, 0, -5)), (0.8, (-93, 0, -3)), (1.0, (-88, 0, -6)),
            (1.2, (-93, 0, -3)), (1.4, (-88, 0, -5)), (1.8, Z)]
    return bake(1.8, {
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": mirror(arm0)},
        "bone79": {"rotation": [(0, Z), (0.35, (-15, 0, 0)), (0.55, (15, 0, 0)), (1.4, (12, 0, 0)), (1.8, Z)]},
        "head": {"rotation": [(0, Z), (0.35, (-20, 0, 0)), (0.55, (-10, 0, 0)), (1.4, (-10, 0, 0)), (1.8, Z)]},
        "bone46": {"rotation": [(0, Z), (0.55, (30, 0, 0)), (1.4, (30, 0, 0)), (1.6, Z), (1.8, Z)]},
        "body": {"position": [(0, Z), (0.55, (0, -1, -1)), (1.4, (0, -1, -1)), (1.8, Z)]},
    })


def phase_intro():
    """New phase: rises from a crouch, beats its chest and roars."""
    out0, in0 = (-45, 0, 35), (-80, 0, -55)
    out1, in1 = (-45, 0, -35), (-80, 0, 55)
    spread0 = (-35, 0, 70)
    arm0 = [(0, (-40, 0, 20)), (0.9, (0, 0, 20)), (1.15, out0), (1.3, in0), (1.45, out0), (1.75, out0), (1.9, in0),
            (2.05, out0), (2.3, spread0), (2.7, spread0), (3.0, Z)]
    arm1 = [(0, (-40, 0, -20)), (0.9, (0, 0, -20)), (1.15, out1), (1.45, out1), (1.6, in1), (1.75, out1), (2.05, out1),
            (2.2, in1), (2.3, mirror([(0, spread0)])[0][1]), (2.7, mirror([(0, spread0)])[0][1]), (3.0, Z)]
    return bake(3.0, {
        "body": {"position": [(0, (0, -12, 0)), (0.9, Z), (2.3, (0, 1, 0)), (3.0, Z)]},
        "bone79": {"rotation": [(0, (55, 0, 0)), (0.9, (-10, 0, 0)), (2.1, (-12, 0, 0)), (2.3, (-28, 0, 0)),
                                (2.7, (-24, 0, 0)), (3.0, Z)]},
        "head": {"rotation": [(0, (30, 0, 0)), (0.9, (-10, 0, 0)), (2.3, (-35, 0, 0)), (2.5, (-31, 6, 0)),
                              (2.7, (-33, -5, 0)), (3.0, Z)]},
        "bone46": {"rotation": [(0, Z), (1.1, (20, 0, 0)), (2.1, (25, 0, 0)), (2.3, (42, 0, 0)), (2.7, (38, 0, 0)),
                                (2.95, Z), (3.0, Z)]},
        "arm0": {"rotation": arm0},
        "arm1": {"rotation": arm1},
        "leg0": {"rotation": [(0, (-35, 0, -10)), (0.9, Z), (3.0, Z)]},
        "leg1": {"rotation": [(0, (-35, 0, 10)), (0.9, Z), (3.0, Z)]},
    })


def death_breathe():
    """yeti_death lies on its back: slow heavy breathing, the head and arms twitch now and then."""
    return bake(3.0, {
        "bone79": {"rotation": [(0, Z), (1.5, (-4, 0, 0)), (3.0, Z)]},
        "head": {"rotation": [(0, Z), (1.2, (0, 0, 4)), (1.35, (0, 0, -3)), (1.5, (0, 0, 3)), (3.0, Z)]},
        "arm0": {"rotation": [(0, Z), (2.1, Z), (2.2, (0, 0, 8)), (2.35, Z), (3.0, Z)]},
        "arm1": {"rotation": [(0, Z), (0.7, Z), (0.8, (0, 0, -8)), (0.95, Z), (3.0, Z)]},
    }, loop=True)


def death_pulse():
    """yeti_death casting: the whole body jolts and the limbs spasm."""
    return bake(1.0, {
        "body": {"position": [(0, Z), (0.1, (0, 3, 0)), (0.25, Z), (0.35, (0, 1.5, 0)), (0.5, Z), (1.0, Z)]},
        "bone79": {"rotation": [(0, Z), (0.1, (-12, 0, 0)), (0.3, (-4, 0, 0)), (1.0, Z)]},
        "head": {"rotation": [(0, Z), (0.1, (-20, 0, 10)), (0.3, (-8, 0, -6)), (1.0, Z)]},
        "bone46": {"rotation": [(0, Z), (0.1, (35, 0, 0)), (0.5, (20, 0, 0)), (1.0, Z)]},
        "arm0": {"rotation": [(0, Z), (0.1, (-30, 0, 20)), (0.3, (-10, 0, 5)), (1.0, Z)]},
        "arm1": {"rotation": [(0, Z), (0.1, (-30, 0, -20)), (0.3, (-10, 0, -5)), (1.0, Z)]},
        "leg0": {"rotation": [(0, Z), (0.12, (-20, 0, 0)), (0.35, Z), (1.0, Z)]},
        "leg1": {"rotation": [(0, Z), (0.12, (-15, 0, 0)), (0.35, Z), (1.0, Z)]},
    })


SKILLS = {
    "roar": roar,
    "slam": slam,
    "leap": leap,
    "throw": throw,
    "breath": breath,
    "summon": summon,
    "regen": regen,
    "swipe": swipe,
    "chest_beat": chest_beat,
    "spin": spin,
    "cast": cast,
    "phase_intro": phase_intro,
}

DEATH = {"breathe": death_breathe, "pulse": death_pulse}


def build():
    animations = {f"animation.ytaun_yeti.{name}": fn() for name, fn in SKILLS.items()}
    animations.update({f"animation.ytaun_yeti_death.{name}": fn() for name, fn in DEATH.items()})
    return {"format_version": "1.8.0", "animations": animations}


def write_animations(rp_root):
    path = os.path.join(rp_root, "animations", "ytaun_yeti_skills.animation.json")
    data = build()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
        f.write("\n")
    return path, sorted(data["animations"])
