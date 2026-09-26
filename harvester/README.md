# The Harvester v1.3.3 — Thần Chết × Bác sĩ Dịch hạch

Boss **The Harvester** (`pa:harvester`) được làm lại theo ý tưởng **Thần Chết** (lưỡi hái, linh hồn, đồng hồ cát, bia mộ)
kết hợp **Bác sĩ Dịch hạch** (mặt nạ mỏ chim, bình thuốc dịch, khí độc, bầy quạ).
Bản này đổi toàn bộ bộ chiêu, thêm 17 animation và 35 particle mới, và sửa nhiều lỗi của bản 1.2.

- Cài đặt: mở [`dist/TheHarvester_v1.3.3.mcaddon`](dist/TheHarvester_v1.3.3.mcaddon) (Minecraft tự nhập cả 2 pack).
  Nếu đã cài bản cũ (1.2 / 1.3.x): vào **Cài đặt → Bộ nhớ**, xoá các pack *The Harvester* cũ, nhập file 1.3.3,
  rồi trong thế giới bật lại cả Behavior Pack lẫn Resource Pack **1.3.3**.
- Kiểm tra nhanh: thanh máu của boss phải ghi *The Harvester — Doctor of the Dead*. Nếu vẫn là tên cũ thì thế giới còn dùng pack cũ.
- Yêu cầu: Minecraft Bedrock **1.21.90+** (giống bản gốc), không cần bật Experiments.
- Gọi boss: `/summon pa:harvester`, hoặc gặp tự nhiên ở The End như trước.

![Các tư thế chiêu của boss](previews/skills.png)

## Bộ chiêu mới

Boss có **3 giai đoạn**. Mỗi chiêu đều có **cảnh báo** (vùng sáng dưới đất, vòng tròn, đầu lâu...) trước khi gây sát thương,
và boss **đứng yên** trong lúc vung chiêu nên người chơi có thể né.

### Giai đoạn 1 — "Doctor of the Dead" (100% → 60% máu)

| Chiêu | Mô tả | Cách né |
|---|---|---|
| **Reaping Arc** (Nhát Gặt) | Kéo lưỡi hái ra sau rồi quét một vòng thấp từ phải sang trái, hình quạt ~125°, bán kính 6.5 (7.5 ở GĐ3). 10 sát thương, hất lùi, +1 dịch hạch. | Ra khỏi vùng quạt màu xanh ngọc dưới đất. |
| **Plague Flask** (Bình Dịch Hạch) | Tay trái ném bình thuốc theo đường cong (1 / 2 / 3 bình theo giai đoạn), vỡ thành vũng khí độc bán kính 3 tồn tại 6 giây. | Vòng xanh lá hiện ở chỗ bình sẽ rơi. Đứng trong vũng: mỗi giây mất máu và +1 dịch hạch. |
| **Murder of Crows** (Bầy Quạ) | Dang tay rít lên, thả quạ lao thẳng tới **vị trí** của từng người chơi (2 quạ, GĐ2+ là 3). | Quạ bay thẳng, cứ di chuyển là né được. |
| **Death's Step** (Bước Tử Thần) | Đầu lâu hiện dưới chân mục tiêu → boss tan vào khói → hiện ra **sau lưng** mục tiêu và chém hất lên. | Thấy đầu lâu thì quay lại/chạy ngang. |

### Giai đoạn 2 — "Epidemic" (60% → 30%), thêm:

| Chiêu | Mô tả | Cách né |
|---|---|---|
| **Pestilence Nova** (Sóng Dịch) | Giơ hai tay, viên ngọc ở ngực phình to, đập lưỡi hái xuống: **3 vòng khí dịch** lan ra tới bán kính 12. | **Nhảy qua** vòng sóng (đang ở trên không thì không trúng). |
| **Graves of the Plagued** (Mộ Dịch) | Cắm lưỡi hái xuống đất: bia mộ trồi lên quanh người chơi, 1.2 giây sau **Plague Thrall** (husk, bogged; GĐ3 thêm wither skeleton) bò ra. Tối đa 8 con, chết theo boss. | Đánh lính hoặc tránh xa bia mộ. |
| **Soul Harvest** (Gặt Hồn) | Xích linh hồn nối boss với mọi người trong 12 ô, hút máu 2.4 giây (thêm sát thương theo số dịch hạch) và hồi máu cho boss. | Chạy xa hơn **16 ô** để đứt xích. |
| **Plague Aura** (nội tại) | Đứng sát boss (3.5 ô) bị nhiễm +1 dịch hạch mỗi 3 giây. Đòn đánh thường cũng lây dịch. | Đừng đứng dính boss quá lâu. |

### Giai đoạn 3 — "Final Harvest" (dưới 30%), thêm:

| Chiêu | Mô tả | Cách né |
|---|---|---|
| **Death Sentence** (Bản Án Tử) | Chĩa lưỡi hái vào tối đa 4 người: **đồng hồ cát** chạy 4 giây trên đầu, hết cát thì một **lưỡi hái ma** giáng xuống. Sát thương = 6 + 3 × số dịch hạch (dịch hạch bị tiêu hết). | Uống **sữa** để xoá dịch hạch trước khi hết cát. |
| **The Black Death** (Cái Chết Đen) | Boss bay lên, khí đen và mưa dịch phủ vùng bán kính 16. Vài **đèn lồng linh hồn** hiện ra, mỗi cái có vòng sáng bán kính 2.5. Sau 3.6 giây: 14 sát thương phép + 2 dịch hạch cho ai đứng ngoài ánh đèn. | Chạy vào vòng sáng của một đèn lồng. |
| **Final Harvest** (Mùa Gặt Cuối) | Chiêu cuối: vòng rune đỏ, lưỡi hái xoay trên đầu 2 giây rồi **xoay người 360°**. Trúng người ở khoảng 3 → 11.5 ô: 18 sát thương, héo, boss hồi máu theo số người trúng. | Đứng **sát boss** (vòng xanh bên trong) hoặc ra **ngoài** vòng đỏ. |

### Cơ chế Dịch Hạch (Plague)

- Hầu hết chiêu cộng **stack dịch hạch** (hiện trên action bar `☣ ■■■□□` và biểu tượng mặt nạ mỏ chim trên đầu người chơi).
- Đủ **5 stack** thì phát dịch (**Black Death pop**): 6 sát thương phép, héo 3s, buồn nôn 4s, rồi stack về 0.
- Không bị nhiễm thêm trong 6 giây thì cứ 3 giây mất 1 stack. **Uống sữa** xoá sạch. Boss chết cũng xoá hết.

### Chuyển giai đoạn, Enrage và các chi tiết khác

- Khi chuyển giai đoạn, boss **gầm lên** (bất tử 2.2 giây), đẩy lùi người đứng gần, đổi tên trên thanh máu:
  *Doctor of the Dead → Epidemic → Final Harvest*. GĐ2 được Speed I, GĐ3 được Speed II + Strength I + kháng lửa.
- **Enrage** sau 5 phút chiến đấu: mọi hồi chiêu còn 50%, sát thương ×1.35. Đồng hồ enrage chỉ bắt đầu khi có người đánh,
  và **reset** nếu 30 giây không ai ở gần (bản cũ tính từ lúc boss xuất hiện).
- **Shadow Blink**: bị đánh có 7% dịch chuyển ra sau lưng người đánh (tối đa 8 giây một lần, không dùng khi đang vung chiêu).
- **Soul Toll**: người chơi chết gần boss làm boss hồi 3% máu.
- Boss không rời xa quá 50 ô khỏi chỗ xuất hiện (bị kéo về + hồi 20 máu, như bản cũ).
- Action bar hiện: giai đoạn, % máu, stack dịch hạch của bạn, thời gian còn lại trước enrage.

## Animation mới (17)

