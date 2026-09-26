"""Animations, animation controllers and locators for The Harvester boss.

Poses are authored as full-body keyframes: at each key time, every bone the animation touches
takes the listed value, or the rest value (0 / scale 1) when it is not listed.
All keys use Catmull-Rom interpolation, like Blockbench "smooth" keys.

Bone map of geometry.pa_harvester_default:
  bone18 root (float height)      bone   tattered robe skirt      bone6  upper body
  bone28 head (plague hat, skull) bone7  right arm + scythe       bone2  scythe (grip pivot)
  bone11 left arm                 bone27 soul gem in the ribcage  bone31 ribcage

Rotation directions (Bedrock file values):
  arms: -x raises forward, bone7 +z / bone11 -z lift sideways, bone7 +y / bone11 -y swing across the chest
  bone6: +x leans forward, +y twists the right shoulder forward
  bone2: +x levels the shaft forward with the blade hanging down, +z swings it outward

Timings used by the script (scripts/harvester.js) are marked HIT below.
"""
import json
import os

LOCATORS = {
    # bone: {name: file-space position}
    "bone5": {"blade": [-22.8, 46.7, -15.5], "blade_tip": [-22.8, 36.0, -24.8], "blade_heel": [-22.8, 58, -7]},
    "bone10": {"hand_right": [-19.9, 18.1, -5.9]},
    "bone17": {"hand_left": [18.9, 18.1, -5.9]},
    "bone27": {"gem": [0, 37, -10.5]},
    "bone28": {"eyes": [0, 45.5, -6.5], "skull_top": [0, 55, 0]},
    "bone18": {"feet": [0, 3, 0]},
    "bone15": {"shoulder_left": [10, 39.5, 2]},
    "bone8": {"shoulder_right": [-11, 39.5, 2]},
    "bone6": {"back": [0, 40, 10]},
}

PARTICLES = {
    "trail": "harvester:scythe_trail",
    "trail_big": "harvester:scythe_trail_big",
    "gem": "harvester:gem_pulse",
    "eye": "harvester:eye_glow",
    "ember": "harvester:ember",
    "smoke": "harvester:black_smoke",
    "souls": "harvester:soul_burst",
    "wisp": "harvester:soul_wisp",
    "ash": "harvester:ash_burst",
    "flames": "harvester:soul_flames",
    # Ghost Rider soul fire that never stops (controller.animation.pa_harvester.soulfire)
    "skull_fire": "harvester:soulfire_skull",
    "skull_fire_big": "harvester:soulfire_skull_big",
    "crown": "harvester:soulfire_crown",
    "hem": "harvester:soulfire_hem",
    "hem_big": "harvester:soulfire_hem_big",
    "blade_fire": "harvester:soulfire_blade",
    "hand_fire": "harvester:soulfire_hand",
    "back_fire": "harvester:soulfire_back",
    "embers": "harvester:soulfire_embers",
    "fire_smoke": "harvester:soulfire_smoke",
}

ANIMS = {}


def anim(name, length, poses, loop=False, particles=(), extra=None):
    """poses: list of (time, {bone: {"r": [..], "p": [..], "s": [..] or number}})."""
    ANIMS[name] = {"length": length, "poses": poses, "loop": loop, "particles": list(particles), "extra": extra or {}}


def trail(times, locator="blade", effect="trail", spins=None):
    out = []
    for i, t in enumerate(times):
        script = "v.spin = %d;" % (spins[i] if spins else (i * 25 - 30))
        out.append((t, effect, locator, script))
    return out


R = lambda x=0, y=0, z=0: [x, y, z]  # noqa: E731

# ---------------------------------------------------------------------------
# Base loops
# ---------------------------------------------------------------------------

anim("idle", 3.0, [
    (0.0, {"bone18": {"p": R(0, 0, 0)}, "bone": {"r": R(3, 0, 1)}, "bone6": {"r": R(3, 0, 0)},
           "bone28": {"r": R(-3, 0, 4)}, "bone7": {"r": R(4, 0, 0)}, "bone2": {"r": R(0, 0, 0)},
           "bone11": {"r": R(-2, 0, -2)}, "bone27": {"s": 1.0}}),
    (0.75, {"bone18": {"p": R(0, 0.7, 0)}, "bone": {"r": R(0, 3, 0)}, "bone6": {"r": R(4, 0, 0)},
            "bone28": {"r": R(0, 3, 1)}, "bone7": {"r": R(1, 0, 2)}, "bone2": {"r": R(0, 0, 2)},
            "bone11": {"r": R(1, 0, -4)}, "bone27": {"s": 1.3}}),
    (1.5, {"bone18": {"p": R(0, 1.3, 0)}, "bone": {"r": R(-3, 0, -1)}, "bone6": {"r": R(5, 0, 0)},
           "bone28": {"r": R(2, 0, -3)}, "bone7": {"r": R(-2, 0, 3)}, "bone2": {"r": R(0, 0, 4)},
           "bone11": {"r": R(4, 0, -6)}, "bone27": {"s": 1.05}}),
    (2.25, {"bone18": {"p": R(0, 0.7, 0)}, "bone": {"r": R(0, -3, 0)}, "bone6": {"r": R(4, 0, 0)},
            "bone28": {"r": R(0, -3, 1)}, "bone7": {"r": R(1, 0, 2)}, "bone2": {"r": R(0, 0, 2)},
            "bone11": {"r": R(1, 0, -4)}, "bone27": {"s": 1.25}}),
    (3.0, {"bone18": {"p": R(0, 0, 0)}, "bone": {"r": R(3, 0, 1)}, "bone6": {"r": R(3, 0, 0)},
           "bone28": {"r": R(-3, 0, 4)}, "bone7": {"r": R(4, 0, 0)}, "bone2": {"r": R(0, 0, 0)},
           "bone11": {"r": R(-2, 0, -2)}, "bone27": {"s": 1.0}}),
], loop=True, particles=[(0.75, "gem", "gem", ""), (2.25, "gem", "gem", ""), (1.5, "eye", "eyes", "")])

