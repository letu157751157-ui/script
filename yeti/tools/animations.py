"""Yeti boss animations (v1.4, end-game detail pass).

Shared by yeti_1, yeti_2 and yeti_3: the three models have the same main bones, so one set works for
every phase. Each animation is written pose-to-pose: a list of full key poses, then every bone
channel is interpolated with a monotone cubic curve (no overshoot past the key poses, holds stay
still) and baked every 0.04 s. Trembling is layered on top as small sine noise.

Bones used (Bedrock names -> meaning):
  body (root: position only), bone79 torso, bone14 chest (scale = breathing), bone30 back hump,
  head, bone45 skull/brow, bone46 jaw,
  arm0 / elbow_r / wrist_r = right shoulder / elbow / wrist (the club is in the right hand in phase 1-2),
  arm1 / elbow_l / wrist_l = left shoulder / elbow / wrist,
  leg0 / bone77 = right hip / knee, leg1 / bone56 = left hip / knee.
Signs: limb x < 0 lifts it forward/up; right arm z > 0 (left arm z < 0) spreads it outward;
right leg z > 0 (left leg z < 0) splays it outward; torso x > 0 leans forward; torso y > 0 turns
toward the Yeti's right; jaw x > 0 opens the mouth; skull x < 0 tilts the head top back;
body position y < 0 lowers the body, z < 0 moves it forward.

The elbow / wrist bones come from tools/rig.py, which fixed the joints of the original models (the
old elbow sat at the shoulder and the old hand bone pivoted at the fingertips). Particles are attached to locators added to the models (mouth, eye_r/eye_l, hand_r/hand_l,
foot_r/foot_l, chest) through each animation's particle_effects; the client entities map the
short names (fx_*) to the ytaun:* particles.
"""
import json
import math
import os

STEP = 0.04

BONES = {
    "torso": "bone79", "chest": "bone14", "back": "bone30", "head": "head", "skull": "bone45", "jaw": "bone46",
    "armR": "arm0", "elbowR": "elbow_r", "wristR": "wrist_r", "armL": "arm1", "elbowL": "elbow_l", "wristL": "wrist_l",
    "legR": "leg0", "kneeR": "bone77", "legL": "leg1", "kneeL": "bone56",
}
MIRROR = {"armR": "armL", "elbowR": "elbowL", "wristR": "wristL", "legR": "legL", "kneeR": "kneeL"}


# ---------------------------------------------------------------------------
# Pose helpers
# ---------------------------------------------------------------------------


def sym(**parts):
    """Same pose on both sides: sym(arm=(x,y,z), elbow=..., wrist=..., leg=..., knee=...)."""
    out = {}
    for part, value in parts.items():
        right = part + "R"
        out[right] = value
        out[MIRROR[right]] = (value[0], -value[1], -value[2])
    return out


def side(prefix, value, right=True):
    key = prefix + ("R" if right else "L")
    if right:
        return {key: value}
    return {key: (value[0], -value[1], -value[2])}


def stance(drop, forward=0.0):
    """Wide sumo stance: the body sinks by `drop` pixels while the feet stay on the ground.
    The thighs splay outward and the knees bend back so the shins stay upright."""
    if drop <= 0:
        return {"bodyPos": (0, 0, forward)}
    angle = math.degrees(math.acos(max(-1.0, 1 - drop / 8.0)))
    angle = min(angle, 75)
    return {
        "bodyPos": (0, -drop, forward),
        "legR": (-angle * 0.25, 0, angle), "kneeR": (angle * 0.25, 0, -angle),
        "legL": (-angle * 0.25, 0, -angle), "kneeL": (angle * 0.25, 0, angle),
    }


def pose(*parts, **extra):
    out = {}
    for p in parts:
        out.update(p)
    out.update(extra)
    return out


# ---------------------------------------------------------------------------
# Baking
# ---------------------------------------------------------------------------


def _tangents(times, values):
    n = len(times)
    slopes = [(values[i + 1] - values[i]) / (times[i + 1] - times[i]) for i in range(n - 1)]
    tangents = [0.0] * n
    for i in range(1, n - 1):
        if slopes[i - 1] * slopes[i] <= 0:
            tangents[i] = 0.0
        else:
            m = (slopes[i - 1] + slopes[i]) / 2
            limit = 3 * min(abs(slopes[i - 1]), abs(slopes[i]))
            tangents[i] = max(-limit, min(limit, m))
    return tangents


def _interp(times, values, t, linear=False):
    if t <= times[0]:
        return values[0]
    if t >= times[-1]:
        return values[-1]
    i = max(j for j in range(len(times) - 1) if times[j] <= t)
    t0, t1 = times[i], times[i + 1]
    s = (t - t0) / (t1 - t0)
    if linear:
        return values[i] + (values[i + 1] - values[i]) * s
    m = _tangents(times, values)
    h = t1 - t0
    return ((2 * s ** 3 - 3 * s ** 2 + 1) * values[i] + (s ** 3 - 2 * s ** 2 + s) * h * m[i]
            + (-2 * s ** 3 + 3 * s ** 2) * values[i + 1] + (s ** 3 - s ** 2) * h * m[i + 1])


def _fmt_time(t):
    return "0.0" if t == 0 else f"{t:.2f}".rstrip("0").rstrip(".")


