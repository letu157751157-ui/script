"""List (or delete with --apply) files that nothing in The Harvester addon uses.

Leftovers of the "A chaotic world" pack this addon was cut from: mobs, items, sounds, models and
textures that do not exist here, plus editor files. Kept content: the Harvester boss, the Harvester
Scythe, the Dark Knight set and the other items in BP/items.

build.py runs this as a check: a clean pack lists 0 files.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "TheHarvesterBP")
RP = os.path.join(ROOT, "TheHarvesterRP")


def load(path):
    try:
        with open(path, encoding="utf-8-sig") as f:
            return json.load(f)
    except Exception:
        return None


def rel(path):
    return os.path.relpath(path, ROOT)


items = {load(f)["minecraft:item"]["description"]["identifier"] for f in glob.glob(BP + "/items/*.json")}
EXIST = items | {"pa:harvester"}


def pa_ids(text):
    return set(re.findall(r"pa:[a-z0-9_]+", text))


junk = {}

# --- editor leftovers
for name in (".data", ".error"):
    if os.path.exists(os.path.join(BP, name)):
        junk[os.path.join(BP, name)] = "AddOns Maker project/error file, not used by Minecraft"

# --- scripts: everything main.js no longer imports
KEEP_SCRIPTS = {"main.js", "item_trigger.js", "durability_manager.js", "armor.js", "harvester.js", "harvester_scythe.js"}
for f in glob.glob(BP + "/scripts/**/*.js", recursive=True):
    if os.path.relpath(f, BP + "/scripts") not in KEEP_SCRIPTS:
        junk[f] = "script for mobs/items not in this pack (or not Bedrock code)"

# --- functions: keep item helpers of existing items, the scythe effect and the give-all list
for f in glob.glob(BP + "/functions/*.mcfunction"):
    name = os.path.basename(f)[:-11]
    text = open(f, encoding="utf-8").read()
    base = name[:-7] if name.endswith("_effect") else name
    owner = base.replace("pa_", "pa:", 1) if base.startswith("pa_") else None
    if name == "A_chaotic_world_(beta)_":
        continue
    if owner in EXIST and text.strip() and pa_ids(text) <= EXIST:
        continue
    junk[f] = "empty" if not text.strip() else "function for content not in this pack"

# --- BP data for missing entities / items
# the Yeti fur block (6 identical 1024x1024 textures, no recipe, nothing drops it)
for f in glob.glob(BP + "/blocks/*.json") + glob.glob(BP + "/loot_tables/blocks/*.json"):
    junk[f] = "Yeti fur block (leftover, not part of this addon)"
for name in ("blocks.json", "textures/terrain_texture.json"):
    if os.path.exists(os.path.join(RP, name)):
        junk[os.path.join(RP, name)] = "only lists the Yeti fur block"
for f in glob.glob(BP + "/loot_tables/entities/*.json"):
    if os.path.basename(f) != "pa_harvester.json":
        junk[f] = "loot table of a mob not in this pack"
for f in glob.glob(BP + "/spawn_rules/*.json"):
    if os.path.basename(f) != "pa_harvester.json":
        junk[f] = "spawn rule of a mob not in this pack"
for f in glob.glob(BP + "/trades/**/*.json", recursive=True):
    junk[f] = "trades of a mob not in this pack"
for f in glob.glob(BP + "/animation_controllers/*.json"):
    junk[f] = "not attached to any entity (never runs)"
for f in glob.glob(BP + "/recipes/*.json"):
    missing = pa_ids(open(f, encoding="utf-8").read()) - EXIST
    if missing:
        junk[f] = "recipe uses missing " + ", ".join(sorted(missing))

# --- resource pack: what the kept content references
kept_json = [RP + "/entity/pa_harvester.json"] + glob.glob(RP + "/attachables/*.json")
kept_text = "".join(open(f, encoding="utf-8").read() for f in kept_json)
geometries = set(re.findall(r"geometry\.[A-Za-z0-9_.]+", kept_text))
for f in glob.glob(RP + "/models/**/*.json", recursive=True):
    data = load(f) or {}
    ids = {g["description"]["identifier"] for g in data.get("minecraft:geometry", [])}
    ids |= {k for k in data if k.startswith("geometry.")}
    if not ids & geometries:
        junk[f] = "model of something not in this pack"

for f in glob.glob(RP + "/particles/*.json"):
    if not os.path.basename(f).startswith("harvester_"):
        junk[f] = "particle only used by removed content"
for f in glob.glob(RP + "/textures/pa_particles/*"):
    junk[f] = "texture of removed particles"
for f in glob.glob(RP + "/animation_controllers/*.json"):
    if os.path.basename(f) != "pa_harvester.animation_controllers.json":
        junk[f] = "controllers of other mobs (enderman file overrides vanilla endermen)"
for f in glob.glob(RP + "/render_controllers/*.json"):
    if os.path.basename(f) != "large_item.render_controllers.json":
        junk[f] = "render controller of other content (player file overrides vanilla player rendering)"
for f in glob.glob(RP + "/materials/*.material"):
    junk[f] = "materials of other addons (particles.material overrides vanilla particle shaders)"
for f in glob.glob(RP + "/sounds/mob/**/*", recursive=True):
    if os.path.isfile(f):
        junk[f] = "sound of a mob not in this pack"
for name in ("sounds/sound_definitions.json", "sounds.json", "textures/flipbook_textures.json"):
    f = os.path.join(RP, name)
    if os.path.exists(f):
        junk[f] = "only lists sounds/flipbooks of content not in this pack"

# textures: keep what kept JSON, item_texture entries of kept items and terrain textures reference
item_textures = load(RP + "/textures/item_texture.json")
icon_keys = set()
for f in glob.glob(BP + "/items/*.json"):
    icon = load(f)["minecraft:item"]["components"].get("minecraft:icon")
    icon_keys.add(icon if isinstance(icon, str) else (icon or {}).get("texture") or (icon or {}).get("textures", {}).get("default"))
tex_refs = set(re.findall(r"textures/[A-Za-z0-9_/.\-]+", kept_text))
for key in icon_keys:
    entry = item_textures["texture_data"].get(key)
    if entry:
        tex = entry["textures"]
        tex_refs |= set(tex if isinstance(tex, list) else [tex])
tex_refs.add("textures/particle/harvester_particles")
for f in glob.glob(RP + "/textures/**/*", recursive=True):
    if not os.path.isfile(f) or f.endswith(".json"):
        continue
    stem = os.path.splitext(os.path.relpath(f, RP))[0]
    if stem not in tex_refs:
        junk[f] = "texture of something not in this pack"

if __name__ == "__main__":
    apply = "--apply" in sys.argv
    by_reason = {}
    for f, reason in sorted(junk.items()):
        by_reason.setdefault(reason, []).append(rel(f))
    for reason, files in by_reason.items():
        print("%3d  %s" % (len(files), reason))
        if "-v" in sys.argv:
            for f in files:
                print("       ", f)
    print("TOTAL", len(junk), "files,", "%.1f MB" % (sum(os.path.getsize(f) for f in junk) / 1e6))
    print("icon keys kept:", sorted(k for k in icon_keys if k))
    if apply:
        for f in junk:
            os.remove(f)
        for folder in (BP, RP):
            for dirpath, dirnames, filenames in sorted(os.walk(folder), reverse=True):
                if not os.listdir(dirpath):
                    os.rmdir(dirpath)
        print("deleted")
