// File: scripts/yetiphase1.js
// Skills cho Yeti Phase 1 - Giai đoạn đầu (dễ hơn)

import { world, system } from "@minecraft/server";

// Cấu hình cho Phase 1
const YETI_PHASE1_CONFIG = {
    identifier: "pa:yeti",
    health: 500,
    detectRange: 25,
    skillCooldowns: {
        iceBall: 80,        // 4 giây - Ném cầu băng
        freezeGround: 160,  // 8 giây - Đóng băng mặt đất
        roar: 200,          // 10 giây - Gầm làm chậm
        jump: 120,          // 6 giây - Nhảy đè
        iceRegen: 400,      // 20 giây - Đóng băng hồi máu
        giantIceBall: 300,  // 15 giây - Cầu băng khổng lồ
        summonMinions: 500  // 25 giây - Triệu hồi đệ
    }
};

// Lưu cooldown
const phase1Cooldowns = new Map();
const iceShieldActive = new Map(); // Theo dõi trạng thái shield
const icePrisonActive = new Map(); // Theo dõi player bị nhốt

// Skill 1: Ice Ball - Ném cầu băng đơn giản
function iceBall(yeti, target) {
    const yetiPos = yeti.location;
    const targetPos = target.location;
    
    // Tính hướng bay
    const dx = targetPos.x - yetiPos.x;
    const dy = targetPos.y - yetiPos.y + 1;
    const dz = targetPos.z - yetiPos.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    const dirX = dx / distance;
    const dirY = dy / distance;
    const dirZ = dz / distance;
    
    // Hiệu ứng ném
    yeti.dimension.playSound("mob.ghast.fireball", yetiPos, { volume: 0.5 });
    
    // Bay từ từ tới target
    let step = 0;
    const maxSteps = 20;
    const ballInterval = system.runInterval(() => {
        step++;
        
        const currentPos = {
            x: yetiPos.x + dirX * step,
            y: yetiPos.y + 1.5 + dirY * step,
            z: yetiPos.z + dirZ * step
        };
        
        // Particle cầu băng
        yeti.dimension.spawnParticle("minecraft:snowflake_particle", currentPos);
        yeti.dimension.spawnParticle("minecraft:ice_evaporation_emitter", currentPos);
        
        // Kiểm tra trúng player
        const hitPlayers = yeti.dimension.getEntities({
            location: currentPos,
            maxDistance: 1.5,
            type: "minecraft:player"
        });
        
        if (hitPlayers.length > 0) {
            hitPlayers.forEach(player => {
                player.applyDamage(6, { cause: "projectile", damagingEntity: yeti });
                player.addEffect("slowness", 60, { amplifier: 1 });
            });
            yeti.dimension.playSound("random.glass", currentPos);
            yeti.dimension.spawnParticle("minecraft:ice_evaporation_emitter", currentPos);
            system.clearRun(ballInterval);
        }
        
        // Hết tầm hoặc chạm đất
        if (step >= maxSteps || currentPos.y <= yetiPos.y - 1) {
            yeti.dimension.spawnParticle("minecraft:huge_explosion_emitter", currentPos);
            system.clearRun(ballInterval);
        }
    }, 2);
}