anim("move", 1.2, [
    (0.0, {"bone18": {"p": R(0, 0, 0)}, "bone6": {"r": R(14, 0, 0)}, "bone": {"r": R(16, 0, 0)},
           "bone7": {"r": R(20, 0, 4)}, "bone2": {"r": R(-8, 0, 0)}, "bone11": {"r": R(-10, 0, -6)},
           "bone28": {"r": R(-10, 0, 0)}}),
    (0.6, {"bone18": {"p": R(0, 0.9, 0)}, "bone6": {"r": R(12, 0, 0)}, "bone": {"r": R(22, 0, 0)},
           "bone7": {"r": R(24, 0, 6)}, "bone2": {"r": R(-10, 0, 0)}, "bone11": {"r": R(4, 0, -8)},
           "bone28": {"r": R(-8, 0, 0)}}),
    (1.2, {"bone18": {"p": R(0, 0, 0)}, "bone6": {"r": R(14, 0, 0)}, "bone": {"r": R(16, 0, 0)},
           "bone7": {"r": R(20, 0, 4)}, "bone2": {"r": R(-8, 0, 0)}, "bone11": {"r": R(-10, 0, -6)},
           "bone28": {"r": R(-10, 0, 0)}}),
], loop=True)

# ---------------------------------------------------------------------------
# Melee: overhead diagonal chop (played by the script when a melee hit lands)
# ---------------------------------------------------------------------------

anim("attack", 0.8, [
    (0.0, {}),
    (0.16, {"bone7": {"r": R(-155, 0, 15)}, "bone2": {"r": R(-20, 0, 0)}, "bone6": {"r": R(-12, 15, 0)},
            "bone28": {"r": R(-10, 0, 0)}, "bone11": {"r": R(-35, 0, -25)}, "bone": {"r": R(-6, 0, 0)}}),
    (0.28, {"bone7": {"r": R(-40, -10, 5)}, "bone2": {"r": R(70, 0, 0)}, "bone6": {"r": R(24, -10, 0)},
            "bone28": {"r": R(12, 0, 0)}, "bone11": {"r": R(10, 0, -10)}, "bone": {"r": R(10, 0, 0)}}),
    (0.42, {"bone7": {"r": R(-25, -15, 0)}, "bone2": {"r": R(80, 0, 0)}, "bone6": {"r": R(20, -12, 0)},
            "bone28": {"r": R(8, 0, 0)}, "bone11": {"r": R(12, 0, -8)}, "bone": {"r": R(12, 0, 0)}}),
    (0.8, {}),
], particles=trail([0.2, 0.24, 0.28, 0.32]))

# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------

# Reaping Arc — wide horizontal sweep. HIT 0.65 s
anim("skill_reap", 1.35, [
    (0.0, {}),
    (0.45, {"bone6": {"r": R(-4, 30, 0)}, "bone7": {"r": R(-62, 100, 0)}, "bone2": {"r": R(100, 0, 0)},
            "bone11": {"r": R(-45, 0, -20)}, "bone28": {"r": R(0, -20, 0)}, "bone": {"r": R(0, -15, 0)},
            "bone18": {"p": R(0, -1, 0)}}),
    (0.58, {"bone6": {"r": R(-6, 36, 0)}, "bone7": {"r": R(-64, 110, 0)}, "bone2": {"r": R(100, 0, 0)},
            "bone11": {"r": R(-50, 0, -24)}, "bone28": {"r": R(0, -24, 0)}, "bone": {"r": R(0, -18, 0)},
            "bone18": {"p": R(0, -1.2, 0)}}),
    (0.7, {"bone6": {"r": R(10, 0, 0)}, "bone7": {"r": R(-70, 15, 0)}, "bone2": {"r": R(100, 0, 0)},
           "bone11": {"r": R(-10, 0, -30)}, "bone28": {"r": R(4, 0, 0)}, "bone": {"r": R(8, 10, 0)},
           "bone18": {"p": R(0, 0.5, 0)}}),
    (0.86, {"bone6": {"r": R(14, -38, 0)}, "bone7": {"r": R(-60, -65, 0)}, "bone2": {"r": R(100, 0, 0)},
            "bone11": {"r": R(12, 0, -35)}, "bone28": {"r": R(6, 18, 0)}, "bone": {"r": R(10, 22, 0)}}),
    (1.35, {}),
], particles=trail([0.62, 0.66, 0.7, 0.74, 0.78], locator="blade_tip", spins=[-60, -30, 0, 30, 60])
   + [(0.7, "ember", "blade_tip", "")])

