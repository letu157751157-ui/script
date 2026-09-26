// File: scripts/yeti/skills.js
// Bộ chiêu của Yeti Boss (dùng chung cho cả 3 pha + dạng hấp hối yeti_death).
//
// Mỗi chiêu nhận ctx = { boss, target, tier, power, cfg, state, lock(ticks) } và trả về số tick
// Yeti "bận" thi triển (trong thời gian đó bộ não không chọn chiêu khác -> chiêu không chồng lên nhau).
// Trả về 0 nghĩa là không thi triển được (ví dụ đã đủ lính), bộ não sẽ chọn chiêu khác.
//
// Nguyên tắc chung của bản nâng cấp:
// - Đòn nặng đều có CẢNH BÁO đỏ trên mặt đất (vòng tròn / hàng ô) và kết thúc đúng lúc đòn rơi xuống,
//   sát thương tính theo vị trí người chơi LÚC ĐÒN RƠI -> né được bằng kỹ năng.
// - Mỗi chiêu có animation riêng (animation.yeti.*), mốc tick trong file này khớp với mốc trong animation.
// - Sát thương ghi nguồn là Yeti (damagingEntity) -> nội tại "hồi máu khi hạ gục" chạy cả với chiêu.
// - Mỗi mục tiêu chỉ dính mỗi đòn tối đa 1 lần (tránh bị hất tung lên trời như bản cũ).
// - v2.1: chiêu trúng MỌI sinh vật không thuộc phe Yeti (người chơi, dân làng, golem, sói, pet...),
//   xem targets.js. Các chiêu yếu (Đóng Băng Mặt Đất, Động Đất, gọi zombie/skeleton) đã được thay bằng
//   Ngục Băng, Thiên Thạch Băng, Tuyết Lở và triệu hồi đệ băng mới.

import { system, EntityDamageCause } from "@minecraft/server";
import * as fx from "./fx";
import * as T from "./targets";

export const ICE_SPIKE_ID = "ytaun:ice_spike_yeti_boss";
export const MINION_TAG = T.MINION_TAG;
export const victims = T.victims;
const SKILL_CONTROLLER = "yeti_skill";

// ---------------------------------------------------------------- tiện ích chung

/** Lấy giá trị theo bậc sức mạnh (pha 1, 2, 3; dạng hấp hối dùng giá trị của pha 3). */
function byTier(ctx, values) {
    return values[Math.min(ctx.tier, values.length) - 1];
}

export function playAnim(entity, name, blendOut = 0.25) {
    try {
        entity.playAnimation(`animation.yeti.${name}`, {
            blendOutTime: blendOut,
            controller: SKILL_CONTROLLER,
            stopExpression: "query.any_animation_finished",
        });
    } catch (_) {}
}

/** Chạy fn sau `ticks` tick nếu Yeti còn sống. */
function after(ctx, ticks, fn) {
    system.runTimeout(() => {
        if (!ctx.boss.isValid) return;
        try { fn(); } catch (e) { console.warn(`[Yeti] ${ctx.skill}:`, e); }
    }, Math.max(1, Math.round(ticks)));
}

/** Như after() nhưng vẫn chạy khi Yeti đã chết/chuyển pha (đạn đang bay, bão đang rơi...). */
function later(ticks, fn) {
    system.runTimeout(() => {
        try { fn(); } catch (e) { console.warn("[Yeti]", e); }
    }, Math.max(1, Math.round(ticks)));
}

/** Đứng yên tại chỗ trong lúc thi triển (slowness rất mạnh chỉ trong đúng thời gian đó). */
function root(boss, ticks) {
    try { boss.addEffect("slowness", Math.max(1, ticks), { amplifier: 8, showParticles: false }); } catch (_) {}
}

function face(boss, loc) {
    try { boss.teleport(boss.location, { facingLocation: { x: loc.x, y: boss.location.y, z: loc.z } }); } catch (_) {}
}

function hurt(ctx, player, amount) {
    try {
        const damage = amount * ctx.power;
        if (ctx.boss.isValid) player.applyDamage(damage, { cause: EntityDamageCause.entityAttack, damagingEntity: ctx.boss });
        else player.applyDamage(damage, { cause: EntityDamageCause.freezing });
    } catch (_) {}
}

function knock(player, dir, horizontal, vertical) {
    try { player.applyKnockback({ x: dir.x * horizontal, z: dir.z * horizontal }, vertical); } catch (_) {}
}

function slow(player, ticks, amplifier) {
    try { player.addEffect("slowness", ticks, { amplifier, showParticles: true }); } catch (_) {}
}

/** Làm chậm + hiện biểu tượng đóng băng trên đầu người chơi trong suốt thời gian đó. */
export function freeze(player, ticks, amplifier) {
    slow(player, ticks, amplifier);
    fx.repeat(Math.max(1, Math.ceil(ticks / 10)), 10, () => {
        if (!player.isValid) return;
        const l = player.location;
        fx.emit(player.dimension, "yeti:frozen_mark", { x: l.x, y: l.y + 2.3, z: l.z });
        fx.emit(player.dimension, "yeti:snowflake", { x: l.x, y: l.y + 1.2, z: l.z });
    });
}

/** Dự đoán vị trí mục tiêu sau `ticks` tick theo vận tốc hiện tại (bắn đón đầu). */
function predict(target, ticks) {
    try {
        const v = target.getVelocity();
        return { x: target.location.x + v.x * ticks, y: target.location.y, z: target.location.z + v.z * ticks };
    } catch (_) {
        return target.location;
    }
}

/**
 * Điểm phía trước Yeti, cao `up` block (tay, miệng...). `left` > 0 lệch sang tay trái của Yeti
 * (arm1 - tay không cầm chùy, dùng để ném cầu băng / quăng xiềng).
 */
function front(ctx, forward, up, dir, left = 0) {
    const d = dir ?? fx.dirXZ(ctx.boss.location, ctx.target?.isValid ? ctx.target.location : fx.add(ctx.boss.location, ctx.boss.getViewDirection()));
    const base = fx.add({ x: ctx.boss.location.x, y: ctx.boss.location.y + up, z: ctx.boss.location.z }, d, forward);
    return left ? fx.add(base, fx.rotateY(d, -90), left) : base;
}

function nearestVictim(ctx, radius) {
    return T.nearest(victims(ctx.boss.dimension, ctx.boss.location, radius), ctx.boss.location);
}

function spawnSpike(dimension, loc, lifeTicks = 60) {
    try {
        const spike = dimension.spawnEntity(ICE_SPIKE_ID, loc);
        try { spike.setRotation({ x: 0, y: Math.random() * 360 }); } catch (_) {}
        later(lifeTicks, () => { if (spike.isValid) spike.remove(); });
    } catch (_) {}
}

/** Choáng: Yeti đứng khựng, không dùng chiêu trong `ticks` tick (vỡ giáp/vỏ băng, lao vào tường). */
export function stagger(ctx, ticks = 32) {
    const { boss } = ctx;
    playAnim(boss, "stagger", 0.2);
    root(boss, ticks);
    ctx.lock(ticks);
    const l = boss.location;
    fx.emit(boss.dimension, "yeti:ice_shard", { x: l.x, y: l.y + 3, z: l.z });
    fx.emit(boss.dimension, "yeti:ice_shard", { x: l.x, y: l.y + 5, z: l.z });
    fx.emit(boss.dimension, "yeti:ice_burst", { x: l.x, y: l.y + 4, z: l.z });
    fx.ring(boss.dimension, l, 2.5, 8, "yeti:frost_mist", 1.5);
    fx.sound(boss.dimension, "random.glass", l, 2, 0.5);
    fx.sound(boss.dimension, "mob.irongolem.hit", l, 1.5, 0.6);
    fx.repeat(Math.floor(ticks / 6), 6, () => {
        if (!boss.isValid) return;
        fx.emit(boss.dimension, "yeti:sparkle", fx.add(boss.location, { x: 0, y: 5.5, z: 0 }));
    });
}

// ---------------------------------------------------------------- 1. Cầu Băng (Frost Orb)

/**
 * Ném cầu băng về phía mục tiêu (bắn đón đầu). Pha 2+: 3 quả toả hình quạt.
 * Pha 3: cầu vỡ ra 4 mảnh băng bay ngang khi nổ.
 */
export function frostOrb(ctx) {
    const { boss, target } = ctx;
    const dim = boss.dimension;
    face(boss, target.location);
    root(boss, 26);
    playAnim(boss, "throw");
    fx.sound(dim, "mob.polarbear.warning", boss.location, 1.2, 1.2);
    after(ctx, 5, () => fx.emit(dim, "yeti:charge_gather", front(ctx, 1.2, ctx.cfg.handUp, undefined, 1.1)));
    after(ctx, 12, () => {
        const start = front(ctx, 1.8, ctx.cfg.handUp, undefined, 1.1);
        const aim = fx.add(predict(target.isValid ? target : boss, 9), { x: 0, y: 1, z: 0 });
        const dir = fx.normalize({ x: aim.x - start.x, y: aim.y - start.y, z: aim.z - start.z });
        fx.sound(dim, "mob.blaze.shoot", start, 1.2, 0.6);
        fx.sound(dim, "random.bow", start, 1, 0.5);
        const spread = ctx.tier >= 2 ? [-14, 0, 14] : [0];
        for (const deg of spread) {
            const d = fx.rotateY(dir, deg);
            launchOrb(ctx, start, d, { speed: 1.05, maxTicks: 36, radius: 0.45, blast: 2.6,
                damage: byTier(ctx, [6, 7, 8]), split: ctx.tier >= 3 });
        }
    });
    return 26;
}

