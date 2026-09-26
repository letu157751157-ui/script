# Boss YETI v2.0 — Nâng cấp kỹ năng, particle và animation

Bản nâng cấp toàn diện cho addon **boss-YETI v1.2** (tác giả gốc: YTAUN): viết lại bộ kỹ năng của boss,
thêm bộ particle băng tự vẽ và animation riêng cho từng chiêu.

- **Tải về:** [`dist/boss-YETI_v2_0.mcaddon`](dist/boss-YETI_v2_0.mcaddon), mở file là Minecraft tự nhập cả 2 pack.
- **Nâng cấp từ v1.x:** trong thế giới, gỡ pack boss-YETI cũ rồi bật bản **2.0.0**. Nếu vẫn thấy chiêu cũ, vào
  **Cài đặt → Bộ nhớ**, xoá các pack boss-YETI cũ rồi nhập lại file `.mcaddon`.
- Yêu cầu giống bản v1.2: Script API `@minecraft/server` 2.7.0, không cần bật Experiments.

## Có gì mới

| | v1.2 | v2.0 |
|---|---|---|
| Chiêu của boss | Nhiều chiêu có thể nổ **cùng 1 tick**, không báo trước, gây sát thương ngay | Mỗi lần 1 chiêu, **có vòng/ô cảnh báo đỏ** trên đất, né được |
| Particle | Particle vanilla (snowflake, explosion...) | **32 particle băng** tự vẽ (pixel art) + particle vanilla |
| Animation | 2 animation chiêu (ice_spike, attack_2) | **18 animation chiêu** + animation hấp hối, gai băng trồi lên |
| Chuyển pha | Pha mới hiện ra lặng lẽ | Trồi dậy + gầm, bất tử 3 giây, tiêu đề **Pha 2 / Pha 3** |
| Dimension | Chỉ chạy ở Overworld | Chạy ở mọi dimension |

## Các pha

| Pha | Máu | Đặc điểm |
|---|---|---|
| `ytaun:yeti_1` **YETI** | 1000 | Gầm lên khi thấy người chơi. 8 chiêu cơ bản. |
| `ytaun:yeti_2` **YETI TRƯỞNG THÀNH** | 500 | Thêm bão tuyết, khe nứt, lốc xoáy, sóng băng, động đất, Absolute Zero. |
| `ytaun:yeti_3` **YETI CỔ ĐẠI** | 500 | Đủ bộ chiêu + xiềng băng, mưa pha lê, bùng nổ băng, hơi thở băng, giáp băng. |
| `ytaun:yeti_death` **YETI HẤP HỐI** | 50 | Nửa người vùi trong băng, không di chuyển, tung chiêu liên tục. Hạ nó để thắng. |

- Dưới **35% máu**, Yeti **nổi giận**: gầm lên, ra chiêu nhanh hơn, hồi chiêu ngắn hơn, quanh người bốc lửa băng xanh.
- Nội tại giữ nguyên như v1.2: giáp (giảm 25/30/35% sát thương từ người chơi), sát khí lạnh (làm chậm người đứng gần),
  tự hồi 2% máu/giây khi 6 giây không bị đánh, hồi 15% máu khi hạ gục người chơi (giờ tính cả khi chết vì chiêu).

## Bộ chiêu

Ô/vòng **đỏ** trên mặt đất = chỗ sắp trúng đòn. Vòng đỏ lan dần từ tâm ra, **chạm viền là đòn rơi xuống**.