# Ember Retreat (on hit) — sink into the cloak and burn away. TELEPORT 0.5 s
anim("skill_vanish", 0.6, [
    (0.0, {}),
    (0.2, {"bone6": {"r": R(30, 0, 0)}, "bone7": {"r": R(25, 0, 0)}, "bone11": {"r": R(25, 0, 0)},
           "bone28": {"r": R(20, 0, 0)}, "bone18": {"s": 0.9}}),
    (0.5, {"bone6": {"r": R(40, 0, 0)}, "bone7": {"r": R(30, 0, 0)}, "bone11": {"r": R(30, 0, 0)},
           "bone28": {"r": R(25, 0, 0)}, "bone18": {"s": 0.04, "p": R(0, -6, 0)}}),
    (0.6, {"bone6": {"r": R(40, 0, 0)}, "bone18": {"s": 0.02, "p": R(0, -6, 0)}}),
], particles=[(0.05, "smoke", "gem", ""), (0.3, "flames", "feet", ""), (0.45, "smoke", "feet", "")])

# Field of Souls — stab the scythe into the earth (soul wheat sprouts), then reap the field.
# SPROUT 0.65 s, HARVEST 1.7 s
_stab = {"bone7": {"r": R(-50, 12, 8)}, "bone2": {"r": R(55, 0, 0)}, "bone6": {"r": R(30, 0, 0)},
         "bone28": {"r": R(18, 0, 0)}, "bone11": {"r": R(-10, 0, -55)}, "bone18": {"p": R(0, -2, 0)},
         "bone": {"r": R(15, 0, 0)}}
anim("skill_field", 2.4, [
    (0.0, {}),
    (0.45, {"bone7": {"r": R(-165, 0, 12)}, "bone2": {"r": R(0, 0, 0)}, "bone6": {"r": R(-10, 0, 0)},
            "bone28": {"r": R(-16, 0, 0)}, "bone11": {"r": R(-20, 0, -65)}, "bone18": {"p": R(0, 2, 0)}}),
    (0.65, _stab),
    (1.25, {**_stab, "bone11": {"r": R(-100, 0, -30)}, "bone27": {"s": 1.6}}),
    (1.55, {"bone6": {"r": R(-6, 36, 0)}, "bone7": {"r": R(-64, 110, 0)}, "bone2": {"r": R(100, 0, 0)},
            "bone11": {"r": R(-50, 0, -24)}, "bone28": {"r": R(0, -24, 0)}, "bone": {"r": R(0, -18, 0)},
            "bone18": {"p": R(0, -1.2, 0)}}),
    (1.7, {"bone6": {"r": R(10, 0, 0)}, "bone7": {"r": R(-70, 15, 0)}, "bone2": {"r": R(100, 0, 0)},
           "bone11": {"r": R(-10, 0, -30)}, "bone28": {"r": R(4, 0, 0)}, "bone": {"r": R(8, 10, 0)},
           "bone18": {"p": R(0, 0.5, 0)}}),
    (1.9, {"bone6": {"r": R(14, -38, 0)}, "bone7": {"r": R(-60, -65, 0)}, "bone2": {"r": R(100, 0, 0)},
           "bone11": {"r": R(12, 0, -35)}, "bone28": {"r": R(6, 18, 0)}, "bone": {"r": R(10, 22, 0)}}),
    (2.4, {}),
], particles=[(0.65, "ash", "blade_tip", ""), (0.65, "flames", "blade_tip", ""), (1.25, "gem", "gem", "")]
   + trail([1.62, 1.66, 1.7, 1.74, 1.78], locator="blade_tip", spins=[-60, -30, 0, 30, 60]))

# Will-o'-the-Wisps — lift the lantern hand high, wisps gather, then send them. RELEASE 0.75 s
anim("skill_wisps", 1.4, [
    (0.0, {}),
    (0.35, {"bone11": {"r": R(-160, 0, -15)}, "bone6": {"r": R(-8, 0, 0)}, "bone28": {"r": R(-15, -10, 0)},
            "bone7": {"r": R(10, 0, 12)}, "bone27": {"s": 1.5}, "bone18": {"p": R(0, 1.5, 0)}}),
    (0.55, {"bone11": {"r": R(-165, 0, -18)}, "bone6": {"r": R(-9, 0, 0)}, "bone28": {"r": R(-16, -10, 0)},
            "bone7": {"r": R(10, 0, 12)}, "bone27": {"s": 1.8}, "bone18": {"p": R(0, 1.8, 0)}}),
    (0.75, {"bone11": {"r": R(-95, -15, -10)}, "bone6": {"r": R(10, -10, 0)}, "bone28": {"r": R(5, 0, 0)},
            "bone7": {"r": R(12, 0, 14)}, "bone27": {"s": 1.3}}),
    (1.4, {}),
], particles=[(0.35, "gem", "gem", ""), (0.35, "eye", "eyes", ""), (0.55, "flames", "hand_left", "")])

