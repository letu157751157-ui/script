"""Generate the Yeti ice particles and skill animations, then package dist/boss-YETI_v2_0.mcaddon.

Run: python3 build.py
"""
import os
import struct
import sys
import zipfile
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import animations  # noqa: E402
import particles  # noqa: E402
import preview_anim  # noqa: E402

BP = "boss-YETI_behavior_pack"
RP = "boss-YETI_resource_pack"
OUT = "dist/boss-YETI_v2_0.mcaddon"


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


def build_addon():
    out = os.path.join(ROOT, OUT)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in (BP, RP):
            for folder, dirs, files in os.walk(os.path.join(ROOT, pack)):
                dirs.sort()
                for name in sorted(files):
                    full = os.path.join(folder, name)
                    zf.write(full, os.path.relpath(full, ROOT))
    print("Built", OUT)


if __name__ == "__main__":
    particles.write_particles(os.path.join(ROOT, RP), write_png)
    animations.write_animations(os.path.join(ROOT, RP))
    write_preview()
    preview_anim.write_preview(write_png)
    build_addon()
