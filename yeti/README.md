# Boss Yeti v1.3: nâng cấp skill, animation mới, particle mới

Addon Minecraft Bedrock **boss-YETI** (tác giả YTAUN), nâng cấp từ bản v1.2.
Boss vẫn có 3 pha tiến hóa (`ytaun:yeti_1` → `ytaun:yeti_2` → `ytaun:yeti_3` → `ytaun:yeti_death`), nhưng toàn bộ bộ chiêu đã được làm lại:
mỗi chiêu có **animation riêng**, **particle băng mới** và **vòng cảnh báo** dưới đất trước các đòn nặng.

## Cài đặt

1. Tải [`dist/boss-YETI_v1_3_0.mcaddon`](dist/boss-YETI_v1_3_0.mcaddon) rồi mở file, Minecraft sẽ tự nhập cả 2 pack.
2. Trong thế giới: **Behavior Packs**, bật *boss-YETI* (Resource Pack được bật kèm theo).

> **Nâng cấp từ v1.2:** UUID của pack giữ nguyên, chỉ tăng version lên 1.3.0, nên bản mới thay thế bản cũ.
> Nếu vào game vẫn thấy chiêu cũ, hãy vào **Cài đặt → Bộ nhớ**, xóa pack boss-YETI cũ rồi nhập lại file `.mcaddon`.

## Có gì mới

### Hệ thống chiêu

- **Vòng cảnh báo:** vòng **xanh** là chiêu thường, vòng **đỏ** là đòn nặng. Vòng hiện đúng chỗ đòn sẽ rơi, đủ sớm để chạy ra.
  Có ở: điểm rơi của cú nhảy, tảng băng ném, băng nhọn từ trời, đường gai băng, đường lao, ngục băng.
- **Mỗi lần chỉ tung 1 chiêu:** Yeti đứng yên khi ra đòn, animation không còn chồng lên nhau.
  Bản cũ có thể tung Elite Army, Earthquake và Gai Băng cùng một tick ngay khi vừa thấy người chơi.
- **Hồi chiêu chung** giữa hai chiêu: pha 1 là 2,5 giây, pha 2 là 2 giây, pha 3 là 1,5 giây.
  Các chiêu lớn cũng phải chờ một lúc trước lần dùng đầu tiên.
- **Thời điểm gây sát thương khớp với animation.** Ví dụ: đập đất gây sát thương đúng lúc nắm đấm chạm đất, nhảy gây sát thương lúc tiếp đất.
- **Màn xuất hiện của mỗi pha:** Yeti ngồi thụp rồi đứng dậy, đấm ngực và gầm lên, kèm cột sáng băng, sóng xung kích và dòng tiêu đề trên màn hình.
- Boss hoạt động ở **mọi dimension**. Bản cũ chỉ chạy ở Overworld.
- Nội tại **"Hồi máu khi hạ gục người chơi"** giờ tính cả khi người chơi chết vì chiêu, không chỉ vì đòn đánh thường.

### Bảng chiêu theo pha

| Chiêu | Pha | Animation | Thay đổi |
|---|---|---|---|
| **Vuốt Băng Kép** | 1, 2, 3 | `swipe` | **MỚI.** 2 cú vuốt hình nón ở tầm gần, cú thứ 2 đẩy lùi |
| **Hơi Thở Băng Giá** | 2, 3 | `breath` | **MỚI.** Hít vào rồi phun băng hình nón, quét từ trái sang phải. Trúng 4 lần liên tiếp thì bị đóng băng |
| **Ngục Băng** | 3 | `cast` | **MỚI.** Vòng đỏ hiện dưới chân. Không chạy ra kịp thì bị nhốt 3 giây trong cột băng, sau đó băng vỡ gây sát thương |
| **Cuồng Nộ** | 3 | `chest_beat` | **MỚI.** Kích hoạt 1 lần khi còn dưới 35% máu: tăng tốc và sức mạnh, mọi chiêu hồi nhanh hơn 25%, có hào quang băng |
| Ném Tảng Băng (thay *Ice Ball*) | 1, 2 | `throw` | Ném tảng băng theo đường vòng cung, vòng đỏ báo chỗ rơi |
| Mưa Tảng Băng (thay *Crystal Barrage*) | 3 | `throw` | Ném liên tiếp 6 tảng băng vào người chơi |
| Mưa Băng Nhọn (thay *Blizzard Rain*) | 2, 3 | `summon` | Băng nhọn rơi từ trời xuống các vòng đỏ, nhắm cả vào người chơi. Ít đợt hơn nhưng rõ ràng hơn |
| Rãnh Băng (thay *Frost Spike*) | 2, 3 | `slam` | Vết nứt chạy thẳng tới mục tiêu, cột băng hất tung lên. Mỗi người chỉ trúng 1 lần |
| Cú Nhảy Nghiền Băng (*Ice Jump*) | 1, 2, 3 | `leap` | Bay theo vòng cung thật thay vì dịch chuyển tức thời, vòng đỏ báo điểm rơi. Pha 2 trước đây có code nhưng không bao giờ dùng, nay đã dùng |
| Tiếng Gầm Băng Giá (*Frost Roar*) | 1, 2, 3 | `roar` | Sóng xung kích lan ra theo tiếng gầm |
| Băng Địa (*Freeze Ground*) | 1 | `slam` | Vùng băng hiện rõ dưới đất, tồn tại 20 giây (trước là 30 giây) |
| Sóng Băng Hà (*Glacial Wave*) | 2, 3 | `slam` | Các vòng sóng băng lan xa |
| Động Đất Băng (*Earthquake*) | 2, 3 | `leap` | Nhảy tại chỗ rồi dậm xuống, các vòng nứt lan rất xa |
| Lốc Xoáy Cực Địa (*Polar Vortex*) | 2, 3 | `spin` | Xoay người, bão tuyết xoáy hút người chơi vào tâm |
| Độ Không Tuyệt Đối (*Absolute Zero*) | 2, 3 | `cast` | Cột sáng băng và vòng đỏ lớn |
| Bùng Nổ Băng (*Frost Nova*) | 3 | `roar` | Cột sáng băng và các vòng nổ lan ra |
| Xiềng Băng (*Ice Chains*) | 3 | `cast` | Trói 5 giây rồi **giật** mục tiêu về phía Yeti (trước là trói 10 giây) |
| Giáp Băng (*Frost Armor*) | 3 | `chest_beat` | Lớp gai băng bao quanh, vẫn phản 30% sát thương |
| Hồi Phục Băng Giá (*Ice Regen*) | 1, 2, 3 | `regen` | Co người trong lớp vỏ gai băng để hồi máu, đẩy lùi người chơi xung quanh |
| Triệu Hồi / Elite Army | 1, 2, 3 | `summon` | Cổng băng xoáy hiện ra trước, sau đó quái mới xuất hiện |
| Gai Băng + Lao Đánh | 1, 2, 3 | giữ nguyên | Tính trước đường gai và hiện vòng cảnh báo. Đường lao hiện vệt đỏ và để lại vệt tuyết |