# Candles of the Dead — palms up low, then lift them: candles light around the target. LIGHT 0.7 s
_candles_up = {"bone7": {"r": R(-40, 0, 80)}, "bone11": {"r": R(-40, 0, -80)}, "bone6": {"r": R(-10, 0, 0)},
               "bone28": {"r": R(-20, 0, 0)}, "bone18": {"p": R(0, 2, 0)}, "bone27": {"s": 1.7},
               "bone2": {"r": R(0, 0, 30)}}
anim("skill_candles", 1.6, [
    (0.0, {}),
    (0.4, {"bone7": {"r": R(-10, 0, 45)}, "bone11": {"r": R(-10, 0, -45)}, "bone6": {"r": R(12, 0, 0)},
           "bone28": {"r": R(20, 0, 0)}, "bone18": {"p": R(0, -1, 0)}, "bone2": {"r": R(20, 0, 0)}}),
    (0.7, _candles_up),
    (1.05, {**_candles_up, "bone18": {"p": R(0, 2.4, 0)}, "bone27": {"s": 1.5}}),
    (1.6, {}),
], particles=[(0.7, "flames", "hand_left", ""), (0.7, "flames", "hand_right", ""), (0.7, "gem", "gem", "")])

# Plague Pyre — point at the infected, hold, then clench the fist overhead. IGNITE 1.5 s
anim("skill_pyre", 1.9, [
    (0.0, {}),
    (0.3, {"bone11": {"r": R(-95, -10, -8)}, "bone6": {"r": R(8, 12, 0)}, "bone28": {"r": R(6, -8, 0)},
           "bone7": {"r": R(15, 0, 18)}}),
    (1.1, {"bone11": {"r": R(-98, -12, -10)}, "bone6": {"r": R(9, 13, 0)}, "bone28": {"r": R(8, -8, 3)},
           "bone7": {"r": R(15, 0, 18)}, "bone27": {"s": 1.5}}),
    (1.45, {"bone11": {"r": R(-165, 0, -20)}, "bone6": {"r": R(-12, -10, 0)}, "bone28": {"r": R(-18, 0, 0)},
            "bone7": {"r": R(10, 0, 25)}, "bone18": {"p": R(0, 1.5, 0)}, "bone27": {"s": 2.0}}),
    (1.9, {}),
], particles=[(0.3, "eye", "eyes", ""), (0.3, "flames", "hand_left", ""), (1.45, "flames", "hand_left", ""),
              (1.45, "gem", "gem", "")])

# Footsteps of the Dead — bow and trace the ground with the left hand, then snap upright.
# The footprints start recording at 0.8 s
anim("skill_trail", 1.2, [
    (0.0, {}),
    (0.3, {"bone6": {"r": R(30, 10, 0)}, "bone11": {"r": R(-40, 30, -20)}, "bone28": {"r": R(20, 0, 0)},
           "bone7": {"r": R(20, 0, 10)}, "bone18": {"p": R(0, -1.5, 0)}}),
    (0.6, {"bone6": {"r": R(28, -15, 0)}, "bone11": {"r": R(-40, -40, -30)}, "bone28": {"r": R(20, -10, 0)},
           "bone7": {"r": R(20, 0, 10)}, "bone18": {"p": R(0, -1.5, 0)}}),
    (0.8, {"bone6": {"r": R(-8, 0, 0)}, "bone11": {"r": R(-120, 0, -30)}, "bone28": {"r": R(-15, 0, 0)},
           "bone7": {"r": R(5, 0, 15)}, "bone27": {"s": 1.6}, "bone18": {"p": R(0, 1, 0)}}),
    (1.2, {}),
], particles=[(0.3, "ash", "hand_left", ""), (0.6, "ash", "hand_left", ""), (0.8, "flames", "hand_left", ""),
              (0.8, "eye", "eyes", "")])

# Buried Alive — point at the grave, raise both hands, slam the lid shut. LID 1.0 s
anim("skill_coffin", 1.5, [
    (0.0, {}),
    (0.3, {"bone11": {"r": R(-92, 0, -6)}, "bone6": {"r": R(5, 0, 0)}, "bone7": {"r": R(10, 0, 15)},
           "bone28": {"r": R(4, 0, 0)}}),
    (0.75, {"bone7": {"r": R(-150, 0, 30)}, "bone11": {"r": R(-150, 0, -30)}, "bone6": {"r": R(-12, 0, 0)},
            "bone28": {"r": R(-25, 0, 0)}, "bone18": {"p": R(0, 3, 0)}, "bone27": {"s": 1.8}}),
    (1.0, {"bone7": {"r": R(-40, 0, 20)}, "bone11": {"r": R(-40, 0, -20)}, "bone2": {"r": R(-30, 0, 0)},
           "bone6": {"r": R(30, 0, 0)}, "bone28": {"r": R(15, 0, 0)}, "bone18": {"p": R(0, -2, 0)},
           "bone": {"r": R(15, 0, 0)}, "bone27": {"s": 1.2}}),
    (1.5, {}),
], particles=[(0.75, "gem", "gem", ""), (1.0, "ash", "feet", ""), (1.0, "smoke", "feet", "")])

