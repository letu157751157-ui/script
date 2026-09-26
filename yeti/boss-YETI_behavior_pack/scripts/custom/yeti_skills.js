// File: scripts/custom/yeti_skills.js
// Bộ skill Yeti v1.6 - lấy ý tưởng từ boss của mod / modpack / game khác (không dùng boss Minecraft gốc)
// rồi biến tấu theo phong cách băng tuyết, cộng vài skill tự chế:
//   Nắm Đấm Pha Lê   <- Frostmaw (Mowzie's Mobs): tinh thể băng mọc trên nắm đấm rồi đập xuống
//   Mưa Băng Trần    <- Alpha Yeti (Twilight Forest): gầm làm băng nhọn rơi đúng chỗ đối thủ
//   Gai Quạt         <- Deerclops (Terraria): 3 làn gai băng tỏa hình quạt
//   Đập Đất Dội Sóng <- False Knight (Hollow Knight): sóng chạy dọc mặt đất + đá băng rơi từ trời
//   Trượt Băng Xoay  <- Barioth (Monster Hunter): trượt xoay bằng bụng, để lại vệt băng
//   Vòng Khiên Băng  <- Snow Queen (Twilight Forest): cầu băng quay quanh người rồi bắn tỏa ra
//   Sương Giá Tử Thần <- Borealis (Elden Ring): sương giá lan rộng, đứng lâu bị đóng băng
//   Vũ Điệu Bão Tuyết <- Malenia (Elden Ring): nhảy lên rồi chém liên hoàn nhiều hướng
//   Tia Băng Quét    <- Moon Lord (Terraria): tia băng từ miệng quét hình quạt
//   Mìn Pha Lê       (tự chế): cắm pha lê quanh sân, lần lượt phát nổ
//   Tuyết Lở         (tự chế): tảng tuyết lăn theo làn, chừa 1 làn an toàn
// Mọi skill đánh người chơi và mob mà boss đang nhắm.

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
// Nắm Đấm Pha Lê (Frostmaw) - tinh thể băng mọc bọc nắm đấm, rồi đập xuống nổ vòng gai
// o: { damage, radius }
// ============================================================================
export function crystalFist(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 32);
    playAnim(yeti, ANIM.groundPunch);
    const dim = yeti.dimension;
    const at = groundAt(dim, add(yeti.location, flatDir(yeti.location, target.location), 3));
    telegraph(dim, at, o.radius, T.punchImpact / 20, true);
    for (let t = 0; t < T.punchImpact; t += 3) later(t, () => { if (alive(yeti)) fx(dim, FX.orb, add({ ...yeti.location, y: yeti.location.y + 5 }, rightOf(flatDir(yeti.location, target.location)), -1.8)); });
    later(T.punchImpact, () => {
        if (!alive(yeti)) return;
        impact(dim, at, 2.6);
        fx(dim, FX.crystal, at, { duration: 1.5 });
        spikeRing(dim, at, o.radius * 0.6, 6, 1.2, 1.4);
        spikeRing(dim, at, o.radius, 10, 0.9, 1.2, 0.3);
        sound(dim, 'random.explode', at, 2, 0.8);
        sound(dim, 'random.glass', at, 2, 0.5);
        shake(dim, at, 16, 0.6, 0.5);
        for (const e of enemiesNear(dim, at, o.radius, yeti)) { hurt(e, o.damage, yeti); knockbackFrom(at, e, 1.6, 0.6); effect(e, 'slowness', 60, 2); }
    });
}

// ============================================================================
// Mưa Băng Trần (Alpha Yeti) - gầm vang, băng nhọn rơi đúng chỗ từng đối thủ 3 đợt
// o: { damage, waves }
// ============================================================================
export function ceilingIcicles(yeti, o) {
    lockCast(yeti, 40);
    playAnim(yeti, ANIM.roar);
    const dim = yeti.dimension;
    sound(dim, 'mob.ravager.roar', yeti.location, 3, 0.6);
    for (let w = 0; w < o.waves; w++) {
        later(T.roarPeak + w * 12, () => {
            if (!alive(yeti)) return;
            shake(dim, yeti.location, 24, 0.4, 0.4);
            for (const e of enemiesNear(dim, yeti.location, 24, yeti)) {
                const g = groundAt(dim, { x: e.location.x + (Math.random() - 0.5) * 1.5, y: e.location.y, z: e.location.z + (Math.random() - 0.5) * 1.5 });
                telegraph(dim, g, 1.6, 0.9, true);
                fx(dim, FX.icicle, { ...g, y: g.y + 12 });
                later(18, () => {
                    impact(dim, g, 1.2);
                    iceSpike(dim, g, 0.8, 1);
                    sound(dim, 'random.glass', g, 1.2, 0.9);
                    for (const v of enemiesNear(dim, g, 1.8, yeti)) { hurt(v, o.damage, yeti); effect(v, 'slowness', 40, 2); }
                });
            }
        });
    }
}

