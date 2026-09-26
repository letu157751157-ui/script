// File: scripts/custom/yeti_skills.js
// Bộ chiêu dùng chung cho 3 pha Yeti (v1.3). Mỗi pha truyền thông số riêng (sát thương, bán kính...).
//
// Điểm mới so với v1.2:
// - Mỗi chiêu có animation riêng (animation.ytaun_yeti.*) và thời điểm gây sát thương khớp với
//   khung hình (VD: đập đất đúng lúc nắm đấm chạm đất).
// - Particle mới (ytaun:*) thay cho các particle vanilla cũ; ít particle hơn nhưng rõ ràng hơn.
// - Vòng cảnh báo (telegraph) xanh/đỏ dưới đất trước các đòn nặng để người chơi kịp né.
// - Khóa thi triển: một lúc chỉ dùng 1 chiêu, Yeti đứng yên khi ra đòn.
// - Chiêu mới: Vuốt Băng Kép, Hơi Thở Băng Giá, Ngục Băng, Mưa Tảng Băng, Cuồng Nộ.

import { system } from '@minecraft/server';
import {
    ANIM, ANIM_TIMING as T, BREATH_SWEEP, FX, fx, sound, playAnim, groundAt, telegraph, shatter,
    flatDir, rightOf, rotateFlat, dist2D, inCone, playersNear, hurt, effect, knockbackFrom, shake,
    lockCast, safeTeleport, later
} from './yeti_fx';

function alive(entity) {
    try { return !!entity && entity.isValid; } catch (_) { return false; }
}

function add(a, d, k = 1) {
    return { x: a.x + d.x * k, y: a.y + (d.y ?? 0) * k, z: a.z + d.z * k };
}

// Quay mặt Yeti về phía mục tiêu ngay lập tức (để animation hướng đúng người chơi)
export function faceTarget(yeti, target) {
    if (!alive(target)) return;
    safeTeleport(yeti, yeti.location, { facingLocation: { x: target.location.x, y: yeti.location.y + 2, z: target.location.z } });
}

function hitBand(dimension, center, radius, width, fn) {
    for (const p of playersNear(dimension, center, radius + width, radius - width)) fn(p);
}

function ringPoints(center, radius, count, phase = 0) {
    const pts = [];
    for (let i = 0; i < count; i++) {
        const a = phase + (Math.PI * 2 * i) / count;
        pts.push({ x: center.x + Math.cos(a) * radius, y: center.y, z: center.z + Math.sin(a) * radius });
    }
    return pts;
}

// ============================================================================
// Ném Tảng Băng (Boulder Toss) - thay Ice Ball: ném vòng cung, vòng đỏ báo chỗ rơi
// o: { damage, radius, flightTicks, slow: [ticks, amp], arc }
// ============================================================================

export function launchBoulder(yeti, aim, o) {
    const dim = yeti.dimension;
    const base = yeti.location;
    const fwd = flatDir(base, aim);
    const left = rightOf(fwd);
    const start = { x: base.x - left.x * 1.2 + fwd.x, y: base.y + 5, z: base.z - left.z * 1.2 + fwd.z };
    const ticks = o.flightTicks;
    const arc = o.arc ?? 4;
    let i = 0;
    sound(dim, 'mob.irongolem.throw', base, 1.5, 0.6);
    const run = system.runInterval(() => {
        i++;
        try {
            for (const sub of [0.5, 1]) {
                const s = Math.min(1, (i - 1 + sub) / ticks);
                const p = {
                    x: start.x + (aim.x - start.x) * s,
                    y: start.y + (aim.y + 0.6 - start.y) * s + arc * 4 * s * (1 - s),
                    z: start.z + (aim.z - start.z) * s
                };
                fx(dim, FX.boulder, p);
                if (sub === 1) fx(dim, FX.trail, p);
            }
        } catch (_) {}
        if (i >= ticks) {
            system.clearRun(run);
            try {
                shatter(dim, aim, 2);
                sound(dim, 'random.glass', aim, 2, 0.7);
                sound(dim, 'random.explode', aim, 1.2, 1.4);
                shake(dim, aim, 10, 0.4, 0.3);
                for (const p of playersNear(dim, aim, o.radius)) {
                    hurt(p, o.damage, yeti);
                    effect(p, 'slowness', o.slow[0], o.slow[1]);
                    knockbackFrom(aim, p, 0.6, 0.3);
                }
            } catch (_) {}
        }
    }, 1);
}

