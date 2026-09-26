"""Fix the arm / head joints of the Yeti boss models (run once; safe to re-run).

Problems in the original rigs:
- phase 1-2: the "elbow" bone (bone17 / bone26) sits at the shoulder and also holds the upper arm,
  while the real elbow is bone87 / bone76, so bending the elbow bent the whole arm;
- phase 3 / death: the elbow pivot is off to the side (x = -11.7 instead of the arm's centre);
- every model: the hand bone (bone16 / bone21) pivots at the fingertips, so turning the wrist tore
  the hand off the forearm;
- the skull (bone45) pivots 9 pixels behind the head.

The fix inserts clean joint bones with pivots computed from the cubes:
  arm0 (shoulder R) -> bone75 (shoulder pad + upper arm) + elbow_r -> forearm + wrist_r -> claws (+ club)
  arm1 (shoulder L) -> bone18 (shoulder pad + upper arm) + elbow_l -> forearm + wrist_l -> claws
elbow = bottom of the upper-arm cube, centred on it; wrist = bottom of the forearm cube, centred on it.
Cube-holding bones are only moved between bones that have no rest rotation, so the rest pose
(what you see in Blockbench) does not change. The emptied old joint bones are removed.
For phase 1-2 the club arm gets a rest pose that carries the club on the shoulder.
"""
import collections
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, "boss-YETI_resource_pack", "models", "entity")

# rest pose of the club arm (phase 1-2): forearm raised, club resting back over the shoulder
CLUB_REST = {"arm0": [-15, 0, 5], "elbow_r": [-100, 0, 0], "wrist_r": [-45, 0, 0]}


def load(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    data = json.loads(raw, object_pairs_hook=collections.OrderedDict)
    if "minecraft:geometry" in data:
        geo = data["minecraft:geometry"][0]
    else:
        geo = data[[k for k in data if k.startswith("geometry")][0]]
    return raw, data, geo


def subtree(bones, root):
    out = []
    for name in bones:
        q = name
        while q and q != root:
            q = bones[q].get("parent")
        if q == root:
            out.append(name)
    return out


def cube_bounds(bone):
    lo, hi = [1e9] * 3, [-1e9] * 3
    for c in bone.get("cubes", []):
        for i in range(3):
            lo[i] = min(lo[i], c["origin"][i])
            hi[i] = max(hi[i], c["origin"][i] + c["size"][i])
    return lo, hi


def rest_rotated(bones, name):
    r = bones[name].get("rotation")
    return bool(r) and any(abs(v) > 1e-6 for v in r)


def fix_arm(geo, bones, side, shoulder, upper_holder, upper_cube, forearm_cube, forearm_extra, claws, club):
    elbow, wrist = f"elbow_{side}", f"wrist_{side}"
    if elbow in bones:
        return False
    lo, hi = cube_bounds(bones[upper_cube])
    elbow_pivot = [round((lo[0] + hi[0]) / 2, 3), round(lo[1] + 0.5, 3), round((lo[2] + hi[2]) / 2, 3)]
    lo, hi = cube_bounds(bones[forearm_cube])
    wrist_pivot = [round((lo[0] + hi[0]) / 2, 3), round(lo[1] + 0.5, 3), round((lo[2] + hi[2]) / 2, 3)]

    # every bone we bypass must have no rest rotation, otherwise moving children would change the pose
    moved = [upper_cube, forearm_cube] + forearm_extra + claws + ([club] if club else [])
    for name in moved:
        chain = bones[name].get("parent")
        while chain and chain != shoulder:
            assert not rest_rotated(bones, chain), (side, name, chain)
            chain = bones[chain].get("parent")

    old_parents = {bones[n].get("parent") for n in moved}
    bones[upper_cube]["parent"] = upper_holder
    new_bones = [
        collections.OrderedDict([("name", elbow), ("parent", shoulder), ("pivot", elbow_pivot)]),
        collections.OrderedDict([("name", wrist), ("parent", elbow), ("pivot", wrist_pivot)]),
    ]
    for name in [forearm_cube] + forearm_extra:
        bones[name]["parent"] = elbow
    for name in claws + ([club] if club else []):
        bones[name]["parent"] = wrist
    # keep the locator of the hand on the wrist bone
    for name in list(old_parents):
        if name and "locators" in bones[name]:
            new_bones[1]["locators"] = bones[name].pop("locators")
    idx = next(i for i, b in enumerate(geo["bones"]) if b["name"] == shoulder)
    geo["bones"][idx + 1:idx + 1] = new_bones
    bones[elbow], bones[wrist] = new_bones
    return True


def remove_empty(geo, bones, names):
    for name in names:
        if name not in bones:
            continue
        b = bones[name]
        children = [n for n, c in bones.items() if c.get("parent") == name]
        if b.get("cubes") or children or b.get("locators") or rest_rotated(bones, name):
            continue
        geo["bones"] = [x for x in geo["bones"] if x["name"] != name]
        del bones[name]


def fix_model(path, club):
    raw, data, geo = load(path)
    bones = {b["name"]: b for b in geo["bones"]}
    changed = False
    right_claws = [n for n in ("bone11", "bone12", "bone13", "bone15", "bone82") if n in bones]
    changed |= fix_arm(geo, bones, "r", "arm0", "bone75", "bone4", "bone9", ["bone10"], right_claws,
                       "bone80" if "bone80" in bones else None)
    if "bone94" in bones:
        bones["bone94"]["parent"] = "bone75"
    left_forearm = [n for n in ("bone88", "bone27") if n in bones]
    changed |= fix_arm(geo, bones, "l", "arm1", "bone18", "bone20", "bone76", left_forearm,
                       [n for n in ("bone22", "bone23", "bone24", "bone25") if n in bones], None)
    remove_empty(geo, bones, ["bone16", "bone87", "bone17", "bone21", "bone26"])
    # skull pivot: back of the head instead of 9 px behind it (only when it has no rest rotation)
    if not rest_rotated(bones, "bone45"):
        bones["bone45"]["pivot"] = [0, 44.5, -10.5]
    if club:
        for name, rot in CLUB_REST.items():
            bones[name]["rotation"] = rot
    indent = 2 if raw.startswith('{\n  "') else 4
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, indent=indent, ensure_ascii=False) + ("\n" if raw.endswith("\n") else ""))
    return changed


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        MODELS = sys.argv[1]
    for name, club in (("ytaun_yeti_1", True), ("ytaun_yeti_2", True), ("ytaun_yeti_3", False), ("ytaun_yeti_death", False)):
        print(name, "fixed" if fix_model(os.path.join(MODELS, name + ".json"), club) else "already fixed")
