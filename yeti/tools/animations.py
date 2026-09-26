"""Skill animations for the Yeti boss (played by the script with Entity.playAnimation) and client effects.

All Yeti models (yeti_1, yeti_2, yeti_3, yeti_death) share the same core bones, so one animation set
works for every phase:
  body (root, legs hang from it)   bone79 upper body   head   bone46 jaw
  arm0 / arm1 (arms)               leg0 / leg1 (thighs)   bone77 / bone56 (knees / shins)

Conventions (checked against the original ice_spike / attack animations of the pack):
- arm X negative raises the arm forward (-90 points forward, -180 straight up)
- arm0 Z positive / arm1 Z negative spread the arms out to the sides
- bone79 X positive bends the upper body forward, negative leans back
- head X negative looks up, bone46 X positive opens the jaw
- bone79 Y negative turns the arm1 side backward (wind-up for a throw with arm1)

Skill animations are additive on top of the walk/idle controllers, start and end at the neutral pose,
and are sampled from a Catmull-Rom curve every 0.05 s so the motion is curved and smooth
(anticipation -> action -> impact -> overshoot -> recovery), like bedrock/player_anims.py.
Each animation's timing matches the script (yeti/boss-YETI_behavior_pack/scripts/yeti/skills.js):
the comment on every animation gives the moment of impact in ticks.
"""
import json
import math
import os

STEP = 0.05

BODY, TORSO, HEAD, JAW = "body", "bone79", "head", "bone46"
LARM, RARM, LLEG, RLEG, LKNEE, RKNEE = "arm0", "arm1", "leg0", "leg1", "bone77", "bone56"

ZERO = (0.0, 0.0, 0.0)
ONE = (1.0, 1.0, 1.0)
LEG_LENGTH = 27.0  # hip (y 28) to foot (y 1)


def crouch(depth):
    """Lower the body by `depth` pixels and fold the legs so the feet stay on the ground."""
    a = math.degrees(math.acos(max(-1.0, 1 - depth / LEG_LENGTH)))
    return {BODY: {"p": (0, -depth, 0)}, LLEG: {"r": (-a, 0, 0)}, RLEG: {"r": (-a, 0, 0)},
            LKNEE: {"r": (2 * a, 0, 0)}, RKNEE: {"r": (2 * a, 0, 0)}}


def merge(*poses):
    out = {}
    for pose in poses:
        for bone, spec in pose.items():
            out.setdefault(bone, {}).update(spec)
    return out


def arms(left, right):
    return {LARM: {"r": left}, RARM: {"r": right}}


class Anim:
    def __init__(self, length, loop=False):
        self.length = length
        self.loop = loop
        self.channels = {}  # (bone, kind) -> {time: vector}
        self.expressions = {}  # (bone, kind) -> Molang expression

    def key(self, t, *poses):
        for bone, spec in merge(*poses).items():
            for kind, value in spec.items():
                self.channels.setdefault((bone, kind), {})[round(t, 4)] = tuple(float(v) for v in value)
        return self

    def shake(self, t0, t1, period, bone, kind, base, amp):
        """Tremble around `base` (roars, channelling), alternating +amp / -amp every half period."""
        t, sign = t0, 1
        while t <= t1 + 1e-9:
            value = tuple(b + sign * a for b, a in zip(base, amp))
            self.channels.setdefault((bone, kind), {})[round(t, 4)] = value
            t += period / 2
            sign = -sign
        return self

    def expr(self, bone, kind, value):
        self.expressions[(bone, kind)] = value
        return self

    def to_json(self):
        bones = {}
        for (bone, kind), keys in self.channels.items():
            neutral = ONE if kind == "s" else ZERO
            keys = dict(keys)
            if self.loop:
                first = keys.get(0.0, neutral)
                keys.setdefault(0.0, first)
                keys[round(self.length, 4)] = keys[0.0]
            else:
                keys.setdefault(0.0, neutral)
                keys.setdefault(round(self.length, 4), neutral)
            name = {"r": "rotation", "p": "position", "s": "scale"}[kind]
            bones.setdefault(bone, {})[name] = sample(sorted(keys.items()), self.length)
        for (bone, kind), value in self.expressions.items():
            name = {"r": "rotation", "p": "position", "s": "scale"}[kind]
            bones.setdefault(bone, {})[name] = value
        data = {"animation_length": self.length, "bones": bones}
        if self.loop:
            data = {"loop": True, **data}
        return data


