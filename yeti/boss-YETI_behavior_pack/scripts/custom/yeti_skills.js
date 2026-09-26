// File: scripts/custom/yeti_skills.js
// Bộ skill mới của Yeti (v1.5), lấy ý tưởng từ boss của game / addon / modpack khác rồi biến tấu
// theo phong cách băng tuyết:
//   Nanh Băng        <- Evoker (hàm răng mọc từ đất)
//   Cầu Gió Tuyết    <- Breeze (wind charge hất văng)
//   Gầm Xuyên Băng   <- Warden (sonic boom xuyên mọi thứ)
//   Tung Hất         <- Iron Golem (hất tung lên trời)
//   Lao Xuống        <- Ender Dragon (bổ nhào)
//   Loạt Băng Nhọn   <- Blaze (bắn 3 quả liên tiếp)
//   Đầu Lâu Băng     <- Wither (đầu lâu đuổi theo mục tiêu)
//   Vũng Hơi Băng    <- Ender Dragon (dragon breath đọng lại)
//   Linh Hồn Băng    <- Vex (linh hồn bay vòng rồi lao vào)
//   Tia Băng Khóa    <- Elder Guardian (tia laser khóa mục tiêu)
//   Bão Trắng        <- Warden darkness (xung mù)
//   Tuyết Lở         <- tự chế: tảng tuyết lăn theo làn, chừa 1 làn an toàn
// Mọi skill đánh người chơi và mob mà boss đang nhắm (yeti_fx.enemiesNear).

import { system } from '@minecraft/server';
import {
    ANIM, ANIM_TIMING as T, FX, fx, sound, playAnim, groundAt, telegraph, impact, iceSpike, spikeRing,
    flatDir, rightOf, dist2D, enemiesNear, playersNear, hurt, effect, knockbackFrom, shake, lockCast,
    safeTeleport, later, alive
} from './yeti_fx';

function add(a, d, k = 1) {
    return { x: a.x + d.x * k, y: a.y + (d.y ?? 0) * k, z: a.z + d.z * k };
}

export function faceTarget(yeti, target) {
    if (!alive(target)) return;
    safeTeleport(yeti, yeti.location, { facingLocation: { x: target.location.x, y: yeti.location.y + 2, z: target.location.z } });
}

function chest(e) {
    return { x: e.location.x, y: e.location.y + 1, z: e.location.z };
}

// Đạn particle: bay thẳng hoặc đuổi theo mục tiêu, nổ khi chạm đối thủ / hết thời gian
function projectile(yeti, from, target, o) {
    const dim = yeti.dimension;
    let pos = { ...from };
    let aim = alive(target) ? chest(target) : add(from, { x: 0, y: 0, z: 1 }, 10);
    let vel = (() => { const dx = aim.x - pos.x, dy = aim.y - pos.y, dz = aim.z - pos.z, l = Math.hypot(dx, dy, dz) || 1; return { x: dx / l, y: dy / l, z: dz / l }; })();
    let t = 0;
    const run = system.runInterval(() => {
        t++;
        if (o.homing && alive(target)) {
            aim = chest(target);
            const dx = aim.x - pos.x, dy = aim.y - pos.y, dz = aim.z - pos.z, l = Math.hypot(dx, dy, dz) || 1;
            vel = { x: vel.x + (dx / l - vel.x) * o.homing, y: vel.y + (dy / l - vel.y) * o.homing, z: vel.z + (dz / l - vel.z) * o.homing };
            const n = Math.hypot(vel.x, vel.y, vel.z) || 1;
            vel = { x: vel.x / n, y: vel.y / n, z: vel.z / n };
        }
        for (const sub of [0.5, 1]) {
            const p = add(pos, vel, o.speed * sub);
            fx(dim, o.head, p);
            if (sub === 1 && o.trail) fx(dim, o.trail, p);
        }
        pos = add(pos, vel, o.speed);
        const hit = enemiesNear(dim, pos, o.hitRadius ?? 1.3, yeti)[0];
        let blocked = false;
        try { const b = dim.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) }); blocked = !!b && !b.isAir && !b.isLiquid; } catch (_) {}
        if (hit || blocked || t >= (o.maxTicks ?? 40)) {
            system.clearRun(run);
            o.onHit(pos, hit);
        }
    }, 1);
}