def bake(length, keys, loop=False, shakes=(), effects=(), linear=(), extra=None):
    """keys: [(time, pose)], pose = {part: (x, y, z)} with parts from BONES plus
    'bodyPos' (body position) and 'chestScale' (uniform chest scale).
    shakes: [(t0, t1, parts, amplitude_deg, frequency_hz)] trembling layered on top.
    effects: [(time, effect_short_name, locator)] particle effects."""
    keys = sorted(keys, key=lambda k: k[0])
    parts = sorted({p for _, ps in keys for p in ps})
    times = [k[0] for k in keys]
    samples = sorted({round(i * STEP, 4) for i in range(int(length / STEP) + 1)} | {round(t, 4) for t in times} | {length})
    samples = [t for t in samples if t <= length + 1e-6]
    bones = {}
    for part in parts:
        if part == "chestScale":
            vals = [k[1].get(part, 1.0) for k in keys]
            frames = {_fmt_time(t): round(_interp(times, vals, t), 4) for t in samples}
            bones.setdefault("bone14", {})["scale"] = frames
            continue
        comps = []
        for c in range(3):
            vals = [k[1].get(part, (0, 0, 0))[c] for k in keys]
            comps.append(vals)
        frames = {}
        for t in samples:
            v = [_interp(times, comps[c], t, linear=part in linear) for c in range(3)]
            for (t0, t1, sparts, amp, freq) in shakes:
                if part in sparts and t0 <= t <= t1:
                    env = math.sin(math.pi * (t - t0) / (t1 - t0))
                    phase = sum(map(ord, part)) % 7
                    v[0] += amp * env * math.sin(2 * math.pi * freq * t + phase)
                    v[1] += amp * 0.6 * env * math.sin(2 * math.pi * freq * 1.3 * t + phase * 2)
            frames[_fmt_time(t)] = [round(x, 2) + 0.0 for x in v]
        if part == "bodyPos":
            bones.setdefault("body", {})["position"] = frames
        else:
            bones.setdefault(BONES[part], {})["rotation"] = frames
    anim = {"animation_length": length, "bones": bones}
    if loop:
        anim["loop"] = True
    if extra:
        anim.update(extra)
    if effects:
        fx = {}
        for t, name, locator in effects:
            fx.setdefault(_fmt_time(t), []).append({"effect": name, "locator": locator})
        anim["particle_effects"] = {k: (v[0] if len(v) == 1 else v) for k, v in sorted(fx.items(), key=lambda kv: float(kv[0]))}
    return anim


N = {}  # neutral pose
Z = (0, 0, 0)
HANDS = (("fx_hand_glow", "hand_r"), ("fx_hand_glow", "hand_l"))


def both_hands(t, name="fx_hand_glow"):
    return [(t, name, "hand_r"), (t, name, "hand_l")]


# ---------------------------------------------------------------------------
# Animations
# ---------------------------------------------------------------------------


def idle():
    """Always playing (additive): heavy breathing, shoulders rise, fingers flex, cold breath puffs, glowing eyes."""
    return bake(3.2, [
        (0, N),
        (1.6, pose(chestScale=1.035, head=(-3, 3, 0), jaw=(0, 0, 0), armR=(0, 0, -2), armL=(0, 0, 2), back=(-3, 0, 0))),
        (2.0, pose(chestScale=1.02, head=(-1, 2, 0), jaw=(9, 0, 0))),
        (3.2, N),
    ], loop=True, effects=[(0, "fx_eye", "eye_r"), (0, "fx_eye", "eye_l"), (1.9, "fx_breath_puff", "mouth")])


def walk():
    """Heavy gorilla walk (loop, weight and speed follow the movement speed): stomping legs with bent
    knees, the body dips on every step, shoulders roll, arms swing against the legs."""
    def step(t, right_forward, plant):
        s = 1 if right_forward else -1
        return (t, pose(bodyPos=(0, -1.4 if plant else 0.4, 0), torso=(6, 4 * s, -3 * s), head=(-4 if plant else -1, -3 * s, 0),
                        legR=(-24 * s, 0, 0), kneeR=(6 if plant else (38 if not right_forward else 4), 0, 0),
                        legL=(24 * s, 0, 0), kneeL=(6 if plant else (38 if right_forward else 4), 0, 0),
                        armR=(16 * s, 0, 3), armL=(-16 * s, 0, -3), elbowR=(-10, 0, 0), elbowL=(-10, 0, 0)))
    keys = [
        step(0.0, True, True),
        (0.4, pose(bodyPos=(0, 0.4, 0), torso=(6, 0, 0), legR=(0, 0, 0), kneeR=(4, 0, 0), legL=(0, 0, 0), kneeL=(40, 0, 0),
                   armR=(0, 0, 3), armL=(0, 0, -3), elbowR=(-14, 0, 0), elbowL=(-14, 0, 0))),
        step(0.8, False, True),
        (1.2, pose(bodyPos=(0, 0.4, 0), torso=(6, 0, 0), legR=(0, 0, 0), kneeR=(40, 0, 0), legL=(0, 0, 0), kneeL=(4, 0, 0),
                   armR=(0, 0, 3), armL=(0, 0, -3), elbowR=(-14, 0, 0), elbowL=(-14, 0, 0))),
        step(1.6, True, True),
    ]
    return bake(1.6, keys, loop=True, extra={
        "anim_time_update": "query.anim_time + query.delta_time * math.clamp(query.modified_move_speed * 2.8, 0.6, 1.8)"})