def sample(keys, length):
    """Sample a non-uniform Catmull-Rom spline through the keys every STEP seconds (flat ends)."""
    times = [t for t, _ in keys]
    values = [v for _, v in keys]
    n = len(keys)

    def tangent(i):
        if i == 0 or i == n - 1:
            return (0.0, 0.0, 0.0)
        dt = times[i + 1] - times[i - 1]
        return tuple((b - a) / dt for a, b in zip(values[i - 1], values[i + 1]))

    tangents = [tangent(i) for i in range(n)]
    out = {}
    steps = int(round(length / STEP))
    for s in range(steps + 1):
        t = min(length, s * STEP)
        i = max(0, min(n - 2, next((k for k in range(n - 1) if times[k + 1] >= t - 1e-9), n - 2)))
        t0, t1 = times[i], times[i + 1]
        h = t1 - t0
        u = 0.0 if h <= 0 else (t - t0) / h
        h00, h10 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u
        h01, h11 = -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
        value = tuple(h00 * a + h10 * h * ma + h01 * b + h11 * h * mb
                      for a, b, ma, mb in zip(values[i], values[i + 1], tangents[i], tangents[i + 1]))
        out[f"{t:.2f}"] = [round(v, 2) for v in value]
    # drop samples in the middle of flat stretches
    items = list(out.items())
    kept = {}
    for j, (t, v) in enumerate(items):
        if 0 < j < len(items) - 1 and items[j - 1][1] == v == items[j + 1][1]:
            continue
        kept[t] = v
    return kept


# ---------------------------------------------------------------------------
# Boss skill animations
# ---------------------------------------------------------------------------


def roar():
    """Frost Roar, 2.0 s. Hunch, rear back with the arms flung out and the jaw wide open. Shout at 12 ticks."""
    a = Anim(2.0)
    a.key(0.35, crouch(3), {TORSO: {"r": (28, 0, 0)}, HEAD: {"r": (18, 0, 0)}, JAW: {"r": (-4, 0, 0)}},
          arms((25, 0, -12), (25, 0, 12)))
    a.key(0.6, {BODY: {"p": (0, 1, 0)}, TORSO: {"r": (-32, 0, 0)}, HEAD: {"r": (-38, 0, 0)}, JAW: {"r": (42, 0, 0)}},
          arms((-35, 0, 72), (-35, 0, -72)))
    a.shake(0.7, 1.5, 0.1, HEAD, "r", (-36, 0, 0), (2.5, 3, 0))
    a.shake(0.7, 1.5, 0.1, JAW, "r", (42, 0, 0), (4, 0, 0))
    a.key(1.6, {TORSO: {"r": (-24, 0, 0)}, HEAD: {"r": (-30, 0, 0)}, JAW: {"r": (30, 0, 0)}},
          arms((-25, 0, 60), (-25, 0, -60)))
    return a


def leap_slam():
    """Leap & Slam, 2.1 s. Crouch (takeoff at 11 ticks), fists overhead in the air, smash down on landing (27 ticks)."""
    a = Anim(2.1)
    a.key(0.45, crouch(7), {TORSO: {"r": (32, 0, 0)}, HEAD: {"r": (-10, 0, 0)}}, arms((45, 0, 10), (45, 0, -10)))
    a.key(0.62, {BODY: {"p": (0, 2, 0)}, LLEG: {"r": (12, 0, 0)}, RLEG: {"r": (12, 0, 0)},
                 LKNEE: {"r": (0, 0, 0)}, RKNEE: {"r": (0, 0, 0)}, TORSO: {"r": (-22, 0, 0)}, HEAD: {"r": (-25, 0, 0)}},
          arms((-165, 0, 12), (-165, 0, -12)))
    a.key(1.0, {BODY: {"p": (0, 1, 0)}, LLEG: {"r": (-45, 0, 0)}, RLEG: {"r": (-35, 0, 0)},
                LKNEE: {"r": (65, 0, 0)}, RKNEE: {"r": (55, 0, 0)}, TORSO: {"r": (-15, 0, 0)}, JAW: {"r": (25, 0, 0)}},
          arms((-178, 0, 8), (-178, 0, -8)))
    a.key(1.35, crouch(6), {TORSO: {"r": (52, 0, 0)}, HEAD: {"r": (22, 0, 0)}, JAW: {"r": (15, 0, 0)}},
          arms((-55, 0, 5), (-55, 0, -5)))
    a.key(1.45, crouch(8), {TORSO: {"r": (58, 0, 0)}}, arms((-45, 0, 8), (-45, 0, -8)))
    a.key(1.75, crouch(4), {TORSO: {"r": (30, 0, 0)}}, arms((-25, 0, 10), (-25, 0, -10)))
    return a


