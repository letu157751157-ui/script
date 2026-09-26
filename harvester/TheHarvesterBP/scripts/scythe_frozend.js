import { world, system, EntityDamageCause } from '@minecraft/server';

const SCYTHE_ID = 'pa:frozendscythe';
const SWORD_ID = 'pa:frozendsword';
const COOLDOWNS = { void_barrier: new Map(), void_pulse: new Map(), dimensional_collapse: new Map() };
const holdingStartTime = new Map();
let barrierChargingPlayers = new Map();
let lastJumpTime = new Map();

function hasFrozendWeapon(p) {
    const inv = p.getComponent('inventory');
    const item = inv.container.getItem(p.selectedSlotIndex);
    return item?.typeId === SCYTHE_ID || item?.typeId === SWORD_ID;
}

function isOnCooldown(p, skill) {
    const last = COOLDOWNS[skill].get(p.id);
    if (!last) return false;
    const times = { void_barrier: 12000, void_pulse: 20000, dimensional_collapse: 30000 };
    return (Date.now() - last) < times[skill];
}

function setCooldown(p, skill) {
    COOLDOWNS[skill].set(p.id, Date.now());
}

function getEntitiesInRadius(dim, loc, r) {
    const entities = [];
    for (const e of dim.getEntities()) {
        if (e.typeId === 'minecraft:player') continue;
        const d = Math.sqrt(Math.pow(e.location.x - loc.x, 2) + Math.pow(e.location.y - loc.y, 2) + Math.pow(e.location.z - loc.z, 2));
        if (d <= r) entities.push(e);
    }
    return entities;
}

function spawnParticles(dim, loc, types, count) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.8;
        const h = Math.random() * 1.5;
        types.forEach(t => {
            dim.spawnParticle(t, { x: loc.x + Math.cos(a) * r, y: loc.y + h, z: loc.z + Math.sin(a) * r });
        });
    }
}

world.afterEvents.entityHurt.subscribe((e) => {
    const att = e.damageSource.damagingEntity;
    const vic = e.hurtEntity;
    if (!att || att.typeId !== 'minecraft:player' || !hasFrozendWeapon(att)) return;
    
    try {
        vic.addEffect('slowness', 80, { amplifier: 2, showParticles: true });
        if (Math.random() < 0.35) vic.addEffect('weakness', 120, { amplifier: 1, showParticles: true });
        if (Math.random() < 0.20) vic.setOnFire(4, true);
        if (Math.random() < 0.20) vic.addEffect('levitation', 40, { amplifier: 0, showParticles: true });
        
        spawnParticles(vic.dimension, vic.location, ['minecraft:dragon_breath_trail', 'minecraft:end_rod', 'minecraft:portal', 'minecraft:enchanting_table_particle', 'minecraft:large_smoke', 'minecraft:portal_reverse'], 5);
        vic.dimension.playSound('mob.endermen.portal', vic.location, { pitch: 1.5, volume: 0.7 });
    } catch (err) {}
});