def attack():
    """Normal melee hit (played by the attack controller): right arm overhead, then a crushing downward
    blow; in phase 1-2 this swings the club."""
    wind = pose(stance(1.5), side("arm", (-150, 0, 20)), side("elbow", (35, 0, 0)), side("wrist", (20, 0, 0)),
                armL=(10, 0, -10), torso=(-12, 20, 0), head=(-8, 5, 0), jaw=(15, 0, 0))
    hit = pose(stance(3, -2), side("arm", (-45, 0, -5)), side("elbow", (-10, 0, 0)), side("wrist", (-20, 0, 0)),
               armL=(20, 0, -15), torso=(28, -12, 0), head=(-18, -5, 0), jaw=(30, 0, 0))
    return bake(0.8, [(0, N), (0.22, wind), (0.36, hit), (0.5, pose(hit, torso=(24, -10, 0))), (0.8, N)],
                shakes=[(0.36, 0.55, ("torso", "head"), 2, 12)],
                effects=[(0.36, "fx_step", "hand_r")])


def ground_punch():
    """Ice Spike call: crouches, raises the right fist and drives it into the ground (impact at 0.6 s);
    the spikes erupt from where the fist lands."""
    raise_ = pose(stance(2), side("arm", (-160, 0, 25)), side("elbow", (60, 0, 0)), side("wrist", (25, 0, 0)),
                  armL=(20, 0, -25), elbowL=(-30, 0, 0), torso=(-18, 22, 0), head=(-15, 8, 0), jaw=(20, 0, 0), chestScale=1.05)
    punch = pose(stance(5, -3), side("arm", (-55, 0, 5)), side("elbow", (-8, 0, 0)), side("wrist", (-30, 0, 0)),
                 armL=(-20, 0, -30), elbowL=(-40, 0, 0), torso=(42, -15, 0), head=(-26, -8, 0), jaw=(38, 0, 0), back=(10, 0, 0))
    return bake(1.35, [(0, N), (0.42, raise_), (0.52, pose(raise_, torso=(-20, 25, 0))), (0.6, punch),
                       (0.9, pose(punch, torso=(38, -12, 0))), (1.35, N)],
                shakes=[(0.1, 0.5, ("armR", "elbowR"), 2.5, 12), (0.6, 0.9, ("torso", "head", "armR"), 3, 13)],
                effects=[(0.12, "fx_hand_glow", "hand_r"), (0.6, "fx_step", "hand_r"), (0.6, "fx_roar", "mouth")])


def charge():
    """Charge: crouches low with the arms swept back, dashes head down with pounding legs (0.25-0.95 s),
    then a shoulder bash with both arms swinging forward."""
    wind = pose(stance(4), sym(arm=(38, 0, 12), elbow=(-25, 0, 0)), torso=(38, 0, 0), head=(-28, 0, 0), jaw=(25, 0, 0),
                back=(10, 0, 0))
    keys = [(0, N), (0.25, wind)]
    for i, t in enumerate((0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95)):
        s = 1 if i % 2 == 0 else -1
        keys.append((t, pose(sym(arm=(30, 0, 10), elbow=(-30, 0, 0)), bodyPos=(0, -2 if i % 2 else 0, 0), torso=(35, 5 * s, 0),
                             head=(-25, 0, 0), jaw=(30, 0, 0), legR=(-35 * s, 0, 0), kneeR=(30 if s < 0 else 5, 0, 0),
                             legL=(35 * s, 0, 0), kneeL=(30 if s > 0 else 5, 0, 0), back=(10, 0, 0))))
    bash = pose(stance(3, -3), sym(arm=(-70, 0, 20), elbow=(-15, 0, 0), wrist=(-20, 0, 0)), torso=(20, 25, 0),
                head=(-15, -10, 0), jaw=(40, 0, 0))
    keys += [(1.05, bash), (1.25, pose(bash, torso=(16, 20, 0))), (1.6, N)]
    return bake(1.6, keys, shakes=[(1.05, 1.3, ("torso", "head"), 3, 12)],
                effects=[(0.25, "fx_step", "foot_r"), (0.25, "fx_step", "foot_l"), (0.55, "fx_step", "foot_r"),
                         (0.75, "fx_step", "foot_l"), (1.05, "fx_roar", "mouth")])


def roar():
    """Anticipation (hunch, arms curl in), inhale, then a huge roar: skull back, jaw wide, arms flung out
    with open claws, wide stance, head shaking. Peak at 0.55 s."""
    hunch = pose(stance(2), sym(arm=(20, 0, -15), elbow=(-35, 0, 0)),
                 torso=(20, 0, 0), head=(18, 0, 0), chestScale=1.0, back=(8, 0, 0))
    inhale = pose(stance(2.5), sym(arm=(10, 0, -5), elbow=(-45, 0, 0)),
                  torso=(8, 0, 0), head=(5, 0, 0), chestScale=1.07, back=(-4, 0, 0))
    burst = pose(stance(3), sym(arm=(-40, 0, 72), elbow=(-15, 0, 0), wrist=(30, 0, 0)),
                 torso=(-30, 0, 0), head=(-32, 0, 0), skull=(-12, 0, 0), jaw=(42, 0, 0), chestScale=1.05, back=(-10, 0, 0))
    hold = pose(stance(3), sym(arm=(-44, 0, 66), elbow=(-18, 0, 0), wrist=(35, 0, 0)),
                torso=(-26, 0, 0), head=(-29, 0, 0), skull=(-10, 0, 0), jaw=(38, 0, 0), chestScale=1.04, back=(-8, 0, 0))
    settle = pose(stance(0.5), sym(arm=(5, 0, 5), elbow=(-5, 0, 0)), torso=(4, 0, 0), head=(4, 0, 0), jaw=(5, 0, 0))
    return bake(2.0, [(0, N), (0.3, hunch), (0.45, inhale), (0.55, burst), (1.35, hold), (1.7, settle), (2.0, N)],
                shakes=[(0.55, 1.35, ("head", "skull", "jaw"), 5, 9), (0.55, 1.35, ("armR", "armL"), 2.5, 7),
                        (0.55, 1.35, ("torso",), 1.5, 6)],
                effects=[(0.55, "fx_roar", "mouth"), (0.85, "fx_roar", "mouth"), (1.15, "fx_roar", "mouth")])


