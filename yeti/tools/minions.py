"""New Yeti minions ("đệ"): Frost Wolf, Frost Wraith, Frost Golem.

For each minion this generates, in the style of the vanilla game:
- geometry (format 1.12.0, box UV auto-packed into the texture)
- a pixel-art texture painted per cube face with a limited palette, top faces lit, bottom faces shaded,
  positional dither (like bedrock/model.py), eyes and glowing ice cores painted on the front faces
- animations: looping walk/idle driven by Molang, and skill animations played by the script
  (scripts/yeti/minions.js): wolf pounce/bite, wraith cast/slash, golem slam/punch
- the client entity, the behavior entity (vanilla AI components), a loot table, spawn egg and names

Models face -Z like every Bedrock entity, feet at y = 0, units are pixels (16 = 1 block).
"""
import json
import math
import os

from animations import Anim

ZERO = (0, 0, 0)


def hash01(x, y, salt=0):
    n = (x * 374761393 + y * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


# ---------------------------------------------------------------- palettes (dark -> light)

PALETTES = {
    "fur": [(126, 150, 178), (170, 192, 214), (206, 222, 238), (230, 240, 250), (248, 252, 255)],
    "fur_blue": [(64, 92, 138), (92, 124, 170), (124, 158, 200), (158, 190, 226), (190, 216, 240)],
    "ice": [(52, 104, 178), (78, 140, 210), (110, 178, 234), (150, 212, 248), (206, 240, 255)],
    "ice_dark": [(28, 56, 112), (40, 78, 146), (58, 104, 178), (82, 134, 204), (118, 170, 226)],
    "snow": [(176, 190, 206), (206, 218, 230), (228, 236, 244), (242, 247, 252), (255, 255, 255)],
    "crystal": [(92, 184, 236), (130, 214, 250), (170, 234, 255), (210, 248, 255), (250, 255, 255)],
    "robe": [(30, 50, 100), (44, 72, 132), (62, 98, 164), (88, 132, 196), (196, 232, 255)],
    "core": [(90, 220, 255), (140, 240, 255), (190, 250, 255), (230, 255, 255), (255, 255, 255)],
}
EYE = (120, 255, 250)
EYE_CORE = (235, 255, 255)
VOID = (10, 14, 30)
NOSE = (36, 44, 66)
BASE_SHADE = {"top": 3, "north": 2, "south": 2, "east": 2, "west": 2, "bottom": 1}


def material_color(mat, face, x, y, w, h):
    """Color of pixel (x, y) on a face of size w x h made of `mat`, or None for a transparent pixel."""
    pal = PALETTES[mat.split(":")[0]]
    shade = BASE_SHADE[face]
    n = hash01(x + w * 7, y + h * 13, sum(map(ord, mat)))
    if mat == "ice" or mat == "ice_dark":
        if (x % 4 == 0 and y % 5 != 2) or (y % 5 == 0):   # block seams
            shade -= 1
        if n > 0.93:
            shade += 2                                      # frost sparkle
        elif n < 0.12:
            shade -= 1
    elif mat.startswith("fur"):
        if (x + (y // 2)) % 3 == 0 and n > 0.4:            # fur strands
            shade -= 1
        if n > 0.9:
            shade += 1
    elif mat == "snow":
        if n < 0.2:
            shade -= 1
    elif mat == "crystal":
        shade = 4 if x == 0 else (3 if x < w / 2 else 1)
        if face in ("top",):
            shade = 4
    elif mat.startswith("robe"):
        shade = 2 if x % 3 else 1                           # cloth folds
        if y < 2 and face != "top":
            shade += 1
        if y == h - 1 and face not in ("top", "bottom"):
            shade = 4                                       # frost on the hem
        if mat == "robe:tatter" and face != "top":
            if face == "bottom":
                return None
            ragged = h - 1 - y < 1 + int(hash01(x, 3, 91) * 4)  # torn hem
            if ragged:
                return None
    elif mat == "core":
        cx, cy = (w - 1) / 2, (h - 1) / 2
        shade = 4 if abs(x - cx) + abs(y - cy) < 1.2 else 2
    if face == "bottom":
        shade -= 1
    return pal[max(0, min(4, shade))]


# ---------------------------------------------------------------- models

def cube(origin, size, mat, decal=None):
    return {"origin": list(origin), "size": list(size), "mat": mat, "decal": decal}


def eyes(positions, glow=True):
    """Decal painting glowing eyes on the north (front) face at (x, y) texel positions."""
    def paint(face, x, y, w, h):
        if face != "north":
            return None
        if (x, y) in positions:
            return EYE_CORE if glow and y == min(py for _, py in positions) else EYE
        return None
    return paint


def hood_face(face, x, y, w, h):
    if face != "north":
        return None
    if y == 4 and x in (2, 3, w - 4, w - 3):
        return EYE_CORE
    if y == 5 and x in (2, 3, w - 4, w - 3):
        return EYE
    if 1 <= x <= w - 2 and 2 <= y <= h - 1:
        return VOID
    return None


def snout_face(face, x, y, w, h):
    if face == "north" and y == 0:
        return NOSE
    return None


MINIONS = {
    "frost_wolf": {
        "name": "Frost Wolf", "egg": ("#DDEBF7", "#4F8FD6"),
        "texture": (64, 64), "scale": 1.15, "collision": (0.8, 1.0),
        "health": 24, "attack": 4, "speed": 0.36, "knockback_resistance": 0.2, "xp": 8,
        "bones": [
            {"name": "body", "pivot": [0, 10, 0], "cubes": [
                cube((-3.5, 6.5, -5), (7, 7, 13), "fur"),
                cube((-4.5, 6, -6), (9, 9, 5), "fur")]},
            {"name": "spine", "parent": "body", "pivot": [0, 13.5, 0], "cubes": [
                cube((-1, 13.5, -4), (2, 3, 2), "crystal"),
                cube((-1, 13.5, -0.5), (2, 4, 2), "crystal"),
                cube((-1, 13.5, 3), (2, 3, 2), "crystal")]},
            {"name": "head", "parent": "body", "pivot": [0, 12, -6], "cubes": [
                cube((-3, 9.5, -12), (6, 6, 6), "fur", eyes({(1, 2), (4, 2)})),
                cube((-1.5, 9.5, -15), (3, 3, 3), "fur_blue", snout_face),
                cube((-3, 15.5, -9), (2, 2, 1), "fur_blue"),
                cube((1, 15.5, -9), (2, 2, 1), "fur_blue")]},
            {"name": "leg_fr", "parent": "body", "pivot": [-2.5, 7, -3.5], "cubes": [cube((-3.5, 0, -4.5), (2, 7, 2), "fur_blue")]},
            {"name": "leg_fl", "parent": "body", "pivot": [2.5, 7, -3.5], "cubes": [cube((1.5, 0, -4.5), (2, 7, 2), "fur_blue")]},
            {"name": "leg_br", "parent": "body", "pivot": [-2.5, 7, 6], "cubes": [cube((-3.5, 0, 5), (2, 7, 2), "fur_blue")]},
            {"name": "leg_bl", "parent": "body", "pivot": [2.5, 7, 6], "cubes": [cube((1.5, 0, 5), (2, 7, 2), "fur_blue")]},
            {"name": "tail", "parent": "body", "pivot": [0, 12, 8], "rotation": [25, 0, 0], "cubes": [
                cube((-1, 11, 8), (2, 2, 7), "fur"),
                cube((-0.5, 11.5, 15), (1, 1, 2), "crystal")]},
        ],
    },
    "frost_wraith": {
        "name": "Frost Wraith", "egg": ("#23355E", "#8FE8FF"),
        "texture": (128, 64), "scale": 1.0, "collision": (0.7, 2.0),
        "health": 18, "attack": 3, "speed": 0.3, "knockback_resistance": 0.0, "xp": 10,
        "bones": [
            {"name": "body", "pivot": [0, 16, 0], "cubes": [
                cube((-4, 14, -2.5), (8, 10, 5), "robe"),
                cube((-5, 21, -3), (10, 3, 6), "robe"),
                cube((-1.5, 17, -3), (3, 4, 1), "core")]},
            {"name": "skirt", "parent": "body", "pivot": [0, 14, 0], "cubes": [
                cube((-4.5, 8, -3), (9, 6, 6), "robe"),
                cube((-5.5, 2, -3.5), (11, 6, 7), "robe:tatter")]},
            {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": [
                cube((-4.5, 24, -4.5), (9, 9, 9), "robe", hood_face),
                cube((-2, 33, -1.5), (4, 2, 4), "robe"),
                cube((-3.5, 33, 1), (1, 3, 1), "crystal"),
                cube((2.5, 33, 1), (1, 3, 1), "crystal"),
                cube((-0.5, 35, 0), (1, 3, 1), "crystal")]},
            {"name": "arm_r", "parent": "body", "pivot": [-5.5, 23, 0], "cubes": [
                cube((-7, 12, -1.5), (2, 11, 3), "robe"),
                cube((-7, 9, -1.5), (2, 3, 3), "ice")]},
            {"name": "arm_l", "parent": "body", "pivot": [5.5, 23, 0], "cubes": [
                cube((5, 12, -1.5), (2, 11, 3), "robe"),
                cube((5, 9, -1.5), (2, 3, 3), "ice")]},
        ],
    },
    "frost_golem": {
        "name": "Frost Golem", "egg": ("#6FB6EA", "#E9F6FF"),
        "texture": (128, 64), "scale": 1.3, "collision": (1.2, 1.95),
        "health": 70, "attack": 9, "speed": 0.22, "knockback_resistance": 0.8, "xp": 20,
        "bones": [
            {"name": "body", "pivot": [0, 14, 0], "cubes": [
                cube((-6, 14, -4), (12, 12, 8), "ice"),
                cube((-5, 12, -3), (10, 3, 6), "ice_dark"),
                cube((-2, 19, -5), (4, 4, 1), "core"),
                cube((-8, 24, -3), (4, 4, 6), "snow"),
                cube((4, 24, -3), (4, 4, 6), "snow"),
                cube((-7.5, 28, -1), (2, 4, 2), "crystal"),
                cube((5.5, 28, -1), (2, 4, 2), "crystal"),
                cube((-1, 24, 3), (2, 5, 2), "crystal")]},
            {"name": "head", "parent": "body", "pivot": [0, 26, -2], "cubes": [
                cube((-3, 26, -5), (6, 5, 5), "ice", eyes({(1, 2), (4, 2)})),
                cube((-3.5, 29.5, -5.5), (7, 1, 2), "ice_dark")]},
            {"name": "arm_r", "parent": "body", "pivot": [-7, 25, 0], "cubes": [
                cube((-10, 14, -2.5), (4, 11, 5), "ice"),
                cube((-10.5, 8, -3), (5, 6, 6), "ice_dark")]},
            {"name": "arm_l", "parent": "body", "pivot": [7, 25, 0], "cubes": [
                cube((6, 14, -2.5), (4, 11, 5), "ice"),
                cube((5.5, 8, -3), (5, 6, 6), "ice_dark")]},
            {"name": "leg_r", "parent": "body", "pivot": [-3, 14, 0], "cubes": [cube((-5.5, 0, -2.5), (5, 14, 5), "ice")]},
            {"name": "leg_l", "parent": "body", "pivot": [3, 14, 0], "cubes": [cube((0.5, 0, -2.5), (5, 14, 5), "ice")]},
        ],
    },
}


# ---------------------------------------------------------------- texture packing + painting

def box_size(size):
    w, h, d = (int(math.ceil(s)) for s in size)
    return 2 * (d + w), d + h


def pack(bones, tex_w, tex_h):
    """Shelf-pack every cube's box UV into the texture; returns cubes with 'uv' set."""
    x = y = shelf = 0
    for bone in bones:
        for c in bone["cubes"]:
            bw, bh = box_size(c["size"])
            if x + bw > tex_w:
                x, y, shelf = 0, y + shelf, 0
            assert y + bh <= tex_h, f"texture too small for {bone['name']}"
            c["uv"] = [x, y]
            x += bw
            shelf = max(shelf, bh)


def face_rects(c):
    u, v = c["uv"]
    w, h, d = (int(math.ceil(s)) for s in c["size"])
    return {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }


def paint(bones, tex_w, tex_h):
    img = [[(0, 0, 0, 0)] * tex_w for _ in range(tex_h)]
    for bone in bones:
        for c in bone["cubes"]:
            for face, (fu, fv, fw, fh) in face_rects(c).items():
                for y in range(fh):
                    for x in range(fw):
                        color = c["decal"](face, x, y, fw, fh) if c["decal"] else None
                        if color is None:
                            color = material_color(c["mat"], face, x, y, fw, fh)
                        if color is not None:
                            img[fv + y][fu + x] = (*color, 255)
    return img


def geometry(ident, spec):
    bones = []
    for b in spec["bones"]:
        out = {"name": b["name"], "pivot": b["pivot"]}
        if "parent" in b:
            out["parent"] = b["parent"]
        if "rotation" in b:
            out["rotation"] = b["rotation"]
        out["cubes"] = [{"origin": c["origin"], "size": c["size"], "uv": c["uv"]} for c in b["cubes"]]
        bones.append(out)
    tw, th = spec["texture"]
    return {"description": {"identifier": f"geometry.ytaun.{ident}", "texture_width": tw, "texture_height": th,
                            "visible_bounds_width": 3, "visible_bounds_height": 3.5, "visible_bounds_offset": [0, 1.5, 0]},
            "bones": bones}


# ---------------------------------------------------------------- animations

WALK = "math.cos(q.modified_distance_moved * 38.17) * {a}"
WALK_NEG = "-math.cos(q.modified_distance_moved * 38.17) * {a}"


def minion_animations():
    anims = {}
    # ---- Frost Wolf
    anims["animation.ytaun.frost_wolf.walk"] = {"loop": True, "bones": {
        "leg_fr": {"rotation": [WALK.format(a=55), 0, 0]}, "leg_bl": {"rotation": [WALK.format(a=55), 0, 0]},
        "leg_fl": {"rotation": [WALK_NEG.format(a=55), 0, 0]}, "leg_br": {"rotation": [WALK_NEG.format(a=55), 0, 0]},
        "head": {"rotation": ["math.sin(q.modified_distance_moved * 38.17) * 4", 0, 0]},
        "tail": {"rotation": [0, "math.sin(q.modified_distance_moved * 20) * 15", 0]},
    }}
    anims["animation.ytaun.frost_wolf.idle"] = {"loop": True, "bones": {
        "tail": {"rotation": [0, "math.sin(q.life_time * 300) * 10", 0]},
        "body": {"scale": [1, "1 + math.sin(q.life_time * 180) * 0.015", 1]},
    }}
    a = Anim(0.7)
    a.key(0.15, {"body": {"r": (-22, 0, 0), "p": (0, 1, 0)}, "leg_fr": {"r": (-70, 0, 0)}, "leg_fl": {"r": (-70, 0, 0)},
                 "leg_br": {"r": (45, 0, 0)}, "leg_bl": {"r": (45, 0, 0)}, "head": {"r": (-15, 0, 0)}})
    a.key(0.4, {"body": {"r": (14, 0, 0), "p": (0, 0, 0)}, "leg_fr": {"r": (-20, 0, 0)}, "leg_fl": {"r": (-20, 0, 0)},
                "leg_br": {"r": (20, 0, 0)}, "leg_bl": {"r": (20, 0, 0)}, "head": {"r": (20, 0, 0)}})
    anims["animation.ytaun.frost_wolf.pounce"] = a.to_json()
    a = Anim(0.35)
    a.key(0.12, {"head": {"r": (25, 0, 0), "p": (0, 0, -1)}, "body": {"r": (6, 0, 0)}})
    anims["animation.ytaun.frost_wolf.bite"] = a.to_json()

    # ---- Frost Wraith (floats: bobbing body, swaying sleeves and torn robe)
    anims["animation.ytaun.frost_wraith.float"] = {"loop": True, "bones": {
        "body": {"position": [0, "2 + math.sin(q.life_time * 160) * 1.2", 0]},
        "skirt": {"rotation": ["math.sin(q.life_time * 160 + 40) * 6", 0, "math.cos(q.life_time * 110) * 3"]},
        "arm_r": {"rotation": ["math.sin(q.life_time * 120) * 8", 0, "8 + math.cos(q.life_time * 140) * 5"]},
        "arm_l": {"rotation": ["-math.sin(q.life_time * 120) * 8", 0, "-8 - math.cos(q.life_time * 140) * 5"]},
    }}
    anims["animation.ytaun.frost_wraith.move"] = {"loop": True, "bones": {
        "body": {"rotation": [12, 0, 0]}, "skirt": {"rotation": [18, 0, 0]},
    }}
    a = Anim(0.9)
    a.key(0.35, {"arm_r": {"r": (-150, 0, 15)}, "arm_l": {"r": (-150, 0, -15)}, "head": {"r": (-15, 0, 0)}, "body": {"r": (-8, 0, 0)}})
    a.key(0.5, {"arm_r": {"r": (-85, 0, 8)}, "arm_l": {"r": (-85, 0, -8)}, "head": {"r": (5, 0, 0)}, "body": {"r": (8, 0, 0)}})
    anims["animation.ytaun.frost_wraith.cast"] = a.to_json()
    a = Anim(0.45)
    a.key(0.15, {"arm_r": {"r": (-130, 25, 20)}, "body": {"r": (0, 15, 0)}})
    a.key(0.28, {"arm_r": {"r": (-40, -20, -10)}, "body": {"r": (6, -15, 0)}})
    anims["animation.ytaun.frost_wraith.slash"] = a.to_json()

    # ---- Frost Golem (heavy, slow steps)
    anims["animation.ytaun.frost_golem.walk"] = {"loop": True, "bones": {
        "leg_r": {"rotation": ["math.cos(q.modified_distance_moved * 22) * 28", 0, 0]},
        "leg_l": {"rotation": ["-math.cos(q.modified_distance_moved * 22) * 28", 0, 0]},
        "arm_r": {"rotation": ["-math.cos(q.modified_distance_moved * 22) * 16", 0, 0]},
        "arm_l": {"rotation": ["math.cos(q.modified_distance_moved * 22) * 16", 0, 0]},
        "body": {"rotation": [0, 0, "math.cos(q.modified_distance_moved * 22) * 3"]},
    }}
    anims["animation.ytaun.frost_golem.idle"] = {"loop": True, "bones": {
        "body": {"position": [0, "math.sin(q.life_time * 90) * 0.3", 0]},
        "arm_r": {"rotation": [0, 0, "math.sin(q.life_time * 90) * 2"]},
        "arm_l": {"rotation": [0, 0, "-math.sin(q.life_time * 90) * 2"]},
    }}
    a = Anim(1.3)
    a.key(0.5, {"arm_r": {"r": (-168, 0, 10)}, "arm_l": {"r": (-168, 0, -10)}, "body": {"r": (-18, 0, 0)}, "head": {"r": (-15, 0, 0)}})
    a.key(0.7, {"arm_r": {"r": (-45, 0, 4)}, "arm_l": {"r": (-45, 0, -4)}, "body": {"r": (35, 0, 0), "p": (0, -2, 0)},
                "head": {"r": (15, 0, 0)}, "leg_r": {"r": (-20, 0, 0)}, "leg_l": {"r": (-20, 0, 0)}})
    a.key(0.95, {"arm_r": {"r": (-35, 0, 6)}, "arm_l": {"r": (-35, 0, -6)}, "body": {"r": (25, 0, 0), "p": (0, -1.5, 0)}})
    anims["animation.ytaun.frost_golem.slam"] = a.to_json()
    a = Anim(0.5)
    a.key(0.15, {"arm_r": {"r": (-20, 0, 0)}, "body": {"r": (0, 20, 0)}})
    a.key(0.28, {"arm_r": {"r": (-100, 0, -10)}, "body": {"r": (10, -20, 0)}})
    anims["animation.ytaun.frost_golem.punch"] = a.to_json()
    return anims


LOOK = "animation.common.look_at_target"


def client_entity(ident, spec):
    base = f"animation.ytaun.{ident}"
    if ident == "frost_wolf":
        anims = {"look_at_target": LOOK, "walk": f"{base}.walk", "idle": f"{base}.idle"}
        animate = ["look_at_target", {"walk": "q.modified_move_speed"}, "idle"]
    elif ident == "frost_wraith":
        anims = {"look_at_target": LOOK, "float": f"{base}.float", "move": f"{base}.move"}
        animate = ["look_at_target", "float", {"move": "q.modified_move_speed"}]
    else:
        anims = {"look_at_target": LOOK, "walk": f"{base}.walk", "idle": f"{base}.idle"}
        animate = ["look_at_target", {"walk": "q.modified_move_speed"}, "idle"]
    base_color, overlay = spec["egg"]
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"ytaun:{ident}",
        "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/entity/minions/{ident}"},
        "geometry": {"default": f"geometry.ytaun.{ident}"},
        "animations": anims,
        "scripts": {"animate": animate},
        "render_controllers": ["controller.render.default"],
        "spawn_egg": {"base_color": base_color, "overlay_color": overlay},
    }}}


