#!/bin/sh
# Đóng gói addon theo version trong manifest: sh zombie_boss/tools/build.sh
# (phát hành bản mới + đổi UUID: python3 zombie_boss/tools/release.py)
set -e
cd "$(dirname "$0")/.."
python3 tools/gen_texture.py >/dev/null
python3 tools/gen_particles.py >/dev/null
python3 tools/gen_sounds.py >/dev/null
V=$(python3 -c "import json;v=json.load(open('ytaun_zombie_pack_behavior_pack/manifest.json'))['header']['version'];print(f'{v[0]}_{v[1]}')")
mkdir -p dist
rm -f dist/*.mcaddon
zip -qr "dist/ytaun_zombie_addon_v$V.mcaddon" ytaun_zombie_pack_behavior_pack ytaun_zombie_pack_resource_pack
echo "built dist/ytaun_zombie_addon_v$V.mcaddon"