`idle` (lơ lửng, áo choàng bay, viên ngọc đập như tim), `move` (lướt, người đổ về trước, áo và lưỡi hái kéo phía sau),
`attack` (bổ lưỡi hái từ trên xuống, tự phát khi boss đánh thường), `spawn` (trồi lên từ lòng đất), `death` (gục xuống, tan biến),
`phase_roar`, và 11 animation chiêu: `skill_reap`, `skill_flask`, `skill_crows`, `skill_vanish`, `skill_ambush`, `skill_nova`,
`skill_summon`, `skill_drain`, `skill_sentence`, `skill_blackdeath`, `skill_ultimate`.

- Keyframe dùng nội suy Catmull-Rom (mượt như key "smooth" của Blockbench), mở được trong Blockbench để chỉnh.
- Model được thêm **locator** (`blade`, `blade_tip`, `gem`, `eyes`, `hand_left`, `hand_right`, `feet`) để particle bám theo lưỡi hái,
  viên ngọc, mắt... Hình dáng model và texture **không đổi**.
- Đầu boss quay theo mục tiêu (`look_at_target`).
- Animation cũ của iron golem (xương `arm0`, `leg0`, `head`... không có trong model, và đòn đánh không bao giờ chạy) đã được thay.

## Particle mới (35)

![Sprite của các particle mới](previews/particles.png)

Vẽ **cùng phong cách với các addon khác trong repo** (Darkin Blade của Aatrox, Toji, Giant Zombie): pixel cạnh sắc,
mỗi hiệu ứng một dải 4–5 màu (linh hồn: trắng → xanh ngọc → xanh đậm; dịch hạch: vàng lục → xanh rêu), tô theo "độ nóng"
thành từng dải phẳng, và flipbook vỡ vụn thành pixel rời ở các khung cuối. Vệt chém/sóng 32×32, phần lớn sprite 16×16,
mảnh vụn 8×8, vòng rune 64×64. Khói, vòng, ô cảnh báo là sprite xám được tô màu trong JSON (giống atlas của Giant Zombie).

Tất cả nằm trong `TheHarvesterRP/particles/harvester_*.json`, dùng chung atlas `textures/particle/harvester_particles.png`:
linh hồn (`soul_wisp`, `soul_burst`, `soul_stream`, `soul_pillar`), vệt lưỡi hái (`scythe_trail`, `scythe_trail_big`, `spectral_scythe`),
khí dịch (`miasma`, `miasma_field`, `blackdeath_field`, `aura_mist`, `black_rain`, `black_smoke`), bình thuốc (`flask`, `plague_drip`,
`glass_shards`, `plague_splash`), cảnh báo dưới đất (`ground_warn`, `ring_warn`, `rune_circle`, `shockwave`, `skull_sigil`),
đánh dấu trên đầu (`plague_pips`, `hourglass`, `beak_sigil`), bia mộ (`grave_rise`, `dirt_burst`), đèn lồng (`lantern`),
quạ (`crow`, `crow_flock`, `feathers`), xích hồn (`chain_link`), tia lửa (`ember`, `gem_pulse`, `eye_glow`).

## Harvester Scythe (vũ khí rơi ra)

Giữ nguyên chỉ số, chỉ sửa lỗi và đổi hiệu ứng:
- **Sửa lỗi Soul Harvest không bao giờ hoạt động**: code cũ gây sát thương ngay trong `beforeEvents` (chế độ chỉ đọc) nên bị lỗi âm thầm.
- Shadow Reap / Soul Harvest / Soul Explosion / Death Mark dùng particle mới (vòng rune, vệt chém, linh hồn bay về người dùng, đầu lâu đánh dấu).
- Soul Explosion chỉ nổ khi có kẻ địch trong tầm (bản cũ nổ và báo chat mỗi 20 giây), và các chiêu diện rộng
  **không còn đánh dân làng, thương nhân, giáp đứng hay thú đã thuần**.
- Kill bằng chiêu của lưỡi hái giờ cũng tính cho Dark Blessing.
- Khi đang đánh Harvester, action bar hiện thông tin boss thay vì hồi chiêu lưỡi hái.

