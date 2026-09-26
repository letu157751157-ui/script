import { world, system } from "@minecraft/server";

const YETI_P2_CFG = {
    identifier: "pa:yeti_phase_2",
    health: 500,
    detectRange: 35,
    skillCooldowns: {
        iceBall: 50, roar: 120, iceRegen: 22000, giantIceBall: 200, 
        summonMinions: 700, blizzardRain: 180, frostSpike: 90, 
        polarVortex: 600, glacialWave: 160, absoluteZero: 5000,
        jump: 100, eliteArmy: 4500, earthquake: 140
    }
};

const p2CD = new Map(), shieldActive = new Map(), prisonActive = new Map();

function iceBall(y, t) {
    const yp = y.location, tp = t.location;
    const dx = tp.x - yp.x, dy = tp.y - yp.y + 1, dz = tp.z - yp.z, d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const dirX = dx/d, dirY = dy/d, dirZ = dz/d;
    y.dimension.playSound("mob.ghast.fireball", yp, {volume: 0.8});
    let s = 0;
    const bi = system.runInterval(() => {
        s++;
        const cp = {x: yp.x + dirX*s*1.5, y: yp.y + 1.5 + dirY*s*1.5, z: yp.z + dirZ*s*1.5};
        y.dimension.spawnParticle("minecraft:snowflake_particle", cp);
        y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", cp);
        const hp = y.dimension.getEntities({location: cp, maxDistance: 2, type: "minecraft:player"});
        if (hp.length > 0) {
            hp.forEach(p => {
                p.applyDamage(12, {cause: "projectile", damagingEntity: y});
                p.addEffect("slowness", 100, {amplifier: 2});
            });
            y.dimension.playSound("random.glass", cp);
            system.clearRun(bi);
        }
        if (s >= 25) {
            y.dimension.spawnParticle("minecraft:huge_explosion_emitter", cp);
            system.clearRun(bi);
        }
    }, 1);
}

function roar(y) {
    const l = y.location, r = 18;
    y.dimension.playSound("mob.enderdragon.growl", l, {volume: 2, pitch: 0.6});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    for (let rg = 1; rg <= 7; rg++) {
        system.runTimeout(() => {
            const rr = rg * 2.5;
            for (let a = 0; a < 360; a += 12) {
                y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: l.x + Math.cos(a*Math.PI/180)*rr, y: l.y + 1, z: l.z + Math.sin(a*Math.PI/180)*rr});
            }
            const ap = y.dimension.getEntities({location: l, maxDistance: rr+1, minDistance: rr-1, excludeTypes: [YETI_P2_CFG.identifier]});
            ap.forEach(p => {
                p.applyDamage(Math.max(15 - Math.floor(rr/r*6), 8), {cause: "sonic_boom", damagingEntity: y});
                p.addEffect("slowness", 140, {amplifier: 3});
                p.applyKnockback(p.location.x - l.x, p.location.z - l.z, 0.6, 0.3);
            });
        }, rg * 8);
    }
}