function launchOrb(ctx, start, dir, opts) {
    const dim = ctx.boss.dimension;
    let pos = start;
    let tick = 0;
    const handle = system.runInterval(() => {
        tick++;
        try {
            const wall = fx.blocked(dim, pos, dir, opts.speed);
            pos = fx.add(pos, dir, opts.speed);
            fx.emit(dim, "yeti:frost_orb", pos, { radius: opts.radius });
            if (tick % 2 === 0) fx.emit(dim, "yeti:orb_trail", pos);
            const hitPlayer = victims(dim, pos, opts.radius + 1.0).length > 0;
            if (hitPlayer || wall || tick >= opts.maxTicks) {
                system.clearRun(handle);
                explodeOrb(ctx, pos, dir, opts);
            }
        } catch (_) {
            system.clearRun(handle);
        }
    }, 1);
}

function explodeOrb(ctx, pos, dir, opts) {
    const dim = ctx.boss.dimension;
    if (opts.shard) {
        fx.emit(dim, "yeti:ice_burst", pos);
        fx.emit(dim, "yeti:snow_dust", pos);
    } else {
        const ground = fx.groundAt(dim, pos);
        const center = pos.y - ground.y < 2.5 ? ground : pos;
        fx.iceImpact(dim, center, opts.blast, center === ground);
        fx.sound(dim, "random.glass", pos, 1.5, 0.8 + Math.random() * 0.3);
        fx.sound(dim, "random.explode", pos, 0.6, 1.5);
    }
    for (const p of victims(dim, pos, opts.blast + 0.3)) {
        hurt(ctx, p, opts.damage);
        freeze(p, 60, 1);
        fx.hitFx(dim, p.location);
    }
    if (opts.split) {
        for (let i = 0; i < 4; i++) {
            const d = fx.rotateY({ x: dir.x, y: 0, z: dir.z }, 45 + i * 90);
            launchOrb(ctx, fx.add(pos, { x: 0, y: 0.6, z: 0 }), fx.normalize(d),
                { speed: 0.8, maxTicks: 8, radius: 0.25, blast: 1.4, damage: byTier(ctx, [3, 3, 4]), split: false, shard: true });
        }
    }
}

// ---------------------------------------------------------------- 2. Nhảy Đập (Leap Slam)

/**
 * Ngồi thụp lấy đà, nhảy vọt theo đường vòng cung tới chỗ mục tiêu và đập xuống.
 * Vòng đỏ hiện ở điểm rơi ngay từ đầu; sát thương giảm dần theo khoảng cách tới tâm.
 * Pha 3: sau khi đáp, một vòng gai băng mọc quanh điểm rơi.
 */
export function leapSlam(ctx) {
    const { boss, target } = ctx;
    const dim = boss.dimension;
    const start = boss.location;
    const radius = byTier(ctx, [4.5, 5.5, 6.5]);
    let aim = predict(target, 12);
    const d = fx.dist2D(start, aim);
    if (d > 22) aim = fx.add(start, fx.dirXZ(start, aim), 22);
    const land = fx.groundAt(dim, aim);
    const takeoff = 11, landing = 27, height = 6 + ctx.tier * 1.5;

    face(boss, land);
    root(boss, 42);
    playAnim(boss, "leap_slam");
    fx.warnCircle(dim, land, radius, landing);
    fx.sound(dim, "mob.ravager.roar", start, 1, 1.4);
    after(ctx, 8, () => fx.emit(dim, "yeti:snow_dust", start));
    after(ctx, takeoff, () => {
        fx.sound(dim, "mob.irongolem.throw", start, 2, 0.6);
        fx.iceImpact(dim, start, 2, false);
    });
    const flight = landing - takeoff;
    for (let i = 1; i <= flight; i++) {
        after(ctx, takeoff + i, () => {
            const u = i / flight;
            const pos = {
                x: fx.lerp(start.x, land.x, u),
                y: fx.lerp(start.y, land.y, u) + height * 4 * u * (1 - u),
                z: fx.lerp(start.z, land.z, u),
            };
            const ok = i === flight ? boss.tryTeleport(pos, { facingLocation: fx.add(pos, fx.dirXZ(start, land), 4) }) : true;
            if (i < flight) {
                try { boss.teleport(pos, { facingLocation: fx.add(pos, fx.dirXZ(start, land), 4) }); } catch (_) {}
            }
            if (i % 2 === 0) fx.emit(dim, "yeti:frost_mist", fx.add(pos, { x: 0, y: 1.5, z: 0 }));
            if (i === flight) slamDown(ctx, ok ? land : boss.location, radius);
        });
    }
    return 42;
}

function slamDown(ctx, land, radius) {
    const dim = ctx.boss.dimension;
    fx.iceImpact(dim, land, radius);
    fx.emit(dim, "yeti:ice_crack", { x: land.x, y: land.y + 0.04, z: land.z }, { radius: radius * 0.9 });
    fx.ring(dim, land, radius * 0.5, 8, "yeti:snow_dust", 0.1);
    fx.shake(dim, land, 20, 0.8, 0.6);
    fx.sound(dim, "random.explode", land, 1.6, 0.6);
    fx.sound(dim, "dig.snow", land, 2, 0.5);
    const maxDamage = byTier(ctx, [9, 11, 13]), minDamage = byTier(ctx, [4, 5, 6]);
    for (const p of victims(dim, land, radius)) {
        const d = fx.dist2D(p.location, land);
        if (Math.abs(p.location.y - land.y) > 3.5) continue;
        hurt(ctx, p, fx.lerp(maxDamage, minDamage, Math.min(1, d / radius)));
        knock(p, fx.dirXZ(land, p.location), byTier(ctx, [1.6, 2.1, 2.5]), 0.5);
        slow(p, 40, 1);
        fx.hitFx(dim, p.location);
    }
    if (ctx.tier >= 3) {
        const count = 10, r = radius + 1.5;
        const points = [];
        for (let i = 0; i < count; i++) {
            const a = (Math.PI * 2 * i) / count;
            points.push(fx.groundAt(dim, { x: land.x + Math.cos(a) * r, y: land.y, z: land.z + Math.sin(a) * r }));
        }
        for (const p of points) fx.warnTile(dim, p, 10);
        later(10, () => spikeVolley(ctx, points, 5));
    }
}

/** Mọc một loạt gai băng cùng lúc tại các điểm, mỗi người chơi dính tối đa 1 lần. */
function spikeVolley(ctx, points, damage) {
    const dim = ctx.boss.dimension;
    const hit = new Set();
    points.forEach((p, i) => {
        spawnSpike(dim, p);
        fx.emit(dim, "yeti:ice_pillar", p);
        if (i % 2 === 0) fx.sound(dim, "random.glass", p, 1, 0.9 + Math.random() * 0.4);
        spikeHit(ctx, p, damage, hit, { x: 0, y: 0, z: 0 });
    });
}

function spikeHit(ctx, loc, damage, hit, dir, launch = 0.42) {
    const dim = ctx.boss.dimension;
    for (const p of victims(dim, loc, 1.7)) {
        if (hit.has(p.id) || Math.abs(p.location.y - loc.y) > 2.5) continue;
        hit.add(p.id);
        hurt(ctx, p, damage);
        knock(p, dir, 0.3, launch);
        freeze(p, 60, 2);
        fx.hitFx(dim, p.location);
    }
}

// ---------------------------------------------------------------- 3. Tiếng Gầm Băng Giá (Frost Roar)

/** Gầm lên: 4 đợt sóng băng lan ra, làm chậm + mỏi tay; pha 2+ gây sát thương và đẩy lùi. */
export function frostRoar(ctx) {
    const { boss } = ctx;
    const dim = boss.dimension;
    face(boss, ctx.target.location);
    root(boss, 40);
    playAnim(boss, "roar");
    after(ctx, 2, () => {
        fx.sound(dim, "mob.polarbear.warning", boss.location, 2, 0.6);
        fx.emit(dim, "yeti:charge_gather", front(ctx, 1.5, ctx.cfg.mouthUp));
    });
    after(ctx, 12, () => {
        const center = boss.location;
        const mouth = front(ctx, ctx.cfg.mouthForward, ctx.cfg.mouthUp);
        fx.sound(dim, "mob.ravager.roar", center, 2.5, 0.7);
        fx.sound(dim, "mob.enderdragon.growl", center, 1.2, 1.3);
        fx.shake(dim, center, 24, 0.5, 1.0);
        const dir = fx.dirXZ(center, ctx.target.isValid ? ctx.target.location : mouth);
        for (let i = 0; i < 3; i++) fx.emit(dim, "yeti:breath", mouth, { dir: fx.rotateY(dir, (i - 1) * 25), speed: 9 });
        const hit = new Set();
        for (let k = 0; k < 4; k++) {
            later(k * 4, () => {
                const r = 3 + k * 3;
                fx.emit(dim, "yeti:frost_ring", { x: center.x, y: center.y + 0.1, z: center.z }, { radius: r + 1.5 });
                fx.ring(dim, center, r, 8 + k * 3, "yeti:frost_mist", 0.8);
                for (const p of victims(dim, center, r + 1.5)) {
                    if (hit.has(p.id) || fx.dist2D(p.location, center) < r - 2) continue;
                    hit.add(p.id);
                    freeze(p, 80, ctx.tier);
                    try { p.addEffect("mining_fatigue", 80, { amplifier: 0 }); } catch (_) {}
                    if (ctx.tier >= 2) {
                        hurt(ctx, p, byTier(ctx, [0, 4, 5]));
                        knock(p, fx.dirXZ(center, p.location), 1.1, 0.3);
                    }
                    if (ctx.tier >= 3) {
                        try { p.addEffect("weakness", 80, { amplifier: 0 }); } catch (_) {}
                    }
                }
            });
        }
    });
    return 40;
}

