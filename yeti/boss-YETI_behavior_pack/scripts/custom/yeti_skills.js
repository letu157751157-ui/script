// File: scripts/custom/yeti_skills.js
// Bộ chiêu dùng chung cho 3 pha Yeti (v1.4). Mỗi pha truyền thông số riêng (sát thương, bán kính...).
//
// v1.4 - làm lại phần hình ảnh của toàn bộ chiêu (cơ chế giữ như v1.3):
// - Khớp model đã sửa (khuỷu tay, cổ tay đúng chỗ), animation chi tiết từng khớp, particle gắn vào
//   miệng / tay / chân / ngực của Yeti (khai báo trong animation)
// - Gai Băng giờ là particle (bỏ mob gai băng cũ); va chạm nhiều lớp (chớp sáng, sóng, khối vụn, sương)
// - Vòng cảnh báo có lớp phủ lớn dần: chạm vòng ngoài đúng lúc đòn đánh xuống
// - Chiêu đánh trúng người chơi VÀ mob mà boss đang nhắm (yeti_fx.enemiesNear)

import { system } from '@minecraft/server';
import {
    ANIM, ANIM_TIMING as T, BREATH_SWEEP, FX, fx, sound, playAnim, groundAt, telegraph, impact, shatter,
    iceSpike, spikeRing, flatDir, rightOf, rotateFlat, dist2D, inCone, enemiesNear, playersNear, hurt, effect,
    knockbackFrom, shake, lockCast, safeTeleport, later, alive, MINION_TAG
} from './yeti_fx';

function add(a, d, k = 1) {
    return { x: a.x + d.x * k, y: a.y + (d.y ?? 0) * k, z: a.z + d.z * k };
}

// Quay mặt Yeti về phía mục tiêu ngay lập tức (để animation hướng đúng mục tiêu)
export function faceTarget(yeti, target) {
    if (!alive(target)) return;
    safeTeleport(yeti, yeti.location, { facingLocation: { x: target.location.x, y: yeti.location.y + 2, z: target.location.z } });
}

function hitBand(yeti, center, radius, width, fn) {
    for (const e of enemiesNear(yeti.dimension, center, radius + width, yeti, radius - width)) fn(e);
}

function ringPoints(center, radius, count, phase = 0) {
    const pts = [];
    for (let i = 0; i < count; i++) {
        const a = phase + (Math.PI * 2 * i) / count;
        pts.push({ x: center.x + Math.cos(a) * radius, y: center.y, z: center.z + Math.sin(a) * radius });
    }
    return pts;
}

// Đóng băng tạm 1 mục tiêu (hiệu ứng hình ảnh khối băng + làm chậm mạnh)
function freezeVisual(dim, target, ticks) {
    fx(dim, FX.frozen, target.location, { duration: ticks / 20 });
    fx(dim, FX.prison, target.location, { radius: 0.8, duration: ticks / 20 });
    sound(dim, 'random.glass', target.location, 1.2, 0.5);
}

// ============================================================================
// Gai Băng (Ice Spike) - đấm tay xuống đất, các hàng gai băng (particle) mọc về phía mục tiêu
// config: { laneCount, spikeDamage, spikeStep }
// ============================================================================

function lanePoints(yeti, targetLoc, config) {
    const origin = yeti.location;
    const dir = flatDir(origin, targetLoc);
    const perp = { x: -dir.z, z: dir.x };
    const laneCount = config.laneCount ?? 3;
    const spacing = 1.9;
    const reach = dist2D(origin, targetLoc) + 2.5;
    const perLane = Math.max(3, Math.min(8, Math.ceil(reach / spacing)));
    const gap = 2.8;
    const centers = [];
    for (let k = 0; k < laneCount; k++) centers.push((k - (laneCount - 1) / 2) * gap);
    const points = [];
    for (const c of centers) {
        for (let i = 1; i <= perLane; i++) {
            const offset = c * (1 - i / (perLane * 2));
            points.push({ index: i, loc: groundAt(yeti.dimension, {
                x: origin.x + dir.x * (i * spacing + 1) + perp.x * offset,
                y: origin.y + 1,
                z: origin.z + dir.z * (i * spacing + 1) + perp.z * offset
            }) });
        }
    }
    return points;
}

export function castIceSpike(yeti, target, config) {
    faceTarget(yeti, target);
    const windup = T.punchImpact;
    const step = config.spikeStep ?? 2; // tick giữa 2 gai liên tiếp (pha 1 chậm hơn, dễ né hơn)
    lockCast(yeti, windup + 18);
    playAnim(yeti, ANIM.groundPunch);
    const dim = yeti.dimension;
    const targetLoc = alive(target) ? target.location : yeti.location;
    const points = lanePoints(yeti, targetLoc, config);
    for (const p of points) telegraph(dim, p.loc, 0.95, (windup + p.index * step) / 20, false);
    sound(dim, 'mob.polarbear.warning', yeti.location, 1.5, 0.7);

    later(windup, () => {
        if (!alive(yeti)) return;
        const fist = add(yeti.location, flatDir(yeti.location, targetLoc), 2);
        impact(dim, fist, 1.6);
        shake(dim, yeti.location, 14, 0.6, 0.5);
        sound(dim, 'random.explode', fist, 1.2, 1.2);
        sound(dim, 'ambient.weather.thunder', yeti.location, 1, 1.4);
        const hit = new Set();
        for (const p of points) {
            later(p.index * step, () => {
                iceSpike(dim, p.loc, 0.9 + Math.random() * 0.5, 1.6);
                fx(dim, FX.crack, p.loc, { radius: 1.2 });
                if (p.index % 2 === 1) sound(dim, 'random.glass', p.loc, 0.8, 1 + p.index * 0.05);
                for (const e of enemiesNear(dim, p.loc, 1.4, yeti)) {
                    if (hit.has(e.id)) continue; // mỗi mục tiêu chỉ trúng 1 gai / lượt (không bị hất lên trời)
                    hit.add(e.id);
                    effect(e, 'slowness', 60, 2);
                    hurt(e, config.spikeDamage ?? 5, yeti);
                    try { e.applyKnockback({ x: 0, z: 0 }, 0.35); } catch (_) {}
                }
            });
        }
    });
}