## Bản 1.3.3 — particle theo phong cách các addon khác

Vẽ lại 35 particle theo cách vẽ của Aatrox / Toji / Giant Zombie: vệt chém lưỡi liềm có mép trắng rồi vỡ thành tia,
khói phồng ra rồi tan thành pixel, sóng xung kích dày → mỏng → vỡ, lửa linh hồn 16×16 lắc lư, hồn ma, đầu lâu, lưỡi hái ma,
quạ ánh tím, bình thuốc thủy tinh, đồng hồ cát, đèn lồng linh hồn, bia mộ, mặt nạ bác sĩ dịch hạch. Chiêu và thời gian không đổi.

## Bản 1.3.2 — particle đơn giản kiểu Minecraft

Vẽ lại toàn bộ 35 particle cho giống particle vanilla: sprite nhỏ (8×8), ít màu, khối phẳng; khói co nhỏ dần qua 8 khung.
Kích thước hiển thị chỉnh lại cho vừa sprite mới. Chiêu, thời gian và hitbox không đổi.

## Bản 1.3.1 — sửa lỗi "không có skill, không có animation đánh" và dọn file rác

**Nguyên nhân không có skill:** `main.js` nạp tất cả script, và pack khai báo `@minecraft/server` **1.14.0**. Ở bản 1.14.0 chưa có
`world.beforeEvents.playerInteractWithEntity` / `playerInteractWithBlock`, nên `harvester_scythe.js` lỗi ngay khi nạp.
Lỗi đó làm cả `main.js` hỏng, toàn bộ script (kể cả boss) không chạy. Bản 1.2 gốc cũng bị y như vậy.
Ngoài ra `utimate_emeral_helmet.js` là code **KubeJS của Java Edition** (`PlayerEvents.tick`), không chạy được trên Bedrock.
- Nâng lên `@minecraft/server` **1.15.0** (bản đầu tiên có các event trên, cách gọi API giữ nguyên như 1.14).
- Mọi chỗ đăng ký event đều có kiểm tra, một event thiếu không làm hỏng cả script nữa.
- Boss không còn bỏ qua người chơi Creative (trước đây test trong Creative thì boss không bao giờ ra chiêu).
- Lọc chế độ chơi bằng `getGameMode()` thay vì chuỗi `"creative"` (tên enum này đổi thành `"Creative"` ở API 2.x).

**Animation đánh:** đòn chém thường giờ do resource pack tự chạy khi boss vung tay (`variable.attack_time`), không cần script.
Boss cũng vung lưỡi hái khi bắn đầu lâu wither (`ranged_attack` → `swing: true`).

**Sửa thêm:** 8 item (thỏi thép, thép thô, gậy thép, Super Smithing Update...) dùng custom component chưa hề được đăng ký;
bảng loot của boss rơi `pa:ender_dust`, item không có trong pack (đã bỏ, giờ rơi Reaper Skull hoặc End Stone + 8 Soul).

**Dọn file rác:** pack này được cắt ra từ addon "A chaotic world", còn sót lại đồ của Yeti, Giant Zombie, Robot Crab,
Ice Golem, vũ khí băng, Lamborghini... Đã xoá **~420 file**, pack giảm từ ~12.9 MB còn ~1.3 MB (file .mcaddon 0.2 MB):
- 10 script của mob/vũ khí không có trong pack (chạy mỗi tick vô ích), 2 file tiện ích chỉ chúng dùng, và `utimate_emeral_helmet.js` (KubeJS).
- ~165 function, 22 loot table, 11 spawn rule, trade, 4 recipe, 80 model, ~95 texture, 7 particle, âm thanh Yeti.
- Các file **ghi đè đồ vanilla**: `enderman.animation_controllers.json` (Enderman), `player.render_controllers.json`
  (cách vẽ người chơi), `materials/particles.material` (shader particle), và dòng lang đổi tên Mooshroom / Text-To-Speech.