system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
        if (!hasFrozendWeapon(p)) {
            barrierChargingPlayers.delete(p.id);
            continue;
        }
        
        if (p.isSneaking) {
            if (!barrierChargingPlayers.has(p.id)) barrierChargingPlayers.set(p.id, Date.now());
            
            const ct = Date.now() - barrierChargingPlayers.get(p.id);
            
            if (ct < 1800) {
                const a = (Date.now() / 60) % (Math.PI * 2);
                for (let i = 0; i < 12; i++) {
                    const oa = a + (i * Math.PI / 6);
                    p.dimension.spawnParticle('minecraft:dragon_breath_trail', { x: p.location.x + Math.cos(oa) * 1.8, y: p.location.y + 1, z: p.location.z + Math.sin(oa) * 1.8 });
                    p.dimension.spawnParticle('minecraft:end_rod', { x: p.location.x + Math.cos(oa + Math.PI/6) * 2.2, y: p.location.y + 1.5, z: p.location.z + Math.sin(oa + Math.PI/6) * 2.2 });
                    p.dimension.spawnParticle('minecraft:portal', { x: p.location.x + Math.cos(oa) * 1.3, y: p.location.y + 0.8, z: p.location.z + Math.sin(oa) * 1.3 });
                    p.dimension.spawnParticle('minecraft:enchanting_table_particle', { x: p.location.x + Math.cos(oa + Math.PI/12) * 1.5, y: p.location.y + 1.8, z: p.location.z + Math.sin(oa + Math.PI/12) * 1.5 });
                    if (i % 2 === 0) p.dimension.spawnParticle('minecraft:large_smoke', { x: p.location.x + Math.cos(oa) * 1.0, y: p.location.y + 0.5, z: p.location.z + Math.sin(oa) * 1.0 });
                    if (i % 3 === 0) p.dimension.spawnParticle('minecraft:portal_reverse', { x: p.location.x + Math.cos(oa) * 1.6, y: p.location.y + 1.2, z: p.location.z + Math.sin(oa) * 1.6 });
                }
            }
            
            if (ct >= 1800) {
                if (!isOnCooldown(p, 'void_barrier')) {
                    executeVoidBarrier(p);
                    setCooldown(p, 'void_barrier');
                    p.sendMessage('§5✓ Void Barrier activated!');
                } else {
                    const rem = Math.ceil((12000 - (Date.now() - COOLDOWNS.void_barrier.get(p.id))) / 1000);
                    p.sendMessage(`§c⚠ Void Barrier on cooldown: ${rem}s`);
                }
                barrierChargingPlayers.delete(p.id);
            }
        } else {
            barrierChargingPlayers.delete(p.id);
        }
    }
}, 3);

function executeVoidBarrier(p) {
    try {
        p.addEffect('absorption', 120, { amplifier: 2, showParticles: true });
        p.addEffect('resistance', 120, { amplifier: 1, showParticles: false });
        p.addEffect('fire_resistance', 120, { amplifier: 0, showParticles: true });
        p.addEffect('regeneration', 100, { amplifier: 0, showParticles: true });
        
        const enemies = getEntitiesInRadius(p.dimension, p.location, 5);
        enemies.forEach(e => {
            e.applyDamage(6, { cause: EntityDamageCause.magic, damagingEntity: p });
            const tx = e.location.x + (Math.random() - 0.5) * 8;
            const tz = e.location.z + (Math.random() - 0.5) * 8;
            try { e.teleport({ x: tx, y: e.location.y, z: tz }, { dimension: e.dimension, rotation: e.getRotation() }); } catch {}
            e.addEffect('slowness', 80, { amplifier: 2 });
            e.addEffect('weakness', 60, { amplifier: 0 });
            e.addEffect('wither', 60, { amplifier: 0 });
            e.setOnFire(4, true);
        });
        
        const particles = ['minecraft:dragon_breath_trail', 'minecraft:end_rod', 'minecraft:portal', 'minecraft:enchanting_table_particle', 'minecraft:large_smoke', 'minecraft:portal_reverse'];
        for (let i = 0; i < 60; i++) {
            const a = (Math.PI * 2 * i) / 60;
            particles.forEach((pt, idx) => {
                const r = 3.5 - (idx * 0.4);
                p.dimension.spawnParticle(pt, { x: p.location.x + Math.cos(a) * r, y: p.location.y + 1, z: p.location.z + Math.sin(a) * r });
            });
        }
        
        p.dimension.playSound('mob.enderdragon.growl', p.location, { pitch: 1.3, volume: 1.5 });
        p.sendMessage(`§5§l🌌 VOID BARRIER! §7(${enemies.length} enemies teleported)`);
    } catch (err) {}
}