// ============================================================================
// Lao Húc (Charge) - cúi thấp rồi lao thẳng, vệt đỏ báo đường lao, húc vai khi tới nơi
// config: { meleeDamage, knockbackStrength, freezeDurationTicks, slownessAmplifier }
// onResult(hit, target): trượt thì gọi tiếp Gai Băng
// ============================================================================

export function castChargeAttack(yeti, target, config, onResult) {
    faceTarget(yeti, target);
    const dim = yeti.dimension;
    const start = { ...yeti.location };
    const dir = flatDir(start, target.location);
    const distance = Math.max(4, Math.min(13, dist2D(start, target.location) + 2));
    const ticks = T.chargeTicks;
    lockCast(yeti, T.chargeDash + ticks + 12, false);
    playAnim(yeti, ANIM.charge);
    sound(dim, 'mob.polarbear.warning', start, 1.5, 0.9);
    for (let d = 2; d <= distance; d += 2) {
        telegraph(dim, add(start, dir, d), 1.4, (T.chargeDash + ticks * d / distance) / 20, true);
    }
    later(T.chargeDash, () => {
        if (!alive(yeti)) { if (onResult) onResult(false, target); return; }
        sound(dim, 'mob.ravager.roar', start, 1.2, 1.3);
        let tick = 0;
        const run = system.runInterval(() => {
            tick++;
            try {
                if (!alive(yeti)) { system.clearRun(run); if (onResult) onResult(false, target); return; }
                const loc = yeti.location;
                const next = { x: loc.x + dir.x * distance / ticks, y: loc.y, z: loc.z + dir.z * distance / ticks };
                safeTeleport(yeti, next, { facingLocation: alive(target) ? target.location : add(next, dir, 5) });
                if (tick % 2 === 0) {
                    fx(dim, FX.snow, loc, { radius: 0.9 });
                    fx(dim, FX.footprint, groundAt(dim, add(loc, rightOf(dir), tick % 4 === 0 ? 0.6 : -0.6)));
                    sound(dim, 'mob.ravager.step', loc, 1, 0.7);
                }
                fx(dim, FX.trail, { x: loc.x, y: loc.y + 1.5, z: loc.z });
                // người / mob bị ủi dọc đường bị hất sang 2 bên
                for (const e of enemiesNear(dim, next, 2.2, yeti)) {
                    if (e.id === target?.id) continue;
                    knockbackFrom(next, e, 1.2, 0.3);
                }
            } catch (_) {}
            if (tick >= ticks) {
                system.clearRun(run);
                resolveCharge(yeti, target, config, onResult);
            }
        }, 1);
    });
}

function resolveCharge(yeti, target, config, onResult) {
    const dim = yeti.dimension;
    const finalTarget = alive(target) ? target : undefined;
    const isHit = finalTarget && dist2D(yeti.location, finalTarget.location) <= 3.6 && Math.abs(finalTarget.location.y - yeti.location.y) <= 3;
    if (!isHit) {
        shatter(dim, yeti.location, 1.5, false);
        if (onResult) onResult(false, finalTarget);
        return;
    }
    impact(dim, finalTarget.location, 2.4);
    shake(dim, yeti.location, 10, 0.6, 0.4);
    sound(dim, 'random.explode', yeti.location, 1.5, 0.9);
    knockbackFrom(yeti.location, finalTarget, config.knockbackStrength ?? 1.6, 0.4);
    later(2, () => {
        if (!alive(finalTarget)) return;
        effect(finalTarget, 'slowness', config.freezeDurationTicks ?? 120, config.slownessAmplifier ?? 3);
        hurt(finalTarget, config.meleeDamage ?? 15, yeti);
        freezeVisual(dim, finalTarget, 30);
    });
    if (onResult) onResult(true, finalTarget);
}

// ============================================================================
// Ném Tảng Băng (Boulder Toss) - nhổ tảng băng lên (thấy trong tay), ném vòng cung vào vòng đỏ
// o: { damage, radius, flightTicks, slow: [ticks, amp], arc, comet? }
// ============================================================================

export function launchBoulder(yeti, aim, o) {
    const dim = yeti.dimension;
    const base = yeti.location;
    const fwd = flatDir(base, aim);
    const left = rightOf(fwd);
    const start = { x: base.x - left.x * 1.4 + fwd.x, y: base.y + 5.2, z: base.z - left.z * 1.4 + fwd.z };
    const ticks = o.flightTicks;
    const arc = o.arc ?? 4;
    let i = 0;
    sound(dim, 'mob.irongolem.throw', base, 1.5, 0.6);
    const run = system.runInterval(() => {
        i++;
        try {
            for (const sub of [0.34, 0.67, 1]) {
                const s = Math.min(1, (i - 1 + sub) / ticks);
                const p = {
                    x: start.x + (aim.x - start.x) * s,
                    y: start.y + (aim.y + 0.6 - start.y) * s + arc * 4 * s * (1 - s),
                    z: start.z + (aim.z - start.z) * s
                };
                fx(dim, o.comet ? FX.comet : FX.boulder, p);
                if (sub === 1) { fx(dim, FX.trail, p); if (i % 2 === 0) fx(dim, FX.snow, p, { radius: 0.3 }); }
            }
        } catch (_) {}
        if (i >= ticks) {
            system.clearRun(run);
            impact(dim, aim, 2.2);
            spikeRing(dim, aim, 1.6, 4, 0.8, 1.2, Math.random() * 3);
            sound(dim, 'random.glass', aim, 2, 0.7);
            sound(dim, 'random.explode', aim, 1.2, 1.4);
            shake(dim, aim, 10, 0.4, 0.3);
            for (const e of enemiesNear(dim, aim, o.radius, yeti)) {
                hurt(e, o.damage, yeti);
                effect(e, 'slowness', o.slow[0], o.slow[1]);
                knockbackFrom(aim, e, 0.6, 0.3);
            }
        }
    }, 1);
}

export function boulderToss(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 29);
    playAnim(yeti, ANIM.throw);
    const dim = yeti.dimension;
    const aim = groundAt(dim, target.location);
    telegraph(dim, aim, o.radius, (T.throwRelease + o.flightTicks) / 20, true);
    sound(dim, 'mob.polarbear.warning', yeti.location, 1.5, 0.7);
    later(5, () => { if (alive(yeti)) { sound(dim, 'dig.snow', yeti.location, 1.5, 0.6); fx(dim, FX.debris, yeti.location, { radius: 1 }); } });
    later(T.throwRelease, () => { if (alive(yeti)) launchBoulder(yeti, aim, o); });
}