| Chiêu | Pha | Animation | Cách né / phản công |
|---|---|---|---|
| **Cầu Băng** — ném cầu băng đón đầu; pha 2+: 3 quả toả quạt; pha 3: cầu vỡ thành 4 mảnh | 1 2 3 | Vặn người, vung tay ném | Đổi hướng chạy đột ngột |
| **Nhảy Đập** — nhảy vòng cung tới chỗ bạn, đập đất; pha 3: vòng gai băng quanh điểm rơi | 1 2 3 | Ngồi thụp, giơ nắm đấm trên không, nện xuống | Chạy ra khỏi vòng đỏ |
| **Tiếng Gầm Băng Giá** — 4 đợt sóng làm chậm + mỏi tay; pha 2+: sát thương, đẩy lùi | 1 2 3 | Cúi lấy đà, ngửa ra gầm, hàm mở rộng | Giữ khoảng cách |
| **Đóng Băng Mặt Đất** — vùng băng 4 giây làm chậm, mất máu dần | 1 | Nhấc chân dậm đất | Ra khỏi vòng đỏ |
| **Gai Băng** — các hàng gai băng mọc lần lượt về phía bạn | 1 2 3 | Hai nắm đấm nện đất | Ô đỏ đánh dấu chỗ từng gai sẽ mọc |
| **Lao Đánh** — cào chân như bò tót rồi lao thẳng; trượt thì phóng 1 hàng gai | 1 2 3 | Cào chân, chạy, móc lên | Né khỏi hàng ô đỏ. **Lao vào tường → Yeti tự choáng** |
| **Hồi Phục Băng** — quỳ xuống trong vỏ pha lê, hồi máu 6 giây | 1 2 3 | Quỳ, ôm ngực, thở dốc | **Gây đủ 6–8% máu tối đa → vỏ vỡ, Yeti choáng** |
| **Triệu Hồi / Đội Quân Tinh Nhuệ** — vòng rune băng dưới đất, lính chui lên (có giới hạn số lính) | 1 2 3 | Giơ tay lên trời rồi quét xuống | Diệt lính; lính tan biến khi thắng boss |
| **Bão Tuyết** — bão bám theo Yeti, băng nhọn rơi từ trời quanh người chơi | 2 3 | Giơ tay gọi bão | Mỗi cột băng có vòng đỏ báo trước |
| **Khe Nứt Sông Băng** — vết nứt chạy tới bạn, cột băng phun lên hất tung | 2 3 | Nện đất | Né khỏi hàng ô đỏ |
| **Lốc Xoáy Cực** — xoay tròn 5 giây, hút người chơi vào tâm | 2 3 | Thân trên xoay tít, tay dang rộng | Chạy ngược ra ngoài vòng |
| **Sóng Sông Băng** — tường băng lan ra theo vòng tròn | 2 3 | Nện hai tay | **Nhảy qua sóng** (đang trên không thì không trúng) |
| **Động Đất** — 3 cú rung mặt đất liên tiếp | 2 3 | Nện hai tay | **Nhảy đúng lúc** rung |
| **Absolute Zero** — tuyệt chiêu khi máu thấp: vòng băng khổng lồ + đếm ngược 3‑2‑1 | 2 3 | Bay lên vận khí, run bần bật, đập xuống | **Chạy ra khỏi vòng đỏ trước khi đếm hết** |
| **Xiềng Băng** — quăng xiềng trói, 1.5 giây sau giật về phía Yeti | 3 | Vung tay quăng, rồi giật mạnh | **Chạy ra khỏi vòng đỏ dưới chân** để giật đứt xiềng |
| **Mưa Pha Lê** — 6 viên pha lê xoay trên đầu rồi lần lượt lao xuống | 3 | Giơ tay gọi, chỉ tay phóng | Mỗi viên có vòng đỏ ở chỗ rơi |
| **Bùng Nổ Băng** — gom băng 1 giây rồi nổ quanh thân | 3 | Nện hai tay | Lùi ra khỏi vòng đỏ |
| **Hơi Thở Băng Giá** — phun hơi băng hình nón, quét trái sang phải | 3 | Hít sâu, cúi đầu phun, quét theo | Đứng sau lưng / ngoài hướng phun |
| **Giáp Băng** — 10 giây: giảm thêm 50% sát thương, phản 25% sát thương cận chiến | 3 | Bắt chéo tay rồi gồng lên | **Đánh trúng 12 đòn → giáp vỡ, Yeti choáng** |
| Dạng hấp hối: **Đập Băng**, **Bùng Nổ**, **Cơn Bão Cuối** | hấp hối | Hai nắm đấm nện xuống băng | Vòng đỏ báo trước |

Mọi đòn chỉ trúng mỗi người chơi **1 lần** (không còn bị nhiều gai cùng hất tung lên trời như bản cũ).

## Particle

![Particle](preview_particles.png)

32 particle `yeti:*` vẽ theo phong cách pixel art của Minecraft (bảng màu băng: trắng → xanh nhạt → xanh lam → xanh đậm),
phần lớn là flipbook nhiều khung hình:

| Nhóm | Particle |
|---|---|
| Cảnh báo | `warning_circle` (viền đỏ nhấp nháy nhanh dần), `warning_fill` (mảng đỏ lan tới viền), `warning_tile`, `dome_edge` (tường băng của Absolute Zero) |
| Va chạm | `ice_burst` (ngôi sao băng), `frost_ring` (sóng băng 3 khung: dày → mỏng → vỡ), `ice_crack` (đất nứt), `ice_shard` (mảnh băng rơi, nảy trên đất), `snow_dust`, `frost_mist`, `hit_spark`, `ice_pillar`, `light_beam` |
| Chiêu | `frost_orb` + `orb_trail`, `crystal`, `icicle`, `chain_link`, `breath`, `blizzard`, `vortex`, `charge_gather`, `rune_circle`, `glyph`, `heal`, `frost_field`, `frozen_mark` |
| Quanh boss (phía client) | `aura` (tuyết xoay quanh người), `aura_enraged` (lửa băng khi dưới 35% máu), `breath_puff` (hơi thở phả ra từ miệng — locator `mouth` mới trên hàm) |

## Animation

![Animation](preview_animation.png)