system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
        if (!hasFrozendWeapon(p)) {
            holdingStartTime.delete(p.id);
            continue;
        }
        
        if (!holdingStartTime.has(p.id)) holdingStartTime.set(p.id, Date.now());
        
        const ht = Date.now() - holdingStartTime.get(p.id);
        
        if (ht > 10000 && ht < 15000) {
            const prog = (ht - 10000) / 5000;
            if (Math.random() < prog * 0.95) {
                const a = Math.random() * Math.PI * 2;
                const r = 1 + Math.random() * (1.5 + prog * 0.8);
                ['minecraft:dragon_breath_trail', 'minecraft:portal', 'minecraft:end_rod', 'minecraft:enchanting_table_particle', 'minecraft:large_smoke', 'minecraft:portal_reverse'].forEach(pt => {
                    p.dimension.spawnParticle(pt, { x: p.location.x + Math.cos(a) * r, y: p.location.y + 1 + prog, z: p.location.z + Math.sin(a) * r });
                });
            }
        }
        
        if (ht >= 15000) {
            if (!isOnCooldown(p, 'void_pulse')) {
                executeVoidPulse(p);
                setCooldown(p, 'void_pulse');
            }
            holdingStartTime.set(p.id, Date.now());
        }
    }
}, 5);

function executeVoidPulse(p) {
    try {
        const victims = getEntitiesInRadius(p.dimension, p.location, 7);
        victims.forEach(e => {
            e.applyDamage(12, { cause: EntityDamageCause.magic, damagingEntity: p });
            e.addEffect('slowness', 80, { amplifier: 2 });
            e.addEffect('weakness', 80, { amplifier: 1 });
            e.addEffect('wither', 60, { amplifier: 0 });
            e.addEffect('levitation', 50, { amplifier: 1 });
            e.setOnFire(6, true);
            system.runTimeout(() => { if (e.isValid()) e.applyDamage(6, { cause: EntityDamageCause.void }); }, 40);
            const dx = e.location.x - p.location.x, dz = e.location.z - p.location.z, d = Math.sqrt(dx * dx + dz * dz);
            if (d > 0) e.applyKnockback(dx / d, dz / d, 1.8, 0.6);
        });
        
        for (let ring = 0; ring < 6; ring++) {
            system.runTimeout(() => {
                const rr = (ring + 1) * 1.5;
                const pts = ['minecraft:dragon_breath_trail', 'minecraft:end_rod', 'minecraft:portal', 'minecraft:enchanting_table_particle', 'minecraft:large_smoke', 'minecraft:portal_reverse'];
                for (let i = 0; i < 40; i++) {
                    const a = (Math.PI * 2 * i) / 40;
                    pts.forEach(pt => p.dimension.spawnParticle(pt, { x: p.location.x + Math.cos(a) * rr, y: p.location.y + 1, z: p.location.z + Math.sin(a) * rr }));
                }
            }, ring * 60);
        }
        
        p.addEffect('speed', 120, { amplifier: 1 });
        p.addEffect('strength', 120, { amplifier: 1 });
        p.dimension.playSound('ambient.weather.thunder', p.location, { pitch: 1.2, volume: 1.2 });
        p.sendMessage(`§5§l⚡ VOID PULSE! §7(${victims.length} enemies hit)`);
    } catch (err) {}
}

system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
        if (!hasFrozendWeapon(p)) continue;
        try {
            const inAir = !p.isOnGround, sneak = p.isSneaking;
            if (inAir && sneak) {
                const last = lastJumpTime.get(p.id) || 0, since = Date.now() - last;
                if (since < 1000 && since > 100 && !isOnCooldown(p, 'dimensional_collapse')) {
                    executeDimensionalCollapse(p);
                    setCooldown(p, 'dimensional_collapse');
                    lastJumpTime.delete(p.id);
                }
            }
            if (p.isJumping) lastJumpTime.set(p.id, Date.now());
        } catch {}
    }
}, 5);

