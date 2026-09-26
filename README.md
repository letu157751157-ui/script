# Kiếm Aatrox — Script kỹ năng

- **Roblox**: hướng dẫn ngay bên dưới (thư mục `AatroxSword/`).
- **Minecraft Bedrock (addon)**: xem [`bedrock/README.md`](bedrock/README.md).
- **Boss Yeti (addon Minecraft Bedrock)**: thư mục `yeti/`.

## Roblox

Bộ script Luau cho một **Tool kiếm** trong Roblox, bộ chiêu mô phỏng theo Aatrox (Liên Minh Huyền Thoại).
Server tính toàn bộ hồi chiêu, hitbox và sát thương nên người chơi không hack được sát thương hay hồi chiêu.
Chạy được trên cả PC và điện thoại (tự hiện nút cảm ứng).

## Chiêu thức

| Phím | Chiêu | Mô tả |
|------|-------|-------|
| Click | Chém thường | Combo 3 đòn, đòn thứ 3 mạnh hơn và đẩy lùi. |
| — | **Nội tại: Tư Thế Tử Thần** | Cứ 8 giây, đòn chém thường kế tiếp gây thêm 8% máu tối đa của mục tiêu và hồi máu bằng lượng đó. Kiếm phát sáng đỏ khi nội tại sẵn sàng. |
| Q | **Quỷ Kiếm Darkin** | Chém 3 lần liên tiếp (mỗi lần có 4 giây để dùng lần tiếp theo). Vùng chiêu hiện dưới đất trước khi chém. Mục tiêu ở mép kiếm (**điểm ngọt**, màu cam) chịu x1.6 sát thương, bị hất tung và choáng; mỗi lần trúng điểm ngọt giảm hồi chiêu nội tại. Lần 3 là cú nện vùng tròn. |
| E | **Bước Nhảy Hắc Ám** | Lướt nhanh theo hướng đang chạy. Dùng được trong lúc vung Q để chỉnh vị trí nhát chém. |
| F | **Xiềng Xích Địa Ngục** | Phóng xích. Trúng thì gây sát thương, làm chậm và tạo vòng trói. Nếu sau 1.5 giây mục tiêu chưa chạy ra khỏi vòng thì bị kéo về, chịu thêm sát thương và bị choáng. |
| R | **Kẻ Diệt Thế** | Biến hình 10 giây: hất văng và làm chậm kẻ địch xung quanh. Trong lúc biến hình được +30% sát thương, +50% hồi máu, +40% tốc chạy và nội tại hồi nhanh gấp đôi. |

Mọi đòn đánh đều **hút máu 15%** sát thương gây ra.

## Cài đặt trong Roblox Studio

1. Trong **Explorer**, chuột phải `StarterPack` → **Insert Object** → **Tool**. Đặt tên, ví dụ `KiemAatrox`.
2. Trong Tool, thêm một **Part** tên chính xác là **`Handle`**. Đây là phần tay cầm (có thể thay bằng MeshPart kiếm lấy từ Toolbox, miễn là đổi tên thành `Handle`).
   - Gợi ý cho Part thường: `Size = 1, 0.8, 5`, màu đỏ đậm, `Material = Neon`.
   - Nếu nhân vật cầm kiếm bị lệch, chỉnh các thuộc tính `Grip...` của Tool (ví dụ `GripPos = 0, 0, -1.7`, `GripForward = -1, 0, 0`, `GripRight = 0, 1, 0`, `GripUp = 0, 0, 1` cho kiếm dài theo trục Z).
3. Thêm 3 script vào trong Tool. **Tên phải đặt đúng như sau:**

   | Loại object | Tên | Dán nội dung từ file |
   |-------------|-----|----------------------|
   | ModuleScript | `AatroxConfig` | [`AatroxSword/AatroxConfig.lua`](AatroxSword/AatroxConfig.lua) |
   | Script | `AatroxServer` | [`AatroxSword/AatroxServer.server.lua`](AatroxSword/AatroxServer.server.lua) |
   | LocalScript | `AatroxClient` | [`AatroxSword/AatroxClient.client.lua`](AatroxSword/AatroxClient.client.lua) |

   Cây thư mục sau khi xong:

   ```
   StarterPack
   └── KiemAatrox (Tool)
       ├── Handle (Part)
       ├── AatroxConfig (ModuleScript)
       ├── AatroxServer (Script)
       └── AatroxClient (LocalScript)
   ```

   Không cần tự tạo RemoteEvent, `AatroxServer` sẽ tự tạo `AatroxRemote`.
4. Để có mục tiêu thử chiêu: tab **Avatar** → **Rig Builder** → chọn một rig để tạo Dummy.
   Muốn thấy hiệu ứng hất tung / kéo xích trên Dummy thì bỏ tick **Anchored** ở `HumanoidRootPart` của nó.
5. Bấm **Play** để thử.

## Tuỳ chỉnh

Mọi thông số nằm trong `AatroxConfig`, không cần sửa code:

- **Sát thương, hồi chiêu, tầm đánh** của từng chiêu (`Config.Attack`, `Config.Q`, `Config.E`, `Config.F`, `Config.R`, `Config.Passive`).
- **Phím tắt**: `Config.Keybinds`.
- **PvP**: `Config.CanHitPlayers` (tắt thì chỉ đánh NPC), `Config.TeamCheck` (không đánh đồng đội).
- **Animation / âm thanh**: điền `rbxassetid://...` vào `Config.Animations` và `Config.Sounds`. Để trống thì kiếm dùng động tác chém mặc định của Roblox và không phát âm thanh.
- **Màu hiệu ứng**: `Config.Colors`.
- **Hình dạng 3 nhát Q**: `Config.Q.Casts` (`Shape = "Box"` hoặc `"Circle"`, cùng các thông số độ dài, bề rộng, bán kính, vùng điểm ngọt).

## Lưu ý

- Làm chậm, choáng và tăng tốc được thực hiện bằng cách tạm thay đổi `WalkSpeed` / `JumpPower` của Humanoid rồi khôi phục khi hết hiệu ứng. Nếu game của bạn có script khác (ví dụ chạy nhanh) cũng sửa `WalkSpeed` cùng lúc, giá trị có thể bị ghi đè.
- Animation tự làm phải thuộc sở hữu của bạn hoặc group sở hữu game thì Roblox mới cho chạy.
- Mỗi lần gây sát thương, script gắn tag `creator` (ObjectValue) vào Humanoid của mục tiêu theo chuẩn Roblox, nên các leaderboard đếm mạng hạ gục dùng tag này sẽ tính đúng.
