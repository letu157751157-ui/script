// File: scripts/yeti/minions.js
// Đệ băng mới của Yeti (v2.1) - AI di chuyển/cận chiến dùng component vanilla trong file entity,
// script này thêm kỹ năng riêng cho từng loại:
// - Sói Băng  (ytaun:frost_wolf)  : đi theo bầy, VỒ tới mục tiêu cách 4-10 block (hồi 4 giây).
// - Hồn Băng  (ytaun:frost_wraith): lơ lửng, BẮN TIA BĂNG đuổi theo mục tiêu (hồi 3 giây).
// - Golem Băng(ytaun:frost_golem) : chậm, trâu, ĐẬP ĐẤT tạo sóng băng quanh người (hồi 6 giây, có vòng đỏ báo trước).
// Đánh thường trúng -> animation cắn/cào/đấm + làm chậm. Chết -> vỡ tan thành băng.
// Kỹ năng chỉ trúng kẻ địch (targets.js), không bao giờ trúng Yeti hay đệ khác.

import { world, system, EntityDamageCause } from "@minecraft/server";
import * as fx from "./fx";
import * as T from "./targets";

const KINDS = {
    "ytaun:frost_wolf": { cd: 80, range: [4, 10], ability: pounce },
    "ytaun:frost_wraith": { cd: 60, range: [3, 16], ability: frostBolt },
    "ytaun:frost_golem": { cd: 120, range: [0, 4], ability: groundSlam },
};
const HIT_ANIM = {
    "ytaun:frost_wolf": "animation.ytaun.frost_wolf.bite",
    "ytaun:frost_wraith": "animation.ytaun.frost_wraith.slash",
    "ytaun:frost_golem": "animation.ytaun.frost_golem.punch",
};

const minions = new Map(); // id -> entity
const cooldown = new Map(); // id -> tick sẵn sàng dùng kỹ năng
const aggro = new Map(); // id -> { entity, tick }

function play(entity, name) {
    try {
        entity.playAnimation(name, { blendOutTime: 0.15, controller: "yeti_minion", stopExpression: "query.any_animation_finished" });
    } catch (_) {}
}

function hurt(minion, target, amount) {
    try {
        if (minion.isValid) target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: minion });
        else target.applyDamage(amount, { cause: EntityDamageCause.freezing });
    } catch (_) {}
}

function chill(target, ticks, amplifier) {
    try { target.addEffect("slowness", ticks, { amplifier, showParticles: true }); } catch (_) {}
}

function targetOf(minion, now) {
    const a = aggro.get(minion.id);
    if (a && now - a.tick <= 200 && T.isEnemy(a.entity) && fx.dist2D(a.entity.location, minion.location) <= 24) return a.entity;
    return T.nearest(T.victims(minion.dimension, minion.location, 20).filter(T.isPrey), minion.location);
}

// ---------------------------------------------------------------- Sói Băng: Vồ

function pounce(wolf, target) {
    const dim = wolf.dimension;
    const dir = fx.dirXZ(wolf.location, target.location);
    const d = fx.dist2D(wolf.location, target.location);
    play(wolf, "animation.ytaun.frost_wolf.pounce");
    fx.sound(dim, "mob.wolf.growl", wolf.location, 1, 1.3);
    fx.emit(dim, "yeti:snow_dust", wolf.location);
    system.runTimeout(() => {
        if (!wolf.isValid) return;
        try { wolf.applyKnockback({ x: dir.x * Math.min(2.2, d * 0.24), z: dir.z * Math.min(2.2, d * 0.24) }, 0.45); } catch (_) {}
    }, 3);
    let landed = false;
    fx.repeat(6, 2, () => {
        if (landed || !wolf.isValid || !target.isValid) return;
        fx.emit(dim, "yeti:frost_mist", fx.add(wolf.location, { x: 0, y: 0.5, z: 0 }));
        if (fx.dist(wolf.location, target.location) > 2.3) return;
        landed = true;
        fx.emit(dim, "yeti:shockwave", fx.add(target.location, { x: 0, y: 0.15, z: 0 }), { radius: 2.5 });
        fx.emit(dim, "yeti:snow_dust", target.location);
        hurt(wolf, target, 5);
        chill(target, 50, 2);
        fx.hitFx(dim, target.location);
        fx.sound(dim, "mob.wolf.bark", wolf.location, 1, 0.8);
        play(wolf, "animation.ytaun.frost_wolf.bite");
    }, 4);
}

// ---------------------------------------------------------------- Hồn Băng: Tia Băng

