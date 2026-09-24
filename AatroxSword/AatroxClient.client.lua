--[[
	AatroxClient (LocalScript) — đặt BÊN TRONG Tool, cùng cấp với AatroxConfig.

	Nhận phím bấm / nút cảm ứng, gửi yêu cầu dùng chiêu lên server và vẽ thanh kỹ năng.
	Client KHÔNG tự gây sát thương hay tính hồi chiêu — việc đó là của AatroxServer.
]]

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local ContextActionService = game:GetService("ContextActionService")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local tool = script.Parent
local Config = require(tool:WaitForChild("AatroxConfig"))
-- RemoteEvent do AatroxServer tạo khi kiếm được cầm lần đầu (nếu bạn chưa tự thêm vào Tool)
local remote = tool:WaitForChild("AatroxRemote", math.huge)

local SKILLS = { "Q", "E", "F", "R" }
local SLOT_ORDER = { "Passive", "Q", "E", "F", "R" }
local ACTION_PREFIX = "AatroxSkill_"
local SLOT_SIZE = 64
local STROKE_NORMAL = Color3.fromRGB(110, 20, 30)

local cooldowns = {} -- [chiêu] = { endTime = ..., total = ... }
local qStage, qWindowEnd = 1, 0
local ultEnd = 0

local equipped = false
local gui, slots
local connections = {}

--------------------------------------------------------------------------------
-- Thanh kỹ năng
--------------------------------------------------------------------------------

local function makeLabel(parent, props)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.GothamBold
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.5
	for key, value in props do
		label[key] = value
	end
	label.Parent = parent
	return label
end

local function createSlot(parent, skill, order)
	local frame = Instance.new("Frame")
	frame.Name = skill
	frame.LayoutOrder = order
	frame.Size = UDim2.fromOffset(SLOT_SIZE, SLOT_SIZE)
	frame.BackgroundColor3 = Color3.fromRGB(28, 10, 14)
	frame.BackgroundTransparency = 0.1
	frame.ClipsDescendants = true
	frame.Parent = parent

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = frame

	local stroke = Instance.new("UIStroke")
	stroke.Thickness = 2
	stroke.Color = STROKE_NORMAL
	stroke.Parent = frame

	-- Lớp tối che dần từ dưới lên khi đang hồi chiêu
	local overlay = Instance.new("Frame")
	overlay.AnchorPoint = Vector2.new(0, 1)
	overlay.Position = UDim2.fromScale(0, 1)
	overlay.Size = UDim2.fromScale(1, 0)
	overlay.BackgroundColor3 = Color3.new(0, 0, 0)
	overlay.BackgroundTransparency = 0.35
	overlay.BorderSizePixel = 0
	overlay.ZIndex = 2
	overlay.Parent = frame

	local keyLabel = makeLabel(frame, {
		Text = if skill == "Passive" then "" else Config.Keybinds[skill].Name,
		Size = UDim2.new(1, -8, 0, 18),
		Position = UDim2.fromOffset(6, 3),
		TextXAlignment = Enum.TextXAlignment.Left,
		TextSize = 15,
		ZIndex = 3,
	})
	makeLabel(frame, {
		Text = Config.SkillNames[skill],
		Size = UDim2.new(1, -6, 0, 15),
		Position = UDim2.new(0, 3, 1, -18),
		TextScaled = true,
		TextColor3 = Color3.fromRGB(255, 190, 190),
		ZIndex = 3,
	})
	local timer = makeLabel(frame, {
		Text = "",
		Size = UDim2.fromScale(1, 1),
		TextSize = 22,
		ZIndex = 4,
	})

	return { stroke = stroke, overlay = overlay, keyLabel = keyLabel, timer = timer }
end

