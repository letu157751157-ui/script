// File: scripts/custom/yeti_phase3.js
// Skills cho Yeti Phase 3 (ytaun:yeti_3)
//
// FIX so với bản gốc:
// - identifier "ytaun:yeti_phase3" -> "ytaun:yeti_3" (lý do chính script cũ không chạy)
// - .isValid() -> .isValid
// - getEntities({excludeTypes:[...]}) -> type: "minecraft:player" (tránh dính gai băng/ally)
// - applyDamage(amount, {cause,...}) -> applyDamage(amount)
// - Thêm 2 chiêu "Gai Băng" + "Lao Đánh" (dùng chung module yeti_spike_charge.js)
// - FIX (cân bằng): health config đồng bộ với minecraft:health thật của entity (trước lệch
//   800 vs 500 khiến % HP tính sai, ảnh hưởng ngưỡng kích hoạt Absolute Zero/Regen/Frost Armor)
// - FIX: world.afterEvents.entityDie tham chiếu biến "deadEntity" không tồn tại và gọi
//   "e.safeSpawnParticle(...)" (không phải method hợp lệ trên event) -> sửa lại đúng

import { world, system } from "@minecraft/server";
import { castIceSpike, castChargeAttack } from "./yeti_spike_charge";

const YETI_P3_CFG = {
    identifier: "ytaun:yeti_3",
    health: 500, // FIX: đồng bộ với minecraft:health thật của ytaun:yeti_3
    detectRange: 40,
    allyTypes: ["ytaun:yeti_boss_pet", "minecraft:wither_skeleton", "minecraft:husk", "minecraft:stray"],
    skillCooldowns: {
        roar: 410, iceRegen: 7800, blizzardRain: 600, frostSpike: 380,
        polarVortex: 3300, glacialWave: 365, absoluteZero: 1320,
        jump: 290, eliteArmy: 3300, earthquake: 450, iceChains: 410,
        crystalBarrage: 432, frostNova: 1200, frostArmor: 930,
        iceSpike: 425,      // 21.25 giây - Gai Băng (MỚI, +10s)
        chargeAttack: 320    // 16 giây - Lao Đánh (MỚI, +10s)
    }
};

const p3CD = new Map(), shieldActive = new Map(), prisonActive = new Map(), armorActive = new Map(), busyCasting = new Map();


// ==================== FIX LỖI SCRIPT API ====================
// FIX 1: applyKnockback() trong bản Script API đang dùng chỉ nhận 2 tham số
// (vector lực ngang {x,z} + lực dọc), KHÔNG PHẢI 4 tham số (dx, dz, lực ngang, lực dọc)
// như code gốc. Hàm này tự chuẩn hóa hướng rồi gọi đúng chữ ký mới.
function knockback(entity, dx, dz, horizontalStrength, verticalStrength) {
    try {
        const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
        entity.applyKnockback({ x: (dx / len) * horizontalStrength, z: (dz / len) * horizontalStrength }, verticalStrength);
    } catch (_) {}
}

// FIX 2: các skill tầm xa (roar, vortex, zero, earthquake...) tính toán vị trí có thể rơi
// ra ngoài chunk đang được load/tick, khiến getEntities()/spawnParticle() ném
// LocationInUnloadedChunkError và làm dừng cả hàm giữa chừng. Bọc lại để bỏ qua an toàn.
function safeGetEntities(dimension, options) {
    try { return dimension.getEntities(options); } catch (_) { return []; }
}
function safeSpawnParticle(dimension, id, loc) {
    try { dimension.spawnParticle(id, loc); } catch (_) {}
}
function safeTeleport(entity, loc, options) {
    try { entity.teleport(loc, options); } catch (_) {}
}
// ==================== HẾT PHẦN FIX ====================