// ============================================================================
// Nanh Băng (Evoker fangs) - hàng nanh băng mọc từ đất về phía mục tiêu; nếu mục tiêu sát bên thì
// mọc 2 vòng nanh quanh người Yeti
// o: { damage, count }
// ============================================================================
export function frostFangs(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 30);
    playAnim(yeti, ANIM.groundPunch);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    const close = dist2D(origin, target.location) < 5;
    const points = [];
    if (close) {
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; points.push({ loc: { x: origin.x + Math.cos(a) * 2.6, y: origin.y + 1, z: origin.z + Math.sin(a) * 2.6 }, delay: 0 }); }
        for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2; points.push({ loc: { x: origin.x + Math.cos(a) * 4.4, y: origin.y + 1, z: origin.z + Math.sin(a) * 4.4 }, delay: 5 }); }
    } else {
        const dir = flatDir(origin, target.location);
        for (let i = 0; i < o.count; i++) points.push({ loc: add({ ...origin, y: origin.y + 1 }, dir, 2.5 + i * 1.3), delay: i * 2 });
    }
    for (const p of points) { p.loc = groundAt(dim, p.loc); telegraph(dim, p.loc, 0.9, (T.punchImpact + p.delay) / 20, false); }
    sound(dim, 'mob.evocation_illager.prepare_attack', origin, 1.5, 0.6);
    const hit = new Set();
    later(T.punchImpact, () => {
        if (!alive(yeti)) return;
        impact(dim, add(origin, flatDir(origin, target.location), 2), 1.4);
        for (const p of points) later(p.delay, () => {
            iceSpike(dim, p.loc, 1.1, 0.9);
            sound(dim, 'mob.evocation_fangs.attack', p.loc, 0.8, 0.7);
            for (const e of enemiesNear(dim, p.loc, 1.2, yeti)) {
                if (hit.has(e.id)) continue;
                hit.add(e.id);
                hurt(e, o.damage, yeti);
                effect(e, 'slowness', 50, 2);
            }
        });
    });
}

// ============================================================================
// Cầu Gió Tuyết (Breeze wind charge) - ném quả cầu gió tuyết, nổ hất văng mọi thứ xung quanh
// o: { damage, radius, power }
// ============================================================================
export function galeBall(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 28);
    playAnim(yeti, ANIM.throw);
    const dim = yeti.dimension;
    sound(dim, 'mob.breeze.charge', yeti.location, 1.5, 0.7);
    later(T.throwRelease, () => {
        if (!alive(yeti)) return;
        const from = add(yeti.location, { ...flatDir(yeti.location, target.location), y: 0 }, 1.5);
        from.y += 4.5;
        sound(dim, 'mob.breeze.shoot', from, 1.5, 0.6);
        projectile(yeti, from, target, {
            speed: 1.3, head: FX.boulder, trail: FX.snow, maxTicks: 30, onHit: pos => {
                impact(dim, pos, 2);
                fx(dim, FX.tornado, groundAt(dim, pos), { radius: 1.5 });
                sound(dim, 'mob.breeze.wind_burst', pos, 2, 0.7);
                for (const e of enemiesNear(dim, pos, o.radius, yeti)) {
                    hurt(e, o.damage, yeti);
                    knockbackFrom(pos, e, o.power, 0.9);
                }
            }
        });
    });
}

