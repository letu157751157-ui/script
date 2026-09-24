# Quỷ Kiếm Darkin — Addon Aatrox cho Minecraft Bedrock

Addon thêm thanh kiếm **Quỷ Kiếm Darkin** (`aatrox:darkin_blade`) với bộ chiêu mô phỏng Aatrox (LMHT),
viết bằng Script API `@minecraft/server` 2.0.0. **Không cần bật Beta APIs / thử nghiệm.**

Yêu cầu: Minecraft Bedrock **1.21.90 trở lên** (PC, điện thoại, console đều được).

![Model 3D Quỷ Kiếm Darkin](preview.png)

Khi cầm trên tay, kiếm hiển thị bằng **model 3D** (159 khối) với **texture pixel art đúng mật độ Minecraft**
(1 pixel texture = 1/16 block, bảng màu giới hạn, sáng trên-trái, tối dưới-phải, nhiễu dither như texture gốc của game).

### Thiết kế bám theo bản gốc

Hình dáng được dựng theo thanh kiếm của Aatrox sau bản làm lại năm 2018, đối chiếu từ nhiều nguồn:
- **Splash art gốc** (Victor Maury vẽ): dòng dung nham sáng chảy dọc giữa lưỡi và phân nhánh, lõi sáng ở gốc lưỡi, cụm sừng đen cong vươn lên hai bên.
- **Splash Sea Hunter và Justicar** (được vẽ lại theo mẫu kiếm mới trong đợt làm lại): mắt Darkin nằm ở chắn kiếm với móng vuốt ôm quanh, lưỡi rộng dần về phía mũi, mũi vát chéo, sống lưỡi răng cưa lớn và một ngạnh móc gần mũi.
- **Icon chiêu Q và nội tại**: khung kim loại tối màu viền ngoài lưỡi, lõi thịt đỏ thẫm bên trong.
- **Wiki và các bài giới thiệu bản làm lại** (Nexus, Polygon, Rift Herald): Aatrox là "chiến binh cầm đại kiếm", thanh kiếm là nhà tù sống chứa linh hồn hắn.

Từ đó model gồm:
- lưỡi rộng dần, **mũi vát chéo**, sống lưỡi có **4 răng cưa lớn** và **ngạnh móc** gần mũi, lưỡi bén có khía nhỏ
- **khung kim loại tối** viền ngoài (dày hơn lõi), **lõi thịt đỏ thẫm** lõm vào giữa
- **dòng dung nham phân nhánh như cây** chảy từ mắt lên gần mũi, hắt ánh cam lên phần thịt xung quanh
- **mắt Darkin đồng tử dọc** trong hốc thịt ở chắn kiếm, **cặp sừng đen** cong ôm hai bên gốc lưỡi, gai ngang và **móng vuốt** quặp phía dưới
- tay cầm dài quấn da (cầm hai tay) với 3 vòng kim loại, núm chuôi có gai

Dung nham và mắt dùng material phát sáng (`entity_emissive`) nên vẫn rực lên ban đêm.
Icon trong túi đồ là sprite pixel art render từ chính model 3D.
Đây là model tự dựng theo phong cách Minecraft, mô phỏng thiết kế kiếm của Aatrox, không phải model hay texture gốc của Riot
(addon không chứa bất kỳ hình ảnh nào của Riot).

## Cài đặt

- **Nhanh nhất:** tải file [`dist/AatroxDarkinBlade.mcaddon`](dist/AatroxDarkinBlade.mcaddon) rồi mở nó, Minecraft sẽ tự nhập cả 2 pack.
- **Thủ công:** chép `AatroxBP` vào `development_behavior_packs` và `AatroxRP` vào `development_resource_packs` trong thư mục `com.mojang`.

Sau đó tạo/sửa thế giới → **Behavior Packs** → bật *Aatrox - Quỷ Kiếm Darkin (BP)* (Resource Pack sẽ tự bật theo).

Lấy kiếm:
- Lệnh: `/give @s aatrox:darkin_blade`
- Chế tạo (bàn chế tạo, không cần xếp hình): **Kiếm Netherite + Ngôi sao Nether + Khối Redstone**
- Hoặc tìm trong túi đồ Sáng Tạo, mục Trang bị → Kiếm.

## Điều khiển

Bedrock không cho addon gán phím riêng, nên chiêu được chọn theo **tư thế lúc bấm chuột phải** (điện thoại: nhấn giữ / nút Dùng):

| Thao tác khi cầm kiếm | Chiêu |
|---|---|
| Đánh thường | **Nội tại — Tư Thế Tử Thần**: khi sẵn sàng (8 giây), vết chém phát nổ thêm 8% máu tối đa của mục tiêu và hồi máu bằng lượng đó |
| Chuột phải | **Q — Quỷ Kiếm Darkin**: chém 3 lần (mỗi lần có 4 giây để chém tiếp). Vùng chém hiện bằng lửa dưới đất, **mép kiếm màu dung nham là điểm ngọt**: x1.6 sát thương, hất tung, choáng, giảm hồi chiêu nội tại. Lần 3 là cú nện vùng tròn |
| Ngồi + chuột phải | **E — Bước Nhảy Hắc Ám**: lướt theo hướng nhìn |
| Nhảy + chuột phải (đang ở trên không) | **W — Xiềng Xích Địa Ngục**: phóng xích lửa. Trúng thì gây sát thương, làm chậm và tạo vòng trói; sau 1.5 giây mục tiêu chưa chạy ra khỏi vòng thì bị kéo về, chịu thêm sát thương và bị choáng |
| Nhìn lên trời + chuột phải | **R — Kẻ Diệt Thế**: sóng xung kích hất văng + làm chậm kẻ địch xung quanh, rồi biến hình 10 giây: +30% sát thương chiêu, +50% hồi máu, Tốc Độ II, Sức Mạnh I, nội tại hồi nhanh gấp đôi |