def throw():
    """Frost Orb throw, 1.2 s. Twist back with arm1 behind the head, hurl it forward; release at 12 ticks."""
    a = Anim(1.2)
    a.key(0.45, {TORSO: {"r": (-12, -35, 0)}, HEAD: {"r": (0, 22, 0)}, BODY: {"p": (0, -1, 0)}},
          arms((-45, 0, 10), (55, 0, -25)))
    a.key(0.6, {TORSO: {"r": (22, 30, 0)}, HEAD: {"r": (8, -8, 0)}, JAW: {"r": (20, 0, 0)}},
          arms((20, 0, 15), (-125, 0, -5)))
    a.key(0.78, {TORSO: {"r": (26, 36, 0)}}, arms((25, 0, 18), (-60, 0, 0)))
    return a


def stomp():
    """Freeze Ground stomp, 1.3 s. Lift a leg with the arms out for balance, stamp at 13 ticks."""
    a = Anim(1.3)
    a.key(0.5, {BODY: {"p": (0, 1, 0)}, LLEG: {"r": (-58, 0, 0)}, LKNEE: {"r": (48, 0, 0)},
                TORSO: {"r": (-16, 0, 0)}, HEAD: {"r": (-12, 0, 0)}}, arms((-10, 0, 32), (-10, 0, -32)))
    a.key(0.65, {BODY: {"p": (0, -3, 0)}, LLEG: {"r": (6, 0, 0)}, LKNEE: {"r": (0, 0, 0)},
                 TORSO: {"r": (26, 0, 0)}, HEAD: {"r": (16, 0, 0)}, JAW: {"r": (18, 0, 0)}},
          arms((-25, 0, 48), (-25, 0, -48)))
    a.key(0.8, {BODY: {"p": (0, -2, 0)}, TORSO: {"r": (20, 0, 0)}}, arms((-15, 0, 38), (-15, 0, -38)))
    return a


def double_slam():
    """Glacial Wave / Earthquake / Frost Nova, 1.5 s. Both fists overhead, smash the ground at 15 ticks."""
    a = Anim(1.5)
    a.key(0.55, {BODY: {"p": (0, 1.5, 0)}, TORSO: {"r": (-30, 0, 0)}, HEAD: {"r": (-26, 0, 0)}, JAW: {"r": (26, 0, 0)}},
          arms((-172, 0, 12), (-172, 0, -12)))
    a.key(0.75, crouch(5), {TORSO: {"r": (56, 0, 0)}, HEAD: {"r": (24, 0, 0)}, JAW: {"r": (10, 0, 0)}},
          arms((-48, 0, 4), (-48, 0, -4)))
    a.key(0.85, crouch(6.5), {TORSO: {"r": (60, 0, 0)}}, arms((-40, 0, 6), (-40, 0, -6)))
    a.key(1.15, crouch(3), {TORSO: {"r": (32, 0, 0)}}, arms((-20, 0, 8), (-20, 0, -8)))
    return a