// ============================================================================
// Băng Địa (Frost Field) - đập đất tạo vùng băng (vòng rune + tuyết rơi) làm chậm + gây sát thương
// o: { radius, durationTicks, damage, slow: [ticks, amp] }
// ============================================================================

export function frostField(yeti, o) {
    lockCast(yeti, 32);
    playAnim(yeti, ANIM.slam);
    const dim = yeti.dimension;
    later(T.slamImpact, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, yeti.location);
        impact(dim, center, 2.5);
        fx(dim, FX.rune, center, { radius: o.radius, duration: o.durationTicks / 20 });
        telegraph(dim, center, o.radius, 1.2, false);
        spikeRing(dim, center, o.radius * 0.8, 8, 0.8, 1.4);
        sound(dim, 'random.glass', center, 2, 0.6);
        sound(dim, 'dig.snow', center, 2, 0.6);
        shake(dim, center, 12, 0.5, 0.4);
        let n = 0;
        const run = system.runInterval(() => {
            n++;
            try {
                if (n % 2 === 0) fx(dim, FX.snowfall, center, { radius: o.radius });
                if (n % 4 === 0) fx(dim, FX.mist, center, { radius: o.radius * 0.35 });
                for (let k = 0; k < 3; k++) {
                    const a = Math.random() * Math.PI * 2, r = Math.random() * o.radius;
                    fx(dim, FX.trail, { x: center.x + Math.cos(a) * r, y: center.y + 0.3, z: center.z + Math.sin(a) * r });
                }
                for (const e of enemiesNear(dim, center, o.radius, yeti)) {
                    hurt(e, o.damage, yeti);
                    effect(e, 'slowness', o.slow[0], o.slow[1]);
                }
            } catch (_) {}
            if (n * 10 >= o.durationTicks) system.clearRun(run);
        }, 10);
    });
}

// ============================================================================
// Tiếng Gầm Băng Giá (Frost Roar) - các vòng sóng + sương băng lan ra theo nhịp tiếng gầm
// o: { rings, ringStep, ringDelay, damage(r)?, slow, fatigue?, knock? }
// ============================================================================

export function frostRoar(yeti, o) {
    lockCast(yeti, 38);
    playAnim(yeti, ANIM.roar);
    const dim = yeti.dimension;
    sound(dim, 'mob.polarbear.warning', yeti.location, 2, 0.5);
    later(T.roarPeak, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, yeti.location);
        sound(dim, 'mob.ravager.roar', center, 3, 0.7);
        sound(dim, 'mob.enderdragon.growl', center, 2, 0.6);
        shake(dim, center, o.rings * o.ringStep + 4, 0.5, 0.8);
        fx(dim, FX.mist, center, { radius: o.rings * o.ringStep * 0.5 });
        for (let ring = 1; ring <= o.rings; ring++) {
            later(ring * o.ringDelay, () => {
                const r = ring * o.ringStep;
                fx(dim, FX.shockwave, center, { radius: r });
                for (const p of ringPoints(center, r, 6 + ring, ring)) fx(dim, FX.snow, p, { radius: 0.5 });
                hitBand(yeti, center, r, 1, e => {
                    const dmg = o.damage ? o.damage(r) : 0;
                    if (dmg > 0) hurt(e, dmg, yeti);
                    effect(e, 'slowness', o.slow[0], o.slow[1]);
                    if (o.fatigue) effect(e, 'mining_fatigue', o.fatigue[0], o.fatigue[1]);
                    if (o.knock) knockbackFrom(center, e, o.knock[0], o.knock[1]);
                });
            });
        }
    });
}

// ============================================================================
// Cú Nhảy Nghiền Băng (Crushing Leap) - bay vòng cung, vòng đỏ báo điểm rơi, gai băng mọc quanh chỗ đáp
// o: { height, radius, maxDamage, falloff, minDamage, knock: [h, v] }
// ============================================================================

export function crushingLeap(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, T.leapLanding + 14);
    playAnim(yeti, ANIM.leap);
    const dim = yeti.dimension;
    const start = { ...yeti.location };
    const landing = groundAt(dim, target.location);
    telegraph(dim, landing, o.radius, T.leapLanding / 20, true);
    sound(dim, 'mob.polarbear.warning', start, 1.5, 0.6);
    later(T.leapTakeoff, () => {
        if (!alive(yeti)) return;
        sound(dim, 'mob.irongolem.throw', start, 2, 0.5);
        impact(dim, start, 1.2, { crack: true });
    });
    const airTicks = T.leapLanding - T.leapTakeoff;
    for (let k = 1; k <= airTicks; k++) {
        later(T.leapTakeoff + k, () => {
            if (!alive(yeti)) return;
            const s = k / airTicks;
            const pos = {
                x: start.x + (landing.x - start.x) * s,
                y: start.y + (landing.y - start.y) * s + Math.sin(Math.PI * s) * o.height,
                z: start.z + (landing.z - start.z) * s
            };
            safeTeleport(yeti, pos, { facingLocation: { x: landing.x, y: pos.y, z: landing.z }, keepVelocity: false });
            fx(dim, FX.trail, { x: pos.x, y: pos.y + 1, z: pos.z });
            if (k % 3 === 0) fx(dim, FX.snow, pos, { radius: 0.5 });
        });
    }
    later(T.leapLanding, () => {
        if (!alive(yeti)) return;
        impact(dim, landing, Math.min(4, o.radius * 0.6));
        fx(dim, FX.shockwave, landing, { radius: o.radius + 1 });
        spikeRing(dim, landing, o.radius * 0.75, Math.round(5 + o.radius), 1.1, 1.5);
        sound(dim, 'random.explode', landing, 2.5, 0.8);
        sound(dim, 'dig.snow', landing, 2, 0.5);
        shake(dim, landing, o.radius * 3, 0.7, 0.6);
        for (const e of enemiesNear(dim, landing, o.radius, yeti)) {
            const d = dist2D(e.location, landing);
            hurt(e, Math.max(o.maxDamage - Math.floor(d * o.falloff), o.minDamage), yeti);
            knockbackFrom(landing, e, o.knock[0], o.knock[1]);
        }
    });
}

// ============================================================================
// Hồi Phục Băng Giá (Ice Regeneration) - ngồi thụp trong lớp vỏ gai băng, lõi băng sáng ở ngực
// o: { durationTicks, heal, healEvery, pushRadius, pushPower, pushVertical, damage, damageEvery, resistance? }
// ============================================================================