// Skill 2: Freeze Ground - Đóng băng mặt đất nhỏ
function freezeGround(yeti) {
    const location = yeti.location;
    const radius = 5;
    
    yeti.dimension.playSound("random.glass", location);
    yeti.dimension.spawnParticle("minecraft:bleach", location);
    
    // Tạo vùng băng
    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
            const dist = Math.sqrt(x*x + z*z);
            if (dist <= radius) {
                system.runTimeout(() => {
                    const blockPos = {
                        x: Math.floor(location.x + x),
                        y: Math.floor(location.y - 1),
                        z: Math.floor(location.z + z)
                    };
                    
                    try {
                        const block = yeti.dimension.getBlock(blockPos);
                        if (block && (block.typeId === "minecraft:water" || 
                                     block.typeId === "minecraft:grass_block" ||
                                     block.typeId === "minecraft:dirt")) {
                            // Đặt băng tạm thời
                            yeti.dimension.spawnParticle("minecraft:snowflake_particle", {
                                x: blockPos.x + 0.5,
                                y: blockPos.y + 1,
                                z: blockPos.z + 0.5
                            });
                        }
                    } catch(e) {}
                }, Math.random() * 20);
            }
        }
    }
    
    // Gây sát thương player trong vùng
    let tickCount = 0;
    const freezeInterval = system.runInterval(() => {
        tickCount++;
        
        const nearbyPlayers = yeti.dimension.getEntities({
            location: location,
            maxDistance: radius,
            type: "minecraft:player"
        });
        
        nearbyPlayers.forEach(player => {
            player.applyDamage(1, { cause: "freezing", damagingEntity: yeti });
            player.addEffect("slowness", 30, { amplifier: 1 });
            yeti.dimension.spawnParticle("minecraft:snowflake_particle", player.location);
        });
        
        if (tickCount >= 60) { // 3 giây
            system.clearRun(freezeInterval);
        }
    }, 10);
}

// Skill 3: Frost Roar - Gầm gây slowness
function frostRoar(yeti) {
    const location = yeti.location;
    
    // Animation giả lập - Rung đầu
    for (let i = 0; i < 15; i++) {
        system.runTimeout(() => {
            yeti.dimension.spawnParticle("minecraft:critical_hit_emitter", {
                x: location.x,
                y: location.y + 2.5,
                z: location.z
            });
        }, i * 2);
    }
    
    // Hoặc dùng animation thật nếu có:
    // yeti.runCommand('playanimation @s animation.yeti.roar');
    
    yeti.dimension.playSound("mob.enderdragon.growl", location, { 
        volume: 1.5, 
        pitch: 0.7 
    });
    
    // Tạo sóng particle
    for (let ring = 1; ring <= 4; ring++) {
        system.runTimeout(() => {
            const ringRadius = ring * 3;
            
            for (let angle = 0; angle < 360; angle += 15) {
                const rad = angle * Math.PI / 180;
                const particlePos = {
                    x: location.x + Math.cos(rad) * ringRadius,
                    y: location.y + 1,
                    z: location.z + Math.sin(rad) * ringRadius
                };
                yeti.dimension.spawnParticle("minecraft:ice_evaporation_emitter", particlePos);
            }
            
            // Gây hiệu ứng
            const affectedPlayers = yeti.dimension.getEntities({
                location: location,
                maxDistance: ringRadius + 1,
                minDistance: ringRadius - 1,
                type: "minecraft:player"
            });
            
            affectedPlayers.forEach(player => {
                player.addEffect("slowness", 80, { amplifier: 1 });
                player.addEffect("mining_fatigue", 80, { amplifier: 0 });
            });
        }, ring * 10);
    }
}