def summon():
    """Summon Minions / Elite Army, 2.0 s. Arms raised to the sky (pulsing), swept down at 28 ticks."""
    a = Anim(2.0)
    a.key(0.5, {BODY: {"p": (0, 2, 0)}, TORSO: {"r": (-26, 0, 0)}, HEAD: {"r": (-36, 0, 0)}, JAW: {"r": (30, 0, 0)}},
          arms((-150, 0, 42), (-150, 0, -42)))
    a.shake(0.6, 1.2, 0.3, TORSO, "r", (-26, 0, 0), (4, 0, 0))
    a.shake(0.6, 1.2, 0.3, LARM, "r", (-150, 0, 42), (0, 0, 6))
    a.shake(0.6, 1.2, 0.3, RARM, "r", (-150, 0, -42), (0, 0, -6))
    a.key(1.4, crouch(3), {TORSO: {"r": (30, 0, 0)}, HEAD: {"r": (10, 0, 0)}, JAW: {"r": (12, 0, 0)}},
          arms((-38, 0, 62), (-38, 0, -62)))
    return a


def channel():
    """Ice Regeneration, 6.0 s. Kneel and hug the chest while healing, breathing heavily."""
    a = Anim(6.0)
    kneel = {BODY: {"p": (0, -9, 0)}, LLEG: {"r": (-78, 0, 0)}, LKNEE: {"r": (80, 0, 0)},
             RLEG: {"r": (12, 0, 0)}, RKNEE: {"r": (85, 0, 0)}}
    a.key(0.5, kneel, {TORSO: {"r": (22, 0, 0)}, HEAD: {"r": (22, 0, 0)}}, arms((-62, 0, -34), (-62, 0, 34)))
    a.shake(0.8, 5.2, 1.0, TORSO, "r", (22, 0, 0), (5, 0, 0))
    a.shake(0.8, 5.2, 1.0, HEAD, "r", (22, 0, 0), (-4, 0, 0))
    a.key(5.5, kneel, {TORSO: {"r": (-10, 0, 0)}, HEAD: {"r": (-20, 0, 0)}, JAW: {"r": (20, 0, 0)}},
          arms((-30, 0, 45), (-30, 0, -45)))
    return a


def breath():
    """Frost Breath, 2.8 s. Deep inhale, then a freezing blast from 15 to 46 ticks, sweeping left and right."""
    a = Anim(2.8)
    a.key(0.5, {BODY: {"p": (0, 1, 0)}, TORSO: {"r": (-26, 0, 0)}, HEAD: {"r": (-30, 0, 0)}, JAW: {"r": (10, 0, 0)}},
          arms((-15, 0, 22), (-15, 0, -22)))
    a.key(0.75, {TORSO: {"r": (24, -24, 0)}, HEAD: {"r": (14, -12, 0)}, JAW: {"r": (46, 0, 0)}},
          arms((-25, 0, 28), (-25, 0, -28)))
    a.key(1.5, {TORSO: {"r": (24, 26, 0)}, HEAD: {"r": (14, 14, 0)}, JAW: {"r": (44, 0, 0)}})
    a.key(2.25, {TORSO: {"r": (22, 0, 0)}, HEAD: {"r": (12, 0, 0)}, JAW: {"r": (40, 0, 0)}},
          arms((-20, 0, 24), (-20, 0, -24)))
    return a


def spin():
    """Polar Vortex, 5.0 s. Arms flung out, the upper body whirls 7 times (eased in and out) while the legs stand."""
    a = Anim(5.0)
    a.key(0.5, crouch(3), {HEAD: {"r": (-10, 0, 0)}, JAW: {"r": (18, 0, 0)}}, arms((-15, 0, 82), (-15, 0, -82)))
    a.key(4.5, crouch(3), arms((-15, 0, 82), (-15, 0, -82)))
    # 7 full turns with smoothstep easing; math.mod keeps the angle in [0, 360) so blending out never unwinds it
    a.expr(TORSO, "r", [0, "t.u = math.clamp((q.anim_time - 0.5) / 4.0, 0, 1); "
                          "return -math.mod(2520 * t.u * t.u * (3 - 2 * t.u), 360);", 0])
    return a


