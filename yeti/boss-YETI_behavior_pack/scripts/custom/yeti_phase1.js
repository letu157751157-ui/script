// File: scripts/custom/yeti_phase1.js
// Skills cho Yeti Phase 1 (ytaun:yeti_1) - Giai đoạn đầu (dễ hơn)
//
// FIX so với bản gốc người dùng gửi:
// - identifier "ytaun:yeti" -> "ytaun:yeti_1" (SAI identifier là lý do chính khiến code cũ
//   không chạy: entity "ytaun:yeti" không tồn tại nên vòng lặp không bao giờ tìm thấy gì)
// - .isValid() (gọi như hàm) -> .isValid (đây là THUỘC TÍNH trong bản Script API đang dùng)
// - applyDamage(amount, {cause,...}) -> applyDamage(amount) (bỏ tham số cause vì 1 số giá trị
//   enum không hợp lệ có thể làm toàn bộ lệnh bị ném lỗi ngầm)
// - Thêm 2 chiêu "Gai Băng" + "Lao Đánh" (dùng chung module yeti_spike_charge.js)
// - FIX (cân bằng): health config đồng bộ với minecraft:health thật của entity (trước lệch
//   500 vs 1000 khiến % HP tính sai, ảnh hưởng ngưỡng kích hoạt Ice Regen/Summon Minions)
// - FIX: world.afterEvents.entityDie tham chiếu biến "deadEntity" không tồn tại và gọi
//   "event.safeSpawnParticle(...)" (không phải method hợp lệ trên event) -> sửa lại đúng

import { world, system } from "@minecraft/server";
import { castIceSpike, castChargeAttack } from "./yeti_spike_charge";

const YETI_PHASE1_CONFIG = {
    identifier: "ytaun:yeti_1",
    health: 1000, // FIX: đồng bộ với minecraft:health thật của ytaun:yeti_1
    detectRange: 25,
    skillCooldowns: {
        iceBall: 320,
        freezeGround: 440,
        roar: 300,
        jump: 380,
        iceRegen: 600,
        summonMinions: 750,
        iceSpike: 360,      // 18 giây - Gai Băng (MỚI)
        chargeAttack: 380   // 19 giây - Lao Đánh (MỚI, +10s)
    }
};

const phase1Cooldowns = new Map();
const iceShieldActive = new Map();
const busyCasting = new Map(); // entity.id -> đang thi triển Gai Băng/Lao Đánh (chặn skill khác chen ngang)


// ==================== FIX LỖI SCRIPT API ====================
// FIX 1: applyKnockback() trong bản Script API đang dùng chỉ nhận 2 tham số
// (vector lực ngang {x,z} + lực dọc), KHÔNG PHẢI 4 tham số (dx, dz, lực ngang, lực dọc)
// như code gốc. Hàm này tự chuẩn hóa hướng rồi gọi đúng chữ ký mới.
function knockback(entity, dx, dz, horizontalStrength, verticalStrength) {
    try {
        const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
        entity.applyKnockback({ x: (dx / len) * horizontalStrength, z: (dz / len) * horizontalStrength }, verticalStrength);
    } catch (_) {}
}

// FIX 2: các skill tầm xa (roar, vortex, zero, earthquake...) tính toán vị trí có thể rơi
// ra ngoài chunk đang được load/tick, khiến getEntities()/spawnParticle() ném
// LocationInUnloadedChunkError và làm dừng cả hàm giữa chừng. Bọc lại để bỏ qua an toàn.
function safeGetEntities(dimension, options) {
    try { return dimension.getEntities(options); } catch (_) { return []; }
}
function safeSpawnParticle(dimension, id, loc) {
    try { dimension.spawnParticle(id, loc); } catch (_) {}
}
function safeTeleport(entity, loc, options) {
    try { entity.teleport(loc, options); } catch (_) {}
}
// ==================== HẾT PHẦN FIX ====================

function yetiGetDistance(pos1, pos2) {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2));
}

