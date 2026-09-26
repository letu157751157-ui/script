import { world, system, EffectTypes } from "@minecraft/server";

// Lưu thời gian cooldown và trạng thái cho mỗi player
const playerCooldowns = new Map();
const playerLastDamageTime = new Map();
const playerLastDurabilityRepair = new Map();

// Hàm tạo particle aura tuyết xanh nước xung quanh người chơi
function createFrozenAura(player, isHealing = false, isPassiveHealing = false) {
    const location = player.location;
    
    // Thu nhỏ aura để không che góc nhìn
    const radius = 0.6;
    const particleCount = isHealing ? 12 : (isPassiveHealing ? 6 : 4);
    const height = 0.3; // Hạ thấp xuống để tránh che góc nhìn
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const offsetX = Math.cos(angle) * radius;
        const offsetZ = Math.sin(angle) * radius;
        
        const layers = isHealing ? 2 : 1; // Giảm số tầng
        for (let h = 0; h < layers; h++) {
            const offsetY = height + (h * 0.3);
            
            try {
                player.dimension.spawnParticle(
                    "minecraft:blue_flame_particle",
                    {
                        x: location.x + offsetX,
                        y: location.y + offsetY,
                        z: location.z + offsetZ
                    }
                );
                

            } catch (error) {
                // Ignore particle spawn errors
            }
        }
    }
}

// Kiểm tra xem người chơi có đang mặc frozen chestplate không
function hasFrozenChestplate(player) {
    try {
        const equipment = player.getComponent("minecraft:equippable");
        const chestplate = equipment.getEquipment("Chest");
        
        if (chestplate && chestplate.typeId === "pa:frozen_chestplate") {
            return true;
        }
    } catch (error) {
        // Player không có equipment component
    }
    return false;
}

// MIỄN NHIỄM HOÀN TOÀN với Slowness - Xóa ngay lập tức
function preventSlownessEffect(player) {
    try {
        const slowness = player.getEffect("slowness");
        if (slowness) {
            player.removeEffect("slowness");
        }
    } catch (error) {
        // Ignore effect errors
    }
}

