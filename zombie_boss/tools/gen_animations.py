"""Thêm animation chiêu mới cho Giant Zombie vào RP (giữ nguyên animation cũ).
Chạy: python3 zombie_boss/tools/gen_animations.py"""
import json, os

RP = os.path.join(os.path.dirname(__file__), "..", "ytaun_zombie_pack_resource_pack")
ANIM = os.path.join(RP, "animations", "ytaun_giant_zombie.animation.json")
ENT = os.path.join(RP, "entity", "ytaun_giant_zombie.json")
Z = [0, 0, 0]

def kf(pairs, easing=None):
    out = {}
    for t, v in pairs:
        out[f"{t:g}" if t else "0.0"] = {"post": v, "lerp_mode": "catmullrom"} if easing else v
    return out

def rot(*pairs, smooth=False):
    return {"rotation": kf(pairs, smooth)}

def anim(length, bones):
    return {"animation_length": length, "bones": bones}

N = "animation.ytaun_giant_zombie."
NEW = {
    # Giơ hai tay qua đầu rồi đập mạnh xuống đất. Va chạm ~0.85s (tick 17)
    N + "slam": anim(1.6, {
        "bone8":    rot((0, Z), (0.6, [-22, 0, 0]), (0.85, [38, 0, 0]), (1.15, [32, 0, 0]), (1.6, Z)),
        "head":     rot((0, Z), (0.6, [-20, 0, 0]), (0.85, [10, 0, 0]), (1.6, Z)),
        "rightArm": rot((0, Z), (0.6, [-165, 0, -18]), (0.85, [-35, 0, -8]), (1.15, [-30, 0, -8]), (1.6, Z)),
        "leftArm":  rot((0, Z), (0.6, [-165, 0, 18]), (0.85, [-35, 0, 8]), (1.15, [-30, 0, 8]), (1.6, Z)),
        "bone4":    rot((0, Z), (0.6, [0, 0, -20]), (0.85, [0, 0, 0]), (1.6, Z)),
        "bone6":    rot((0, Z), (0.6, [0, 0, 20]), (0.85, [0, 0, 0]), (1.6, Z)),
        "rightLeg": rot((0, Z), (0.6, [8, 0, 0]), (0.85, [-18, 0, 0]), (1.6, Z)),
        "leftLeg":  rot((0, Z), (0.6, [8, 0, 0]), (0.85, [-18, 0, 0]), (1.6, Z)),
        "waist":    {"position": kf([(0, Z), (0.6, [0, 1, 0]), (0.85, [0, -3, 0]), (1.15, [0, -2.5, 0]), (1.6, Z)])},
    }),
    # Nhặt đá, vung tay phải ra sau rồi ném. Thả đá ~0.8s (tick 16)
    N + "throw": anim(1.4, {
        "bone8":    rot((0, Z), (0.3, [15, 0, 0]), (0.6, [-18, 25, 0]), (0.8, [22, -20, 0]), (1.0, [18, -15, 0]), (1.4, Z)),
        "head":     rot((0, Z), (0.6, [-10, -15, 0]), (0.8, [5, 10, 0]), (1.4, Z)),
        "rightArm": rot((0, Z), (0.3, [20, 0, -10]), (0.6, [-175, 0, -30]), (0.8, [-55, 0, -10]), (1.0, [-30, 0, -5]), (1.4, Z)),
        "bone4":    rot((0, Z), (0.6, [0, 0, -45]), (0.8, [0, 0, 5]), (1.4, Z)),
        "leftArm":  rot((0, Z), (0.6, [-40, 0, 25]), (0.8, [20, 0, 10]), (1.4, Z)),
        "rightLeg": rot((0, Z), (0.6, [15, 0, 0]), (0.8, [-15, 0, 0]), (1.4, Z)),
        "leftLeg":  rot((0, Z), (0.6, [-20, 0, 0]), (0.8, [10, 0, 0]), (1.4, Z)),
    }),
    # Giơ tay gọi hồn, run rẩy rồi đập đất triệu hồi. Đập ~1.6s (tick 32)
    N + "summon": anim(2.2, {
        "bone8":    rot((0, Z), (0.5, [-25, 0, 0]), (0.8, [-22, 0, 3]), (1.1, [-25, 0, -3]), (1.4, [-22, 0, 3]), (1.6, [40, 0, 0]), (1.9, [35, 0, 0]), (2.2, Z)),
        "head":     rot((0, Z), (0.5, [-40, 0, 0]), (1.4, [-45, 0, 0]), (1.6, [15, 0, 0]), (2.2, Z)),
        "rightArm": rot((0, Z), (0.5, [-150, 0, -45]), (0.8, [-155, 0, -40]), (1.1, [-150, 0, -48]), (1.4, [-160, 0, -40]), (1.6, [-20, 0, -15]), (1.9, [-20, 0, -15]), (2.2, Z)),
        "leftArm":  rot((0, Z), (0.5, [-150, 0, 45]), (0.8, [-155, 0, 40]), (1.1, [-150, 0, 48]), (1.4, [-160, 0, 40]), (1.6, [-20, 0, 15]), (1.9, [-20, 0, 15]), (2.2, Z)),
        "waist":    {"position": kf([(0, Z), (1.4, [0, 1, 0]), (1.6, [0, -3, 0]), (1.9, [0, -2.5, 0]), (2.2, Z)])},
    }),
    # Giậm chân tạo gai đá. Giậm ~0.55s (tick 11)
    N + "stomp": anim(1.2, {
        "rightLeg": rot((0, Z), (0.4, [-65, 0, 5]), (0.55, [8, 0, 0]), (0.8, [5, 0, 0]), (1.2, Z)),
        "bone10":   rot((0, Z), (0.4, [55, 0, 0]), (0.55, [0, 0, 0]), (1.2, Z)),
        "bone8":    rot((0, Z), (0.4, [-12, 0, 8]), (0.55, [18, 0, 0]), (1.2, Z)),
        "head":     rot((0, Z), (0.4, [-10, 0, 0]), (0.55, [12, 0, 0]), (1.2, Z)),
        "rightArm": rot((0, Z), (0.4, [-30, 0, -35]), (0.55, [15, 0, -10]), (1.2, Z)),
        "leftArm":  rot((0, Z), (0.4, [-30, 0, 35]), (0.55, [15, 0, 10]), (1.2, Z)),
        "waist":    {"position": kf([(0, Z), (0.4, [0, 1.5, 0]), (0.55, [0, -2, 0]), (0.8, [0, -1, 0]), (1.2, Z)])},
    }),
    # Biến hình cuồng nộ: co người rồi bung ra gầm. Bung ~1.2s (tick 24)
    N + "enrage": anim(2.4, {
        "bone8":    rot((0, Z), (0.7, [38, 0, 0]), (1.0, [42, 0, 0]), (1.2, [-32, 0, 0]), (2.0, [-28, 0, 0]), (2.4, Z)),
        "head":     rot((0, Z), (0.7, [30, 0, 0]), (1.2, [-55, 0, 0]), (1.4, [-50, 5, 0]), (1.6, [-55, -5, 0]), (1.8, [-50, 5, 0]), (2.0, [-55, 0, 0]), (2.4, Z)),
        "rightArm": rot((0, Z), (0.7, [-20, 0, 25]), (1.0, [-25, 0, 30]), (1.2, [-110, 0, -75]), (2.0, [-115, 0, -70]), (2.4, Z)),
        "leftArm":  rot((0, Z), (0.7, [-20, 0, -25]), (1.0, [-25, 0, -30]), (1.2, [-110, 0, 75]), (2.0, [-115, 0, 70]), (2.4, Z)),
        "bone4":    rot((0, Z), (0.7, [0, 0, 40]), (1.2, [0, 0, -30]), (2.4, Z)),
        "bone6":    rot((0, Z), (0.7, [0, 0, -40]), (1.2, [0, 0, 30]), (2.4, Z)),
        "rightLeg": rot((0, Z), (0.7, [-20, 20, 0]), (1.2, [0, 15, 0]), (2.4, Z)),
        "leftLeg":  rot((0, Z), (0.7, [-20, -20, 0]), (1.2, [0, -15, 0]), (2.4, Z)),
        "waist":    {"position": kf([(0, Z), (0.7, [0, -3, 0]), (1.0, [0, -3.5, 0]), (1.2, [0, 1, 0]), (2.0, [0, 0.5, 0]), (2.4, Z)])},
    }),
    # Nghiêng người thở độc ra xung quanh. ~0.6s bắt đầu phun
    N + "breath": anim(2.0, {
        "bone8":    rot((0, Z), (0.5, [-20, 0, 0]), (0.8, [25, 0, 0]), (1.7, [22, 0, 0]), (2.0, Z)),
        "head":     rot((0, Z), (0.5, [-35, 0, 0]), (0.8, [20, 0, 0]), (1.1, [20, 25, 0]), (1.4, [20, -25, 0]), (1.7, [20, 0, 0]), (2.0, Z)),
        "rightArm": rot((0, Z), (0.5, [20, 0, -20]), (0.8, [-20, 0, -40]), (1.7, [-20, 0, -40]), (2.0, Z)),
        "leftArm":  rot((0, Z), (0.5, [20, 0, 20]), (0.8, [-20, 0, 40]), (1.7, [-20, 0, 40]), (2.0, Z)),
    }),
}
for a in NEW.values():
    a["loop"] = False

data = json.load(open(ANIM))
data["animations"].update(NEW)
json.dump(data, open(ANIM, "w"), indent=2)

ent = json.load(open(ENT))
anims = ent["minecraft:client_entity"]["description"]["animations"]
for full in NEW:
    anims[full.split(".")[-1]] = full
json.dump(ent, open(ENT, "w"), indent=2)
print("added", len(NEW), "animations")