def slam():
    """Rise on the toes with both fists overhead (elbows cocked back, frost gathering in the hands),
    then smash the ground in a deep stance. Impact at 0.72 s."""
    up = pose(sym(arm=(-168, 0, 16), elbow=(40, 0, 0)), bodyPos=(0, 2.5, 0.5),
              torso=(-22, 0, 0), head=(-18, 0, 0), jaw=(18, 0, 0), chestScale=1.05, back=(-6, 0, 0))
    peak = pose(sym(arm=(-172, 0, 12), elbow=(55, 0, 0)), bodyPos=(0, 3, 0.5),
                torso=(-26, 0, 0), head=(-20, 0, 0), jaw=(22, 0, 0), chestScale=1.06, back=(-8, 0, 0))
    impact = pose(stance(4.5, -2), sym(arm=(-48, 0, 6), elbow=(-5, 0, 0), wrist=(-25, 0, 0)),
                  torso=(42, 0, 0), head=(-24, 0, 0), skull=(-6, 0, 0), jaw=(36, 0, 0), back=(10, 0, 0))
    rebound = pose(stance(3.8, -2), sym(arm=(-52, 0, 8), elbow=(-8, 0, 0)),
                   torso=(37, 0, 0), head=(-18, 0, 0), jaw=(20, 0, 0), back=(8, 0, 0))
    return bake(1.6, [(0, N), (0.45, up), (0.6, peak), (0.72, impact), (0.8, rebound), (1.05, rebound), (1.6, N)],
                shakes=[(0.1, 0.6, ("armR", "armL", "elbowR", "elbowL"), 2.5, 11), (0.72, 1.0, ("torso", "head"), 3, 12)],
                effects=both_hands(0.1) + [(0.72, "fx_step", "hand_r"), (0.72, "fx_step", "hand_l"), (0.72, "fx_roar", "mouth")])


def leap():
    """Crouch with the arms swung back, launch with the legs extended, tuck in the air with both fists
    overhead, land in a deep smash. Takeoff 0.35-0.45 s, landing 1.1 s."""
    crouch = pose(stance(6), sym(arm=(40, 0, 12), elbow=(-30, 0, 0)),
                  torso=(32, 0, 0), head=(-22, 0, 0), back=(8, 0, 0))
    launch = pose(sym(arm=(-150, 0, 22), elbow=(-10, 0, 0)), bodyPos=(0, 5, 0),
                  torso=(-15, 0, 0), head=(-15, 0, 0), jaw=(30, 0, 0),
                  legR=(15, 0, 0), legL=(10, 0, 0))
    tuck = pose(sym(arm=(-170, 0, 15), elbow=(45, 0, 0)), bodyPos=(0, 3, 0),
                torso=(-20, 0, 0), head=(-10, 0, 0), jaw=(15, 0, 0),
                legR=(-55, 0, 8), kneeR=(75, 0, 0), legL=(-40, 0, -8), kneeL=(60, 0, 0))
    land = pose(stance(6, -2), sym(arm=(-42, 0, 8), elbow=(-5, 0, 0)),
                torso=(42, 0, 0), head=(-26, 0, 0), jaw=(40, 0, 0), back=(10, 0, 0))
    settle = pose(stance(4.5, -2), sym(arm=(-46, 0, 8), elbow=(-8, 0, 0)),
                  torso=(35, 0, 0), head=(-18, 0, 0), jaw=(15, 0, 0))
    return bake(1.75, [(0, N), (0.35, crouch), (0.45, launch), (0.9, tuck), (1.1, land), (1.35, settle), (1.75, N)],
                shakes=[(1.1, 1.35, ("torso", "head", "armR", "armL"), 3, 12)],
                effects=[(0.4, "fx_step", "foot_r"), (0.4, "fx_step", "foot_l"), (0.5, "fx_hand_glow", "hand_r"),
                         (0.5, "fx_hand_glow", "hand_l"), (1.1, "fx_step", "hand_r"), (1.1, "fx_step", "hand_l"),
                         (1.1, "fx_roar", "mouth")])


def throw():
    """Crouch and rip an ice boulder out of the ground with the left hand (the boulder is visible in the
    hand), heave it behind the head, step in and hurl it. Release at 0.6 s."""
    grab = pose(stance(4), side("arm", (-25, 0, -10), False), side("elbow", (-20, 0, 0), False), armR=(10, 0, 20), torso=(35, 18, 0), head=(-15, 0, 0))
    lift = pose(stance(1.5), side("arm", (-175, 0, -12), False), side("elbow", (70, 0, 0), False), armR=(20, 0, 25), elbowR=(-25, 0, 0),
                torso=(-22, -28, 0), head=(-12, 18, 0), jaw=(15, 0, 0), chestScale=1.05, back=(-6, 0, 0))
    release = pose(stance(2, -2), side("arm", (-65, 0, 5), False), side("elbow", (-5, 0, 0), False), armR=(-25, 0, 22), torso=(26, 22, 0), head=(-18, -10, 0),
                   jaw=(34, 0, 0), legL=(-28, 0, -4), kneeL=(20, 0, 0))
    follow = pose(stance(1.5, -2), side("arm", (-25, 0, 12), False), side("elbow", (-10, 0, 0), False),
                  armR=(-10, 0, 15), torso=(20, 16, 0), head=(-10, -6, 0), jaw=(12, 0, 0), legL=(-15, 0, 0))
    return bake(1.45, [(0, N), (0.22, grab), (0.5, lift), (0.6, release), (0.8, follow), (1.45, N)],
                shakes=[(0.3, 0.5, ("armL", "elbowL", "torso"), 2, 10)],
                effects=[(0.22, "fx_step", "hand_l"), (0.24, "fx_boulder_held", "hand_l")])


