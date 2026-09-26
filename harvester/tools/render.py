"""Tiny software renderer for Bedrock geometry files (preview images only).

Works in Blockbench space: file x is mirrored (x_bb = -x_file) and bone/cube rotations
become [-rx, -ry, rz] applied in Z*Y*X order, the same way Blockbench shows a Bedrock model.
"""
import math

import numpy as np
from PIL import Image


def rot_matrix(rx, ry, rz):
    rx, ry, rz = (math.radians(a) for a in (rx, ry, rz))
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return mz @ my @ mx


def affine(m3, t=(0, 0, 0)):
    m = np.eye(4)
    m[:3, :3] = m3
    m[:3, 3] = t
    return m


def translate(t):
    return affine(np.eye(3), t)


def file_rot(r):
    r = r or [0, 0, 0]
    return rot_matrix(-r[0], -r[1], r[2])


def file_pt(p):
    return np.array([-p[0], p[1], p[2]], dtype=float)


class Model:
    def __init__(self, geo, texture):
        self.bones = {b["name"]: b for b in geo["bones"]}
        self.order = [b["name"] for b in geo["bones"]]
        self.tex = np.asarray(texture.convert("RGBA"), dtype=np.float32)
        self.tw = geo["description"].get("texture_width", self.tex.shape[1])
        self.th = geo["description"].get("texture_height", self.tex.shape[0])

    def bone_matrices(self, pose):
        mats = {}

        def get(name):
            if name in mats:
                return mats[name]
            b = self.bones[name]
            p = pose.get(name, {})
            pivot = file_pt(b.get("pivot", [0, 0, 0]))
            base = b.get("rotation") or [0, 0, 0]
            ar = p.get("rotation", [0, 0, 0])
            rot = [base[i] + ar[i] for i in range(3)]
            pos = p.get("position", [0, 0, 0])
            sc = p.get("scale", [1, 1, 1])
            if not isinstance(sc, (list, tuple)):
                sc = [sc] * 3
            local = (translate(pivot + file_pt(pos)) @ affine(file_rot(rot) @ np.diag(sc))
                     @ translate(-pivot))
            parent = b.get("parent")
            m = get(parent) @ local if parent in self.bones else local
            mats[name] = m
            return m

        for n in self.order:
            get(n)
        return mats

    def faces(self, pose=None, hidden=()):
        """Yield (P0, Eu, Ev, uv, uv_size) in world (Blockbench) space."""
        mats = self.bone_matrices(pose or {})
        out = []
        for name in self.order:
            if name in hidden:
                continue
            b = self.bones[name]
            sc = (pose or {}).get(name, {}).get("scale", 1)
            if not isinstance(sc, (list, tuple)):
                sc = [sc] * 3
            if min(abs(s) for s in sc) < 1e-3:
                continue
            m = mats[name]
            for c in b.get("cubes", []):
                inf = c.get("inflate", 0)
                o, s = c["origin"], c["size"]
                x0, x1 = -(o[0] + s[0]) - inf, -o[0] + inf
                y0, y1 = o[1] - inf, o[1] + s[1] + inf
                z0, z1 = o[2] - inf, o[2] + s[2] + inf
                cm = m
                if "rotation" in c:
                    cp = file_pt(c.get("pivot", [0, 0, 0]))
                    cm = m @ translate(cp) @ affine(file_rot(c["rotation"])) @ translate(-cp)
                dx, dy, dz = x1 - x0, y1 - y0, z1 - z0
                defs = {
                    "north": ((x1, y1, z0), (-dx, 0, 0), (0, -dy, 0)),
                    "south": ((x0, y1, z1), (dx, 0, 0), (0, -dy, 0)),
                    "east": ((x1, y1, z1), (0, 0, -dz), (0, -dy, 0)),
                    "west": ((x0, y1, z0), (0, 0, dz), (0, -dy, 0)),
                    "up": ((x1, y1, z0), (-dx, 0, 0), (0, 0, dz)),
                    "down": ((x1, y0, z1), (-dx, 0, 0), (0, 0, -dz)),
                }
                uvs = c.get("uv")
                if isinstance(uvs, list):
                    uvs = box_uv(uvs, s, c.get("mirror", False))
                for face, (p0, eu, ev) in defs.items():
                    if not uvs or face not in uvs:
                        continue
                    f = uvs[face]
                    size = f.get("uv_size", [0, 0])
                    if size[0] == 0 or size[1] == 0:
                        continue
                    P0 = (cm @ np.array([*p0, 1.0]))[:3]
                    Eu = cm[:3, :3] @ np.array(eu, dtype=float)
                    Ev = cm[:3, :3] @ np.array(ev, dtype=float)
                    out.append((P0, Eu, Ev, f["uv"], size, f.get("emissive", False)))
        return out


