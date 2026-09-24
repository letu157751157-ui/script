--[[
	AatroxConfig (ModuleScript) — đặt BÊN TRONG Tool.

	Toàn bộ thông số của Kiếm Aatrox. Muốn cân bằng lại chiêu thì chỉ cần sửa file này,
	không phải đụng vào code server/client.
	Đơn vị: sát thương = máu, khoảng cách = studs, thời gian = giây.
]]

local Config = {}

-- Có gây sát thương lên người chơi khác không (false = chỉ đánh NPC/Dummy)
Config.CanHitPlayers = true
-- Không gây sát thương cho người chơi cùng Team
Config.TeamCheck = true
-- PC: xoay nhân vật theo hướng chuột khi ra chiêu
Config.AimAtMouse = true
-- Hiện thanh kỹ năng (ô Q/E/F/R + hồi chiêu) trên màn hình
Config.ShowSkillBar = true

-- Hút máu: hồi lại % sát thương gây ra (x HealMultiplier khi đang dùng R)
Config.Lifesteal = 0.15

-- Phím tắt (trên điện thoại sẽ tự hiện nút cảm ứng)
Config.Keybinds = {
	Q = Enum.KeyCode.Q, -- Quỷ Kiếm Darkin
	E = Enum.KeyCode.E, -- Bước Nhảy Hắc Ám
	F = Enum.KeyCode.F, -- Xiềng Xích Địa Ngục
	R = Enum.KeyCode.R, -- Kẻ Diệt Thế
}

-- Tên ngắn hiển thị trên thanh kỹ năng / nút cảm ứng
Config.SkillNames = {
	Passive = "Tử Thần",
	Q = "Quỷ Kiếm",
	E = "Hắc Ám",
	F = "Xiềng Xích",
	R = "Diệt Thế",
}

-- Click chuột: chém thường, combo 3 đòn
Config.Attack = {
	Damage = 10,
	Cooldown = 0.45, -- thời gian giữa 2 đòn chém
	HitDelay = 0.12, -- độ trễ từ lúc vung kiếm tới lúc gây sát thương
	Range = 8, -- tầm chém phía trước
	Width = 7, -- bề ngang vùng chém
	ComboResetTime = 1.2, -- quá thời gian này không chém thì combo quay về đòn 1
	ComboMultipliers = { 1, 1.1, 1.5 }, -- hệ số sát thương đòn 1 - 2 - 3
	FinisherKnockback = 35, -- đòn cuối combo đẩy lùi
}

-- Nội tại — Tư Thế Tử Thần: đòn chém thường kế tiếp gây thêm sát thương theo % máu tối đa và hồi máu
Config.Passive = {
	Cooldown = 8,
	MaxHealthDamage = 0.08, -- sát thương thêm = 8% máu tối đa của mục tiêu...
	MinBonus = 8, -- ...nhưng không thấp hơn
	MaxBonus = 60, -- ...và không cao hơn
	HealRatio = 1, -- hồi máu = 100% phần sát thương thêm
	SweetSpotReduction = 2, -- Q trúng "điểm ngọt" giảm hồi chiêu nội tại
}

-- Q — Quỷ Kiếm Darkin: chém 3 lần liên tiếp.
-- Mục tiêu đứng ở mép lưỡi kiếm ("điểm ngọt", vùng màu cam) chịu thêm sát thương, bị hất tung và choáng.
Config.Q = {
	Cooldown = 8, -- hồi chiêu sau khi chém đủ 3 lần (hoặc hết thời gian chờ)
	RecastWindow = 4, -- thời gian để dùng lần chém tiếp theo
	Windup = 0.45, -- thời gian vung kiếm trước khi chém xuống
	WindupSlow = 0.6, -- tốc chạy khi đang vung (60%)
	SweetSpotMultiplier = 1.6,
	SweetSpotKnockup = 40, -- lực hất tung
	SweetSpotStun = 0.6,
	Casts = {
		-- Lần 1: nhát chém dài, hẹp
		{ Shape = "Box", Length = 18, Width = 6, SweetSpot = 4, Damage = 22 },
		-- Lần 2: nhát chém ngang, rộng hơn
		{ Shape = "Box", Length = 14, Width = 12, SweetSpot = 4, Damage = 27 },
		-- Lần 3: nện kiếm xuống đất, vùng tròn trước mặt, điểm ngọt là vành ngoài
		{ Shape = "Circle", Offset = 7, Radius = 7, SweetSpot = 3, Damage = 34 },
	},
}

-- E — Bước Nhảy Hắc Ám: lướt nhanh theo hướng đang chạy (đứng yên thì lướt theo hướng chuột)
Config.E = {
	Cooldown = 5,
	Speed = 90,
	Duration = 0.16, -- quãng đường ≈ Speed x Duration
}

-- F — Xiềng Xích Địa Ngục: phóng xích, trúng thì trói mục tiêu.
-- Nếu mục tiêu không chạy ra khỏi vòng tròn sau PullDelay giây sẽ bị kéo về và choáng.
Config.F = {
	Cooldown = 14,
	Range = 45,
	HitRadius = 1.5,
	ProjectileSpeed = 140,
	Damage = 18,
	Slow = 0.6, -- mục tiêu còn 60% tốc chạy trong lúc bị xích
	PullDelay = 1.5,
	EscapeRadius = 10, -- bán kính vòng trói
	PullSpeed = 70,
	PullDamage = 18,
	StunDuration = 0.75,
}

-- R — Kẻ Diệt Thế: biến hình, hất văng + làm chậm kẻ địch xung quanh,
-- tăng sát thương, tăng hồi máu, tăng tốc chạy và nội tại hồi nhanh hơn.
Config.R = {
	Cooldown = 60,
	Duration = 10,
	CastTime = 0.5,
	Radius = 16,
	CastDamage = 15,
	Knockback = 60,
	FearSlow = 0.4, -- kẻ địch trúng chiêu còn 40% tốc chạy...
	FearDuration = 2, -- ...trong 2 giây
	DamageMultiplier = 1.3,
	HealMultiplier = 1.5,
	SpeedMultiplier = 1.4,
	PassiveCooldownMultiplier = 0.5,
}

-- Animation tuỳ chọn ("rbxassetid://123..."). Để trống = dùng động tác chém mặc định của Roblox.
-- Animation phải thuộc sở hữu của bạn/nhóm của game thì mới chạy được.
Config.Animations = {
	Attack = "",
	Q = "",
	E = "",
	F = "",
	R = "",
}

-- Âm thanh tuỳ chọn ("rbxassetid://123..."). Để trống = không phát.
Config.Sounds = {
	Slash = "",
	QCast = "",
	QSlam = "",
	Dash = "",
	Chain = "",
	Ult = "",
}

Config.Colors = {
	Main = Color3.fromRGB(190, 20, 35), -- đỏ máu
	Dark = Color3.fromRGB(70, 0, 12),
	SweetSpot = Color3.fromRGB(255, 140, 40), -- điểm ngọt của Q
	Damage = Color3.fromRGB(255, 255, 255),
	Passive = Color3.fromRGB(255, 50, 60),
	Heal = Color3.fromRGB(80, 255, 120),
	Stun = Color3.fromRGB(255, 230, 90),
	Ult = Color3.fromRGB(255, 200, 60),
}

return Config