18 animation chiêu (`animation.yeti.*`) dùng chung cho mọi pha vì 4 model Yeti có cùng bộ xương chính.
Mỗi animation đủ nhịp **lấy đà → ra đòn → va chạm → dư chấn → hồi về**, lấy mẫu từ đường cong Catmull‑Rom mỗi 0.05 giây
nên chuyển động cong và mượt. Mốc va chạm trong animation khớp đúng tick sát thương trong script.

- **Gai băng** trồi lên có nảy quá đà, rung rồi lún xuống; mỗi chiếc nghiêng/xoay/to nhỏ khác nhau.
- **Yeti hấp hối** có animation thở dốc, lắc đầu, đấm xuống băng (bản cũ đứng im).
- Ảnh trên được vẽ từ chính model `yeti_1` bằng `tools/preview_anim.py` (không cần mở game).

## Vũ khí

| Vũ khí | Chuột phải | Đánh trúng |
|---|---|---|
| **Frozen Sword** | **Bước Băng**: Speed VIII 6 giây như cũ + lướt tới trước, để lại vệt tuyết | **Tê Cóng**: làm chậm như cũ; trúng cùng mục tiêu 3 lần trong 4 giây → băng vỡ tung (+5 sát thương) |
| **Frozen Scythe** | **Vệ Binh Băng**: Resistance II 3 giây + gọi tối đa 3 Yeti con đồng minh (60 giây, tối đa 5 con) + sóng băng làm chậm quái | Làm chậm + sóng băng nhỏ |
| **Ice Bar** | **Pháo Đài Băng**: Resistance II 5 giây + vòng gai băng 6 giây đẩy lùi quái | — |

Nội tại của Frozen Sword (cầm 20 giây / ngồi 4 giây) dùng hiệu ứng băng mới.

## Lỗi đã sửa

- Có thể tung 4–5 chiêu trong cùng 1 tick (không có khoá "đang thi triển" chung) → giờ mỗi lần 1 chiêu, nghỉ ngắn giữa 2 chiêu.
- Boss chỉ dùng chiêu ở Overworld → giờ ở mọi dimension.
- Sát thương chiêu không ghi nguồn → nội tại "hồi máu khi hạ gục" chỉ chạy với đòn đánh thường. Đã sửa.
- Các function summon `pa:yeti_pet`, `pa:yeti_boss_pet`, `pa:enderpet`, `pa:yeti_mage` (không có trong addon) → đổi sang `ytaun:*`
  hoặc bỏ dòng không có thực thể tương ứng. `yeti_1` không còn gọi summon mỗi lần đổi mục tiêu.
- Vũ khí dùng `@p` (người chơi gần nhất, có thể là người khác) → giờ áp dụng cho chính người dùng.
- `EntityDamageCause.suicide` (đã đổi tên trong Script API 2.x) → `selfDestruct` trong `durability_manager.js`.

## Tuỳ chỉnh

Mọi thông số nằm trong `PHASES` ở đầu [`boss-YETI_behavior_pack/scripts/yeti/boss.js`](boss-YETI_behavior_pack/scripts/yeti/boss.js):

- `damage`: hệ số sát thương mọi chiêu của pha đó (ví dụ `0.7` cho dễ hơn, `1.5` cho khó hơn).
- `armor`: % giảm sát thương nhận từ người chơi.
- `gcd`: khoảng nghỉ (tick) giữa 2 chiêu. `range`: tầm phát hiện người chơi.
- `kit`: danh sách chiêu — `cd` hồi chiêu (tick, 20 tick = 1 giây), `min`/`max` khoảng cách dùng chiêu,
  `hp` chỉ dùng khi máu dưới tỉ lệ này, `weight` độ ưu tiên. Xoá một dòng để tắt chiêu đó.

Số liệu riêng từng chiêu (bán kính, sát thương theo pha...) nằm trong [`scripts/yeti/skills.js`](boss-YETI_behavior_pack/scripts/yeti/skills.js).

## Cấu trúc

```
yeti/
├── boss-YETI_behavior_pack/scripts/
│   ├── yeti/boss.js     bộ não: chọn chiêu, pha, nội tại, chuyển pha, sự kiện
│   ├── yeti/skills.js   19 chiêu + 3 chiêu dạng hấp hối
│   ├── yeti/fx.js       particle, âm thanh, rung màn hình, vòng cảnh báo
│   └── item_trigger.js  kỹ năng vũ khí
├── boss-YETI_resource_pack/
│   ├── particles/yeti_*.json, textures/particle/yeti_particles.png   (sinh bởi tools/particles.py)
│   ├── animations/yeti_skills.animation.json                         (sinh bởi tools/animations.py)
│   └── animation_controllers/yeti_fx.animation_controllers.json      (hào quang, hơi thở, nổi giận)
├── tools/               particles.py, animations.py, preview_anim.py
└── build.py             sinh particle + animation + ảnh xem trước, đóng gói dist/boss-YETI_v2_0.mcaddon
```

Sửa particle/animation thì sửa file trong `tools/` rồi chạy `python3 build.py` (Python 3, không cần thư viện ngoài).
