# The Harvester v1.4.0 — Thần Chết × Bác sĩ Dịch hạch

Boss **The Harvester** (`pa:harvester`) được làm lại theo ý tưởng **Thần Chết** (lưỡi hái, linh hồn, xích địa ngục, bàn tay
xương, đồng hồ cát, bia mộ) kết hợp **Bác sĩ Dịch hạch** (mặt nạ mỏ chim, khí độc, dịch hạch).
Bản 1.4 làm boss **trâu hơn**, bỏ hết chữ trên màn hình (action bar, thông báo chuyển giai đoạn), cho chiêu **đánh vào mục tiêu
boss đang nhắm** (kể cả mob), thay 4 chiêu nhạt bằng 5 chiêu Thần Chết mới và vẽ thêm 9 particle.

- Cài đặt: mở [`dist/TheHarvester_v1.4.0.mcaddon`](dist/TheHarvester_v1.4.0.mcaddon) (Minecraft tự nhập cả 2 pack).
  Nếu đã cài bản cũ (1.2 / 1.3.x): vào **Cài đặt → Bộ nhớ**, xoá các pack *The Harvester* cũ, nhập file 1.4.0,
  rồi trong thế giới bật lại cả Behavior Pack lẫn Resource Pack **1.4.0**.
- Kiểm tra nhanh: boss có **1000 máu** (bản cũ 600), và không còn chữ nào hiện trên action bar khi đánh boss.
  Nếu vẫn thấy thì thế giới còn dùng pack cũ.
- Yêu cầu: Minecraft Bedrock **1.21.90+** (giống bản gốc), không cần bật Experiments.
- Gọi boss: `/summon pa:harvester`, hoặc gặp tự nhiên ở The End như trước.

![Các tư thế chiêu của boss](previews/skills.png)

## Bộ chiêu

Boss có **3 giai đoạn**. Mỗi chiêu đều có **cảnh báo** (vết nứt hư không, vòng tròn, đường kẻ dưới đất, đầu lâu...) trước khi
gây sát thương, và boss **đứng yên** trong lúc vung chiêu nên có thể né.

**Chiêu nhắm vào mục tiêu của boss.** Mục tiêu là thứ vừa đánh boss hoặc vừa bị boss đánh, **người chơi hay mob đều được**
(iron golem, sói đã thuần, boss khác...). Không có ai như vậy thì boss nhắm người chơi gần nhất trong 32 ô.
Chiêu gây sát thương cho mục tiêu đó, cho các mob đang đánh boss (trong 30 giây gần nhất) và cho người chơi đứng trong vùng chiêu.
Lính của boss (Plague Thrall) không bị chiêu của boss đánh trúng.

### Giai đoạn 1 — "Doctor of the Dead" (100% → 60% máu)

| Chiêu | Mô tả | Cách né |
|---|---|---|
| **Reaping Arc** (Nhát Gặt) | Kéo lưỡi hái ra sau rồi quét thấp từ phải sang trái, hình quạt ~125°, bán kính 6.5 (7.5 ở GĐ3). 10 sát thương, hất lùi, +1 dịch hạch, để lại vết nứt dưới đất. | Ra khỏi vùng quạt xanh ngọc dưới đất. |
| **Phantom Scythes** (Lưỡi Hái Ma) — *mới* | Vung tay ném 3 / 4 / 5 lưỡi hái ma (theo giai đoạn) thành hình quạt về phía mục tiêu. Lưỡi hái xoay bay ra rồi **quay về tay boss như boomerang**, chém cả lượt đi lẫn lượt về: 6 sát thương mỗi lượt, lượt đi thêm chậm II và +1 dịch hạch. | Đường bay kẻ sẵn dưới đất: né ngang ra khỏi vạch, và coi chừng lượt quay về. |
| **Death's Step** (Bước Tử Thần) | Đầu lâu hiện dưới chân mục tiêu → boss tan vào khói → hiện ra **sau lưng** mục tiêu và chém chữ X: 9 sát thương, chậm, +1 dịch hạch. | Thấy đầu lâu thì quay lại / chạy ngang. |
| **Chains of the Damned** (Xích Địa Ngục) — *mới* | Chĩa tay vào mục tiêu: **vết nứt hư không** mở dưới chân nó, 0.4 giây sau **xích** trồi lên trói người đứng trong đó (đứng im 0.6 giây, yếu đi, 5 sát thương phép), rồi boss **giật xích kéo về** (+5 sát thương) và **chém Reaping Arc ngay lập tức**. | Bước ra khỏi vòng tím trong 0.4 giây. Bị kéo rồi thì nhảy lùi khỏi vùng quạt. |