export function iceRegen(yeti, o) {
    lockCast(yeti, o.durationTicks);
    playAnim(yeti, ANIM.regen);
    const dim = yeti.dimension;
    sound(dim, 'beacon.power', yeti.location, 2, 1.3);
    fx(dim, FX.beam, yeti.location);
    fx(dim, FX.rune, groundAt(dim, yeti.location), { radius: 3.5, duration: o.durationTicks / 20 });
    if (o.resistance !== undefined) effect(yeti, 'resistance', o.durationTicks + 60, o.resistance, false);
    let t = 0;
    const run = system.runInterval(() => {
        if (!alive(yeti)) { system.clearRun(run); return; }
        t++;
        try {
            const loc = yeti.location;
            if (t % 20 === 1) fx(dim, FX.prison, loc, { radius: 2.4, duration: 1.05 });
            if (t % 10 === 0) fx(dim, FX.heal, loc, { radius: 1.8 });
            if (t % 50 === 0 && t < o.durationTicks - 20) playAnim(yeti, ANIM.regen);
            if (t % o.healEvery === 0) {
                const h = yeti.getComponent('minecraft:health');
                if (h) h.setCurrentValue(Math.min(h.effectiveMax ?? h.defaultValue, h.currentValue + o.heal));
                sound(dim, 'random.orb', loc, 0.5, 1.5);
            }
            for (const e of enemiesNear(dim, loc, o.pushRadius, yeti)) {
                knockbackFrom(loc, e, o.pushPower, o.pushVertical);
                if (o.damage && t % o.damageEvery === 0) hurt(e, o.damage, yeti);
                if (t % 20 === 0) effect(e, 'slowness', 30, 1);
            }
        } catch (_) {}
        if (t >= o.durationTicks) {
            system.clearRun(run);
            impact(dim, yeti.location, 2.8, { crack: false });
            sound(dim, 'random.glass', yeti.location, 2, 0.8);
        }
    }, 1);
}

// ============================================================================
// Triệu Hồi (Summon Minions / Elite Army) - giơ tay gọi bão, cổng băng (vòng rune + lốc tuyết) rồi quái xuất hiện
// o: { points: [{x, z, d}], types: [], effects: [[name, amp]], portalTicks }
// ============================================================================

export function summonMinions(yeti, o) {
    lockCast(yeti, T.summonImpact + 18);
    playAnim(yeti, ANIM.summon);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    sound(dim, 'mob.evocation_illager.prepare_summon', origin, 2, 0.8);
    later(T.summonImpact, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, origin);
        impact(dim, center, 2.5);
        fx(dim, FX.shockwave, center, { radius: 8 });
        shake(dim, center, 14, 0.5, 0.4);
        for (const pt of o.points) {
            later(pt.d, () => {
                const sp = groundAt(dim, { x: origin.x + pt.x, y: origin.y + 1, z: origin.z + pt.z });
                fx(dim, FX.rune, sp, { radius: 1.8, duration: o.portalTicks / 20 + 0.4 });
                fx(dim, FX.tornado, sp, { radius: 1.2 });
                telegraph(dim, sp, 1.6, o.portalTicks / 20, false);
                later(o.portalTicks, () => {
                    impact(dim, sp, 1.4, { crack: false });
                    fx(dim, FX.beam, sp);
                    sound(dim, 'mob.evocation_illager.cast_spell', sp, 1.5, 1);
                    try {
                        const type = o.types[Math.floor(Math.random() * o.types.length)];
                        const mob = dim.spawnEntity(type, sp);
                        try { mob.addTag(MINION_TAG); } catch (_) {}
                        for (const [name, amp] of o.effects) effect(mob, name, 999999, amp, false);
                    } catch (_) {}
                });
            });
        }
    });
}

// ============================================================================
// Mưa Băng Nhọn (Icicle Rain) - hú lên trời, băng nhọn rơi xuống các vòng đỏ (nhắm cả mục tiêu)
// o: { waves, perWave, interval, area, radius, damage, slow: [ticks, amp] }
// ============================================================================

export function icicleRain(yeti, target, o) {
    lockCast(yeti, 40);
    playAnim(yeti, ANIM.howl);
    const dim = yeti.dimension;
    sound(dim, 'ambient.weather.thunder', yeti.location, 2.5, 0.8);
    later(T.howlPeak, () => { if (alive(yeti)) fx(dim, FX.swirl, yeti.location, { radius: 3 }); });
    for (let w = 0; w < o.waves; w++) {
        later(T.howlPeak + 6 + w * o.interval, () => {
            if (!alive(yeti)) return;
            const center = yeti.location;
            const points = [];
            const enemies = enemiesNear(dim, center, o.area, yeti);
            for (let k = 0; k < Math.min(2, enemies.length); k++) {
                const en = enemies[Math.floor(Math.random() * enemies.length)];
                points.push({ x: en.location.x + (Math.random() - 0.5) * 2, y: en.location.y, z: en.location.z + (Math.random() - 0.5) * 2 });
            }
            while (points.length < o.perWave) {
                const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * (o.area - 3);
                points.push({ x: center.x + Math.cos(a) * r, y: center.y, z: center.z + Math.sin(a) * r });
            }
            for (const pt of points) {
                const ground = groundAt(dim, pt);
                telegraph(dim, ground, o.radius, 0.9, true);
                fx(dim, FX.icicle, { x: ground.x, y: ground.y + 12, z: ground.z });
                later(18, () => {
                    impact(dim, ground, 1.2);
                    iceSpike(dim, ground, 0.7, 1.2);
                    sound(dim, 'random.glass', ground, 1.2, 0.8 + Math.random() * 0.4);
                    for (const e of enemiesNear(dim, ground, o.radius, yeti)) {
                        hurt(e, o.damage, yeti);
                        effect(e, 'slowness', o.slow[0], o.slow[1]);
                    }
                });
            }
        });
    }
}

// ============================================================================
// Rãnh Băng (Glacier Rift) - đấm đất, gai băng lớn trồi lên thành đường thẳng tới mục tiêu, hất tung
// o: { steps, spacing, stepDelay, radius, damage, launch }
// ============================================================================

