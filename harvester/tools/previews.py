"""Preview images for the README: boss poses per skill and the particle sprite sheet."""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

import animations
import art
from render import Model, locator_world, project, render, to_image

HERE = os.path.dirname(os.path.abspath(__file__))
RP = os.path.join(os.path.dirname(HERE), "TheHarvesterRP")

BG = (38, 42, 50, 255)
TILE_BG = (54, 60, 72, 255)

# (label, animation, time, yaw)
SKILL_POSES = [
    # (label, animation, time, yaw, phase of the soul fire drawn on him)
    ("Idle", "idle", 1.5, 30, 1),
    ("Reaping Arc", "skill_reap", 0.78, 20, 1),
    ("Field of Souls (stab)", "skill_field", 0.9, 30, 1),
    ("Field of Souls (reap)", "skill_field", 1.72, 20, 1),
    ("Will-o'-the-Wisps", "skill_wisps", 0.5, 25, 1),
    ("Candles of the Dead", "skill_candles", 0.85, 20, 1),
    ("Plague Pyre", "skill_pyre", 1.45, 30, 2),
    ("Footsteps of the Dead", "skill_trail", 0.45, 35, 2),
    ("Buried Alive", "skill_coffin", 0.75, 25, 2),
    ("Death Sentence", "skill_sentence", 0.8, 40, 3),
    ("Danse Macabre", "skill_danse", 0.8, 25, 3),
    ("The Black Death", "skill_blackdeath", 1.6, 15, 3),
    ("Final Harvest", "skill_ultimate", 2.4, 30, 3),
    ("Phase change", "phase_roar", 1.2, 20, 2),
    ("Melee chop", "attack", 0.16, 30, 1),
    ("Death", "death", 0.7, 30, 0),
]

# how grayscale sprites are tinted in game (representative colours)
TINTS = {
    "smoke": (28, 74, 68), "ring": (29, 233, 182), "wave": (29, 233, 182),
    "sigil": (29, 233, 182), "tile": (29, 233, 182),
}

LOC = {name: (bone, pos) for bone, locs in animations.LOCATORS.items() for name, pos in locs.items()}


def soul_fire(model, pose, phase):
    """Where the looping soulfire_* emitters burn in that phase: (world point, size, tall flame?)."""
    if phase == 0:
        return []  # the fire goes out when he dies
    at = lambda name: locator_world(model, pose, *LOC[name])  # noqa: E731
    points = []
    feet = at("feet")
    n, ring = (12, 13) if phase < 3 else (16, 16)
    for k in range(n):
        a = k / n * 2 * np.pi
        points.append((feet + np.array([np.cos(a) * ring, 1 + (k % 3) * 3, np.sin(a) * ring]), 1.1 if phase < 3 else 1.4, False))
    top = at("skull_top")
    big = 1.0 if phase < 3 else 1.3
    for k in range(11):  # the skull torch: a blaze of tall flames at every height
        a = k * 2.4
        r = 5.5 * (1 - k / 14)
        points.append((top + np.array([np.cos(a) * r, k * 1.7, np.sin(a) * r]), big * (1.15 - k * 0.04), True))
    eyes = at("eyes")
    for k in range(6):  # flames licking up around the face
        a = k / 6 * 2 * np.pi
        points.append((eyes + np.array([np.cos(a) * 8, 2 + (k % 2) * 3, np.sin(a) * 8 + 6]), 0.8, False))
    for name in ("shoulder_left", "shoulder_right", "hand_left", "hand_right", "blade", "blade_tip"):
        points.append((at(name) + np.array([0, 2, 0]), 0.75, False))
    if phase >= 2:
        points += [(at("back") + np.array([0, 5, 0]), 0.9, True), (at("blade_heel") + np.array([0, 2, 0]), 0.75, False)]
    return points


