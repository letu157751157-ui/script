"""Preview images for the README: boss poses per skill and the particle sprite sheet."""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

import animations
import art
from render import Model, render, to_image

HERE = os.path.dirname(os.path.abspath(__file__))
RP = os.path.join(os.path.dirname(HERE), "TheHarvesterRP")

BG = (38, 42, 50, 255)
TILE_BG = (54, 60, 72, 255)

# (label, animation, time, yaw)
SKILL_POSES = [
    ("Idle", "idle", 1.5, 30),
    ("Reaping Arc (wind-up)", "skill_reap", 0.58, 20),
    ("Reaping Arc (sweep)", "skill_reap", 0.78, 20),
    ("Plague Flask", "skill_flask", 0.3, -30),
    ("Murder of Crows", "skill_crows", 0.7, 10),
    ("Death's Step", "skill_ambush", 0.4, 35),
    ("Pestilence Nova", "skill_nova", 0.6, 25),
    ("Graves of the Plagued", "skill_summon", 0.95, 40),
    ("Soul Harvest", "skill_drain", 1.1, -25),
    ("Death Sentence", "skill_sentence", 0.8, 40),
    ("The Black Death", "skill_blackdeath", 1.6, 15),
    ("Final Harvest", "skill_ultimate", 2.4, 30),
    ("Phase change", "phase_roar", 1.2, 20),
    ("Rise from the grave", "spawn", 1.3, 30),
    ("Melee chop", "attack", 0.16, 30),
    ("Death", "death", 0.7, 30),
]

# how grayscale sprites are tinted in game (representative colours)
TINTS = {
    "miasma": (168, 201, 74), "splash": (168, 201, 74), "ring": (124, 255, 212),
    "rune_circle": (168, 201, 74), "tile": (90, 255, 204), "spark": (124, 255, 212), "drop": (140, 180, 58),
    "wave": (168, 201, 74),
}


def load_model():
    geo = json.load(open(os.path.join(RP, "models/entity/pa_harvester.json")))["minecraft:geometry"][0]
    return Model(geo, Image.open(os.path.join(RP, "textures/entity/pamobile/pa_harvester.png")))


def skills_sheet(path, cols=4):
    model = load_model()
    w, h = 300, 330
    rows = (len(SKILL_POSES) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * w, rows * h), BG)
    for i, (label, name, t, yaw) in enumerate(SKILL_POSES):
        pose = animations.pose_at(name, t)
        img, _ = render([(model, model.faces(pose))], size=(w - 8, h - 30), scale=3.3, yaw=yaw, pitch=-8,
                        center=(0, 33, 0), background=TILE_BG)
        tile = to_image(img)
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