// ============================================================================
// Gầm Xuyên Băng (Warden sonic boom) - tụ băng ở miệng 1 giây rồi gầm một luồng sóng thẳng,
// xuyên qua mọi thứ trên đường
// o: { damage, range }
// ============================================================================
export function sonicHowl(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 40);
    playAnim(yeti, ANIM.roar);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    const dir = flatDir(origin, target.location);
    sound(dim, 'mob.warden.sonic_charge', origin, 2, 0.7);
    for (let d = 2; d <= o.range; d += 2) telegraph(dim, add(origin, dir, d), 1.3, (T.roarPeak + 4) / 20, true);
    later(T.roarPeak + 4, () => {
        if (!alive(yeti)) return;
        sound(dim, 'mob.warden.sonic_boom', origin, 3, 0.8);
        shake(dim, origin, o.range, 0.6, 0.5);
        const hit = new Set();
        for (let d = 2; d <= o.range; d += 1.5) {
            later(d / 3, () => {
                const p = add({ ...origin, y: origin.y + 3 }, dir, d);
                fx(dim, FX.flash, p, { radius: 1.2 });
                fx(dim, FX.shockwave, groundAt(dim, p), { radius: 1.6 });
                for (const e of enemiesNear(dim, p, 2, yeti)) {
                    if (hit.has(e.id)) continue;
                    hit.add(e.id);
                    hurt(e, o.damage, yeti);
                    try { e.applyKnockback({ x: dir.x * 2.2, z: dir.z * 2.2 }, 0.5); } catch (_) {}
                }
            });
        }
    });
}

// ============================================================================
// Tung Hất (Iron Golem) - vả mạnh ở tầm gần, mục tiêu bị hất thẳng lên trời
// o: { damage, launch }
// ============================================================================
export function golemToss(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 20, false);
    playAnim(yeti, ANIM.swipe);
    const dim = yeti.dimension;
    later(T.swipeHit1, () => {
        if (!alive(yeti)) return;
        const at = add(yeti.location, flatDir(yeti.location, target.location), 2.4);
        fx(dim, FX.claw, { ...at, y: at.y + 2 }, { radius: 2.2 });
        sound(dim, 'mob.irongolem.throw', at, 1.5, 0.7);
        for (const e of enemiesNear(dim, at, 3, yeti)) {
            hurt(e, o.damage, yeti);
            try { e.applyKnockback({ x: 0, z: 0 }, o.launch); } catch (_) {}
            fx(dim, FX.snow, e.location, { radius: 1 });
        }
    });
}

// ============================================================================
// Lao Xuống (Ender Dragon dive) - nhảy vọt lên cao rồi bổ nhào xuống vị trí mục tiêu
// o: { damage, radius, height }
// ============================================================================
export function glacierDive(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, T.leapLanding + 14);
    playAnim(yeti, ANIM.leap);
    const dim = yeti.dimension;
    const start = { ...yeti.location };
    const land = groundAt(dim, target.location);
    telegraph(dim, land, o.radius, T.leapLanding / 20, true);
    const air = T.leapLanding - T.leapTakeoff;
    for (let k = 1; k <= air; k++) {
        later(T.leapTakeoff + k, () => {
            if (!alive(yeti)) return;
            const s = k / air;
            const pos = { x: start.x + (land.x - start.x) * s, y: start.y + (land.y - start.y) * s + Math.sin(Math.PI * s) * o.height, z: start.z + (land.z - start.z) * s };
            safeTeleport(yeti, pos, { facingLocation: { x: land.x, y: pos.y, z: land.z }, keepVelocity: false });
            fx(dim, FX.trail, pos);
        });
    }
    later(T.leapLanding, () => {
        if (!alive(yeti)) return;
        impact(dim, land, 3);
        spikeRing(dim, land, o.radius * 0.8, 8, 1.1, 1.3);
        sound(dim, 'random.explode', land, 2.5, 0.8);
        shake(dim, land, 20, 0.7, 0.6);
        for (const e of enemiesNear(dim, land, o.radius, yeti)) {
            hurt(e, o.damage, yeti);
            knockbackFrom(land, e, 2, 0.6);
        }
    });
}