def charge():
    """Glacial Charge, 2.0 s. Bull-like wind-up (scrape the ground), run from 14 to 28 ticks, uppercut on impact."""
    a = Anim(2.0)
    hunch = {TORSO: {"r": (48, 0, 0)}, HEAD: {"r": (-24, 0, 0)}, JAW: {"r": (14, 0, 0)}}
    a.key(0.25, crouch(4), hunch, arms((38, 0, 12), (38, 0, -12)), {RLEG: {"r": (32, 0, 0)}})
    a.key(0.45, crouch(4), hunch, {RLEG: {"r": (-8, 0, 0)}})
    a.key(0.62, crouch(4), hunch, {RLEG: {"r": (32, 0, 0)}})
    run = [(0.7, 1), (0.82, -1), (0.94, 1), (1.06, -1), (1.18, 1), (1.3, -1)]
    for t, side in run:
        a.key(t, hunch, {BODY: {"p": (0, -2 + (1 if side > 0 else 0), 0)},
                         LLEG: {"r": (-42 * side, 0, 0)}, RLEG: {"r": (42 * side, 0, 0)},
                         LKNEE: {"r": (30 if side > 0 else 10, 0, 0)}, RKNEE: {"r": (10 if side > 0 else 30, 0, 0)}},
              arms((35 * side, 0, 12), (-35 * side, 0, -12)))
    a.key(1.42, {BODY: {"p": (0, 1, 0)}, LLEG: {"r": (0, 0, 0)}, RLEG: {"r": (0, 0, 0)}, LKNEE: {"r": (0, 0, 0)},
                 RKNEE: {"r": (0, 0, 0)}, TORSO: {"r": (-14, 0, 0)}, HEAD: {"r": (-20, 0, 0)}, JAW: {"r": (30, 0, 0)}},
          arms((-120, 0, 20), (-120, 0, -20)))
    a.key(1.6, {TORSO: {"r": (-8, 0, 0)}}, arms((-95, 0, 25), (-95, 0, -25)))
    return a


def chain_throw():
    """Ice Chains throw, 1.0 s. Whip the free arm (arm1, the club is in arm0) overhead and fling the chain at 10 ticks."""
    a = Anim(1.0)
    a.key(0.35, {TORSO: {"r": (-12, -28, 0)}, HEAD: {"r": (-6, 10, 0)}}, {RARM: {"r": (-150, 0, -30)}})
    a.key(0.5, {TORSO: {"r": (18, 22, 0)}, JAW: {"r": (22, 0, 0)}}, {RARM: {"r": (-78, 0, -4)}})
    a.key(0.65, {TORSO: {"r": (14, 18, 0)}}, {RARM: {"r": (-70, 0, 0)}})
    return a


def chain_pull():
    """Ice Chains pull, 0.9 s. Yank arm1 back with the whole body at 5 ticks."""
    a = Anim(0.9)
    a.key(0.12, {TORSO: {"r": (12, 10, 0)}}, {RARM: {"r": (-85, 0, 0)}})
    a.key(0.25, crouch(3), {TORSO: {"r": (-24, -32, 0)}, HEAD: {"r": (-10, -12, 0)}, JAW: {"r": (30, 0, 0)}},
          {RARM: {"r": (42, 0, -20)}})
    a.key(0.5, crouch(2), {TORSO: {"r": (-16, -24, 0)}}, {RARM: {"r": (30, 0, -18)}})
    return a


def stagger():
    """Stagger, 1.6 s. Shield/armor broken: flinch back, slump dazed, recover."""
    a = Anim(1.6)
    a.key(0.15, {TORSO: {"r": (-26, 14, 0)}, HEAD: {"r": (-22, 0, 14)}, JAW: {"r": (26, 0, 0)}},
          arms((22, 0, 32), (22, 0, -32)))
    a.key(0.45, crouch(5), {TORSO: {"r": (36, 0, 0)}, HEAD: {"r": (30, 0, -8)}, JAW: {"r": (18, 0, 0)}},
          arms((24, 0, 6), (24, 0, -6)))
    a.shake(0.55, 1.1, 0.3, HEAD, "r", (28, 0, 0), (0, 8, 6))
    a.key(1.2, crouch(4), {TORSO: {"r": (30, 0, 0)}}, arms((20, 0, 5), (20, 0, -5)))
    return a


