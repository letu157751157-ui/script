--[[
	AatroxServer (Script) — đặt BÊN TRONG Tool, cùng cấp với AatroxConfig.

	Mọi thứ quan trọng đều tính ở server: hồi chiêu, hitbox, sát thương, hồi máu, khống chế.
	Client chỉ gửi "muốn dùng chiêu X theo hướng Y", server tự kiểm tra có hợp lệ không.

	  Click     Chém thường — combo 3 đòn, đòn 3 đẩy lùi
	  Nội tại   Tư Thế Tử Thần — đòn chém kế tiếp gây thêm % máu tối đa và hồi máu
	  Q         Quỷ Kiếm Darkin — chém 3 lần, trúng mép kiếm (điểm ngọt) thì hất tung + choáng
	  E         Bước Nhảy Hắc Ám — lướt nhanh
	  F         Xiềng Xích Địa Ngục — trói mục tiêu, không thoát kịp thì bị kéo về + choáng
	  R         Kẻ Diệt Thế — biến hình, hất văng xung quanh, tăng sát thương/hồi máu/tốc chạy
]]

local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")

local tool = script.Parent
local Config = require(tool:WaitForChild("AatroxConfig"))
local Colors = Config.Colors

local remote = tool:FindFirstChild("AatroxRemote")
if not remote then
	remote = Instance.new("RemoteEvent")
	remote.Name = "AatroxRemote"
	remote.Parent = tool
end

local effectsFolder = workspace:FindFirstChild("AatroxEffects")
if not effectsFolder then
	effectsFolder = Instance.new("Folder")
	effectsFolder.Name = "AatroxEffects"
	effectsFolder.Parent = workspace
end

--------------------------------------------------------------------------------
-- Trạng thái của người đang cầm kiếm
--------------------------------------------------------------------------------

local function newState(owner)
	return {
		owner = owner,
		cooldowns = { Attack = 0, Q = 0, E = 0, F = 0, R = 0 },
		busyUntil = 0, -- đang vận chiêu thì không dùng chiêu khác (trừ E)
		combo = 0,
		lastAttack = 0,
		qStage = 1, -- lần chém Q kế tiếp (1 -> 3)
		qWindowEnd = 0,
		qToken = 0,
		passiveReadyAt = 0,
		passiveTotal = Config.Passive.Cooldown,
		passiveToken = 0,
		ultUntil = 0,
	}
end

local state = newState(nil)

local function notify(...)
	local owner = state.owner
	if owner and owner.Parent then
		remote:FireClient(owner, ...)
	end
end

local function startCooldown(skill, duration)
	state.cooldowns[skill] = os.clock() + duration
	notify("Cooldown", skill, duration, duration)
end

local function isUltActive()
	return os.clock() < state.ultUntil
end

--------------------------------------------------------------------------------
-- Tiện ích
--------------------------------------------------------------------------------

local function flatUnit(vector)
	local flat = Vector3.new(vector.X, 0, vector.Z)
	local magnitude = flat.Magnitude
	-- loại cả NaN/inf do client gửi lên
	if magnitude > 1e-3 and magnitude < math.huge then
		return flat / magnitude
	end
	return nil
end

local function sanitizeDirection(direction, root)
	if typeof(direction) == "Vector3" then
		local unit = flatUnit(direction)
		if unit then
			return unit
		end
	end
	return flatUnit(root.CFrame.LookVector) or Vector3.new(0, 0, -1)
end

local function getFootY(humanoid, root)
	local legLength = humanoid.RigType == Enum.HumanoidRigType.R6 and 2 or humanoid.HipHeight
	return root.Position.Y - root.Size.Y / 2 - legLength
end

local function isValid(ctx)
	return tool.Parent == ctx.character and ctx.humanoid.Health > 0 and ctx.root.Parent ~= nil
end

--------------------------------------------------------------------------------
-- Làm chậm / choáng / tăng tốc
-- Lưu bằng Attribute trên Humanoid để nhiều thanh kiếm cùng tác động lên 1 mục tiêu
-- vẫn khôi phục đúng tốc chạy gốc.
--------------------------------------------------------------------------------

local MODIFIER_PREFIX = "AatroxMove_"

