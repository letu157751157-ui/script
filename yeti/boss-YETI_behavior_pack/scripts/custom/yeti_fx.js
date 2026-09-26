// File: scripts/custom/yeti_fx.js
// Tiện ích dùng chung cho mọi skill của Yeti (v1.3):
// - Tên animation mới (animation.ytaun_yeti.*) và particle mới (ytaun:*)
// - Phát particle kèm biến Molang (bán kính, thời gian, hướng) qua MolangVariableMap
// - Vòng cảnh báo dưới đất (telegraph) để người chơi kịp né
// - Khóa thi triển (1 lần chỉ 1 chiêu, không chồng animation), đứng yên khi thi triển
// - Sát thương có ghi nhớ Yeti nào gây ra (để nội tại "hồi máu khi hạ gục" tính cả chiêu)

import { world, system, MolangVariableMap, GameMode } from '@minecraft/server';

export const ANIM = {
    roar: 'animation.ytaun_yeti.roar',
    slam: 'animation.ytaun_yeti.slam',
    leap: 'animation.ytaun_yeti.leap',
    throw: 'animation.ytaun_yeti.throw',
    breath: 'animation.ytaun_yeti.breath',
    summon: 'animation.ytaun_yeti.summon',
    regen: 'animation.ytaun_yeti.regen',
    swipe: 'animation.ytaun_yeti.swipe',
    chestBeat: 'animation.ytaun_yeti.chest_beat',
    spin: 'animation.ytaun_yeti.spin',
    cast: 'animation.ytaun_yeti.cast',
    phaseIntro: 'animation.ytaun_yeti.phase_intro',
    iceSpike: 'animation.ytaun_yeti_1_default.ice_spike',
    charge: 'animation.ytaun_yeti_1_default.attack_2',
    chargeHit: 'animation.ytaun_yeti_1.attack',
    deathPulse: 'animation.ytaun_yeti_death.pulse'
};

// Thời điểm (tick) khớp với khung hình quan trọng của từng animation
export const ANIM_TIMING = {
    roarPeak: 11,       // miệng mở to nhất
    slamImpact: 14,     // nắm đấm chạm đất
    leapTakeoff: 7,     // bật khỏi mặt đất
    leapLanding: 22,    // tiếp đất
    throwRelease: 12,   // buông tảng băng
    breathStart: 11,    // bắt đầu phun
    breathEnd: 42,      // ngừng phun
    summonImpact: 24,   // đập 2 tay xuống đất
    swipeHit1: 8,       // vuốt tay phải
    swipeHit2: 16,      // vuốt tay trái
    castRelease: 11     // đẩy 2 tay ra trước
};

// Lượng xoay thân (độ, dương = sang phải Yeti) trong animation "breath", để hướng luồng băng khớp với hình
export const BREATH_SWEEP = [[12, 0], [22, -20], [32, 20], [42, 0]];

export const FX = {
    shockwave: 'ytaun:frost_shockwave',
    telegraph: 'ytaun:telegraph',
    danger: 'ytaun:telegraph_danger',
    crack: 'ytaun:ground_crack',
    shards: 'ytaun:ice_shards',
    snow: 'ytaun:snow_burst',
    breath: 'ytaun:frost_breath',
    claw: 'ytaun:claw_slash',
    beam: 'ytaun:phase_beam',
    swirl: 'ytaun:blizzard_swirl',
    trail: 'ytaun:ice_trail',
    boulder: 'ytaun:ice_boulder',
    icicle: 'ytaun:icicle_fall',
    prison: 'ytaun:ice_prison',
    aura: 'ytaun:frost_aura',
    heal: 'ytaun:frost_heal'
};

export const DIMENSIONS = ['overworld', 'nether', 'the_end'];

// Tên enum khác nhau giữa các bản Script API (2.x: Spectator, 1.x: spectator)
const SPECTATOR = GameMode.Spectator ?? GameMode.spectator;

// -------------------- Particle / âm thanh --------------------

export function fx(dimension, id, loc, vars) {
    try {
        if (vars) {
            const map = new MolangVariableMap();
            for (const [key, value] of Object.entries(vars)) map.setFloat(`variable.${key}`, value);
            dimension.spawnParticle(id, loc, map);
        } else {
            dimension.spawnParticle(id, loc);
        }
    } catch (_) {}
}

export function sound(dimension, id, loc, volume = 1, pitch = 1) {
    try { dimension.playSound(id, loc, { volume, pitch }); } catch (_) {}
}

export function playAnim(entity, name, blendOutTime = 0.25) {
    try { entity.playAnimation(name, { blendOutTime }); } catch (_) {}
}

// Tìm mặt đất ngay dưới 1 vị trí (để vòng cảnh báo / vết nứt nằm sát đất)
export function groundAt(dimension, loc, maxDown = 10) {
    const x = Math.floor(loc.x), z = Math.floor(loc.z);
    let y = Math.floor(loc.y);
    try {
        for (let i = 0; i < 4; i++) {
            const block = dimension.getBlock({ x, y, z });
            if (!block || block.isAir || block.isLiquid) break;
            y++;
        }
        for (let i = 0; i < maxDown; i++) {
            const below = dimension.getBlock({ x, y: y - 1, z });
            if (!below || !(below.isAir || below.isLiquid)) break;
            y--;
        }
    } catch (_) {
        return { x: loc.x, y: loc.y, z: loc.z };
    }
    return { x: loc.x, y, z: loc.z };
}