// ---------------------------------------------------------------- 4. Ngục Băng (Glacial Prison) - MỚI

/**
 * Dậm chân: vòng đỏ hiện dưới chân mục tiêu 0.8 giây. Ai chưa chạy ra kịp sẽ bị một lồng gai băng
 * giam lại (gần như không đi được), 1.5 giây sau lồng nổ tung vào trong gây sát thương rất lớn.
 * (Thay cho "Đóng Băng Mặt Đất" chỉ làm chậm + mất máu lặt vặt của bản cũ.)
 */
export function glacialPrison(ctx) {
    const { boss, target } = ctx;
    const dim = boss.dimension;
    const radius = 2.6, close = 16, crush = 46;
    const center = fx.groundAt(dim, predict(target, 6));
    face(boss, target.location);
    root(boss, 30);
    playAnim(boss, "stomp");
    fx.warnCircle(dim, center, radius, close);
    fx.sound(dim, "mob.polarbear.warning", boss.location, 1.5, 0.8);
    after(ctx, 13, () => {
        fx.iceImpact(dim, fx.groundAt(dim, boss.location), 2.5);
        fx.shake(dim, boss.location, 14, 0.35, 0.3);
        fx.sound(dim, "dig.snow", boss.location, 2, 0.6);
    });
    later(close, () => {
        for (let i = 0; i < 10; i++) {
            const a = (Math.PI * 2 * i) / 10;
            const spot = fx.groundAt(dim, { x: center.x + Math.cos(a) * 2.3, y: center.y, z: center.z + Math.sin(a) * 2.3 });
            spawnSpike(dim, spot, crush - close + 14);
            fx.emit(dim, "yeti:ice_pillar", spot);
        }
        fx.emit(dim, "yeti:frost_field", { x: center.x, y: center.y + 0.05, z: center.z }, { radius, life: (crush - close) / 20 + 0.5 });
        fx.sound(dim, "random.glass", center, 2, 0.6);
        fx.sound(dim, "chime.amethyst_block", center, 2, 0.6);
        for (const e of victims(dim, center, radius + 0.5)) {
            if (fx.dist2D(e.location, center) > radius || Math.abs(e.location.y - center.y) > 2.5) continue;
            freeze(e, crush - close, 6);
            try { e.onScreenDisplay.setActionBar("§c❄ Bị giam trong Ngục Băng!"); } catch (_) {}
        }
        fx.repeat(Math.floor((crush - close) / 4), 4, (k) => {
            for (let i = 0; i < 6; i++) {
                const a = (k * 20 + i * 60) * Math.PI / 180;
                fx.emit(dim, "yeti:crystal", { x: center.x + Math.cos(a) * 2, y: center.y + 1.2 + (i % 2), z: center.z + Math.sin(a) * 2 });
            }
            fx.emit(dim, "yeti:frost_mist", { x: center.x, y: center.y + 0.8, z: center.z });
        });
    });
    later(crush, () => {
        fx.iceImpact(dim, center, 3.5);
        fx.emit(dim, "yeti:light_beam", fx.add(center, { x: 0, y: 3, z: 0 }), { radius: 6 });
        fx.emit(dim, "yeti:ice_shard", fx.add(center, { x: 0, y: 1.5, z: 0 }));
        fx.shake(dim, center, 14, 0.6, 0.4);
        fx.sound(dim, "random.explode", center, 1.5, 0.9);
        fx.sound(dim, "random.glass", center, 2, 0.5);
        for (const e of victims(dim, center, radius + 0.6)) {
            if (Math.abs(e.location.y - center.y) > 3) continue;
            hurt(ctx, e, byTier(ctx, [9, 12, 15]));
            knock(e, fx.dirXZ(center, e.location), 0.4, 0.7);
            freeze(e, 40, 2);
            fx.hitFx(dim, e.location);
        }
    });
    return 30;
}

// ---------------------------------------------------------------- Tuyết Lở (Avalanche) - MỚI

/**
 * Nện đất làm sạt tuyết: 3/5/7 quả cầu tuyết khổng lồ lăn ra hình quạt (hàng ô đỏ báo trước từng làn),
 * càng lăn càng to, đè bẹp và hất văng mọi thứ trên đường. (Thay cho Tiếng Gầm chỉ làm chậm.)
 */
export function avalanche(ctx) {
    const { boss, target } = ctx;
    const dim = boss.dimension;
    const count = byTier(ctx, [3, 5, 7]), spread = byTier(ctx, [40, 56, 70]);
    const range = 18, release = 15;
    const origin = boss.location;
    const base = fx.dirXZ(origin, target.location);
    const dirs = [];
    for (let i = 0; i < count; i++) dirs.push(fx.rotateY(base, -spread / 2 + (spread * i) / (count - 1)));
    face(boss, target.location);
    root(boss, release + 14);
    playAnim(boss, "double_slam");
    fx.sound(dim, "mob.polarbear.warning", origin, 1.5, 0.6);
    for (const d of dirs) fx.warnLine(dim, fx.add(origin, d, 1.5), d, range, release, 2.4);
    after(ctx, release, () => {
        const start = boss.location;
        fx.iceImpact(dim, fx.groundAt(dim, front(ctx, 2.5, 0, base)), 3);
        fx.shake(dim, start, 20, 0.7, 0.8);
        fx.sound(dim, "random.explode", start, 1.5, 0.6);
        fx.sound(dim, "dig.snow", start, 2, 0.5);
        for (const d of dirs) rollSnowball(ctx, fx.add(start, d, 2.5), d, range, byTier(ctx, [7, 9, 11]));
    });
    return release + 14;
}

function rollSnowball(ctx, from, dir, range, damage) {
    const dim = ctx.boss.dimension;
    const speed = 0.75;
    const hit = new Set();
    let pos = fx.groundAt(dim, from);
    let traveled = 0, tick = 0, spin = Math.random() * 360;
    const burst = (size) => {
        fx.emit(dim, "yeti:snow_dust", pos);
        fx.emit(dim, "yeti:frost_mist", fx.add(pos, { x: 0, y: size, z: 0 }));
        fx.emit(dim, "yeti:frost_ring", fx.add(pos, { x: 0, y: 0.1, z: 0 }), { radius: size + 1.2 });
        fx.emit(dim, "yeti:snowflake", fx.add(pos, { x: 0, y: size, z: 0 }));
        fx.sound(dim, "dig.snow", pos, 1.5, 0.6);
    };
    const handle = system.runInterval(() => {
        tick++;
        const size = 0.8 + Math.min(1, traveled / range) * 0.9;
        try {
            const center = { x: pos.x, y: pos.y + size, z: pos.z };
            const next = fx.groundAt(dim, fx.add(pos, dir, speed));
            if (fx.blocked(dim, center, dir, speed + size * 0.6) || next.y - pos.y > 1.2) {
                system.clearRun(handle);
                burst(size);
                return;
            }
            pos = next;
            traveled += speed;
            spin += 28;
            fx.emit(dim, "yeti:snowball", { x: pos.x, y: pos.y + size, z: pos.z }, { radius: size, spin });
            if (tick % 2 === 0) fx.emit(dim, "yeti:snow_dust", pos);
            if (tick % 5 === 0) fx.sound(dim, "dig.snow", pos, 0.9, 0.5);
            for (const e of victims(dim, center, size + 1)) {
                if (hit.has(e.id)) continue;
                hit.add(e.id);
                hurt(ctx, e, damage);
                knock(e, dir, 1.8, 0.5);
                freeze(e, 60, 2);
                fx.hitFx(dim, e.location);
                fx.sound(dim, "random.explode", e.location, 0.6, 1.4);
            }
            if (traveled >= range) {
                system.clearRun(handle);
                burst(size);
            }
        } catch (_) {
            system.clearRun(handle);
        }
    }, 1);
}

// ---------------------------------------------------------------- Thiên Thạch Băng (Ice Meteor) - MỚI

/**
 * Giơ tay gọi thiên thạch băng từ trên trời rơi xuống chỗ mục tiêu (vòng đỏ lớn 2 giây).
 * Pha 3 và dạng hấp hối: 3 thiên thạch lần lượt rơi vào 3 kẻ địch. Tâm vụ nổ gây sát thương cực lớn,
 * hất tung, để lại hố băng làm chậm. (Thay cho Động Đất trùng lặp với Sóng Sông Băng.)
 */