export function boulderToss(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 28);
    playAnim(yeti, ANIM.throw);
    const dim = yeti.dimension;
    const aim = groundAt(dim, target.location);
    telegraph(dim, aim, o.radius, (T.throwRelease + o.flightTicks) / 20, true);
    sound(dim, 'mob.polarbear.warning', yeti.location, 1.5, 0.7);
    later(T.throwRelease, () => { if (alive(yeti)) launchBoulder(yeti, aim, o); });
}

// ============================================================================
// Băng Địa (Frost Field) - đập đất tạo vùng băng làm chậm + gây sát thương liên tục
// o: { radius, durationTicks, damage, slow: [ticks, amp] }
// ============================================================================

export function frostField(yeti, o) {
    lockCast(yeti, 30);
    playAnim(yeti, ANIM.slam);
    const dim = yeti.dimension;
    later(T.slamImpact, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, yeti.location);
        shatter(dim, center, 2.5);
        fx(dim, FX.shockwave, center, { radius: o.radius });
        telegraph(dim, center, o.radius, o.durationTicks / 20, false);
        sound(dim, 'random.glass', center, 2, 0.6);
        sound(dim, 'dig.snow', center, 2, 0.6);
        shake(dim, center, 12, 0.5, 0.4);
        let n = 0;
        const run = system.runInterval(() => {
            n++;
            try {
                for (let k = 0; k < 3; k++) {
                    const a = Math.random() * Math.PI * 2, r = Math.random() * o.radius;
                    fx(dim, FX.trail, { x: center.x + Math.cos(a) * r, y: center.y + 0.3, z: center.z + Math.sin(a) * r });
                }
                for (const p of playersNear(dim, center, o.radius)) {
                    hurt(p, o.damage, yeti);
                    effect(p, 'slowness', o.slow[0], o.slow[1]);
                }
            } catch (_) {}
            if (n * 10 >= o.durationTicks) system.clearRun(run);
        }, 10);
    });
}

// ============================================================================
// Tiếng Gầm Băng Giá (Frost Roar) - các vòng sóng lan ra theo nhịp tiếng gầm
// o: { rings, ringStep, ringDelay, damage(r) -> number, slow, fatigue?, knock? }
// ============================================================================

export function frostRoar(yeti, o) {
    lockCast(yeti, 36);
    playAnim(yeti, ANIM.roar);
    const dim = yeti.dimension;
    sound(dim, 'mob.polarbear.warning', yeti.location, 2, 0.5);
    later(T.roarPeak, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, yeti.location);
        sound(dim, 'mob.ravager.roar', center, 3, 0.7);
        sound(dim, 'mob.enderdragon.growl', center, 2, 0.6);
        shake(dim, center, o.rings * o.ringStep + 4, 0.5, 0.8);
        fx(dim, FX.snow, { x: center.x, y: center.y + 4, z: center.z }, { radius: 2 });
        for (let ring = 1; ring <= o.rings; ring++) {
            later(ring * o.ringDelay, () => {
                const r = ring * o.ringStep;
                fx(dim, FX.shockwave, center, { radius: r });
                if (ring % 2 === 1) for (const p of ringPoints(center, r, 6, ring)) fx(dim, FX.snow, p, { radius: 0.6 });
                hitBand(dim, center, r, 1, p => {
                    const dmg = o.damage ? o.damage(r) : 0;
                    if (dmg > 0) hurt(p, dmg, yeti);
                    effect(p, 'slowness', o.slow[0], o.slow[1]);
                    if (o.fatigue) effect(p, 'mining_fatigue', o.fatigue[0], o.fatigue[1]);
                    if (o.knock) knockbackFrom(center, p, o.knock[0], o.knock[1]);
                });
            });
        }
    });
}

// ============================================================================
// Cú Nhảy Nghiền Băng (Crushing Leap) - nhảy vòng cung tới mục tiêu, vòng đỏ báo điểm rơi
// o: { height, radius, maxDamage, falloff, minDamage, knock: [h, v] }
// ============================================================================