export function glacierRift(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 32);
    playAnim(yeti, ANIM.groundPunch);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    const dir = flatDir(origin, target.location);
    const points = [];
    for (let i = 1; i <= o.steps; i++) points.push(groundAt(dim, add({ ...origin, y: origin.y + 1 }, dir, i * o.spacing)));
    points.forEach((pt, i) => telegraph(dim, pt, 1.3, (T.punchImpact + (i + 1) * o.stepDelay) / 20, false));
    const hit = new Set();
    later(T.punchImpact, () => {
        if (!alive(yeti)) return;
        impact(dim, add(origin, dir, 2), 1.6);
        sound(dim, 'random.explode', origin, 1.5, 0.7);
        shake(dim, origin, 14, 0.4, 0.5);
        points.forEach((pt, i) => {
            later((i + 1) * o.stepDelay, () => {
                iceSpike(dim, pt, 1.5, 1.2);
                iceSpike(dim, add(pt, rightOf(dir), 0.9), 0.9, 1.0);
                iceSpike(dim, add(pt, rightOf(dir), -0.9), 0.9, 1.0);
                fx(dim, FX.crack, pt, { radius: 1.6 });
                sound(dim, 'random.glass', pt, 1, 0.9 + i * 0.05);
                for (const e of enemiesNear(dim, pt, o.radius, yeti)) {
                    if (hit.has(e.id)) continue;
                    hit.add(e.id);
                    hurt(e, o.damage, yeti);
                    try { e.applyKnockback({ x: 0, z: 0 }, o.launch); } catch (_) {}
                }
            });
        });
    });
}

// ============================================================================
// Lốc Xoáy Cực Địa (Polar Vortex) - xoay người, cột lốc tuyết hút mục tiêu vào tâm
// o: { durationTicks, radius, pull, damage, damageEvery, slow: [ticks, amp] }
// ============================================================================

export function polarVortex(yeti, o) {
    lockCast(yeti, 32);
    playAnim(yeti, ANIM.spin);
    const dim = yeti.dimension;
    const center = groundAt(dim, yeti.location);
    sound(dim, 'mob.wither.spawn', center, 2, 1.2);
    fx(dim, FX.rune, center, { radius: o.radius, duration: o.durationTicks / 20 });
    telegraph(dim, center, o.radius, 1, false);
    let t = 0;
    const run = system.runInterval(() => {
        t += 2;
        try {
            if (t % 20 === 2) {
                fx(dim, FX.tornado, center, { radius: 2.5 });
                fx(dim, FX.swirl, center, { radius: o.radius * 0.85 });
                fx(dim, FX.swirl, center, { radius: o.radius * 0.45 });
            }
            if (t % 40 === 2) sound(dim, 'elytra.loop', center, 1.2, 0.6);
            for (const e of enemiesNear(dim, center, o.radius, yeti)) {
                const d = flatDir(e.location, center);
                try { e.applyKnockback({ x: d.x * o.pull, z: d.z * o.pull }, 0); } catch (_) {}
                if (t % o.damageEvery === 0) {
                    hurt(e, o.damage, yeti);
                    effect(e, 'slowness', o.slow[0], o.slow[1]);
                    fx(dim, FX.shards, e.location, { radius: 0.5 });
                }
            }
        } catch (_) {}
        if (t >= o.durationTicks) system.clearRun(run);
    }, 2);
}

// ============================================================================
// Sóng Băng Hà (Glacial Wave) - đập đất, các vòng sóng lan xa, gai băng trồi theo vòng
// o: { rings, ringStep, ringDelay, damage, knock: [h, v] }
// ============================================================================

export function glacialWave(yeti, o) {
    lockCast(yeti, 32);
    playAnim(yeti, ANIM.slam);
    const dim = yeti.dimension;
    later(T.slamImpact, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, yeti.location);
        impact(dim, center, 2.8);
        sound(dim, 'random.explode', center, 2.5, 0.8);
        shake(dim, center, o.rings * o.ringStep, 0.5, 0.6);
        for (let w = 1; w <= o.rings; w++) {
            later(w * o.ringDelay, () => {
                const r = w * o.ringStep;
                fx(dim, FX.shockwave, center, { radius: r });
                if (w % 2 === 0) spikeRing(dim, center, r, Math.round(4 + r), 0.7, 0.9, w);
                else for (const p of ringPoints(center, r, 8, w)) fx(dim, FX.snow, p, { radius: 0.7 });
                hitBand(yeti, center, r, 1, e => {
                    hurt(e, o.damage, yeti);
                    knockbackFrom(center, e, o.knock[0], o.knock[1]);
                });
            });
        }
    });
}

// ============================================================================
// Độ Không Tuyệt Đối (Absolute Zero) - chiêu tuyệt vọng: vòng rune khổng lồ, bão tuyết đóng băng cả vùng
// o: { durationTicks, every, radius, damage, damageEveryN, slow: [ticks, amp], weak: [ticks, amp] }
// ============================================================================

export function absoluteZero(yeti, o) {
    lockCast(yeti, 38);
    playAnim(yeti, ANIM.cast);
    const dim = yeti.dimension;
    const center = groundAt(dim, yeti.location);
    sound(dim, 'beacon.power', center, 3, 0.45);
    later(T.castRelease, () => {
        fx(dim, FX.beam, center);
        impact(dim, center, 3.5);
        fx(dim, FX.shockwave, center, { radius: o.radius });
        fx(dim, FX.rune, center, { radius: o.radius, duration: o.durationTicks / 20 });
        fx(dim, FX.rune, center, { radius: o.radius * 0.45, duration: o.durationTicks / 20 });
        telegraph(dim, center, o.radius, 1.5, true);
        shake(dim, center, o.radius, 0.6, 1.2);
        let n = 0;
        const run = system.runInterval(() => {
            n++;
            try {
                if ((n * o.every) % 20 < o.every) {
                    fx(dim, FX.swirl, center, { radius: o.radius * 0.6 });
                    fx(dim, FX.snowfall, center, { radius: o.radius * 0.8 });
                    fx(dim, FX.flame, center, { radius: 1.5 });
                }
                for (const e of enemiesNear(dim, center, o.radius, yeti)) {
                    effect(e, 'slowness', o.slow[0], o.slow[1]);
                    effect(e, 'weakness', o.weak[0], o.weak[1]);
                    if (n % o.damageEveryN === 0) {
                        hurt(e, o.damage, yeti);
                        freezeVisual(dim, e, 20);
                    }
                }
            } catch (_) {}
            if (n * o.every >= o.durationTicks) system.clearRun(run);
        }, o.every);
    });
}