// ============================================================================
// Loạt Băng Nhọn (Blaze) - bắn liên tiếp 3 mũi băng thẳng vào mục tiêu
// o: { damage, shots }
// ============================================================================
export function icicleVolley(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 12 + o.shots * 8);
    const dim = yeti.dimension;
    for (let i = 0; i < o.shots; i++) {
        later(i * 8, () => {
            if (!alive(yeti)) return;
            faceTarget(yeti, target);
            playAnim(yeti, ANIM.throw, 0.1);
            later(T.throwRelease - 4, () => {
                if (!alive(yeti)) return;
                const from = { ...yeti.location, y: yeti.location.y + 4.5 };
                sound(dim, 'mob.blaze.shoot', from, 1.2, 1.4);
                projectile(yeti, from, target, {
                    speed: 1.8, head: FX.shards, trail: FX.trail, maxTicks: 25, onHit: (pos, e) => {
                        impact(dim, pos, 1);
                        if (e) { hurt(e, o.damage, yeti); effect(e, 'slowness', 40, 1); }
                    }
                });
            });
        });
    }
}

// ============================================================================
// Đầu Lâu Băng (Wither skull) - 3 đầu lâu băng phát sáng đuổi theo mục tiêu
// o: { damage, count }
// ============================================================================
export function frostSkulls(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 36);
    playAnim(yeti, ANIM.cast);
    const dim = yeti.dimension;
    sound(dim, 'mob.wither.ambient', yeti.location, 1.5, 1.3);
    for (let i = 0; i < o.count; i++) {
        later(T.castRelease + i * 6, () => {
            if (!alive(yeti)) return;
            const side = rightOf(flatDir(yeti.location, target.location));
            const from = add({ ...yeti.location, y: yeti.location.y + 4 + i * 0.5 }, side, (i - 1) * 1.5);
            sound(dim, 'mob.wither.shoot', from, 1.2, 1.2);
            projectile(yeti, from, target, {
                speed: 0.8, homing: 0.12, head: FX.comet, trail: FX.snow, maxTicks: 70, onHit: pos => {
                    impact(dim, pos, 1.6);
                    sound(dim, 'random.explode', pos, 1, 1.3);
                    for (const e of enemiesNear(dim, pos, 2.5, yeti)) {
                        hurt(e, o.damage, yeti);
                        effect(e, 'weakness', 80, 1);
                        effect(e, 'slowness', 60, 2);
                    }
                }
            });
        });
    }
}

// ============================================================================
// Vũng Hơi Băng (Dragon breath) - phun 1 quả cầu hơi băng, nổ thành vũng sương đọng lại gây sát
// thương liên tục
// o: { damage, radius, seconds }
// ============================================================================
export function frostPool(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 30);
    playAnim(yeti, ANIM.breath);
    const dim = yeti.dimension;
    const aim = groundAt(dim, target.location);
    telegraph(dim, aim, o.radius, 1.2, true);
    later(T.breathStart, () => {
        if (!alive(yeti)) return;
        sound(dim, 'mob.enderdragon.growl', yeti.location, 2, 1.2);
        const from = { ...yeti.location, y: yeti.location.y + 4.2 };
        projectile(yeti, from, { location: aim, isValid: true }, {
            speed: 1.1, head: FX.flash, trail: FX.snow, maxTicks: 30, hitRadius: 0.8, onHit: () => {
                impact(dim, aim, 2);
                fx(dim, FX.rune, aim, { radius: o.radius, duration: o.seconds });
                let n = 0;
                const run = system.runInterval(() => {
                    n++;
                    fx(dim, FX.mist, aim, { radius: o.radius * 0.4 });
                    fx(dim, FX.snowfall, aim, { radius: o.radius });
                    for (const e of enemiesNear(dim, aim, o.radius, yeti)) { hurt(e, o.damage, yeti); effect(e, 'slowness', 30, 2); }
                    if (n * 10 >= o.seconds * 20) system.clearRun(run);
                }, 10);
            }
        });
    });
}