function regen(y) {
    const l = y.location, eid = y.id;
    shieldActive.set(eid, true);
    y.dimension.playSound("beacon.power", l, {volume: 2, pitch: 1.3});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    
    let hp = 1;
    try {
        const h = y.getComponent("minecraft:health");
        if (h) hp = h.currentValue / YETI_P2_CFG.health;
    } catch(e) {}
    
    const isLowHp = hp < 0.3;
    const regenPerTick = isLowHp ? 10 : 5;
    const duration = isLowHp ? 120 : 100;
    
    if (isLowHp) {
        try {
            y.addEffect("resistance", 999999, {amplifier: 2, showParticles: false});
        } catch(e) {}
    }
    
    let rt = 0;
    const ri = system.runInterval(() => {
        if (!y.isValid()) {
            system.clearRun(ri);
            shieldActive.delete(eid);
            return;
        }
        rt++;
        const cl = y.location, ang = (rt * 15) % 360;
        const layers = isLowHp ? 2 : 2;
        if (rt % 3 === 0) {
            for (let ly = 0; ly < layers; ly++) {
                for (let i = 0; i < 6; i++) {
                    const rad = (ang + i*60 + ly*30) % 360 * Math.PI / 180;
                    const radius = (isLowHp ? 3.5 : 3) + ly*0.5;
                    y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: cl.x + Math.cos(rad)*radius, y: cl.y + 1 + ly*0.7, z: cl.z + Math.sin(rad)*radius});
                    if (isLowHp && rt % 6 === 0) {
                        y.dimension.spawnParticle("minecraft:totem_particle", {x: cl.x + Math.cos(rad)*radius, y: cl.y + 1 + ly*0.7, z: cl.z + Math.sin(rad)*radius});
                    }
                }
            }
        }
        if (rt % 8 === 0) {
            y.dimension.spawnParticle("minecraft:heart_particle", {x: cl.x, y: cl.y + 2.5, z: cl.z});
        }
        if (rt % 10 === 0) {
            try {
                const h = y.getComponent("minecraft:health");
                if (h) h.setCurrentValue(Math.min(h.currentValue + regenPerTick, YETI_P2_CFG.health));
            } catch(e) {}
        }
        const np = y.dimension.getEntities({location: cl, maxDistance: isLowHp ? 7 : 6, type: "minecraft:player"});
        np.forEach(p => {
            const knockbackPower = isLowHp ? 2 : 1.5;
            p.applyKnockback(p.location.x - cl.x, p.location.z - cl.z, knockbackPower, 0.5);
            if (rt % 20 === 0) p.applyDamage(isLowHp ? 8 : 6, {cause: "freezing", damagingEntity: y});
        });
        if (rt >= duration) {
            system.clearRun(ri);
            shieldActive.delete(eid);
            y.dimension.spawnParticle("minecraft:huge_explosion_emitter", cl);
        }
    }, 1);
}

function giantBall(y, t) {
    const yp = y.location, tp = t.location;
    y.dimension.playSound("mob.wither.shoot", yp, {volume: 2, pitch: 0.7});
    const dx = tp.x - yp.x, dy = tp.y - yp.y + 1, dz = tp.z - yp.z, d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    let s = 0;
    const gbi = system.runInterval(() => {
        s++;
        const cp = {x: yp.x + (dx/d)*s, y: yp.y + 2 + (dy/d)*s, z: yp.z + (dz/d)*s};
        for (let ly = 0; ly < 4; ly++) {
            for (let a = 0; a < 360; a += 18) {
                const rad = a * Math.PI / 180;
                y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: cp.x + Math.cos(rad)*(3-ly*0.7), y: cp.y, z: cp.z + Math.sin(rad)*(3-ly*0.7)});
            }
        }
        const hp = y.dimension.getEntities({location: cp, maxDistance: 4, type: "minecraft:player"});
        if (hp.length > 0) {
            hp.forEach(p => {
                p.applyDamage(20, {cause: "projectile", damagingEntity: y});
                makePrison(y, p, cp);
            });
            y.dimension.spawnParticle("minecraft:huge_explosion_emitter", cp);
            system.clearRun(gbi);
        }
        if (s >= 35) {
            y.dimension.spawnParticle("minecraft:huge_explosion_emitter", cp);
            system.clearRun(gbi);
        }
    }, 2);
}

function makePrison(y, p, c) {
    const pid = p.id;
    prisonActive.set(pid, true);
    y.dimension.playSound("random.glass", c, {volume: 1.5});
    let pt = 0;
    const pi = system.runInterval(() => {
        if (!p.isValid()) {
            system.clearRun(pi);
            prisonActive.delete(pid);
            return;
        }
        pt++;
        for (let a = 0; a < 360; a += 12) {
            for (let h = 0; h <= 4; h++) {
                y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: c.x + Math.cos(a*Math.PI/180)*3, y: c.y + h, z: c.z + Math.sin(a*Math.PI/180)*3});
            }
        }
        const dist = Math.sqrt(Math.pow(p.location.x-c.x,2) + Math.pow(p.location.z-c.z,2));
        if (dist > 2.5) p.applyKnockback(-(p.location.x - c.x), -(p.location.z - c.z), 0.5, 0);
        if (pt % 15 === 0) {
            p.applyDamage(5, {cause: "freezing", damagingEntity: y});
            p.addEffect("slowness", 50, {amplifier: 4});
        }
        if (pt >= 120) {
            y.dimension.spawnParticle("minecraft:huge_explosion_emitter", c);
            p.applyKnockback(p.location.x - c.x, p.location.z - c.z, 3.5, 0.8);
            system.clearRun(pi);
            prisonActive.delete(pid);
        }
    }, 1);
}