// ============================================================================
// Động Đất Băng (Earthquake) - nhảy tại chỗ rồi dậm xuống, vết nứt + gai băng lan rất xa
// o: { height, rings, ringStep, ringDelay, damage, slow: [ticks, amp], knock: [h, v] }
// ============================================================================

export function earthquake(yeti, o) {
    lockCast(yeti, T.leapLanding + 14);
    playAnim(yeti, ANIM.leap);
    const dim = yeti.dimension;
    const start = { ...yeti.location };
    const center = groundAt(dim, start);
    telegraph(dim, center, o.rings * o.ringStep, T.leapLanding / 20 + 0.4, false);
    sound(dim, 'mob.irongolem.throw', start, 2.5, 0.4);
    const airTicks = T.leapLanding - T.leapTakeoff;
    for (let k = 1; k <= airTicks; k++) {
        later(T.leapTakeoff + k, () => {
            if (!alive(yeti)) return;
            safeTeleport(yeti, { x: start.x, y: start.y + Math.sin(Math.PI * k / airTicks) * o.height, z: start.z }, { keepVelocity: false });
        });
    }
    later(T.leapLanding, () => {
        if (!alive(yeti)) return;
        impact(dim, center, 4);
        sound(dim, 'random.explode', center, 3, 0.5);
        sound(dim, 'ambient.weather.thunder', center, 2, 0.7);
        shake(dim, center, o.rings * o.ringStep + 6, 0.8, 1.2);
        for (let w = 1; w <= o.rings; w++) {
            later(w * o.ringDelay, () => {
                const r = w * o.ringStep;
                fx(dim, FX.shockwave, center, { radius: r });
                for (const p of ringPoints(center, r, 6, w * 0.7)) {
                    fx(dim, FX.crack, groundAt(dim, p), { radius: 1.8 });
                    if (w % 2 === 1) iceSpike(dim, p, 0.8, 1.0);
                }
                if (w % 2 === 0) sound(dim, 'dig.stone', center, 2, 0.7);
                hitBand(yeti, center, r, 1, e => {
                    hurt(e, o.damage, yeti);
                    effect(e, 'slowness', o.slow[0], o.slow[1]);
                    knockbackFrom(center, e, o.knock[0], o.knock[1]);
                });
            });
        }
    });
}

// ============================================================================
// Xiềng Băng (Ice Chains) - xích băng lấp lánh trói mục tiêu rồi giật mạnh về phía Yeti
// o: { bindTicks, slow, weak, damage, damageEvery, pullDamage, pullPower, range }
// ============================================================================

export function iceChains(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 38);
    playAnim(yeti, ANIM.cast);
    const dim = yeti.dimension;
    sound(dim, 'mob.irongolem.hit', yeti.location, 2, 0.6);
    later(T.castRelease, () => {
        if (!alive(yeti) || !alive(target) || dist2D(yeti.location, target.location) > o.range) return;
        effect(target, 'slowness', o.bindTicks, o.slow);
        effect(target, 'weakness', o.bindTicks, o.weak);
        fx(dim, FX.prison, target.location, { radius: 0.9, duration: o.bindTicks / 20 });
        fx(dim, FX.rune, groundAt(dim, target.location), { radius: 1.6, duration: o.bindTicks / 20 });
        sound(dim, 'random.anvil_land', target.location, 0.8, 1.6);
        let t = 0;
        const run = system.runInterval(() => {
            t += 2;
            if (!alive(target) || !alive(yeti)) { system.clearRun(run); return; }
            try {
                const a = { x: yeti.location.x, y: yeti.location.y + 3.5, z: yeti.location.z };
                const b = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
                const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
                const n = Math.min(40, Math.ceil(len / 0.6));
                for (let i = 0; i <= n; i++) {
                    const s = i / n;
                    const sag = Math.sin(Math.PI * s) * 0.6;
                    fx(dim, i % 3 === 0 ? FX.trail : FX.spark, { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s - sag, z: a.z + (b.z - a.z) * s });
                }
                if (t % o.damageEvery === 0) hurt(target, o.damage, yeti);
            } catch (_) {}
            if (t >= o.bindTicks) {
                system.clearRun(run);
                try {
                    const d = flatDir(target.location, yeti.location);
                    target.applyKnockback({ x: d.x * o.pullPower, z: d.z * o.pullPower }, 0.35);
                    hurt(target, o.pullDamage, yeti);
                    impact(dim, target.location, 1.4, { crack: false });
                    sound(dim, 'random.glass', target.location, 1.5, 0.6);
                } catch (_) {}
            }
        }, 2);
    });
}

// ============================================================================
// Mưa Tảng Băng (Boulder Barrage) - ném liên tiếp nhiều tảng băng (o.comet: thiên thạch băng phát sáng)
// o: { count, interval, area, damage, radius, flightTicks, slow }
// ============================================================================

export function boulderBarrage(yeti, o) {
    lockCast(yeti, o.count * o.interval + 18);
    const dim = yeti.dimension;
    for (let i = 0; i < o.count; i++) {
        later(i * o.interval, () => {
            if (!alive(yeti)) return;
            const enemies = enemiesNear(dim, yeti.location, o.area, yeti);
            let aim;
            if (enemies.length > 0) {
                const en = enemies[i % enemies.length];
                aim = groundAt(dim, { x: en.location.x + (Math.random() - 0.5) * 3, y: en.location.y, z: en.location.z + (Math.random() - 0.5) * 3 });
                faceTarget(yeti, en);
            } else {
                const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 10;
                aim = groundAt(dim, { x: yeti.location.x + Math.cos(a) * r, y: yeti.location.y, z: yeti.location.z + Math.sin(a) * r });
            }
            playAnim(yeti, ANIM.throw, 0.1);
            telegraph(dim, aim, o.radius, (T.throwRelease + o.flightTicks) / 20, true);
            later(T.throwRelease, () => { if (alive(yeti)) launchBoulder(yeti, aim, o); });
        });
    }
}

// ============================================================================
// Bùng Nổ Băng (Frost Nova) - gầm lên, cột sáng băng + vòng nổ lan ra, gai băng ở vòng trong
// o: { from, to, step, ringDelay, damage, knock: [h, v] }
// ============================================================================