// ============================================================================
// Gai Quạt (Deerclops) - 3 làn gai băng chạy tỏa hình quạt về phía mục tiêu
// o: { damage, length }
// ============================================================================
export function fanSpikes(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 32);
    playAnim(yeti, ANIM.slam);
    const dim = yeti.dimension;
    const origin = { ...yeti.location, y: yeti.location.y + 1 };
    const base = flatDir(origin, target.location);
    const hit = new Set();
    for (const ang of [-25, 0, 25]) {
        const a = ang * Math.PI / 180, r = rightOf(base);
        const dir = { x: base.x * Math.cos(a) + r.x * Math.sin(a), z: base.z * Math.cos(a) + r.z * Math.sin(a) };
        for (let d = 2; d <= o.length; d += 1.6) {
            const p = groundAt(dim, add(origin, dir, d));
            telegraph(dim, p, 0.9, (T.slamImpact + d) / 20, false);
            later(T.slamImpact + d, () => {
                iceSpike(dim, p, 0.9 + d / o.length * 0.6, 1.1);
                for (const e of enemiesNear(dim, p, 1.3, yeti)) { if (hit.has(e.id)) continue; hit.add(e.id); hurt(e, o.damage, yeti); try { e.applyKnockback({ x: 0, z: 0 }, 0.6); } catch (_) {} }
            });
        }
    }
    later(T.slamImpact, () => { if (alive(yeti)) { impact(dim, yeti.location, 2.2); sound(dim, 'random.explode', yeti.location, 1.5, 1); } });
}

// ============================================================================
// Đập Đất Dội Sóng (False Knight) - đập đất, 2 sóng băng chạy dọc 2 bên, đá băng rơi từ trời
// o: { damage, length, rocks }
// ============================================================================
export function quakeWaves(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 32);
    playAnim(yeti, ANIM.slam);
    const dim = yeti.dimension;
    const origin = { ...yeti.location, y: yeti.location.y + 1 };
    const dir = flatDir(origin, target.location);
    later(T.slamImpact, () => {
        if (!alive(yeti)) return;
        impact(dim, origin, 3);
        shake(dim, origin, 24, 0.8, 0.8);
        sound(dim, 'random.explode', origin, 2.5, 0.6);
        for (const sgn of [1, -1]) {
            const hit = new Set();
            for (let d = 2; d <= o.length; d += 1.5) {
                later(d * 0.8, () => {
                    const p = groundAt(dim, add(origin, dir, d * sgn));
                    fx(dim, FX.shockwave, p, { radius: 1.8 });
                    fx(dim, FX.snow, p, { radius: 1 });
                    fx(dim, FX.crack, p, { radius: 1.4 });
                    for (const e of enemiesNear(dim, p, 1.8, yeti)) { if (hit.has(e.id)) continue; hit.add(e.id); hurt(e, o.damage, yeti); knockbackFrom(p, e, 1, 0.7); }
                });
            }
        }
        for (let i = 0; i < o.rocks; i++) {
            const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 12;
            const g = groundAt(dim, { x: origin.x + Math.cos(a) * r, y: origin.y, z: origin.z + Math.sin(a) * r });
            later(i * 3, () => {
                telegraph(dim, g, 1.5, 0.9, true);
                fx(dim, FX.icicle, { ...g, y: g.y + 12 });
                later(18, () => { impact(dim, g, 1.3); for (const e of enemiesNear(dim, g, 1.7, yeti)) hurt(e, o.damage, yeti); });
            });
        }
    });
}

