# Thiên Nghịch Mâu (Inverted Spear of Heaven) — Addon Toji cho Minecraft Bedrock

Addon thêm **Thiên Nghịch Mâu** (`toji:inverted_spear`) của Toji Fushiguro (Jujutsu Kaisen), bộ chiêu theo kiểu JJS.
Viết bằng Script API `@minecraft/server` 2.0.0, **không cần bật Beta APIs / experiments**.
Yêu cầu: Minecraft Bedrock **1.21.90 trở lên** (PC, điện thoại, console). Phiên bản hiện tại: **v1.1.0**.

![Mô hình 3D](preview.png)

## Cài đặt

1. Tải [`dist/TojiInvertedSpear.mcaddon`](dist/TojiInvertedSpear.mcaddon) và mở nó, Minecraft tự nhập cả 2 pack.
2. Tạo/sửa world → **Behavior Packs** → bật *Toji - Inverted Spear of Heaven (BP)* (Resource Pack tự bật theo).
3. Lấy mâu:
   - Lệnh: `/give @s toji:inverted_spear`
   - Chế tạo (bàn chế tạo, không cần xếp hình): **Trident + Echo Shard + Chain + Amethyst Shard**
   - Creative: Equipment → Swords.

> **Đã cài bản 1.0.0?** Vào **Settings → Storage**, xoá hết pack Toji cũ rồi nhập lại file `.mcaddon`.
> Bản 1.0.0 có lỗi: mâu không nằm trong tay (thiếu gắn vào xương tay) và mâu quá to.

## Cách kích hoạt chiêu

| Thao tác | Chiêu | Tác dụng |
|---|---|---|
| **Chuột phải** (điện thoại: chạm màn hình / nút Dùng) | **Đâm Vô Hiệu** | Lùi mâu về hông rồi lao tới đâm thẳng, xuyên mọi mục tiêu trên đường 5.5 ô, **xoá sạch hiệu ứng có lợi** của mục tiêu (Resistance, Regeneration, Absorption, Strength, Invisibility...). Hồi 5s |
| **Khuỵu (Shift) + chuột phải** | **Xích Vạn Lý** | Vung qua đầu rồi ném mâu theo xích về hướng nhìn (22 ô), **trên tay chỉ còn sợi xích** cho tới khi mâu quay về. Trúng địch: sát thương, choáng, vô hiệu và **giật địch về**. Trúng tường/đất: **tự kéo mình tới đó** (móc câu). Hồi 10s |
| **Chạy + chém** (chạy nhanh rồi đánh trúng mob/khối, hoặc chạy + chuột phải) | **Thiên Dữ Tốc Trảm** | Lướt xuyên qua kẻ địch, mỗi mục tiêu bị 3 nhát chém rồi bị hất ra. Hồi 6s |
| **Cầm mâu 20 giây** | **Thiên Dữ Chú Phược: Thức Tỉnh** | Tự kích hoạt khi cầm liên tục đủ 20s: 15s Speed II, Strength II, Jump Boost II, Resistance I, sát thương chiêu x1.3, hồi chiêu giảm một nửa. Mâu phát sáng tím, gió trắng bốc quanh người |
| **Cầm 20 giây + nhảy** (khi đang Thức Tỉnh) | **Giáng Thiên Nhất Kích** | Nhảy vọt lên, giơ mâu lên trời, lật mũi xuống rồi cắm xuống đất: vùng 6 ô, 18 sát thương (x1.3), hất tung, choáng, vô hiệu mọi thứ trong vùng. Không mất máu khi rơi. 1 lần mỗi lần Thức Tỉnh |
| **Đánh thường 4 lần liên tiếp** | **Combo M1 + Đòn Kết Liễu** | Đòn thứ 4 là cú xoay chém hình cung trước mặt, hất văng kẻ địch (như M1 trong JJS) |
| **Mọi đòn đánh** | **Nội tại: Vô Hiệu Hoá** | Đòn đánh thường cũng xoá hiệu ứng có lợi của mục tiêu |

- Thanh phía trên hotbar hiện tiến độ cầm `▮▮▮▮▯▯ 12/20s`, chiêu mà chuột phải sẽ dùng (`Bấm: Đâm / Xích / Trảm`), số combo và thời gian hồi chiêu.
- **Buông mâu (đổi sang ô khác) sẽ reset bộ đếm 20s và kết thúc Thức Tỉnh** (mất luôn buff). Hết Thức Tỉnh thì phải cầm lại 20s.
- Chữ trong game (chat, tiêu đề, thanh hồi chiêu, tên mâu) **tự theo ngôn ngữ game**: tiếng Việt nếu game để tiếng Việt, còn lại là tiếng Anh.
  Riêng dòng mô tả khi rê chuột vào mâu thì chọn bằng `loreLanguage` trong `config.js` (`"vi"` hoặc `"en"`).
- Gõ `/scriptevent toji:help` để xem lại hướng dẫn.
- Chuột phải vào rương, cửa, bàn chế tạo, dân làng, ngựa... vẫn dùng bình thường, không ra chiêu.

## Hiệu ứng: particle custom + animation

![Particle](preview_particles.png)

17 particle tự vẽ bằng pixel art (`TojiRP/particles`), phần lớn là flipbook nhiều khung:

