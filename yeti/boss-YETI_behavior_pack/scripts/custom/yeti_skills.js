// File: scripts/custom/yeti_skills.js
// Bộ skill Yeti v1.7 - boss cuối kiểu "quái thú": to xác, hung bạo, đánh bằng sức mạnh + băng.
// Ý tưởng lấy từ boss của mod / game khác rồi biến tấu:
//   Nhảy Vồ          <- Frostmaw (Mowzie's Mobs) / Alpha Yeti (Twilight Forest): nhảy vọt tới mục tiêu, đập đất khi rơi
//   Cào Xé Liên Hoàn <- Goss Harag (Monster Hunter Rise): cào phải, cào trái, đập 2 tay
//   Đấm Đất Gai Băng <- Frostmaw: đấm xuống đất, vòng gai băng nổ quanh
//   Ném Tảng Băng    <- Alpha Yeti (Twilight Forest): nhổ tảng băng ném vào mục tiêu
//   Lao Húc          <- Goss Harag / Rajang: lao thẳng húc văng mọi thứ trên đường
//   Hơi Thở Băng     <- Frostmaw: phun luồng băng hình nón, quét trái phải
//   Gai Quạt         <- Deerclops (Don't Starve): 3 làn gai băng tỏa hình quạt
//   Đập Đất Dội Sóng <- False Knight (Hollow Knight): sóng chạy dọc mặt đất + đá băng rơi
//   Mưa Băng Trần    <- Alpha Yeti: gầm làm băng nhọn rơi đúng chỗ đối thủ
//   Tuyết Lở         (tự chế): tảng tuyết lăn theo làn, chừa 1 làn an toàn
// Mọi skill đánh người chơi và mob mà boss đang nhắm. Boss chỉ bị giữ đứng yên trong khoảnh khắc ra đòn.

import { system } from '@minecraft/server';
import {
    ANIM, ANIM_TIMING as T, FX, fx, sound, playAnim, groundAt, telegraph, impact, iceSpike, spikeRing,
    flatDir, rightOf, dist2D, enemiesNear, playersNear, hurt, effect, knockbackFrom, shake, lockCast,
    safeTeleport, later, alive, rotateFlat, BREATH_SWEEP
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
// Nhảy Vồ (Frostmaw / Alpha Yeti) - ngồi thụp, bật lên theo đường vòng cung tới chỗ mục tiêu,
// rơi xuống đập đất: sóng xung kích + vòng gai băng. Dùng để áp sát khi đối thủ ở xa.
// o: { damage, radius }
// ============================================================================
export function frostLeap(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, T.leapLanding + 10, true, T.leapLanding + 4);
    playAnim(yeti, ANIM.leap);
    const dim = yeti.dimension;
    const start = { ...yeti.location };
    sound(dim, 'mob.polarbear.warning', start, 2.5, 0.6);
    fx(dim, FX.snow, start, { radius: 1.5 });
    // điểm rơi: ngay trước mặt mục tiêu (dự đoán lúc bật nhảy)
    let land = null;
    later(T.leapTakeoff, () => {
        if (!alive(yeti)) return;
        const aim = alive(target) ? target.location : add(start, flatDir(start, yeti.location), 8);
        const dir = flatDir(start, aim);
        const d = Math.min(dist2D(start, aim), o.maxDistance ?? 24);
        land = groundAt(dim, add(start, dir, Math.max(0, d - 1.5)), 16);
        telegraph(dim, land, o.radius, (T.leapLanding - T.leapTakeoff) / 20, true);
        impact(dim, start, 1.6, { crack: false });
        sound(dim, 'mob.ravager.stun', start, 1.5, 0.6);
        const n = T.leapLanding - T.leapTakeoff;
        const peak = 6 + d * 0.25;
        for (let i = 1; i <= n; i++) {
            later(i, () => {
                if (!alive(yeti)) return;
                const s = i / n;
                const p = { x: start.x + (land.x - start.x) * s, y: start.y + (land.y - start.y) * s + Math.sin(Math.PI * s) * peak, z: start.z + (land.z - start.z) * s };
                safeTeleport(yeti, p, { facingLocation: { x: land.x, y: p.y, z: land.z } });
                fx(dim, FX.trail, { ...p, y: p.y + 1.5 });
                if (i % 2 === 0) fx(dim, FX.snow, { ...p, y: p.y + 1 }, { radius: 0.8 });
            });
        }
    });
    later(T.leapLanding, () => {
        if (!alive(yeti) || !land) return;
        impact(dim, land, 3.2);
        fx(dim, FX.shockwave, land, { radius: o.radius + 1 });
        spikeRing(dim, land, o.radius * 0.55, 7, 1.1, 1.3);
        spikeRing(dim, land, o.radius, 12, 0.8, 1.1, 0.3);
        sound(dim, 'random.explode', land, 2.5, 0.6);
        sound(dim, 'random.anvil_land', land, 1.5, 0.5);
        shake(dim, land, 20, 0.9, 0.7);
        for (const e of enemiesNear(dim, land, o.radius, yeti)) {
            const close = dist2D(e.location, land) < o.radius * 0.5;
            hurt(e, close ? o.damage : Math.round(o.damage * 0.6), yeti);
            knockbackFrom(land, e, 1.8, 0.8);
            effect(e, 'slowness', 60, 2);
        }
    });
}