export function crushingLeap(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, T.leapLanding + 12);
    playAnim(yeti, ANIM.leap);
    const dim = yeti.dimension;
    const start = { ...yeti.location };
    const landing = groundAt(dim, target.location);
    telegraph(dim, landing, o.radius, T.leapLanding / 20, true);
    sound(dim, 'mob.polarbear.warning', start, 1.5, 0.6);

    later(T.leapTakeoff, () => {
        if (!alive(yeti)) return;
        sound(dim, 'mob.irongolem.throw', start, 2, 0.5);
        fx(dim, FX.snow, start, { radius: 1.5 });
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
            if (k % 2 === 0) fx(dim, FX.trail, pos);
        });
    }
    later(T.leapLanding, () => {
        if (!alive(yeti)) return;
        shatter(dim, landing, o.radius * 0.6);
        fx(dim, FX.shockwave, landing, { radius: o.radius + 1 });
        sound(dim, 'random.explode', landing, 2.5, 0.8);
        sound(dim, 'dig.snow', landing, 2, 0.5);
        shake(dim, landing, o.radius * 3, 0.7, 0.6);
        for (const p of playersNear(dim, landing, o.radius)) {
            const d = dist2D(p.location, landing);
            hurt(p, Math.max(o.maxDamage - Math.floor(d * o.falloff), o.minDamage), yeti);
            knockbackFrom(landing, p, o.knock[0], o.knock[1]);
        }
    });
}

// ============================================================================
// Hồi Phục Băng Giá (Ice Regeneration) - đứng co người trong lớp vỏ gai băng để hồi máu
// o: { durationTicks, heal, healEvery, pushRadius, pushPower, pushVertical, damage, damageEvery, resistance? }
// ============================================================================

export function iceRegen(yeti, o, onEnd) {
    lockCast(yeti, o.durationTicks);
    playAnim(yeti, ANIM.regen);
    const dim = yeti.dimension;
    sound(dim, 'beacon.power', yeti.location, 2, 1.3);
    fx(dim, FX.beam, yeti.location);
    if (o.resistance !== undefined) effect(yeti, 'resistance', o.durationTicks + 60, o.resistance, false);
    let t = 0;
    const run = system.runInterval(() => {
        if (!alive(yeti)) { system.clearRun(run); if (onEnd) onEnd(); return; }
        t++;
        try {
            const loc = yeti.location;
            if (t % 20 === 1) fx(dim, FX.prison, loc, { radius: 2.4, duration: 1.05 });
            if (t % 10 === 0) fx(dim, FX.heal, loc, { radius: 1.6 });
            if (t % 50 === 0 && t < o.durationTicks - 20) playAnim(yeti, ANIM.regen);
            if (t % o.healEvery === 0) {
                const h = yeti.getComponent('minecraft:health');
                if (h) h.setCurrentValue(Math.min(h.effectiveMax ?? h.defaultValue, h.currentValue + o.heal));
                sound(dim, 'random.orb', loc, 0.5, 1.5);
            }
            for (const p of playersNear(dim, loc, o.pushRadius)) {
                knockbackFrom(loc, p, o.pushPower, o.pushVertical);
                if (o.damage && t % o.damageEvery === 0) hurt(p, o.damage, yeti);
                if (t % 20 === 0) effect(p, 'slowness', 30, 1);
            }
        } catch (_) {}
        if (t >= o.durationTicks) {
            system.clearRun(run);
            shatter(dim, yeti.location, 2.5, false);
            sound(dim, 'random.glass', yeti.location, 2, 0.8);
            if (onEnd) onEnd();
        }
    }, 1);
}

// ============================================================================
// Triệu Hồi (Summon Minions / Elite Army) - giơ tay gọi bão, cổng băng xoáy rồi quái xuất hiện
// o: { points: [{x, z, d}], types: [], effects: [[name, amp]], portalTicks }
// ============================================================================