// Skill 1: Ice Ball
function iceBall(yeti, target) {
    const yetiPos = yeti.location;
    const targetPos = target.location;
    const dx = targetPos.x - yetiPos.x, dy = targetPos.y - yetiPos.y + 1, dz = targetPos.z - yetiPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const dirX = dx / distance, dirY = dy / distance, dirZ = dz / distance;

    yeti.dimension.playSound("mob.ghast.fireball", yetiPos, { volume: 0.5 });

    let step = 0;
    const maxSteps = 20;
    const ballInterval = system.runInterval(() => {
        step++;
        const currentPos = { x: yetiPos.x + dirX * step, y: yetiPos.y + 1.5 + dirY * step, z: yetiPos.z + dirZ * step };
        safeSpawnParticle(yeti.dimension, "minecraft:snowflake_particle", currentPos);
        safeSpawnParticle(yeti.dimension, "minecraft:ice_evaporation_emitter", currentPos);

        const hitPlayers = safeGetEntities(yeti.dimension, { location: currentPos, maxDistance: 1.5, type: "minecraft:player" });
        if (hitPlayers.length > 0) {
            hitPlayers.forEach(player => {
                player.applyDamage(6);
                player.addEffect("slowness", 60, { amplifier: 1 });
            });
            yeti.dimension.playSound("random.glass", currentPos);
            safeSpawnParticle(yeti.dimension, "minecraft:ice_evaporation_emitter", currentPos);
            system.clearRun(ballInterval);
        }
        if (step >= maxSteps || currentPos.y <= yetiPos.y - 1) {
            safeSpawnParticle(yeti.dimension, "minecraft:huge_explosion_emitter", currentPos);
            system.clearRun(ballInterval);
        }
    }, 2);
}

// Skill 2: Freeze Ground
function freezeGround(yeti) {
    const location = yeti.location;
    const radius = 5;
    yeti.dimension.playSound("random.glass", location);
    safeSpawnParticle(yeti.dimension, "minecraft:bleach", location);

    let tickCount = 0;
    const freezeInterval = system.runInterval(() => {
        tickCount++;
        const nearbyPlayers = safeGetEntities(yeti.dimension, { location: location, maxDistance: radius, type: "minecraft:player" });
        nearbyPlayers.forEach(player => {
            player.applyDamage(1);
            player.addEffect("slowness", 30, { amplifier: 1 });
            safeSpawnParticle(yeti.dimension, "minecraft:snowflake_particle", player.location);
        });
        if (tickCount >= 60) system.clearRun(freezeInterval);
    }, 10);
}

// Skill 3: Frost Roar
function frostRoar(yeti) {
    const location = yeti.location;
    for (let i = 0; i < 15; i++) {
        system.runTimeout(() => {
            safeSpawnParticle(yeti.dimension, "minecraft:critical_hit_emitter", { x: location.x, y: location.y + 2.5, z: location.z });
        }, i * 2);
    }
    yeti.dimension.playSound("mob.enderdragon.growl", location, { volume: 1.5, pitch: 0.7 });

    for (let ring = 1; ring <= 4; ring++) {
        system.runTimeout(() => {
            const ringRadius = ring * 3;
            for (let angle = 0; angle < 360; angle += 15) {
                const rad = angle * Math.PI / 180;
                safeSpawnParticle(yeti.dimension, "minecraft:ice_evaporation_emitter", {
                    x: location.x + Math.cos(rad) * ringRadius, y: location.y + 1, z: location.z + Math.sin(rad) * ringRadius
                });
            }
            const affectedPlayers = safeGetEntities(yeti.dimension, {
                location: location, maxDistance: ringRadius + 1, minDistance: ringRadius - 1, type: "minecraft:player"
            });
            affectedPlayers.forEach(player => {
                player.addEffect("slowness", 80, { amplifier: 1 });
                player.addEffect("mining_fatigue", 80, { amplifier: 0 });
            });
        }, ring * 10);
    }
}