# Danse Macabre — raise the scythe like a baton and waltz while the dancers circle. DANCERS 0.4 s
anim("skill_danse", 2.2, [
    (0.0, {}),
    (0.4, {"bone7": {"r": R(-160, 0, 10)}, "bone11": {"r": R(-30, 0, -70)}, "bone6": {"r": R(-8, 0, 0)},
           "bone28": {"r": R(-15, 0, 0)}, "bone18": {"p": R(0, 2, 0)}, "bone27": {"s": 1.6}}),
    (0.8, {"bone": {"r": R(0, 35, 0)}, "bone6": {"r": R(-6, 25, 5)}, "bone7": {"r": R(-150, 0, 25)},
           "bone11": {"r": R(-40, 0, -80)}, "bone28": {"r": R(-10, 20, 0)}, "bone18": {"p": R(0, 3, 0)}}),
    (1.2, {"bone": {"r": R(0, -35, 0)}, "bone6": {"r": R(-6, -25, -5)}, "bone7": {"r": R(-150, 0, 5)},
           "bone11": {"r": R(-40, 0, -60)}, "bone28": {"r": R(-10, -20, 0)}, "bone18": {"p": R(0, 2, 0)}}),
    (1.6, {"bone": {"r": R(0, 30, 0)}, "bone6": {"r": R(-6, 20, 5)}, "bone7": {"r": R(-155, 0, 20)},
           "bone11": {"r": R(-40, 0, -75)}, "bone28": {"r": R(-10, 15, 0)}, "bone18": {"p": R(0, 3, 0)}}),
    (2.2, {}),
], particles=[(0.4, "gem", "gem", ""), (0.4, "eye", "eyes", ""), (0.4, "flames", "blade", "")])

# Death Sentence — point the scythe at the condemned. Marks at 0.4 s
anim("skill_sentence", 1.5, [
    (0.0, {}),
    (0.4, {"bone7": {"r": R(-88, -8, 0)}, "bone2": {"r": R(100, 0, 0)}, "bone11": {"r": R(-35, 0, -30)},
           "bone6": {"r": R(-5, -10, 0)}, "bone28": {"r": R(5, 8, -14)}}),
    (1.0, {"bone7": {"r": R(-85, -8, 0)}, "bone2": {"r": R(100, 0, 0)}, "bone11": {"r": R(-32, 0, -30)},
           "bone6": {"r": R(-4, -10, 0)}, "bone28": {"r": R(6, 8, -18)}}),
    (1.5, {}),
], particles=[(0.4, "eye", "eyes", ""), (0.45, "eye", "eyes", ""), (0.4, "ember", "blade", "")])

# The Black Death — rise into the air, arms spread over the plague. HIT 3.6 s
_bd_hold = lambda k: {  # noqa: E731
    "bone18": {"p": R(0, 14 + 2 * k, 0)}, "bone7": {"r": R(-20, 0, 70 + 4 * k)}, "bone11": {"r": R(-20, 0, -70 - 4 * k)},
    "bone6": {"r": R(-10, 0, 0)}, "bone28": {"r": R(-25, 0, 0)}, "bone": {"r": R(-15 + 10 * k, 0, 0)},
    "bone2": {"r": R(0, 0, 15)}, "bone27": {"s": 1.4 + 0.3 * k},
}
anim("skill_blackdeath", 4.3, [
    (0.0, {}),
    (0.6, _bd_hold(0)), (1.0, _bd_hold(1)), (1.4, _bd_hold(0)), (1.8, _bd_hold(1)), (2.2, _bd_hold(0)),
    (2.6, _bd_hold(1)), (3.0, _bd_hold(0)), (3.3, _bd_hold(1)),
    (3.62, {"bone18": {"p": R(0, 0, 0)}, "bone7": {"r": R(15, 0, 20)}, "bone11": {"r": R(15, 0, -20)},
            "bone6": {"r": R(28, 0, 0)}, "bone28": {"r": R(15, 0, 0)}, "bone": {"r": R(15, 0, 0)},
            "bone2": {"r": R(20, 0, 0)}, "bone27": {"s": 1.2}}),
    (4.3, {}),
], particles=[(0.6, "smoke", "feet", ""), (3.62, "smoke", "feet", ""), (3.62, "souls", "gem", "")])