// Kiểm tra và kích hoạt hồi máu khi máu dưới 4 (2 tim)
function checkHealthAndHeal(player) {
    try {
        const health = player.getComponent("minecraft:health");
        const currentHealth = health.currentValue;
        const playerId = player.id;
        const currentTime = Date.now();
        
        // Kiểm tra cooldown (200 giây = 200000ms)
        const cooldownTime = 200000;
        const lastHealTime = playerCooldowns.get(playerId) || 0;
        const timeElapsed = currentTime - lastHealTime;
        
        // Nếu máu dưới 4 và đã hết cooldown
        if (currentHealth < 4 && timeElapsed >= cooldownTime) {
            // Hồi máu 3 trong 5 giây (Regeneration II)
            player.addEffect("regeneration", 100, {
                amplifier: 1, // Level 2
                showParticles: true
            });
            
            // Lưu thời gian sử dụng skill
            playerCooldowns.set(playerId, currentTime);
            
            // Thông báo cho player
            player.sendMessage("§b§l[Frozen Armor] §rSkill hồi máu khẩn cấp đã được kích hoạt!");
            player.playSound("random.levelup");
            
            return true;
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

// Hồi máu thụ động khi không nhận dame trong 10 giây
function passiveHealthRegen(player) {
    try {
        const playerId = player.id;
        const currentTime = Date.now();
        const lastDamage = playerLastDamageTime.get(playerId) || 0;
        const timeSinceLastDamage = currentTime - lastDamage;
        
        // Nếu không nhận dame trong 10 giây (10000ms)
        if (timeSinceLastDamage >= 10000) {
            const health = player.getComponent("minecraft:health");
            const currentHealth = health.currentValue;
            const maxHealth = health.effectiveMax;
            
            // Nếu chưa đầy máu thì hồi 0.5 HP mỗi 2 giây
            if (currentHealth < maxHealth) {
                // Hồi máu 0.5 trong 2 giây (Regeneration I)
                player.addEffect("regeneration", 40, {
                    amplifier: 0, // Level 1
                    showParticles: false
                });
                return true;
            }
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Hồi độ bền giáp mỗi 3 giây
function repairArmorDurability(player) {
    try {
        const playerId = player.id;
        const currentTime = Date.now();
        const lastRepair = playerLastDurabilityRepair.get(playerId) || 0;
        const timeSinceLastRepair = currentTime - lastRepair;
        
        // Mỗi 3 giây (3000ms)
        if (timeSinceLastRepair >= 3000) {
            const equipment = player.getComponent("minecraft:equippable");
            const chestplate = equipment.getEquipment("Chest");
            
            if (chestplate && chestplate.typeId === "pa:frozen_chestplate") {
                const durability = chestplate.getComponent("minecraft:durability");
                
                if (durability && durability.damage > 0) {
                    // Hồi 1 độ bền
                    durability.damage = Math.max(0, durability.damage - 1);
                    equipment.setEquipment("Chest", chestplate);
                    
                    // Particle nhỏ ở vị trí ngực (không phải trên đầu)
                    player.dimension.spawnParticle(
                        "minecraft:sparkler_emitter",
                        {
                            x: player.location.x,
                            y: player.location.y + 1,
                            z: player.location.z
                        }
                    );
                }
            }
            
            playerLastDurabilityRepair.set(playerId, currentTime);
        }
    } catch (error) {
        // Ignore repair errors
    }
}

// Hiển thị cooldown còn lại
function displayCooldown(player) {
    try {
        const playerId = player.id;
        const currentTime = Date.now();
        const lastHealTime = playerCooldowns.get(playerId) || 0;
        const cooldownTime = 200000;
        const timeElapsed = currentTime - lastHealTime;
        const remainingTime = cooldownTime - timeElapsed;
        
        if (remainingTime > 0) {
            const secondsLeft = Math.ceil(remainingTime / 1000);
            player.onScreenDisplay.setActionBar(`§b§lFrozen Armor Cooldown: §f${secondsLeft}s`);
        }
    } catch (error) {
        // Ignore display errors
    }
}

// Áp dụng slowness cho entities xung quanh
function applySlownessToNearbyEntities(player) {
    const location = player.location;
    const radius = 5;
    
    try {
        const nearbyEntities = player.dimension.getEntities({
            location: location,
            maxDistance: radius,
            excludeTypes: ["minecraft:item"]
        });
        
        for (const entity of nearbyEntities) {
            if (entity.id === player.id) continue;
            
            const isOtherPlayer = entity.typeId === "minecraft:player";
            const isMob = !isOtherPlayer && entity.typeId !== "minecraft:armor_stand";
            
            if (isOtherPlayer || isMob) {
                try {
                    entity.addEffect("slowness", 40, {
                        amplifier: 1,
                        showParticles: true
                    });
                    
                    entity.dimension.spawnParticle(
                        "minecraft:ice_evaporation_emitter",
                        {
                            x: entity.location.x,
                            y: entity.location.y + 1,
                            z: entity.location.z
                        }
                    );
                } catch (error) {
                    // Entity không thể nhận effect
                }
            }
        }
    } catch (error) {
        // Ignore entity query errors
    }
}

// Lắng nghe sự kiện nhận dame để reset thời gian
world.afterEvents.entityHurt.subscribe((event) => {
    const entity = event.hurtEntity;
    if (entity.typeId === "minecraft:player") {
        const player = entity;
        if (hasFrozenChestplate(player)) {
            playerLastDamageTime.set(player.id, Date.now());
        }
    }
});

// ===== MIỄN NHIỄM SLOWNESS - Chặn ngay khi nhận effect =====
world.afterEvents.effectAdd.subscribe((event) => {
    const entity = event.entity;
    
    // Kiểm tra nếu là player và đang mặc Frozen Chestplate
    if (entity.typeId === "minecraft:player") {
        const player = entity;
        
        if (hasFrozenChestplate(player) && event.effect.typeId === "slowness") {
            // Xóa ngay lập tức effect slowness
            system.runTimeout(() => {
                try {
                    player.removeEffect("slowness");
                } catch (error) {
                    // Ignore
                }
            }, 1);
        }
    }
});

// Chạy loop kiểm tra và tạo particle
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (hasFrozenChestplate(player)) {
            // Xóa slowness liên tục để đảm bảo miễn nhiễm 100%
            preventSlownessEffect(player);
            
            const isEmergencyHealing = checkHealthAndHeal(player);
            const isPassiveHealing = passiveHealthRegen(player);
            createFrozenAura(player, isEmergencyHealing, isPassiveHealing);
            applySlownessToNearbyEntities(player);
            repairArmorDurability(player);
            displayCooldown(player);
        }
    }
}, 1); // Check mỗi tick để đảm bảo xóa slowness ngay lập tức

// Thông báo khi script được load
world.afterEvents.worldInitialize.subscribe(() => {
    console.warn("§a[Frozen Armor] §fScript loaded with §bSlowness Immunity§f!");
});