export function summonMinions(yeti, o) {
    lockCast(yeti, T.summonImpact + 16);
    playAnim(yeti, ANIM.summon);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    sound(dim, 'mob.evocation_illager.prepare_summon', origin, 2, 0.8);
    later(T.summonImpact, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, origin);
        shatter(dim, center, 2.5);
        fx(dim, FX.shockwave, center, { radius: 7 });
        shake(dim, center, 14, 0.5, 0.4);
        for (const pt of o.points) {
            later(pt.d, () => {
                const sp = groundAt(dim, { x: origin.x + pt.x, y: origin.y + 1, z: origin.z + pt.z });
                telegraph(dim, sp, 1.6, o.portalTicks / 20, false);
                fx(dim, FX.swirl, sp, { radius: 1.4 });
                if (o.portalTicks > 20) later(20, () => fx(dim, FX.swirl, sp, { radius: 1.2 }));
                later(o.portalTicks, () => {
                    shatter(dim, sp, 1.2, false);
                    sound(dim, 'mob.evocation_illager.cast_spell', sp, 1.5, 1);
                    try {
                        const type = o.types[Math.floor(Math.random() * o.types.length)];
                        const mob = dim.spawnEntity(type, sp);
                        for (const [name, amp] of o.effects) effect(mob, name, 999999, amp, false);
                    } catch (_) {}
                });
            });
        }
    });
}

// ============================================================================
// Mưa Băng Nhọn (Icicle Rain) - thay Blizzard Rain: băng nhọn rơi từ trời xuống các vòng đỏ
// o: { waves, perWave, interval, area, radius, damage, slow: [ticks, amp] }
// ============================================================================

export function icicleRain(yeti, target, o) {
    lockCast(yeti, 30);
    playAnim(yeti, ANIM.summon);
    const dim = yeti.dimension;
    sound(dim, 'ambient.weather.thunder', yeti.location, 2.5, 0.8);
    for (let w = 0; w < o.waves; w++) {
        later(T.summonImpact + w * o.interval, () => {
            if (!alive(yeti)) return;
            const center = yeti.location;
            const points = [];
            const players = playersNear(dim, center, o.area);
            for (let k = 0; k < Math.min(2, players.length); k++) {
                const pl = players[Math.floor(Math.random() * players.length)];
                points.push({ x: pl.location.x + (Math.random() - 0.5) * 2, y: pl.location.y, z: pl.location.z + (Math.random() - 0.5) * 2 });
            }
            while (points.length < o.perWave) {
                const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * (o.area - 3);
                points.push({ x: center.x + Math.cos(a) * r, y: center.y, z: center.z + Math.sin(a) * r });
            }
            for (const pt of points) {
                const ground = groundAt(dim, pt);
                telegraph(dim, ground, o.radius, 0.95, true);
                fx(dim, FX.icicle, { x: ground.x, y: ground.y + 12, z: ground.z });
                later(18, () => {
                    shatter(dim, ground, 1.2);
                    sound(dim, 'random.glass', ground, 1.2, 0.8 + Math.random() * 0.4);
                    for (const p of playersNear(dim, ground, o.radius)) {
                        hurt(p, o.damage, yeti);
                        effect(p, 'slowness', o.slow[0], o.slow[1]);
                    }
                });
            }
        });
    }
}

// ============================================================================
// Rãnh Băng (Glacier Rift) - thay Frost Spike: vết nứt chạy thẳng tới mục tiêu, cột băng hất tung
// o: { steps, spacing, stepDelay, radius, damage, launch }
// ============================================================================

export function glacierRift(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 30);
    playAnim(yeti, ANIM.slam);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    const dir = flatDir(origin, target.location);
    const points = [];
    for (let i = 1; i <= o.steps; i++) points.push(groundAt(dim, add(origin, dir, i * o.spacing)));
    points.forEach((pt, i) => telegraph(dim, pt, 1.2, (T.slamImpact + (i + 1) * o.stepDelay) / 20, false));
    const hit = new Set();
    later(T.slamImpact, () => {
        if (!alive(yeti)) return;
        sound(dim, 'random.explode', origin, 1.5, 0.7);
        shake(dim, origin, 14, 0.4, 0.5);
        points.forEach((pt, i) => {
            later((i + 1) * o.stepDelay, () => {
                fx(dim, FX.prison, pt, { radius: 0.7, duration: 0.8 });
                fx(dim, FX.crack, pt, { radius: 1.3 });
                fx(dim, FX.shards, pt, { radius: 1 });
                sound(dim, 'random.glass', pt, 1, 0.9 + i * 0.05);
                for (const p of playersNear(dim, pt, o.radius)) {
                    if (hit.has(p.id)) continue;
                    hit.add(p.id);
                    hurt(p, o.damage, yeti);
                    try { p.applyKnockback({ x: 0, z: 0 }, o.launch); } catch (_) {}
                }
            });
        });
    });
}