// ============================================================================
// Cào Xé Liên Hoàn (Goss Harag) - bước tới cào phải, cào trái, rồi đập 2 tay xuống đất
// o: { damage }
// ============================================================================
export function maulCombo(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, T.comboHit3 + 8, true, T.comboHit3 + 2);
    playAnim(yeti, ANIM.combo);
    const dim = yeti.dimension;
    sound(dim, 'mob.polarbear.warning', yeti.location, 2, 0.8);
    const hits = [[T.comboHit1, 1, 0.7], [T.comboHit2, -1, 0.7], [T.comboHit3, 0, 1.2]];
    for (const [tick, sideSign, mult] of hits) {
        later(tick - 3, () => { if (alive(yeti) && alive(target)) faceTarget(yeti, target); });
        later(tick, () => {
            if (!alive(yeti)) return;
            const loc = yeti.location;
            const dir = alive(target) ? flatDir(loc, target.location) : flatDir(loc, add(loc, { x: 0, z: 1 }, 1));
            // mỗi cú cào đẩy Yeti tiến lên 1 chút để đuổi kịp mục tiêu
            if (sideSign !== 0) safeTeleport(yeti, groundAt(dim, add(loc, dir, 0.8), 3), { facingLocation: add({ ...loc, y: loc.y + 2 }, dir, 5) });
            const at = add({ ...loc, y: loc.y + 1 }, dir, 2.6);
            if (sideSign === 0) {
                const g = groundAt(dim, at);
                impact(dim, g, 2.4);
                spikeRing(dim, g, 2.2, 6, 0.8, 1);
                sound(dim, 'random.explode', g, 1.6, 0.9);
                shake(dim, g, 12, 0.5, 0.4);
            } else {
                fx(dim, FX.claw, { ...at, y: at.y + 1 }, { radius: 2.6 });
                fx(dim, FX.shards, at);
                sound(dim, 'game.player.attack.strong', at, 1.5, 0.6);
            }
            for (const e of enemiesNear(dim, at, sideSign === 0 ? 3.2 : 2.8, yeti)) {
                hurt(e, Math.round(o.damage * mult), yeti);
                if (sideSign === 0) knockbackFrom(at, e, 1.4, 0.7);
                else {
                    const r = rightOf(dir);
                    try { e.applyKnockback({ x: (dir.x + r.x * sideSign) * 0.9, z: (dir.z + r.z * sideSign) * 0.9 }, 0.3); } catch (_) {}
                }
            }
        });
    }
}

