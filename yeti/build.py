"""Generate the Yeti particles, animations and minions, then package dist/boss-YETI_v<major>_<minor>.mcaddon.

Run: python3 build.py            release build: NEW UUIDs for both packs + version +1 (2.1 -> 2.2 -> ...)
     python3 build.py --no-bump  rebuild the current version (same UUIDs), for testing

Every release gets fresh UUIDs and a higher version so Minecraft never mixes it up with an
older copy of the pack it has cached (worlds must remove the old pack and add the new one).
"""
import glob
import json
import os
import re
import struct
import sys
import uuid
import zipfile
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import animations  # noqa: E402
import minions  # noqa: E402
import particles  # noqa: E402
import preview_anim  # noqa: E402

BP = "boss-YETI_behavior_pack"
RP = "boss-YETI_resource_pack"


def write_png(path, grid):
    height, width = len(grid), len(grid[0])
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in grid)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


def write_preview():
    """Particle atlas scaled up 3x on a dark background, for the README (preview_particles.png)."""
    atlas = particles.build_atlas()
    scale, used_h = 3, 96
    bg = (24, 30, 44, 255)
    rows = []
    for y in range(used_h * scale):
        src = atlas[y // scale]
        rows.append([src[x // scale] if src[x // scale][3] else bg for x in range(particles.ATLAS * scale)])
    write_png(os.path.join(ROOT, "preview_particles.png"), rows)


def release(bump):
    """New UUIDs + version bump in both manifests (when bump), returns the version list."""
    paths = {pack: os.path.join(ROOT, pack, "manifest.json") for pack in (BP, RP)}
    manifests = {pack: json.load(open(path, encoding="utf-8")) for pack, path in paths.items()}
    version = manifests[BP]["header"]["version"]
    if bump:
        version = [version[0], version[1] + 1, 0]
        heads = {pack: str(uuid.uuid4()) for pack in (BP, RP)}
        for pack, other in ((BP, RP), (RP, BP)):
            m = manifests[pack]
            m["header"]["uuid"] = heads[pack]
            for module in m["modules"]:
                module["uuid"] = str(uuid.uuid4())
            for dep in m["dependencies"]:
                if "uuid" in dep:
                    dep["uuid"] = heads[other]
    for m in manifests.values():
        m["header"]["version"] = list(version)
        m["header"]["description"] = re.sub(r"^Boss Yeti v[\d.]+", f"Boss Yeti v{version[0]}.{version[1]}",
                                            m["header"]["description"])
        for module in m["modules"]:
            module["version"] = list(version)
        for dep in m["dependencies"]:
            if "uuid" in dep:
                dep["version"] = list(version)
    for pack, path in paths.items():
        with open(path, "w", encoding="utf-8") as f:
            json.dump(manifests[pack], f, indent=2, ensure_ascii=False)
            f.write("\n")
    with open(os.path.join(ROOT, BP, "scripts/yeti/version.js"), "w", encoding="utf-8") as f:
        f.write("// Tự động ghi bởi build.py mỗi lần đóng gói (đừng sửa tay).\n")
        f.write(f'export const VERSION = "{version[0]}.{version[1]}.{version[2]}";\n')
    return version


def build_addon(version):
    name = f"boss-YETI_v{version[0]}_{version[1]}.mcaddon"
    out = os.path.join(ROOT, "dist", name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for old in glob.glob(os.path.join(ROOT, "dist", "*.mcaddon")):
        if os.path.basename(old) != name:
            os.remove(old)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in (BP, RP):
            for folder, dirs, files in os.walk(os.path.join(ROOT, pack)):
                dirs.sort()
                for name_ in sorted(files):
                    full = os.path.join(folder, name_)
                    zf.write(full, os.path.relpath(full, ROOT))
    readme = os.path.join(ROOT, "README.md")
    text = open(readme, encoding="utf-8").read()
    text = re.sub(r"dist/boss-YETI_v\d+_\d+\.mcaddon", f"dist/{name}", text)
    text = re.sub(r"bật bản \*\*[\d.]+\*\*", f"bật bản **{version[0]}.{version[1]}.{version[2]}**", text)
    with open(readme, "w", encoding="utf-8") as f:
        f.write(text)
    print("Built", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    version = release(bump="--no-bump" not in sys.argv)
    print("Version", ".".join(map(str, version)))
    particles.write_particles(os.path.join(ROOT, RP), write_png)
    animations.write_animations(os.path.join(ROOT, RP))
    minions.write_minions(os.path.join(ROOT, BP), os.path.join(ROOT, RP), write_png)
    write_preview()
    preview_anim.write_preview(write_png)
    preview_anim.write_minion_preview(write_png, minions.minion_animations())
    build_addon(version)