PREY = ["player", "villager", "wandering_trader", "irongolem", "snowgolem", "wolf", "cat", "fox"]


def behavior_entity(ident, spec):
    w, h = spec["collision"]
    components = {
        "minecraft:type_family": {"family": ["monster", "ice", "yeti_minion", "mob"]},
        "minecraft:health": {"value": spec["health"], "max": spec["health"]},
        "minecraft:attack": {"damage": spec["attack"], "effect_name": "slowness", "effect_duration": 3},
        "minecraft:collision_box": {"width": w, "height": h},
        "minecraft:scale": {"value": spec["scale"]},
        "minecraft:movement": {"value": spec["speed"]},
        "minecraft:movement.basic": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True, "can_jump": True},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:follow_range": {"value": 32, "max": 32},
        "minecraft:knockback_resistance": {"value": spec["knockback_resistance"]},
        "minecraft:nameable": {},
        "minecraft:experience_reward": {"on_death": f"query.last_hit_by_player ? {spec['xp']} : 0"},
        "minecraft:loot": {"table": f"loot_tables/entities/ytaun_{ident}.json"},
        "minecraft:despawn": {"despawn_from_distance": {"min_distance": 64, "max_distance": 128}},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"},
                                                 {"cause": "freezing", "deals_damage": "no"}]},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.hurt_by_target": {"priority": 1, "entity_types": {"filters": {
            "test": "is_family", "subject": "other", "operator": "!=", "value": "ice"}}},
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 2, "must_see": False, "reselect_targets": True, "within_radius": 24,
            "entity_types": [{"filters": {"any_of": [{"test": "is_family", "subject": "other", "value": f} for f in PREY]},
                              "max_dist": 24}]},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.25, "track_target": True,
                                            "reach_multiplier": 1.6 if ident == "frost_golem" else 1.2},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8},
        "minecraft:behavior.random_look_around": {"priority": 8},
    }
    return {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": f"ytaun:{ident}", "is_spawnable": True, "is_summonable": True},
        "components": components}}