### Giai đoạn 2 — "Epidemic" (60% → 30%), thêm:

| Chiêu | Mô tả | Cách né |
|---|---|---|
| **Hands of the Underworld** (Bàn Tay Âm Phủ) — *mới* | Giơ hai tay rồi đập xuống: 5 vết nứt hư không (7 ở GĐ3) lần lượt mở dưới chân mục tiêu, **đón đầu hướng chạy**. 0.7 giây sau mỗi vết nứt, **bàn tay xương** trồi lên tóm lấy: 7 sát thương, chậm III 2 giây, +1 dịch hạch. | Chạy liên tục và **đổi hướng** (chiêu đoán trước hướng bạn chạy). |
| **Soul Rend** (Xé Hồn) — *mới* | Chỉ đánh **mục tiêu**: đầu lâu hiện trên đầu, xích hồn nối vào tay boss, 0.8 giây sau boss **giật linh hồn ra**: sát thương phép = 12% máu tối đa (6 → 40), boss **hồi gấp đôi** số đó; nạn nhân bị yếu II, chậm II, bóng tối. | Boss chỉ dùng khi bạn trong 10 ô. Kịp chạy xa hơn **13 ô** trước khi bị giật thì xích đứt. |
| **Graves of the Plagued** (Mộ Dịch) | Cắm lưỡi hái xuống đất: bia mộ và vết nứt mở quanh mục tiêu / người chơi, bàn tay xương trồi lên, rồi **Plague Thrall** (husk, bogged; GĐ3 thêm wither skeleton) bò ra. Tối đa 8 con, chết theo boss. | Đánh lính hoặc tránh xa bia mộ. |
| **Plague Aura** (nội tại) | Đứng sát boss (3.5 ô) bị nhiễm +1 dịch hạch mỗi 3 giây. Đòn đánh thường cũng lây dịch. | Đừng đứng dính boss quá lâu. |

### Giai đoạn 3 — "Final Harvest" (dưới 30%), thêm:

| Chiêu | Mô tả | Cách né |
|---|---|---|
| **Death Sentence** (Bản Án Tử) | Chĩa lưỡi hái vào tối đa 4 kẻ địch (mục tiêu luôn bị chọn trước): **đồng hồ cát** chạy 4 giây trên đầu, hết cát thì một **lưỡi hái ma** giáng xuống. Sát thương = 6 + 3 × số dịch hạch (dịch hạch bị tiêu hết). | Uống **sữa** để xoá dịch hạch trước khi hết cát. |
| **Shadow Reapers** (Bóng Tử Thần) — *mới* | Giơ lưỡi hái gọi **4 bóng Thần Chết** đứng quanh mục tiêu (cách 5 ô) thành hình chữ thập, đường lao vẽ tím dưới đất. 1 giây sau cả bốn **lao xuyên qua tâm**, chém chữ X: 12 sát thương, héo II, +1 dịch hạch cho ai đứng trên đường lao. | Bước chéo ra **giữa hai vạch** (khe của chữ thập) hoặc ra khỏi vùng 5.5 ô. |
| **The Black Death** (Cái Chết Đen) | Boss bay lên, khí đen và mưa dịch phủ vùng bán kính 16. Vài **đèn lồng linh hồn** hiện ra, mỗi cái có vòng sáng bán kính 2.5. Sau 3.6 giây: 14 sát thương phép + 2 dịch hạch cho ai đứng ngoài ánh đèn. | Chạy vào vòng sáng của một đèn lồng. |
| **Final Harvest** (Mùa Gặt Cuối) | Chiêu cuối: vòng rune đỏ, lưỡi hái xoay trên đầu 2 giây rồi **xoay người 360°**, mặt đất nứt toác. Trúng ở khoảng 3 → 11.5 ô: 18 sát thương, héo, boss hồi máu theo số kẻ trúng. | Đứng **sát boss** (vòng xanh bên trong) hoặc ra **ngoài** vòng đỏ. |