local function createGui()
	gui = Instance.new("ScreenGui")
	gui.Name = "AatroxSkillBar"
	gui.ResetOnSpawn = true

	local bar = Instance.new("Frame")
	bar.AnchorPoint = Vector2.new(0.5, 1)
	bar.Position = UDim2.new(0.5, 0, 1, -90) -- nằm trên thanh công cụ (hotbar) mặc định
	bar.Size = UDim2.fromOffset(#SLOT_ORDER * (SLOT_SIZE + 8), SLOT_SIZE)
	bar.BackgroundTransparency = 1
	bar.Parent = gui

	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Horizontal
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Padding = UDim.new(0, 8)
	layout.Parent = bar

	slots = {}
	for index, skill in SLOT_ORDER do
		slots[skill] = createSlot(bar, skill, index)
	end
	gui.Parent = player:WaitForChild("PlayerGui")
end

local function formatTime(seconds)
	if seconds >= 1 then
		return tostring(math.ceil(seconds))
	end
	return string.format("%.1f", seconds)
end

local function updateGui()
	if not slots then
		return
	end
	local now = os.clock()

	for skill, slot in slots do
		local cooldown = cooldowns[skill]
		local remaining = if cooldown then cooldown.endTime - now else 0
		if remaining > 0 then
			slot.overlay.Size = UDim2.fromScale(1, math.clamp(remaining / cooldown.total, 0, 1))
			slot.timer.Text = formatTime(remaining)
		else
			slot.overlay.Size = UDim2.fromScale(1, 0)
			slot.timer.Text = ""
		end
		slot.stroke.Color = STROKE_NORMAL
	end

	-- Nội tại sẵn sàng: viền đỏ sáng
	local passive = cooldowns.Passive
	if not passive or passive.endTime <= now then
		slots.Passive.stroke.Color = Config.Colors.Passive
	end

	-- Q đang chờ lần chém tiếp theo
	local qKey = Config.Keybinds.Q.Name
	if qStage > 1 and now < qWindowEnd then
		slots.Q.keyLabel.Text = string.format("%s  %d/%d", qKey, qStage, #Config.Q.Casts)
		slots.Q.stroke.Color = Config.Colors.SweetSpot
	else
		slots.Q.keyLabel.Text = qKey
	end

	-- R đang biến hình
	local rKey = Config.Keybinds.R.Name
	if now < ultEnd then
		slots.R.keyLabel.Text = string.format("%s  %ds", rKey, math.ceil(ultEnd - now))
		slots.R.stroke.Color = Config.Colors.Ult
	else
		slots.R.keyLabel.Text = rKey
	end
end

remote.OnClientEvent:Connect(function(kind, a, b, c)
	local now = os.clock()
	if kind == "Cooldown" then
		cooldowns[a] = { endTime = now + b, total = math.max(c or b, 0.01) }
	elseif kind == "QStage" then
		qStage = a
		qWindowEnd = now + b
	elseif kind == "Ult" then
		ultEnd = now + a
	end
end)

--------------------------------------------------------------------------------
-- Ngắm & dùng chiêu
--------------------------------------------------------------------------------

local function flatUnit(vector, minLength)
	local flat = Vector3.new(vector.X, 0, vector.Z)
	if flat.Magnitude < (minLength or 1e-3) then
		return nil
	end
	return flat.Unit
end

local function getAimDirection(character, root)
	if Config.AimAtMouse and UserInputService.MouseEnabled then
		local camera = workspace.CurrentCamera
		local mouseLocation = UserInputService:GetMouseLocation()
		local ray = camera:ViewportPointToRay(mouseLocation.X, mouseLocation.Y)
		local params = RaycastParams.new()
		params.FilterType = Enum.RaycastFilterType.Exclude
		params.FilterDescendantsInstances = { character }
		local result = workspace:Raycast(ray.Origin, ray.Direction * 1000, params)
		local point = if result then result.Position else ray.Origin + ray.Direction * 1000
		local direction = flatUnit(point - root.Position, 1)
		if direction then
			return direction
		end
	end
	return flatUnit(root.CFrame.LookVector) or Vector3.new(0, 0, -1)
end

local function isOnCooldown(skill)
	local now = os.clock()
	if skill == "Q" and qStage > 1 and now < qWindowEnd then
		return false
	end
	local cooldown = cooldowns[skill]
	return cooldown ~= nil and now < cooldown.endTime - 0.1
end

local function useSkill(skill)
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not humanoid or not root or humanoid.Health <= 0 or isOnCooldown(skill) then
		return
	end

	-- E lướt theo hướng đang chạy; đứng yên thì lướt theo hướng ngắm
	local direction = if skill == "E" then flatUnit(humanoid.MoveDirection, 0.1) else nil
	direction = direction or getAimDirection(character, root)

	root.CFrame = CFrame.lookAt(root.Position, root.Position + direction)
	remote:FireServer(skill, direction)
end

local function onAction(actionName, inputState)
	if inputState ~= Enum.UserInputState.Begin then
		return Enum.ContextActionResult.Pass
	end
	useSkill(string.sub(actionName, #ACTION_PREFIX + 1))
	return Enum.ContextActionResult.Sink
end

--------------------------------------------------------------------------------
-- Cầm / cất kiếm
--------------------------------------------------------------------------------

local function onUnequipped()
	if not equipped then
		return
	end
	equipped = false
	for _, skill in SKILLS do
		ContextActionService:UnbindAction(ACTION_PREFIX .. skill)
	end
	for _, connection in connections do
		connection:Disconnect()
	end
	table.clear(connections)
	if gui then
		gui:Destroy()
		gui, slots = nil, nil
	end
end

local function onEquipped()
	if equipped then
		return
	end
	equipped = true

	-- true = tự tạo nút cảm ứng trên điện thoại/máy tính bảng
	for _, skill in SKILLS do
		local actionName = ACTION_PREFIX .. skill
		ContextActionService:BindAction(actionName, onAction, true, Config.Keybinds[skill])
		ContextActionService:SetTitle(actionName, Config.SkillNames[skill])
	end

	if Config.ShowSkillBar then
		createGui()
		table.insert(connections, RunService.RenderStepped:Connect(updateGui))
	end

	local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if humanoid then
		table.insert(connections, humanoid.Died:Connect(onUnequipped))
	end

	remote:FireServer("Sync")
end

tool.Activated:Connect(function()
	useSkill("Attack")
end)
tool.Equipped:Connect(onEquipped)
tool.Unequipped:Connect(onUnequipped)

-- Lần cầm đầu tiên: script có thể chạy xong sau khi sự kiện Equipped đã xảy ra
if tool.Parent == player.Character then
	onEquipped()
end
