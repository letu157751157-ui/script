import { world, system } from "@minecraft/server";

const YETI_P3_CFG = {
    identifier: "pa:yeti_phase3",
    health: 800,
    detectRange: 40,
    allyTypes: ["pa:yeti_boss_pet", "minecraft:wither_skeleton", "minecraft:husk", "minecraft:stray"],
    skillCooldowns: {
        roar: 140, iceRegen: 52000, blizzardRain: 400, frostSpike: 120,
        polarVortex: 22000, glacialWave: 110, absoluteZero: 880,
        jump: 60, eliteArmy: 2200, earthquake: 300, iceChains: 140,
        crystalBarrage: 155, frostNova: 800, glacialPrison: 620
    }
};

const p3CD = new Map(), shieldActive = new Map(), prisonActive = new Map(), armorActive = new Map();

function roar(y) {
    const l = y.location;
    y.dimension.playSound("mob.enderdragon.growl", l, {volume: 2.5, pitch: 0.5});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    for (let rg = 1; rg <= 9; rg++) {
        system.runTimeout(() => {
            const rr = rg * 2.5;
            for (let a = 0; a < 360; a += 10) {
                y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: l.x + Math.cos(a*Math.PI/180)*rr, y: l.y + 1, z: l.z + Math.sin(a*Math.PI/180)*rr});
            }
            const ap = y.dimension.getEntities({location: l, maxDistance: rr+1, minDistance: rr-1, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
            ap.forEach(p => {
                p.applyDamage(Math.max(20 - Math.floor(rr/22*8), 10), {cause: "sonic_boom", damagingEntity: y});
                p.addEffect("slowness", 160, {amplifier: 4});
                p.applyKnockback(p.location.x - l.x, p.location.z - l.z, 0.8, 0.4);
            });
        }, rg * 7);
    }
}

function regen(y) {
    const l = y.location, eid = y.id;
    shieldActive.set(eid, true);
    y.dimension.playSound("beacon.power", l, {volume: 2.5, pitch: 1.5});
    let hp = 1;
    try {
        const h = y.getComponent("minecraft:health");
        if (h) hp = h.currentValue / YETI_P3_CFG.health;
    } catch(e) {}
    const isLow = hp < 0.25;
    const regen = isLow ? 15 : 8, dur = isLow ? 140 : 120;
    if (isLow) {
        try {
            y.addEffect("resistance", 999999, {amplifier: 3, showParticles: false});
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
        const cl = y.location, ang = (rt * 18) % 360;
        if (rt % 2 === 0) {
            for (let ly = 0; ly < (isLow ? 3 : 2); ly++) {
                for (let i = 0; i < 8; i++) {
                    const rad = (ang + i*45 + ly*22.5) % 360 * Math.PI / 180;
                    const r = (isLow ? 4 : 3.5) + ly*0.6;
                    y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: cl.x + Math.cos(rad)*r, y: cl.y + 1 + ly*0.8, z: cl.z + Math.sin(rad)*r});
                }
            }
        }
        if (rt % 8 === 0) {
            try {
                const h = y.getComponent("minecraft:health");
                if (h) h.setCurrentValue(Math.min(h.currentValue + regen, YETI_P3_CFG.health));
            } catch(e) {}
        }
        const np = y.dimension.getEntities({location: cl, maxDistance: isLow ? 8 : 7, type: "minecraft:player"});
        np.forEach(p => {
            p.applyKnockback(p.location.x - cl.x, p.location.z - cl.z, isLow ? 2.5 : 2, 0.6);
            if (rt % 15 === 0) p.applyDamage(isLow ? 12 : 8, {cause: "freezing", damagingEntity: y});
        });
        if (rt >= dur) {
            system.clearRun(ri);
            shieldActive.delete(eid);
            y.dimension.spawnParticle("minecraft:huge_explosion_emitter", cl);
        }
    }, 1);
}