export function iceMeteor(ctx) {
    const { boss, target } = ctx;
    const dim = boss.dimension;
    const count = byTier(ctx, [1, 1, 3]);
    const radius = byTier(ctx, [4, 5, 4.5]);
    const impact = 40, fall = 24;
    root(boss, 44);
    playAnim(boss, "summon");
    fx.sound(dim, "beacon.power", boss.location, 1.5, 0.7);
    fx.sound(dim, "ambient.weather.thunder", boss.location, 1.5, 0.6);
    const others = victims(dim, boss.location, 30).filter(e => e.id !== target.id && T.isPrey(e));
    const picks = [target, ...others].slice(0, count);
    for (let k = 0; k < count; k++) {
        const who = picks[k] ?? target;
        let spot = predict(who, 12);
        if (!picks[k]) {
            const a = Math.random() * Math.PI * 2;
            spot = { x: spot.x + Math.cos(a) * 5, y: spot.y, z: spot.z + Math.sin(a) * 5 };
        }
        spot = fx.groundAt(dim, spot);
        const when = impact + k * 10;
        const sky = fx.add(spot, fx.rotateY({ x: 0.6, y: 0, z: 0.4 }, Math.random() * 360), 10);
        const start = { x: sky.x, y: spot.y + 28, z: sky.z };
        fx.warnCircle(dim, spot, radius, when);
        later(when - fall, () => {
            fx.sound(dim, "mob.enderdragon.flap", spot, 1.5, 0.5);
            fx.repeat(fall, 1, (t) => {
                const u = Math.pow((t + 1) / fall, 1.6);
                const pos = { x: fx.lerp(start.x, spot.x, u), y: fx.lerp(start.y, spot.y + 1, u), z: fx.lerp(start.z, spot.z, u) };
                fx.emit(dim, "yeti:frost_orb", pos, { radius: 1.5 });
                fx.emit(dim, "yeti:orb_trail", pos);
                if (t % 2 === 0) fx.emit(dim, "yeti:frost_mist", pos);
            });
        });
        later(when, () => meteorImpact(ctx, spot, radius));
    }
    return 44;
}

function meteorImpact(ctx, spot, radius) {
    const dim = ctx.boss.dimension;
    fx.iceImpact(dim, spot, radius);
    fx.emit(dim, "yeti:ice_crack", { x: spot.x, y: spot.y + 0.04, z: spot.z }, { radius });
    fx.emit(dim, "yeti:frost_field", { x: spot.x, y: spot.y + 0.05, z: spot.z }, { radius, life: 4 });
    fx.emit(dim, "yeti:light_beam", fx.add(spot, { x: 0, y: 5, z: 0 }), { radius: 12 });
    fx.ring(dim, spot, radius * 0.7, 8, "yeti:ice_shard", 1);
    fx.shake(dim, spot, radius + 22, 1.0, 0.8);
    fx.flash(dim, spot, radius + 2, 0.05);
    fx.sound(dim, "random.explode", spot, 3, 0.5);
    fx.sound(dim, "random.glass", spot, 2.5, 0.5);
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
        spawnSpike(dim, fx.groundAt(dim, { x: spot.x + Math.cos(a) * radius * 0.8, y: spot.y, z: spot.z + Math.sin(a) * radius * 0.8 }));
    }
    const maxDamage = byTier(ctx, [12, 16, 18]);
    for (const e of victims(dim, spot, radius + 0.5)) {
        const d = fx.dist2D(e.location, spot);
        if (d > radius || Math.abs(e.location.y - spot.y) > 4) continue;
        hurt(ctx, e, fx.lerp(maxDamage, 6, d / radius));
        knock(e, fx.dirXZ(spot, e.location), 1.5, 0.9);
        freeze(e, 60, 2);
        fx.hitFx(dim, e.location);
    }
    later(10, () => {
        for (const e of victims(dim, spot, radius)) slow(e, 30, 1);
    });
}

// ---------------------------------------------------------------- 5. Gai Băng (Ice Spikes)

/**
 * Đập hai nắm đấm xuống đất, các hàng gai băng mọc lần lượt về phía mục tiêu.
 * Ô đỏ đánh dấu trước chỗ từng chiếc gai sẽ mọc. Mỗi người chơi chỉ dính 1 gai / lượt.
 * opts: { lanes, delay, noAnim, target } (Lao Đánh trượt dùng bản 1 hàng, không animation).
 */
export function iceSpikes(ctx, opts = {}) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const target = opts.target ?? ctx.target;
    const origin = boss.location;
    const dir = fx.dirXZ(origin, target.location);
    const perp = { x: -dir.z, y: 0, z: dir.x };
    const lanes = opts.lanes ?? byTier(ctx, [3, 3, 4]);
    const impact = opts.delay ?? 15;
    const spacing = 1.9, laneGap = 2.8;
    const reach = Math.max(6, Math.min(18, fx.dist2D(origin, target.location) + 3));
    const perLane = Math.max(3, Math.min(8, Math.ceil(reach / spacing)));
    const damage = byTier(ctx, [4, 5, 6]);

    if (!opts.noAnim) {
        face(boss, target.location);
        root(boss, impact + 14);
        playAnim(boss, "double_slam");
        after(ctx, impact, () => {
            const fist = front(ctx, 2.5, 0, dir);
            fx.iceImpact(dim, fx.groundAt(dim, fist), 3);
            fx.shake(dim, origin, 14, 0.6, 0.5);
            fx.sound(dim, "ambient.weather.thunder", origin, 1.2, 1.3);
        });
    }

    const hit = new Set();
    for (let lane = 0; lane < lanes; lane++) {
        const center = (lane - (lanes - 1) / 2) * laneGap;
        for (let i = 1; i <= perLane; i++) {
            const offset = center * (1 - i / (perLane * 2)); // các hàng hơi chụm lại về phía mục tiêu
            const spot = fx.groundAt(dim, fx.add(fx.add(origin, dir, 1.5 + i * spacing), perp, offset));
            const when = impact + i * 2;
            fx.warnTile(dim, spot, when);
            later(when, () => {
                spawnSpike(dim, spot);
                fx.emit(dim, "yeti:ice_pillar", spot);
                fx.emit(dim, "yeti:snow_dust", spot);
                if (i % 2 === 0) fx.emit(dim, "yeti:ice_crack", { x: spot.x, y: spot.y + 0.04, z: spot.z }, { radius: 1.3 });
                if ((i + lane) % 2 === 0) fx.sound(dim, "random.glass", spot, 0.9, 0.8 + Math.random() * 0.5);
                spikeHit(ctx, spot, damage, hit, dir);
            });
        }
    }
    return opts.noAnim ? 0 : impact + 14;
}

// ---------------------------------------------------------------- 6. Lao Đánh (Glacial Charge)

/**
 * Cào chân lấy đà như bò tót (hàng ô đỏ chỉ đường lao), lao thẳng 0.7 giây và húc văng mục tiêu.
 * Húc trúng: đóng băng + đẩy bay. Trượt: đập đất phóng 1 hàng gai về phía người chơi gần nhất.
 * Lao vào tường: Yeti tự choáng 1.6 giây (cơ hội phản công).
 */
export function glacialCharge(ctx) {
    const { boss, target } = ctx;
    const dim = boss.dimension;
    const origin = boss.location;
    const dir = fx.dirXZ(origin, target.location);
    const distance = Math.max(6, Math.min(14, fx.dist2D(origin, target.location) + 2));
    const windup = 14, dashTicks = 14;
    const step = distance / dashTicks;

    face(boss, target.location);
    root(boss, windup + dashTicks + 12);
    playAnim(boss, "charge");
    fx.warnLine(dim, origin, dir, distance + 1.5, windup, 1.5, 0);
    fx.warnLine(dim, origin, dir, distance + 1.5, windup, 3, 1.8);
    fx.warnLine(dim, origin, dir, distance + 1.5, windup, 3, -1.8);
    fx.sound(dim, "mob.ravager.stun", origin, 1.2, 0.8);
    for (const t of [5, 9, 12]) {
        after(ctx, t, () => {
            fx.emit(dim, "yeti:snow_dust", fx.add(boss.location, dir, -1.5));
            fx.sound(dim, "dig.snow", boss.location, 1.2, 0.6);
        });
    }

    const hit = new Set();
    let stopped = false;
    for (let i = 1; i <= dashTicks; i++) {
        after(ctx, windup + i, () => {
            if (stopped) return;
            const loc = boss.location;
            const next = fx.add(loc, dir, step);
            const reach = step + 1.6;
            if (fx.blocked(dim, { x: loc.x, y: loc.y + 1.5, z: loc.z }, dir, reach) || fx.blocked(dim, { x: loc.x, y: loc.y + 3, z: loc.z }, dir, reach)) {
                stopped = true;
                fx.iceImpact(dim, fx.add(loc, dir, 2), 2.5);
                fx.shake(dim, loc, 12, 0.6, 0.4);
                fx.sound(dim, "random.explode", loc, 1, 0.8);
                stagger(ctx, 32);
                return;
            }
            try { boss.teleport(next, { facingLocation: fx.add(next, dir, 5) }); } catch (_) {}
            fx.emit(dim, "yeti:snow_dust", fx.add(loc, dir, -1));
            if (i % 2 === 0) fx.emit(dim, "yeti:frost_mist", fx.add(loc, { x: 0, y: 1.2, z: 0 }));
            if (i % 3 === 0) {
                fx.sound(dim, "mob.ravager.step", loc, 1.2, 0.7);
                fx.shake(dim, loc, 10, 0.2, 0.15);
            }
            const ram = fx.add(next, dir, 1.3);
            for (const p of victims(dim, ram, 3)) {
                if (hit.has(p.id) || Math.abs(p.location.y - loc.y) > 3) continue;
                hit.add(p.id);
                hurt(ctx, p, byTier(ctx, [10, 12, 14]));
                knock(p, dir, byTier(ctx, [1.6, 1.8, 2.0]), 0.45);
                freeze(p, byTier(ctx, [100, 120, 140]), byTier(ctx, [3, 3, 4]));
                fx.hitFx(dim, p.location);
                fx.emit(dim, "yeti:ice_burst", fx.add(p.location, { x: 0, y: 1, z: 0 }));
                fx.sound(dim, "random.glass", p.location, 1.5, 0.7);
            }
        });
    }
    after(ctx, windup + dashTicks + 1, () => {
        if (stopped) return;
        const loc = boss.location;
        if (hit.size > 0) {
            fx.iceImpact(dim, fx.groundAt(dim, fx.add(loc, dir, 2.5)), 3.5);
            fx.shake(dim, loc, 14, 0.5, 0.35);
            fx.sound(dim, "random.explode", loc, 0.9, 1.3);
        } else {
            const other = nearestVictim(ctx, 16);
            if (other) iceSpikes(ctx, { lanes: 1, delay: 3, noAnim: true, target: other });
        }
    });
    return windup + dashTicks + 12;
}

