"""Render contact sheets of every boss animation (previews/anim_<name>.png)."""
import json
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import animations  # noqa: E402
from render import Model, render, to_image, locator_world, project  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
RP = os.path.join(os.path.dirname(HERE), "TheHarvesterRP")


def load_model():
    geo = json.load(open(os.path.join(RP, "models/entity/pa_harvester.json")))["minecraft:geometry"][0]
    return Model(geo, Image.open(os.path.join(RP, "textures/entity/pamobile/pa_harvester.png")))


def sheet(model, name, times, yaw=35, size=(230, 300), scale=3.4, locators=True):
    tiles = []
    for t in times:
        pose = animations.pose_at(name, t)
        img, _ = render([(model, model.faces(pose))], size=size, scale=scale, yaw=yaw, pitch=-8,
                        center=(0, 30, 0), background=(52, 58, 70, 255))
        im = to_image(img)
        d = ImageDraw.Draw(im)
        d.text((6, 4), "%s  %.2fs" % (name, t), fill=(255, 255, 255, 255))
        if locators:
            for t0, effect, loc, _ in animations.ANIMS[name]["particles"]:
                if abs(t0 - t) < 0.021:
                    bone = next(b for b, locs in animations.LOCATORS.items() if loc in locs)
                    x, y = project(locator_world(model, pose, bone, animations.LOCATORS[bone][loc]),
                                   size, scale, yaw, -8, (0, 30, 0))
                    d.ellipse((x - 4, y - 4, x + 4, y + 4), outline=(255, 80, 80, 255), width=2)
        tiles.append(im)
    out = Image.new("RGBA", (size[0] * len(tiles), size[1]))
    for i, im in enumerate(tiles):
        out.paste(im, (i * size[0], 0))
    return out


if __name__ == "__main__":
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(HERE), "previews")
    os.makedirs(out_dir, exist_ok=True)
    model = load_model()
    only = sys.argv[2:] or list(animations.ANIMS)
    for name in only:
        a = animations.ANIMS[name]
        times = sorted({round(t, 2) for t, _ in a["poses"]})
        sheet(model, name, times).save(os.path.join(out_dir, "anim_%s.png" % name))
        print("wrote", name)
