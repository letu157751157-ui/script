# The Harvester v1.3.0 — Thần Chết × Bác sĩ Dịch hạch

Boss **The Harvester** (`pa:harvester`) được làm lại theo ý tưởng **Thần Chết** (lưỡi hái, linh hồn, đồng hồ cát, bia mộ)
kết hợp **Bác sĩ Dịch hạch** (mặt nạ mỏ chim, bình thuốc dịch, khí độc, bầy quạ).
Bản này đổi toàn bộ bộ chiêu, thêm 17 animation và 35 particle mới, và sửa nhiều lỗi của bản 1.2.

- Cài đặt: mở [`dist/TheHarvester_v1.3.0.mcaddon`](dist/TheHarvester_v1.3.0.mcaddon) (Minecraft tự nhập cả 2 pack).
  Nếu đang dùng bản 1.2, gỡ pack cũ khỏi thế giới rồi bật pack 1.3.0.
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

Tất cả nằm trong `TheHarvesterRP/particles/harvester_*.json`, dùng chung atlas `textures/particle/harvester_particles.png` (pixel art):
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

## Các lỗi của bản 1.2 đã sửa

- Nhầm **mili-giây với tick**: Chaos Storm kéo dài ~400 giây thay vì 8, Soul Vortex ~5 phút, Reaper's Judgment nổ sau 150 giây,
  Soul Harvest (chiêu cuối) chờ 22 giây. Bản mới tính mọi thời gian bằng tick, khớp với animation.
- Boss **tự sinh wither skeleton mãi mãi** mỗi 30–60 giây kể cả khi không ai ở gần (`minecraft:spawn_entity`), đã bỏ; lính giờ do chiêu Graves gọi và có giới hạn 8.
- Người chơi có thể **hồi máu cho boss bằng thỏi sắt** và boss "tặng hoa" (sót lại từ iron golem), đã bỏ.
- Hiệu ứng khi boss chết chạy trên entity đã bị xoá (lỗi âm thầm), và lệnh sinh `minecraft:chest` (không phải entity) đã bỏ.
- Thông báo chiêu gửi cho cả server; giờ chỉ gửi cho người chơi ở gần.
- Chiêu của boss bỏ qua người chơi Creative/Spectator.

## Cấu trúc & build

```
harvester/
├── TheHarvesterBP/ , TheHarvesterRP/   hai pack (đã sửa)
├── build.py            tạo lại particle + animation, kiểm tra tham chiếu, đóng gói dist/*.mcaddon
├── tools/
│   ├── art.py          vẽ sprite pixel art cho particle
│   ├── particles.py    atlas + 35 file particle JSON
│   ├── animations.py   17 animation, controller, locator (có ghi chú hướng xoay của từng xương)
│   ├── render.py       renderer nhỏ để xem trước model/animation
│   ├── previews.py     ảnh trong previews/
│   └── simulate.mjs    chạy thử script trên mock @minecraft/server qua cả trận đấu
└── dist/TheHarvester_v1.3.0.mcaddon
```

- `python3 build.py` (cần `pip install pillow numpy`), thêm `--previews` để vẽ lại ảnh xem trước.
- `node tools/simulate.mjs`: đánh giả lập ~15 phút (GĐ1 → GĐ3 → enrage → boss chết, thêm một boss vào thẳng GĐ3),
  báo lỗi bị `try/catch` nuốt mất, particle thiếu biến Molang, animation không tồn tại, và các lệnh ghi trong chế độ chỉ đọc.
- Chỉnh sát thương, hồi chiêu, tầm: `CONFIG` ở đầu `TheHarvesterBP/scripts/harvester.js`.

## Lưu ý

- Mình chưa chạy được bản này trong Minecraft thật (chỉ chạy giả lập ở trên). Nếu thấy chiêu nào lệch hướng hay particle sai cỡ, báo mình để chỉnh.
- Pack được sửa trực tiếp. Nếu mở lại bằng app **AddOns Maker** rồi xuất lại (file `.data` trong BP), app có thể ghi đè các thay đổi này.
- `spawn_rules/pa_giraffee.json` (của bản gốc, cho mob không có trong pack) bị lỗi JSON từ trước; mình không động vào.