Mọi sát thương gây ra khi cầm kiếm đều **hút máu 15%**.
### Hiệu ứng particle

Addon có 11 particle riêng (texture pixel art tự vẽ, nằm trong `AatroxRP/particles`):

| Particle | Dùng ở đâu |
|---|---|
| `aatrox:ground_mark` / `ground_mark_sweet` | Ô đỏ và ô cam phát sáng dưới đất báo trước vùng chém Q và điểm ngọt |
| `aatrox:slash` | Nhát chém lưỡi liềm dọc theo đường Q |
| `aatrox:hit_spark` | Tia lửa bắn ra mỗi khi chiêu trúng |
| `aatrox:blood_burst` + `aatrox:flash` | Máu văng và chớp sáng khi trúng điểm ngọt, nội tại phát nổ, kéo xích |
| `aatrox:shock_ring` | Vòng sóng xung kích lan trên mặt đất (Q lần 3, R) |
| `aatrox:chain_link` | Sợi xích lửa của W và vòng trói |
| `aatrox:ember` | Tàn lửa bốc lên từ lưỡi kiếm khi cầm, vệt lướt E |
| `aatrox:ult_aura` | Lửa đỏ đen bao quanh người khi biến hình R |
| `aatrox:lifesteal` | Giọt máu phát sáng bay lên khi hút máu |

Thanh phía trên hotbar (action bar) hiện hồi chiêu của nội tại, Q, E, W, R, số lần chém Q và thời gian biến hình còn lại.

## Tuỳ chỉnh

Mọi thông số nằm trong [`AatroxBP/scripts/config.js`](AatroxBP/scripts/config.js): sát thương, hồi chiêu, tầm, góc nhìn lên để dùng R (`lookUpPitch`), bật/tắt đánh người chơi (`pvp`)...
Sát thương đánh thường của kiếm (9) nằm ở `minecraft:damage` trong [`AatroxBP/items/darkin_blade.json`](AatroxBP/items/darkin_blade.json).

Sửa xong thì chạy `python3 build.py` để tạo lại texture, model và file `.mcaddon`.

**Model 3D:** hình dáng kiếm là bản vẽ mặt trước dạng pixel trong [`sword_art.py`](sword_art.py)
(đường viền lưỡi, răng cưa, sừng, mắt, tay cầm; mỗi vật liệu có độ dày riêng trong `MATERIALS`).
[`model.py`](model.py) đùn bản vẽ thành khối 3D, gộp pixel cùng vật liệu thành khối lớn, vẽ texture pixel art (bảng màu trong `PALETTES`)
và xuất 2 file geometry: `darkin_blade.geo.json` (phần thường) và `darkin_blade_glow.geo.json` (phần phát sáng).
Có thể mở các file `.geo.json` bằng Blockbench để chỉnh tay.

**Particle:** chỉnh trong [`particles.py`](particles.py) (hình sprite, màu, tốc độ, thời gian sống), chạy lại `build.py`. Sprite particle là pixel art 16×16 cạnh cứng giống particle gốc của Minecraft.

**Icon:** `art/item_icon.png` (túi đồ, 64×64) và `art/pack_icon.png` được render từ model 3D; thay 2 file này nếu muốn icon khác.

**Vị trí kiếm trên tay** nằm trong [`AatroxRP/animations/darkin_blade.animation.json`](AatroxRP/animations/darkin_blade.animation.json)
(`position`, `rotation`, `scale` cho góc nhìn thứ nhất và thứ ba). Thông số khởi đầu lấy theo cây đinh ba (trident) của Minecraft;
nếu kiếm cầm lệch hoặc quá to thì chỉnh 3 giá trị này.

## Cấu trúc

```
bedrock/
├── AatroxBP/                  Behavior pack
│   ├── manifest.json
│   ├── items/darkin_blade.json
│   ├── recipes/darkin_blade.json
│   └── scripts/
│       ├── main.js            toàn bộ logic chiêu
│       └── config.js          thông số
├── AatroxRP/                  Resource pack
│   ├── attachables/           thay model cầm tay bằng model 3D
│   ├── animations/            vị trí kiếm khi cầm (ngôi thứ nhất / thứ ba)
│   ├── render_controllers/    vẽ lớp phát sáng
│   ├── models/entity/         model 3D (.geo.json) + lớp phát sáng
│   ├── particles/             11 particle riêng
│   └── textures/              icon, texture model, texture particle
├── art/                       icon render từ model 3D
├── sword_art.py               bản vẽ pixel mặt trước của kiếm (hình dáng)
├── model.py                   đùn bản vẽ thành model 3D + vẽ texture pixel art
├── particles.py               định nghĩa particle + vẽ texture particle
├── build.py                   tạo texture, model, particle + đóng gói .mcaddon
└── dist/AatroxDarkinBlade.mcaddon
```

## Lưu ý

- Choáng = hiệu ứng Chậm Chạp cấp tối đa; mục tiêu bị choáng vẫn nhảy được. Người chơi bị choáng thì không dùng được chiêu của kiếm.
- Mob vừa trúng đòn có khoảng bất tử ngắn (0.5 giây), nên dùng Q ngay sau một đòn đánh thường có thể bị giảm sát thương.
