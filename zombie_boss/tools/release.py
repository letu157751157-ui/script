"""Tăng version (1.x.0 -> 1.(x+1).0) + tạo UUID mới cho cả 2 pack, rồi đóng gói.
Chạy mỗi lần phát hành: python3 zombie_boss/tools/release.py"""
import json, os, subprocess, uuid

ROOT = os.path.join(os.path.dirname(__file__), "..")
BP = os.path.join(ROOT, "ytaun_zombie_pack_behavior_pack", "manifest.json")
RP = os.path.join(ROOT, "ytaun_zombie_pack_resource_pack", "manifest.json")

bp, rp = json.load(open(BP)), json.load(open(RP))
major, minor, _ = bp["header"]["version"]
ver = [major, minor + 1, 0]
bp_id, rp_id = str(uuid.uuid4()), str(uuid.uuid4())

for m, own in ((bp, bp_id), (rp, rp_id)):
    m["header"]["uuid"] = own
    m["header"]["version"] = ver
    name = m["header"]["name"].split(" v")[0]
    m["header"]["name"] = f"{name} v{ver[0]}.{ver[1]}"
    for mod in m["modules"]:
        mod["uuid"] = str(uuid.uuid4())
        mod["version"] = ver
    for dep in m.get("dependencies", []):
        if "uuid" in dep:
            dep["uuid"] = rp_id if m is bp else bp_id
            dep["version"] = ver

json.dump(bp, open(BP, "w"), indent=2)
json.dump(rp, open(RP, "w"), indent=2)
print(f"version {ver[0]}.{ver[1]}.0  BP {bp_id}  RP {rp_id}")
subprocess.run(["sh", os.path.join(ROOT, "tools", "build.sh")], check=True)