# Final Harvest — scythe circles overhead, then a full 360 spin. HIT 2.45 s
anim("skill_ultimate", 3.4, [
    (0.0, {}),
    (0.5, {"bone7": {"r": R(-170, 0, 5)}, "bone11": {"r": R(-10, 0, -40)}, "bone6": {"r": R(-10, 0, 0)},
           "bone28": {"r": R(-20, 0, 0)}, "bone27": {"s": 1.5}, "bone18": {"p": R(0, 2, 0)}}),
    (1.1, {"bone7": {"r": R(-165, 60, 10)}, "bone11": {"r": R(-10, 0, -45)}, "bone6": {"r": R(-10, 0, 0)},
           "bone28": {"r": R(-20, 0, 0)}, "bone27": {"s": 1.8}, "bone18": {"p": R(0, 3, 0)}}),
    (1.6, {"bone7": {"r": R(-165, -60, 10)}, "bone11": {"r": R(-10, 0, -45)}, "bone6": {"r": R(-10, 0, 0)},
           "bone28": {"r": R(-20, 0, 0)}, "bone27": {"s": 2.0}, "bone18": {"p": R(0, 3, 0)}}),
    (2.05, {"bone7": {"r": R(-160, 0, 20)}, "bone11": {"r": R(-10, 0, -45)}, "bone6": {"r": R(-8, 0, 0)},
            "bone28": {"r": R(-15, 0, 0)}, "bone27": {"s": 2.2}, "bone18": {"p": R(0, 3, 0)}}),
    (2.25, {"bone7": {"r": R(-65, 95, 0)}, "bone2": {"r": R(100, 0, 0)}, "bone11": {"r": R(-10, 0, -60)},
            "bone6": {"r": R(15, 0, 0)}, "bone28": {"r": R(5, 0, 0)}, "bone27": {"s": 1.6},
            "bone18": {"p": R(0, 0, 0), "r": R(0, 0, 0)}}),
    (2.45, {"bone7": {"r": R(-65, 95, 0)}, "bone2": {"r": R(100, 0, 0)}, "bone11": {"r": R(-10, 0, -60)},
            "bone6": {"r": R(15, 0, 0)}, "bone28": {"r": R(5, 0, 0)}, "bone27": {"s": 1.4},
            "bone18": {"r": R(0, -180, 0)}, "bone": {"r": R(-10, 0, 0)}}),
    (2.65, {"bone7": {"r": R(-65, 95, 0)}, "bone2": {"r": R(100, 0, 0)}, "bone11": {"r": R(-10, 0, -60)},
            "bone6": {"r": R(15, 0, 0)}, "bone28": {"r": R(5, 0, 0)}, "bone27": {"s": 1.2},
            "bone18": {"r": R(0, -360, 0)}, "bone": {"r": R(-10, 0, 0)}}),
    (3.4, {"bone18": {"r": R(0, -360, 0)}}),
], particles=trail([2.28, 2.34, 2.4, 2.46, 2.52, 2.58, 2.64], locator="blade_tip", effect="trail_big")
   + [(0.5, "gem", "gem", ""), (1.1, "gem", "gem", ""), (1.6, "gem", "gem", ""), (2.05, "gem", "gem", "")])

# ---------------------------------------------------------------------------
# Phase change, spawn, death
# ---------------------------------------------------------------------------

anim("phase_roar", 2.2, [
    (0.0, {}),
    (0.5, {"bone6": {"r": R(35, 0, 0)}, "bone18": {"p": R(0, -3, 0)}, "bone7": {"r": R(20, 0, 5)},
           "bone11": {"r": R(20, 0, -5)}, "bone28": {"r": R(20, 0, 0)}, "bone": {"r": R(12, 0, 0)}}),
    (1.0, {"bone6": {"r": R(-20, 0, 0)}, "bone18": {"p": R(0, 3, 0)}, "bone7": {"r": R(-60, 0, 60)},
           "bone11": {"r": R(-60, 0, -60)}, "bone28": {"r": R(-32, 0, 0)}, "bone27": {"s": 2.2},
           "bone": {"r": R(-14, 0, 0)}, "bone2": {"r": R(-20, 0, 0)}}),
    (1.3, {"bone6": {"r": R(-18, 0, 3)}, "bone18": {"p": R(0, 3, 0)}, "bone7": {"r": R(-62, 0, 62)},
           "bone11": {"r": R(-62, 0, -62)}, "bone28": {"r": R(-30, 0, 4)}, "bone27": {"s": 2.0},
           "bone": {"r": R(-12, 0, 0)}, "bone2": {"r": R(-20, 0, 0)}}),
    (1.6, {"bone6": {"r": R(-18, 0, -3)}, "bone18": {"p": R(0, 3, 0)}, "bone7": {"r": R(-60, 0, 60)},
           "bone11": {"r": R(-60, 0, -60)}, "bone28": {"r": R(-30, 0, -4)}, "bone27": {"s": 1.8},
           "bone": {"r": R(-12, 0, 0)}, "bone2": {"r": R(-20, 0, 0)}}),
    (2.2, {}),
], particles=[(1.0, "souls", "gem", ""), (1.0, "ember", "gem", ""), (1.0, "eye", "eyes", "")])

anim("spawn", 2.6, [
    (0.0, {"bone18": {"p": R(0, -44, 0)}, "bone6": {"r": R(30, 0, 0)}, "bone7": {"r": R(20, 0, 0)},
           "bone11": {"r": R(20, 0, 0)}, "bone28": {"r": R(25, 0, 0)}}),
    (1.4, {"bone18": {"p": R(0, -4, 0)}, "bone6": {"r": R(12, 0, 0)}, "bone7": {"r": R(10, 0, 10)},
           "bone11": {"r": R(10, 0, -10)}, "bone28": {"r": R(10, 0, 0)}, "bone": {"r": R(-10, 0, 0)}}),
    (1.85, {"bone18": {"p": R(0, 1, 0)}, "bone6": {"r": R(-12, 0, 0)}, "bone7": {"r": R(-30, 0, 55)},
            "bone11": {"r": R(-30, 0, -55)}, "bone28": {"r": R(-22, 0, 0)}, "bone27": {"s": 1.8},
            "bone": {"r": R(-12, 0, 0)}}),
    (2.6, {}),
], particles=[(0.0, "ash", "feet", ""), (0.5, "flames", "feet", ""), (1.85, "souls", "gem", "")])

