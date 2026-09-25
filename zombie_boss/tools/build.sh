#!/bin/sh
# Đóng gói addon: sh zombie_boss/tools/build.sh  ->  zombie_boss/dist/ytaun_zombie_addon_v1_4.mcaddon
set -e
cd "$(dirname "$0")/.."
python3 tools/gen_particles.py >/dev/null
mkdir -p dist
rm -f dist/ytaun_zombie_addon_v1_4.mcaddon
zip -qr dist/ytaun_zombie_addon_v1_4.mcaddon ytaun_zombie_pack_behavior_pack ytaun_zombie_pack_resource_pack
echo "built dist/ytaun_zombie_addon_v1_4.mcaddon"