// ============================================================================
// Lốc Xoáy Cực Địa (Polar Vortex) - xoay người, bão tuyết xoáy hút người chơi vào tâm
// o: { durationTicks, radius, pull, damage, damageEvery, slow: [ticks, amp] }
// ============================================================================

export function polarVortex(yeti, o) {
    lockCast(yeti, 32);
    playAnim(yeti, ANIM.spin);
    const dim = yeti.dimension;
    const center = groundAt(dim, yeti.location);
    sound(dim, 'mob.wither.spawn', center, 2, 1.2);
    telegraph(dim, center, o.radius, o.durationTicks / 20, false);
    let t = 0;
    const run = system.runInterval(() => {
        t += 2;
        try {
            if (t % 20 === 2) {
                fx(dim, FX.swirl, center, { radius: o.radius * 0.85 });
                fx(dim, FX.swirl, center, { radius: o.radius * 0.45 });
            }
            for (const p of playersNear(dim, center, o.radius)) {
                const d = flatDir(p.location, center);
                try { p.applyKnockback({ x: d.x * o.pull, z: d.z * o.pull }, 0); } catch (_) {}
                if (t % o.damageEvery === 0) {
                    hurt(p, o.damage, yeti);
                    effect(p, 'slowness', o.slow[0], o.slow[1]);
                    fx(dim, FX.shards, p.location, { radius: 0.5 });
                }
            }
        } catch (_) {}
        if (t >= o.durationTicks) system.clearRun(run);
    }, 2);
}

// ============================================================================
// Sóng Băng Hà (Glacial Wave) - đập đất, các vòng sóng băng lan xa đẩy lùi
// o: { rings, ringStep, ringDelay, damage, knock: [h, v] }
// ============================================================================

export function glacialWave(yeti, o) {
    lockCast(yeti, 30);
    playAnim(yeti, ANIM.slam);
    const dim = yeti.dimension;
    later(T.slamImpact, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, yeti.location);
        shatter(dim, center, 2.5);
        sound(dim, 'random.explode', center, 2.5, 0.8);
        shake(dim, center, o.rings * o.ringStep, 0.5, 0.6);
        for (let w = 1; w <= o.rings; w++) {
            later(w * o.ringDelay, () => {
                const r = w * o.ringStep;
                fx(dim, FX.shockwave, center, { radius: r });
                if (w % 2 === 0) for (const p of ringPoints(center, r, 8, w)) fx(dim, FX.snow, p, { radius: 0.8 });
                hitBand(dim, center, r, 1, p => {
                    hurt(p, o.damage, yeti);
                    knockbackFrom(center, p, o.knock[0], o.knock[1]);
                });
            });
        }
    });
}

// ============================================================================
// Độ Không Tuyệt Đối (Absolute Zero) - chiêu tuyệt vọng khi sắp chết: đóng băng cả vùng lớn
// o: { durationTicks, every, radius, damage, damageEveryN, slow: [ticks, amp], weak: [ticks, amp] }
// ============================================================================

export function absoluteZero(yeti, o) {
    lockCast(yeti, 36);
    playAnim(yeti, ANIM.cast);
    const dim = yeti.dimension;
    const center = groundAt(dim, yeti.location);
    sound(dim, 'beacon.power', center, 3, 0.45);
    later(T.castRelease, () => {
        fx(dim, FX.beam, center);
        fx(dim, FX.shockwave, center, { radius: o.radius });
        telegraph(dim, center, o.radius, o.durationTicks / 20, true);
        shake(dim, center, o.radius, 0.6, 1.2);
        let n = 0;
        const run = system.runInterval(() => {
            n++;
            try {
                if ((n * o.every) % 20 < o.every) {
                    fx(dim, FX.swirl, center, { radius: o.radius * 0.6 });
                    fx(dim, FX.aura, center, { radius: 3 });
                }
                for (const p of playersNear(dim, center, o.radius)) {
                    effect(p, 'slowness', o.slow[0], o.slow[1]);
                    effect(p, 'weakness', o.weak[0], o.weak[1]);
                    if (n % o.damageEveryN === 0) {
                        hurt(p, o.damage, yeti);
                        fx(dim, FX.shards, p.location, { radius: 0.6 });
                    }
                }
            } catch (_) {}
            if (n * o.every >= o.durationTicks) system.clearRun(run);
        }, o.every);
    });
}