// ---------------------------------------------------------------- 7. Hồi Phục Băng (Ice Regeneration)

/**
 * Quỳ xuống, bọc mình trong vỏ pha lê băng và hồi máu trong 6 giây.
 * Phản công: gây đủ sát thương trong lúc hồi (6/7/8% máu tối đa) -> vỏ vỡ, Yeti choáng.
 * (Sát thương được cộng dồn trong boss.js -> onBossHurt.)
 */
export function iceRegen(ctx) {
    const { boss, state } = ctx;
    const dim = boss.dimension;
    const duration = 120;
    const health = boss.getComponent("minecraft:health");
    if (!health) return 0;
    const max = health.effectiveMax;
    const center = fx.groundAt(dim, boss.location);

    root(boss, duration);
    playAnim(boss, "channel");
    fx.sound(dim, "beacon.power", boss.location, 2, 1.2);
    fx.emit(dim, "yeti:rune_circle", { x: center.x, y: center.y + 0.06, z: center.z }, { radius: 3.4, life: duration / 20 });
    fx.actionbar(dim, boss.location, 32, "§b❄ Yeti đang hồi máu §7- §cđánh vỡ vỏ băng để ngăn lại!");

    let tick = 0;
    const regen = { damage: 0, threshold: max * byTier(ctx, [0.06, 0.07, 0.08]), broken: false };
    state.regen = regen;
    const handle = system.runInterval(() => {
        tick += 2;
        if (!boss.isValid || regen.broken || state.regen !== regen) {
            system.clearRun(handle);
            return;
        }
        try {
            const l = boss.location;
            for (let i = 0; i < 6; i++) {
                const a = (tick * 6 + i * 60) * Math.PI / 180;
                const h = i % 2 === 0 ? 1.6 : 3.8;
                fx.emit(dim, "yeti:crystal", { x: l.x + Math.cos(a) * 2.6, y: l.y + h, z: l.z + Math.sin(a) * 2.6 });
            }
            if (tick % 6 === 0) fx.emit(dim, "yeti:heal", { x: l.x, y: l.y + 0.3, z: l.z });
            if (tick % 20 === 0) fx.emit(dim, "yeti:glyph", { x: l.x, y: l.y + 0.2, z: l.z });
            if (tick % 10 === 0) {
                const h = boss.getComponent("minecraft:health");
                if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + max * byTier(ctx, [0.01, 0.015, 0.02])));
                fx.sound(dim, "random.orb", l, 0.6, 1.4 + Math.random() * 0.3);
            }
        } catch (_) {}
        if (tick >= duration) {
            system.clearRun(handle);
            if (state.regen === regen) state.regen = undefined;
            const l = boss.location;
            fx.emit(dim, "yeti:sparkle", fx.add(l, { x: 0, y: 3, z: 0 }));
            fx.ring(dim, l, 2.6, 10, "yeti:frost_mist", 2);
            fx.sound(dim, "random.glass", l, 1.2, 1.6);
        }
    }, 2);
    return duration;
}

/** Vỏ băng vỡ (được gọi từ boss.js khi người chơi gây đủ sát thương trong lúc hồi máu). */
export function breakRegenShell(ctx) {
    const { boss, state } = ctx;
    if (!state.regen) return;
    state.regen.broken = true;
    state.regen = undefined;
    const l = boss.location;
    for (let i = 0; i < 3; i++) fx.emit(boss.dimension, "yeti:ice_shard", { x: l.x, y: l.y + 1.5 + i * 1.5, z: l.z });
    fx.ring(boss.dimension, l, 2.6, 12, "yeti:ice_burst", 2.5);
    fx.sound(boss.dimension, "random.glass", l, 2.5, 0.7);
    fx.sound(boss.dimension, "mob.irongolem.death", l, 1, 1.4);
    fx.actionbar(boss.dimension, l, 32, "§a✔ Vỏ băng đã vỡ! §fYeti bị choáng!");
    stagger(ctx, 40);
}

// ---------------------------------------------------------------- 8. Triệu Hồi Đệ Băng (Summon / Elite Army)

// Đệ băng mới (thay cho zombie / skeleton / stray vanilla của bản cũ): xem scripts/yeti/minions.js
const PACKS = {
    1: ["ytaun:frost_wolf", "ytaun:frost_wolf", "ytaun:frost_wolf"],
    2: ["ytaun:frost_wolf", "ytaun:frost_wolf", "ytaun:frost_wraith", "ytaun:frost_wraith"],
    3: ["ytaun:frost_golem", "ytaun:frost_wraith", "ytaun:frost_wraith", "ytaun:frost_wolf", "ytaun:frost_wolf"],
};
const ELITE_PACKS = {
    1: ["ytaun:frost_golem", "ytaun:frost_wolf", "ytaun:frost_wolf"],
    2: ["ytaun:frost_golem", "ytaun:frost_wraith", "ytaun:frost_wraith", "ytaun:frost_wolf"],
    3: ["ytaun:frost_golem", "ytaun:frost_golem", "ytaun:frost_wraith", "ytaun:frost_wraith", "ytaun:frost_wolf", "ytaun:frost_wolf"],
};

/**
 * Vòng rune băng hiện dưới đất, cột sáng băng bắn lên và đệ băng chui ra (Sói Băng, Hồn Băng, Golem Băng).
 * Giới hạn số đệ còn sống quanh Yeti. Bản "tinh nhuệ": nhiều golem hơn, đệ được cộng Resistance + Strength.
 */
export function summonMinions(ctx, elite = false) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const cap = byTier(ctx, [6, 8, 10]);
    let alive = 0;
    try { alive = dim.getEntities({ location: boss.location, maxDistance: 48, families: ["yeti_minion"] }).length; } catch (_) {}
    const pack = (elite ? ELITE_PACKS : PACKS)[Math.min(3, ctx.tier)].slice(0, Math.max(0, cap - alive));
    if (pack.length === 0) return 0;

    root(boss, 44);
    playAnim(boss, "summon");
    fx.sound(dim, "mob.evocation_illager.prepare_summon", boss.location, 2, 0.8);
    fx.sound(dim, "mob.wolf.howl", boss.location, 1.2, 0.7);
    const origin = boss.location;
    const baseAngle = Math.random() * 360;
    pack.forEach((type, i) => {
        const a = (baseAngle + (360 / pack.length) * i) * Math.PI / 180;
        const r = 4.5 + Math.random() * 2;
        const spot = fx.groundAt(dim, { x: origin.x + Math.cos(a) * r, y: origin.y, z: origin.z + Math.sin(a) * r });
        const delay = 28 + i * 3;
        const big = type === "ytaun:frost_golem";
        fx.emit(dim, "yeti:rune_circle", { x: spot.x, y: spot.y + 0.06, z: spot.z }, { radius: big ? 2 : 1.4, life: delay / 20 });
        for (const t of [6, 16]) later(t, () => fx.emit(dim, "yeti:glyph", spot));
        later(delay, () => {
            fx.emit(dim, "yeti:light_beam", fx.add(spot, { x: 0, y: 2.5, z: 0 }), { radius: big ? 5 : 3 });
            fx.emit(dim, "yeti:ice_pillar", spot);
            fx.emit(dim, "yeti:ice_burst", fx.add(spot, { x: 0, y: 1, z: 0 }));
            fx.emit(dim, "yeti:frost_mist", fx.add(spot, { x: 0, y: 0.5, z: 0 }));
            if (big) fx.emit(dim, "yeti:frost_ring", fx.add(spot, { x: 0, y: 0.1, z: 0 }), { radius: 3 });
            fx.sound(dim, "mob.evocation_illager.cast_spell", spot, 1.5, big ? 0.8 : 1.1);
            try {
                const mob = dim.spawnEntity(type, spot);
                mob.addTag(MINION_TAG);
                if (ctx.tier >= 2) mob.addEffect("speed", 999999, { amplifier: 0, showParticles: false });
                if (elite) {
                    mob.addEffect("resistance", 999999, { amplifier: 1, showParticles: false });
                    mob.addEffect("strength", 999999, { amplifier: 1, showParticles: false });
                }
            } catch (_) {}
        });
    });
    return 44;
}

export function eliteArmy(ctx) {
    return summonMinions(ctx, true);
}

// ---------------------------------------------------------------- 9. Bão Tuyết (Blizzard)

/**
 * Giơ tay gọi bão: vùng bão tuyết bám theo Yeti, băng nhọn rơi từ trên trời xuống quanh người chơi
 * (mỗi cột băng có vòng đỏ báo trước chỗ rơi). opts: { radius, duration, damage } cho dạng hấp hối.
 */