BREATH_SWEEP = [(0.6, 0), (1.1, -20), (1.6, 20), (2.1, 0)]  # torso yaw during the breath (deg)


def breath():
    """Deep inhale (chest swells, head back), lunge with the jaw wide and brace with the arms,
    sweep the frost breath left then right."""
    inhale = pose(stance(1), sym(arm=(-15, 0, 45), elbow=(-30, 0, 0)),
                  torso=(-26, 0, 0), head=(-30, 0, 0), skull=(-4, 0, 0), jaw=(6, 0, 0), chestScale=1.09, back=(-8, 0, 0))
    keys = [(0, N), (0.45, inhale)]
    for t, yaw in BREATH_SWEEP:
        keys.append((t, pose(stance(3, -1), sym(arm=(22, 0, 28), elbow=(-35, 0, 0)),
                             torso=(22, yaw, 0), head=(-14, yaw * 0.3, 0), skull=(-10, 0, 0), jaw=(44, 0, 0),
                             chestScale=1.0 - 0.02 * (t - 0.6), back=(6, 0, 0))))
    keys += [(2.35, pose(stance(1), torso=(8, 0, 0), jaw=(8, 0, 0), chestScale=0.98)), (2.6, N)]
    effects = [(0.6, "fx_breath_core", "mouth"), (1.2, "fx_breath_core", "mouth"), (1.8, "fx_breath_core", "mouth")]
    return bake(2.6, keys, shakes=[(0.6, 2.1, ("head", "jaw"), 2.5, 13)], effects=effects)


def summon():
    """Palms up, arms rise slowly while frost gathers in the hands, head back in a howl,
    then both fists smash the ground. Smash at 1.22 s."""
    rise = pose(stance(1), sym(arm=(-100, 0, 55), elbow=(-35, 0, 0)),
                torso=(-12, 0, 0), head=(-20, 0, 0), jaw=(20, 0, 0), chestScale=1.04)
    sky = pose(sym(arm=(-172, 0, 32), elbow=(15, 0, 0)), bodyPos=(0, 2, 0),
               torso=(-26, 0, 0), head=(-38, 0, 0), skull=(-10, 0, 0), jaw=(38, 0, 0), chestScale=1.07, back=(-10, 0, 0))
    smash = pose(stance(5, -2), sym(arm=(-42, 0, 6), elbow=(-5, 0, 0)),
                 torso=(42, 0, 0), head=(-22, 0, 0), jaw=(30, 0, 0), back=(10, 0, 0))
    hold = pose(stance(4, -2), sym(arm=(-46, 0, 6), elbow=(-8, 0, 0)),
                torso=(36, 0, 0), head=(-16, 0, 0), jaw=(10, 0, 0))
    return bake(2.2, [(0, N), (0.55, rise), (1.0, sky), (1.1, sky), (1.22, smash), (1.5, hold), (2.2, N)],
                shakes=[(0.4, 1.1, ("armR", "armL", "elbowR", "elbowL"), 3, 12)],
                effects=both_hands(0.2) + both_hands(0.7) + [(1.0, "fx_roar", "mouth"), (1.22, "fx_step", "hand_r"),
                                                            (1.22, "fx_step", "hand_l")])


def regen():
    """Drops to one knee, arms wrapped around the chest where a frost core glows, heavy breathing."""
    kneel = pose(stance(6.5), sym(arm=(-70, 0, -38), elbow=(-45, 0, 0)),
                 torso=(28, 0, 0), head=(24, 0, 0), jaw=(6, 0, 0), back=(8, 0, 0))
    keys = [(0, N), (0.4, kneel)]
    for i, t in enumerate((0.9, 1.4, 1.9)):
        keys.append((t, pose(kneel, chestScale=1.06 if i % 2 == 0 else 1.0, torso=(24 if i % 2 == 0 else 30, 0, 0),
                             head=(20 if i % 2 == 0 else 26, 0, 0), jaw=(12 if i % 2 == 0 else 2, 0, 0))))
    keys += [(2.1, kneel), (2.5, N)]
    return bake(2.5, keys, effects=[(0.4, "fx_chest_glow", "chest"), (1.4, "fx_breath_puff", "mouth")])


