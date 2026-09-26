// File: scripts/custom/yeti_fx.js
// Tiện ích dùng chung cho mọi skill của Yeti (v1.4):
// - Tên animation (animation.ytaun_yeti.*) và particle (ytaun:*)
// - Hiệu ứng nhiều lớp: chớp sáng + sóng xung kích + khối vụn + mảnh băng + sương + vết nứt
// - Gai băng bằng particle (thay cho mob gai băng cũ)
// - Vòng cảnh báo: vòng ngoài + lớp phủ lớn dần, chạm vòng ngoài đúng lúc đòn đánh xuống
// - Mục tiêu: người chơi + mob mà boss đang đánh (chó, mèo, cáo, sói, dân làng, hoglin, golem...
//   và bất kỳ mob nào vừa đánh boss). Không đánh quái do boss triệu hồi và thú cưng của boss.
// - Khóa thi triển (1 lúc chỉ 1 chiêu), sát thương có ghi nhớ Yeti nào gây ra

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
    combo: 'animation.ytaun_yeti.combo',
    chestBeat: 'animation.ytaun_yeti.chest_beat',
    howl: 'animation.ytaun_yeti.howl',
    groundPunch: 'animation.ytaun_yeti.ground_punch',
    charge: 'animation.ytaun_yeti.charge',
    phaseIntro: 'animation.ytaun_yeti.phase_intro',
    deathPulse: 'animation.ytaun_yeti_death.pulse'
};

// Thời điểm (tick) khớp với khung hình quan trọng của từng animation
export const ANIM_TIMING = {
    roarPeak: 11,       // miệng mở to nhất
    slamImpact: 14,     // nắm đấm chạm đất
    leapTakeoff: 7,     // bật khỏi mặt đất
    leapLanding: 22,    // tiếp đất
    throwRelease: 12,   // buông tảng băng
    breathStart: 12,    // bắt đầu phun
    breathEnd: 42,      // ngừng phun
    summonImpact: 24,   // đập 2 tay xuống đất
    howlPeak: 14,       // bắt đầu hú
    swipeHit1: 8,       // vuốt tay phải
    swipeHit2: 16,      // vuốt tay trái
    comboHit1: 7,       // combo: vuốt phải
    comboHit2: 15,      // combo: vuốt trái
    comboHit3: 27,      // combo: đập 2 tay
    castRelease: 11,    // đẩy 2 tay ra trước
    punchImpact: 12,    // đấm xuống đất (gọi gai băng)
    chargeDash: 5,      // bắt đầu lao
    chargeTicks: 14     // thời gian lao
};

// Lượng xoay thân (độ, dương = sang phải Yeti) trong animation "breath", để hướng luồng băng khớp với hình
export const BREATH_SWEEP = [[12, 0], [22, -20], [32, 20], [42, 0]];