// Skill 4: Ice Jump - Nhảy lên và đè xuống
function iceJump(yeti, target) {
    const startPos = yeti.location;
    const targetPos = target.location;
    
    // Animation nhảy - Particle trail
    yeti.dimension.playSound("mob.irongolem.throw", startPos);
    yeti.dimension.spawnParticle("minecraft:villager_happy", startPos);
    
    // Hoặc dùng animation thật:
    // yeti.runCommand('playanimation @s animation.yeti.jump');
    
    // Teleport lên cao
    yeti.teleport(
        { x: startPos.x, y: startPos.y + 5, z: startPos.z },
        { dimension: yeti.dimension }
    );
    
    // Rơi xuống vị trí target sau 1 giây
    system.runTimeout(() => {
        const landPos = {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z
        };
        
        yeti.teleport(landPos, { dimension: yeti.dimension });
        
        // Hiệu ứng đổ bộ
        yeti.dimension.spawnParticle("minecraft:huge_explosion_emitter", landPos);
        yeti.dimension.playSound("random.explode", landPos);
        
        // Gây sát thương vùng
        const hitPlayers = yeti.dimension.getEntities({
            location: landPos,
            maxDistance: 4,
            type: "minecraft:player"
        });
        
        hitPlayers.forEach(player => {
            const distance = getDistance(player.location, landPos);
            const damage = 8 - Math.floor(distance * 1.5);
            
            player.applyDamage(Math.max(damage, 3), { 
                cause: "entityAttack", 
                damagingEntity: yeti 
            });
            player.applyKnockback(
                player.location.x - landPos.x,
                player.location.z - landPos.z,
                1.5,
                0.4
            );
        });
        
        // Particle xung quanh
        for (let angle = 0; angle < 360; angle += 30) {
            const rad = angle * Math.PI / 180;
            const particlePos = {
                x: landPos.x + Math.cos(rad) * 3,
                y: landPos.y,
                z: landPos.z + Math.sin(rad) * 3
            };
            yeti.dimension.spawnParticle("minecraft:blue_flame_particle", particlePos);
        }
    }, 20);
}

// Skill 5: Ice Regeneration - Đóng băng hồi máu
function iceRegeneration(yeti) {
    const location = yeti.location;
    const entityId = yeti.id;
    
    // Đánh dấu đang dùng shield
    iceShieldActive.set(entityId, true);
    
    // Hiệu ứng bắt đầu
    yeti.dimension.playSound("beacon.power", location, { volume: 1.0, pitch: 1.2 });
    yeti.dimension.spawnParticle("minecraft:bleach", location);
    
    // Tạo lớp băng bảo vệ xung quanh
    let regenTick = 0;
    const regenDuration = 1000; // 5 giây
    const healAmount = 4; // Hồi 2 HP mỗi 0.5 giây
    const totalHeal = 200; // Tổng hồi 20 HP
    
    const regenInterval = system.runInterval(() => {
        if (!yeti.isValid()) {
            system.clearRun(regenInterval);
            iceShieldActive.delete(entityId);
            return;
        }
        
        regenTick++;
        const currentLoc = yeti.location;
        
        // Tạo lớp băng xoay xung quanh
        const angle = (regenTick * 10) % 360;
        for (let i = 0; i < 8; i++) {
            const rad = (angle + i * 45) * Math.PI / 180;
            const shieldPos = {
                x: currentLoc.x + Math.cos(rad) * 2,
                y: currentLoc.y + 1,
                z: currentLoc.z + Math.sin(rad) * 2
            };
            yeti.dimension.spawnParticle("minecraft:ice_evaporation_emitter", shieldPos);
        }
        
        // Particle xung quanh boss
        if (regenTick % 5 === 0) {
            yeti.dimension.spawnParticle("minecraft:villager_happy", {
                x: currentLoc.x,
                y: currentLoc.y + 1.5,
                z: currentLoc.z
            });
            yeti.dimension.playSound("random.orb", currentLoc, { volume: 0.3, pitch: 1.5 });
        }
        
        // Hồi máu mỗi 10 tick (0.5 giây)
        if (regenTick % 10 === 0) {
            try {
                const health = yeti.getComponent("minecraft:health");
                if (health) {
                    const newHealth = Math.min(
                        health.currentValue + healAmount,
                        YETI_PHASE1_CONFIG.health
                    );
                    health.setCurrentValue(newHealth);
                    
                    // Hiệu ứng hồi máu
                    yeti.dimension.spawnParticle("minecraft:heart_particle", {
                        x: currentLoc.x,
                        y: currentLoc.y + 2,
                        z: currentLoc.z
                    });
                }
            } catch(e) {}
        }
        
        // Đẩy lùi player lại gần
        const nearbyPlayers = yeti.dimension.getEntities({
            location: currentLoc,
            maxDistance: 3,
            type: "minecraft:player"
        });
        
        nearbyPlayers.forEach(player => {
            const dx = player.location.x - currentLoc.x;
            const dz = player.location.z - currentLoc.z;
            player.applyKnockback(dx, dz, 0.5, 0.2);
            player.addEffect("slowness", 20, { amplifier: 1 });
        });
        
        // Kết thúc sau 5 giây
        if (regenTick >= regenDuration) {
            system.clearRun(regenInterval);
            iceShieldActive.delete(entityId);
            
            // Hiệu ứng kết thúc
            yeti.dimension.spawnParticle("minecraft:huge_explosion_emitter", currentLoc);
            yeti.dimension.playSound("random.glass", currentLoc);
        }
    }, 1);
}