function summon(y) {
    const l = y.location;
    y.dimension.playSound("mob.evocation_illager.prepare_summon", l, {volume: 2, pitch: 0.8});
    const pos = [{x:5,z:0,d:0},{x:-5,z:0,d:10},{x:0,z:5,d:20},{x:0,z:-5,d:30},{x:4,z:4,d:40},{x:-4,z:-4,d:50}];
    pos.forEach(p => {
        system.runTimeout(() => {
            const sp = {x: l.x + p.x, y: l.y, z: l.z + p.z};
            let rt = 0;
            const ri = system.runInterval(() => {
                rt++;
                const a = (rt * 25) % 360;
                for (let i = 0; i < 4; i++) {
                    const rad = (a + i*90) % 360 * Math.PI / 180;
                    y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: sp.x + Math.cos(rad)*(2.5-rt/25*2), y: sp.y + i*0.4, z: sp.z + Math.sin(rad)*(2.5-rt/25*2)});
                }
                if (rt >= 25) {
                    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", sp);
                    try {
                        const m = y.dimension.spawnEntity(["minecraft:stray","minecraft:zombie","minecraft:skeleton"][Math.floor(Math.random()*3)], sp);
                        m.addEffect("speed", 999999, {amplifier: 1, showParticles: false});
                        m.addEffect("strength", 999999, {amplifier: 1, showParticles: false});
                    } catch(e) {}
                    system.clearRun(ri);
                }
            }, 1);
        }, p.d);
    });
}

function blizzard(y) {
    const l = y.location;
    y.dimension.playSound("ambient.weather.thunder", l, {volume: 2.5});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    let bt = 0;
    const bi = system.runInterval(() => {
        bt++;
        for (let i = 0; i < 8; i++) {
            const rx = l.x + (Math.random() - 0.5) * 30, rz = l.z + (Math.random() - 0.5) * 30;
            y.dimension.spawnParticle("minecraft:bleach", {x: rx, y: l.y + 20, z: rz});
            system.runTimeout(() => {
                const ip = {x: rx, y: l.y, z: rz};
                y.dimension.spawnParticle("minecraft:huge_explosion_emitter", ip);
                y.dimension.playSound("random.explode", ip);
                const hp = y.dimension.getEntities({location: ip, maxDistance: 4, type: "minecraft:player"});
                hp.forEach(p => {
                    p.applyDamage(10, {cause: "freezing", damagingEntity: y});
                    p.addEffect("slowness", 80, {amplifier: 3});
                });
            }, 30);
        }
        if (bt >= 40) system.clearRun(bi);
    }, 10);
}

function spike(y, t) {
    const l = y.location, tl = t.location;
    y.dimension.playSound("random.glass", l, {volume: 2, pitch: 0.8});
    const dx = tl.x - l.x, dz = tl.z - l.z, d = Math.sqrt(dx*dx + dz*dz);
    for (let i = 1; i <= 8; i++) {
        system.runTimeout(() => {
            const sp = {x: l.x + (dx/d)*i*2.5, y: l.y, z: l.z + (dz/d)*i*2.5};
            for (let h = 0; h < 5; h++) y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: sp.x, y: sp.y + h, z: sp.z});
            y.dimension.playSound("random.glass", sp);
            const hp = y.dimension.getEntities({location: sp, maxDistance: 2.5, type: "minecraft:player"});
            hp.forEach(p => {
                p.applyDamage(14, {cause: "entityAttack", damagingEntity: y});
                p.applyKnockback(0, 0, 0, 1.5);
            });
        }, i * 5);
    }
}