def box_uv(uv, s, mirror):
    u, v = uv
    w, h, d = s
    faces = {
        "east": ([u, v + d], [d, h]),
        "north": ([u + d, v + d], [w, h]),
        "west": ([u + d + w, v + d], [d, h]),
        "south": ([u + 2 * d + w, v + d], [w, h]),
        "up": ([u + d, v + d], [w, -d]),
        "down": ([u + d + w, v], [w, d]),
    }
    if mirror:
        faces["east"], faces["west"] = faces["west"], faces["east"]
        faces = {k: ([a[0] + b[0], a[1]], [-b[0], b[1]]) for k, (a, b) in faces.items()}
    return {k: {"uv": a, "uv_size": b} for k, (a, b) in faces.items()}


LIGHT = np.array([-0.45, 0.8, -0.55])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def render(models, size=(512, 512), scale=6.0, yaw=0.0, pitch=0.0, center=(0, 24, 0),
           background=(0, 0, 0, 0), zbuf=None, img=None):
    """models: list of (Model, faces). yaw rotates the model around Y (degrees)."""
    W, H = size
    if img is None:
        img = np.zeros((H, W, 4), dtype=np.float32)
        img[:] = background
    if zbuf is None:
        zbuf = np.full((H, W), np.inf)
    view = rot_matrix(pitch, yaw, 0)
    c = file_pt(center)
    for model, faces in models:
        tex, tw, th = model.tex, model.tw, model.th
        sx_tex = tex.shape[1] / tw
        sy_tex = tex.shape[0] / th
        for P0, Eu, Ev, uv, uvs, _ in faces:
            p0 = view @ (P0 - c)
            eu = view @ Eu
            ev = view @ Ev
            n = np.cross(Eu, Ev)
            nn = np.linalg.norm(n)
            if nn < 1e-9:
                continue
            # screen: x = -X (camera looks along +Z), y = up
            S0 = np.array([-p0[0], -p0[1]]) * scale + [W / 2, H / 2]
            Su = np.array([-eu[0], -eu[1]]) * scale
            Sv = np.array([-ev[0], -ev[1]]) * scale
            det = Su[0] * Sv[1] - Su[1] * Sv[0]
            if abs(det) < 1e-6:
                continue
            pts = [S0, S0 + Su, S0 + Sv, S0 + Su + Sv]
            xmin = max(int(math.floor(min(p[0] for p in pts))), 0)
            xmax = min(int(math.ceil(max(p[0] for p in pts))), W - 1)
            ymin = max(int(math.floor(min(p[1] for p in pts))), 0)
            ymax = min(int(math.ceil(max(p[1] for p in pts))), H - 1)
            if xmin > xmax or ymin > ymax:
                continue
            ys, xs = np.mgrid[ymin:ymax + 1, xmin:xmax + 1]
            px = xs + 0.5 - S0[0]
            py = ys + 0.5 - S0[1]
            s = (px * Sv[1] - py * Sv[0]) / det
            t = (Su[0] * py - Su[1] * px) / det
            inside = (s >= 0) & (s <= 1) & (t >= 0) & (t <= 1)
            if not inside.any():
                continue
            depth = p0[2] + s * eu[2] + t * ev[2]
            tu = uv[0] + s * uvs[0]
            tv = uv[1] + t * uvs[1]
            iu = np.clip(np.floor(tu * sx_tex - np.sign(uvs[0]) * 1e-4), 0, tex.shape[1] - 1).astype(int)
            iv = np.clip(np.floor(tv * sy_tex - np.sign(uvs[1]) * 1e-4), 0, tex.shape[0] - 1).astype(int)
            col = tex[iv, iu]
            ok = inside & (col[..., 3] > 100) & (depth < zbuf[ys, xs])
            if not ok.any():
                continue
            normal = view @ (n / nn)
            lum = 0.55 + 0.45 * abs(float(normal @ LIGHT))
            shaded = col[..., :3] * lum
            yy, xx = ys[ok], xs[ok]
            img[yy, xx, :3] = shaded[ok]
            img[yy, xx, 3] = 255
            zbuf[yy, xx] = depth[ok]
    return img, zbuf


def to_image(img):
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGBA")


def locator_world(model, pose, bone, pos):
    """World (Blockbench space) position of a locator given in file space on `bone`."""
    m = model.bone_matrices(pose or {})[bone]
    return (m @ np.array([*file_pt(pos), 1.0]))[:3]


def project(point, size, scale, yaw, pitch, center):
    view = rot_matrix(pitch, yaw, 0)
    p = view @ (point - file_pt(center))
    return size[0] / 2 - p[0] * scale, size[1] / 2 - p[1] * scale