export function frostNova(yeti, o) {
    lockCast(yeti, 38);
    playAnim(yeti, ANIM.roar);
    const dim = yeti.dimension;
    later(T.roarPeak, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, yeti.location);
        fx(dim, FX.beam, center);
        impact(dim, center, 3.5);
        spikeRing(dim, center, 3, 8, 1.2, 1.4);
        sound(dim, 'random.explode', center, 3, 0.7);
        sound(dim, 'mob.ravager.roar', center, 2.5, 0.9);
        shake(dim, center, o.to + 4, 0.6, 0.6);
        for (let r = o.from; r <= o.to; r += o.step) {
            later((r / o.step) * o.ringDelay, () => {
                fx(dim, FX.shockwave, center, { radius: r });
                for (const p of ringPoints(center, r, 4, r)) fx(dim, FX.flash, groundAt(dim, p), { radius: 1.2 });
                hitBand(yeti, center, r, 1, e => {
                    hurt(e, o.damage, yeti);
                    knockbackFrom(center, e, o.knock[0], o.knock[1]);
                });
            });
        }
    });
}

// ============================================================================
// Giáp Băng (Frost Armor) - đấm ngực, lửa băng + lớp gai băng bao quanh, phản sát thương (xử lý ở phase3)
// o: { durationTicks, resistance }
// ============================================================================

export function frostArmor(yeti, o, armorActive) {
    lockCast(yeti, 40);
    playAnim(yeti, ANIM.chestBeat);
    const dim = yeti.dimension;
    const id = yeti.id;
    armorActive.set(id, true);
    sound(dim, 'beacon.activate', yeti.location, 2, 1.2);
    effect(yeti, 'resistance', o.durationTicks, o.resistance, false);
    let t = 0;
    const run = system.runInterval(() => {
        if (!alive(yeti)) { system.clearRun(run); armorActive.delete(id); return; }
        t += 10;
        try {
            const loc = yeti.location;
            if (t % 20 === 0) {
                fx(dim, FX.prison, loc, { radius: 2.3, duration: 1.05 });
                fx(dim, FX.flame, loc, { radius: 1.2 });
            }
            for (const e of enemiesNear(dim, loc, 4, yeti)) effect(e, 'slowness', 60, 1);
        } catch (_) {}
        if (t >= o.durationTicks) {
            system.clearRun(run);
            armorActive.delete(id);
            impact(dim, yeti.location, 2.5, { crack: false });
            sound(dim, 'random.glass', yeti.location, 1.5, 1);
        }
    }, 10);
}

// ============================================================================
// Vuốt Băng (Frost Claws) - 2 cú vuốt hình nón (pha 1) hoặc combo 3 đòn vuốt-vuốt-đập (pha 2, 3)
// o: { range, halfAngle, damage, slow: [ticks, amp], knock: [h, v], combo? }
// ============================================================================

function clawHit(yeti, target, o, side, last) {
    const dim = yeti.dimension;
    const origin = yeti.location;
    const dir = alive(target) ? flatDir(origin, target.location) : { x: 0, z: 1 };
    const r = rightOf(dir);
    fx(dim, FX.claw, { x: origin.x + dir.x * 2.8 + r.x * side * 0.6, y: origin.y + 2.4, z: origin.z + dir.z * 2.8 + r.z * side * 0.6 }, { radius: 2.4 });
    sound(dim, 'game.player.attack.strong', origin, 1.5, 0.6);
    sound(dim, 'random.glass', origin, 0.7, 1.7);
    for (const e of enemiesNear(dim, origin, o.range, yeti)) {
        if (!inCone(origin, dir, e.location, o.range, o.halfAngle)) continue;
        hurt(e, o.damage, yeti);
        effect(e, 'slowness', o.slow[0], o.slow[1]);
        fx(dim, FX.flash, e.location, { radius: 1 });
        fx(dim, FX.shards, e.location, { radius: 0.6 });
        if (last) knockbackFrom(origin, e, o.knock[0], o.knock[1]);
    }
}

export function frostClaws(yeti, target, o) {
    faceTarget(yeti, target);
    const dim = yeti.dimension;
    if (!o.combo) {
        lockCast(yeti, 27, false);
        playAnim(yeti, ANIM.swipe);
        later(T.swipeHit1, () => { if (alive(yeti)) clawHit(yeti, target, o, 1, false); });
        later(T.swipeHit2, () => { if (alive(yeti)) clawHit(yeti, target, o, -1, true); });
        return;
    }
    lockCast(yeti, 44, false);
    playAnim(yeti, ANIM.combo);
    later(T.comboHit1, () => { if (alive(yeti)) clawHit(yeti, target, o, 1, false); });
    later(T.comboHit2, () => { if (alive(yeti)) clawHit(yeti, target, o, -1, false); });
    later(T.comboHit3, () => {
        if (!alive(yeti)) return;
        const at = add(yeti.location, alive(target) ? flatDir(yeti.location, target.location) : { x: 0, z: 1 }, 2.4);
        impact(dim, at, 2.2);
        spikeRing(dim, at, 1.8, 5, 0.9, 1.1);
        sound(dim, 'random.explode', at, 1.8, 1);
        shake(dim, at, 10, 0.5, 0.4);
        for (const e of enemiesNear(dim, at, o.range * 0.8, yeti)) {
            hurt(e, Math.round(o.damage * 1.5), yeti);
            knockbackFrom(at, e, o.knock[0] * 1.3, o.knock[1] + 0.2);
        }
    });
}

// ============================================================================
// Hơi Thở Băng Giá (Frost Breath) - hít vào (ngực phồng) rồi phun băng hình nón, quét trái -> phải
// o: { range, halfAngle, damage, hitEvery, slow: [ticks, amp], freezeHits, freezeTicks }
// ============================================================================

function breathYaw(tick) {
    for (let i = 0; i < BREATH_SWEEP.length - 1; i++) {
        const [t0, a0] = BREATH_SWEEP[i], [t1, a1] = BREATH_SWEEP[i + 1];
        if (tick >= t0 && tick <= t1) {
            const s = (tick - t0) / (t1 - t0);
            return a0 + (a1 - a0) * (s * s * (3 - 2 * s));
        }
    }
    return 0;
}