// ============================================================================
// Linh Hồn Băng (Vex) - gọi các linh hồn băng bay vòng quanh Yeti rồi lần lượt lao vào đối thủ
// o: { damage, count }
// ============================================================================
export function frostWisps(yeti, o) {
    lockCast(yeti, 40);
    playAnim(yeti, ANIM.summon);
    const dim = yeti.dimension;
    sound(dim, 'mob.evocation_illager.prepare_summon', yeti.location, 1.5, 1.2);
    let t = 0;
    const run = system.runInterval(() => {
        t += 2;
        if (!alive(yeti)) { system.clearRun(run); return; }
        for (let i = 0; i < o.count; i++) {
            const a = t * 0.15 + i / o.count * Math.PI * 2;
            const p = { x: yeti.location.x + Math.cos(a) * 3, y: yeti.location.y + 4 + Math.sin(t * 0.2 + i) * 0.5, z: yeti.location.z + Math.sin(a) * 3 };
            fx(dim, FX.spark, p);
        }
        if (t >= 30) system.clearRun(run);
    }, 2);
    for (let i = 0; i < o.count; i++) {
        later(32 + i * 5, () => {
            if (!alive(yeti)) return;
            const foes = enemiesNear(dim, yeti.location, 24, yeti);
            if (!foes.length) return;
            const tgt = foes[i % foes.length];
            const a = 32 * 0.15 + i / o.count * Math.PI * 2;
            const from = { x: yeti.location.x + Math.cos(a) * 3, y: yeti.location.y + 4, z: yeti.location.z + Math.sin(a) * 3 };
            sound(dim, 'mob.vex.charge', from, 1, 1.3);
            projectile(yeti, from, tgt, {
                speed: 1.2, homing: 0.25, head: FX.spark, trail: FX.trail, maxTicks: 50, onHit: (pos, e) => {
                    impact(dim, pos, 0.8, { crack: false });
                    if (e) hurt(e, o.damage, yeti);
                }
            });
        });
    }
}

// ============================================================================
// Tia Băng Khóa (Elder Guardian) - tia băng mảnh khóa vào mục tiêu 2 giây, dày dần rồi bùng nổ
// o: { damage, range }
// ============================================================================
export function guardianBeam(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 56);
    playAnim(yeti, ANIM.cast);
    const dim = yeti.dimension;
    sound(dim, 'mob.guardian.attack_loop', yeti.location, 2, 0.6);
    let t = 0;
    const run = system.runInterval(() => {
        t += 2;
        if (!alive(yeti) || !alive(target) || dist2D(yeti.location, target.location) > o.range) { system.clearRun(run); return; }
        safeTeleport(yeti, yeti.location, { facingLocation: target.location });
        const a = { x: yeti.location.x, y: yeti.location.y + 4.2, z: yeti.location.z };
        const b = chest(target);
        const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        const step = t < 30 ? 1.2 : 0.5;
        for (let s = 0; s <= len; s += step) {
            const k = s / len;
            fx(dim, t < 30 ? FX.trail : FX.spark, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
        }
        if (t >= 44) {
            system.clearRun(run);
            impact(dim, target.location, 2);
            sound(dim, 'mob.elderguardian.curse', target.location, 1.5, 1.2);
            hurt(target, o.damage, yeti);
            effect(target, 'mining_fatigue', 200, 2);
            effect(target, 'slowness', 60, 3);
        }
    }, 2);
}

// ============================================================================
// Bão Trắng (Warden darkness) - hú lên, 3 xung bão tuyết làm mù và làm chậm
// o: { damage, radius }
// ============================================================================
export function whiteout(yeti, o) {
    lockCast(yeti, 44);
    playAnim(yeti, ANIM.howl);
    const dim = yeti.dimension;
    const c = groundAt(dim, yeti.location);
    sound(dim, 'mob.warden.roar', c, 2, 0.8);
    for (let i = 0; i < 3; i++) {
        later(T.howlPeak + i * 10, () => {
            fx(dim, FX.shockwave, c, { radius: o.radius });
            fx(dim, FX.mist, c, { radius: o.radius * 0.5 });
            fx(dim, FX.swirl, c, { radius: o.radius * 0.7 });
            for (const e of enemiesNear(dim, c, o.radius, yeti)) {
                effect(e, 'blindness', 60, 0, false);
                effect(e, 'slowness', 60, 2);
                hurt(e, o.damage, yeti);
            }
        });
    }
}