function frostBolt(wraith, target) {
    const dim = wraith.dimension;
    play(wraith, "animation.ytaun.frost_wraith.cast");
    fx.sound(dim, "mob.evocation_illager.prepare_attack", wraith.location, 0.8, 1.6);
    fx.emit(dim, "yeti:charge_gather", fx.add(wraith.location, { x: 0, y: 1.6, z: 0 }));
    system.runTimeout(() => {
        if (!wraith.isValid || !target.isValid) return;
        let pos = fx.add(wraith.location, { x: 0, y: 1.8, z: 0 });
        fx.sound(dim, "mob.blaze.shoot", pos, 0.8, 1.6);
        let tick = 0;
        const handle = system.runInterval(() => {
            tick++;
            try {
                const aim = target.isValid ? fx.add(target.location, { x: 0, y: 1, z: 0 }) : pos;
                const dir = fx.normalize({ x: aim.x - pos.x, y: aim.y - pos.y, z: aim.z - pos.z });
                const wall = fx.blocked(dim, pos, dir, 0.9);
                pos = fx.add(pos, dir, 0.9);
                fx.emit(dim, "yeti:frost_orb", pos, { radius: 0.3 });
                if (tick % 2 === 0) fx.emit(dim, "yeti:orb_trail", pos);
                const hit = T.victims(dim, pos, 1.2);
                if (hit.length || wall || tick >= 30) {
                    system.clearRun(handle);
                    fx.emit(dim, "yeti:ice_burst", pos);
                    fx.emit(dim, "yeti:ice_shard", pos);
                    fx.emit(dim, "yeti:frost_ring", pos, { radius: 1.6 });
                    fx.emit(dim, "yeti:frost_mist", pos);
                    fx.sound(dim, "random.glass", pos, 0.8, 1.5);
                    for (const e of hit) {
                        hurt(wraith, e, 4);
                        chill(e, 40, 1);
                        fx.emit(dim, "yeti:frozen_mark", fx.add(e.location, { x: 0, y: 2.3, z: 0 }));
                    }
                }
            } catch (_) {
                system.clearRun(handle);
            }
        }, 1);
    }, 10);
}

// ---------------------------------------------------------------- Golem Băng: Đập Đất

function groundSlam(golem, target) {
    const dim = golem.dimension;
    const radius = 3.8;
    const center = fx.groundAt(dim, golem.location);
    play(golem, "animation.ytaun.frost_golem.slam");
    fx.warnCircle(dim, center, radius, 14);
    fx.sound(dim, "mob.irongolem.throw", golem.location, 1, 0.6);
    try { golem.addEffect("slowness", 26, { amplifier: 8, showParticles: false }); } catch (_) {}
    system.runTimeout(() => {
        if (!golem.isValid) return;
        const c = fx.groundAt(dim, golem.location);
        fx.iceImpact(dim, c, radius);
        fx.emit(dim, "yeti:shockwave", fx.add(c, { x: 0, y: 0.15, z: 0 }), { radius: radius * 2 });
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI * 2 * i) / 8;
            fx.emit(dim, "yeti:ice_spike", fx.groundAt(dim, { x: c.x + Math.cos(a) * radius, y: c.y, z: c.z + Math.sin(a) * radius }),
                { radius: 0.7, life: 1.3 });
        }
        fx.shake(dim, c, 10, 0.35, 0.3);
        fx.sound(dim, "random.explode", c, 0.9, 1.1);
        for (const e of T.victims(dim, c, radius)) {
            if (Math.abs(e.location.y - c.y) > 2.5) continue;
            hurt(golem, e, 7);
            try { e.applyKnockback({ x: fx.dirXZ(c, e.location).x * 1.4, z: fx.dirXZ(c, e.location).z * 1.4 }, 0); } catch (_) {}
            chill(e, 60, 2);
            fx.hitFx(dim, e.location);
        }
    }, 14);
}

// ---------------------------------------------------------------- vòng lặp

function refresh() {
    for (const player of world.getAllPlayers()) {
        let nearby = [];
        try { nearby = player.dimension.getEntities({ location: player.location, maxDistance: 64, families: ["yeti_minion"] }); } catch (_) {}
        for (const m of nearby) if (KINDS[m.typeId]) minions.set(m.id, m);
    }
}

system.runInterval(() => {
    const now = system.currentTick;
    if (now % 20 === 0) refresh();
    for (const [id, m] of minions) {
        if (!m.isValid) {
            minions.delete(id);
            cooldown.delete(id);
            aggro.delete(id);
            continue;
        }
        const kind = KINDS[m.typeId];
        if (now < (cooldown.get(id) ?? 0)) continue;
        try {
            const target = targetOf(m, now);
            if (!target) continue;
            const d = fx.dist2D(m.location, target.location);
            if (d < kind.range[0] || d > kind.range[1]) continue;
            cooldown.set(id, now + kind.cd + Math.floor(Math.random() * 20));
            kind.ability(m, target);
        } catch (e) {
            console.warn("[Yeti minion]", e);
        }
    }
}, 5);

// Đánh thường trúng: animation + làm chậm; bị đánh: nhớ kẻ tấn công
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    try {
        if (!KINDS[damagingEntity?.typeId] || !T.isEnemy(hitEntity)) return;
        play(damagingEntity, HIT_ANIM[damagingEntity.typeId]);
        chill(hitEntity, 40, 1);
        fx.emit(hitEntity.dimension, "yeti:hit_spark", fx.add(hitEntity.location, { x: 0, y: 1, z: 0 }));
        aggro.set(damagingEntity.id, { entity: hitEntity, tick: system.currentTick });
    } catch (_) {}
});

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    try {
        if (!KINDS[hurtEntity?.typeId]) return;
        minions.set(hurtEntity.id, hurtEntity);
        const source = damageSource?.damagingEntity;
        if (T.isEnemy(source)) aggro.set(hurtEntity.id, { entity: source, tick: system.currentTick });
    } catch (_) {}
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    try {
        if (!KINDS[deadEntity?.typeId]) return;
        const dim = deadEntity.dimension;
        const l = fx.add(deadEntity.location, { x: 0, y: 0.8, z: 0 });
        fx.emit(dim, "yeti:ice_shard", l);
        fx.emit(dim, "yeti:frost_mist", l);
        fx.emit(dim, "yeti:snowflake", l);
        fx.sound(dim, "random.glass", l, 1, 1.2);
    } catch (_) {}
});
