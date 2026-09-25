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

## v1.6

### Chiêu mới cho boss — lấy cảm hứng từ các trùm zombie nổi tiếng
| Chiêu | Nguồn cảm hứng | Tầm | Mô tả |
|---|---|---|---|
| Nôn Mật | Boomer (Left 4 Dead) | 0–8 | Phun mật hình nón: mù, buồn nôn, chậm. Nạn nhân bị "đánh dấu": 2 zombie chui lên cạnh họ. |
| Nhổ Axit | Spitter (Left 4 Dead) | 6–24 | Cục axit bay vòng cung → vũng axit 5 giây gây độc liên tục (2 vũng từ Cuồng Nộ). |
| Lưỡi Kéo | Smoker (Left 4 Dead) | 8–18 | Phóng lưỡi thịt quấn mục tiêu, kéo về phía boss. |
| Ném Imp | Gargantuar (Plants vs Zombies) | 6–24 | Ném zombie con bay tới đáp cạnh mục tiêu (1/2/3 con theo giai đoạn). |

### Lên form thì trâu hơn
| Form | Máu tối đa | Sát thương nhận vào | Kích thước | Đánh thường | Khác |
|---|---|---|---|---|---|
| Thường | 400 | 100% | 1.6 | 6 | |
| Cuồng Nộ (≤50%) | 600 (hồi về 65%) | 75% | 1.75 | 9 | Hấp thụ V, miễn đẩy lùi |
| Final Fury (≤20%) | 800 (hồi về 45%) | 55% | 1.9 | 13 + khô héo | Hấp thụ X, miễn đẩy lùi |
Giai đoạn được lưu vào boss (dynamic property) nên thoát game vào lại vẫn giữ form.

### Particle zombie (13 mới)
Ruồi bay quanh xác, mảnh thịt thối, xương văng, đầu lâu xanh bay lên, bàn tay zombie trồi khỏi đất, nhớt xanh nhỏ giọt,
mật phun, vũng axit sủi bọt, cục axit, lưỡi thịt, con mắt quỷ khi lên form. Tất cả pixel art 16px.

### Âm thanh mới (14 file `.ogg`, tự tổng hợp — `tools/gen_sounds.py`)
`ytaun.boss_roar`, `boss_slam`, `rock_crumble`, `bile_vomit`, `acid_sizzle`, `spit`, `tongue_whip`, `horde_moan`,
`general_shout`, `transform`, `flies`, `axe_smash`, `soul_drain`, `imp_scream`. Dùng cho boss, Zombie General và Zombie Axe.

## v1.7
- **Sửa boss không rơi đồ**: loot table cũ trỏ tới item không tồn tại nên hỏng cả bảng. Boss giờ rơi: Tay Giant Zombie (luôn),
  Tim Zombie (33%), thịt thối, mắt nhện. Zombie General rơi Tim Zombie 17% (loot cũ còn lại giữ nguyên).
- **Giảm độ trâu giữa trận**: Cuồng Nộ 500 máu (hồi về 45%), nhận 90% sát thương, đánh 8; Final Fury 550 máu (hồi về 22%),
  nhận 80% sát thương, đánh 10. Bỏ hiệu ứng Hấp Thụ / Kháng Cự / Sức Mạnh khi lên form; sát thương chiêu +10% / +20%;
  hồi máu yếu hơn; nghỉ giữa các chiêu lâu hơn. Lính triệu hồi không còn buff sức mạnh (trừ Final Fury).
- **Triệu hồi có Zombie General**: mỗi đợt triệu hồi có 1 tướng dẫn quân (tối đa 2 tướng cùng lúc).
- **Vẽ lại model 3D + icon**: búa Zombie Hammer mới (cán gỗ quấn vải, đầu búa thịt thối đai sắt, mặt đầu lâu, pha lê xanh),
  và icon búa mới khớp model (`tools/gen_items.py`). Các item khác giữ icon gốc.