| Particle | Dùng cho |
|---|---|
| `toji:thrust` | Vệt đâm bắn theo hướng nhìn (Đâm Vô Hiệu, lúc lao xuống của Giáng Thiên) |
| `toji:null_ring` / `toji:null_ground` | Vòng rune tím nứt vỡ, gai hướng vào tâm, trên mục tiêu / dưới đất khi bị vô hiệu |
| `toji:shard` | Mảnh kính tím vỡ tung (hiệu ứng của mục tiêu bị phá) |
| `toji:spear` + `toji:chain_link` | Mâu bay (mũi luôn hướng theo đường bay) và sợi xích nối về tay |
| `toji:slash` | Vết chém thép trắng-tím (Tốc Trảm, đòn kết liễu, vòng chém khi Giáng Thiên chạm đất) |
| `toji:afterimage` | Bóng mờ Toji để lại khi lướt |
| `toji:aura` / `toji:charge` | Gió trắng bốc lên khi Thức Tỉnh / gió tụ vào mâu trước khi Thức Tỉnh và khi đâm |
| `toji:shock_ring`, `toji:crack`, `toji:dust`, `toji:debris` | Sóng xung kích, nứt đất, bụi, đá văng |
| `toji:flash`, `toji:spark`, `toji:blood` | Chớp sáng, tia lửa thép, máu |

**Animation người chơi** (`TojiRP/animations/toji_player.animation.json`, tạo bởi `player_anims.py`), bản thân thấy góc nhìn thứ nhất, người khác thấy góc nhìn thứ ba:

| Animation | Chuyển động |
|---|---|
| `thrust` | Lùi mâu về hông → lao người đâm thẳng → giữ → thu về |
| `throw` | Vung mâu qua đầu → ném về trước (mâu rời tay đúng lúc vung) |
| `rush` | Lao thấp → chém ngang phải sang trái → chém trái tay → bổ dọc |
| `finisher` | Xoay người lấy đà → quét mâu một vòng cung sang trái |
| `awaken` | Khuỵu gối tụ lực → đứng dậy vào thế cầm ngược mâu |
| `plunge` | Khuỵu → nhảy giơ mâu lên trời → lật mũi xuống → cắm xuống đất |

Ngoài ra còn rung màn hình, chớp màn hình khi Thức Tỉnh / Giáng Thiên, và âm thanh cho từng chiêu.

**Mô hình 3D**: lưỡi thẳng hai cạnh với sống tím, móc phụ bên cạnh lưỡi (kiểu jitte), chắn kiếm tối màu, chuôi quấn vải tím với đai đồng,
vòng đồng ở đuôi nối các mắt xích. Có 3 dạng: thường, **Thức Tỉnh** (thêm lớp phát sáng `entity_emissive` dọc cạnh lưỡi, sáng cả ban đêm)
và **Đã ném** (trên tay chỉ còn sợi xích). Script tự đổi dạng và giữ nguyên độ bền, phù phép, tên của mâu.

## Tuỳ chỉnh

- Mọi thông số (sát thương, hồi chiêu, tầm, thời gian cầm 20s, combo, PvP...) nằm trong [`TojiBP/scripts/config.js`](TojiBP/scripts/config.js).
- Tư thế cầm và kích thước mâu: `HOLD` trong [`packs.py`](packs.py). Chữ trong game: `LANG` trong `packs.py`.
- Sau khi sửa, chạy `python3 build.py` để tạo lại mọi file và `.mcaddon` (`python3 preview.py` để vẽ lại ảnh xem trước, cần Pillow).
- Nếu nhập lại vào game, tăng `VERSION` trong `packs.py` (Minecraft giữ bản cũ nếu trùng số phiên bản).

## Kiểm tra

Không cần mở game, [`test/sim.mjs`](test/sim.mjs) chạy chính `main.js` với một bản giả lập của `@minecraft/server`
và thử lần lượt: chuột phải, khuỵu + chuột phải (trúng địch và móc vào tường), chạy + chém, combo 4 đòn, cầm 20s, cầm 20s + nhảy,
đổi ô khi đang Thức Tỉnh / đang lao xuống, và bị choáng thì không ra chiêu được (48 bước kiểm tra):

```
node test/sim.mjs
```

Bản giả lập không có vật lý thật (hất văng, rơi chỉ được ghi lại), nên cảm giác trong game vẫn cần thử trực tiếp.

## Cấu trúc

```
toji/
├── TojiBP/             Behavior pack: items (3 dạng mâu), recipe, scripts/main.js + config.js
├── TojiRP/             Resource pack: attachables, animations, model .geo.json, 17 particle, textures, texts (vi_VN, en_US)
├── packs.py            manifest, items, recipe, attachables, tư thế cầm, file ngôn ngữ
├── model.py            dựng model 3D từ các khối + vẽ texture pixel art + icon
├── particles.py        vẽ atlas particle + file JSON particle
├── player_anims.py     thiết kế + giải ngược animation người chơi
├── build.py            chạy tất cả và đóng gói dist/TojiInvertedSpear.mcaddon
├── preview.py          vẽ preview.png / preview_particles.png
├── test/               giả lập @minecraft/server + kịch bản thử mọi chiêu
└── dist/TojiInvertedSpear.mcaddon
```

## Sửa lỗi

- **Bấm không ra chiêu, không có thanh hồi chiêu trên hotbar:** script chưa chạy. Kiểm tra đã bật **Behavior Pack** (không chỉ Resource Pack) và game từ **1.21.90** trở lên.
- **Mâu hiện thành hình phẳng 2D hoặc không nằm trong tay:** Resource Pack chưa bật hoặc còn bản cũ, xem mục *Đã cài bản 1.0.0?*.
- **Giáng Thiên không ra khi nhảy:** chỉ dùng được khi đang Thức Tỉnh (thanh hotbar hiện `THỨC TỈNH`), 1 lần mỗi lần Thức Tỉnh, và không dùng được ngay trong lúc đang ra chiêu khác.

Đây là mô hình/texture tự làm lấy cảm hứng từ Thiên Nghịch Mâu, không chứa hình ảnh gốc của Jujutsu Kaisen.