function executeDimensionalCollapse(p) {
    try {
        const victims = getEntitiesInRadius(p.dimension, p.location, 8);
        victims.forEach(e => {
            e.applyDamage(15, { cause: EntityDamageCause.magic, damagingEntity: p });
            e.addEffect('slowness', 120, { amplifier: 4 });
            e.addEffect('weakness', 120, { amplifier: 2 });
            e.addEffect('wither', 100, { amplifier: 1 });
            e.addEffect('mining_fatigue', 120, { amplifier: 3 });
            e.addEffect('levitation', 60, { amplifier: 2 });
            e.setOnFire(8, true);
            const dx = e.location.x - p.location.x, dz = e.location.z - p.location.z, d = Math.sqrt(dx * dx + dz * dz);
            if (d > 0) e.applyKnockback(dx / d, dz / d, 2.5, 1.0);
            for (let i = 1; i <= 2; i++) system.runTimeout(() => { if (e.isValid()) e.applyDamage(6, { cause: EntityDamageCause.void }); }, i * 40);
        });
        
        const pts = ['minecraft:dragon_breath_trail', 'minecraft:end_rod', 'minecraft:portal', 'minecraft:enchanting_table_particle', 'minecraft:large_smoke', 'minecraft:portal_reverse'];
        for (let i = 0; i < 100; i++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * 8, h = Math.random() * 5;
            pts.forEach(pt => p.dimension.spawnParticle(pt, { x: p.location.x + Math.cos(a) * r, y: p.location.y + h, z: p.location.z + Math.sin(a) * r }));
        }
        
        for (let w = 0; w < 5; w++) {
            system.runTimeout(() => {
                const wr = 3 + w * 1.8;
                for (let i = 0; i < 30; i++) {
                    const a = (Math.PI * 2 * i) / 30;
                    pts.forEach(pt => p.dimension.spawnParticle(pt, { x: p.location.x + Math.cos(a) * wr, y: p.location.y + 1, z: p.location.z + Math.sin(a) * wr }));
                }
            }, w * 200);
        }
        
        p.dimension.playSound('random.explode', p.location, { pitch: 0.5, volume: 1.8 });
        p.addEffect('regeneration', 100, { amplifier: 1 });
        p.sendMessage(`§5§l💀 DIMENSIONAL COLLAPSE! §7(${victims.length} enemies annihilated)`);
        world.sendMessage(`§5⚡ ${p.name} §7tore open the §5§lVOID§7!`);
    } catch (err) {}
}

system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
        if (!hasFrozendWeapon(p)) continue;
        try {
            p.addEffect('speed', 60, { amplifier: 0, showParticles: false });
            ['slowness', 'weakness', 'wither', 'poison'].forEach(ef => { const e = p.getEffect(ef); if (e) p.removeEffect(ef); });
            const h = p.getComponent('health');
            if (h && h.currentValue / h.effectiveMax < 0.5) p.addEffect('regeneration', 40, { amplifier: 2, showParticles: true });
            const dim = p.dimension.id;
            if (dim === 'minecraft:the_end') {
                p.addEffect('jump_boost', 60, { amplifier: 1, showParticles: false });
                p.addEffect('speed', 60, { amplifier: 1, showParticles: false });
                const lev = p.getEffect('levitation');
                if (lev) p.removeEffect('levitation');
            } else if (dim === 'minecraft:nether') {
                p.addEffect('fire_resistance', 60, { amplifier: 0, showParticles: false });
            }
        } catch {}
    }
}, 20);

system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
        if (!hasFrozendWeapon(p)) continue;
        const v = p.getVelocity();
        if (Math.abs(v.x) > 0.01 || Math.abs(v.z) > 0.01) {
            ['minecraft:dragon_breath_trail', 'minecraft:portal', 'minecraft:end_rod', 'minecraft:enchanting_table_particle', 'minecraft:large_smoke', 'minecraft:portal_reverse'].forEach(pt => {
                if (Math.random() < 0.5) p.dimension.spawnParticle(pt, { x: p.location.x, y: p.location.y + 0.5, z: p.location.z });
            });
        }
    }
}, 5);

system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
        if (!hasFrozendWeapon(p)) continue;
        if (Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 0.5;
            ['minecraft:enchanting_table_particle', 'minecraft:portal', 'minecraft:dragon_breath_trail', 'minecraft:large_smoke', 'minecraft:portal_reverse', 'minecraft:end_rod'].forEach(pt => {
                if (Math.random() < 0.4) p.dimension.spawnParticle(pt, { x: p.location.x + Math.cos(a) * r, y: p.location.y + 1, z: p.location.z + Math.sin(a) * r });
            });
        }
    }
}, 8);

console.warn('[Frozend Weapons] Enhanced particle system loaded!');