function roar(y) {
    const l = y.location;
    y.dimension.playSound("mob.enderdragon.growl", l, { volume: 2.5, pitch: 0.5 });
    safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", l);
    for (let rg = 1; rg <= 9; rg++) {
        system.runTimeout(() => {
            const rr = rg * 2.5;
            for (let a = 0; a < 360; a += 15) safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", { x: l.x + Math.cos(a * Math.PI / 180) * rr, y: l.y + 1, z: l.z + Math.sin(a * Math.PI / 180) * rr });
            const ap = safeGetEntities(y.dimension, { location: l, maxDistance: rr + 1, minDistance: rr - 1, type: "minecraft:player" });
            ap.forEach(p => {
                p.applyDamage(Math.max(20 - Math.floor(rr / 22 * 8), 10));
                p.addEffect("slowness", 160, { amplifier: 4 });
                knockback(p, p.location.x - l.x, p.location.z - l.z, 0.8, 0.4);
            });
        }, rg * 7);
    }
}

function regen(y) {
    const l = y.location, eid = y.id;
    shieldActive.set(eid, true);
    y.dimension.playSound("beacon.power", l, { volume: 2.5, pitch: 1.5 });
    let hp = 1;
    try { const h = y.getComponent("minecraft:health"); if (h) hp = h.currentValue / YETI_P3_CFG.health; } catch (e) {}
    const isLow = hp < 0.25;
    const regenAmt = isLow ? 15 : 8, dur = isLow ? 140 : 120;
    if (isLow) { try { y.addEffect("resistance", 200, { amplifier: 3, showParticles: false }); } catch (e) {} }
    let rt = 0;
    const ri = system.runInterval(() => {
        if (!y.isValid) { system.clearRun(ri); shieldActive.delete(eid); return; }
        rt++;
        const cl = y.location, ang = (rt * 18) % 360;
        if (rt % 2 === 0) {
            for (let ly = 0; ly < (isLow ? 3 : 2); ly++) {
                for (let i = 0; i < 8; i++) {
                    const rad = (ang + i * 45 + ly * 22.5) % 360 * Math.PI / 180;
                    const r = (isLow ? 4 : 3.5) + ly * 0.6;
                    safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", { x: cl.x + Math.cos(rad) * r, y: cl.y + 1 + ly * 0.8, z: cl.z + Math.sin(rad) * r });
                }
            }
        }
        if (rt % 8 === 0) {
            try { const h = y.getComponent("minecraft:health"); if (h) h.setCurrentValue(Math.min(h.currentValue + regenAmt, YETI_P3_CFG.health)); } catch (e) {}
        }
        const np = safeGetEntities(y.dimension, { location: cl, maxDistance: isLow ? 8 : 7, type: "minecraft:player" });
        np.forEach(p => {
            knockback(p, p.location.x - cl.x, p.location.z - cl.z, isLow ? 2.5 : 2, 0.6);
            if (rt % 15 === 0) p.applyDamage(isLow ? 12 : 8);
        });
        if (rt >= dur) { system.clearRun(ri); shieldActive.delete(eid); safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", cl); }
    }, 1);
}

function blizzard(y) {
    const l = y.location;
    y.dimension.playSound("ambient.weather.thunder", l, { volume: 3 });
    let bt = 0;
    const bi = system.runInterval(() => {
        bt++;
        for (let i = 0; i < 12; i++) {
            const rx = l.x + (Math.random() - 0.5) * 35, rz = l.z + (Math.random() - 0.5) * 35;
            safeSpawnParticle(y.dimension, "minecraft:bleach", { x: rx, y: l.y + 25, z: rz });
            system.runTimeout(() => {
                const ip = { x: rx, y: l.y, z: rz };
                safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", ip);
                const hp = safeGetEntities(y.dimension, { location: ip, maxDistance: 5, type: "minecraft:player" });
                hp.forEach(p => { p.applyDamage(14); p.addEffect("slowness", 100, { amplifier: 4 }); });
            }, 25);
        }
        if (bt >= 50) system.clearRun(bi);
    }, 8);
}

function spike(y, t) {
    const l = y.location, tl = t.location;
    y.dimension.playSound("random.glass", l, { volume: 2.5, pitch: 0.7 });
    const dx = tl.x - l.x, dz = tl.z - l.z, d = Math.sqrt(dx * dx + dz * dz);
    for (let i = 1; i <= 10; i++) {
        system.runTimeout(() => {
            const sp = { x: l.x + (dx / d) * i * 2.5, y: l.y, z: l.z + (dz / d) * i * 2.5 };
            for (let h = 0; h < 3; h++) safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", { x: sp.x, y: sp.y + h * 2, z: sp.z });
            const hp = safeGetEntities(y.dimension, { location: sp, maxDistance: 3, type: "minecraft:player" });
            hp.forEach(p => { p.applyDamage(18); knockback(p, 0, 0, 0, 1.8); });
        }, i * 4);
    }
}

function vortex(y) {
    const l = y.location;
    y.dimension.playSound("mob.wither.spawn", l, { volume: 3.5 });
    let vt = 0;
    const vi = system.runInterval(() => {
        vt++;
        if (vt % 2 === 0) {
            for (let a = 0; a < 360; a += 35) {
                const rad = (a + vt * 12) % 360 * Math.PI / 180;
                for (let ly = 0; ly < 4; ly++) {
                    // chỉ 1 loại particle chính/tầng thay vì chồng 2 loại như trước - gọn và "sạch" hơn
                    const particleId = ly % 3 === 0 ? "minecraft:blue_flame_particle" : "minecraft:ice_evaporation_emitter";
                    safeSpawnParticle(y.dimension, particleId, { x: l.x + Math.cos(rad) * (18 - ly * 4), y: l.y + ly * 2, z: l.z + Math.sin(rad) * (18 - ly * 4) });
                }
            }
        }
        const np = safeGetEntities(y.dimension, { location: l, maxDistance: 18, type: "minecraft:player" });
        np.forEach(p => {
            knockback(p, -(p.location.x - l.x), -(p.location.z - l.z), 1, 0);
            if (vt % 8 === 0) { p.applyDamage(10); p.addEffect("slowness", 50, { amplifier: 5 }); }
        });
        if (vt >= 120) system.clearRun(vi);
    }, 2);
}

function wave(y) {
    const l = y.location;
    y.dimension.playSound("random.explode", l, { volume: 3 });
    for (let w = 1; w <= 12; w++) {
        system.runTimeout(() => {
            const wr = w * 2.2;
            for (let a = 0; a < 360; a += 15) {
                for (let h = 0; h < 3; h++) safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", { x: l.x + Math.cos(a * Math.PI / 180) * wr, y: l.y + h * 1.7, z: l.z + Math.sin(a * Math.PI / 180) * wr });
            }
            const hp = safeGetEntities(y.dimension, { location: l, maxDistance: wr + 1, minDistance: wr - 1, type: "minecraft:player" });
            hp.forEach(p => { p.applyDamage(15); knockback(p, p.location.x - l.x, p.location.z - l.z, 2.5, 0.7); });
        }, w * 7);
    }
}

function zero(y) {
    const l = y.location;
    y.dimension.playSound("beacon.power", l, { volume: 4, pitch: 0.4 });
    let at = 0;
    const ai = system.runInterval(() => {
        at++;
        for (let a = 0; a < 360; a += 20) {
            for (let r = 5; r <= 25; r += 5) safeSpawnParticle(y.dimension, "minecraft:bleach", { x: l.x + Math.cos(a * Math.PI / 180) * r, y: l.y + Math.sin(at * 6) * 4, z: l.z + Math.sin(a * Math.PI / 180) * r });
        }
        const np = safeGetEntities(y.dimension, { location: l, maxDistance: 30, type: "minecraft:player" });
        np.forEach(p => {
            p.addEffect("slowness", 50, { amplifier: 6 });
            p.addEffect("weakness", 50, { amplifier: 4 });
            if (at % 8 === 0) p.applyDamage(20);
        });
        if (at >= 100) system.clearRun(ai);
    }, 4);
}

function jump(y, t) {
    const sp = y.location, tp = t.location;
    y.dimension.playSound("mob.irongolem.throw", sp, { volume: 2.5 });
    safeTeleport(y, { x: sp.x, y: sp.y + 15, z: sp.z });
    system.runTimeout(() => {
        const lp = { x: tp.x, y: tp.y, z: tp.z };
        safeTeleport(y, lp);
        safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", lp);
        y.dimension.playSound("random.explode", lp, { volume: 3 });
        const hp = safeGetEntities(y.dimension, { location: lp, maxDistance: 10, type: "minecraft:player" });
        hp.forEach(p => {
            const d = Math.sqrt(Math.pow(p.location.x - lp.x, 2) + Math.pow(p.location.z - lp.z, 2));
            p.applyDamage(Math.max(32 - Math.floor(d * 3), 10));
            knockback(p, p.location.x - lp.x, p.location.z - lp.z, 4, 1);
        });
    }, 20);
}

function earthquake(y) {
    const l = y.location;
    y.dimension.playSound("mob.irongolem.throw", l, { volume: 3, pitch: 0.4 });
    y.dimension.playSound("mob.enderdragon.flap", l, { volume: 2.5, pitch: 0.6 });
    safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", l);
    safeTeleport(y, { x: l.x, y: l.y + 6, z: l.z });
    system.runTimeout(() => {
        safeTeleport(y, l);
        safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", l);
        y.dimension.playSound("random.explode", l, { volume: 3.5, pitch: 0.5 });
        y.dimension.playSound("mob.irongolem.death", l, { volume: 3, pitch: 0.3 });
        y.dimension.playSound("ambient.weather.thunder", l, { volume: 2.5, pitch: 0.7 });
        for (let i = 0; i < 2; i++) system.runTimeout(() => safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", l), i * 4);
        for (let w = 1; w <= 10; w++) {
            system.runTimeout(() => {
                const wr = w * 3.5;
                for (let a = 0; a < 360; a += 35) {
                    const pos = { x: l.x + Math.cos(a * Math.PI / 180) * wr, y: l.y, z: l.z + Math.sin(a * Math.PI / 180) * wr };
                    if (a % 40 === 0) { safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", pos); safeSpawnParticle(y.dimension, "minecraft:blue_flame_particle", pos); }
                    if (w % 3 === 0 && a % 60 === 0) safeSpawnParticle(y.dimension, "minecraft:snowflake_particle", pos);
                }
                if (w % 2 === 0) y.dimension.playSound("dig.stone", l, { volume: 2, pitch: 0.7 });
                const hp = safeGetEntities(y.dimension, { location: l, maxDistance: wr + 1, minDistance: wr - 1, type: "minecraft:player" });
                hp.forEach(p => {
                    p.applyDamage(13);
                    p.addEffect("slowness", 80, { amplifier: 3 });
                    knockback(p, p.location.x - l.x, p.location.z - l.z, 2, 0.4);
                });
            }, w * 5);
        }
    }, 15);
}

function eliteArmy(y) {
    const l = y.location;
    y.dimension.playSound("mob.evocation_illager.prepare_summon", l, { volume: 3, pitch: 0.7 });
    safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", l);
    const pos = [
        { x: 7, z: 0, d: 0 }, { x: -7, z: 0, d: 12 }, { x: 0, z: 7, d: 24 }, { x: 0, z: -7, d: 36 },
        { x: 5, z: 5, d: 48 }, { x: -5, z: -5, d: 60 }, { x: 5, z: -5, d: 72 }, { x: -5, z: 5, d: 84 },
        { x: 10, z: 0, d: 96 }, { x: -10, z: 0, d: 108 }, { x: 0, z: 10, d: 120 }, { x: 0, z: -10, d: 132 }
    ];
    pos.forEach(p => {
        system.runTimeout(() => {
            const sp = { x: l.x + p.x, y: l.y, z: l.z + p.z };
            let rt = 0;
            const ri = system.runInterval(() => {
                rt++;
                if (rt % 2 === 0) {
                    for (let i = 0; i < 6; i += 2) {
                        const ang = ((rt * 30) + i * 60) * Math.PI / 180;
                        const r = 3 - (rt / 20) * 2.5;
                        safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", { x: sp.x + Math.cos(ang) * r, y: sp.y + i * 0.5, z: sp.z + Math.sin(ang) * r });
                        if (i % 4 === 0) safeSpawnParticle(y.dimension, "minecraft:blue_flame_particle", { x: sp.x + Math.cos(ang) * r, y: sp.y + i * 0.5, z: sp.z + Math.sin(ang) * r });
                    }
                }
                if (rt >= 20) {
                    safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", sp);
                    y.dimension.playSound("mob.evocation_illager.cast_spell", sp, { volume: 1.5 });
                    try {
                        const elites = ["ytaun:yeti_boss_pet", "minecraft:wither_skeleton", "minecraft:husk", "minecraft:stray"];
                        const m = y.dimension.spawnEntity(elites[Math.floor(Math.random() * elites.length)], sp);
                        m.addEffect("speed", 999999, { amplifier: 2, showParticles: false });
                        m.addEffect("strength", 999999, { amplifier: 2, showParticles: false });
                        m.addEffect("resistance", 999999, { amplifier: 1, showParticles: false });
                        safeSpawnParticle(y.dimension, "minecraft:totem_particle", { x: sp.x, y: sp.y + 1, z: sp.z });
                    } catch (e) {}
                    system.clearRun(ri);
                }
            }, 1);
        }, p.d);
    });
}

function chains(y, t) {
    const l = y.location, tl = t.location;
    y.dimension.playSound("mob.irongolem.hit", l, { volume: 2 });
    const dx = tl.x - l.x, dz = tl.z - l.z, d = Math.sqrt(dx * dx + dz * dz);
    for (let i = 0; i <= d; i += 0.5) safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", { x: l.x + (dx / d) * i, y: l.y + 1, z: l.z + (dz / d) * i });
    t.addEffect("slowness", 200, { amplifier: 6 });
    t.addEffect("weakness", 200, { amplifier: 3 });
    let ct = 0;
    const ci = system.runInterval(() => {
        if (!t.isValid) { system.clearRun(ci); return; }
        ct++;
        const tl2 = t.location;
        for (let a = 0; a < 360; a += 50) safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", { x: tl2.x + Math.cos(a * Math.PI / 180) * 1.5, y: tl2.y + 1, z: tl2.z + Math.sin(a * Math.PI / 180) * 1.5 });
        if (ct % 20 === 0) t.applyDamage(6);
        if (ct >= 200) system.clearRun(ci);
    }, 1);
}

function barrage(y) {
    const l = y.location;
    y.dimension.playSound("random.bow", l, { volume: 2 });
    for (let i = 0; i < 12; i++) {
        system.runTimeout(() => {
            const a = Math.random() * 360, r = 5 + Math.random() * 15;
            const tp = { x: l.x + Math.cos(a * Math.PI / 180) * r, y: l.y, z: l.z + Math.sin(a * Math.PI / 180) * r };
            safeSpawnParticle(y.dimension, "minecraft:bleach", { x: tp.x, y: tp.y + 20, z: tp.z });
            system.runTimeout(() => {
                safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", tp);
                const hp = safeGetEntities(y.dimension, { location: tp, maxDistance: 3, type: "minecraft:player" });
                hp.forEach(p => { p.applyDamage(12); p.addEffect("slowness", 60, { amplifier: 2 }); });
            }, 25);
        }, i * 8);
    }
}

function nova(y) {
    const l = y.location;
    y.dimension.playSound("random.explode", l, { volume: 3 });
    safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", l);
    for (let r = 2; r <= 16; r += 2) {
        system.runTimeout(() => {
            for (let a = 0; a < 360; a += 15) {
                for (let h = 0; h < 3; h++) safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", { x: l.x + Math.cos(a * Math.PI / 180) * r, y: l.y + h * 2, z: l.z + Math.sin(a * Math.PI / 180) * r });
            }
            const hp = safeGetEntities(y.dimension, { location: l, maxDistance: r + 1, minDistance: r - 1, type: "minecraft:player" });
            hp.forEach(p => { p.applyDamage(16); knockback(p, p.location.x - l.x, p.location.z - l.z, 3, 0.8); });
        }, (r / 2) * 10);
    }
}

function frostArmor(y) {
    const eid = y.id;
    const l = y.location;
    armorActive.set(eid, true);
    y.dimension.playSound("beacon.activate", l, { volume: 2, pitch: 1.2 });
    safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", l);
    try { y.addEffect("resistance", 200, { amplifier: 2, showParticles: false }); } catch (e) {}

    let armorTime = 0;
    const armorInterval = system.runInterval(() => {
        if (!y.isValid) { system.clearRun(armorInterval); armorActive.delete(eid); return; }
        armorTime++;
        const cl = y.location;
        const rotation = (armorTime * 10) % 360;
        if (armorTime % 2 === 0) {
            for (let layer = 0; layer < 3; layer++) {
                for (let i = 0; i < 8; i++) {
                    const angle = (rotation + i * 45 + layer * 15) % 360;
                    const rad = angle * Math.PI / 180;
                    const radius = 2.5 + layer * 0.4;
                    safeSpawnParticle(y.dimension, "minecraft:ice_evaporation_emitter", { x: cl.x + Math.cos(rad) * radius, y: cl.y + 1.2 + layer * 0.6, z: cl.z + Math.sin(rad) * radius });
                    if (i % 2 === 0) safeSpawnParticle(y.dimension, "minecraft:blue_flame_particle", { x: cl.x + Math.cos(rad) * radius, y: cl.y + 1.2 + layer * 0.6, z: cl.z + Math.sin(rad) * radius });
                }
            }
        }
        const nearPlayers = safeGetEntities(y.dimension, { location: cl, maxDistance: 4, type: "minecraft:player" });
        nearPlayers.forEach(p => { if (armorTime % 10 === 0) p.addEffect("slowness", 60, { amplifier: 1 }); });
        if (armorTime >= 200) {
            system.clearRun(armorInterval);
            armorActive.delete(eid);
            safeSpawnParticle(y.dimension, "minecraft:huge_explosion_emitter", cl);
            y.dimension.playSound("random.glass", cl, { volume: 1.5 });
        }
    }, 1);
}

// Skill MỚI: Gai Băng + Lao Đánh
const SPIKE_CHARGE_CONFIG = {
    laneCount: 4,
    spikeDamage: 6,
    windupTicks: 16,
    dashTicks: 14,
    meleeDamage: 20,
    knockbackStrength: 2.0,
    slownessAmplifier: 4,
    freezeDurationTicks: 160,
    animIceSpike: 'animation.ytaun_yeti_1_default.ice_spike',
    animAttack2: 'animation.ytaun_yeti_1_default.attack_2',
    animAttackHit: 'animation.ytaun_yeti_1.attack'
};

function doIceSpike(y, t) {
    busyCasting.set(y.id, true);
    castIceSpike(y, t, SPIKE_CHARGE_CONFIG, () => busyCasting.delete(y.id));
}

function doChargeAttack(y, t) {
    busyCasting.set(y.id, true);
    castChargeAttack(y, t, SPIKE_CHARGE_CONFIG, (hit, finalTarget) => {
        busyCasting.delete(y.id);
        if (!hit && finalTarget) {
            const cd = p3CD.get(y.id);
            if (cd) cd.iceSpike = 0;
            doIceSpike(y, finalTarget);
        }
    });
}


function handleP3(y) {
    if (!y.isValid) return;
    if (busyCasting.has(y.id)) return;

    const eid = y.id;
    if (!p3CD.has(eid)) {
        p3CD.set(eid, { roar: 0, iceRegen: 0, blizzardRain: 0, frostSpike: 0, polarVortex: 0, glacialWave: 0, absoluteZero: 0, jump: 0, eliteArmy: 0, earthquake: 0, iceChains: 0, crystalBarrage: 0, frostNova: 0, frostArmor: 0, iceSpike: 0, chargeAttack: 0 });
    }
    const cd = p3CD.get(eid), ct = system.currentTick;
    const t = safeGetEntities(y.dimension, { location: y.location, maxDistance: YETI_P3_CFG.detectRange, type: "minecraft:player", closest: 1 })[0];
    if (!t) return;
    const d = Math.sqrt(Math.pow(t.location.x - y.location.x, 2) + Math.pow(t.location.z - y.location.z, 2));
    let hp = 1;
    try { const h = y.getComponent("minecraft:health"); if (h) hp = h.currentValue / YETI_P3_CFG.health; } catch (e) {}

    if (hp < 0.15 && ct >= cd.absoluteZero) { zero(y); cd.absoluteZero = ct + YETI_P3_CFG.skillCooldowns.absoluteZero; return; }
    if (hp < 0.3 && ct >= cd.iceRegen && !shieldActive.has(eid)) { regen(y); cd.iceRegen = ct + YETI_P3_CFG.skillCooldowns.iceRegen; return; }
    if (hp < 0.5 && ct >= cd.frostArmor && !armorActive.has(eid)) { frostArmor(y); cd.frostArmor = ct + YETI_P3_CFG.skillCooldowns.frostArmor; }
    if (ct >= cd.eliteArmy) { eliteArmy(y); cd.eliteArmy = ct + YETI_P3_CFG.skillCooldowns.eliteArmy; }
    if (ct >= cd.earthquake) { earthquake(y); cd.earthquake = ct + YETI_P3_CFG.skillCooldowns.earthquake; }
    if (d > 15 && ct >= cd.jump) { jump(y, t); cd.jump = ct + YETI_P3_CFG.skillCooldowns.jump; }

    // Gai Băng ưu tiên trước, Lao Đánh khi Gai Băng chưa hồi
    if (ct >= cd.iceSpike) { doIceSpike(y, t); cd.iceSpike = ct + YETI_P3_CFG.skillCooldowns.iceSpike; return; }
    if (ct >= cd.chargeAttack) { doChargeAttack(y, t); cd.chargeAttack = ct + YETI_P3_CFG.skillCooldowns.chargeAttack; return; }

    if (d > 20 && ct >= cd.blizzardRain) { blizzard(y); cd.blizzardRain = ct + YETI_P3_CFG.skillCooldowns.blizzardRain; }
    else if (d > 15 && ct >= cd.crystalBarrage) { barrage(y); cd.crystalBarrage = ct + YETI_P3_CFG.skillCooldowns.crystalBarrage; }
    else if (d > 12 && ct >= cd.frostSpike) { spike(y, t); cd.frostSpike = ct + YETI_P3_CFG.skillCooldowns.frostSpike; }
    else if (d > 10 && ct >= cd.iceChains) { chains(y, t); cd.iceChains = ct + YETI_P3_CFG.skillCooldowns.iceChains; }
    else if (d > 8 && ct >= cd.polarVortex) { vortex(y); cd.polarVortex = ct + YETI_P3_CFG.skillCooldowns.polarVortex; }
    else if (d <= 10 && ct >= cd.glacialWave) { wave(y); cd.glacialWave = ct + YETI_P3_CFG.skillCooldowns.glacialWave; }
    else if (d <= 8 && ct >= cd.frostNova) { nova(y); cd.frostNova = ct + YETI_P3_CFG.skillCooldowns.frostNova; }
    else if (d <= 6 && ct >= cd.roar) { roar(y); cd.roar = ct + YETI_P3_CFG.skillCooldowns.roar; }
}

system.runInterval(() => {
    world.getDimension("overworld").getEntities({ type: YETI_P3_CFG.identifier }).forEach(y => handleP3(y));
}, 1);

world.afterEvents.entityDie.subscribe((e) => {
    if (e.deadEntity.typeId === YETI_P3_CFG.identifier) {
        p3CD.delete(e.deadEntity.id);
        shieldActive.delete(e.deadEntity.id);
        armorActive.delete(e.deadEntity.id);
        busyCasting.delete(e.deadEntity.id);
        prisonActive.clear();
        // FIX: "e.safeSpawnParticle(deadEntity...)" không hợp lệ -> dùng hàm nội bộ + e.deadEntity
        safeSpawnParticle(e.deadEntity.dimension, "minecraft:huge_explosion_emitter", e.deadEntity.location);
        e.deadEntity.dimension.playSound("random.explode", e.deadEntity.location, { volume: 3 });
    }
});

world.afterEvents.entityHurt.subscribe((e) => {
    if (e.hurtEntity.typeId === YETI_P3_CFG.identifier && armorActive.has(e.hurtEntity.id)) {
        const attacker = e.damageSource.damagingEntity;
        if (attacker && attacker.typeId === "minecraft:player") {
            const reflectDamage = e.damage * 0.3;
            system.runTimeout(() => {
                try {
                    attacker.applyDamage(reflectDamage);
                    attacker.addEffect("slowness", 60, { amplifier: 1 });
                    safeSpawnParticle(attacker.dimension, "minecraft:ice_evaporation_emitter", attacker.location);
                } catch (err) {}
            }, 1);
        }
    }
});

console.warn("Yeti Phase 3 (yeti_3) loaded!");