def phase_rise():
    """Phase change, 3.0 s. The new form rises from a crouch and roars; the roar lands at 30 ticks."""
    a = Anim(3.0)
    low = merge(crouch(11), {TORSO: {"r": (62, 0, 0)}, HEAD: {"r": (30, 0, 0)}}, arms((34, 0, 16), (34, 0, -16)))
    a.key(0.0, low)
    a.key(0.4, low)
    a.key(1.1, crouch(4), {TORSO: {"r": (18, 0, 0)}, HEAD: {"r": (8, 0, 0)}}, arms((-20, 0, 30), (-20, 0, -30)))
    a.key(1.5, {BODY: {"p": (0, 2, 0)}, TORSO: {"r": (-36, 0, 0)}, HEAD: {"r": (-42, 0, 0)}, JAW: {"r": (46, 0, 0)}},
          arms((-40, 0, 82), (-40, 0, -82)))
    a.shake(1.6, 2.4, 0.1, HEAD, "r", (-40, 0, 0), (2, 3, 0))
    a.shake(1.6, 2.4, 0.1, JAW, "r", (46, 0, 0), (4, 0, 0))
    a.key(2.5, {TORSO: {"r": (-26, 0, 0)}, HEAD: {"r": (-30, 0, 0)}, JAW: {"r": (30, 0, 0)}},
          arms((-30, 0, 66), (-30, 0, -66)))
    return a


def armor_up():
    """Frost Armor, 1.4 s. Cross the arms in an X guard, then flex outward as the ice plates form (16 ticks)."""
    a = Anim(1.4)
    a.key(0.4, crouch(2), {TORSO: {"r": (22, 0, 0)}, HEAD: {"r": (16, 0, 0)}}, arms((-92, 0, -36), (-92, 0, 36)))
    a.key(0.8, {BODY: {"p": (0, 1, 0)}, TORSO: {"r": (-22, 0, 0)}, HEAD: {"r": (-22, 0, 0)}, JAW: {"r": (32, 0, 0)}},
          arms((-18, 0, 72), (-18, 0, -72)))
    a.key(1.0, {TORSO: {"r": (-16, 0, 0)}}, arms((-14, 0, 64), (-14, 0, -64)))
    return a


def ultimate():
    """Absolute Zero, 4.0 s. Gather low, rise with the arms to the sky (trembling harder), slam at 64 ticks."""
    a = Anim(4.0)
    a.key(0.6, crouch(5), {TORSO: {"r": (36, 0, 0)}, HEAD: {"r": (20, 0, 0)}}, arms((-60, 0, -30), (-60, 0, 30)))
    a.key(1.6, {BODY: {"p": (0, 4, 0)}, TORSO: {"r": (-20, 0, 0)}, HEAD: {"r": (-36, 0, 0)}, JAW: {"r": (30, 0, 0)}},
          arms((-158, 0, 48), (-158, 0, -48)))
    a.shake(1.7, 2.9, 0.1, TORSO, "r", (-24, 0, 0), (2, 2, 0))
    a.shake(1.7, 2.9, 0.1, LARM, "r", (-160, 0, 48), (3, 0, 3))
    a.shake(1.7, 2.9, 0.1, RARM, "r", (-160, 0, -48), (3, 0, -3))
    a.key(3.0, {BODY: {"p": (0, 6, 0)}, TORSO: {"r": (-30, 0, 0)}, HEAD: {"r": (-42, 0, 0)}, JAW: {"r": (46, 0, 0)}},
          arms((-172, 0, 30), (-172, 0, -30)))
    a.key(3.2, crouch(6), {TORSO: {"r": (56, 0, 0)}, HEAD: {"r": (24, 0, 0)}}, arms((-42, 0, 68), (-42, 0, -68)))
    a.key(3.5, crouch(4), {TORSO: {"r": (40, 0, 0)}}, arms((-30, 0, 56), (-30, 0, -56)))
    return a


def barrage():
    """Crystal Barrage, 2.4 s. Raise arm1 to call the crystals, then point and fling them from 16 ticks."""
    a = Anim(2.4)
    a.key(0.5, {TORSO: {"r": (-18, 0, 0)}, HEAD: {"r": (-30, 0, 0)}, JAW: {"r": (20, 0, 0)}},
          arms((-20, 0, 30), (-172, 0, -10)))
    for i, t in enumerate((0.8, 1.05, 1.3, 1.55, 1.8, 2.05)):
        side = 1 if i % 2 == 0 else -1
        a.key(t, {TORSO: {"r": (12, 10 * side, 0)}, HEAD: {"r": (4, 8 * side, 0)}},
              arms((-15, 0, 26), (-98 if i % 2 == 0 else -128, 0, -4)))
    return a


