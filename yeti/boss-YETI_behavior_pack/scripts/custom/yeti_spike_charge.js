import { system } from '@minecraft/server';
import { FX, fx, sound, playAnim, groundAt, telegraph, shatter, flatDir, dist2D, playersNear, hurt, effect, shake, lockCast, safeTeleport, later, nearestPlayer } from './yeti_fx';

// === MODULE DÙNG CHUNG: GAI BĂNG + LAO ĐÁNH (ỦI) ===
// Dùng chung cho cả 3 file yeti_phase1.js / yeti_phase2.js / yeti_phase3.js
//
// v1.3:
// - Hàng gai được tính NGAY lúc bắt đầu chiêu và hiện vòng cảnh báo xanh ở từng vị trí gai,
//   người chơi thấy trước đường gai để né (trước đây gai nhắm theo vị trí lúc gai mọc)
// - Lao Đánh hiện vệt cảnh báo đỏ dọc đường lao, để lại vệt tuyết + băng lấp lánh khi lao
// - Hiệu ứng va chạm dùng particle mới (sóng xung kích, mảnh băng, bụi tuyết, vết nứt)
// - Khóa thi triển dùng chung (yeti_fx.lockCast) thay cho biến busyCasting riêng từng file
// Giữ nguyên từ bản trước: gai thưa, mỗi người chơi chỉ trúng 1 gai / lượt (không bị hất lên trời)

export const ICE_SPIKE_ENTITY_ID = 'ytaun:ice_spike_yeti_boss';
export const ANIM_SPIKE_SPAWN = 'animation.ytaun_ice_spike_yeti_boss.spawn';

function horizontalDir(from, to) {
    return flatDir(from, to);
}

function lanePoints(yeti, targetLoc, config) {
    const origin = yeti.location;
    const dir = horizontalDir(origin, targetLoc);
    const perp = { x: -dir.z, z: dir.x };
    const laneCount = config.laneCount ?? 3;
    const spacing = 1.9;
    const reach = dist2D(origin, targetLoc) + 2.5;
    const spikesPerLane = Math.max(3, Math.min(7, Math.ceil(reach / spacing)));
    const laneGap = 2.8;

    const laneCenters = [];
    const half = Math.floor(laneCount / 2);
    if (laneCount % 2 === 1) {
        for (let k = -half; k <= half; k++) laneCenters.push(k * laneGap);
    } else {
        for (let k = 0; k < laneCount; k++) laneCenters.push((k - (laneCount - 1) / 2) * laneGap);
    }

    const points = [];
    for (const laneCenter of laneCenters) {
        for (let i = 1; i <= spikesPerLane; i++) {
            const dist = i * spacing;
            const offset = laneCenter * (1 - i / (spikesPerLane * 2));
            points.push({
                index: i,
                loc: groundAt(yeti.dimension, {
                    x: origin.x + dir.x * dist + perp.x * offset,
                    y: origin.y,
                    z: origin.z + dir.z * dist + perp.z * offset
                })
            });
        }
    }
    return points;
}

/**
 * Gai Băng - các hàng gai băng hướng về phía target, có vòng cảnh báo trước.
 * config: { laneCount, spikeDamage, animIceSpike, windupTicks }
 * onDone: gọi lại sau khi gai bắt đầu mọc
 */
export function castIceSpike(yeti, target, config, onDone) {
    const windupTicks = config.windupTicks ?? 25;
    lockCast(yeti, windupTicks + 14);
    if (config.animIceSpike) playAnim(yeti, config.animIceSpike);

    const targetLoc = (target && target.isValid) ? target.location : (nearestPlayer(yeti, 12)?.location ?? yeti.location);
    const points = lanePoints(yeti, targetLoc, config);
    for (const p of points) telegraph(yeti.dimension, p.loc, 0.9, (windupTicks + p.index * 2) / 20, false);
    sound(yeti.dimension, 'mob.polarbear.warning', yeti.location, 1.5, 0.7);

    later(windupTicks, () => {
        try {
            if (!yeti.isValid) return;
            shatter(yeti.dimension, yeti.location, 2);
            shake(yeti.dimension, yeti.location, 12, 0.6, 0.5);
            sound(yeti.dimension, 'ambient.weather.thunder', yeti.location, 1.2, 1.3);
            spawnSpikes(yeti, points, config);
        } catch (e) {
            console.warn('[Yeti Spike] impact error:', e);
        } finally {
            if (onDone) onDone();
        }
    });
}