function vortex(y) {
    const l = y.location;
    y.dimension.playSound("mob.wither.spawn", l, {volume: 3});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    let vt = 0;
    const vi = system.runInterval(() => {
        vt++;
        for (let a = 0; a < 360; a += 8) {
            const rad = (a + vt * 10) % 360 * Math.PI / 180;
            for (let ly = 0; ly < 6; ly++) {
                y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: l.x + Math.cos(rad)*(15-ly*2), y: l.y + ly, z: l.z + Math.sin(rad)*(15-ly*2)});
            }
        }
        const np = y.dimension.getEntities({location: l, maxDistance: 15, excludeTypes: [YETI_P2_CFG.identifier]});
        np.forEach(p => {
            p.applyKnockback(-(p.location.x - l.x), -(p.location.z - l.z), 0.8, 0);
            if (vt % 10 === 0) {
                p.applyDamage(8, {cause: "freezing", damagingEntity: y});
                p.addEffect("slowness", 40, {amplifier: 4});
            }
        });
        if (vt >= 100) system.clearRun(vi);
    }, 2);
}

function wave(y) {
    const l = y.location;
    y.dimension.playSound("random.explode", l, {volume: 2.5});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    for (let w = 1; w <= 10; w++) {
        system.runTimeout(() => {
            const wr = w * 2;
            for (let a = 0; a < 360; a += 10) {
                for (let h = 0; h < 4; h++) {
                    y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: l.x + Math.cos(a*Math.PI/180)*wr, y: l.y + h, z: l.z + Math.sin(a*Math.PI/180)*wr});
                }
            }
            const hp = y.dimension.getEntities({location: l, maxDistance: wr+1, minDistance: wr-1, excludeTypes: [YETI_P2_CFG.identifier]});
            hp.forEach(p => {
                p.applyDamage(12, {cause: "entityAttack", damagingEntity: y});
                p.applyKnockback(p.location.x - l.x, p.location.z - l.z, 2, 0.6);
            });
        }, w * 8);
    }
}

function zero(y) {
    const l = y.location;
    y.dimension.playSound("beacon.power", l, {volume: 3, pitch: 0.5});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    let at = 0;
    const ai = system.runInterval(() => {
        at++;
        for (let a = 0; a < 360; a += 5) {
            for (let r = 5; r <= 25; r += 5) {
                y.dimension.spawnParticle("minecraft:bleach", {x: l.x + Math.cos(a*Math.PI/180)*r, y: l.y + Math.sin(at*5)*3, z: l.z + Math.sin(a*Math.PI/180)*r});
            }
        }
        const np = y.dimension.getEntities({location: l, maxDistance: 25, excludeTypes: [YETI_P2_CFG.identifier]});
        np.forEach(p => {
            p.addEffect("slowness", 40, {amplifier: 5});
            p.addEffect("weakness", 40, {amplifier: 3});
            if (at % 10 === 0) p.applyDamage(15, {cause: "freezing", damagingEntity: y});
        });
        if (at >= 80) system.clearRun(ai);
    }, 5);
}

function jump(y, t) {
    const sp = y.location, tp = t.location;
    y.dimension.playSound("mob.irongolem.throw", sp, {volume: 2});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", sp);
    y.teleport({x: sp.x, y: sp.y + 12, z: sp.z}, {dimension: y.dimension});
    system.runTimeout(() => {
        const lp = {x: tp.x, y: tp.y, z: tp.z};
        y.teleport(lp, {dimension: y.dimension});
        y.dimension.spawnParticle("minecraft:huge_explosion_emitter", lp);
        y.dimension.playSound("random.explode", lp, {volume: 2.5});
        for (let i = 0; i < 3; i++) {
            system.runTimeout(() => {
                y.dimension.spawnParticle("minecraft:huge_explosion_emitter", lp);
            }, i * 5);
        }
        const hp = y.dimension.getEntities({location: lp, maxDistance: 8, excludeTypes: [YETI_P2_CFG.identifier]});
        hp.forEach(p => {
            const d = Math.sqrt(Math.pow(p.location.x-lp.x,2) + Math.pow(p.location.z-lp.z,2));
            const dmg = 25 - Math.floor(d * 3);
            p.applyDamage(Math.max(dmg, 8), {cause: "entityAttack", damagingEntity: y});
            p.applyKnockback(p.location.x - lp.x, p.location.z - lp.z, 3.5, 0.8);
        });
        for (let a = 0; a < 360; a += 15) {
            const rad = a * Math.PI / 180;
            y.dimension.spawnParticle("minecraft:blue_flame_particle", {x: lp.x + Math.cos(rad)*7, y: lp.y, z: lp.z + Math.sin(rad)*7});
        }
    }, 25);
}