local function getMoveMultiplier(humanoid)
	local multiplier, active = 1, false
	for name, value in humanoid:GetAttributes() do
		if string.sub(name, 1, #MODIFIER_PREFIX) == MODIFIER_PREFIX then
			active = true
			multiplier *= value
		end
	end
	return multiplier, active
end

local function isStunned(humanoid)
	local multiplier, active = getMoveMultiplier(humanoid)
	return active and multiplier <= 0
end

local function refreshMovement(humanoid)
	local baseSpeed = humanoid:GetAttribute("AatroxBaseWalkSpeed")
	if baseSpeed == nil then
		return
	end
	local baseJumpPower = humanoid:GetAttribute("AatroxBaseJumpPower")
	local baseJumpHeight = humanoid:GetAttribute("AatroxBaseJumpHeight")
	local multiplier, active = getMoveMultiplier(humanoid)

	if not active then
		humanoid.WalkSpeed = baseSpeed
		humanoid.JumpPower = baseJumpPower
		humanoid.JumpHeight = baseJumpHeight
		humanoid:SetAttribute("AatroxBaseWalkSpeed", nil)
		humanoid:SetAttribute("AatroxBaseJumpPower", nil)
		humanoid:SetAttribute("AatroxBaseJumpHeight", nil)
		return
	end

	local stunned = multiplier <= 0
	humanoid.WalkSpeed = baseSpeed * math.max(multiplier, 0)
	humanoid.JumpPower = stunned and 0 or baseJumpPower
	humanoid.JumpHeight = stunned and 0 or baseJumpHeight
end

-- multiplier: 0 = choáng, < 1 = làm chậm, > 1 = tăng tốc
local function addMovementModifier(humanoid, multiplier, duration)
	if humanoid:GetAttribute("AatroxBaseWalkSpeed") == nil then
		humanoid:SetAttribute("AatroxBaseWalkSpeed", humanoid.WalkSpeed)
		humanoid:SetAttribute("AatroxBaseJumpPower", humanoid.JumpPower)
		humanoid:SetAttribute("AatroxBaseJumpHeight", humanoid.JumpHeight)
	end
	local key = MODIFIER_PREFIX .. (string.gsub(HttpService:GenerateGUID(false), "-", ""))
	humanoid:SetAttribute(key, multiplier)
	refreshMovement(humanoid)

	task.delay(duration, function()
		if humanoid.Parent then
			humanoid:SetAttribute(key, nil)
			refreshMovement(humanoid)
		end
	end)
end

--------------------------------------------------------------------------------
-- Hiệu ứng
--------------------------------------------------------------------------------

local function makePart(size, cframe, color, transparency, shape)
	local part = Instance.new("Part")
	if shape then
		part.Shape = shape
	end
	part.Size = size
	part.CFrame = cframe
	part.Color = color
	part.Transparency = transparency
	part.Material = Enum.Material.Neon
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false -- hitbox/raycast bỏ qua hiệu ứng
	part.CanTouch = false
	part.CastShadow = false
	part.Parent = effectsFolder
	return part
end

local function fadeOut(instance, duration, extraGoals)
	local goals = { Transparency = 1 }
	if extraGoals then
		for key, value in extraGoals do
			goals[key] = value
		end
	end
	local info = TweenInfo.new(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	TweenService:Create(instance, info, goals):Play()
	Debris:AddItem(instance, duration + 0.1)
end

-- Đĩa tròn nằm phẳng trên mặt đất (Cylinder mặc định nằm ngang theo trục X)
local FLAT = CFrame.Angles(0, 0, math.rad(90))

local function makeDisc(position, radius, color, transparency)
	return makePart(Vector3.new(0.2, radius * 2, radius * 2), CFrame.new(position) * FLAT, color, transparency, Enum.PartType.Cylinder)
end

local function burstEffect(position, color, size)
	local part = makePart(Vector3.one, CFrame.new(position), color, 0.2, Enum.PartType.Ball)
	fadeOut(part, 0.35, { Size = Vector3.one * size })
end

local function slashEffect(hitbox, width, tilt, big)
	local cframe = hitbox * CFrame.new(0, 0.5, 0) * CFrame.Angles(0, 0, math.rad(tilt))
	local size = big and Vector3.new(width * 1.2, 0.2, 2) or Vector3.new(width, 0.15, 1.2)
	local part = makePart(size, cframe, Colors.Main, 0.1)
	fadeOut(part, 0.25, { Size = size * Vector3.new(1.3, 0.5, 2.2) })
end

local function dashTrail(root, duration)
	local top = Instance.new("Attachment")
	top.Position = Vector3.new(0, 1.2, 0)
	top.Parent = root
	local bottom = Instance.new("Attachment")
	bottom.Position = Vector3.new(0, -1.2, 0)
	bottom.Parent = root

	local trail = Instance.new("Trail")
	trail.Attachment0 = top
	trail.Attachment1 = bottom
	trail.Color = ColorSequence.new(Colors.Main, Colors.Dark)
	trail.Transparency = NumberSequence.new(0.2, 1)
	trail.LightEmission = 0.8
	trail.Lifetime = 0.25
	trail.Parent = root

	for _, item in { top, bottom, trail } do
		Debris:AddItem(item, duration + 0.3)
	end
end

-- Sợi xích nối 2 part, trả về hàm để gỡ xích
local function createChain(part0, part1)
	local attachment0 = Instance.new("Attachment")
	attachment0.Parent = part0
	local attachment1 = Instance.new("Attachment")
	attachment1.Parent = part1

	local beam = Instance.new("Beam")
	beam.Attachment0 = attachment0
	beam.Attachment1 = attachment1
	beam.Color = ColorSequence.new(Colors.Main)
	beam.LightEmission = 0.6
	beam.Width0 = 0.35
	beam.Width1 = 0.35
	beam.FaceCamera = true
	beam.Segments = 1
	beam.Parent = part0

	return function()
		beam:Destroy()
		attachment0:Destroy()
		attachment1:Destroy()
	end
end

-- Chữ bay lên trên đầu (số sát thương, hồi máu, trạng thái)
local function showText(part, text, color, duration)
	duration = duration or 0.8
	local billboard = Instance.new("BillboardGui")
	billboard.Size = UDim2.fromOffset(120, 36)
	billboard.StudsOffset = Vector3.new((math.random() - 0.5) * 2, 2.5, 0)
	billboard.AlwaysOnTop = true
	billboard.LightInfluence = 0
	billboard.MaxDistance = 150
	billboard.Adornee = part

	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.fromScale(1, 1)
	label.Font = Enum.Font.GothamBold
	label.TextScaled = true
	label.Text = text
	label.TextColor3 = color
	label.TextStrokeColor3 = Color3.new(0, 0, 0)
	label.TextStrokeTransparency = 0.4
	label.Parent = billboard
	billboard.Parent = part

	local info = TweenInfo.new(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	TweenService:Create(billboard, info, { StudsOffset = billboard.StudsOffset + Vector3.new(0, 2, 0) }):Play()
	TweenService:Create(label, info, { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	Debris:AddItem(billboard, duration)
end

local function playSound(parent, key)
	local id = Config.Sounds[key]
	if not id or id == "" then
		return
	end
	local sound = Instance.new("Sound")
	sound.SoundId = id
	sound.Volume = 0.8
	sound.Parent = parent
	sound:Play()
	Debris:AddItem(sound, 5)
end

local animationTracks = setmetatable({}, { __mode = "k" })

local function playAnimation(ctx, key)
	local id = Config.Animations[key]
	local animator = ctx.humanoid:FindFirstChildOfClass("Animator")
	if id and id ~= "" and animator then
		local tracks = animationTracks[animator]
		if not tracks then
			tracks = {}
			animationTracks[animator] = tracks
		end
		local track = tracks[key]
		if not track then
			local animation = Instance.new("Animation")
			animation.AnimationId = id
			track = animator:LoadAnimation(animation)
			track.Priority = Enum.AnimationPriority.Action
			tracks[key] = track
		end
		track:Play(0.05)
		return
	end

	-- Không có animation riêng: dùng động tác chém/đâm mặc định của script Animate
	local toolAnim = Instance.new("StringValue")
	toolAnim.Name = "toolanim"
	toolAnim.Value = (key == "Q" or key == "R") and "Lunge" or "Slash"
	toolAnim.Parent = tool
	Debris:AddItem(toolAnim, 1)
end

--------------------------------------------------------------------------------
-- Tìm mục tiêu
--------------------------------------------------------------------------------

local function isEnemy(casterCharacter, model)
	if model == casterCharacter then
		return false
	end
	local targetPlayer = Players:GetPlayerFromCharacter(model)
	if targetPlayer then
		if not Config.CanHitPlayers then
			return false
		end
		local casterPlayer = Players:GetPlayerFromCharacter(casterCharacter)
		if
			Config.TeamCheck
			and casterPlayer
			and not casterPlayer.Neutral
			and not targetPlayer.Neutral
			and casterPlayer.Team == targetPlayer.Team
		then
			return false
		end
	end
	return true
end

local function getEnemyFromPart(casterCharacter, part)
	local model = part:FindFirstAncestorOfClass("Model")
	while model do
		local humanoid = model:FindFirstChildOfClass("Humanoid")
		if humanoid then
			local root = humanoid.RootPart
			if root and humanoid.Health > 0 and isEnemy(casterCharacter, model) then
				return { humanoid = humanoid, root = root, model = model }
			end
			return nil
		end
		model = model:FindFirstAncestorOfClass("Model")
	end
	return nil
end

local function collectEnemies(casterCharacter, parts)
	local seen, targets = {}, {}
	for _, part in parts do
		local target = getEnemyFromPart(casterCharacter, part)
		if target and not seen[target.humanoid] then
			seen[target.humanoid] = true
			table.insert(targets, target)
		end
	end
	return targets
end

local function overlapParamsFor(character)
	local params = OverlapParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { character }
	return params
end

local function getEnemiesInBox(character, cframe, size)
	return collectEnemies(character, workspace:GetPartBoundsInBox(cframe, size, overlapParamsFor(character)))
end

local function getEnemiesInRadius(character, position, radius)
	return collectEnemies(character, workspace:GetPartBoundsInRadius(position, radius, overlapParamsFor(character)))
end

--------------------------------------------------------------------------------
-- Sát thương / hồi máu / khống chế
--------------------------------------------------------------------------------

local function tagHumanoid(humanoid, player)
	-- Tag "creator" chuẩn của Roblox để leaderboard tính mạng hạ gục
	for _, child in humanoid:GetChildren() do
		if child.Name == "creator" and child:IsA("ObjectValue") then
			child:Destroy()
		end
	end
	local tag = Instance.new("ObjectValue")
	tag.Name = "creator"
	tag.Value = player
	tag.Parent = humanoid
	Debris:AddItem(tag, 2)
end

-- Trả về lượng máu thực sự đã trừ (ForceField chặn thì = 0)
local function dealDamage(ctx, target, amount, color)
	local humanoid = target.humanoid
	if humanoid.Health <= 0 then
		return 0
	end
	if isUltActive() then
		amount *= Config.R.DamageMultiplier
	end
	tagHumanoid(humanoid, ctx.player)
	local before = humanoid.Health
	humanoid:TakeDamage(amount)
	local dealt = before - math.max(humanoid.Health, 0)
	if dealt > 0 then
		showText(target.root, tostring(math.floor(dealt + 0.5)), color or Colors.Damage)
	end
	return dealt
end

local function heal(ctx, amount)
	local humanoid = ctx.humanoid
	if isUltActive() then
		amount *= Config.R.HealMultiplier
	end
	if amount <= 0 or humanoid.Health <= 0 then
		return
	end
	local before = humanoid.Health
	humanoid.Health = math.min(humanoid.MaxHealth, before + amount)
	local healed = humanoid.Health - before
	if healed >= 1 then
		showText(ctx.root, "+" .. math.floor(healed + 0.5), Colors.Heal)
	end
end

local function applyVelocity(part, velocity, duration)
	local old = part:FindFirstChild("AatroxForce")
	if old then
		old:Destroy()
	end
	local attachment = Instance.new("Attachment")
	attachment.Name = "AatroxForce"
	local mover = Instance.new("LinearVelocity")
	mover.Attachment0 = attachment
	mover.RelativeTo = Enum.ActuatorRelativeTo.World
	mover.MaxForce = math.huge
	mover.VectorVelocity = velocity
	mover.Parent = attachment
	attachment.Parent = part
	Debris:AddItem(attachment, duration)
end

local function knockback(target, direction, force)
	applyVelocity(target.root, direction * force + Vector3.new(0, force * 0.35, 0), 0.15)
end

local function knockup(target, force)
	applyVelocity(target.root, Vector3.new(0, force, 0), 0.18)
end

local function stun(target, duration)
	addMovementModifier(target.humanoid, 0, duration)
	showText(target.root, "CHOÁNG", Colors.Stun, duration)
end

--------------------------------------------------------------------------------
-- Nội tại — Tư Thế Tử Thần
--------------------------------------------------------------------------------

local function isPassiveReady()
	return os.clock() >= state.passiveReadyAt
end

local function setPassiveGlow(enabled)
	local handle = tool:FindFirstChild("Handle")
	if not handle then
		return
	end
	local glow = handle:FindFirstChild("AatroxPassiveGlow")
	if enabled and not glow then
		glow = Instance.new("PointLight")
		glow.Name = "AatroxPassiveGlow"
		glow.Color = Colors.Passive
		glow.Brightness = 4
		glow.Range = 8
		glow.Parent = handle
	elseif not enabled and glow then
		glow:Destroy()
	end
end

local function schedulePassive()
	state.passiveToken += 1
	local token = state.passiveToken
	local remaining = math.max(state.passiveReadyAt - os.clock(), 0)
	notify("Cooldown", "Passive", remaining, state.passiveTotal)
	setPassiveGlow(remaining <= 0)
	if remaining > 0 then
		task.delay(remaining, function()
			if state.passiveToken == token then
				setPassiveGlow(true)
			end
		end)
	end
end

local function consumePassive()
	local cooldown = Config.Passive.Cooldown
	if isUltActive() then
		cooldown *= Config.R.PassiveCooldownMultiplier
	end
	state.passiveReadyAt = os.clock() + cooldown
	state.passiveTotal = cooldown
	schedulePassive()
end

local function reducePassiveCooldown(seconds)
	if isPassiveReady() then
		return
	end
	state.passiveReadyAt -= seconds
	schedulePassive()
end

--------------------------------------------------------------------------------
-- Chiêu thức
--------------------------------------------------------------------------------

local Skills = {}

-- Click: chém thường, combo 3 đòn
function Skills.Attack(ctx, direction)
	local cfg = Config.Attack
	local now = os.clock()
	if now < state.busyUntil or now < state.cooldowns.Attack then
		return
	end
	state.cooldowns.Attack = now + cfg.Cooldown

	if now - state.lastAttack > cfg.ComboResetTime then
		state.combo = 0
	end
	state.combo = state.combo % #cfg.ComboMultipliers + 1
	state.lastAttack = now
	local combo = state.combo
	local isFinisher = combo == #cfg.ComboMultipliers

	playAnimation(ctx, "Attack")
	playSound(ctx.root, "Slash")
	task.wait(cfg.HitDelay)
	if not isValid(ctx) then
		return
	end

	local origin = ctx.root.Position
	local hitbox = CFrame.lookAt(origin, origin + direction) * CFrame.new(0, 0, -cfg.Range / 2)
	local tilt = if isFinisher then 0 elseif combo % 2 == 1 then 30 else -30
	slashEffect(hitbox, cfg.Width, tilt, isFinisher)

	local passiveReady = isPassiveReady()
	local passiveUsed = false
	local totalDealt, bonusHeal = 0, 0
	for _, target in getEnemiesInBox(ctx.character, hitbox, Vector3.new(cfg.Width, 8, cfg.Range)) do
		local damage = cfg.Damage * cfg.ComboMultipliers[combo]
		local color = Colors.Damage
		if passiveReady and not passiveUsed then
			passiveUsed = true
			local passive = Config.Passive
			local bonus = math.clamp(target.humanoid.MaxHealth * passive.MaxHealthDamage, passive.MinBonus, passive.MaxBonus)
			damage += bonus
			bonusHeal += bonus * passive.HealRatio
			color = Colors.Passive
			burstEffect(target.root.Position, Colors.Passive, 6)
		end
		totalDealt += dealDamage(ctx, target, damage, color)
		if isFinisher then
			knockback(target, direction, cfg.FinisherKnockback)
		end
	end

	heal(ctx, totalDealt * Config.Lifesteal + bonusHeal)
	if passiveUsed then
		consumePassive()
	end
end

local function buildQTelegraph(cast)
	if cast.Shape == "Circle" then
		-- Đĩa ngoài màu cam = điểm ngọt, đĩa trong đậm hơn che phần giữa
		return {
			sweet = makeDisc(Vector3.zero, cast.Radius, Colors.SweetSpot, 0.55),
			area = makeDisc(Vector3.zero, cast.Radius - cast.SweetSpot, Colors.Dark, 0.35),
		}
	end
	return {
		area = makePart(Vector3.new(cast.Width, 0.2, cast.Length), CFrame.new(), Colors.Main, 0.65),
		sweet = makePart(Vector3.new(cast.Width, 0.25, cast.SweetSpot), CFrame.new(), Colors.SweetSpot, 0.45),
	}
end

local function placeQTelegraph(telegraph, cast, ctx, direction)
	local position = ctx.root.Position
	local ground = Vector3.new(position.X, getFootY(ctx.humanoid, ctx.root) + 0.15, position.Z)
	if cast.Shape == "Circle" then
		local center = ground + direction * cast.Offset
		telegraph.sweet.CFrame = CFrame.new(center) * FLAT
		telegraph.area.CFrame = CFrame.new(center + Vector3.new(0, 0.03, 0)) * FLAT
	else
		local base = CFrame.lookAt(ground, ground + direction)
		telegraph.area.CFrame = base * CFrame.new(0, 0, -cast.Length / 2)
		telegraph.sweet.CFrame = base * CFrame.new(0, 0.03, -(cast.Length - cast.SweetSpot / 2))
	end
end

-- Q: Quỷ Kiếm Darkin — 3 lần chém, mỗi lần có vùng "điểm ngọt"
function Skills.Q(ctx, direction)
	local cfg = Config.Q
	local now = os.clock()
	if now < state.busyUntil then
		return
	end
	if state.qStage == 1 and now < state.cooldowns.Q then
		return
	end

	local stage = state.qStage
	local cast = cfg.Casts[stage]
	state.busyUntil = now + cfg.Windup + 0.1
	state.qToken += 1
	local token = state.qToken

	if stage < #cfg.Casts then
		local window = cfg.Windup + cfg.RecastWindow
		state.qStage = stage + 1
		state.qWindowEnd = now + window
		notify("QStage", state.qStage, window)
		-- Hết thời gian mà không chém tiếp thì bắt đầu hồi chiêu
		task.delay(window, function()
			if state.qToken == token then
				state.qStage = 1
				notify("QStage", 1, 0)
				startCooldown("Q", cfg.Cooldown)
			end
		end)
	else
		state.qStage = 1
		notify("QStage", 1, 0)
		startCooldown("Q", cfg.Cooldown)
	end

	playAnimation(ctx, "Q")
	playSound(ctx.root, "QCast")
	addMovementModifier(ctx.humanoid, cfg.WindupSlow, cfg.Windup)

	-- Vung kiếm: vùng chiêu hiện dưới đất và đi theo người chơi (có thể E trong lúc vung)
	local telegraph = buildQTelegraph(cast)
	local slamTime = os.clock() + cfg.Windup
	repeat
		placeQTelegraph(telegraph, cast, ctx, direction)
		RunService.Heartbeat:Wait()
	until os.clock() >= slamTime or not isValid(ctx)

	if not isValid(ctx) then
		telegraph.area:Destroy()
		telegraph.sweet:Destroy()
		return
	end

	-- Chém xuống
	placeQTelegraph(telegraph, cast, ctx, direction)
	telegraph.area.Transparency = 0.15
	telegraph.sweet.Transparency = 0.05
	fadeOut(telegraph.area, 0.4)
	fadeOut(telegraph.sweet, 0.4)
	playSound(ctx.root, "QSlam")

	local origin = ctx.root.Position
	local targets, isSweetSpot
	if cast.Shape == "Circle" then
		local center = origin + direction * cast.Offset
		targets = getEnemiesInRadius(ctx.character, center, cast.Radius)
		isSweetSpot = function(position)
			local offset = position - center
			return Vector3.new(offset.X, 0, offset.Z).Magnitude >= cast.Radius - cast.SweetSpot
		end
	else
		local hitbox = CFrame.lookAt(origin, origin + direction) * CFrame.new(0, 0, -cast.Length / 2)
		targets = getEnemiesInBox(ctx.character, hitbox, Vector3.new(cast.Width, 10, cast.Length))
		isSweetSpot = function(position)
			return (position - origin):Dot(direction) >= cast.Length - cast.SweetSpot
		end
	end

	local totalDealt, hitSweetSpot = 0, false
	for _, target in targets do
		local damage = cast.Damage
		local color = Colors.Damage
		if isSweetSpot(target.root.Position) then
			hitSweetSpot = true
			damage *= cfg.SweetSpotMultiplier
			color = Colors.SweetSpot
			knockup(target, cfg.SweetSpotKnockup)
			stun(target, cfg.SweetSpotStun)
		end
		totalDealt += dealDamage(ctx, target, damage, color)
	end

	heal(ctx, totalDealt * Config.Lifesteal)
	if hitSweetSpot then
		reducePassiveCooldown(Config.Passive.SweetSpotReduction)
	end
end

-- E: Bước Nhảy Hắc Ám — lướt (dùng được cả khi đang vung Q)
function Skills.E(ctx, direction)
	local cfg = Config.E
	if os.clock() < state.cooldowns.E then
		return
	end
	startCooldown("E", cfg.Cooldown)
	playAnimation(ctx, "E")
	playSound(ctx.root, "Dash")
	applyVelocity(ctx.root, direction * cfg.Speed, cfg.Duration)
	dashTrail(ctx.root, cfg.Duration)
end

-- Xích bay tới nơi mà mục tiêu đã chạy xa hơn khoảng này thì coi như trượt
local CHAIN_HIT_TOLERANCE = 8

-- F: Xiềng Xích Địa Ngục — trói, không thoát kịp thì bị kéo về + choáng
function Skills.F(ctx, direction)
	local cfg = Config.F
	local now = os.clock()
	if now < state.busyUntil or now < state.cooldowns.F then
		return
	end
	startCooldown("F", cfg.Cooldown)
	state.busyUntil = now + 0.2
	playAnimation(ctx, "F")
	playSound(ctx.root, "Chain")

	local origin = ctx.root.Position
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { ctx.character }
	local result = workspace:Spherecast(origin, cfg.HitRadius, direction * cfg.Range, params)
	local endPosition = if result then result.Position else origin + direction * cfg.Range
	local target = result and getEnemyFromPart(ctx.character, result.Instance)

	-- Đầu xích bay ra
	local travelTime = math.max((endPosition - origin).Magnitude / cfg.ProjectileSpeed, 0.05)
	local head = makePart(Vector3.new(0.8, 0.8, 1.6), CFrame.lookAt(origin, origin + direction), Colors.Main, 0)
	local removeChain = createChain(ctx.root, head)
	TweenService:Create(head, TweenInfo.new(travelTime, Enum.EasingStyle.Linear), {
		CFrame = CFrame.lookAt(endPosition, endPosition + direction),
	}):Play()
	task.wait(travelTime)
	removeChain()
	head:Destroy()

	if
		not target
		or not isValid(ctx)
		or target.humanoid.Health <= 0
		or (target.root.Position - endPosition).Magnitude > CHAIN_HIT_TOLERANCE
	then
		burstEffect(endPosition, Colors.Dark, 3)
		return
	end

	burstEffect(target.root.Position, Colors.Main, 4)
	local totalDealt = dealDamage(ctx, target, cfg.Damage)

	-- Vòng trói: mục tiêu phải chạy ra ngoài vòng này trước khi hết giờ
	local anchor = target.root.Position
	local zoneCenter = Vector3.new(anchor.X, getFootY(target.humanoid, target.root) + 0.1, anchor.Z)
	local zone = makeDisc(zoneCenter, cfg.EscapeRadius, Colors.Main, 0.75)
	local removeTether = createChain(ctx.root, target.root)
	addMovementModifier(target.humanoid, cfg.Slow, cfg.PullDelay)

	local escaped = false
	local deadline = os.clock() + cfg.PullDelay
	while os.clock() < deadline do
		RunService.Heartbeat:Wait()
		if not isValid(ctx) or target.humanoid.Health <= 0 or not target.root.Parent then
			escaped = true
			break
		end
		local offset = target.root.Position - anchor
		if Vector3.new(offset.X, 0, offset.Z).Magnitude > cfg.EscapeRadius then
			escaped = true
			break
		end
	end
	removeTether()
	fadeOut(zone, 0.2)

	if not escaped then
		-- Kéo về phía Aatrox + choáng
		local toCaster = ctx.root.Position - target.root.Position
		local flat = Vector3.new(toCaster.X, 0, toCaster.Z)
		local distance = flat.Magnitude
		if distance > 4 then
			local pullTime = math.min((distance - 3) / cfg.PullSpeed, 0.6)
			applyVelocity(target.root, flat / distance * cfg.PullSpeed + Vector3.new(0, 6, 0), pullTime)
		end
		stun(target, cfg.StunDuration)
		totalDealt += dealDamage(ctx, target, cfg.PullDamage, Colors.SweetSpot)
		burstEffect(target.root.Position, Colors.Main, 7)
	end

	heal(ctx, totalDealt * Config.Lifesteal)
end

-- R: Kẻ Diệt Thế — biến hình
function Skills.R(ctx, direction)
	local cfg = Config.R
	local now = os.clock()
	if now < state.busyUntil or now < state.cooldowns.R then
		return
	end
	startCooldown("R", cfg.Cooldown)
	state.busyUntil = now + cfg.CastTime
	playAnimation(ctx, "R")
	playSound(ctx.root, "Ult")

	-- Tụ lực
	addMovementModifier(ctx.humanoid, 0.3, cfg.CastTime)
	burstEffect(ctx.root.Position, Colors.Dark, 6)
	task.wait(cfg.CastTime)
	if not isValid(ctx) then
		return
	end

	-- Bắt đầu biến hình (trước khi gây sát thương để được cộng hệ số)
	state.ultUntil = os.clock() + cfg.Duration
	notify("Ult", cfg.Duration)
	addMovementModifier(ctx.humanoid, cfg.SpeedMultiplier, cfg.Duration)

	local highlight = Instance.new("Highlight")
	highlight.Name = "AatroxWorldEnder"
	highlight.FillColor = Colors.Dark
	highlight.FillTransparency = 0.55
	highlight.OutlineColor = Colors.Main
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded -- không nhìn xuyên tường
	highlight.Parent = ctx.character
	Debris:AddItem(highlight, cfg.Duration)

	local aura = Instance.new("PointLight")
	aura.Color = Colors.Main
	aura.Brightness = 3
	aura.Range = 14
	aura.Parent = ctx.root
	Debris:AddItem(aura, cfg.Duration)

	-- Nội tại hồi nhanh hơn
	if not isPassiveReady() then
		local remaining = state.passiveReadyAt - os.clock()
		state.passiveReadyAt = os.clock() + remaining * cfg.PassiveCooldownMultiplier
		schedulePassive()
	end

	-- Sóng xung kích: hất văng + làm chậm kẻ địch xung quanh
	local origin = ctx.root.Position
	local ring = makeDisc(Vector3.new(origin.X, getFootY(ctx.humanoid, ctx.root) + 0.2, origin.Z), 1, Colors.Main, 0.2)
	fadeOut(ring, 0.45, { Size = Vector3.new(0.2, cfg.Radius * 2, cfg.Radius * 2) })
	burstEffect(origin, Colors.Main, 8)

	local totalDealt = 0
	for _, target in getEnemiesInRadius(ctx.character, origin, cfg.Radius) do
		local away = flatUnit(target.root.Position - origin) or direction
		applyVelocity(target.root, away * cfg.Knockback + Vector3.new(0, cfg.Knockback * 0.3, 0), 0.2)
		addMovementModifier(target.humanoid, cfg.FearSlow, cfg.FearDuration)
		showText(target.root, "SỢ HÃI", Colors.Passive, cfg.FearDuration)
		totalDealt += dealDamage(ctx, target, cfg.CastDamage)
	end
	heal(ctx, totalDealt * Config.Lifesteal)
end

--------------------------------------------------------------------------------
-- Nhận yêu cầu từ client
--------------------------------------------------------------------------------

local function getContext(player)
	local character = tool.Parent
	if not character or character ~= player.Character then
		return nil -- chỉ người đang cầm kiếm mới dùng được
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local root = character:FindFirstChild("HumanoidRootPart")
	if not humanoid or not root or humanoid.Health <= 0 then
		return nil
	end
	if state.owner ~= player then
		state = newState(player) -- kiếm đổi chủ: làm mới hồi chiêu
	end
	return { player = player, character = character, humanoid = humanoid, root = root }
end

-- Gửi lại toàn bộ hồi chiêu khi client vừa cầm kiếm lên
local function syncClient()
	local now = os.clock()
	for _, skill in { "Q", "E", "F", "R" } do
		local remaining = state.cooldowns[skill] - now
		if remaining > 0 then
			notify("Cooldown", skill, remaining, Config[skill].Cooldown)
		end
	end
	if state.qStage > 1 and now < state.qWindowEnd then
		notify("QStage", state.qStage, state.qWindowEnd - now)
	end
	if isUltActive() then
		notify("Ult", state.ultUntil - now)
	end
	schedulePassive()
end

remote.OnServerEvent:Connect(function(player, action, direction)
	if typeof(action) ~= "string" then
		return
	end
	local ctx = getContext(player)
	if not ctx then
		return
	end
	if action == "Sync" then
		syncClient()
		return
	end
	local skill = Skills[action]
	if not skill or isStunned(ctx.humanoid) then
		return
	end
	skill(ctx, sanitizeDirection(direction, ctx.root))
end)