// ============================================================================
// Tuyết Lở (tự chế) - các tảng tuyết lăn theo từng làn song song, chừa 1 làn an toàn
// o: { damage, lanes, length }
// ============================================================================
export function avalanche(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 44);
    playAnim(yeti, ANIM.summon);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    const dir = flatDir(origin, target.location);
    const side = rightOf(dir);
    const safe = Math.floor(Math.random() * o.lanes);
    sound(dim, 'ambient.weather.thunder', origin, 2, 0.6);
    for (let l = 0; l < o.lanes; l++) {
        if (l === safe) continue;
        const off = (l - (o.lanes - 1) / 2) * 3;
        const start = add(add(origin, side, off), dir, -4);
        for (let d = 0; d < o.length; d += 3) telegraph(dim, add(start, dir, d), 1.2, (T.summonImpact + d / 1.2) / 20, true);
        later(T.summonImpact, () => {
            let d = 0;
            const hit = new Set();
            const run = system.runInterval(() => {
                d += 1.2;
                const p = add(start, dir, d);
                const g = groundAt(dim, { ...p, y: origin.y + 2 });
                fx(dim, FX.boulder, { ...g, y: g.y + 0.8 });
                fx(dim, FX.snow, g, { radius: 0.8 });
                for (const e of enemiesNear(dim, g, 1.6, yeti)) {
                    if (hit.has(e.id)) continue;
                    hit.add(e.id);
                    hurt(e, o.damage, yeti);
                    try { e.applyKnockback({ x: dir.x * 1.5, z: dir.z * 1.5 }, 0.5); } catch (_) {}
                }
                if (d >= o.length) { system.clearRun(run); impact(dim, g, 1.5); }
            }, 1);
        });
    }
    later(T.summonImpact, () => shake(dim, origin, 30, 0.6, 1.5));
}

// ============================================================================
// Cuồng Nộ - 1 lần khi máu thấp
// ============================================================================
export function enrage(yeti, o) {
    lockCast(yeti, 42);
    playAnim(yeti, ANIM.chestBeat);
    const dim = yeti.dimension;
    const loc = yeti.location;
    fx(dim, FX.beam, loc);
    impact(dim, loc, 3.5);
    sound(dim, 'mob.ravager.roar', loc, 3, 0.5);
    shake(dim, loc, 24, 0.7, 1.5);
    effect(yeti, 'speed', 999999, o.speed, false);
    effect(yeti, 'strength', 999999, o.strength, false);
    for (const p of playersNear(dim, loc, 48)) {
        try { p.onScreenDisplay.setTitle('§c§lCUỒNG NỘ', { subtitle: `${o.name} §7nổi điên!`, fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 15 }); } catch (_) {}
    }
}

// ============================================================================
// Xuất hiện pha mới
// ============================================================================
export function phaseIntro(yeti, info) {
    lockCast(yeti, 62);
    const dim = yeti.dimension;
    const loc = yeti.location;
    later(2, () => { if (alive(yeti)) playAnim(yeti, ANIM.phaseIntro, 0.3); });
    fx(dim, FX.beam, loc);
    impact(dim, loc, 3.5);
    fx(dim, FX.rune, groundAt(dim, loc), { radius: 6, duration: 3 });
    sound(dim, 'ambient.weather.thunder', loc, 2, 0.8);
    later(46, () => { if (alive(yeti)) { sound(dim, 'mob.ravager.roar', yeti.location, 3, 0.6); shake(dim, yeti.location, 30, 0.6, 1); } });
    for (const p of playersNear(dim, loc, 64)) {
        try { p.onScreenDisplay.setTitle(info.title, { subtitle: info.subtitle, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 }); } catch (_) {}
    }
}