anim("death", 1.0, [
    (0.0, {}),
    (0.25, {"bone6": {"r": R(-15, 0, 8)}, "bone28": {"r": R(-25, 0, 10)}, "bone7": {"r": R(-40, 0, 40)},
            "bone11": {"r": R(-40, 0, -40)}, "bone27": {"s": 1.8}}),
    (0.7, {"bone18": {"p": R(0, -10, 0)}, "bone6": {"r": R(45, 0, 0)}, "bone28": {"r": R(35, 0, 0)},
           "bone7": {"r": R(35, 0, 10)}, "bone2": {"r": R(70, 0, 0)}, "bone11": {"r": R(35, 0, -10)},
           "bone27": {"s": 0.6}, "bone": {"r": R(20, 0, 0)}}),
    (1.0, {"bone18": {"p": R(0, -14, 0), "s": 0.6}, "bone6": {"r": R(50, 0, 0)}, "bone28": {"r": R(40, 0, 0)},
           "bone7": {"r": R(40, 0, 10)}, "bone2": {"r": R(80, 0, 0)}, "bone11": {"r": R(40, 0, -10)},
           "bone27": {"s": 0.2}, "bone": {"r": R(22, 0, 0)}}),
], particles=[(0.25, "souls", "gem", ""), (0.6, "smoke", "gem", "")])

EXTRA_ANIMS = {
    "animation.pa_harvester.look_at_target": {
        "loop": True,
        "bones": {"bone28": {"rotation": ["math.clamp(query.target_x_rotation, -30, 30)",
                                          "math.clamp(query.target_y_rotation, -45, 45)", 0]}},
    },
}


# ---------------------------------------------------------------------------
# Building
# ---------------------------------------------------------------------------

def tracks(a):
    """{bone: {channel: [(t, [x, y, z]), ...]}} with rest values filled in."""
    touched = {}
    for _, pose in a["poses"]:
        for bone, ch in pose.items():
            touched.setdefault(bone, set()).update(ch.keys())
    out = {}
    for bone, chans in touched.items():
        out[bone] = {}
        for c in sorted(chans):
            rest = 1.0 if c == "s" else [0, 0, 0]
            keys = []
            for t, pose in a["poses"]:
                v = pose.get(bone, {}).get(c, rest)
                keys.append((t, list(v) if isinstance(v, (list, tuple)) else [v, v, v]))
            out[bone][c] = keys
    return out


def catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def sample(keys, time):
    if time <= keys[0][0]:
        return list(keys[0][1])
    if time >= keys[-1][0]:
        return list(keys[-1][1])
    for i in range(len(keys) - 1):
        t1, v1 = keys[i]
        t2, v2 = keys[i + 1]
        if t1 <= time <= t2:
            v0 = keys[i - 1][1] if i > 0 else v1
            v3 = keys[i + 2][1] if i + 2 < len(keys) else v2
            u = (time - t1) / (t2 - t1) if t2 > t1 else 0
            return [catmull(v0[k], v1[k], v2[k], v3[k], u) for k in range(3)]
    return list(keys[-1][1])


def pose_at(name, time):
    a = ANIMS[name]
    pose = {}
    for bone, chans in tracks(a).items():
        entry = {}
        if "r" in chans:
            entry["rotation"] = sample(chans["r"], time)
        if "p" in chans:
            entry["position"] = sample(chans["p"], time)
        if "s" in chans:
            entry["scale"] = sample(chans["s"], time)
        pose[bone] = entry
    return pose


def fmt(x):
    return round(float(x), 4)


def animation_json():
    anims = {}
    names = {"r": "rotation", "p": "position", "s": "scale"}
    for name, a in ANIMS.items():
        bones = {}
        for bone, chans in tracks(a).items():
            bones[bone] = {}
            for c, keys in chans.items():
                bones[bone][names[c]] = {
                    str(fmt(t)): {"post": [fmt(v) for v in val], "lerp_mode": "catmullrom"} for t, val in keys
                }
        entry = {"animation_length": a["length"], "bones": bones}
        if a["loop"]:
            entry["loop"] = True
        if a["particles"]:
            timeline = {}
            for t, effect, locator, script in a["particles"]:
                item = {"effect": effect, "locator": locator}
                if script:
                    item["pre_effect_script"] = script
                timeline.setdefault(str(fmt(t)), []).append(item)
            entry["particle_effects"] = dict(sorted(timeline.items(), key=lambda kv: float(kv[0])))
        anims["animation.pa_harvester." + name] = entry
    anims.update(EXTRA_ANIMS)
    return {"format_version": "1.8.0", "animations": anims}