// ============================================================================
// Đấm Đất Gai Băng (Frostmaw) - đấm 1 tay xuống đất trước mặt, 2 vòng gai băng nổ ra
// o: { damage, radius }
// ============================================================================
export function groundPound(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, T.punchImpact + 10, true, T.punchImpact + 4);
    playAnim(yeti, ANIM.groundPunch);
    const dim = yeti.dimension;
    const at = groundAt(dim, add(yeti.location, flatDir(yeti.location, target.location), 2.5));
    telegraph(dim, at, o.radius, T.punchImpact / 20, true);
    later(T.punchImpact, () => {
        if (!alive(yeti)) return;
        impact(dim, at, 2.8);
        fx(dim, FX.shockwave, at, { radius: o.radius });
        spikeRing(dim, at, o.radius * 0.5, 6, 1.2, 1.3);
        spikeRing(dim, at, o.radius, 10, 0.9, 1.1, 0.3);
        sound(dim, 'random.explode', at, 2, 0.8);
        sound(dim, 'random.glass', at, 2, 0.5);
        shake(dim, at, 16, 0.6, 0.5);
        for (const e of enemiesNear(dim, at, o.radius, yeti)) { hurt(e, o.damage, yeti); knockbackFrom(at, e, 1.2, 0.9); effect(e, 'slowness', 60, 2); }
    });
}

// ============================================================================
// Ném Tảng Băng (Alpha Yeti) - nhổ tảng băng lên, ném theo đường vòng cung, vỡ nổ khi rơi
// o: { damage, radius }
// ============================================================================
export function boulderThrow(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, T.throwRelease + 10, true, T.throwRelease + 2);
    playAnim(yeti, ANIM.throw);
    const dim = yeti.dimension;
    sound(dim, 'dig.stone', yeti.location, 2, 0.5);
    later(T.throwRelease, () => {
        if (!alive(yeti)) return;
        const from = { x: yeti.location.x, y: yeti.location.y + 4.5, z: yeti.location.z };
        const aim = alive(target) ? target.location : add(from, flatDir(from, yeti.location), 10);
        const land = groundAt(dim, aim, 12);
        const d = dist2D(from, land);
        const n = Math.max(8, Math.round(d / 1.1));
        telegraph(dim, land, o.radius, n / 20, true);
        sound(dim, 'mob.ravager.roar', from, 1.2, 1.3);
        for (let i = 1; i <= n; i++) {
            later(i, () => {
                const s = i / n;
                const p = { x: from.x + (land.x - from.x) * s, y: from.y + (land.y + 0.5 - from.y) * s + Math.sin(Math.PI * s) * (2 + d * 0.2), z: from.z + (land.z - from.z) * s };
                fx(dim, FX.boulder, p);
                fx(dim, FX.trail, p);
            });
        }
        later(n, () => {
            impact(dim, land, 2.4);
            fx(dim, FX.debris, land);
            fx(dim, FX.shards, land);
            sound(dim, 'random.explode', land, 2, 1);
            sound(dim, 'random.glass', land, 2, 0.6);
            for (const e of enemiesNear(dim, land, o.radius, yeti)) { hurt(e, o.damage, yeti); knockbackFrom(land, e, 1.3, 0.6); effect(e, 'slowness', 40, 1); }
        });
    });
}