def swipe():
    """Right claw swipe (hit at 0.38 s) then left claw swipe (hit at 0.78 s): step in, claws spread,
    trails of frost at the fingertips."""
    windR = pose(stance(1.5), side("arm", (-115, 0, 58)), side("elbow", (35, 0, 0)),
                 armL=(10, 0, -12), torso=(8, 28, 0), head=(0, 10, 0), jaw=(10, 0, 0))
    hitR = pose(stance(2.5, -3), side("arm", (-58, 0, -42)), side("elbow", (-10, 0, 0)),
                armL=(15, 0, -15), torso=(22, -26, 0), head=(4, -16, 0), jaw=(30, 0, 0), legR=(-25, 0, 6))
    windL = pose(stance(1.5, -3), side("arm", (-115, 0, 58), False), side("elbow", (35, 0, 0), False), armR=(-45, 0, -30), torso=(10, -30, 0), head=(0, -12, 0), jaw=(12, 0, 0))
    hitL = pose(stance(2.5, -5), side("arm", (-58, 0, -42), False), side("elbow", (-10, 0, 0), False), armR=(-20, 0, 10), torso=(22, 26, 0), head=(4, 16, 0),
                jaw=(32, 0, 0), legL=(-25, 0, -6))
    return bake(1.35, [(0, N), (0.25, windR), (0.38, hitR), (0.52, pose(hitR, torso=(18, -22, 0))), (0.65, windL),
                       (0.78, hitL), (0.95, pose(hitL, torso=(16, 20, 0))), (1.35, N)],
                effects=[(0.22, "fx_claw_trail", "hand_r"), (0.62, "fx_claw_trail", "hand_l")])


def chest_beat():
    """Real gorilla chest beat: the elbows bend so the fists hit the chest, four alternating beats,
    roaring at the sky."""
    outR = pose(side("arm", (-25, 0, 35)), side("elbow", (-70, 0, 0)))
    inR = pose(side("arm", (-35, 0, -28)), side("elbow", (-115, 0, 0)))
    outL = pose(side("arm", (-25, 0, 35), False), side("elbow", (-70, 0, 0), False))
    inL = pose(side("arm", (-35, 0, -28), False), side("elbow", (-115, 0, 0), False))
    base = pose(stance(2), torso=(-16, 0, 0), head=(-32, 0, 0), skull=(-8, 0, 0), jaw=(38, 0, 0), back=(-6, 0, 0))
    keys = [(0, N), (0.3, pose(base, outR, outL, chestScale=1.06))]
    beats = [(0.45, inR, outL), (0.6, outR, outL), (0.75, outR, inL), (0.9, outR, outL),
             (1.05, inR, outL), (1.2, outR, outL), (1.35, outR, inL), (1.5, outR, outL)]
    for i, (t, r, l) in enumerate(beats):
        hit = i % 2 == 0
        keys.append((t, pose(base, r, l, chestScale=0.98 if hit else 1.05,
                             bodyPos=(0, -3 if hit else -1.5, 0), torso=(-12 if hit else -17, 0, 0))))
    keys += [(1.75, pose(stance(1), jaw=(10, 0, 0))), (2.0, N)]
    return bake(2.0, keys, shakes=[(0.3, 1.6, ("head", "jaw"), 3, 9)],
                effects=[(0.3, "fx_roar", "mouth"), (0.45, "fx_step", "chest"), (0.75, "fx_step", "chest"),
                         (1.05, "fx_step", "chest"), (1.35, "fx_step", "chest"), (1.0, "fx_roar", "mouth")])


def spin():
    """Arms thrown out, the torso spins two full turns, the legs step around."""
    out = sym(arm=(-12, 0, 82), elbow=(-5, 0, 0))
    keys = [(0, N), (0.25, pose(stance(2), out, torso=(-6, 0, 0), head=(-10, 0, 0), jaw=(25, 0, 0)))]
    for i, t in enumerate((0.5, 0.75, 1.0, 1.25)):
        keys.append((t, pose(stance(2), out, torso=(-6, 180 * (i + 1), 8 if i % 2 else -8), head=(-10, 0, 0),
                             jaw=(25, 0, 0), legR=(-20 if i % 2 else 10, 0, 10), legL=(10 if i % 2 else -20, 0, -10))))
    keys += [(1.6, pose(torso=(0, 720, 0)))]
    return bake(1.6, keys, linear={"torso"}, effects=both_hands(0.25, "fx_claw_trail"))


def cast():
    """Thrust both palms forward, fingers splayed, arms trembling with the strain."""
    thrust = pose(stance(2.5, -1), sym(arm=(-90, 0, -6), elbow=(-8, 0, 0), wrist=(55, 0, 0)),
                  torso=(15, 0, 0), head=(-10, 0, 0), skull=(-6, 0, 0), jaw=(30, 0, 0), back=(4, 0, 0))
    return bake(1.8, [(0, N), (0.35, pose(stance(1), sym(arm=(-125, 0, 18), elbow=(60, 0, 0)),
                                          torso=(-15, 0, 0), head=(-20, 0, 0), chestScale=1.05)),
                      (0.55, thrust), (1.4, pose(thrust, torso=(12, 0, 0))), (1.8, N)],
                shakes=[(0.55, 1.4, ("armR", "armL", "elbowR", "elbowL"), 3, 14),
                        (0.55, 1.4, ("head",), 2, 9)],
                effects=both_hands(0.2) + both_hands(0.9))


