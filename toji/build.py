"""Generate textures/icons, the 3D model and package the addon into dist/TojiInvertedSpear.mcaddon.

Run: python3 build.py
"""
import os
import shutil
import struct
import zipfile
import zlib

import model
import particles
import player_anims

ROOT = os.path.dirname(os.path.abspath(__file__))

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


def make_images():
    """Inventory and pack icons are rendered from the 3D model into art/ by model.py."""
    art = os.path.join(ROOT, "art")
    targets = {
        "item_icon.png": ["TojiRP/textures/items/inverted_spear.png"],
        "pack_icon.png": ["TojiRP/pack_icon.png", "TojiBP/pack_icon.png"],
    }
    for source, destinations in targets.items():
        for destination in destinations:
            path = os.path.join(ROOT, destination)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            shutil.copyfile(os.path.join(art, source), path)


def build_addon():
    out = os.path.join(ROOT, "dist/TojiInvertedSpear.mcaddon")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in ("TojiBP", "TojiRP"):
            for folder, _, files in os.walk(os.path.join(ROOT, pack)):
                for name in sorted(files):
                    full = os.path.join(folder, name)
                    zf.write(full, os.path.relpath(full, ROOT))
    print("Built", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    model.write_model(ROOT, write_png)
    make_images()
    player_anims.write_player_animations(ROOT)
    particles.write_particles(ROOT, write_png)
    build_addon()