function earthquake(y) {
    const l = y.location;
    y.dimension.playSound("mob.irongolem.throw", l, {volume: 2.5, pitch: 0.5});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    y.teleport({x: l.x, y: l.y + 8, z: l.z}, {dimension: y.dimension});
    system.runTimeout(() => {
        y.teleport(l, {dimension: y.dimension});
        y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
        y.dimension.playSound("random.explode", l, {volume: 3, pitch: 0.6});
        for (let w = 1; w <= 8; w++) {
            system.runTimeout(() => {
                const wr = w * 3;
                for (let a = 0; a < 360; a += 15) {
                    const rad = a * Math.PI / 180;
                    const pos = {x: l.x + Math.cos(rad)*wr, y: l.y, z: l.z + Math.sin(rad)*wr};
                    y.dimension.spawnParticle("minecraft:blue_flame_particle", pos);
                    y.dimension.spawnParticle("minecraft:snowflake_particle", pos);
                    if (w % 2 === 0) y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", pos);
                }
                y.dimension.playSound("dig.stone", l, {volume: 1.5, pitch: 0.8});
                const hp = y.dimension.getEntities({location: l, maxDistance: wr+1, minDistance: wr-1, excludeTypes: [YETI_P2_CFG.identifier]});
                hp.forEach(p => {
                    p.applyDamage(10, {cause: "entityAttack", damagingEntity: y});
                    p.addEffect("slowness", 60, {amplifier: 2});
                    p.applyKnockback(p.location.x - l.x, p.location.z - l.z, 1.5, 0.3);
                });
            }, w * 6);
        }
    }, 20);
}

function eliteArmy(y) {
    const l = y.location;
    y.dimension.playSound("mob.evocation_illager.prepare_summon", l, {volume: 3, pitch: 0.7});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    const pos = [{x:7,z:0,d:0},{x:-7,z:0,d:12},{x:0,z:7,d:24},{x:0,z:-7,d:36},{x:5,z:5,d:48},{x:-5,z:-5,d:60},{x:5,z:-5,d:72},{x:-5,z:5,d:84}];
    const elites = ["pa:yeti_boss_pet","minecraft:wither_skeleton","minecraft:husk"];
    pos.forEach(p => {
        system.runTimeout(() => {
            const sp = {x: l.x + p.x, y: l.y, z: l.z + p.z};
            let rt = 0;
            const ri = system.runInterval(() => {
                rt++;
                const a = (rt * 30) % 360;
                for (let i = 0; i < 6; i++) {
                    const ra = (a + i*60) % 360 * Math.PI / 180;
                    const r = 3 - (rt/20) * 2.5;
                    y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: sp.x + Math.cos(ra)*r, y: sp.y + 0.5 + i*0.5, z: sp.z + Math.sin(ra)*r});
                    y.dimension.spawnParticle("minecraft:blue_flame_particle", {x: sp.x + Math.cos(ra)*r, y: sp.y + 0.5 + i*0.5, z: sp.z + Math.sin(ra)*r});
                }
                if (rt % 4 === 0) y.dimension.spawnParticle("minecraft:bleach", {x: sp.x, y: sp.y + 1.5, z: sp.z});
                if (rt >= 20) {
                    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", sp);
                    y.dimension.playSound("mob.evocation_illager.cast_spell", sp, {volume: 1.5});
                    const elite = elites[Math.floor(Math.random()*elites.length)];
                    try {
                        const m = y.dimension.spawnEntity(elite, sp);
                        m.addEffect("speed", 999999, {amplifier: 2, showParticles: false});
                        m.addEffect("strength", 999999, {amplifier: 2, showParticles: false});
                        m.addEffect("resistance", 999999, {amplifier: 1, showParticles: false});
                        y.dimension.spawnParticle("minecraft:totem_particle", {x: sp.x, y: sp.y + 1, z: sp.z});
                    } catch(e) {}
                    system.clearRun(ri);
                }
            }, 1);
        }, p.d);
    });
}