def draw_fire(tile, zbuf, points, size, scale, yaw, pitch, center):
    from render import rot_matrix
    view = rot_matrix(pitch, yaw, 0)
    view_center = np.array([-center[0], center[1], center[2]], dtype=float)
    for i, (p, k, tall) in enumerate(points):
        x, y = project(p, size, scale, yaw, pitch, center)
        depth = (view @ (p - view_center))[2]
        ix, iy = int(x), int(y)
        if 0 <= ix < size[0] and 0 <= iy < size[1] and zbuf[iy, ix] < depth - 3:
            continue  # behind the body
        frames = art.SPRITES["flame_tall" if tall else "flame"]
        w = int(18 * k)
        h = w * 2 if tall else w
        im = Image.fromarray(frames[(i * 3) % len(frames)], "RGBA").resize((w, h), Image.NEAREST)
        tile.alpha_composite(im, (int(x - w / 2), int(y - h * 0.85)))


def load_model():
    geo = json.load(open(os.path.join(RP, "models/entity/pa_harvester.json")))["minecraft:geometry"][0]
    return Model(geo, Image.open(os.path.join(RP, "textures/entity/pamobile/pa_harvester.png")))


def skills_sheet(path, cols=4):
    model = load_model()
    w, h = 300, 330
    rows = (len(SKILL_POSES) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * w, rows * h), BG)
    for i, (label, name, t, yaw, phase) in enumerate(SKILL_POSES):
        pose = animations.pose_at(name, t)
        size, scale, center = (w - 8, h - 30), 3.3, (0, 33, 0)
        img, zbuf = render([(model, model.faces(pose))], size=size, scale=scale, yaw=yaw, pitch=-8,
                           center=center, background=TILE_BG)
        tile = to_image(img)
        draw_fire(tile, zbuf, soul_fire(model, pose, phase), size, scale, yaw, -8, center)
        x, y = (i % cols) * w, (i // cols) * h
        sheet.paste(tile, (x + 4, y + 26))
        ImageDraw.Draw(sheet).text((x + 8, y + 8), label, fill=(230, 255, 245, 255))
    sheet.save(path)


def particles_sheet(path):
    items = []
    for name, frames in art.SPRITES.items():
        tinted = []
        for f in frames:
            f = f.astype(np.float32)
            if name in TINTS:
                f[..., :3] = f[..., :3] * np.array(TINTS[name]) / 255.0
            tinted.append(f.astype(np.uint8))
        items.append((name, tinted))
    cols_w = 1000
    x = y = 8
    row_h = 0
    placements = []
    def scale_of(frames):
        return 6 if max(frames[0].shape[:2]) <= 16 else 4 if max(frames[0].shape[:2]) <= 32 else 2

    for name, frames in items:
        scale = scale_of(frames)
        fw = sum(f.shape[1] * scale + 4 for f in frames)
        fh = max(f.shape[0] for f in frames) * scale + 18
        if x + fw > cols_w:
            x, y = 8, y + row_h + 8
            row_h = 0
        placements.append((name, frames, x, y))
        x += fw + 16
        row_h = max(row_h, fh)
    sheet = Image.new("RGBA", (cols_w, y + row_h + 8), BG)
    draw = ImageDraw.Draw(sheet)
    for name, frames, px, py in placements:
        draw.text((px, py), name, fill=(230, 255, 245, 255))
        cx = px
        scale = scale_of(frames)
        for f in frames:
            im = Image.fromarray(f, "RGBA").resize((f.shape[1] * scale, f.shape[0] * scale), Image.NEAREST)
            bg = Image.new("RGBA", im.size, TILE_BG)
            bg.alpha_composite(im)
            sheet.paste(bg, (cx, py + 14))
            cx += im.width + 4
    sheet.save(path)


def render_all(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    skills_sheet(os.path.join(out_dir, "skills.png"))
    particles_sheet(os.path.join(out_dir, "particles.png"))
    print("Previews written to", os.path.relpath(out_dir))


if __name__ == "__main__":
    render_all(os.path.join(os.path.dirname(HERE), "previews"))