// Skill 4: Ice Jump
function iceJump(yeti, target) {
    const startPos = yeti.location;
    const targetPos = target.location;
    yeti.dimension.playSound("mob.irongolem.throw", startPos);
    safeSpawnParticle(yeti.dimension, "minecraft:villager_happy", startPos);
    safeTeleport(yeti, { x: startPos.x, y: startPos.y + 5, z: startPos.z });

    system.runTimeout(() => {
        const landPos = { x: targetPos.x, y: targetPos.y, z: targetPos.z };
        safeTeleport(yeti, landPos);
        safeSpawnParticle(yeti.dimension, "minecraft:huge_explosion_emitter", landPos);
        yeti.dimension.playSound("random.explode", landPos);

        const hitPlayers = safeGetEntities(yeti.dimension, { location: landPos, maxDistance: 4, type: "minecraft:player" });
        hitPlayers.forEach(player => {
            const distance = yetiGetDistance(player.location, landPos);
            const damage = 8 - Math.floor(distance * 1.5);
            player.applyDamage(Math.max(damage, 3));
            knockback(player, player.location.x - landPos.x, player.location.z - landPos.z, 1.5, 0.4);
        });

        for (let angle = 0; angle < 360; angle += 30) {
            const rad = angle * Math.PI / 180;
            safeSpawnParticle(yeti.dimension, "minecraft:blue_flame_particle", {
                x: landPos.x + Math.cos(rad) * 3, y: landPos.y, z: landPos.z + Math.sin(rad) * 3
            });
        }
    }, 20);
}

// Skill 5: Ice Regeneration
function iceRegeneration(yeti) {
    const entityId = yeti.id;
    iceShieldActive.set(entityId, true);
    yeti.dimension.playSound("beacon.power", yeti.location, { volume: 1.0, pitch: 1.2 });
    safeSpawnParticle(yeti.dimension, "minecraft:bleach", yeti.location);

    let regenTick = 0;
    const regenDuration = 100;
    const healAmount = 4;

    const regenInterval = system.runInterval(() => {
        if (!yeti.isValid) { system.clearRun(regenInterval); iceShieldActive.delete(entityId); return; }
        regenTick++;
        const currentLoc = yeti.location;
        const angle = (regenTick * 10) % 360;
        for (let i = 0; i < 8; i++) {
            const rad = (angle + i * 45) * Math.PI / 180;
            safeSpawnParticle(yeti.dimension, "minecraft:ice_evaporation_emitter", {
                x: currentLoc.x + Math.cos(rad) * 2, y: currentLoc.y + 1, z: currentLoc.z + Math.sin(rad) * 2
            });
        }
        if (regenTick % 5 === 0) {
            safeSpawnParticle(yeti.dimension, "minecraft:villager_happy", { x: currentLoc.x, y: currentLoc.y + 1.5, z: currentLoc.z });
            yeti.dimension.playSound("random.orb", currentLoc, { volume: 0.3, pitch: 1.5 });
        }
        if (regenTick % 10 === 0) {
            try {
                const health = yeti.getComponent("minecraft:health");
                if (health) {
                    const newHealth = Math.min(health.currentValue + healAmount, YETI_PHASE1_CONFIG.health);
                    health.setCurrentValue(newHealth);
                    safeSpawnParticle(yeti.dimension, "minecraft:heart_particle", { x: currentLoc.x, y: currentLoc.y + 2, z: currentLoc.z });
                }
            } catch (e) {}
        }
        const nearbyPlayers = safeGetEntities(yeti.dimension, { location: currentLoc, maxDistance: 3, type: "minecraft:player" });
        nearbyPlayers.forEach(player => {
            knockback(player, player.location.x - currentLoc.x, player.location.z - currentLoc.z, 0.5, 0.2);
            player.addEffect("slowness", 20, { amplifier: 1 });
        });
        if (regenTick >= regenDuration) {
            system.clearRun(regenInterval);
            iceShieldActive.delete(entityId);
            safeSpawnParticle(yeti.dimension, "minecraft:huge_explosion_emitter", currentLoc);
            yeti.dimension.playSound("random.glass", currentLoc);
        }
    }, 1);
}