function handleP2(y) {
    if (!y.isValid()) return;
    const eid = y.id;
    if (!p2CD.has(eid)) {
        p2CD.set(eid, {iceBall:0,roar:0,iceRegen:0,giantIceBall:0,summonMinions:0,blizzardRain:0,frostSpike:0,iceClone:0,polarVortex:0,glacialWave:0,absoluteZero:0});
    }
    const cd = p2CD.get(eid), ct = system.currentTick;
    const t = y.dimension.getEntities({location: y.location, maxDistance: YETI_P2_CFG.detectRange, type: "minecraft:player", closest: 1})[0];
    if (!t) return;
    const d = Math.sqrt(Math.pow(t.location.x-y.location.x,2) + Math.pow(t.location.z-y.location.z,2));
    let hp = 1;
    try {
        const h = y.getComponent("minecraft:health");
        if (h) hp = h.currentValue / YETI_P2_CFG.health;
    } catch(e) {}
    
    if (hp < 0.2 && ct >= cd.absoluteZero) {
        zero(y);
        cd.absoluteZero = ct + YETI_P2_CFG.skillCooldowns.absoluteZero;
        return;
    }
    if (hp < 0.3 && ct >= cd.iceRegen && !shieldActive.has(eid)) {
        regen(y);
        cd.iceRegen = ct + YETI_P2_CFG.skillCooldowns.iceRegen;
        return;
    }
    if (hp < 0.4 && ct >= cd.iceClone) {
        clone(y);
        cd.iceClone = ct + YETI_P2_CFG.skillCooldowns.iceClone;
    }
    if (hp < 0.5 && ct >= cd.summonMinions) {
        summon(y);
        cd.summonMinions = ct + YETI_P2_CFG.skillCooldowns.summonMinions;
    }
    if (hp < 0.6 && ct >= cd.polarVortex) {
        vortex(y);
        cd.polarVortex = ct + YETI_P2_CFG.skillCooldowns.polarVortex;
    }
    
    if (d > 20 && ct >= cd.blizzardRain) {
        blizzard(y);
        cd.blizzardRain = ct + YETI_P2_CFG.skillCooldowns.blizzardRain;
    } else if (d > 15 && ct >= cd.giantIceBall) {
        giantBall(y, t);
        cd.giantIceBall = ct + YETI_P2_CFG.skillCooldowns.giantIceBall;
    } else if (d > 12 && ct >= cd.frostSpike) {
        spike(y, t);
        cd.frostSpike = ct + YETI_P2_CFG.skillCooldowns.frostSpike;
    } else if (d > 10 && ct >= cd.iceBall) {
        iceBall(y, t);
        cd.iceBall = ct + YETI_P2_CFG.skillCooldowns.iceBall;
    } else if (d <= 10 && ct >= cd.glacialWave) {
        wave(y);
        cd.glacialWave = ct + YETI_P2_CFG.skillCooldowns.glacialWave;
    } else if (d <= 8 && ct >= cd.roar) {
        roar(y);
        cd.roar = ct + YETI_P2_CFG.skillCooldowns.roar;
    }
}

system.runInterval(() => {
    world.getDimension("overworld").getEntities({type: YETI_P2_CFG.identifier}).forEach(y => handleP2(y));
}, 1);

world.afterEvents.entityDie.subscribe((e) => {
    if (e.deadEntity.typeId === YETI_P2_CFG.identifier) {
        p2CD.delete(e.deadEntity.id);
        shieldActive.delete(e.deadEntity.id);
        prisonActive.clear();
        e.deadEntity.dimension.spawnParticle("minecraft:huge_explosion_emitter", e.deadEntity.location);
        e.deadEntity.dimension.playSound("random.explode", e.deadEntity.location);
    }
});

console.warn("Yeti Phase 2 loaded!");