// ============================================================================
// Lao Húc (Goss Harag / Rajang) - cúi đầu lao thẳng, húc văng mọi thứ, dừng lại khi đụng tường
// o: { damage, distance }
// ============================================================================
export function bodyCharge(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, T.chargeDash + T.chargeTicks + 8, true, T.chargeDash + T.chargeTicks + 2);
    playAnim(yeti, ANIM.charge);
    const dim = yeti.dimension;
    const start = { ...yeti.location };
    const dir = flatDir(start, target.location);
    sound(dim, 'mob.ravager.roar', start, 2.5, 0.8);
    for (let d = 2; d <= o.distance; d += 2) telegraph(dim, add(start, dir, d), 1.6, (T.chargeDash + d / o.distance * T.chargeTicks) / 20, true);
    const hit = new Set();
    later(T.chargeDash, () => {
        let t = 0;
        let pos = start;
        const run = system.runInterval(() => {
            t++;
            if (!alive(yeti)) { system.clearRun(run); return; }
            const next = groundAt(dim, add(pos, dir, o.distance / T.chargeTicks), 3);
            let wall = false;
            try { const b = dim.getBlock({ x: Math.floor(next.x), y: Math.floor(next.y + 1), z: Math.floor(next.z) }); wall = !!b && !b.isAir && !b.isLiquid; } catch (_) {}
            if (!wall) { pos = next; safeTeleport(yeti, pos, { facingLocation: add({ ...pos, y: pos.y + 2 }, dir, 5) }); }
            fx(dim, FX.snow, pos, { radius: 1.2 });
            if (t % 2 === 0) { fx(dim, FX.footprint, groundAt(dim, pos)); sound(dim, 'step.snow', pos, 2, 0.5); }
            for (const e of enemiesNear(dim, pos, 2.6, yeti)) {
                if (hit.has(e.id)) continue;
                hit.add(e.id);
                hurt(e, o.damage, yeti);
                fx(dim, FX.flash, e.location, { radius: 1.2 });
                try { e.applyKnockback({ x: dir.x * 2.4, z: dir.z * 2.4 }, 0.9); } catch (_) {}
            }
            if (t >= T.chargeTicks || wall) {
                system.clearRun(run);
                impact(dim, pos, wall ? 2.6 : 1.8);
                shake(dim, pos, 14, 0.6, 0.5);
                sound(dim, 'random.explode', pos, 1.5, wall ? 0.6 : 1);
            }
        }, 1);
    });
}

// ============================================================================
// Hơi Thở Băng (Frostmaw) - hít sâu rồi phun luồng băng hình nón, quét trái phải theo animation
// o: { damage, range }
// ============================================================================
export function frostBreath(yeti, target, o) {
    faceTarget(yeti, target);
    lockCast(yeti, T.breathEnd + 6, true, T.breathEnd + 2);
    playAnim(yeti, ANIM.breath);
    const dim = yeti.dimension;
    const origin = { ...yeti.location };
    const base = flatDir(origin, target.location);
    sound(dim, 'mob.polarbear.warning', origin, 2, 0.5);
    const lastHit = new Map();
    const yawAt = tick => {
        for (let i = 0; i < BREATH_SWEEP.length - 1; i++) {
            const [t0, a0] = BREATH_SWEEP[i], [t1, a1] = BREATH_SWEEP[i + 1];
            if (tick <= t1) return a0 + (a1 - a0) * Math.max(0, (tick - t0) / (t1 - t0));
        }
        return 0;
    };
    for (let tick = T.breathStart; tick <= T.breathEnd; tick += 2) {
        later(tick, () => {
            if (!alive(yeti)) return;
            const dir = rotateFlat(base, yawAt(tick));
            const mouth = { x: origin.x + dir.x * 1.6, y: origin.y + 3.8, z: origin.z + dir.z * 1.6 };
            fx(dim, FX.breath, mouth, { dir_x: dir.x, dir_z: dir.z });
            for (let d = 2; d <= o.range; d += 2) {
                const p = { x: mouth.x + dir.x * d, y: mouth.y - d * 0.25, z: mouth.z + dir.z * d };
                if (tick % 4 === 0) fx(dim, FX.mist, p, { radius: 0.4 + d * 0.12 });
                for (const e of enemiesNear(dim, p, 1 + d * 0.15, yeti)) {
                    if ((lastHit.get(e.id) ?? -99) > tick - 8) continue;
                    lastHit.set(e.id, tick);
                    hurt(e, o.damage, yeti);
                    effect(e, 'slowness', 50, 2);
                    fx(dim, FX.frozen, e.location, { duration: 0.6 });
                }
            }
            if (tick % 6 === 0) sound(dim, 'random.fizz', mouth, 1.2, 0.5);
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