// Skill 7: Summon Ice Minions
function summonIceMinions(yeti) {
    const location = yeti.location;
    yeti.dimension.playSound("mob.evocation_illager.prepare_summon", location, { volume: 1.5, pitch: 0.9 });
    safeSpawnParticle(yeti.dimension, "minecraft:huge_explosion_emitter", location);

    const summonPositions = [{ x: 4, z: 0, delay: 0 }, { x: -4, z: 0, delay: 15 }, { x: 0, z: 4, delay: 30 }, { x: 0, z: -4, delay: 45 }];

    summonPositions.forEach((pos) => {
        system.runTimeout(() => {
            const spawnPos = { x: location.x + pos.x, y: location.y, z: location.z + pos.z };
            let rotationTick = 0;
            const rotationDuration = 30;

            const rotationInterval = system.runInterval(() => {
                rotationTick++;
                const angle = (rotationTick * 20) % 360;
                const radius = 2 - (rotationTick / rotationDuration) * 1.5;
                for (let ring = 0; ring < 3; ring++) {
                    const ringAngle = (angle + ring * 120) % 360;
                    const rad = ringAngle * Math.PI / 180;
                    safeSpawnParticle(yeti.dimension, "minecraft:ice_evaporation_emitter", {
                        x: spawnPos.x + Math.cos(rad) * radius, y: spawnPos.y + 0.5 + ring * 0.3, z: spawnPos.z + Math.sin(rad) * radius
                    });
                }
                if (rotationTick % 5 === 0) safeSpawnParticle(yeti.dimension, "minecraft:bleach", { x: spawnPos.x, y: spawnPos.y + 1, z: spawnPos.z });

                if (rotationTick >= rotationDuration) {
                    safeSpawnParticle(yeti.dimension, "minecraft:huge_explosion_emitter", spawnPos);
                    yeti.dimension.playSound("mob.evocation_illager.cast_spell", spawnPos);
                    const minionTypes = ["minecraft:stray", "minecraft:zombie", "minecraft:skeleton"];
                    const randomMinion = minionTypes[Math.floor(Math.random() * minionTypes.length)];
                    try {
                        const minion = yeti.dimension.spawnEntity(randomMinion, spawnPos);
                        minion.addEffect("speed", 999999, { amplifier: 0, showParticles: false });
                        minion.addEffect("strength", 999999, { amplifier: 0, showParticles: false });
                        safeSpawnParticle(yeti.dimension, "minecraft:villager_happy", { x: spawnPos.x, y: spawnPos.y + 1, z: spawnPos.z });
                    } catch (e) {}
                    system.clearRun(rotationInterval);
                }
            }, 1);
        }, pos.delay);
    });
}

// Passive: Frost Aura nhẹ
function frostAura(yeti) {
    const nearbyPlayers = safeGetEntities(yeti.dimension, { location: yeti.location, maxDistance: 4, type: "minecraft:player" });
    nearbyPlayers.forEach(player => {
        player.addEffect("slowness", 25, { amplifier: 0 });
        if (system.currentTick % 10 === 0) safeSpawnParticle(yeti.dimension, "minecraft:snowflake_particle", player.location);
    });
}

// Skill MỚI: Gai Băng + Lao Đánh (wrapper gọi module dùng chung)
const SPIKE_CHARGE_CONFIG = {
    laneCount: 3,
    spikeDamage: 4,
    windupTicks: 25,
    dashTicks: 14,
    meleeDamage: 15,
    knockbackStrength: 1.6,
    slownessAmplifier: 3,
    freezeDurationTicks: 120,
    animIceSpike: 'animation.ytaun_yeti_1_default.ice_spike',
    animAttack2: 'animation.ytaun_yeti_1_default.attack_2',
    animAttackHit: 'animation.ytaun_yeti_1.attack'
};

function doIceSpike(yeti, target) {
    busyCasting.set(yeti.id, true);
    castIceSpike(yeti, target, SPIKE_CHARGE_CONFIG, () => busyCasting.delete(yeti.id));
}