def death_struggle():
    """yeti_death (half buried in the ice): slow heavy breathing, head sway, a fist pounding the ice. Loops, 3.0 s."""
    a = Anim(3.0, loop=True)
    a.key(0.0, {TORSO: {"r": (14, 0, 0)}, HEAD: {"r": (18, -8, 0)}, JAW: {"r": (8, 0, 0)}}, arms((-40, 0, 30), (-30, 0, -40)))
    a.key(0.9, {TORSO: {"r": (6, 0, 0)}, HEAD: {"r": (8, 6, 0)}, JAW: {"r": (18, 0, 0)}}, arms((-70, 0, 24), (-26, 0, -42)))
    a.key(1.25, {TORSO: {"r": (20, 0, 0)}, HEAD: {"r": (22, 4, 0)}, JAW: {"r": (4, 0, 0)}}, arms((-28, 0, 32), (-30, 0, -40)))
    a.key(2.1, {TORSO: {"r": (10, 0, 0)}, HEAD: {"r": (14, -4, 0)}, JAW: {"r": (14, 0, 0)}}, arms((-36, 0, 28), (-34, 0, -38)))
    return a


def death_pound():
    """yeti_death skills, 1.2 s. Both fists raised and pounded on the ice at 12 ticks."""
    a = Anim(1.2)
    a.key(0.45, {TORSO: {"r": (-18, 0, 0)}, HEAD: {"r": (-28, 0, 0)}, JAW: {"r": (38, 0, 0)}}, arms((-160, 0, 20), (-160, 0, -20)))
    a.key(0.6, {TORSO: {"r": (30, 0, 0)}, HEAD: {"r": (18, 0, 0)}}, arms((-35, 0, 16), (-35, 0, -16)))
    return a


def lift_throw():
    """Boulder Hurl, 2.3 s. Bend down and dig both hands into the ground (grab at 12 ticks), heave the chunk
    overhead (21 ticks), lean back and hurl it forward (release at 30 ticks)."""
    a = Anim(2.3)
    a.key(0.45, crouch(8), {TORSO: {"r": (68, 0, 0)}, HEAD: {"r": (-35, 0, 0)}}, arms((-18, 0, -6), (-18, 0, 6)))
    a.key(0.6, crouch(8), {TORSO: {"r": (70, 0, 0)}, HEAD: {"r": (-35, 0, 0)}, JAW: {"r": (12, 0, 0)}},
          arms((-32, 0, -4), (-32, 0, 4)))
    a.key(1.05, crouch(2), {TORSO: {"r": (-22, 0, 0)}, HEAD: {"r": (-22, 0, 0)}}, arms((-172, 0, 10), (-172, 0, -10)))
    a.key(1.3, {TORSO: {"r": (-34, 0, 0)}, HEAD: {"r": (-28, 0, 0)}, JAW: {"r": (25, 0, 0)}},
          arms((-186, 0, 8), (-186, 0, -8)))
    a.key(1.5, {TORSO: {"r": (38, 0, 0)}, HEAD: {"r": (10, 0, 0)}, JAW: {"r": (35, 0, 0)}}, arms((-70, 0, 6), (-70, 0, -6)))
    a.key(1.72, {TORSO: {"r": (42, 0, 0)}}, arms((-40, 0, 8), (-40, 0, -8)))
    return a