function spawnSpikes(yeti, points, config) {
    const hitPlayers = new Set(); // mỗi player chỉ bị 1 gai gây hiệu ứng / lượt chiêu
    const dim = yeti.dimension;
    for (const p of points) {
        later(p.index * 2, () => {
            try {
                const spike = dim.spawnEntity(ICE_SPIKE_ENTITY_ID, p.loc);
                // gọi playAnimation() cùng tick với spawnEntity() thường không ăn -> trễ 1 tick
                later(1, () => { if (spike.isValid) spike.playAnimation(ANIM_SPIKE_SPAWN); });
                later(60, () => { if (spike.isValid) spike.remove(); });
            } catch (_) {}
            fx(dim, FX.shards, p.loc, { radius: 0.6 });
            fx(dim, FX.crack, p.loc, { radius: 1.1 });
            if (p.index % 2 === 1) sound(dim, 'random.glass', p.loc, 0.8, 1 + p.index * 0.05);
            damagePlayersOnce(yeti, p.loc, config.spikeDamage ?? 5, hitPlayers);
        });
    }
}

function damagePlayersOnce(yeti, spikeLoc, damage, hitPlayers) {
    for (const player of playersNear(yeti.dimension, spikeLoc, 1.3)) {
        if (hitPlayers.has(player.id)) continue;
        hitPlayers.add(player.id);
        effect(player, 'slowness', 60, 2);
        hurt(player, damage, yeti);
    }
}

/**
 * Lao Đánh (Ủi) - lao thẳng tới target bằng teleport từng bước (không phụ thuộc AI/pathfinding).
 * config: { animAttack2, animAttackHit, meleeDamage, knockbackStrength, freezeDurationTicks, slownessAmplifier, dashTicks }
 * onResult(hit: boolean, target) - callback báo trúng/trượt (VD: trượt thì tung Gai Băng)
 */
export function castChargeAttack(yeti, target, config, onResult) {
    const dashTicks = config.dashTicks ?? 14;
    const dim = yeti.dimension;
    const start = { ...yeti.location };
    const dir = horizontalDir(start, target.location);
    const dashDistance = Math.max(4, Math.min(13, dist2D(start, target.location) + 2));
    const stepDist = dashDistance / dashTicks;
    lockCast(yeti, dashTicks + 8, false);

    if (config.animAttack2) playAnim(yeti, config.animAttack2);
    sound(dim, 'mob.ravager.step', start, 1.5, 0.7);
    sound(dim, 'mob.polarbear.warning', start, 1.5, 0.9);
    for (let d = 2; d <= dashDistance; d += 2) {
        telegraph(dim, { x: start.x + dir.x * d, y: start.y, z: start.z + dir.z * d }, 1.4, (dashTicks * d / dashDistance) / 20 + 0.1, true);
    }

    let tick = 0;
    const dashTimer = system.runInterval(() => {
        tick++;
        try {
            if (!yeti.isValid) { system.clearRun(dashTimer); if (onResult) onResult(false, target); return; }
            const loc = yeti.location;
            const newLoc = { x: loc.x + dir.x * stepDist, y: loc.y, z: loc.z + dir.z * stepDist };
            const facing = target.isValid ? target.location : newLoc;
            safeTeleport(yeti, newLoc, { facingLocation: facing });
            if (tick % 2 === 0) fx(dim, FX.snow, loc, { radius: 0.8 });
            fx(dim, FX.trail, { x: loc.x, y: loc.y + 1.5, z: loc.z });
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
        const finalTarget = (target && target.isValid) ? target : nearestPlayer(yeti, 12);
        const dy = finalTarget ? Math.abs(finalTarget.location.y - yeti.location.y) : 99;
        const isHit = finalTarget && dist2D(yeti.location, finalTarget.location) <= 3.5 && dy <= 3;

        if (isHit) onChargeHit(yeti, finalTarget, config);
        else shatter(yeti.dimension, yeti.location, 1.5, false);
        if (onResult) onResult(!!isHit, finalTarget);
    } catch (e) {
        console.warn('[Yeti Charge] resolve error:', e);
        if (onResult) onResult(false, target);
    }
}

function onChargeHit(yeti, target, config) {
    shatter(yeti.dimension, yeti.location, 2.5);
    shake(yeti.dimension, yeti.location, 8, 0.4, 0.3);

    try {
        const dir = horizontalDir(yeti.location, target.location);
        const strength = config.knockbackStrength ?? 1.6;
        target.applyKnockback({ x: dir.x * strength, z: dir.z * strength }, 0.35);
    } catch (_) {}

    later(2, () => {
        if (!target.isValid) return;
        effect(target, 'slowness', config.freezeDurationTicks ?? 120, config.slownessAmplifier ?? 3);
        hurt(target, config.meleeDamage ?? 15, yeti);
        const loc = target.location;
        fx(target.dimension, FX.prison, loc, { radius: 0.9, duration: 1 });
        fx(target.dimension, FX.shards, loc, { radius: 1.2 });
        fx(target.dimension, 'snow:snow', loc);
        sound(target.dimension, 'random.glass', loc, 1.5, 0.7);
        sound(target.dimension, 'ambient.weather.thunder', loc, 1.0, 1.7);
        if (config.animAttackHit && yeti.isValid) playAnim(yeti, config.animAttackHit);
    });
}
