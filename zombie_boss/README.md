# BOSS Giant Zombie — addon (bản mới nhất: xem `dist/`)

File cài đặt: [`dist/`](dist/)
(phát hành bản mới: `python3 zombie_boss/tools/release.py` — tự tăng version 1.x và đổi toàn bộ UUID; chỉ đóng gói lại: `sh zombie_boss/tools/build.sh`).

## Thay đổi so với v1.3

### Skill (`scripts/custom/giant_zombie_skill.js` — viết lại)
- **Bộ chọn chiêu**: mỗi lúc chỉ tung 1 chiêu, chọn theo khoảng cách tới mục tiêu + hồi chiêu + trọng số,
  không lặp một chiêu hai lần liên tiếp. (v1.3 tung nhiều chiêu cùng lúc mỗi tick.)
- **Vòng cảnh báo đỏ** dưới đất trước mọi đòn → người chơi né được.
- Sát thương thật bằng `applyDamage` (thay cho hiệu ứng `instant_damage`), có đẩy lùi / hất tung, rung màn hình.
- Không đánh người chơi Creative/Spectator, không đánh đồng minh zombie và lính của mình.
- Tự nhận lại boss sau khi thoát/vào lại thế giới (v1.3 mất hết skill sau khi load lại).

| Chiêu | Tầm | Mô tả |
|---|---|---|
| Ground Slam | 0–7 | Giơ 2 tay đập đất, sóng xung kích. Cuồng Nộ: thêm lớp sóng thứ 2. Final Fury: vòng gai đá. |
| Ground Spikes | 3–16 | Giậm chân, hàng gai đá lan về phía mục tiêu. Cuồng Nộ: quạt 3 hàng. Final Fury: thêm vòng gai quanh mục tiêu. |
| Leap Attack | 7–20 | Nhảy vòng cung tới chỗ mục tiêu, tiếp đất nổ. |
| Throw Rock | 7–28 | Ném tảng đá bay vòng cung (1 / 3 / 5 tảng theo giai đoạn). |
| Poison Breath | 0–8 | Mây độc 4 giây: độc, buồn nôn, đói. |
| War Roar | 0–12 | Sóng âm đẩy lùi + làm chậm, buff boss và zombie xung quanh. |
| Summon Horde | mọi tầm | Trận pháp xanh → zombie/husk chui từ đất lên (tối đa 10 lính). Lính tan biến khi boss chết. |
| Grab & Slam | 0–4.5 | Tóm người chơi, nhấc lên rồi đập xuống đất. Chạy ra xa trước khi tay khép lại (0.75s) là thoát. |

**Giai đoạn**: Thường → **Cuồng Nộ** (≤50% máu: nhanh hơn, +25% sát thương, hồi máu định kỳ)
→ **Final Fury** (≤20%: hồi chiêu nhanh 40%, +50% sát thương). Chuyển giai đoạn có animation biến hình,
title trên màn hình và vụ nổ đẩy lùi.

### Particle (`resource_pack/particles/`, sinh bởi `tools/gen_particles.py`)
23 particle `ytaun:*` với atlas texture vẽ riêng `textures/particle/ytaun_boss.png` (`tools/gen_texture.py`): vòng sóng phẳng trên mặt đất, gai đá, đá vụn xoay, rune triệu hồi xoay, vết nứt đất, tia lửa, lửa cuồng nộ, bong bóng độc. Mỗi hiệu ứng lớn ghép nhiều lớp (khói + vòng sóng + chớp sáng + tia lửa + vết nứt).
`rage_aura`, `rage_burst`, `spike`, `rock_debris`, `rock_trail`, `rock_core`, `summon_rune`, `ground_crack`,

### Animation (`tools/gen_animations.py` thêm vào `ytaun_giant_zombie.animation.json`)
`slam`, `throw`, `summon`, `stomp`, `enrage`, `breath` — thời điểm va chạm trong animation khớp với tick gây sát thương trong script.

### Dọn dẹp
- Xoá script/file thừa từ addon khác (candy scythe, enbriger, frozen sword, harvester scythe, tutorial scroll,
  structure summon, item trigger, shield manager, `player.json` ghi đè người chơi, `giantzombie.mcfunction` lỗi).
  Một file lỗi lúc load là toàn bộ script chết → boss không có skill.
- Script API hạ xuống `@minecraft/server` 2.0.0 (chạy trên Minecraft 1.21.90+), bỏ `@minecraft/server-ui`.

## v1.5

### Zombie General — skill mới (`scripts/custom/zombie_general_skill.js`)
| Chiêu | Tầm | Mô tả |
|---|---|---|
| Chém Quét | 0–3.5 | Chém hình quạt phía trước, 7 sát thương + làm chậm. |
| Xung Phong | 4–12 | Vạch đường cảnh báo rồi lao thẳng tới, húc văng mọi thứ trên đường (8 sát thương). |
| Hiệu Triệu | 0–16 | Buff tốc độ / sức mạnh / kháng cho mọi zombie quanh 14 block. |
| Gọi Quân | 0–16 | Triệu hồi 2 lính zombie (tối đa 4). Lính biến mất khi tướng chết. |

### Zombie Axe — skill mới (`scripts/custom/zombie_axe_skill.js`)
- **Chuột phải — Đập Đất** (hồi 8s): nhảy lên, nện xuống: 10 sát thương vùng 4.5 block, hất tung, vòng gai đá.
- **Ngồi + chuột phải — Hút Hồn** (hồi 15s): 5 sát thương + độc cho kẻ địch quanh 7 block, hồi 2 máu mỗi mục tiêu (tối đa 10).
- **Nội tại**: 25% gây độc + khô héo; mỗi đòn chém thứ 4 là Đòn Nặng (+6 sát thương, hất văng).

### Particle pixel art
Atlas `textures/particle/ytaun_boss.png` vẽ lại kiểu pixel art 16px (giống vanilla), không khử răng cưa, không blur.

### Version / UUID
Mỗi lần phát hành chạy `tools/release.py`: version tăng 1.4 → 1.5 → 1.6…, UUID của cả 2 pack và module đều đổi mới,
tên pack có số version (vd. `BOSS-Giant Zombie v1.5`) nên game không nhầm với bản cũ.
