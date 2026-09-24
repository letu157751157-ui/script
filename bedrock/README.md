# Quỷ Kiếm Darkin — Addon Aatrox cho Minecraft Bedrock

Addon thêm thanh kiếm **Quỷ Kiếm Darkin** (`aatrox:darkin_blade`) với bộ chiêu mô phỏng Aatrox (LMHT),
viết bằng Script API `@minecraft/server` 2.0.0. **Không cần bật Beta APIs / thử nghiệm.**

Yêu cầu: Minecraft Bedrock **1.21.90 trở lên** (PC, điện thoại, console đều được).

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
Thanh phía trên hotbar (action bar) hiện hồi chiêu của nội tại, Q, E, W, R, số lần chém Q và thời gian biến hình còn lại.

## Tuỳ chỉnh

Mọi thông số nằm trong [`AatroxBP/scripts/config.js`](AatroxBP/scripts/config.js): sát thương, hồi chiêu, tầm, góc nhìn lên để dùng R (`lookUpPitch`), bật/tắt đánh người chơi (`pvp`)...
Sát thương đánh thường của kiếm (9) nằm ở `minecraft:damage` trong [`AatroxBP/items/darkin_blade.json`](AatroxBP/items/darkin_blade.json).

Sửa xong thì chạy `python3 build.py` để tạo lại texture và file `.mcaddon`.

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
├── AatroxRP/                  Resource pack (texture kiếm)
├── build.py                   tạo texture + đóng gói .mcaddon
└── dist/AatroxDarkinBlade.mcaddon
```

## Lưu ý

- Choáng = hiệu ứng Chậm Chạp cấp tối đa; mục tiêu bị choáng vẫn nhảy được. Người chơi bị choáng thì không dùng được chiêu của kiếm.
- Mob vừa trúng đòn có khoảng bất tử ngắn (0.5 giây), nên dùng Q ngay sau một đòn đánh thường có thể bị giảm sát thương.
- Hiệu ứng hình ảnh dùng particle có sẵn của Minecraft, không cần tải thêm gì.