// Skill 6: Giant Ice Ball - Cầu băng khổng lồ nhốt player
function giantIceBall(yeti, target) {
    const yetiPos = yeti.location;
    const targetPos = target.location;
    
    // Hiệu ứng charge
    yeti.dimension.playSound("mob.wither.shoot", yetiPos, { volume: 1.5, pitch: 0.8 });
    
    // Tạo cầu băng khổng lồ bay chậm
    const dx = targetPos.x - yetiPos.x;
    const dy = targetPos.y - yetiPos.y + 1;
    const dz = targetPos.z - yetiPos.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    const dirX = dx / distance;
    const dirY = dy / distance;
    const dirZ = dz / distance;
    
    let step = 0;
    const maxSteps = 30;
    const ballSize = 2; // Kích thước cầu lớn hơn
    
    const giantBallInterval = system.runInterval(() => {
        step++;
        
        const currentPos = {
            x: yetiPos.x + dirX * step * 0.8,
            y: yetiPos.y + 2 + dirY * step * 0.8,
            z: yetiPos.z + dirZ * step * 0.8
        };
        
        // Particle cầu băng khổng lồ (nhiều lớp)
        for (let layer = 0; layer < 3; layer++) {
            for (let angle = 0; angle < 360; angle += 20) {
                const rad = angle * Math.PI / 180;
                const radius = ballSize - layer * 0.5;
                const particlePos = {
                    x: currentPos.x + Math.cos(rad) * radius,
                    y: currentPos.y,
                    z: currentPos.z + Math.sin(rad) * radius
                };
                yeti.dimension.spawnParticle("minecraft:ice_evaporation_emitter", particlePos);
            }
        }
        
        // Particle tâm cầu
        yeti.dimension.spawnParticle("minecraft:bleach", currentPos);
        
        // Kiểm tra trúng player
        const hitPlayers = yeti.dimension.getEntities({
            location: currentPos,
            maxDistance: ballSize + 1,
            type: "minecraft:player"
        });
        
        if (hitPlayers.length > 0) {
            hitPlayers.forEach(player => {
                // Gây sát thương
                player.applyDamage(12, { cause: "projectile", damagingEntity: yeti });
                
                // Nhốt player trong lồng băng
                createIcePrison(yeti, player, currentPos);
            });
            
            // Nổ
            yeti.dimension.spawnParticle("minecraft:huge_explosion_emitter", currentPos);
            yeti.dimension.playSound("random.explode", currentPos, { volume: 1.5 });
            system.clearRun(giantBallInterval);
        }
        
        // Hết tầm
        if (step >= maxSteps) {
            // Nổ tại chỗ
            yeti.dimension.spawnParticle("minecraft:huge_explosion_emitter", currentPos);
            yeti.dimension.playSound("random.explode", currentPos);
            
            // Tạo vùng băng nhỏ
            const nearPlayers = yeti.dimension.getEntities({
                location: currentPos,
                maxDistance: 4,
                type: "minecraft:player"
            });
            nearPlayers.forEach(p => {
                p.applyDamage(6, { cause: "freezing", damagingEntity: yeti });
                p.addEffect("slowness", 60, { amplifier: 2 });
            });
            
            system.clearRun(giantBallInterval);
        }
    }, 2);
}