export function blizzard(ctx, opts = {}) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const radius = opts.radius ?? byTier(ctx, [12, 14, 16]);
    const duration = opts.duration ?? byTier(ctx, [120, 160, 200]);
    const damage = opts.damage ?? byTier(ctx, [5, 5, 6]);
    let center = boss.location;

    root(boss, 40);
    playAnim(boss, opts.anim ?? "summon");
    fx.sound(dim, "ambient.weather.thunder", center, 1.5, 0.8);
    fx.sound(dim, "mob.polarbear.warning", center, 1.5, 0.7);
    fx.repeat(Math.ceil(duration / 20), 20, () => {
        if (boss.isValid) center = boss.location;
        fx.emit(dim, "yeti:blizzard", center, { radius });
        fx.emit(dim, "yeti:snowflake", fx.add(center, { x: 0, y: 4, z: 0 }));
        for (const p of victims(dim, center, radius)) slow(p, 30, 0);
    }, 10);
    fx.repeat(Math.floor(duration / 8), 8, () => {
        const players = victims(dim, center, radius + 4);
        if (players.length === 0) return;
        const p = players[Math.floor(Math.random() * players.length)];
        const a = Math.random() * Math.PI * 2, off = Math.random() * 2.2;
        const spot = fx.groundAt(dim, { x: p.location.x + Math.cos(a) * off, y: p.location.y, z: p.location.z + Math.sin(a) * off });
        fx.warnCircle(dim, spot, 1.8, 20);
        later(2, () => fx.emit(dim, "yeti:icicle", fx.add(spot, { x: 0, y: 10.5, z: 0 })));
        later(20, () => {
            fx.iceImpact(dim, spot, 1.8, false);
            fx.sound(dim, "random.glass", spot, 1.2, 0.8 + Math.random() * 0.5);
            for (const v of victims(dim, spot, 2)) {
                hurt(ctx, v, damage);
                freeze(v, 60, 2);
                fx.hitFx(dim, v.location);
            }
        });
    }, 12);
    return 40;
}

// ---------------------------------------------------------------- 10. Khe Nứt Sông Băng (Glacier Rift)

/** Đập đất, một vết nứt chạy thẳng tới mục tiêu và các cột băng phun lên hất tung người chơi. */
export function glacierRift(ctx) {
    const { boss, target } = ctx;
    const dim = boss.dimension;
    const origin = boss.location;
    const dir = fx.dirXZ(origin, target.location);
    const length = Math.max(8, Math.min(22, fx.dist2D(origin, target.location) + 4));
    const impact = 15, step = 1.25;
    const hit = new Set();

    face(boss, target.location);
    root(boss, 36);
    playAnim(boss, "double_slam");
    after(ctx, impact, () => {
        fx.iceImpact(dim, fx.groundAt(dim, front(ctx, 2.5, 0, dir)), 3);
        fx.shake(dim, origin, 16, 0.6, 0.5);
        fx.sound(dim, "random.explode", origin, 1.2, 0.7);
    });
    let i = 0;
    for (let d = 2; d <= length; d += step, i++) {
        const spot = fx.groundAt(dim, fx.add(origin, dir, d));
        const when = impact + i;
        const pillar = i % 2 === 0;
        fx.warnTile(dim, spot, when);
        later(when, () => {
            fx.emit(dim, "yeti:ice_crack", { x: spot.x, y: spot.y + 0.04, z: spot.z }, { radius: 1.1 });
            fx.emit(dim, "yeti:snow_dust", spot);
            if (!pillar) return;
            spawnSpike(dim, spot, 50);
            fx.emit(dim, "yeti:ice_pillar", spot);
            if (i % 4 === 0) fx.sound(dim, "random.glass", spot, 1.2, 0.7 + Math.random() * 0.4);
            spikeHit(ctx, spot, byTier(ctx, [8, 9, 10]), hit, dir, 0.85);
        });
    }
    return 36;
}

// ---------------------------------------------------------------- 11. Lốc Xoáy Cực (Polar Vortex)

/**
 * Xoay tròn tạo lốc tuyết 5 giây: hút mọi kẻ địch vào tâm, ai ở sát Yeti bị sát thương liên tục.
 * v2.1 mạnh hơn: cuối chiêu lốc NỔ NGƯỢC (vòng đỏ báo trước 1 giây) - ai còn trong bán kính 6 block
 * bị hất tung, đóng băng và mất nhiều máu.
 */
export function polarVortex(ctx) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const radius = byTier(ctx, [12, 13, 15]);
    const blast = 6, detonate = 96;
    root(boss, 100);
    playAnim(boss, "spin");
    fx.sound(dim, "ambient.weather.thunder", boss.location, 1, 1.4);
    fx.emit(dim, "yeti:dome_edge", boss.location, { radius });
    fx.repeat(43, 2, (i) => {
        if (!boss.isValid) return;
        const c = boss.location;
        if (i % 5 === 0) {
            fx.emit(dim, "yeti:vortex", c, { radius });
            fx.emit(dim, "yeti:vortex", c, { radius: radius * 0.55 });
        }
        if (i % 10 === 0) fx.emit(dim, "yeti:dome_edge", c, { radius });
        if (i % 8 === 0) fx.sound(dim, "mob.enderdragon.flap", c, 1.5, 0.6);
        for (const e of victims(dim, c, radius)) {
            const d = fx.dist2D(e.location, c);
            if (d > 3) knock(e, fx.dirXZ(e.location, c), byTier(ctx, [0.2, 0.22, 0.26]), 0);
            if (i % 5 === 0 && d <= 4.5) {
                hurt(ctx, e, byTier(ctx, [4, 5, 6]));
                slow(e, 30, 2);
                fx.hitFx(dim, e.location);
            }
        }
    }, 10);
    after(ctx, detonate - 20, () => {
        fx.warnCircle(dim, fx.groundAt(dim, boss.location), blast, 20);
        fx.emit(dim, "yeti:charge_gather", fx.add(boss.location, { x: 0, y: 2.5, z: 0 }));
        fx.sound(dim, "beacon.activate", boss.location, 1.5, 0.6);
    });
    after(ctx, detonate, () => {
        const c = boss.location;
        fx.iceImpact(dim, c, blast);
        fx.emit(dim, "yeti:light_beam", fx.add(c, { x: 0, y: 4, z: 0 }), { radius: 9 });
        fx.ring(dim, c, blast * 0.8, 10, "yeti:ice_pillar", 0.1);
        fx.shake(dim, c, 24, 0.8, 0.6);
        fx.sound(dim, "random.explode", c, 2, 0.7);
        fx.sound(dim, "random.glass", c, 2, 0.6);
        for (const e of victims(dim, c, blast)) {
            if (Math.abs(e.location.y - c.y) > 4) continue;
            hurt(ctx, e, byTier(ctx, [8, 11, 14]));
            knock(e, fx.dirXZ(c, e.location), 1.6, 1.0);
            freeze(e, 60, 3);
            fx.hitFx(dim, e.location);
        }
    });
    return 100;
}

// ---------------------------------------------------------------- 12. Sóng Sông Băng (Glacial Wave)

/** Đập đất tạo một bức tường băng lan ra theo vòng tròn. Nhảy qua sóng thì không bị trúng! */
export function glacialWave(ctx) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const maxRadius = byTier(ctx, [14, 16, 20]);
    root(boss, 34);
    playAnim(boss, "double_slam");
    fx.actionbar(dim, boss.location, maxRadius + 8, "§e⬆ Nhảy qua sóng băng để né!");
    after(ctx, 15, () => {
        const center = boss.location;
        const hit = new Set();
        fx.iceImpact(dim, center, 3);
        fx.shake(dim, center, maxRadius + 6, 0.6, 0.6);
        fx.sound(dim, "random.explode", center, 1.5, 0.7);
        const steps = Math.ceil((maxRadius - 2) / 1.6);
        fx.repeat(steps, 2, (k) => {
            const r = 2 + k * 1.6;
            const points = Math.min(26, Math.round(r * 1.7));
            fx.ring(dim, center, r, points, "yeti:snow_dust", 0.1);
            if (k % 2 === 0) fx.ring(dim, center, r, Math.round(points / 2), "yeti:ice_pillar", 0.1);
            if (k % 3 === 0) fx.sound(dim, "dig.snow", center, 1.5, 0.7);
            for (const p of victims(dim, center, r + 1.4)) {
                if (hit.has(p.id) || Math.abs(fx.dist2D(p.location, center) - r) > 1.4) continue;
                if (!p.isOnGround || Math.abs(p.location.y - center.y) > 2.5) continue;
                hit.add(p.id);
                hurt(ctx, p, byTier(ctx, [7, 8, 10]));
                knock(p, fx.dirXZ(center, p.location), 1.7, 0.5);
                slow(p, 40, 1);
                fx.hitFx(dim, p.location);
            }
        });
    });
    return 34;
}

// ---------------------------------------------------------------- 14. Độ Không Tuyệt Đối (Absolute Zero)

/**
 * Tuyệt chiêu khi máu thấp: Yeti bay lên vận khí 3.2 giây, vòng băng đỏ khổng lồ hiện quanh nó
 * kèm đếm ngược. Hết giờ, mọi người chơi còn TRONG vòng bị đóng băng và mất rất nhiều máu.
 */