export const FX = {
    shockwave: 'ytaun:frost_shockwave',
    telegraph: 'ytaun:telegraph',
    telegraphFill: 'ytaun:telegraph_fill',
    danger: 'ytaun:telegraph_danger',
    dangerFill: 'ytaun:telegraph_danger_fill',
    crack: 'ytaun:ground_crack',
    rune: 'ytaun:rune_circle',
    footprint: 'ytaun:footprint',
    shards: 'ytaun:ice_shards',
    debris: 'ytaun:ice_debris',
    snow: 'ytaun:snow_burst',
    mist: 'ytaun:ground_mist',
    flash: 'ytaun:ice_flash',
    spike: 'ytaun:ice_spike',
    breath: 'ytaun:frost_breath',
    claw: 'ytaun:claw_slash',
    beam: 'ytaun:phase_beam',
    swirl: 'ytaun:blizzard_swirl',
    tornado: 'ytaun:snow_tornado',
    snowfall: 'ytaun:snowfall',
    aura: 'ytaun:frost_aura',
    flame: 'ytaun:frost_flame',
    heal: 'ytaun:frost_heal',
    frozen: 'ytaun:frozen_block',
    prison: 'ytaun:ice_prison',
    trail: 'ytaun:ice_trail',
    spark: 'ytaun:beam_spark',
    boulder: 'ytaun:ice_boulder',
    comet: 'ytaun:comet',
    icicle: 'ytaun:icicle_fall',
    orb: 'ytaun:ice_orb',
    crystal: 'ytaun:big_crystal',
    beamCore: 'ytaun:beam_core'
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

// Tìm mặt đất ngay dưới 1 vị trí (để vòng cảnh báo / vết nứt / gai băng nằm sát đất)
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

// Vòng cảnh báo dưới đất: xanh = chiêu thường, đỏ = đòn nặng.
// Lớp phủ bên trong lớn dần và chạm vòng ngoài đúng lúc đòn đánh xuống.
export function telegraph(dimension, loc, radius, seconds, danger = false) {
    const ground = groundAt(dimension, loc);
    fx(dimension, danger ? FX.danger : FX.telegraph, ground, { radius, duration: seconds });
    fx(dimension, danger ? FX.dangerFill : FX.telegraphFill, ground, { radius, duration: seconds });
}

// Va chạm nhiều lớp: chớp sáng, sóng xung kích, khối vụn, mảnh băng, bụi tuyết, sương lan, vết nứt
export function impact(dimension, loc, size = 2, options = {}) {
    const ground = groundAt(dimension, loc);
    fx(dimension, FX.flash, ground, { radius: Math.min(4, 1 + size * 0.6) });
    fx(dimension, FX.shockwave, ground, { radius: size * 1.8 });
    fx(dimension, FX.shards, ground, { radius: size });
    fx(dimension, FX.snow, ground, { radius: size });
    if (size >= 1.5) fx(dimension, FX.debris, ground, { radius: size });
    if (size >= 2 || options.mist) fx(dimension, FX.mist, ground, { radius: size * 1.4 });
    if (options.crack !== false) fx(dimension, FX.crack, ground, { radius: Math.min(7, size * 1.3) });
}

// Hiệu ứng vỡ băng nhẹ (không có chớp sáng / sương)
export function shatter(dimension, loc, size = 2, crack = true) {
    const ground = groundAt(dimension, loc);
    fx(dimension, FX.shockwave, ground, { radius: size * 1.6 });
    fx(dimension, FX.shards, ground, { radius: size });
    fx(dimension, FX.snow, ground, { radius: size });
    if (crack) fx(dimension, FX.crack, ground, { radius: Math.min(6, size * 1.2) });
}

// Gai băng mọc lên từ mặt đất (particle, thay cho mob gai băng cũ). size ~ chiều cao / 2.5 block
export function iceSpike(dimension, loc, size = 1, seconds = 1.6) {
    const ground = groundAt(dimension, loc);
    fx(dimension, FX.spike, ground, { radius: size, duration: seconds });
    fx(dimension, FX.shards, ground, { radius: size * 0.6 });
    fx(dimension, FX.snow, ground, { radius: size * 0.5 });
}

// Vòng gai băng mọc quanh 1 điểm
export function spikeRing(dimension, center, radius, count, size = 1, seconds = 1.6, phase = 0) {
    for (let i = 0; i < count; i++) {
        const a = phase + (Math.PI * 2 * i) / count;
        iceSpike(dimension, { x: center.x + Math.cos(a) * radius, y: center.y + 1, z: center.z + Math.sin(a) * radius },
            size * (0.8 + Math.random() * 0.4), seconds);
    }
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

// -------------------- Mục tiêu --------------------

// Các họ mob mà boss chủ động tấn công (khớp với minecraft:behavior.nearest_attackable_target của boss)
const TARGET_FAMILIES = ['player', 'brown_dog', 'white_dog', 'cat', 'fox', 'wolf', 'villager', 'farmer', 'hoglin', 'zoglin', 'irongolem', 'snowgolem'];
const IGNORE_TYPES = ['minecraft:item', 'minecraft:xp_orb', 'minecraft:arrow', 'minecraft:snowball', 'minecraft:armor_stand', 'minecraft:painting'];
export const MINION_TAG = 'yeti_minion';

const aggro = new Map(); // boss.id -> Map(entity.id -> tick gần nhất đánh nhau với boss)

export function isBoss(entity) {
    return entity.typeId.startsWith('ytaun:yeti');
}

function noteAggro(boss, other) {
    if (!boss || !other || !isBoss(boss) || other.typeId.startsWith('ytaun:')) return;
    let m = aggro.get(boss.id);
    if (!m) aggro.set(boss.id, (m = new Map()));
    m.set(other.id, system.currentTick);
}

// Boss bị đánh -> kẻ đánh thành mục tiêu; boss đánh trúng ai -> người đó là mục tiêu
world.afterEvents.entityHurt.subscribe(e => {
    try {
        const src = e.damageSource?.damagingEntity;
        if (src && isBoss(e.hurtEntity)) noteAggro(e.hurtEntity, src);
    } catch (_) {}
});
world.afterEvents.entityHitEntity.subscribe(e => {
    try {
        if (e.damagingEntity && e.hitEntity && isBoss(e.damagingEntity)) noteAggro(e.damagingEntity, e.hitEntity);
    } catch (_) {}
});

export function forgetBoss(bossId) {
    aggro.delete(bossId);
}

function isPlayer(entity) {
    return entity.typeId === 'minecraft:player';
}

// Có phải đối thủ của boss không (người chơi, mob boss nhắm tới, mob vừa đánh nhau với boss)
export function isEnemy(entity, boss) {
    try {
        if (!entity || !entity.isValid || entity.id === boss?.id) return false;
        const id = entity.typeId;
        if (id.startsWith('ytaun:') || IGNORE_TYPES.includes(id)) return false;
        if (isPlayer(entity)) {
            try { if (SPECTATOR && entity.getGameMode() === SPECTATOR) return false; } catch (_) {}
            return true;
        }
        if (entity.hasTag(MINION_TAG) || !entity.getComponent('minecraft:health')) return false;
        const fought = boss && aggro.get(boss.id)?.get(entity.id);
        if (fought !== undefined && system.currentTick - fought < 600) return true;
        const fam = entity.getComponent('minecraft:type_family');
        return !!fam && TARGET_FAMILIES.some(f => fam.hasTypeFamily(f));
    } catch (_) {
        return false;
    }
}

// Mọi đối thủ trong bán kính (skill gây sát thương lên tất cả)
export function enemiesNear(dimension, loc, radius, boss, minDistance) {
    try {
        const options = { location: loc, maxDistance: radius };
        if (minDistance !== undefined) options.minDistance = Math.max(0, minDistance);
        return dimension.getEntities(options).filter(e => isEnemy(e, boss));
    } catch (_) {
        return [];
    }
}

// Người chơi quanh 1 điểm (dùng cho rung màn hình, tiêu đề)
export function playersNear(dimension, loc, radius) {
    try {
        const options = { location: loc, maxDistance: radius };
        if (SPECTATOR) options.excludeGameModes = [SPECTATOR];
        return dimension.getPlayers(options);
    } catch (_) {
        return [];
    }
}

// Mục tiêu của boss: mob / người vừa đánh nhau với boss (mới nhất), nếu không thì đối thủ gần nhất
export function pickTarget(boss, radius) {
    const m = aggro.get(boss.id);
    if (m) {
        let best, bestTick = -1;
        for (const [id, tick] of m) {
            if (system.currentTick - tick > 300) { m.delete(id); continue; }
            if (tick <= bestTick) continue;
            let e;
            try { e = world.getEntity(id); } catch (_) {}
            if (!e || !e.isValid || e.dimension.id !== boss.dimension.id || dist2D(e.location, boss.location) > radius) continue;
            best = e; bestTick = tick;
        }
        if (best) return best;
    }
    let best, bestDist = Infinity;
    for (const e of enemiesNear(boss.dimension, boss.location, radius, boss)) {
        const d = dist2D(e.location, boss.location);
        if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
}

const lastSkillHit = new Map(); // player.id -> { yetiId, tick }

export function hurt(target, amount, source) {
    try {
        target.applyDamage(amount);
        if (source && isPlayer(target)) lastSkillHit.set(target.id, { yetiId: source.id, tick: system.currentTick });
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

// Khóa không cho dùng chiêu khác trong "ticks" tick.
// root = giữ đứng yên (làm chậm ẩn) nhưng chỉ trong "rootTicks" tick đầu (khoảnh khắc ra đòn),
// sau đó Yeti lại đi / đuổi theo bình thường.
export function lockCast(entity, ticks, root = true, rootTicks = Math.min(ticks, 16)) {
    busyUntil.set(entity.id, Math.max(busyUntil.get(entity.id) ?? 0, system.currentTick + ticks));
    if (root && rootTicks > 0) effect(entity, 'slowness', rootTicks, 4, false);
}

export function busyEnd(entity) {
    return busyUntil.get(entity.id) ?? 0;
}

export function clearEntity(entityId) {
    busyUntil.delete(entityId);
    forgetBoss(entityId);
}

export function safeTeleport(entity, loc, options) {
    try { entity.teleport(loc, options); } catch (_) {}
}

export function later(ticks, fn) {
    return system.runTimeout(() => { try { fn(); } catch (e) { console.warn('[Yeti FX]', e); } }, Math.max(0, Math.round(ticks)));
}

export function alive(entity) {
    try { return !!entity && entity.isValid; } catch (_) { return false; }
}