- Khối lông Yeti `pa:fur_block` (6 texture 1024×1024 giống hệt nhau, ~7 MB, không có công thức, không ai rơi ra).
- File của app AddOns Maker (`.data`, `.error`), 4 animation controller giáp Dark Knight không gắn vào entity nào.
- Giữ lại: boss, Harvester Scythe, bộ Dark Knight, táo, thỏi/thép và mọi thứ chúng dùng. `A_chaotic_world_(beta)_`
  giờ chỉ give các item có thật trong pack. Tất cả file đã xoá vẫn còn trong lịch sử git nếu cần lấy lại.

## Các lỗi của bản 1.2 đã sửa (1.3.0)

- Nhầm **mili-giây với tick**: Chaos Storm kéo dài ~400 giây thay vì 8, Soul Vortex ~5 phút, Reaper's Judgment nổ sau 150 giây,
  Soul Harvest (chiêu cuối) chờ 22 giây. Bản mới tính mọi thời gian bằng tick, khớp với animation.
- Boss **tự sinh wither skeleton mãi mãi** mỗi 30–60 giây kể cả khi không ai ở gần (`minecraft:spawn_entity`), đã bỏ; lính giờ do chiêu Graves gọi và có giới hạn 8.
- Người chơi có thể **hồi máu cho boss bằng thỏi sắt** và boss "tặng hoa" (sót lại từ iron golem), đã bỏ.
- Hiệu ứng khi boss chết chạy trên entity đã bị xoá (lỗi âm thầm), và lệnh sinh `minecraft:chest` (không phải entity) đã bỏ.
- Thông báo chiêu gửi cho cả server; giờ chỉ gửi cho người chơi ở gần.
- Boss bỏ qua người chơi Spectator. Người chơi Creative vẫn bị boss nhắm chiêu (không mất máu), nên test trong Creative vẫn thấy chiêu.

## Cấu trúc & build

```
harvester/
├── TheHarvesterBP/ , TheHarvesterRP/   hai pack (đã sửa)
├── build.py            tạo lại particle + animation, kiểm tra tham chiếu/manifest/file rác, đóng gói dist/*.mcaddon
├── tools/
│   ├── art.py          vẽ sprite pixel art cho particle
│   ├── particles.py    atlas + 35 file particle JSON
│   ├── animations.py   17 animation, controller, locator (có ghi chú hướng xoay của từng xương)
│   ├── render.py       renderer nhỏ để xem trước model/animation
│   ├── previews.py     ảnh trong previews/
│   ├── cleanup.py      liệt kê (hoặc xoá với --apply) file không dùng tới
│   └── simulate.mjs    chạy thử script trên mock @minecraft/server qua cả trận đấu
└── dist/TheHarvester_v1.3.3.mcaddon
```

- `python3 build.py` (cần `pip install pillow numpy`), thêm `--previews` để vẽ lại ảnh xem trước.
- `node tools/simulate.mjs`: nạp **toàn bộ** script qua `main.js` với đúng danh sách event/export của phiên bản
  `@minecraft/server` ghi trong manifest, rồi đánh giả lập ~16 phút (GĐ1 → GĐ3 → enrage → boss chết, boss vào thẳng GĐ3,
  chỉ có người chơi Creative / Spectator). Báo: script không nạp được, lỗi không bắt, lỗi bị `try/catch` nuốt,
  particle thiếu biến Molang, animation không tồn tại, component item chưa đăng ký, lệnh ghi trong chế độ chỉ đọc.
- Chỉnh sát thương, hồi chiêu, tầm: `CONFIG` ở đầu `TheHarvesterBP/scripts/harvester.js`.

## Lưu ý

- Mình chưa chạy được bản này trong Minecraft thật (chỉ chạy giả lập ở trên). Nếu thấy chiêu nào lệch hướng hay particle sai cỡ, báo mình để chỉnh.
- Pack được sửa trực tiếp. Nếu mở lại bằng app **AddOns Maker** rồi xuất lại, app có thể ghi đè các thay đổi này (file `.data` của app đã được xoá khỏi pack).