// ============================================================================
// Động Đất Băng (Earthquake) - nhảy tại chỗ rồi dậm xuống, các vòng nứt lan rất xa
// o: { height, rings, ringStep, ringDelay, damage, slow: [ticks, amp], knock: [h, v] }
// ============================================================================

export function earthquake(yeti, o) {
    lockCast(yeti, T.leapLanding + 12);
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
        shatter(dim, center, 3.5);
        sound(dim, 'random.explode', center, 3, 0.5);
        sound(dim, 'ambient.weather.thunder', center, 2, 0.7);
        shake(dim, center, o.rings * o.ringStep + 6, 0.8, 1.2);
        for (let w = 1; w <= o.rings; w++) {
            later(w * o.ringDelay, () => {
                const r = w * o.ringStep;
                fx(dim, FX.shockwave, center, { radius: r });
                for (const p of ringPoints(center, r, 6, w * 0.7)) fx(dim, FX.crack, groundAt(dim, p), { radius: 1.6 });
                if (w % 2 === 0) sound(dim, 'dig.stone', center, 2, 0.7);
                hitBand(dim, center, r, 1, p => {
                    hurt(p, o.damage, yeti);
                    effect(p, 'slowness', o.slow[0], o.slow[1]);
                    knockbackFrom(center, p, o.knock[0], o.knock[1]);
                });
            });
        }
    });
}

// ============================================================================
// Xiềng Băng (Ice Chains) - xích băng trói mục tiêu, hết thời gian thì giật mạnh về phía Yeti
// o: { bindTicks, slow, weak, damage, damageEvery, pullDamage, pullPower, range }
// ============================================================================

export function iceChains(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 36);
    playAnim(yeti, ANIM.cast);
    const dim = yeti.dimension;
    sound(dim, 'mob.irongolem.hit', yeti.location, 2, 0.6);
    later(T.castRelease, () => {
        if (!alive(yeti) || !alive(target) || dist2D(yeti.location, target.location) > o.range) return;
        effect(target, 'slowness', o.bindTicks, o.slow);
        effect(target, 'weakness', o.bindTicks, o.weak);
        fx(dim, FX.prison, target.location, { radius: 0.9, duration: o.bindTicks / 20 });
        sound(dim, 'random.anvil_land', target.location, 0.8, 1.6);
        let t = 0;
        const run = system.runInterval(() => {
            t += 2;
            if (!alive(target) || !alive(yeti)) { system.clearRun(run); return; }
            try {
                const a = { x: yeti.location.x, y: yeti.location.y + 3.5, z: yeti.location.z };
                const b = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
                const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
                const n = Math.min(24, Math.ceil(len / 1.2));
                for (let i = 0; i <= n; i += (t % 4 === 0 ? 1 : 2)) {
                    const s = i / n;
                    fx(dim, FX.trail, { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, z: a.z + (b.z - a.z) * s });
                }
                if (t % o.damageEvery === 0) hurt(target, o.damage, yeti);
            } catch (_) {}
            if (t >= o.bindTicks) {
                system.clearRun(run);
                try {
                    const d = flatDir(target.location, yeti.location);
                    target.applyKnockback({ x: d.x * o.pullPower, z: d.z * o.pullPower }, 0.35);
                    hurt(target, o.pullDamage, yeti);
                    shatter(dim, target.location, 1.2, false);
                    sound(dim, 'random.glass', target.location, 1.5, 0.6);
                } catch (_) {}
            }
        }, 2);
    });
}