export function frostBreath(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 54);
    playAnim(yeti, ANIM.breath);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    const base = flatDir(origin, target.location);
    const hits = new Map();
    sound(dim, 'mob.polarbear.warning', origin, 2, 0.8);
    for (let tick = T.breathStart; tick <= T.breathEnd; tick += 2) {
        later(tick, () => {
            if (!alive(yeti)) return;
            // giữ thân Yeti hướng cố định để phần xoay thân trong animation khớp với luồng băng
            safeTeleport(yeti, origin, { facingLocation: { x: origin.x + base.x * 10, y: origin.y + 2, z: origin.z + base.z * 10 } });
            const dir = rotateFlat(base, breathYaw(tick));
            const mouth = { x: origin.x + dir.x * 1.8, y: origin.y + 4.2, z: origin.z + dir.z * 1.8 };
            fx(dim, FX.breath, mouth, { dir_x: dir.x, dir_y: -0.28, dir_z: dir.z });
            if (tick % 6 === 0) {
                sound(dim, 'random.fizz', mouth, 1, 0.6);
                const end = groundAt(dim, add(origin, dir, o.range * 0.85));
                fx(dim, FX.mist, end, { radius: 1.2 });
                fx(dim, FX.crack, end, { radius: 1.3 });
            }
            if ((tick - T.breathStart) % o.hitEvery !== 0) return;
            for (const e of enemiesNear(dim, origin, o.range, yeti)) {
                if (!inCone(origin, dir, e.location, o.range, o.halfAngle)) continue;
                hurt(e, o.damage, yeti);
                effect(e, 'slowness', o.slow[0], o.slow[1]);
                const n = (hits.get(e.id) ?? 0) + 1;
                hits.set(e.id, n);
                if (n === o.freezeHits) {
                    effect(e, 'slowness', o.freezeTicks, 6);
                    effect(e, 'mining_fatigue', o.freezeTicks, 2);
                    freezeVisual(dim, e, o.freezeTicks);
                }
            }
        });
    }
}

// ============================================================================
// Ngục Băng (Ice Prison) - vòng đỏ dưới chân mục tiêu; không chạy ra kịp thì bị nhốt trong cột băng
// o: { delay, durationTicks, damage, radius }
// ============================================================================

export function icePrison(yeti, target, o, prisonActive) {
    faceTarget(yeti, target);
    lockCast(yeti, 32);
    playAnim(yeti, ANIM.cast);
    const dim = yeti.dimension;
    const center = groundAt(dim, target.location);
    const trigger = T.castRelease + o.delay;
    telegraph(dim, center, o.radius, trigger / 20, true);
    fx(dim, FX.rune, center, { radius: o.radius + 0.6, duration: trigger / 20 + 0.3 });
    sound(dim, 'mob.evocation_illager.prepare_attack', yeti.location, 1.5, 0.7);
    later(trigger, () => {
        iceSpike(dim, center, 1.2, 0.6);
        sound(dim, 'random.glass', center, 1.5, 0.5);
        if (!alive(target) || dist2D(target.location, center) > o.radius + 0.3 || prisonActive.has(target.id)) return;
        prisonActive.set(target.id, true);
        fx(dim, FX.prison, center, { radius: 0.9, duration: o.durationTicks / 20 });
        fx(dim, FX.frozen, target.location, { duration: o.durationTicks / 20 });
        effect(target, 'slowness', o.durationTicks, 6);
        effect(target, 'mining_fatigue', o.durationTicks, 2);
        effect(target, 'weakness', o.durationTicks, 1);
        let t = 0;
        const run = system.runInterval(() => {
            t += 2;
            const done = t >= o.durationTicks || !alive(target);
            if (!done && dist2D(target.location, center) > 0.6) safeTeleport(target, { x: center.x, y: target.location.y, z: center.z });
            if (done) {
                system.clearRun(run);
                prisonActive.delete(target.id);
                if (!alive(target)) return;
                impact(dim, center, 1.8);
                sound(dim, 'random.glass', center, 2, 0.6);
                hurt(target, o.damage, yeti);
            }
        }, 2);
    });
}

// ============================================================================
// Cuồng Nộ (Enrage) - 1 lần khi máu thấp: đấm ngực, cột sáng, lửa băng bùng lên, tăng tốc + sức mạnh
// o: { speed, strength, name }
// ============================================================================

export function enrage(yeti, o) {
    lockCast(yeti, 42);
    playAnim(yeti, ANIM.chestBeat);
    const dim = yeti.dimension;
    const loc = yeti.location;
    fx(dim, FX.beam, loc);
    impact(dim, loc, 3.5);
    fx(dim, FX.shockwave, groundAt(dim, loc), { radius: 12 });
    fx(dim, FX.flame, loc, { radius: 1.4 });
    sound(dim, 'mob.ravager.roar', loc, 3, 0.5);
    sound(dim, 'mob.wither.spawn', loc, 1.5, 1.4);
    shake(dim, loc, 24, 0.7, 1.5);
    effect(yeti, 'speed', 999999, o.speed, false);
    effect(yeti, 'strength', 999999, o.strength, false);
    for (const p of playersNear(dim, loc, 48)) {
        try {
            p.onScreenDisplay.setTitle('§c§lCUỒNG NỘ', { subtitle: `${o.name} §7nổi điên! Chiêu hồi nhanh hơn`, fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 15 });
        } catch (_) {}
    }
}

// ============================================================================
// Xuất hiện pha mới (Phase Intro)
// info: { title, subtitle }
// ============================================================================

export function phaseIntro(yeti, info) {
    lockCast(yeti, 62);
    const dim = yeti.dimension;
    const loc = yeti.location;
    later(2, () => { if (alive(yeti)) playAnim(yeti, ANIM.phaseIntro, 0.3); });
    fx(dim, FX.beam, loc);
    impact(dim, loc, 3.5);
    fx(dim, FX.rune, groundAt(dim, loc), { radius: 6, duration: 3 });
    fx(dim, FX.tornado, loc, { radius: 2.5 });
    sound(dim, 'ambient.weather.thunder', loc, 2, 0.8);
    later(46, () => {
        if (!alive(yeti)) return;
        sound(dim, 'mob.ravager.roar', yeti.location, 3, 0.6);
        fx(dim, FX.shockwave, groundAt(dim, yeti.location), { radius: 12 });
        fx(dim, FX.mist, groundAt(dim, yeti.location), { radius: 6 });
        shake(dim, yeti.location, 30, 0.6, 1);
    });
    for (const p of playersNear(dim, loc, 64)) {
        try {
            p.onScreenDisplay.setTitle(info.title, { subtitle: info.subtitle, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 });
        } catch (_) {}
    }
}
