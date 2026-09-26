"""Build the Boss Yeti addon: generate the new particles + skill animations, validate references,
then package dist/boss-YETI_v<version>.mcaddon.

Run:  python3 yeti/tools/build.py        (needs Pillow: pip install pillow)
"""
import glob
import json
import os
import re
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BP = os.path.join(ROOT, "boss-YETI_behavior_pack")
RP = os.path.join(ROOT, "boss-YETI_resource_pack")
sys.path.insert(0, HERE)

import animations  # noqa: E402
import particles  # noqa: E402

VANILLA_PARTICLES = {
    "minecraft:snowflake_particle", "minecraft:ice_evaporation_particle", "minecraft:ice_evaporation_emitter",
    "minecraft:huge_explosion_emitter", "minecraft:blue_flame_particle", "minecraft:basic_crack_particle",
    "minecraft:bleach", "minecraft:critical_hit_emitter", "minecraft:villager_happy", "minecraft:heart_particle",
    "minecraft:totem_particle",
}


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def validate():
    errors, warnings = [], []
    for path in glob.glob(os.path.join(ROOT, "boss-YETI_*", "**", "*.json"), recursive=True):
        try:
            load_json(path)
        except Exception as e:  # noqa: BLE001
            errors.append(f"invalid JSON {os.path.relpath(path, ROOT)}: {e}")

    particle_ids = {}
    for path in glob.glob(os.path.join(RP, "particles", "*.json")):
        data = load_json(path)["particle_effect"]
        particle_ids[data["description"]["identifier"]] = json.dumps(data)
        tex = data["description"]["basic_render_parameters"]["texture"]
        if not os.path.exists(os.path.join(RP, tex + ".png")):
            errors.append(f"missing texture {tex} for {data['description']['identifier']}")

    anim_ids = set()
    for path in glob.glob(os.path.join(RP, "animations", "*.json")):
        anim_ids |= set(load_json(path)["animations"])

    scripts = ""
    for path in glob.glob(os.path.join(BP, "scripts", "**", "*.js"), recursive=True):
        with open(path, encoding="utf-8") as f:
            scripts += f.read()
    for pid in sorted(set(re.findall(r"'((?:ytaun|snow|minecraft):[a-z_]+)'", scripts))):
        if pid.startswith("minecraft:") and pid not in VANILLA_PARTICLES:
            continue  # entity / effect ids
        if pid.startswith("ytaun:") and pid not in particle_ids:
            continue  # entity ids such as ytaun:yeti_1
        if pid not in particle_ids and pid not in VANILLA_PARTICLES:
            errors.append(f"script uses unknown particle {pid}")
    for name in sorted(set(re.findall(r"'(animation\.[a-z0-9_.]+)'", scripts))):
        if name not in anim_ids:
            errors.append(f"script uses unknown animation {name}")
    for path in glob.glob(os.path.join(RP, "entity", "*.json")):
        desc = load_json(path)["minecraft:client_entity"]["description"]
        for short, full in desc.get("animations", {}).items():
            if full.startswith("animation.") and full not in anim_ids and not full.startswith("animation.common"):
                # only a warning: the original ice spike entity lists a few unused vanilla-style animations
                warnings.append(f"{os.path.basename(path)} references unknown animation {full}")
    return errors, warnings


def version():
    v = load_json(os.path.join(BP, "manifest.json"))["header"]["version"]
    return "_".join(str(x) for x in v)


def build_addon():
    out = os.path.join(ROOT, "dist", f"boss-YETI_v{version()}.mcaddon")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in ("boss-YETI_behavior_pack", "boss-YETI_resource_pack"):
            for folder, _, files in sorted(os.walk(os.path.join(ROOT, pack))):
                for name in sorted(files):
                    full = os.path.join(folder, name)
                    zf.write(full, os.path.relpath(full, ROOT))
    return out


if __name__ == "__main__":
    atlas, fx_ids = particles.write_particles(RP)
    particles.write_preview(os.path.join(ROOT, "preview_particles.png"), atlas)
    print("particles:", ", ".join(fx_ids))
    _, anim_ids = animations.write_animations(RP)
    print("animations:", ", ".join(anim_ids))
    problems, notes = validate()
    for note in notes:
        print("warning:", note)
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    print("built", os.path.relpath(build_addon(), ROOT))