**Đã bỏ** (quá nhạt): Plague Flask (ném bình), Murder of Crows (bầy quạ), Pestilence Nova (sóng dịch), Soul Harvest (hút máu bằng xích).

### Cơ chế Dịch Hạch (Plague)

- Hầu hết chiêu cộng **stack dịch hạch**, hiện bằng biểu tượng mặt nạ mỏ chim và các ô vuông trên đầu nạn nhân (không dùng action bar).
- Đủ **5 stack** thì phát dịch (**Black Death pop**): 6 sát thương phép, héo 3s, buồn nôn 4s, rồi stack về 0.
- Không bị nhiễm thêm trong 6 giây thì cứ 3 giây mất 1 stack. **Uống sữa** xoá sạch. Boss chết cũng xoá hết.

### Độ trâu, giai đoạn, Enrage

- **1000 máu** (bản cũ 600). Kháng **Resistance I** (−20% sát thương) từ đầu, **Resistance II** (−40%) ở GĐ3 và khi enrage.
- **Miễn** sát thương rơi, lava, lửa, magma, chết đuối, ngạt, héo, đóng băng, xương rồng; **không bị đẩy lùi**;
  cung / nỏ / đinh ba chỉ gây 60% sát thương, nổ (TNT, crystal...) 50%. Bỏ "đứng trong lava mất 4 máu/tick" của bản gốc.
- Mỗi giai đoạn mạnh hơn: GĐ2 Speed I + Strength I, GĐ3 Speed II + Strength II + kháng lửa; sát thương chiêu ×1.15 / ×1.25 / ×1.4;
  hồi chiêu ×1 / ×0.85 / ×0.7; nghỉ giữa hai chiêu 2 / 1.5 / 1.1 giây.
- Chuyển giai đoạn: boss **gầm lên** (bất tử 2.2 giây), sóng xung kích đẩy lùi, mặt đất nứt, tên trên thanh máu đổi
  *Doctor of the Dead → Epidemic → Final Harvest*. **Không còn chữ / chat thông báo** trên màn hình.
- **Enrage** sau 5 phút chiến đấu: Strength III, hồi chiêu ×0.5, sát thương chiêu ×1.6, nghỉ giữa chiêu 0.7 giây.
  Đồng hồ enrage chỉ chạy khi đang đánh và **reset** nếu 30 giây không có ai.
- Không có ai trong 32 ô suốt 30 giây thì boss **tự hồi 1% máu mỗi giây**: bỏ chạy về hồi máu rồi quay lại không còn dễ.
- **Shadow Blink**: bị đánh có 7% dịch chuyển ra sau lưng kẻ đánh (tối đa 8 giây một lần, không dùng khi đang vung chiêu).
- **Soul Toll**: người chơi chết gần boss làm boss hồi 3% máu.
- Boss không rời xa quá 50 ô khỏi chỗ xuất hiện (bị kéo về + hồi 20 máu, như bản cũ).
- Chữ còn lại trên màn hình: cảnh báo của 3 chiêu cần né theo cách riêng (*SENTENCED*, *THE BLACK DEATH*, *FINAL HARVEST*,
  chỉ hiện cho người chơi ở gần) và dòng *THE HARVESTER FALLS* khi boss chết.

## Animation (18)

`idle` (lơ lửng, áo choàng bay, viên ngọc đập như tim), `move` (lướt, người đổ về trước, áo và lưỡi hái kéo phía sau),
`attack` (bổ lưỡi hái từ trên xuống, tự phát khi boss đánh thường), `spawn` (trồi lên từ lòng đất), `death` (gục xuống, tan biến),
`phase_roar`, và 12 animation chiêu: `skill_reap`, `skill_throw`, `skill_vanish`, `skill_ambush`, `skill_chains`, `skill_hands`,
`skill_rend`, `skill_summon`, `skill_sentence`, `skill_reapers`, `skill_blackdeath`, `skill_ultimate`.

