import { world, system } from "@minecraft/server";

// === MODULE DÙNG CHUNG: GAI BĂNG + LAO ĐÁNH (ỦI) ===
// Dùng chung cho cả 3 file yeti_phase1.js / yeti_phase2.js / yeti_phase3.js
//
// FIX so với bản merge trước:
// - Gai spawn ÍT hơn (giảm số gai/hàng), THƯA ra (tăng khoảng cách giữa các gai + giữa các hàng)
// - Phạm vi (reach) rộng hơn một chút để vẫn phủ hết khoảng cách tới player
// - Mỗi lượt Gai Băng chỉ gây hiệu ứng/sát thương ĐÚNG 1 LẦN cho mỗi player, tránh knockback
//   dọc chồng lên nhau gây hất tung player lên trời (bug đã gặp ở bản trước)

export const ICE_SPIKE_ENTITY_ID = 'ytaun:ice_spike_yeti_boss';
export const ANIM_SPIKE_SPAWN = 'animation.ytaun_ice_spike_yeti_boss.spawn';

function dist2D(a, b) {
    const dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function dist3D(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function horizontalDir(from, to) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
    return { x: dx / len, z: dz / len };
}

function impactBurst(dimension, loc, big) {
    try {
        dimension.spawnParticle('minecraft:snowflake_particle', loc);
        dimension.spawnParticle('minecraft:ice_evaporation_particle', loc);
        dimension.spawnParticle('minecraft:huge_explosion_emitter', loc);
        dimension.spawnParticle('minecraft:basic_crack_particle', loc);
        if (big) dimension.spawnParticle('snow:snow', loc);
    } catch (_) {}
}

function shakeNearbyCameras(dimension, loc, radius, intensity, seconds) {
    try {
        const players = dimension.getEntities({ location: loc, maxDistance: radius, type: 'minecraft:player' });
        for (const p of players) {
            try { p.runCommand(`camerashake add @s ${intensity} ${seconds} positional`); } catch (_) {}
        }
    } catch (_) {}
}

function yetiFindNearestPlayer(yeti, maxDist) {
    let players;
    try {
        players = yeti.dimension.getEntities({ location: yeti.location, maxDistance: maxDist, type: 'minecraft:player' });
    } catch (_) {
        return null;
    }
    let best = null, bestDist = Infinity;
    for (const p of players) {
        const d = dist2D(yeti.location, p.location);
        if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
}

/**
 * Gai Băng - triệu hồi các hàng gai băng (đã thưa hơn, ít hơn, phạm vi rộng hơn) hướng
 * về phía target. Mỗi player chỉ nhận sát thương/hiệu ứng đúng 1 lần / lượt (chống bay lên trời).
 *
 * config: { laneCount, spikeDamage, animIceSpike, windupTicks }
 * callback: gọi lại sau khi hoàn tất (để script gọi biết mà giải phóng trạng thái "đang bận")
 */
export function castIceSpike(yeti, target, config, onDone) {
    try { if (config.animIceSpike) yeti.playAnimation(config.animIceSpike); } catch (_) {}

    const windupTicks = config.windupTicks ?? 25;

    system.runTimeout(() => {
        try {
            if (!yeti.isValid) { if (onDone) onDone(); return; }
            const targetLoc = (target && target.isValid) ? target.location : (yetiFindNearestPlayer(yeti, 12)?.location ?? yeti.location);
            impactBurst(yeti.dimension, yeti.location, true);
            shakeNearbyCameras(yeti.dimension, yeti.location, 12, 0.6, 0.5);
            spawnSpikeLanes(yeti, targetLoc, config);
        } catch (e) {
            console.warn('[Yeti Spike] impact error:', e);
        }
        if (onDone) onDone();
    }, windupTicks);
}

function spawnSpikeLanes(yeti, targetLoc, config) {
    const dir = horizontalDir(yeti.location, targetLoc);
    const perp = { x: -dir.z, z: dir.x };

    const laneCount = config.laneCount ?? 3;
    const spacing = 1.9;                 // thưa hơn (trước là 1.1-1.3)
    const reach = dist2D(yeti.location, targetLoc) + 2.5; // phạm vi rộng hơn (trước +1.5)
    const spikesPerLane = Math.max(3, Math.min(7, Math.ceil(reach / spacing))); // ít gai hơn (trước tối đa 12)
    const laneGap = 2.8; // hàng cách nhau xa hơn -> phạm vi ngang rộng hơn

    const laneCenters = [];
    const half = Math.floor(laneCount / 2);
    if (laneCount % 2 === 1) {
        for (let k = -half; k <= half; k++) laneCenters.push(k * laneGap);
    } else {
        for (let k = 0; k < laneCount; k++) laneCenters.push((k - (laneCount - 1) / 2) * laneGap);
    }

    const hitPlayers = new Set(); // đảm bảo mỗi player chỉ bị 1 gai gây hiệu ứng / lượt chiêu

    yeti.dimension.playSound('ambient.weather.thunder', yeti.location, { pitch: 1.3, volume: 1.2 });

    for (const laneCenter of laneCenters) {
        for (let i = 1; i <= spikesPerLane; i++) {
            system.runTimeout(() => {
                try {
                    const dist = i * spacing;
                    const offset = laneCenter * (1 - i / (spikesPerLane * 2));
                    const spawnLoc = {
                        x: yeti.location.x + dir.x * dist + perp.x * offset,
                        y: yeti.location.y,
                        z: yeti.location.z + dir.z * dist + perp.z * offset
                    };

                    const spike = yeti.dimension.spawnEntity(ICE_SPIKE_ENTITY_ID, spawnLoc);
                    // FIX: gọi playAnimation() ngay trong cùng tick vừa spawnEntity() thường KHÔNG
                    // ăn (client chưa kịp nhận entity mới). Trễ 1 tick thì animation mới chắc chắn phát.
                    system.runTimeout(() => {
                        try { if (spike.isValid) spike.playAnimation(ANIM_SPIKE_SPAWN); } catch (_) {}
                    }, 1);
                    impactBurst(yeti.dimension, spawnLoc, false);
                    damagePlayersOnce(yeti, spawnLoc, config.spikeDamage ?? 5, hitPlayers);

                    system.runTimeout(() => {
                        try { if (spike.isValid) spike.remove(); } catch (_) {}
                    }, 60);
                } catch (_) {}
            }, i * 2); // giãn thời gian mọc ra chậm hơn cho khớp với việc gai thưa hơn
        }
    }
}

function damagePlayersOnce(yeti, spikeLoc, damage, hitPlayers) {
    try {
        const players = yeti.dimension.getEntities({ location: spikeLoc, maxDistance: 1.2, type: 'minecraft:player' });
        for (const player of players) {
            if (hitPlayers.has(player.id)) continue; // player đã bị gai khác trong CÙNG lượt này đánh rồi
            hitPlayers.add(player.id);
            try {
                player.addEffect('slowness', 60, { amplifier: 2, showParticles: true });
                player.applyDamage(damage);
                player.dimension.spawnParticle('minecraft:snowflake_particle', player.location);
            } catch (_) {}
        }
    } catch (_) {}
}

/**
 * Lao Đánh (Ủi) - lao thẳng tới target bằng teleport từng bước (không phụ thuộc AI/pathfinding).
 * config: { animAttack2, animAttackHit, meleeDamage, knockbackStrength, freezeDurationTicks, slownessAmplifier, dashTicks }
 * onResult(hit: boolean, target) - callback báo trúng/trượt để script gọi tự xử lý tiếp (VD: trượt thì tung Gai Băng)
 */
export function castChargeAttack(yeti, target, config, onResult) {
    const dashTicks = config.dashTicks ?? 14; // 0.7s
    const dir = horizontalDir(yeti.location, target.location);
    const actualDist = dist2D(yeti.location, target.location);
    const dashDistance = Math.max(4, Math.min(13, actualDist + 2));
    const stepDist = dashDistance / dashTicks;

    try { if (config.animAttack2) yeti.playAnimation(config.animAttack2); } catch (_) {}
    yeti.dimension.playSound('mob.ravager.step', yeti.location, { pitch: 0.7, volume: 1.0 });

    let tick = 0;
    const dashTimer = system.runInterval(() => {
        tick++;
        try {
            if (!yeti.isValid) { system.clearRun(dashTimer); if (onResult) onResult(false, target); return; }
            const loc = yeti.location;
            const newLoc = { x: loc.x + dir.x * stepDist, y: loc.y, z: loc.z + dir.z * stepDist };
            const facing = (target.isValid) ? target.location : newLoc;
            yeti.teleport(newLoc, { facingLocation: facing });
            yeti.dimension.spawnParticle('minecraft:snowflake_particle', { x: loc.x - dir.x * 0.5, y: loc.y + 0.3, z: loc.z - dir.z * 0.5 });
            yeti.dimension.spawnParticle('minecraft:ice_evaporation_particle', loc);
        } catch (_) {}

        if (tick >= dashTicks) {
            system.clearRun(dashTimer);
            resolveCharge(yeti, target, config, onResult);
        }
    }, 1);
}

function resolveCharge(yeti, target, config, onResult) {
    try {
        if (!yeti.isValid) { if (onResult) onResult(false, target); return; }
        const finalTarget = (target && target.isValid) ? target : yetiFindNearestPlayer(yeti, 12);
        const isHit = finalTarget && dist3D(yeti.location, finalTarget.location) <= 3.5;

        if (isHit) {
            onChargeHit(yeti, finalTarget, config);
            if (onResult) onResult(true, finalTarget);
        } else {
            if (onResult) onResult(false, finalTarget);
        }
    } catch (e) {
        console.warn('[Yeti Charge] resolve error:', e);
        if (onResult) onResult(false, target);
    }
}

function onChargeHit(yeti, target, config) {
    impactBurst(yeti.dimension, yeti.location, true);
    shakeNearbyCameras(yeti.dimension, yeti.location, 8, 0.4, 0.3);

    try {
        const dir = horizontalDir(yeti.location, target.location);
        // FIX: applyKnockback() chỉ nhận 2 tham số (vector lực {x,z} + lực dọc)
        const strength = config.knockbackStrength ?? 1.6;
        target.applyKnockback({ x: dir.x * strength, z: dir.z * strength }, 0.35);
    } catch (_) {}

    system.runTimeout(() => {
        try {
            if (!target.isValid) return;
            target.addEffect('slowness', config.freezeDurationTicks ?? 120, { amplifier: config.slownessAmplifier ?? 3, showParticles: true });
            try { target.applyDamage(config.meleeDamage ?? 15); } catch (_) {}

            const loc = target.location;
            for (const radius of [1.0, 1.8]) {
                for (let i = 0; i < 16; i++) {
                    const angle = (Math.PI * 2 * i) / 16;
                    try {
                        target.dimension.spawnParticle('snow:snow', {
                            x: loc.x + Math.cos(angle) * radius, y: loc.y + 1, z: loc.z + Math.sin(angle) * radius
                        });
                    } catch (_) {}
                }
            }
            impactBurst(target.dimension, loc, true);
            target.dimension.playSound('ambient.weather.thunder', loc, { pitch: 1.7, volume: 1.0 });
            try { if (config.animAttackHit) yeti.playAnimation(config.animAttackHit); } catch (_) {}
        } catch (e) {
            console.warn('[Yeti Charge] hit effect error:', e);
        }
    }, 2);
}