// ============================================================================
// Mưa Tảng Băng (Boulder Barrage) - thay Crystal Barrage: ném liên tiếp nhiều tảng băng
// o: { count, interval, area, damage, radius, flightTicks, slow }
// ============================================================================

export function boulderBarrage(yeti, o) {
    lockCast(yeti, o.count * o.interval + 16);
    const dim = yeti.dimension;
    for (let i = 0; i < o.count; i++) {
        later(i * o.interval, () => {
            if (!alive(yeti)) return;
            const players = playersNear(dim, yeti.location, o.area);
            let aim;
            if (players.length > 0) {
                const pl = players[i % players.length];
                aim = groundAt(dim, { x: pl.location.x + (Math.random() - 0.5) * 3, y: pl.location.y, z: pl.location.z + (Math.random() - 0.5) * 3 });
                faceTarget(yeti, pl);
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
// Bùng Nổ Băng (Frost Nova) - gầm lên, cột sáng băng + các vòng nổ lan ra
// o: { from, to, step, ringDelay, damage, knock: [h, v] }
// ============================================================================

export function frostNova(yeti, o) {
    lockCast(yeti, 36);
    playAnim(yeti, ANIM.roar);
    const dim = yeti.dimension;
    later(T.roarPeak, () => {
        if (!alive(yeti)) return;
        const center = groundAt(dim, yeti.location);
        fx(dim, FX.beam, center);
        shatter(dim, center, 3);
        sound(dim, 'random.explode', center, 3, 0.7);
        sound(dim, 'mob.ravager.roar', center, 2.5, 0.9);
        shake(dim, center, o.to + 4, 0.6, 0.6);
        for (let r = o.from; r <= o.to; r += o.step) {
            later((r / o.step) * o.ringDelay, () => {
                fx(dim, FX.shockwave, center, { radius: r });
                hitBand(dim, center, r, 1, p => {
                    hurt(p, o.damage, yeti);
                    knockbackFrom(center, p, o.knock[0], o.knock[1]);
                });
            });
        }
    });
}

// ============================================================================
// Giáp Băng (Frost Armor) - đấm ngực, lớp gai băng bao quanh, phản sát thương (xử lý ở phase3)
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
                fx(dim, FX.aura, loc, { radius: 2.6 });
            }
            for (const p of playersNear(dim, loc, 4)) effect(p, 'slowness', 60, 1);
        } catch (_) {}
        if (t >= o.durationTicks) {
            system.clearRun(run);
            armorActive.delete(id);
            shatter(dim, yeti.location, 2.5, false);
            sound(dim, 'random.glass', yeti.location, 1.5, 1);
        }
    }, 10);
}

// ============================================================================
// Vuốt Băng Kép (Frost Claws) - MỚI: 2 cú vuốt hình nón phía trước ở tầm gần
// o: { range, halfAngle, damage, slow: [ticks, amp], knock: [h, v] }
// ============================================================================

export function frostClaws(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 26, false);
    playAnim(yeti, ANIM.swipe);
    const dim = yeti.dimension;
    for (const [tick, side, last] of [[T.swipeHit1, 1, false], [T.swipeHit2, -1, true]]) {
        later(tick, () => {
            if (!alive(yeti)) return;
            const origin = yeti.location;
            const dir = alive(target) ? flatDir(origin, target.location) : flatDir(origin, add(origin, { x: 0, z: 1 }));
            const r = rightOf(dir);
            fx(dim, FX.claw, { x: origin.x + dir.x * 2.6 + r.x * side * 0.6, y: origin.y + 2.4, z: origin.z + dir.z * 2.6 + r.z * side * 0.6 }, { radius: 2.2 });
            sound(dim, 'game.player.attack.strong', origin, 1.5, 0.6);
            sound(dim, 'random.glass', origin, 0.7, 1.7);
            for (const p of playersNear(dim, origin, o.range)) {
                if (!inCone(origin, dir, p.location, o.range, o.halfAngle)) continue;
                hurt(p, o.damage, yeti);
                effect(p, 'slowness', o.slow[0], o.slow[1]);
                fx(dim, FX.shards, p.location, { radius: 0.5 });
                if (last) knockbackFrom(origin, p, o.knock[0], o.knock[1]);
            }
        });
    }
}