// ============================================================================
// Trượt Băng Xoay (Barioth) - trượt xoay bằng bụng xuyên qua mục tiêu, để lại vệt băng làm chậm
// o: { damage, distance }
// ============================================================================
export function spinSlide(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 34, false);
    playAnim(yeti, ANIM.slide);
    const dim = yeti.dimension;
    const start = { ...yeti.location };
    const dir = flatDir(start, target.location);
    for (let d = 2; d <= o.distance; d += 2) telegraph(dim, add(start, dir, d), 1.4, 0.3 + d / o.distance * 0.8, true);
    const hit = new Set();
    later(5, () => {
        let t = 0;
        const run = system.runInterval(() => {
            t++;
            if (!alive(yeti)) { system.clearRun(run); return; }
            const p = add(start, dir, o.distance * t / 16);
            safeTeleport(yeti, p, { keepVelocity: false });
            fx(dim, FX.footprint, groundAt(dim, p));
            fx(dim, FX.snow, p, { radius: 1 });
            fx(dim, FX.claw, { ...p, y: p.y + 1.5 }, { radius: 1.8 });
            for (const e of enemiesNear(dim, p, 2.4, yeti)) { if (hit.has(e.id)) continue; hit.add(e.id); hurt(e, o.damage, yeti); knockbackFrom(p, e, 1.8, 0.4); effect(e, 'slowness', 60, 3); }
            if (t >= 16) { system.clearRun(run); impact(dim, p, 1.8); }
        }, 1);
    });
}

// ============================================================================
// Vòng Khiên Băng (Snow Queen) - cầu băng quay quanh người, rồi bắn tỏa ra mọi hướng
// o: { damage, count }
// ============================================================================
export function orbShield(yeti, o) {
    lockCast(yeti, 44);
    playAnim(yeti, ANIM.cast);
    const dim = yeti.dimension;
    sound(dim, 'beacon.activate', yeti.location, 1.5, 1.6);
    let t = 0;
    const angle = i => t * 0.18 + i / o.count * Math.PI * 2;
    const pos = i => ({ x: yeti.location.x + Math.cos(angle(i)) * 3, y: yeti.location.y + 3, z: yeti.location.z + Math.sin(angle(i)) * 3 });
    const run = system.runInterval(() => {
        t++;
        if (!alive(yeti)) { system.clearRun(run); return; }
        for (let i = 0; i < o.count; i++) {
            const p = pos(i);
            fx(dim, FX.orb, p);
            for (const e of enemiesNear(dim, p, 1.2, yeti)) { hurt(e, 1, yeti); knockbackFrom(yeti.location, e, 1, 0.3); }
        }
        if (t >= 36) {
            system.clearRun(run);
            sound(dim, 'random.glass', yeti.location, 2, 1.4);
            for (let i = 0; i < o.count; i++) {
                const from = pos(i);
                const dir = flatDir(yeti.location, from);
                projectile(yeti, from, { location: add(from, dir, 20), isValid: true }, {
                    speed: 1.2, head: FX.orb, trail: FX.trail, maxTicks: 20, onHit: (p, e) => { impact(dim, p, 1, { crack: false }); if (e) { hurt(e, o.damage, yeti); effect(e, 'slowness', 40, 2); } }
                });
            }
        }
    }, 1);
}

// ============================================================================
// Sương Giá Tử Thần (Borealis) - sương giá lan quanh Yeti 6 giây, ai đứng trong 3 giây bị đóng băng
// o: { damage, radius }
// ============================================================================
export function deathFrost(yeti, o) {
    lockCast(yeti, 44);
    playAnim(yeti, ANIM.howl);
    const dim = yeti.dimension;
    const c = groundAt(dim, yeti.location);
    fx(dim, FX.rune, c, { radius: o.radius, duration: 6 });
    sound(dim, 'ambient.weather.thunder', c, 2, 1.3);
    const time = new Map();
    let n = 0;
    const run = system.runInterval(() => {
        n++;
        fx(dim, FX.mist, c, { radius: o.radius * 0.4 });
        fx(dim, FX.snowfall, c, { radius: o.radius });
        for (const e of enemiesNear(dim, c, o.radius, yeti)) {
            const k = (time.get(e.id) ?? 0) + 1;
            time.set(e.id, k);
            effect(e, 'slowness', 20, 1);
            if (k === 6) {
                fx(dim, FX.frozen, e.location, { duration: 2 });
                fx(dim, FX.prison, e.location, { radius: 0.8, duration: 2 });
                effect(e, 'slowness', 40, 6);
                hurt(e, o.damage, yeti);
                sound(dim, 'random.glass', e.location, 1.5, 0.5);
            }
        }
        if (n >= 12) system.clearRun(run);
    }, 10);
}