// Vòng cảnh báo dưới đất: xanh = chiêu thường, đỏ = đòn nặng
export function telegraph(dimension, loc, radius, seconds, danger = false) {
    fx(dimension, danger ? FX.danger : FX.telegraph, groundAt(dimension, loc), { radius, duration: seconds });
}

// Combo hiệu ứng vỡ băng: sóng xung kích + mảnh băng + bụi tuyết + vết nứt
export function shatter(dimension, loc, size = 2, crack = true) {
    const ground = groundAt(dimension, loc);
    fx(dimension, FX.shockwave, ground, { radius: size * 1.6 });
    fx(dimension, FX.shards, ground, { radius: size });
    fx(dimension, FX.snow, ground, { radius: size });
    if (crack) fx(dimension, FX.crack, ground, { radius: Math.min(6, size * 1.2) });
}

// -------------------- Hình học --------------------

export function flatDir(from, to) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    return len < 1e-3 ? { x: 0, z: 1 } : { x: dx / len, z: dz / len };
}

// Bên phải của hướng d (Minecraft: nhìn về +Z thì tay phải ở -X)
export function rightOf(d) {
    return { x: -d.z, z: d.x };
}

export function rotateFlat(d, degrees) {
    const r = rightOf(d), a = degrees * Math.PI / 180;
    return { x: d.x * Math.cos(a) + r.x * Math.sin(a), z: d.z * Math.cos(a) + r.z * Math.sin(a) };
}

export function dist2D(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

export function inCone(origin, dir, loc, range, halfAngleDeg) {
    const dx = loc.x - origin.x, dz = loc.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return false;
    if (d < 1.2) return true;
    const cos = (dx * dir.x + dz * dir.z) / d;
    return cos >= Math.cos(halfAngleDeg * Math.PI / 180);
}

// -------------------- Người chơi --------------------

export function playersNear(dimension, loc, radius, minDistance) {
    try {
        const options = { location: loc, maxDistance: radius };
        if (SPECTATOR) options.excludeGameModes = [SPECTATOR];
        if (minDistance !== undefined) options.minDistance = Math.max(0, minDistance);
        return dimension.getPlayers(options);
    } catch (_) {
        return [];
    }
}

export function nearestPlayer(entity, radius) {
    const players = playersNear(entity.dimension, entity.location, radius);
    let best, bestDist = Infinity;
    for (const p of players) {
        const d = dist2D(p.location, entity.location);
        if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
}

const lastSkillHit = new Map(); // player.id -> { yetiId, tick }

export function hurt(target, amount, source) {
    try {
        target.applyDamage(amount);
        if (source && target.typeId === 'minecraft:player') lastSkillHit.set(target.id, { yetiId: source.id, tick: system.currentTick });
    } catch (_) {}
}

// Yeti vừa đánh trúng người chơi bằng chiêu trong vòng 3 giây gần nhất (để tính công hạ gục)
export function recentSkillAttacker(player) {
    const rec = lastSkillHit.get(player.id);
    lastSkillHit.delete(player.id);
    if (!rec || system.currentTick - rec.tick > 60) return undefined;
    try { return world.getEntity(rec.yetiId); } catch (_) { return undefined; }
}

export function effect(target, name, ticks, amplifier, showParticles = true) {
    try { target.addEffect(name, ticks, { amplifier, showParticles }); } catch (_) {}
}

export function knockbackFrom(origin, target, horizontal, vertical) {
    const d = flatDir(origin, target.location);
    try { target.applyKnockback({ x: d.x * horizontal, z: d.z * horizontal }, vertical); } catch (_) {}
}

export function shake(dimension, loc, radius, intensity, seconds) {
    for (const p of playersNear(dimension, loc, radius)) {
        try { p.runCommand(`camerashake add @s ${intensity} ${seconds} positional`); } catch (_) {}
    }
}

// -------------------- Khóa thi triển --------------------

const busyUntil = new Map(); // entity.id -> tick hết khóa

export function isBusy(entity) {
    return (busyUntil.get(entity.id) ?? 0) > system.currentTick;
}

// Khóa không cho dùng chiêu khác trong "ticks" tick. root = đứng yên (làm chậm ẩn) trong lúc đó.
export function lockCast(entity, ticks, root = true) {
    busyUntil.set(entity.id, Math.max(busyUntil.get(entity.id) ?? 0, system.currentTick + ticks));
    if (root) effect(entity, 'slowness', ticks, 6, false);
}

export function clearEntity(entityId) {
    busyUntil.delete(entityId);
}

export function safeTeleport(entity, loc, options) {
    try { entity.teleport(loc, options); } catch (_) {}
}

export function later(ticks, fn) {
    return system.runTimeout(() => { try { fn(); } catch (e) { console.warn('[Yeti FX]', e); } }, Math.max(0, Math.round(ticks)));
}