def phase_intro():
    """New phase: kneels with the fists on the ground, rises, beats its chest, then a long roar."""
    kneel = pose(stance(7), sym(arm=(-50, 0, 15), elbow=(-10, 0, 0)), torso=(50, 0, 0), head=(-24, 0, 0), back=(10, 0, 0))
    rise = pose(stance(1), sym(arm=(10, 0, 18), elbow=(-20, 0, 0)), torso=(-8, 0, 0), head=(-8, 0, 0), chestScale=1.05)
    outR = pose(side("arm", (-25, 0, 35)), side("elbow", (-70, 0, 0)))
    inR = pose(side("arm", (-35, 0, -28)), side("elbow", (-115, 0, 0)))
    outL = pose(side("arm", (-25, 0, 35), False), side("elbow", (-70, 0, 0), False))
    inL = pose(side("arm", (-35, 0, -28), False), side("elbow", (-115, 0, 0), False))
    beat = pose(stance(2), torso=(-14, 0, 0), head=(-25, 0, 0), jaw=(25, 0, 0))
    roar_pose = pose(stance(3), sym(arm=(-40, 0, 72), elbow=(-15, 0, 0)), torso=(-30, 0, 0),
                     head=(-34, 0, 0), skull=(-12, 0, 0), jaw=(44, 0, 0), chestScale=1.05, back=(-10, 0, 0))
    keys = [(0, kneel), (0.35, kneel), (0.95, rise), (1.1, pose(beat, outR, outL)), (1.25, pose(beat, inR, outL)),
            (1.4, pose(beat, outR, outL)), (1.55, pose(beat, outR, inL)), (1.7, pose(beat, outR, outL)),
            (1.85, pose(beat, inR, outL)), (2.0, pose(beat, outR, outL)), (2.15, pose(beat, outR, inL)),
            (2.3, roar_pose), (2.75, roar_pose), (3.0, N)]
    return bake(3.0, keys, shakes=[(2.3, 2.75, ("head", "skull", "jaw", "armR", "armL"), 4, 9)],
                effects=[(0.0, "fx_step", "hand_r"), (0.0, "fx_step", "hand_l"), (0.95, "fx_breath_puff", "mouth"),
                         (2.3, "fx_roar", "mouth"), (2.55, "fx_roar", "mouth")])


def combo():
    """3-hit combo: right swipe (0.35 s), left swipe (0.75 s), then a leaping double-fist smash (1.35 s)."""
    windR = pose(stance(1.5), side("arm", (-115, 0, 58)), side("elbow", (35, 0, 0)), torso=(8, 28, 0), jaw=(10, 0, 0))
    hitR = pose(stance(2.5, -3), side("arm", (-58, 0, -42)), torso=(22, -26, 0), jaw=(28, 0, 0))
    windL = pose(stance(1.5, -3), side("arm", (-115, 0, 58), False), side("elbow", (35, 0, 0), False),
                 armR=(-45, 0, -30), torso=(10, -30, 0))
    hitL = pose(stance(2.5, -5), side("arm", (-58, 0, -42), False),
                armR=(-20, 0, 10), torso=(22, 26, 0), jaw=(30, 0, 0))
    up = pose(sym(arm=(-172, 0, 12), elbow=(55, 0, 0)), bodyPos=(0, 5, -6), torso=(-25, 0, 0),
              head=(-20, 0, 0), jaw=(30, 0, 0), legR=(-40, 0, 6), kneeR=(55, 0, 0), legL=(-30, 0, -6), kneeL=(45, 0, 0))
    smash = pose(stance(5.5, -9), sym(arm=(-46, 0, 6), elbow=(-5, 0, 0)), torso=(44, 0, 0),
                 head=(-25, 0, 0), jaw=(42, 0, 0), back=(10, 0, 0))
    return bake(2.2, [(0, N), (0.22, windR), (0.35, hitR), (0.6, windL), (0.75, hitL), (1.1, up), (1.35, smash),
                      (1.6, pose(smash, torso=(38, 0, 0))), (2.2, N)],
                shakes=[(1.35, 1.6, ("torso", "head"), 3, 12)],
                effects=[(0.2, "fx_claw_trail", "hand_r"), (0.58, "fx_claw_trail", "hand_l"), (0.95, "fx_hand_glow", "hand_r"),
                         (0.95, "fx_hand_glow", "hand_l"), (1.35, "fx_step", "hand_r"), (1.35, "fx_step", "hand_l"),
                         (1.35, "fx_roar", "mouth")])


def howl():
    """Long howl to the sky: body arched back, arms spread wide, claws open, head trembling."""
    arched = pose(stance(3), sym(arm=(-70, 0, 78), elbow=(-10, 0, 0)), torso=(-34, 0, 0),
                  head=(-40, 0, 0), skull=(-14, 0, 0), jaw=(46, 0, 0), chestScale=1.08, back=(-12, 0, 0))
    gather = pose(stance(2), sym(arm=(15, 0, -10), elbow=(-50, 0, 0)), torso=(25, 0, 0),
                  head=(15, 0, 0), chestScale=1.02, back=(8, 0, 0))
    return bake(2.4, [(0, N), (0.4, gather), (0.7, arched), (1.9, pose(arched, torso=(-30, 0, 0))), (2.4, N)],
                shakes=[(0.7, 1.9, ("head", "skull", "jaw"), 4, 10), (0.7, 1.9, ("armR", "armL"), 2, 8)],
                effects=[(0.7, "fx_roar", "mouth"), (1.0, "fx_roar", "mouth"), (1.3, "fx_roar", "mouth"),
                         (1.6, "fx_roar", "mouth")] + both_hands(0.7) + both_hands(1.4))