// Hàm tạo lồng băng nhốt player
function createIcePrison(yeti, player, centerPos) {
    const playerId = player.id;
    
    // Đánh dấu player đang bị nhốt
    icePrisonActive.set(playerId, true);
    
    yeti.dimension.playSound("random.glass", centerPos, { volume: 1.0 });
    
    const prisonRadius = 2;
    const prisonHeight = 3;
    let prisonTick = 0;
    const prisonDuration = 100; // 5 giây
    
    const prisonInterval = system.runInterval(() => {
        if (!player.isValid()) {
            system.clearRun(prisonInterval);
            icePrisonActive.delete(playerId);
            return;
        }
        
        prisonTick++;
        const playerPos = player.location;
        
        // Tạo vòng tròn băng xung quanh (tường)
        for (let angle = 0; angle < 360; angle += 15) {
            const rad = angle * Math.PI / 180;
            for (let h = 0; h <= prisonHeight; h++) {
                const wallPos = {
                    x: centerPos.x + Math.cos(rad) * prisonRadius,
                    y: centerPos.y + h,
                    z: centerPos.z + Math.sin(rad) * prisonRadius
                };
                yeti.dimension.spawnParticle("minecraft:ice_evaporation_emitter", wallPos);
            }
        }
        
        // Tạo nóc và sàn băng
        if (prisonTick % 5 === 0) {
            for (let x = -prisonRadius; x <= prisonRadius; x += 0.5) {
                for (let z = -prisonRadius; z <= prisonRadius; z += 0.5) {
                    const dist = Math.sqrt(x*x + z*z);
                    if (dist <= prisonRadius) {
                        // Sàn
                        yeti.dimension.spawnParticle("minecraft:snowflake_particle", {
                            x: centerPos.x + x,
                            y: centerPos.y,
                            z: centerPos.z + z
                        });
                        // Nóc
                        yeti.dimension.spawnParticle("minecraft:snowflake_particle", {
                            x: centerPos.x + x,
                            y: centerPos.y + prisonHeight,
                            z: centerPos.z + z
                        });
                    }
                }
            }
        }
        
        // Giữ player ở trung tâm (kéo về giữa nếu cố thoát)
        const distFromCenter = getDistance(playerPos, centerPos);
        if (distFromCenter > prisonRadius - 0.5) {
            const pullX = centerPos.x - playerPos.x;
            const pullZ = centerPos.z - playerPos.z;
            player.applyKnockback(-pullX, -pullZ, 0.3, 0);
        }
        
        // Gây sát thương liên tục
        if (prisonTick % 20 === 0) {
            player.applyDamage(2, { cause: "freezing", damagingEntity: yeti });
            player.addEffect("slowness", 40, { amplifier: 3 });
            player.addEffect("mining_fatigue", 40, { amplifier: 2 });
        }
        
        // Kết thúc
        if (prisonTick >= prisonDuration) {
            // Phá vỡ lồng băng
            yeti.dimension.spawnParticle("minecraft:huge_explosion_emitter", centerPos);
            yeti.dimension.playSound("random.glass", centerPos, { volume: 2.0 });
            
            // Knockback mạnh khi phá vỡ
            const breakPlayers = yeti.dimension.getEntities({
                location: centerPos,
                maxDistance: prisonRadius + 1,
                type: "minecraft:player"
            });
            breakPlayers.forEach(p => {
                p.applyKnockback(
                    p.location.x - centerPos.x,
                    p.location.z - centerPos.z,
                    2,
                    0.5
                );
            });
            
            system.clearRun(prisonInterval);
            icePrisonActive.delete(playerId);
        }
    }, 1);
}