function blizzard(y) {
    const l = y.location;
    y.dimension.playSound("ambient.weather.thunder", l, {volume: 3});
    let bt = 0;
    const bi = system.runInterval(() => {
        bt++;
        for (let i = 0; i < 12; i++) {
            const rx = l.x + (Math.random() - 0.5) * 35, rz = l.z + (Math.random() - 0.5) * 35;
            y.dimension.spawnParticle("minecraft:bleach", {x: rx, y: l.y + 25, z: rz});
            system.runTimeout(() => {
                const ip = {x: rx, y: l.y, z: rz};
                y.dimension.spawnParticle("minecraft:huge_explosion_emitter", ip);
                const hp = y.dimension.getEntities({location: ip, maxDistance: 5, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
                hp.forEach(p => {
                    p.applyDamage(14, {cause: "freezing", damagingEntity: y});
                    p.addEffect("slowness", 100, {amplifier: 4});
                });
            }, 25);
        }
        if (bt >= 50) system.clearRun(bi);
    }, 8);
}

function spike(y, t) {
    const l = y.location, tl = t.location;
    y.dimension.playSound("random.glass", l, {volume: 2.5, pitch: 0.7});
    const dx = tl.x - l.x, dz = tl.z - l.z, d = Math.sqrt(dx*dx + dz*dz);
    for (let i = 1; i <= 10; i++) {
        system.runTimeout(() => {
            const sp = {x: l.x + (dx/d)*i*2.5, y: l.y, z: l.z + (dz/d)*i*2.5};
            for (let h = 0; h < 6; h++) y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: sp.x, y: sp.y + h, z: sp.z});
            const hp = y.dimension.getEntities({location: sp, maxDistance: 3, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
            hp.forEach(p => {
                p.applyDamage(18, {cause: "entityAttack", damagingEntity: y});
                p.applyKnockback(0, 0, 0, 1.8);
            });
        }, i * 4);
    }
}

function vortex(y) {
    const l = y.location;
    y.dimension.playSound("mob.wither.spawn", l, {volume: 3.5});
    let vt = 0;
    const vi = system.runInterval(() => {
        vt++;
        for (let a = 0; a < 360; a += 15) {
            const rad = (a + vt * 12) % 360 * Math.PI / 180;
            for (let ly = 0; ly < 8; ly++) {
                if (ly % 2 === 0) {
                    y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: l.x + Math.cos(rad)*(18-ly*2.2), y: l.y + ly, z: l.z + Math.sin(rad)*(18-ly*2.2)});
                }
                if (ly % 3 === 0) {
                    y.dimension.spawnParticle("minecraft:blue_flame_particle", {x: l.x + Math.cos(rad)*(18-ly*2.2), y: l.y + ly, z: l.z + Math.sin(rad)*(18-ly*2.2)});
                }
            }
        }
        if (vt % 4 === 0) {
            for (let a = 0; a < 360; a += 30) {
                const rad = (a + vt * 8) % 360 * Math.PI / 180;
                y.dimension.spawnParticle("minecraft:water_evaporation_bucket_emitter", {x: l.x + Math.cos(rad)*12, y: l.y + 3, z: l.z + Math.sin(rad)*12});
            }
        }
        const np = y.dimension.getEntities({location: l, maxDistance: 18, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
        np.forEach(p => {
            p.applyKnockback(-(p.location.x - l.x), -(p.location.z - l.z), 1, 0);
            if (vt % 8 === 0) {
                p.applyDamage(10, {cause: "freezing", damagingEntity: y});
                p.addEffect("slowness", 50, {amplifier: 5});
            }
        });
        if (vt >= 120) system.clearRun(vi);
    }, 2);
}

function wave(y) {
    const l = y.location;
    y.dimension.playSound("random.explode", l, {volume: 3});
    for (let w = 1; w <= 12; w++) {
        system.runTimeout(() => {
            const wr = w * 2.2;
            for (let a = 0; a < 360; a += 8) {
                for (let h = 0; h < 5; h++) {
                    y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: l.x + Math.cos(a*Math.PI/180)*wr, y: l.y + h, z: l.z + Math.sin(a*Math.PI/180)*wr});
                }
            }
            const hp = y.dimension.getEntities({location: l, maxDistance: wr+1, minDistance: wr-1, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
            hp.forEach(p => {
                p.applyDamage(15, {cause: "entityAttack", damagingEntity: y});
                p.applyKnockback(p.location.x - l.x, p.location.z - l.z, 2.5, 0.7);
            });
        }, w * 7);
    }
}

function zero(y) {
    const l = y.location;
    y.dimension.playSound("beacon.power", l, {volume: 4, pitch: 0.4});
    let at = 0;
    const ai = system.runInterval(() => {
        at++;
        for (let a = 0; a < 360; a += 4) {
            for (let r = 5; r <= 30; r += 5) {
                y.dimension.spawnParticle("minecraft:bleach", {x: l.x + Math.cos(a*Math.PI/180)*r, y: l.y + Math.sin(at*6)*4, z: l.z + Math.sin(a*Math.PI/180)*r});
            }
        }
        const np = y.dimension.getEntities({location: l, maxDistance: 30, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
        np.forEach(p => {
            p.addEffect("slowness", 50, {amplifier: 6});
            p.addEffect("weakness", 50, {amplifier: 4});
            if (at % 8 === 0) p.applyDamage(20, {cause: "freezing", damagingEntity: y});
        });
        if (at >= 100) system.clearRun(ai);
    }, 4);
}

function jump(y, t) {
    const sp = y.location, tp = t.location;
    y.dimension.playSound("mob.irongolem.throw", sp, {volume: 2.5});
    y.teleport({x: sp.x, y: sp.y + 15, z: sp.z}, {dimension: y.dimension});
    system.runTimeout(() => {
        const lp = {x: tp.x, y: tp.y, z: tp.z};
        y.teleport(lp, {dimension: y.dimension});
        y.dimension.spawnParticle("minecraft:huge_explosion_emitter", lp);
        y.dimension.playSound("random.explode", lp, {volume: 3});
        const hp = y.dimension.getEntities({location: lp, maxDistance: 10, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
        hp.forEach(p => {
            const d = Math.sqrt(Math.pow(p.location.x-lp.x,2) + Math.pow(p.location.z-lp.z,2));
            p.applyDamage(Math.max(32 - Math.floor(d * 3), 10), {cause: "entityAttack", damagingEntity: y});
            p.applyKnockback(p.location.x - lp.x, p.location.z - lp.z, 4, 1);
        });
    }, 20);
}

function earthquake(y) {
    const l = y.location;
    y.dimension.playSound("mob.irongolem.throw", l, {volume: 3, pitch: 0.4});
    y.dimension.playSound("mob.enderdragon.flap", l, {volume: 2.5, pitch: 0.6});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    
    y.teleport({x: l.x, y: l.y + 6, z: l.z}, {dimension: y.dimension});
    
    system.runTimeout(() => {
        y.teleport(l, {dimension: y.dimension});
        y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
        y.dimension.playSound("random.explode", l, {volume: 3.5, pitch: 0.5});
        y.dimension.playSound("mob.irongolem.death", l, {volume: 3, pitch: 0.3});
        y.dimension.playSound("ambient.weather.thunder", l, {volume: 2.5, pitch: 0.7});
        
        for (let i = 0; i < 5; i++) {
            system.runTimeout(() => {
                y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
            }, i * 3);
        }
        
        for (let w = 1; w <= 10; w++) {
            system.runTimeout(() => {
                const wr = w * 3.5;
                for (let a = 0; a < 360; a += 20) {
                    const pos = {x: l.x + Math.cos(a*Math.PI/180)*wr, y: l.y, z: l.z + Math.sin(a*Math.PI/180)*wr};
                    if (a % 40 === 0) {
                        y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", pos);
                        y.dimension.spawnParticle("minecraft:blue_flame_particle", pos);
                    }
                    if (w % 3 === 0 && a % 60 === 0) {
                        y.dimension.spawnParticle("minecraft:snowflake_particle", pos);
                    }
                }
                if (w % 2 === 0) {
                    y.dimension.playSound("dig.stone", l, {volume: 2, pitch: 0.7});
                }
                
                const hp = y.dimension.getEntities({location: l, maxDistance: wr+1, minDistance: wr-1, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
                hp.forEach(p => {
                    p.applyDamage(13, {cause: "entityAttack", damagingEntity: y});
                    p.addEffect("slowness", 80, {amplifier: 3});
                    p.applyKnockback(p.location.x - l.x, p.location.z - l.z, 2, 0.4);
                });
            }, w * 5);
        }
    }, 15);
}

function eliteArmy(y) {
    const l = y.location;
    y.dimension.playSound("mob.evocation_illager.prepare_summon", l, {volume: 3, pitch: 0.7});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    
    const pos = [
        {x:7,z:0,d:0},{x:-7,z:0,d:12},{x:0,z:7,d:24},{x:0,z:-7,d:36},
        {x:5,z:5,d:48},{x:-5,z:-5,d:60},{x:5,z:-5,d:72},{x:-5,z:5,d:84},
        {x:10,z:0,d:96},{x:-10,z:0,d:108},{x:0,z:10,d:120},{x:0,z:-10,d:132}
    ];
    
    pos.forEach(p => {
        system.runTimeout(() => {
            const sp = {x: l.x + p.x, y: l.y, z: l.z + p.z};
            let rt = 0;
            const ri = system.runInterval(() => {
                rt++;
                if (rt % 2 === 0) {
                    for (let i = 0; i < 6; i += 2) {
                        y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {
                            x: sp.x + Math.cos(((rt*30)+i*60)*Math.PI/180)*(3-(rt/20)*2.5), 
                            y: sp.y + i*0.5, 
                            z: sp.z + Math.sin(((rt*30)+i*60)*Math.PI/180)*(3-(rt/20)*2.5)
                        });
                        if (i % 4 === 0) {
                            y.dimension.spawnParticle("minecraft:blue_flame_particle", {
                                x: sp.x + Math.cos(((rt*30)+i*60)*Math.PI/180)*(3-(rt/20)*2.5), 
                                y: sp.y + i*0.5, 
                                z: sp.z + Math.sin(((rt*30)+i*60)*Math.PI/180)*(3-(rt/20)*2.5)
                            });
                        }
                    }
                }
                if (rt >= 20) {
                    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", sp);
                    y.dimension.playSound("mob.evocation_illager.cast_spell", sp, {volume: 1.5});
                    try {
                        const elites = ["pa:yeti_boss_pet", "minecraft:wither_skeleton", "minecraft:husk", "minecraft:stray"];
                        const m = y.dimension.spawnEntity(elites[Math.floor(Math.random()*elites.length)], sp);
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

function chains(y, t) {
    const l = y.location, tl = t.location;
    y.dimension.playSound("mob.irongolem.hit", l, {volume: 2});
    const dx = tl.x - l.x, dz = tl.z - l.z, d = Math.sqrt(dx*dx + dz*dz);
    for (let i = 0; i <= d; i += 0.5) {
        const cp = {x: l.x + (dx/d)*i, y: l.y + 1, z: l.z + (dz/d)*i};
        y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", cp);
    }
    t.addEffect("slowness", 200, {amplifier: 6});
    t.addEffect("weakness", 200, {amplifier: 3});
    let ct = 0;
    const ci = system.runInterval(() => {
        if (!t.isValid()) {
            system.clearRun(ci);
            return;
        }
        ct++;
        const tl = t.location;
        for (let a = 0; a < 360; a += 30) {
            y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: tl.x + Math.cos(a*Math.PI/180)*1.5, y: tl.y + 1, z: tl.z + Math.sin(a*Math.PI/180)*1.5});
        }
        if (ct % 20 === 0) t.applyDamage(6, {cause: "freezing", damagingEntity: y});
        if (ct >= 200) system.clearRun(ci);
    }, 1);
}

function barrage(y) {
    const l = y.location;
    y.dimension.playSound("random.bow", l, {volume: 2});
    for (let i = 0; i < 12; i++) {
        system.runTimeout(() => {
            const a = Math.random() * 360, r = 5 + Math.random() * 15;
            const tp = {x: l.x + Math.cos(a*Math.PI/180)*r, y: l.y, z: l.z + Math.sin(a*Math.PI/180)*r};
            y.dimension.spawnParticle("minecraft:bleach", {x: tp.x, y: tp.y + 20, z: tp.z});
            system.runTimeout(() => {
                y.dimension.spawnParticle("minecraft:huge_explosion_emitter", tp);
                const hp = y.dimension.getEntities({location: tp, maxDistance: 3, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
                hp.forEach(p => {
                    p.applyDamage(12, {cause: "projectile", damagingEntity: y});
                    p.addEffect("slowness", 60, {amplifier: 2});
                });
            }, 25);
        }, i * 8);
    }
}

function nova(y) {
    const l = y.location;
    y.dimension.playSound("random.explode", l, {volume: 3});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    for (let r = 2; r <= 16; r += 2) {
        system.runTimeout(() => {
            for (let a = 0; a < 360; a += 10) {
                for (let h = 0; h < 6; h++) {
                    y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: l.x + Math.cos(a*Math.PI/180)*r, y: l.y + h, z: l.z + Math.sin(a*Math.PI/180)*r});
                }
            }
            const hp = y.dimension.getEntities({location: l, maxDistance: r+1, minDistance: r-1, excludeTypes: [YETI_P3_CFG.identifier, ...YETI_P3_CFG.allyTypes]});
            hp.forEach(p => {
                p.applyDamage(16, {cause: "freezing", damagingEntity: y});
                p.applyKnockback(p.location.x - l.x, p.location.z - l.z, 3, 0.8);
            });
        }, (r/2) * 10);
    }
}

function frozenTomb(y, t) {
    const tl = t.location;
    const center = {x: Math.floor(tl.x), y: Math.floor(tl.y), z: Math.floor(tl.z)};
    y.dimension.playSound("random.glass", center, {volume: 2.5, pitch: 0.6});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
    
    const wallBlocks = [];
    for (let x = -2; x <= 2; x++) {
        for (let y = 0; y <= 4; y++) {
            for (let z = -2; z <= 2; z++) {
                if (Math.abs(x) === 2 || Math.abs(z) === 2 || y === 0 || y === 4) {
                    if (!(x === 0 && z === 0 && y <= 3)) {
                        const pos = {x: center.x + x, y: center.y + y, z: center.z + z};
                        wallBlocks.push(pos);
                        try {
                            const block = y.dimension.getBlock(pos);
                            if (block && block.typeId === "minecraft:air") {
                                block.setType("minecraft:ice");
                            }
                        } catch(e) {}
                    }
                }
            }
        }
    }
    
    let tombTime = 0;
    const tombInterval = system.runInterval(() => {
        if (!t.isValid()) {
            system.clearRun(tombInterval);
            wallBlocks.forEach(pos => {
                try {
                    const block = y.dimension.getBlock(pos);
                    if (block && block.typeId === "minecraft:ice") {
                        block.setType("minecraft:air");
                    }
                } catch(e) {}
            });
            return;
        }
        tombTime++;
        
        for (let a = 0; a < 360; a += 30) {
            for (let h = 0; h <= 4; h++) {
                y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {
                    x: center.x + Math.cos(a*Math.PI/180)*2.5, 
                    y: center.y + h, 
                    z: center.z + Math.sin(a*Math.PI/180)*2.5
                });
            }
        }
        
        if (tombTime % 20 === 0) {
            t.applyDamage(8, {cause: "freezing", damagingEntity: y});
            t.addEffect("slowness", 40, {amplifier: 4});
            t.addEffect("mining_fatigue", 40, {amplifier: 3});
        }
        
        if (tombTime >= 140) {
            wallBlocks.forEach(pos => {
                try {
                    const block = y.dimension.getBlock(pos);
                    if (block && block.typeId === "minecraft:ice") {
                        block.setType("minecraft:air");
                        y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {x: pos.x, y: pos.y, z: pos.z});
                    }
                } catch(e) {}
            });
            y.dimension.playSound("random.glass", center, {volume: 2});
            y.dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
            system.clearRun(tombInterval);
        }
    }, 1);
}

function frostArmor(y) {
    const eid = y.id;
    const l = y.location;
    armorActive.set(eid, true);
    
    y.dimension.playSound("beacon.activate", l, {volume: 2, pitch: 1.2});
    y.dimension.spawnParticle("minecraft:huge_explosion_emitter", l);
    
    try {
        y.addEffect("resistance", 200, {amplifier: 2, showParticles: false});
    } catch(e) {}
    
    let armorTime = 0;
    const armorInterval = system.runInterval(() => {
        if (!y.isValid()) {
            system.clearRun(armorInterval);
            armorActive.delete(eid);
            return;
        }
        armorTime++;
        const cl = y.location;
        const rotation = (armorTime * 10) % 360;
        
        if (armorTime % 2 === 0) {
            for (let layer = 0; layer < 3; layer++) {
                for (let i = 0; i < 8; i++) {
                    const angle = (rotation + i * 45 + layer * 15) % 360;
                    const rad = angle * Math.PI / 180;
                    const radius = 2.5 + layer * 0.4;
                    y.dimension.spawnParticle("minecraft:ice_evaporation_emitter", {
                        x: cl.x + Math.cos(rad) * radius,
                        y: cl.y + 1.2 + layer * 0.6,
                        z: cl.z + Math.sin(rad) * radius
                    });
                    if (i % 2 === 0) {
                        y.dimension.spawnParticle("minecraft:blue_flame_particle", {
                            x: cl.x + Math.cos(rad) * radius,
                            y: cl.y + 1.2 + layer * 0.6,
                            z: cl.z + Math.sin(rad) * radius
                        });
                    }
                }
            }
        }
        
        const nearPlayers = y.dimension.getEntities({location: cl, maxDistance: 4, type: "minecraft:player"});
        nearPlayers.forEach(p => {
            if (armorTime % 10 === 0) {
                p.addEffect("slowness", 60, {amplifier: 1});
            }
        });
        
        if (armorTime >= 200) {
            system.clearRun(armorInterval);
            armorActive.delete(eid);
            y.dimension.spawnParticle("minecraft:huge_explosion_emitter", cl);
            y.dimension.playSound("random.glass", cl, {volume: 1.5});
        }
    }, 1);
}

function handleP3(y) {
    if (!y.isValid()) return;
    const eid = y.id;
    if (!p3CD.has(eid)) {
        p3CD.set(eid, {roar:0,iceRegen:0,blizzardRain:0,frostSpike:0,polarVortex:0,glacialWave:0,absoluteZero:0,jump:0,eliteArmy:0,earthquake:0,iceChains:0,crystalBarrage:0,frostNova:0,frozenTomb:0,frostArmor:0});
    }
    const cd = p3CD.get(eid), ct = system.currentTick;
    const t = y.dimension.getEntities({location: y.location, maxDistance: YETI_P3_CFG.detectRange, type: "minecraft:player", closest: 1})[0];
    if (!t) return;
    const d = Math.sqrt(Math.pow(t.location.x-y.location.x,2) + Math.pow(t.location.z-y.location.z,2));
    let hp = 1;
    try {
        const h = y.getComponent("minecraft:health");
        if (h) hp = h.currentValue / YETI_P3_CFG.health;
    } catch(e) {}
    
    if (hp < 0.15 && ct >= cd.absoluteZero) {
        zero(y);
        cd.absoluteZero = ct + YETI_P3_CFG.skillCooldowns.absoluteZero;
        return;
    }
    if (hp < 0.3 && ct >= cd.iceRegen && !shieldActive.has(eid)) {
        regen(y);
        cd.iceRegen = ct + YETI_P3_CFG.skillCooldowns.iceRegen;
        return;
    }
    
    if (hp < 0.5 && ct >= cd.frostArmor && !armorActive.has(eid)) {
        frostArmor(y);
        cd.frostArmor = ct + YETI_P3_CFG.skillCooldowns.frostArmor;
    }
    
    if (ct >= cd.eliteArmy) {
        eliteArmy(y);
        cd.eliteArmy = ct + YETI_P3_CFG.skillCooldowns.eliteArmy;
    }
    
    if (d > 20 && ct >= cd.blizzardRain) {
        blizzard(y);
        cd.blizzardRain = ct + YETI_P3_CFG.skillCooldowns.blizzardRain;
    } else if (d > 15 && ct >= cd.crystalBarrage) {
        barrage(y);
        cd.crystalBarrage = ct + YETI_P3_CFG.skillCooldowns.crystalBarrage;
    } else if (d > 12 && ct >= cd.frostSpike) {
        spike(y, t);
        cd.frostSpike = ct + YETI_P3_CFG.skillCooldowns.frostSpike;
    } else if (d > 10 && ct >= cd.iceChains) {
        chains(y, t);
        cd.iceChains = ct + YETI_P3_CFG.skillCooldowns.iceChains;
    } else if (d > 8 && ct >= cd.frozenTomb) {
        frozenTomb(y, t);
        cd.frozenTomb = ct + YETI_P3_CFG.skillCooldowns.frozenTomb;
    } else if (d > 8 && ct >= cd.polarVortex) {
        vortex(y);
        cd.polarVortex = ct + YETI_P3_CFG.skillCooldowns.polarVortex;
    } else if (d <= 10 && ct >= cd.glacialWave) {
        wave(y);
        cd.glacialWave = ct + YETI_P3_CFG.skillCooldowns.glacialWave;
    } else if (d <= 8 && ct >= cd.frostNova) {
        nova(y);
        cd.frostNova = ct + YETI_P3_CFG.skillCooldowns.frostNova;
    } else if (d <= 6 && ct >= cd.roar) {
        roar(y);
        cd.roar = ct + YETI_P3_CFG.skillCooldowns.roar;
    }
    
    if (d > 15 && ct >= cd.jump) {
        jump(y, t);
        cd.jump = ct + YETI_P3_CFG.skillCooldowns.jump;
    }
    
    if (ct >= cd.earthquake) {
        earthquake(y);
        cd.earthquake = ct + YETI_P3_CFG.skillCooldowns.earthquake;
    }
}

system.runInterval(() => {
    world.getDimension("overworld").getEntities({type: YETI_P3_CFG.identifier}).forEach(y => handleP3(y));
}, 1);

world.afterEvents.entityDie.subscribe((e) => {
    if (e.deadEntity.typeId === YETI_P3_CFG.identifier) {
        p3CD.delete(e.deadEntity.id);
        shieldActive.delete(e.deadEntity.id);
        armorActive.delete(e.deadEntity.id);
        prisonActive.clear();
        e.deadEntity.dimension.spawnParticle("minecraft:huge_explosion_emitter", e.deadEntity.location);
        e.deadEntity.dimension.playSound("random.explode", e.deadEntity.location, {volume: 3});
    }
});

world.afterEvents.entityHurt.subscribe((e) => {
    if (e.hurtEntity.typeId === YETI_P3_CFG.identifier && armorActive.has(e.hurtEntity.id)) {
        const attacker = e.damageSource.damagingEntity;
        if (attacker && attacker.typeId === "minecraft:player") {
            const reflectDamage = e.damage * 0.3;
            system.runTimeout(() => {
                try {
                    attacker.applyDamage(reflectDamage, {cause: "thorns", damagingEntity: e.hurtEntity});
                    attacker.addEffect("slowness", 60, {amplifier: 1});
                    attacker.dimension.spawnParticle("minecraft:ice_evaporation_emitter", attacker.location);
                } catch(err) {}
            }, 1);
        }
    }
});

console.warn("Yeti Phase 3 loaded!");