LOOT = {
    "frost_wolf": [("ytaun:yeti_fur", 0, 1, 1), ("minecraft:snowball", 0, 2, 1)],
    "frost_wraith": [("minecraft:snowball", 1, 3, 1), ("minecraft:packed_ice", 0, 1, 1)],
    "frost_golem": [("minecraft:packed_ice", 1, 3, 1), ("ytaun:rawicesteel", 0, 1, 1)],
}


def loot_table(ident):
    return {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": name, "weight": weight,
                                                "functions": [{"function": "set_count", "count": {"min": lo, "max": hi}}]}]}
                      for name, lo, hi, weight in LOOT[ident]]}


LANG_BEGIN = "## --- Yeti minions (generated by tools/minions.py) ---"
LANG_END = "## --- end Yeti minions ---"


def write_minions(bp_root, rp_root, write_png):
    geos = []
    for ident, spec in MINIONS.items():
        tw, th = spec["texture"]
        pack(spec["bones"], tw, th)
        write_png(os.path.join(rp_root, f"textures/entity/minions/{ident}.png"), paint(spec["bones"], tw, th))
        geos.append(geometry(ident, spec))
        write_json(os.path.join(rp_root, f"entity/ytaun_{ident}.entity.json"), client_entity(ident, spec))
        write_json(os.path.join(bp_root, f"entities/ytaun_{ident}.json"), behavior_entity(ident, spec))
        write_json(os.path.join(bp_root, f"loot_tables/entities/ytaun_{ident}.json"), loot_table(ident))
    write_json(os.path.join(rp_root, "models/entity/yeti_minions.geo.json"),
               {"format_version": "1.12.0", "minecraft:geometry": geos})
    write_json(os.path.join(rp_root, "animations/yeti_minions.animation.json"),
               {"format_version": "1.8.0", "animations": minion_animations()})

    lang_path = os.path.join(rp_root, "texts/en_US.lang")
    text = open(lang_path, encoding="utf-8").read()
    if LANG_BEGIN in text:
        text = text[:text.index(LANG_BEGIN)] + text[text.index(LANG_END) + len(LANG_END) + 1:]
    lines = [LANG_BEGIN]
    for ident, spec in MINIONS.items():
        lines.append(f"entity.ytaun:{ident}.name=§b{spec['name']}")
        lines.append(f"item.spawn_egg.entity.ytaun:{ident}.name=Spawn §b{spec['name']}")
    lines.append(LANG_END)
    with open(lang_path, "w", encoding="utf-8") as f:
        f.write(text.rstrip("\n") + "\n" + "\n".join(lines) + "\n")
    print(f"Minions: {', '.join(MINIONS)}")


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