def slide():
    """Barioth-style ice slide: crouches low, spins on the belly across the ice, gets up with a claw sweep."""
    low = pose(stance(6), sym(arm=(35, 0, 60), elbow=(-20, 0, 0)), torso=(55, 0, 0), head=(-35, 0, 0), jaw=(25, 0, 0))
    keys = [(0, N), (0.25, low)]
    for i, t in enumerate((0.45, 0.65, 0.85, 1.05)):
        keys.append((t, pose(low, torso=(55, 180 * (i + 1), 0))))
    keys += [(1.25, pose(stance(3), side("arm", (-60, 0, -40)), torso=(20, 720 + 30, 0), jaw=(35, 0, 0))), (1.6, pose(torso=(0, 720, 0)))]
    return bake(1.6, keys, linear={"torso"}, effects=[(0.25, "fx_step", "foot_r"), (0.25, "fx_step", "foot_l"),
                                                    (1.25, "fx_claw_trail", "hand_r")])


def dance():
    """Malenia-style flurry: leaps up spinning, then three fast diving claw slashes."""
    up = pose(sym(arm=(-160, 0, 40), elbow=(30, 0, 0)), bodyPos=(0, 4, 0), torso=(-20, 0, 0), legR=(-50, 0, 0), kneeR=(70, 0, 0),
              legL=(-40, 0, 0), kneeL=(60, 0, 0), jaw=(30, 0, 0))
    keys = [(0, N), (0.3, pose(stance(5), torso=(30, 0, 0))), (0.6, up)]
    for i, t in enumerate((0.8, 1.05, 1.3)):
        s = 1 if i % 2 == 0 else -1
        keys.append((t, pose(stance(3, -3), side("arm", (-60, 0, -40), s > 0), side("elbow", (-10, 0, 0), s > 0),
                             torso=(30, 30 * s, 0), jaw=(40, 0, 0))))
        keys.append((t + 0.12, pose(stance(2), side("arm", (-120, 0, 50), s < 0), torso=(10, -25 * s, 0))))
    keys += [(1.9, N)]
    return bake(1.9, keys, effects=[(0.7, "fx_claw_trail", "hand_r"), (0.7, "fx_claw_trail", "hand_l"),
                                    (1.0, "fx_claw_trail", "hand_r"), (1.25, "fx_claw_trail", "hand_l")])


def beam_sweep():
    """Moon Lord-style mouth beam: charges with the head back, then sweeps the beam right to left."""
    charge = pose(stance(2), sym(arm=(10, 0, 40), elbow=(-40, 0, 0)), torso=(-25, 0, 0), head=(-35, 0, 0), jaw=(10, 0, 0), chestScale=1.1)
    keys = [(0, N), (0.8, charge)]
    for t, yaw in ((1.0, 35), (2.2, -35)):
        keys.append((t, pose(stance(3), sym(arm=(20, 0, 30), elbow=(-30, 0, 0)), torso=(15, yaw, 0), head=(-10, yaw * 0.3, 0), jaw=(48, 0, 0))))
    keys += [(2.6, N)]
    return bake(2.6, keys, shakes=[(1.0, 2.2, ("head", "jaw"), 3, 14)],
                effects=[(0.1, "fx_breath_core", "mouth"), (0.5, "fx_breath_core", "mouth"), (1.0, "fx_roar", "mouth")])


def death_breathe():
    """yeti_death lies on its back: slow heavy breathing, the head and arms twitch now and then."""
    return bake(3.0, [(0, N), (1.2, pose(torso=(-4, 0, 0), chestScale=1.04, head=(0, 0, 4))),
                      (1.35, pose(torso=(-4, 0, 0), chestScale=1.04, head=(0, 0, -3))),
                      (1.5, pose(torso=(-4, 0, 0), chestScale=1.04, head=(0, 0, 3), jaw=(10, 0, 0))),
                      (2.1, pose(armR=(0, 0, 0))), (2.2, pose(armR=(0, 0, 8))), (2.35, N), (3.0, N)],
                loop=True, effects=[(1.5, "fx_breath_puff", "mouth")])


def death_pulse():
    """yeti_death casting: the whole body jolts and the limbs spasm."""
    jolt = pose(bodyPos=(0, 3, 0), torso=(-12, 0, 0), head=(-20, 0, 10), jaw=(35, 0, 0),
                **sym(arm=(-30, 0, 20), elbow=(-25, 0, 0)), legR=(-20, 0, 0), legL=(-15, 0, 0))
    return bake(1.0, [(0, N), (0.1, jolt), (0.25, pose(torso=(-4, 0, 0), jaw=(20, 0, 0))), (0.35, pose(jolt, bodyPos=(0, 1.5, 0))),
                      (0.5, pose(jaw=(10, 0, 0))), (1.0, N)],
                shakes=[(0.1, 0.6, ("armR", "armL"), 6, 12)],
                effects=[(0.1, "fx_roar", "mouth"), (0.1, "fx_chest_glow", "chest")])


SKILLS = {
    "idle": idle,
    "slide": slide,
    "dance": dance,
    "beam_sweep": beam_sweep,
    "walk": walk,
    "attack": attack,
    "ground_punch": ground_punch,
    "charge": charge,
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
    "combo": combo,
    "howl": howl,
}

DEATH = {"breathe": death_breathe, "pulse": death_pulse}

# Short particle names used by the animations -> particle identifiers (client entity particle_effects)
PARTICLE_EFFECTS = {
    "fx_eye": "ytaun:eye_glow",
    "fx_breath_puff": "ytaun:breath_puff",
    "fx_roar": "ytaun:roar_mist",
    "fx_hand_glow": "ytaun:hand_glow",
    "fx_claw_trail": "ytaun:claw_trail",
    "fx_step": "ytaun:snow_step",
    "fx_boulder_held": "ytaun:boulder_held",
    "fx_chest_glow": "ytaun:chest_glow",
    "fx_breath_core": "ytaun:breath_core",
}


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
