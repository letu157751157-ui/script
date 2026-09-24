"""Tạo texture/icon và đóng gói addon thành dist/AatroxDarkinBlade.mcaddon.

Chạy: python3 build.py
"""
import os
import struct
import zipfile
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))

BLADE = (150, 10, 25, 255)
EDGE = (235, 60, 60, 255)
EYE = (255, 200, 60, 255)
GUARD = (60, 10, 15, 255)
HANDLE = (90, 50, 30, 255)
OUTLINE = (25, 0, 5, 255)


def sword_pixels():
    """Kiếm 16x16 chéo từ góc dưới trái lên góc trên phải."""
    grid = [[(0, 0, 0, 0)] * 16 for _ in range(16)]

    def put(x, y, color):
        if 0 <= x < 16 and 0 <= y < 16:
            grid[y][x] = color

    for i in range(6, 15):  # lưỡi kiếm, rộng 2-3 px
        put(i, 15 - i, EDGE)
        put(i - 1, 15 - i, BLADE)
        put(i, 16 - i, BLADE)
        put(i - 1, 16 - i, OUTLINE if i < 14 else BLADE)
    put(9, 7, EYE)  # "con mắt" Darkin trên lưỡi
    for k in range(-2, 3):  # chắn kiếm vuông góc với lưỡi
        put(5 + k, 10 + k, GUARD)
    put(8, 7, EYE)
    for i in range(2, 5):  # chuôi
        put(i, 15 - i, HANDLE)
    put(1, 14, GUARD)  # núm chuôi
    return grid


def scale(grid, factor):
    return [[px for px in row for _ in range(factor)] for row in grid for _ in range(factor)]


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
    sword = sword_pixels()
    write_png(os.path.join(ROOT, "AatroxRP/textures/items/darkin_blade.png"), sword)
    icon = scale(sword, 4)
    write_png(os.path.join(ROOT, "AatroxRP/pack_icon.png"), icon)
    write_png(os.path.join(ROOT, "AatroxBP/pack_icon.png"), icon)


def build_addon():
    out = os.path.join(ROOT, "dist/AatroxDarkinBlade.mcaddon")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in ("AatroxBP", "AatroxRP"):
            for folder, _, files in os.walk(os.path.join(ROOT, pack)):
                for name in sorted(files):
                    full = os.path.join(folder, name)
                    zf.write(full, os.path.relpath(full, ROOT))
    print("Đã tạo", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    make_images()
    build_addon()