// ============================================================================
// Vũ Điệu Bão Tuyết (Malenia) - nhảy lên, 3 cú bổ nhào chém liên tiếp quanh mục tiêu
// o: { damage }
// ============================================================================
export function blizzardDance(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 40);
    playAnim(yeti, ANIM.dance);
    const dim = yeti.dimension;
    sound(dim, 'mob.polarbear.warning', yeti.location, 2, 1.2);
    [16, 21, 26].forEach((tick, i) => {
        later(tick, () => {
            if (!alive(yeti) || !alive(target)) return;
            const a = Math.random() * Math.PI * 2;
            const p = { x: target.location.x + Math.cos(a) * 2.5, y: target.location.y, z: target.location.z + Math.sin(a) * 2.5 };
            fx(dim, FX.trail, yeti.location);
            safeTeleport(yeti, p, { facingLocation: target.location });
            fx(dim, FX.claw, { ...target.location, y: target.location.y + 1.2 }, { radius: 2.6 });
            fx(dim, FX.flash, target.location, { radius: 1.5 });
            sound(dim, 'game.player.attack.strong', p, 1.5, 0.7 + i * 0.1);
            for (const e of enemiesNear(dim, target.location, 3, yeti)) { hurt(e, o.damage, yeti); effect(e, 'slowness', 30, 2); }
        });
    });
}

// ============================================================================
// Tia Băng Quét (Moon Lord) - tụ lực ở miệng rồi quét tia băng hình quạt
// o: { damage, range }
// ============================================================================
export function sweepBeam(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, 54);
    playAnim(yeti, ANIM.beamSweep);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    const base = flatDir(origin, target.location);
    sound(dim, 'beacon.power', origin, 2, 1.6);
    for (let d = 3; d <= o.range; d += 3) for (const ang of [-35, 0, 35]) {
        const a = ang * Math.PI / 180, r = rightOf(base);
        telegraph(dim, add(origin, { x: base.x * Math.cos(a) + r.x * Math.sin(a), z: base.z * Math.cos(a) + r.z * Math.sin(a) }, d), 1, 1, true);
    }
    const hit = new Map();
    for (let tick = 20; tick <= 44; tick += 2) {
        later(tick, () => {
            if (!alive(yeti)) return;
            safeTeleport(yeti, origin, { facingLocation: add(origin, base, 10) });
            const ang = (35 - (tick - 20) / 24 * 70) * Math.PI / 180, r = rightOf(base);
            const dir = { x: base.x * Math.cos(ang) + r.x * Math.sin(ang), z: base.z * Math.cos(ang) + r.z * Math.sin(ang) };
            const mouth = { x: origin.x + dir.x * 1.8, y: origin.y + 4.2, z: origin.z + dir.z * 1.8 };
            for (let d = 0; d <= o.range; d += 0.8) {
                const p = { x: mouth.x + dir.x * d, y: mouth.y - d * 0.15, z: mouth.z + dir.z * d };
                fx(dim, d % 3.2 < 0.8 ? FX.beamCore : FX.spark, p);
                if (tick % 4 === 0) for (const e of enemiesNear(dim, p, 1.2, yeti)) {
                    if ((hit.get(e.id) ?? -9) >= tick - 4) continue;
                    hit.set(e.id, tick);
                    hurt(e, o.damage, yeti);
                    fx(dim, FX.flash, e.location, { radius: 1 });
                }
            }
            if (tick % 6 === 0) sound(dim, 'random.fizz', mouth, 1.2, 0.5);
        });
    }
}

// ============================================================================
// Mìn Pha Lê (tự chế) - cắm pha lê băng quanh sân, lần lượt phát nổ
// o: { damage, count }
// ============================================================================
export function crystalMines(yeti, o) {
    lockCast(yeti, 36);
    playAnim(yeti, ANIM.summon);
    const dim = yeti.dimension;
    const c = { ...yeti.location };
    later(T.summonImpact, () => {
        if (!alive(yeti)) return;
        impact(dim, c, 2);
        const foes = enemiesNear(dim, c, 24, yeti);
        for (let i = 0; i < o.count; i++) {
            const f = foes[i % Math.max(1, foes.length)];
            const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 3;
            const base = f ? f.location : c;
            const g = groundAt(dim, { x: base.x + Math.cos(a) * r, y: base.y + 1, z: base.z + Math.sin(a) * r });
            fx(dim, FX.crystal, g, { duration: 2 + i * 0.3 });
            telegraph(dim, g, 2.5, 2 + i * 0.3, true);
            later(40 + i * 6, () => {
                impact(dim, g, 2);
                spikeRing(dim, g, 1.5, 5, 0.8, 1);
                sound(dim, 'random.explode', g, 1.5, 1.3);
                for (const e of enemiesNear(dim, g, 2.5, yeti)) { hurt(e, o.damage, yeti); knockbackFrom(g, e, 1.2, 0.5); }
            });
        }
    });
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