SOULFIRE_BASE = [
    {"effect": "crown", "locator": "eyes"},
    {"effect": "hand_fire", "locator": "shoulder_left"},
    {"effect": "hand_fire", "locator": "shoulder_right"},
    {"effect": "hand_fire", "locator": "hand_left"},
    {"effect": "hand_fire", "locator": "hand_right"},
    {"effect": "blade_fire", "locator": "blade"},
    {"effect": "blade_fire", "locator": "blade_tip"},
    {"effect": "embers", "locator": "gem"},
]
SOULFIRE_PHASE2 = [
    {"effect": "back_fire", "locator": "back"},
    {"effect": "blade_fire", "locator": "blade_heel"},
    {"effect": "fire_smoke", "locator": "skull_top"},
]


def controllers_json():
    return {
        "format_version": "1.19.0",
        "animation_controllers": {
            "controller.animation.pa_harvester.base": {
                "states": {
                    "default": {
                        "animations": ["idle", {"move": "math.clamp(query.modified_move_speed * 3.0, 0, 1)"}],
                        "transitions": [{"dead": "!query.is_alive"}],
                        "blend_transition": 0.25,
                    },
                    "dead": {"animations": ["death"], "blend_transition": 0.1},
                },
            },
            # melee swing: variable.attack_time is set by the engine while a mob swings
            # (melee hits and, with "swing": true, ranged shots) -- no script needed
            "controller.animation.pa_harvester.attack": {
                "states": {
                    "default": {"transitions": [{"attacking": "variable.attack_time > 0 && query.is_alive"}]},
                    "attacking": {
                        "animations": ["attack"],
                        "transitions": [{"default": "query.all_animations_finished || !query.is_alive"}],
                        "blend_transition": 0.08,
                    },
                },
            },
            # Ghost Rider soul fire that never stops: the skull is a torch and fire pours off the shoulders,
            # hands, robe and scythe from the first second; below 60% health the back and the scythe heel
            # catch too and smoke rises off the skull; below 30% the skull and robe become an inferno
            "controller.animation.pa_harvester.soulfire": {
                "states": {
                    "default": {
                        "particle_effects": SOULFIRE_BASE + [{"effect": "skull_fire", "locator": "skull_top"},
                                                             {"effect": "hem", "locator": "feet"}],
                        "transitions": [{"dead": "!query.is_alive"},
                                        {"phase2": "query.max_health > 0 && query.health <= query.max_health * 0.6"}],
                    },
                    "phase2": {
                        "particle_effects": SOULFIRE_BASE + SOULFIRE_PHASE2 + [
                            {"effect": "skull_fire", "locator": "skull_top"}, {"effect": "hem", "locator": "feet"}],
                        "transitions": [{"dead": "!query.is_alive"},
                                        {"phase3": "query.health <= query.max_health * 0.3"},
                                        {"default": "query.health > query.max_health * 0.6"}],
                    },
                    "phase3": {
                        "particle_effects": SOULFIRE_BASE + SOULFIRE_PHASE2 + [
                            {"effect": "skull_fire_big", "locator": "skull_top"}, {"effect": "hem_big", "locator": "feet"}],
                        "transitions": [{"dead": "!query.is_alive"},
                                        {"phase2": "query.health > query.max_health * 0.3"}],
                    },
                    "dead": {},
                },
            },
            "controller.animation.pa_harvester.look": {
                "states": {
                    "default": {
                        "animations": ["look_at_target"],
                        "transitions": [{"dead": "!query.is_alive"}],
                    },
                    "dead": {},
                },
            },
        },
    }


CLIENT_ANIMATIONS = {
    "idle": "animation.pa_harvester.idle",
    "move": "animation.pa_harvester.move",
    "attack": "animation.pa_harvester.attack",
    "look_at_target": "animation.pa_harvester.look_at_target",
    "death": "animation.pa_harvester.death",
    "base_controller": "controller.animation.pa_harvester.base",
    "attack_controller": "controller.animation.pa_harvester.attack",
    "look_controller": "controller.animation.pa_harvester.look",
    "soulfire_controller": "controller.animation.pa_harvester.soulfire",
}


def update_client_entity(path):
    with open(path) as f:
        data = json.load(f)
    desc = data["minecraft:client_entity"]["description"]
    desc["animations"] = CLIENT_ANIMATIONS
    desc["particle_effects"] = PARTICLES
    desc["scripts"] = {"animate": ["base_controller", "attack_controller", "look_controller", "soulfire_controller"]}
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def add_locators(geo_path):
    with open(geo_path) as f:
        data = json.load(f)
    for geo in data["minecraft:geometry"]:
        for bone in geo["bones"]:
            if bone["name"] in LOCATORS:
                bone.setdefault("locators", {}).update(LOCATORS[bone["name"]])
    with open(geo_path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def build(rp_root):
    with open(os.path.join(rp_root, "animations", "pa_harvester.animation.json"), "w") as f:
        json.dump(animation_json(), f, indent=2)
        f.write("\n")
    with open(os.path.join(rp_root, "animation_controllers", "pa_harvester.animation_controllers.json"), "w") as f:
        json.dump(controllers_json(), f, indent=2)
        f.write("\n")
    add_locators(os.path.join(rp_root, "models", "entity", "pa_harvester.json"))
    update_client_entity(os.path.join(rp_root, "entity", "pa_harvester.json"))
    return sorted(ANIMS)


if __name__ == "__main__":
    root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "TheHarvesterRP")
    print(build(root))