function doChargeAttack(yeti, target) {
    busyCasting.set(yeti.id, true);
    castChargeAttack(yeti, target, SPIKE_CHARGE_CONFIG, (hit, finalTarget) => {
        busyCasting.delete(yeti.id);
        if (!hit && finalTarget) {
            const cd = phase1Cooldowns.get(yeti.id);
            if (cd) cd.iceSpike = 0;
            doIceSpike(yeti, finalTarget);
        }
    });
}

// Hàm xử lý skill Phase 1
function handleYetiPhase1(yeti) {
    if (!yeti.isValid) return;
    if (busyCasting.has(yeti.id)) return;

    const entityId = yeti.id;
    if (!phase1Cooldowns.has(entityId)) {
        phase1Cooldowns.set(entityId, {
            iceBall: 0, freezeGround: 0, roar: 0, jump: 0, iceRegen: 0,
            summonMinions: 0, iceSpike: 0, chargeAttack: 0
        });
    }

    const cooldowns = phase1Cooldowns.get(entityId);
    const currentTick = system.currentTick;

    if (currentTick % 20 === 0) frostAura(yeti);

    const target = safeGetEntities(yeti.dimension, {
        location: yeti.location, maxDistance: YETI_PHASE1_CONFIG.detectRange, type: "minecraft:player", closest: 1
    })[0];
    if (!target) return;

    const distance = yetiGetDistance(yeti.location, target.location);

    let healthPercent = 1;
    try {
        const health = yeti.getComponent("minecraft:health");
        if (health) healthPercent = health.currentValue / YETI_PHASE1_CONFIG.health;
    } catch (e) {}

    if (healthPercent < 0.4 && currentTick >= cooldowns.iceRegen && !iceShieldActive.has(entityId)) {
        iceRegeneration(yeti);
        cooldowns.iceRegen = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.iceRegen;
        return;
    }
    if (healthPercent < 0.5 && currentTick >= cooldowns.summonMinions) {
        summonIceMinions(yeti);
        cooldowns.summonMinions = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.summonMinions;
    }

    if (currentTick >= cooldowns.iceSpike) {
        doIceSpike(yeti, target);
        cooldowns.iceSpike = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.iceSpike;
        return;
    }
    if (currentTick >= cooldowns.chargeAttack) {
        doChargeAttack(yeti, target);
        cooldowns.chargeAttack = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.chargeAttack;
        return;
    }

    if (distance > 12 && currentTick >= cooldowns.iceBall) {
        iceBall(yeti, target);
        cooldowns.iceBall = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.iceBall;
    } else if (distance > 8 && distance <= 12 && currentTick >= cooldowns.jump) {
        iceJump(yeti, target);
        cooldowns.jump = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.jump;
    } else if (distance <= 8 && currentTick >= cooldowns.roar) {
        frostRoar(yeti);
        cooldowns.roar = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.roar;
    } else if (distance <= 6 && currentTick >= cooldowns.freezeGround) {
        freezeGround(yeti);
        cooldowns.freezeGround = currentTick + YETI_PHASE1_CONFIG.skillCooldowns.freezeGround;
    }
}

system.runInterval(() => {
    const yetis = world.getDimension("overworld").getEntities({ type: YETI_PHASE1_CONFIG.identifier });
    yetis.forEach(yeti => handleYetiPhase1(yeti));
}, 1);

world.afterEvents.entityDie.subscribe((event) => {
    if (event.deadEntity.typeId === YETI_PHASE1_CONFIG.identifier) {
        const entityId = event.deadEntity.id;
        phase1Cooldowns.delete(entityId);
        iceShieldActive.delete(entityId);
        busyCasting.delete(entityId);
        // FIX: "event.safeSpawnParticle(deadEntity...)" không hợp lệ (event không có method này,
        // và "deadEntity" không tồn tại) -> dùng hàm nội bộ safeSpawnParticle() + event.deadEntity
        safeSpawnParticle(event.deadEntity.dimension, "minecraft:huge_explosion_emitter", event.deadEntity.location);
        event.deadEntity.dimension.playSound("random.explode", event.deadEntity.location);
    }
});

console.warn("Yeti Phase 1 (yeti_1) skills loaded!");