export function absoluteZero(ctx) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const radius = byTier(ctx, [10, 12, 14]);
    const detonate = 64;
    const center = fx.groundAt(dim, boss.location);

    root(boss, 80);
    playAnim(boss, "ultimate");
    fx.title(dim, center, radius + 16, "§b§l❄ ABSOLUTE ZERO ❄", "§fChạy ra khỏi vòng băng đỏ!");
    fx.warnCircle(dim, center, radius, detonate);
    fx.sound(dim, "beacon.power", center, 2.5, 0.5);
    fx.sound(dim, "mob.elderguardian.curse", center, 1, 1.2);
    fx.repeat(7, 10, (i) => {
        if (!boss.isValid) return;
        const c = boss.location;
        fx.emit(dim, "yeti:dome_edge", center, { radius });
        fx.emit(dim, "yeti:charge_gather", fx.add(c, { x: 0, y: 4.5, z: 0 }));
        if (i % 2 === 0) fx.emit(dim, "yeti:light_beam", fx.add(c, { x: 0, y: 4, z: 0 }), { radius: 8 });
        fx.ring(dim, center, radius, 12, "yeti:frost_mist", 0.5);
    });
    [3, 2, 1].forEach((n, k) => {
        after(ctx, 4 + k * 20, () => {
            fx.actionbar(dim, center, radius + 16, `§c§l❄ ${n} ❄`);
            fx.sound(dim, "note.pling", center, 2, 0.8 + k * 0.2);
        });
    });
    after(ctx, detonate, () => {
        fx.flash(dim, center, radius + 8, 0.25);
        fx.shake(dim, center, radius + 20, 1.0, 1.4);
        fx.sound(dim, "random.explode", center, 3, 0.5);
        fx.sound(dim, "random.glass", center, 2.5, 0.6);
        fx.sound(dim, "mob.warden.sonic_boom", center, 2, 0.8);
        fx.iceImpact(dim, center, radius);
        fx.emit(dim, "yeti:frost_field", { x: center.x, y: center.y + 0.05, z: center.z }, { radius, life: 6 });
        fx.emit(dim, "yeti:light_beam", fx.add(center, { x: 0, y: 5, z: 0 }), { radius: 14 });
        fx.ring(dim, center, radius * 0.5, 10, "yeti:ice_pillar", 0.1);
        fx.ring(dim, center, radius, 18, "yeti:ice_pillar", 0.1);
        fx.ring(dim, center, radius * 0.7, 6, "yeti:ice_shard", 1);
        for (const p of victims(dim, center, radius + 1)) {
            if (fx.dist2D(p.location, center) > radius || Math.abs(p.location.y - center.y) > 6) continue;
            hurt(ctx, p, byTier(ctx, [14, 16, 18]));
            freeze(p, 100, 4);
            try {
                p.addEffect("weakness", 100, { amplifier: 1 });
                p.addEffect("mining_fatigue", 100, { amplifier: 1 });
            } catch (_) {}
            fx.hitFx(dim, p.location);
        }
    });
    return 80;
}

// ---------------------------------------------------------------- 15. Xiềng Băng (Ice Chains)

/**
 * Quăng xiềng băng vào mục tiêu. Trúng: vòng đỏ hiện dưới chân, có 1.5 giây để chạy ra khỏi vòng;
 * không thoát kịp thì bị giật về phía Yeti, mất máu và choáng.
 */
export function iceChains(ctx) {
    const { boss, target } = ctx;
    const dim = boss.dimension;
    const bindRadius = 3.5, bindTicks = 30, speed = 1.6;
    face(boss, target.location);
    root(boss, 60);
    playAnim(boss, "chain_throw");
    fx.sound(dim, "mob.irongolem.throw", boss.location, 1.5, 1.3);

    after(ctx, 10, () => {
        const hand = () => front(ctx, 1.6, ctx.cfg.handUp, undefined, 1.1);
        let head = hand();
        let tick = 0;
        const flight = system.runInterval(() => {
            tick++;
            if (!boss.isValid || !target.isValid) { system.clearRun(flight); return; }
            const chest = fx.add(target.location, { x: 0, y: 1, z: 0 });
            const to = { x: chest.x - head.x, y: chest.y - head.y, z: chest.z - head.z };
            const len = Math.hypot(to.x, to.y, to.z);
            head = len <= speed ? chest : fx.add(head, to, speed / len);
            drawChain(dim, hand(), head);
            fx.emit(dim, "yeti:orb_trail", head);
            if (len <= speed + 0.4) {
                system.clearRun(flight);
                bind(ctx, target, hand, bindRadius, bindTicks);
            } else if (tick >= 14) {
                system.clearRun(flight);
                fx.emit(dim, "yeti:sparkle", head);
            }
        }, 1);
    });
    return 60;
}

function drawChain(dim, from, to) {
    const d = fx.dist(from, to);
    const n = Math.min(28, Math.ceil(d / 0.8));
    for (let i = 0; i <= n; i++) {
        const u = i / n;
        const sag = Math.sin(u * Math.PI) * Math.min(1.2, d * 0.06);
        fx.emit(dim, "yeti:chain_link", { x: fx.lerp(from.x, to.x, u), y: fx.lerp(from.y, to.y, u) - sag, z: fx.lerp(from.z, to.z, u) });
    }
}

function bind(ctx, target, hand, bindRadius, bindTicks) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const anchor = fx.groundAt(dim, target.location);
    fx.warnCircle(dim, anchor, bindRadius, bindTicks);
    fx.emit(dim, "yeti:rune_circle", { x: anchor.x, y: anchor.y + 0.07, z: anchor.z }, { radius: 1.2, life: bindTicks / 20 });
    fx.sound(dim, "random.glass", target.location, 1.2, 1.4);
    freeze(target, bindTicks, 2);
    try { target.onScreenDisplay.setActionBar("§c⛓ Bị xiềng băng! §fChạy ra khỏi vòng đỏ!"); } catch (_) {}
    fx.repeat(bindTicks / 2, 2, () => {
        if (!boss.isValid || !target.isValid) return;
        drawChain(dim, hand(), fx.add(target.location, { x: 0, y: 1, z: 0 }));
    });
    after(ctx, bindTicks - 5, () => playAnim(boss, "chain_pull", 0.2));
    after(ctx, bindTicks, () => {
        if (!target.isValid) return;
        if (fx.dist2D(target.location, anchor) > bindRadius) {
            fx.emit(dim, "yeti:sparkle", fx.add(target.location, { x: 0, y: 1, z: 0 }));
            fx.emit(dim, "yeti:ice_shard", fx.add(target.location, { x: 0, y: 1, z: 0 }));
            fx.sound(dim, "random.glass", target.location, 1, 1.8);
            try { target.onScreenDisplay.setActionBar("§a✔ Đã thoát xiềng băng!"); } catch (_) {}
            return;
        }
        const dir = fx.dirXZ(target.location, boss.location);
        knock(target, dir, 2.6, 0.55);
        hurt(ctx, target, byTier(ctx, [7, 8, 9]));
        freeze(target, 50, 4);
        fx.hitFx(dim, target.location);
        fx.emit(dim, "yeti:ice_burst", fx.add(target.location, { x: 0, y: 1, z: 0 }));
        fx.sound(dim, "mob.irongolem.throw", boss.location, 1.5, 0.7);
        fx.sound(dim, "random.glass", target.location, 1.5, 0.6);
    });
}

// ---------------------------------------------------------------- 16. Mưa Pha Lê (Crystal Barrage)

/** 6 viên pha lê băng hiện ra xoay quanh đầu Yeti rồi lần lượt lao xuống chỗ người chơi. */
export function crystalBarrage(ctx) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const count = 6, firstShot = 16, gap = 5, speed = 1.5;
    const fired = new Set();
    root(boss, 50);
    playAnim(boss, "barrage");
    fx.sound(dim, "mob.evocation_illager.prepare_attack", boss.location, 1.5, 1.2);
    fx.sound(dim, "chime.amethyst_block", boss.location, 2, 0.8);
    const crystalPos = (i, t) => {
        const c = boss.location;
        const a = (i * 60 + t * 12) * Math.PI / 180;
        return { x: c.x + Math.cos(a) * 2.4, y: c.y + ctx.cfg.handUp + 2.2 + Math.sin((t + i * 10) * 0.3) * 0.2, z: c.z + Math.sin(a) * 2.4 };
    };
    fx.repeat((firstShot + gap * count) / 2, 2, (k) => {
        if (!boss.isValid) return;
        for (let i = 0; i < count; i++) if (!fired.has(i)) fx.emit(dim, "yeti:crystal", crystalPos(i, k * 2));
    });
    for (let i = 0; i < count; i++) {
        after(ctx, firstShot + i * gap, () => {
            fired.add(i);
            const players = victims(dim, boss.location, 26);
            if (players.length === 0) return;
            const p = players[Math.floor(Math.random() * players.length)];
            const from = crystalPos(i, firstShot + i * gap);
            const dest = fx.groundAt(dim, predict(p, 5));
            const flight = Math.max(4, Math.ceil(fx.dist(from, dest) / speed));
            fx.warnCircle(dim, dest, 2.2, flight);
            fx.sound(dim, "mob.blaze.shoot", from, 0.8, 1.4);
            fx.repeat(flight, 1, (t) => {
                const u = (t + 1) / flight;
                const pos = { x: fx.lerp(from.x, dest.x, u), y: fx.lerp(from.y, dest.y + 0.5, u), z: fx.lerp(from.z, dest.z, u) };
                fx.emit(dim, "yeti:crystal", pos);
                fx.emit(dim, "yeti:orb_trail", pos);
            });
            later(flight, () => {
                fx.iceImpact(dim, dest, 2.2);
                fx.sound(dim, "random.glass", dest, 1.3, 1.3 + Math.random() * 0.4);
                for (const v of victims(dim, dest, 2.4)) {
                    hurt(ctx, v, byTier(ctx, [5, 5, 6]));
                    freeze(v, 40, 1);
                    fx.hitFx(dim, v.location);
                }
            });
        });
    }
    return 50;
}