- Mới ở 1.4: `skill_throw` (vung ngược tay ném lưỡi hái), `skill_chains` (chĩa tay rồi giật xích về), `skill_hands` (giơ hai tay
  đập xuống đất), `skill_rend` (vồ tới rồi giật linh hồn ra), `skill_reapers` (giơ cao lưỡi hái gọi bóng rồi chĩa vào mục tiêu).
- Keyframe dùng nội suy Catmull-Rom (mượt như key "smooth" của Blockbench), mở được trong Blockbench để chỉnh.
- Model được thêm **locator** (`blade`, `blade_tip`, `gem`, `eyes`, `hand_left`, `hand_right`, `feet`) để particle bám theo lưỡi hái,
  viên ngọc, mắt... Hình dáng model và texture **không đổi**.
- Đầu boss quay theo mục tiêu (`look_at_target`).

## Particle (38)

![Sprite của các particle](previews/particles.png)

Vẽ **cùng phong cách với các addon khác trong repo** (Darkin Blade của Aatrox, Toji, Giant Zombie): pixel cạnh sắc,
mỗi hiệu ứng một dải 4–5 màu (linh hồn: trắng → xanh ngọc → xanh đậm; dịch hạch: vàng lục → xanh rêu; hư không: tím than viền
xanh ngọc), tô theo "độ nóng" thành từng dải phẳng, và flipbook vỡ vụn thành pixel rời ở các khung cuối.

**Mới ở 1.4 (9):** `phantom_scythe` (lưỡi hái ma xoay khi bay), `chain_rise` (cột xích trồi lên), `bone_hand` (bàn tay xương
trồi từ đất, 3 khung), `void_rift` (vết nứt hư không xoáy rồi vỡ, 3 khung), `phantom_reaper` (bóng Thần Chết áo choàng tím),
`x_slash` (vết chém chữ X, 3 khung), `ground_crack` (mặt đất nứt toác phát sáng), `death_mark` (đầu lâu đánh dấu nạn nhân),
`soul_flames` (lửa linh hồn bùng lên).

Tất cả nằm trong `TheHarvesterRP/particles/harvester_*.json`, dùng chung atlas `textures/particle/harvester_particles.png`:
linh hồn (`soul_wisp`, `soul_burst`, `soul_stream`, `soul_pillar`, `soul_flames`), lưỡi hái (`scythe_trail`, `scythe_trail_big`,
`spectral_scythe`, `phantom_scythe`, `x_slash`), Thần Chết (`phantom_reaper`, `death_mark`, `bone_hand`, `void_rift`, `ground_crack`),
khí dịch (`miasma`, `blackdeath_field`, `aura_mist`, `black_rain`, `black_smoke`, `plague_drip`, `plague_splash`),
cảnh báo dưới đất (`ground_warn`, `ring_warn`, `rune_circle`, `shockwave`, `skull_sigil`), đánh dấu trên đầu (`plague_pips`,
`hourglass`, `beak_sigil`), bia mộ (`grave_rise`, `dirt_burst`), đèn lồng (`lantern`), xích (`chain_link`, `chain_rise`),
tia lửa (`ember`, `gem_pulse`, `eye_glow`).

Đã xoá theo các chiêu bị bỏ: `flask`, `glass_shards`, `crow`, `crow_flock`, `feathers`, `miasma_field`.

## Harvester Scythe (vũ khí rơi ra)

Giữ nguyên chỉ số, chỉ sửa lỗi và đổi hiệu ứng:
- **Sửa lỗi Soul Harvest không bao giờ hoạt động**: code cũ gây sát thương ngay trong `beforeEvents` (chế độ chỉ đọc) nên bị lỗi âm thầm.
- Shadow Reap / Soul Harvest / Soul Explosion / Death Mark dùng particle mới (vòng rune, vệt chém, linh hồn bay về người dùng, đầu lâu đánh dấu).
- Soul Explosion chỉ nổ khi có kẻ địch trong tầm (bản cũ nổ và báo chat mỗi 20 giây), và các chiêu diện rộng
  **không còn đánh dân làng, thương nhân, giáp đứng hay thú đã thuần**.