// Skill 7: Summon Ice Minions - Triệu hồi đệ với hiệu ứng đẹp
function summonIceMinions(yeti) {
    const location = yeti.location;
    
    // Hiệu ứng bắt đầu triệu hồi
    yeti.dimension.playSound("mob.evocation_illager.prepare_summon", location, { 
        volume: 1.5, 
        pitch: 0.9 
    });
    yeti.dimension.spawnParticle("minecraft:huge_explosion_emitter", location);
    
    const summonPositions = [
        { x: 4, z: 0, delay: 0 },
        { x: -4, z: 0, delay: 15 },
        { x: 0, z: 4, delay: 30 },
        { x: 0, z: -4, delay: 45 }
    ];
    
    summonPositions.forEach((pos) => {
        system.runTimeout(() => {
            const spawnPos = {
                x: location.x + pos.x,
                y: location.y,
                z: location.z + pos.z
            };
            
            // Tạo vòng băng xoay trước khi spawn
            let rotationTick = 0;
            const rotationDuration = 30; // 1.5 giây
            
            const rotationInterval = system.runInterval(() => {
                rotationTick++;
                
                const angle = (rotationTick * 20) % 360;
                const radius = 2 - (rotationTick / rotationDuration) * 1.5; // Thu nhỏ dần
                
                // Vòng băng xoay
                for (let ring = 0; ring < 3; ring++) {
                    const ringAngle = (angle + ring * 120) % 360;
                    const rad = ringAngle * Math.PI / 180;
                    const particlePos = {
                        x: spawnPos.x + Math.cos(rad) * radius,
                        y: spawnPos.y + 0.5 + ring * 0.3,
                        z: spawnPos.z + Math.sin(rad) * radius
                    };
                    yeti.dimension.spawnParticle("minecraft:ice_evaporation_emitter", particlePos);
                }
                
                // Particle tâm
                if (rotationTick % 5 === 0) {
                    yeti.dimension.spawnParticle("minecraft:bleach", {
                        x: spawnPos.x,
                        y: spawnPos.y + 1,
                        z: spawnPos.z
                    });
                }
                
                // Spawn minion khi vòng xoay kết thúc
                if (rotationTick >= rotationDuration) {
                    // Hiệu ứng xuất hiện
                    yeti.dimension.spawnParticle("minecraft:huge_explosion_emitter", spawnPos);
                    yeti.dimension.playSound("mob.evocation_illager.cast_spell", spawnPos);
                    
                    // Spawn các loại minion khác nhau
                    const minionTypes = ["minecraft:stray", "minecraft:zombie", "minecraft:skeleton"];
                    const randomMinion = minionTypes[Math.floor(Math.random() * minionTypes.length)];
                    
                    try {
                        const minion = yeti.dimension.spawnEntity(randomMinion, spawnPos);
                        
                        // Buff cho minion
                        minion.addEffect("speed", 999999, { amplifier: 0, showParticles: false });
                        minion.addEffect("strength", 999999, { amplifier: 0, showParticles: false });
                        
                        // Particle buff
                        yeti.dimension.spawnParticle("minecraft:villager_happy", {
                            x: spawnPos.x,
                            y: spawnPos.y + 1,
                            z: spawnPos.z
                        });
                    } catch(e) {}
                    
                    system.clearRun(rotationInterval);
                }
            }, 1);
        }, pos.delay);
    });
}

// Passive: Frost Aura nhẹ - Làm chậm kẻ địch gần
function frostAura(yeti) {
    const nearbyPlayers = yeti.dimension.getEntities({
        location: yeti.location,
        maxDistance: 4,
        type: "minecraft:player"
    });
    
    if (nearbyPlayers.length > 0) {
        nearbyPlayers.forEach(player => {
            player.addEffect("slowness", 25, { amplifier: 0 });
            
            // Particle nhẹ
            if (system.currentTick % 10 === 0) {
                yeti.dimension.spawnParticle("minecraft:snowflake_particle", player.location);
            }
        });
    }
}