// ---------------------------------------------------------------- 17. Bùng Nổ Băng (Frost Nova)

/** Gom băng vào người 1 giây (vòng đỏ quanh Yeti) rồi nổ tung, hất văng người đứng gần. */
export function frostNova(ctx, opts = {}) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const radius = opts.radius ?? 7;
    const detonate = 20;
    const center = fx.groundAt(dim, boss.location);
    root(boss, detonate + 14);
    fx.warnCircle(dim, center, radius, detonate);
    fx.sound(dim, "beacon.activate", center, 1.5, 0.7);
    fx.repeat(5, 4, () => fx.emit(dim, "yeti:charge_gather", fx.add(boss.location, { x: 0, y: ctx.cfg.handUp - 1, z: 0 })));
    if (opts.anim === "death_pound") after(ctx, detonate - 12, () => playAnim(boss, "death_pound"));
    else after(ctx, detonate - 15, () => playAnim(boss, "double_slam"));
    after(ctx, detonate, () => {
        fx.iceImpact(dim, center, radius);
        fx.ring(dim, center, radius * 0.7, 10, "yeti:ice_pillar", 0.1);
        fx.emit(dim, "yeti:ice_shard", fx.add(center, { x: 0, y: 2, z: 0 }));
        fx.shake(dim, center, radius + 10, 0.7, 0.5);
        fx.sound(dim, "random.explode", center, 1.8, 0.8);
        fx.sound(dim, "random.glass", center, 2, 0.7);
        for (const p of victims(dim, center, radius)) {
            if (Math.abs(p.location.y - center.y) > 4) continue;
            hurt(ctx, p, opts.damage ?? byTier(ctx, [7, 8, 10]));
            knock(p, fx.dirXZ(center, p.location), 2.4, 0.6);
            slow(p, 40, 2);
            fx.hitFx(dim, p.location);
        }
    });
    return detonate + 14;
}

// ---------------------------------------------------------------- 18. Giáp Băng (Frost Armor)

/**
 * Bắt chéo tay rồi gồng lên: các mảnh giáp pha lê xoay quanh người trong 10 giây.
 * Trong lúc có giáp: giảm thêm 50% sát thương nhận vào, phản 25% sát thương cận chiến.
 * Phản công: đánh trúng đủ 12 đòn -> giáp vỡ, Yeti choáng. (Đếm đòn trong boss.js.)
 */
export function frostArmor(ctx) {
    const { boss, state } = ctx;
    const dim = boss.dimension;
    const duration = 200;
    root(boss, 28);
    playAnim(boss, "armor_up");
    fx.sound(dim, "mob.polarbear.warning", boss.location, 1.5, 0.9);
    after(ctx, 16, () => {
        const armor = { hits: 0, maxHits: 12 };
        state.armor = armor;
        const l = boss.location;
        fx.emit(dim, "yeti:ice_burst", fx.add(l, { x: 0, y: 3, z: 0 }));
        fx.emit(dim, "yeti:glyph", l);
        fx.ring(dim, l, 2.6, 10, "yeti:sparkle", 2.5);
        fx.sound(dim, "beacon.activate", l, 1.5, 1.2);
        fx.sound(dim, "chime.amethyst_block", l, 2, 0.7);
        fx.actionbar(dim, l, 32, `§b❄ Giáp Băng! §fĐánh trúng §e${armor.maxHits} §fđòn để phá vỡ`);
        let tick = 0;
        const handle = system.runInterval(() => {
            tick += 4;
            if (!boss.isValid || state.armor !== armor) { system.clearRun(handle); return; }
            const c = boss.location;
            for (let i = 0; i < 8; i++) {
                const a = (tick * 5 + i * 45) * Math.PI / 180;
                fx.emit(dim, "yeti:crystal", { x: c.x + Math.cos(a) * 2.7, y: c.y + (i % 2 === 0 ? 2 : 4.2), z: c.z + Math.sin(a) * 2.7 });
            }
            if (tick % 12 === 0) fx.emit(dim, "yeti:sparkle", fx.add(c, { x: 0, y: 3, z: 0 }));
            if (tick >= duration) {
                system.clearRun(handle);
                state.armor = undefined;
                fx.ring(dim, c, 2.7, 10, "yeti:frost_mist", 2.5);
                fx.sound(dim, "random.glass", c, 1, 1.6);
            }
        }, 4);
    });
    return 28;
}

/** Giáp băng vỡ (gọi từ boss.js khi bị đánh đủ số đòn). */
export function breakArmor(ctx) {
    const { boss, state } = ctx;
    if (!state.armor) return;
    state.armor = undefined;
    const l = boss.location;
    fx.ring(boss.dimension, l, 2.7, 10, "yeti:ice_shard", 3);
    fx.emit(boss.dimension, "yeti:ice_burst", fx.add(l, { x: 0, y: 3.5, z: 0 }));
    fx.sound(boss.dimension, "random.glass", l, 2.5, 0.6);
    fx.actionbar(boss.dimension, l, 32, "§a✔ Giáp Băng đã vỡ! §fYeti bị choáng!");
    stagger(ctx, 40);
}

// ---------------------------------------------------------------- 19. Hơi Thở Băng Giá (Frost Breath)

/**
 * Hít sâu rồi phun luồng hơi băng hình nón, quét từ trái sang phải theo đầu Yeti (khớp animation):
 * ai đứng trong nón bị sát thương liên tục + làm chậm. Hàng ô đỏ báo trước hướng phun.
 */
export function frostBreath(ctx) {
    const { boss, target } = ctx;
    const dim = boss.dimension;
    const base = fx.dirXZ(boss.location, target.location);
    const range = byTier(ctx, [10, 11, 13]);
    const start = 15, end = 46, halfAngle = 22;
    // góc quay của thân + đầu trong animation.yeti.breath: -36° lúc 15 tick, +40° lúc 30 tick, 0° lúc 45 tick
    const yawAt = (t) => {
        if (t <= 30) return fx.lerp(-36, 40, (1 - Math.cos(Math.PI * (t - start) / 15)) / 2);
        return fx.lerp(40, 0, (1 - Math.cos(Math.PI * Math.min(1, (t - 30) / 15))) / 2);
    };
    face(boss, target.location);
    root(boss, 56);
    playAnim(boss, "breath");
    fx.sound(dim, "mob.polarbear.warning", boss.location, 1.5, 0.5);
    for (const deg of [-36, 0, 40]) fx.warnLine(dim, boss.location, fx.rotateY(base, deg), range, start, 2.2);
    const hit = new Map();
    for (let t = start; t <= end; t += 2) {
        after(ctx, t, () => {
            const dir = fx.rotateY(base, yawAt(t));
            const mouth = front(ctx, ctx.cfg.mouthForward, ctx.cfg.mouthUp, dir);
            const down = Math.max(-0.45, Math.min(0, -(ctx.cfg.mouthUp - 1) / range));
            fx.emit(dim, "yeti:breath", mouth, { dir: fx.normalize({ x: dir.x, y: down, z: dir.z }), speed: range * 1.25 });
            if ((t - start) % 6 !== 0) return;
            fx.sound(dim, "random.fizz", mouth, 1, 0.5);
            for (const p of victims(dim, boss.location, range + 2)) {
                const to = fx.dirXZ(boss.location, p.location);
                const angle = Math.acos(Math.max(-1, Math.min(1, to.x * dir.x + to.z * dir.z))) * 180 / Math.PI;
                const d = fx.dist2D(p.location, boss.location);
                if (angle > halfAngle || d > range + 1 || (hit.get(p.id) ?? -99) > t - 6) continue;
                hit.set(p.id, t);
                hurt(ctx, p, byTier(ctx, [2, 2.5, 3]));
                freeze(p, 40, 2);
                fx.emit(dim, "yeti:frost_mist", fx.add(p.location, { x: 0, y: 1, z: 0 }));
            }
        });
    }
    return 56;
}

// ---------------------------------------------------------------- Dạng hấp hối (yeti_death)

/** Đập hai nắm đấm xuống băng: sóng băng nhỏ quanh thân. */
export function lastStandPound(ctx) {
    const { boss } = ctx;
    const dim = boss.dimension;
    const radius = 5;
    const center = fx.groundAt(dim, boss.location);
    playAnim(boss, "death_pound");
    fx.warnCircle(dim, center, radius, 12);
    after(ctx, 12, () => {
        fx.iceImpact(dim, center, radius);
        fx.shake(dim, center, 12, 0.5, 0.3);
        fx.sound(dim, "random.explode", center, 1, 0.9);
        for (const p of victims(dim, center, radius)) {
            hurt(ctx, p, 5);
            knock(p, fx.dirXZ(center, p.location), 1.4, 0.4);
            slow(p, 60, 2);
            fx.hitFx(dim, p.location);
        }
    });
    return 26;
}

export function lastStandBlizzard(ctx) {
    return blizzard(ctx, { radius: 9, duration: 80, damage: 4, anim: "death_pound" });
}

export function lastStandNova(ctx) {
    return frostNova(ctx, { radius: 6, damage: 6, anim: "death_pound" });
}