def cataclysm():
    """Glacial Cataclysm, 6.3 s. Crouch and launch (15 ticks), hover in the sky with the arms spread while the
    rings detonate below (trembling harder and harder), fists overhead, dive and slam at 106 ticks."""
    a = Anim(6.3)
    a.key(0.5, crouch(8), {TORSO: {"r": (30, 0, 0)}}, arms((40, 0, 12), (40, 0, -12)))
    a.key(0.75, {BODY: {"p": (0, 3, 0)}, LLEG: {"r": (12, 0, 0)}, RLEG: {"r": (12, 0, 0)}, TORSO: {"r": (-15, 0, 0)}},
          arms((-160, 0, 20), (-160, 0, -20)))
    hover = {LLEG: {"r": (-22, 0, 0)}, RLEG: {"r": (-14, 0, 0)}, LKNEE: {"r": (36, 0, 0)}, RKNEE: {"r": (28, 0, 0)},
             HEAD: {"r": (-30, 0, 0)}, JAW: {"r": (30, 0, 0)}}
    a.key(1.5, hover, {TORSO: {"r": (-18, 0, 0)}}, arms((-140, 0, 60), (-140, 0, -60)))
    a.shake(1.6, 4.7, 0.2, TORSO, "r", (-18, 0, 0), (2.5, 2, 0))
    a.shake(1.6, 4.7, 0.2, LARM, "r", (-140, 0, 60), (4, 0, 4))
    a.shake(1.6, 4.7, 0.2, RARM, "r", (-140, 0, -60), (4, 0, -4))
    a.key(5.0, hover, {TORSO: {"r": (-26, 0, 0)}, JAW: {"r": (44, 0, 0)}}, arms((-178, 0, 8), (-178, 0, -8)))
    a.key(5.3, crouch(7), {TORSO: {"r": (58, 0, 0)}, HEAD: {"r": (24, 0, 0)}, JAW: {"r": (20, 0, 0)}},
          arms((-48, 0, 5), (-48, 0, -5)))
    a.key(5.55, crouch(8), {TORSO: {"r": (60, 0, 0)}}, arms((-40, 0, 7), (-40, 0, -7)))
    a.key(5.9, crouch(3), {TORSO: {"r": (28, 0, 0)}}, arms((-20, 0, 9), (-20, 0, -9)))
    return a


BOSS_ANIMATIONS = {
    "lift_throw": lift_throw, "cataclysm": cataclysm,
    "roar": roar, "leap_slam": leap_slam, "throw": throw, "stomp": stomp, "double_slam": double_slam,
    "summon": summon, "channel": channel, "breath": breath, "spin": spin, "charge": charge,
    "chain_throw": chain_throw, "chain_pull": chain_pull, "stagger": stagger, "phase_rise": phase_rise,
    "armor_up": armor_up, "ultimate": ultimate, "barrage": barrage, "death_pound": death_pound,
}


# ---------------------------------------------------------------------------
# Client-side effects controller: frost aura always, breath puffs from the mouth, blue frost flames when enraged
# ---------------------------------------------------------------------------

ENRAGED = "q.max_health > 0 && q.health / q.max_health < 0.35"


def fx_controller(breath_locator=True):
    calm = [{"effect": "aura"}]
    rage = [{"effect": "aura"}, {"effect": "aura_enraged"}]
    if breath_locator:
        calm.append({"effect": "breath", "locator": "mouth"})
        rage.append({"effect": "breath", "locator": "mouth"})
    return {
        "initial_state": "calm",
        "states": {
            "calm": {"particle_effects": calm, "transitions": [{"enraged": ENRAGED}]},
            "enraged": {"particle_effects": rage, "transitions": [{"calm": f"!({ENRAGED})"}]},
        },
    }


def write_animations(rp_root):
    anims = {f"animation.yeti.{name}": fn().to_json() for name, fn in BOSS_ANIMATIONS.items()}
    anims["animation.yeti.death_struggle"] = death_struggle().to_json()
    path = os.path.join(rp_root, "animations/yeti_skills.animation.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"format_version": "1.8.0", "animations": anims}, f, separators=(",", ":"))
        f.write("\n")

    controllers = {
        "controller.animation.yeti.fx": fx_controller(),
        "controller.animation.yeti.fx_last_stand": {
            "initial_state": "default",
            "states": {"default": {"particle_effects": [{"effect": "aura"}, {"effect": "aura_enraged"}]}},
        },
    }
    path = os.path.join(rp_root, "animation_controllers/yeti_fx.animation_controllers.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"format_version": "1.10.0", "animation_controllers": controllers}, f, indent=2)
        f.write("\n")
    print(f"Animations: {len(anims)} (skills {len(BOSS_ANIMATIONS)}), controllers: {len(controllers)}")
    return {name: data["animation_length"] for name, data in anims.items()}