- Kill bằng chiêu của lưỡi hái giờ cũng tính cho Dark Blessing.
- Bỏ dòng hồi chiêu trên action bar (1.4). Dùng chiêu khi chưa hồi xong thì chat vẫn báo số giây còn lại.

## Bản 1.4.0 — boss trâu hơn, chiêu Thần Chết mới, bỏ chữ trên màn hình

- **Trâu hơn:** 1000 máu, Resistance I → II, miễn lửa/lava/rơi/ngạt..., không bị đẩy lùi, giảm sát thương từ đạn và nổ,
  tự hồi máu khi không bị đánh. Sát thương chiêu và tốc độ ra chiêu tăng theo giai đoạn.
- **Bỏ action bar:** không còn thanh thông tin boss (giai đoạn, % máu, dịch hạch, đồng hồ enrage) và dòng hồi chiêu của Harvester Scythe.
- **Bỏ thông báo chuyển giai đoạn:** không còn title / chat khi boss xuất hiện, chuyển giai đoạn, enrage hay phát dịch.
- **Chiêu nhắm đúng mục tiêu:** boss theo dõi thứ nó đang đánh (người hoặc mob), mọi chiêu nhắm vào đó và gây sát thương lên cả mob.
  Bản cũ chỉ tìm người chơi, mob đánh boss thì chiêu không trúng.
- **5 chiêu mới:** Phantom Scythes, Chains of the Damned, Hands of the Underworld, Soul Rend, Shadow Reapers.
  **Bỏ 4 chiêu:** Plague Flask, Murder of Crows, Pestilence Nova, Soul Harvest.
- **5 animation mới, 9 particle mới** (xem trên). Death's Step, Graves, Final Harvest và chuyển giai đoạn dùng thêm particle mới.

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
│   ├── particles.py    atlas + 38 file particle JSON
│   ├── animations.py   18 animation, controller, locator (có ghi chú hướng xoay của từng xương)
│   ├── render.py       renderer nhỏ để xem trước model/animation
│   ├── previews.py     ảnh trong previews/
│   ├── cleanup.py      liệt kê (hoặc xoá với --apply) file không dùng tới
│   └── simulate.mjs    chạy thử script trên mock @minecraft/server qua cả trận đấu
└── dist/TheHarvester_v1.4.0.mcaddon
```

- `python3 build.py` (cần `pip install pillow numpy`), thêm `--previews` để vẽ lại ảnh xem trước.
- `node tools/simulate.mjs`: nạp **toàn bộ** script qua `main.js` với đúng danh sách event/export của phiên bản
  `@minecraft/server` ghi trong manifest, rồi đánh giả lập ~17 phút (GĐ1 → GĐ2 → GĐ3 → enrage → boss chết, boss vào thẳng GĐ3,
  chỉ có người chơi Creative / Spectator, boss đánh nhau với iron golem mà không có người chơi). Báo: script không nạp được,
  lỗi không bắt, lỗi bị `try/catch` nuốt, particle thiếu biến Molang, animation không tồn tại, component item chưa đăng ký,
  lệnh ghi trong chế độ chỉ đọc, chiêu không trúng mob đang đánh boss, chữ trên action bar hoặc title ngoài danh sách cho phép.
- Chỉnh sát thương, hồi chiêu, tầm: `CONFIG` ở đầu `TheHarvesterBP/scripts/harvester.js`.

## Lưu ý

- Mình chưa chạy được bản này trong Minecraft thật (chỉ chạy giả lập ở trên). Nếu thấy chiêu nào lệch hướng hay particle sai cỡ, báo mình để chỉnh.
- Pack được sửa trực tiếp. Nếu mở lại bằng app **AddOns Maker** rồi xuất lại, app có thể ghi đè các thay đổi này (file `.data` của app đã được xoá khỏi pack).
