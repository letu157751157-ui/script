"""Build The Harvester addon.

  python3 build.py              regenerate particles + animations, validate, package dist/*.mcaddon
  python3 build.py --previews   also re-render the preview images in previews/

Needs Python 3 with Pillow and numpy (pip install pillow numpy).
"""
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import animations  # noqa: E402
import cleanup  # noqa: E402
import particles  # noqa: E402

BP = os.path.join(ROOT, "TheHarvesterBP")
RP = os.path.join(ROOT, "TheHarvesterRP")
VERSION = "1.4.0"
OUT = os.path.join(ROOT, "dist", "TheHarvester_v%s.mcaddon" % VERSION)

BUILTIN_VARS = {"particle_age", "particle_lifetime", "emitter_age", "emitter_lifetime"} | {
    "%s_random_%d" % (k, i) for k in ("particle", "emitter") for i in range(1, 5)}


def load(path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def validate():
    errors = []
    particle_vars = {}
    for name in os.listdir(os.path.join(RP, "particles")):
        path = os.path.join(RP, "particles", name)
        text = open(path, encoding="utf-8").read()
        data = json.loads(text)
        desc = data["particle_effect"]["description"]
        texture = desc["basic_render_parameters"]["texture"]
        if not os.path.exists(os.path.join(RP, texture + ".png")) and not os.path.exists(os.path.join(RP, texture + ".tga")):
            errors.append("%s: texture %s missing" % (name, texture))
        particle_vars[desc["identifier"]] = {
            m for m in re.findall(r"\b(?:v|variable)\.([a-z_0-9]+)", text) if m not in BUILTIN_VARS}

    client = load(os.path.join(RP, "entity", "pa_harvester.json"))["minecraft:client_entity"]["description"]
    anim_file = load(os.path.join(RP, "animations", "pa_harvester.animation.json"))["animations"]
    controllers = load(os.path.join(RP, "animation_controllers", "pa_harvester.animation_controllers.json"))["animation_controllers"]
    for short, full in client["animations"].items():
        if full not in anim_file and full not in controllers:
            errors.append("client entity: %s -> %s not defined" % (short, full))
    for short, pid in client.get("particle_effects", {}).items():
        if pid not in particle_vars:
            errors.append("client entity particle %s -> %s missing" % (short, pid))
    for cname, ctrl in controllers.items():
        for sname, st in ctrl["states"].items():
            for a in st.get("animations", []):
                key = a if isinstance(a, str) else next(iter(a))
                if key not in client["animations"]:
                    errors.append("%s/%s uses unknown animation %s" % (cname, sname, key))

    # geometry locators used by animation particles
    geo = load(os.path.join(RP, "models", "entity", "pa_harvester.json"))["minecraft:geometry"][0]
    locators = {name for b in geo["bones"] for name in b.get("locators", {})}
    bones = {b["name"] for b in geo["bones"]}
    for aname, a in anim_file.items():
        for bone in a.get("bones", {}):
            if bone not in bones:
                errors.append("%s animates missing bone %s" % (aname, bone))
        for t, items in a.get("particle_effects", {}).items():
            for item in items if isinstance(items, list) else [items]:
                short = item["effect"]
                if short not in client.get("particle_effects", {}):
                    errors.append("%s @%s: particle %s not in client entity" % (aname, t, short))
                    continue
                if item.get("locator") and item["locator"] not in locators:
                    errors.append("%s @%s: locator %s missing" % (aname, t, item["locator"]))
                need = particle_vars[client["particle_effects"][short]]
                given = set(re.findall(r"\b(?:v|variable)\.([a-z_0-9]+)\s*=", item.get("pre_effect_script", "")))
                for var in need - given:
                    errors.append("%s @%s: %s reads v.%s which is never set" % (aname, t, short, var))

    # scripts reference only existing particles / animations
    for script in ("harvester.js", "harvester_scythe.js"):
        text = open(os.path.join(BP, "scripts", script), encoding="utf-8").read()
        for pid in set(re.findall(r'"(harvester:[a-z_]+)"', text)):
            if pid not in particle_vars:
                errors.append("%s: particle %s missing" % (script, pid))
        for short in set(re.findall(r'play\(boss, "([a-z_]+)"', text)) | set(re.findall(r'"animation\.pa_harvester\.([a-z_]+)"', text)):
            if "animation.pa_harvester." + short not in anim_file:
                errors.append("%s: animation %s missing" % (script, short))
    return errors


def check_manifest(errors):
    manifest = load(os.path.join(BP, "manifest.json"))
    server = next(d["version"] for d in manifest["dependencies"] if d.get("module_name") == "@minecraft/server")
    # 1.14.0 has no playerInteractWithEntity/Block before-events: main.js would fail to load
    if tuple(int(x) for x in server.split(".")) < (1, 15, 0):
        errors.append("manifest: @minecraft/server %s is too old (need 1.15.0+)" % server)
    for pack in (BP, RP):
        version = load(os.path.join(pack, "manifest.json"))["header"]["version"]
        if ".".join(map(str, version)) != VERSION:
            errors.append("%s manifest version %s != %s" % (os.path.basename(pack), version, VERSION))


def package():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    for old in os.listdir(os.path.dirname(OUT)):
        if old.endswith(".mcaddon") and old != os.path.basename(OUT):
            os.remove(os.path.join(os.path.dirname(OUT), old))
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in ("TheHarvesterBP", "TheHarvesterRP"):
            for folder, _, files in sorted(os.walk(os.path.join(ROOT, pack))):
                for name in sorted(files):
                    full = os.path.join(folder, name)
                    zf.write(full, os.path.relpath(full, ROOT))
    print("Built", os.path.relpath(OUT, ROOT), "(%.1f MB)" % (os.path.getsize(OUT) / 1e6))


if __name__ == "__main__":
    names = particles.build(RP)
    print(len(names), "particles")
    print(len(animations.build(RP)), "animations")
    problems = validate()
    check_manifest(problems)
    problems += ["leftover file: %s (%s)" % (cleanup.rel(f), why) for f, why in sorted(cleanup.junk.items())]
    if problems:
        print("VALIDATION FAILED:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("Validation OK")
    if "--previews" in sys.argv:
        import previews
        previews.render_all(os.path.join(ROOT, "previews"))
    package()