Sát thương, bán kính, hồi chiêu và ngưỡng máu của các chiêu cũ **giữ như bản v1.2**, trừ những chỗ ghi trong bảng.
Dạng xác `yeti_death` có thêm animation thở và co giật, cùng particle mới cho 3 chiêu của nó.

### Animation mới (`animations/ytaun_yeti_skills.animation.json`)

12 animation dùng chung cho cả 3 pha, vì 3 model Yeti có chung các bone chính (`body`, `bone79`, `head`, `bone46`, `arm0/1`, `leg0/1`).
Animation cộng thêm lên animation đi/đứng sẵn có, nên cây gậy băng vẫn nằm trên vai ở pha 1 và pha 2.

![Animation mới](preview_animations.png)

`roar`, `slam`, `leap`, `throw`, `breath`, `summon`, `regen`, `swipe`, `chest_beat`, `spin`, `cast`, `phase_intro`
(tên đầy đủ: `animation.ytaun_yeti.<tên>`), cùng `animation.ytaun_yeti_death.breathe` và `animation.ytaun_yeti_death.pulse`.

### Particle mới (`particles/ytaun_*.json`, texture `textures/particle/ytaun_yeti_fx.png`)

16 particle, pixel art tông băng. Các particle có viền xanh đậm để vẫn nhìn rõ trên nền tuyết.
Script có thể truyền bán kính, thời gian và hướng khi tạo particle (biến Molang `variable.radius`, `variable.duration`, `variable.dir_x/y/z`).

![Particle mới](preview_particles.png)

## Cấu trúc script

| File | Nội dung |
|---|---|
| `scripts/custom/yeti_fx.js` | Tiện ích: tên animation/particle, particle có tham số, vòng cảnh báo, khóa thi triển, sát thương có ghi nhớ Yeti nào gây ra |
| `scripts/custom/yeti_skills.js` | Toàn bộ chiêu dùng chung, mỗi pha truyền thông số riêng |
| `scripts/custom/yeti_brain.js` | Chọn chiêu: khẩn cấp theo máu, chiêu đặc trưng, chiêu theo khoảng cách, hồi chiêu chung |
| `scripts/custom/yeti_phase1/2/3.js` | Cấu hình từng pha: chiêu nào, sát thương, hồi chiêu, điều kiện dùng |
| `scripts/custom/yeti_spike_charge.js` | Gai Băng và Lao Đánh |
| `scripts/custom/yeti_boss_skill.js` | Nội tại, giáp, dạng `yeti_death`, màn xuất hiện của mỗi pha |

Muốn chỉnh độ khó, sửa số trong `yeti_phase1.js`, `yeti_phase2.js` và `yeti_phase3.js`.
`cd` là hồi chiêu tính bằng tick (20 tick = 1 giây), `when` là điều kiện dùng chiêu (`c.d` là khoảng cách tới người chơi, `c.hp` là % máu).

## Tự build lại

```bash
pip install pillow
python3 yeti/tools/build.py
```

Lệnh này tạo lại texture và JSON của particle (`tools/particles.py`), file animation (`tools/animations.py`) và ảnh preview.
Sau đó nó kiểm tra mọi particle và animation mà script dùng đều tồn tại, rồi đóng gói `dist/boss-YETI_v<version>.mcaddon`.

## Lưu ý (có sẵn từ bản gốc, chưa sửa)

- `functions/Pet_Yeti_boss.mcfunction` và `Pet_Yeti_death.mcfunction` gọi `summon pa:yeti_boss_pet` / `pa:yeti_mage`.
  Hai entity này không có trong addon, nên các lệnh đó không làm gì. Pet của boss trong addon này có tên `ytaun:yeti_boss_pet`.
- Entity gai băng `ytaun:ice_spike_yeti_boss` khai báo một animation không tồn tại (`look_at_target.swimming`) nhưng không bao giờ dùng tới, nên vô hại.