// ============================================================================
// Hơi Thở Băng Giá (Frost Breath) - MỚI: hít vào rồi phun luồng băng hình nón, quét trái → phải
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
    lockCast(yeti, 52);
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
            if (tick % 6 === 1) {
                sound(dim, 'random.fizz', mouth, 1, 0.6);
                fx(dim, FX.snow, groundAt(dim, add(origin, dir, o.range * 0.8)), { radius: 1 });
            }
            if ((tick - T.breathStart) % o.hitEvery !== 0) return;
            for (const p of playersNear(dim, origin, o.range)) {
                if (!inCone(origin, dir, p.location, o.range, o.halfAngle)) continue;
                hurt(p, o.damage, yeti);
                effect(p, 'slowness', o.slow[0], o.slow[1]);
                const n = (hits.get(p.id) ?? 0) + 1;
                hits.set(p.id, n);
                if (n === o.freezeHits) {
                    effect(p, 'slowness', o.freezeTicks, 6);
                    effect(p, 'mining_fatigue', o.freezeTicks, 2);
                    fx(dim, FX.prison, p.location, { radius: 0.8, duration: o.freezeTicks / 20 });
                    sound(dim, 'random.glass', p.location, 1.5, 0.5);
                }
            }
        });
    }
}

// ============================================================================
// Ngục Băng (Ice Prison) - MỚI: vòng đỏ dưới chân mục tiêu, không kịp chạy ra thì bị nhốt trong
// cột băng (đứng yên) rồi băng vỡ gây sát thương
// o: { delay, durationTicks, damage, radius }
// ============================================================================

export function icePrison(yeti, target, o, prisonActive) {
    faceTarget(yeti, target);
    lockCast(yeti, 30);
    playAnim(yeti, ANIM.cast);
    const dim = yeti.dimension;
    const center = groundAt(dim, target.location);
    const trigger = T.castRelease + o.delay;
    telegraph(dim, center, o.radius, trigger / 20, true);
    sound(dim, 'mob.evocation_illager.prepare_attack', yeti.location, 1.5, 0.7);
    later(trigger, () => {
        fx(dim, FX.prison, center, { radius: o.radius * 0.8, duration: 0.6 });
        sound(dim, 'random.glass', center, 1.5, 0.5);
        if (!alive(target) || dist2D(target.location, center) > o.radius + 0.3 || prisonActive.has(target.id)) return;
        prisonActive.set(target.id, true);
        fx(dim, FX.prison, center, { radius: 0.9, duration: o.durationTicks / 20 });
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
                shatter(dim, center, 1.6);
                sound(dim, 'random.glass', center, 2, 0.6);
                hurt(target, o.damage, yeti);
            }
        }, 2);
    });
}

// ============================================================================
// Cuồng Nộ (Enrage) - MỚI: một lần duy nhất khi máu thấp: đấm ngực, cột sáng, tăng tốc + sức mạnh
// o: { speed, strength, name }
// ============================================================================

export function enrage(yeti, o) {
    lockCast(yeti, 40);
    playAnim(yeti, ANIM.chestBeat);
    const dim = yeti.dimension;
    const loc = yeti.location;
    fx(dim, FX.beam, loc);
    shatter(dim, loc, 3);
    fx(dim, FX.shockwave, loc, { radius: 10 });
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
    lockCast(yeti, 60);
    const dim = yeti.dimension;
    const loc = yeti.location;
    later(2, () => { if (alive(yeti)) playAnim(yeti, ANIM.phaseIntro, 0.3); });
    fx(dim, FX.beam, loc);
    shatter(dim, loc, 3.5);
    fx(dim, FX.shockwave, loc, { radius: 9 });
    sound(dim, 'ambient.weather.thunder', loc, 2, 0.8);
    later(46, () => {
        if (!alive(yeti)) return;
        sound(dim, 'mob.ravager.roar', yeti.location, 3, 0.6);
        fx(dim, FX.shockwave, groundAt(dim, yeti.location), { radius: 12 });
        shake(dim, yeti.location, 30, 0.6, 1);
    });
    for (const p of playersNear(dim, loc, 64)) {
        try {
            p.onScreenDisplay.setTitle(info.title, { subtitle: info.subtitle, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 });
        } catch (_) {}
    }
}