// Hàm xử lý skill Phase 1
function handleYetiPhase1(yeti) {
    if (!yeti.isValid()) return;
    
    const entityId = yeti.id;
    
    // Khởi tạo cooldown
    if (!phase1Cooldowns.has(entityId)) {
        phase1Cooldowns.set(entityId, {
            iceBall: 0,
            freezeGround: 0,
            roar: 0,
            jump: 0,
            iceRegen: 0,
            giantIceBall: 0,
            summonMinions: 0
        });
    }
    
    const cooldowns = phase1Cooldowns.get(entityId);
    const currentTick = system.currentTick;
    
    // Passive aura
    if (currentTick % 20 === 0) {
        frostAura(yeti);
    }
    
    // Tìm target
    const target = yeti.dimension.getEntities({
        location: yeti.location,
        maxDistance: YETI_PHASE1_CONFIG.detectRange,
        type: "minecraft:player",
        closest: 1
    })[0];
    
    if (!target) return;
    
    const distance = getDistance(yeti.location, target.location);
    
    // Kiểm tra HP để dùng skill hồi máu
    let healthPercent = 1;
    try {
        const health = yeti.getComponent("minecraft:health");
        if (health) {
            healthPercent = health.currentValue / YETI_PHASE1_CONFIG.health;
        }
    } catch(e) {}
    
    // Ưu tiên hồi máu khi HP < 40% và không đang shield
    if (healthPercent < 0.4 && 
        currentTick >= cooldowns.iceRegen && 
        !iceShieldActive.has(entityId)) {
        iceRegeneration(yeti);
        cooldowns.iceRegen = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.iceRegen;
        return; // Không dùng skill khác khi đang hồi máu
    }
    
    // Triệu hồi đệ khi HP < 50%
    if (healthPercent < 0.5 && currentTick >= cooldowns.summonMinions) {
        summonIceMinions(yeti);
        cooldowns.summonMinions = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.summonMinions;
    }
    
    // Logic sử dụng skill theo khoảng cách
    if (distance > 15 && currentTick >= cooldowns.giantIceBall) {
        // Tầm rất xa: Cầu băng khổng lồ
        giantIceBall(yeti, target);
        cooldowns.giantIceBall = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.giantIceBall;
    }
    else if (distance > 12 && currentTick >= cooldowns.iceBall) {
        // Tầm xa: Ném ice ball
        iceBall(yeti, target);
        cooldowns.iceBall = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.iceBall;
    }
    else if (distance > 8 && distance <= 12 && currentTick >= cooldowns.jump) {
        // Tầm trung: Nhảy đè
        iceJump(yeti, target);
        cooldowns.jump = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.jump;
    }
    else if (distance <= 8 && currentTick >= cooldowns.roar) {
        // Tầm gần: Gầm
        frostRoar(yeti);
        cooldowns.roar = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.roar;
    }
    else if (distance <= 6 && currentTick >= cooldowns.freezeGround) {
        // Rất gần: Đóng băng đất
        freezeGround(yeti);
        cooldowns.freezeGround = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.freezeGround;
    }
}

// Hàm tính khoảng cách
function getDistance(pos1, pos2) {
    return Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) +
        Math.pow(pos1.y - pos2.y, 2) +
        Math.pow(pos1.z - pos2.z, 2)
    );
}

// Main loop
system.runInterval(() => {
    const yetis = world.getDimension("overworld").getEntities({
        type: YETI_PHASE1_CONFIG.identifier
    });
    
    yetis.forEach(yeti => {
        handleYetiPhase1(yeti);
    });
}, 1);

// Cleanup khi boss chết
world.afterEvents.entityDie.subscribe((event) => {
    if (event.deadEntity.typeId === YETI_PHASE1_CONFIG.identifier) {
        const entityId = event.deadEntity.id;
        phase1Cooldowns.delete(entityId);
        iceShieldActive.delete(entityId);
        
        // Xóa tất cả prison liên quan
        icePrisonActive.clear();
        
        // Hiệu ứng chết
        const location = event.deadEntity.location;
        event.deadEntity.dimension.spawnParticle("minecraft:huge_explosion_emitter", location);
        event.deadEntity.dimension.playSound("random.explode", location);
    }
});

console.warn("Yeti Phase 1 skills loaded!");