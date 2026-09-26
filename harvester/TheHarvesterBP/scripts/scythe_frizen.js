// ============================================================
// FRIZEN WEAPONS ADDON - NETHER UPGRADE VERSION
// Items: pa:frizenscythe + pa:frizen_sword
// MCPE Version: 1.21.50
// Upgrade from: pa:frozenscythe (Ice + Nether fusion)
// ============================================================

import { world, system, EquipmentSlot, EntityDamageCause } from '@minecraft/server';

// ============== CONFIG ==============
const SCYTHE_ID = 'pa:frizenscythe';
const SWORD_ID = 'pa:frizen_sword';
const COOLDOWNS = {
    hellfire_barrier: new Map(),
    inferno_pulse: new Map(),
    nether_wrath: new Map()
};

// Track holding time
const holdingStartTime = new Map();

// ============== UTILITY FUNCTIONS ==============
function hasFrizenWeapon(player) {
    const inv = player.getComponent('inventory');
    const item = inv.container.getItem(player.selectedSlotIndex);
    return item?.typeId === SCYTHE_ID || item?.typeId === SWORD_ID;
}

function hasScythe(player) {
    const inv = player.getComponent('inventory');
    const item = inv.container.getItem(player.selectedSlotIndex);
    return item?.typeId === SCYTHE_ID;
}

function hasSword(player) {
    const inv = player.getComponent('inventory');
    const item = inv.container.getItem(player.selectedSlotIndex);
    return item?.typeId === SWORD_ID;
}

function isOnCooldown(player, skillName) {
    const lastUse = COOLDOWNS[skillName].get(player.id);
    if (!lastUse) return false;
    const cooldownTimes = {
        hellfire_barrier: 12000,
        inferno_pulse: 20000,
        nether_wrath: 30000
    };
    return (Date.now() - lastUse) < cooldownTimes[skillName];
}

function setCooldown(player, skillName) {
    COOLDOWNS[skillName].set(player.id, Date.now());
}

function getEntitiesInRadius(dimension, location, radius) {
    const entities = [];
    const allEntities = dimension.getEntities();
    
    for (const entity of allEntities) {
        if (entity.typeId === 'minecraft:player') continue;
        const distance = Math.sqrt(
            Math.pow(entity.location.x - location.x, 2) +
            Math.pow(entity.location.y - location.y, 2) +
            Math.pow(entity.location.z - location.z, 2)
        );
        if (distance <= radius) entities.push(entity);
    }
    return entities;
}

// ============== SKILL 1: INFERNAL FROSTBITE (PASSIVE) ==============
// Áp dụng cho CẢ SCYTHE VÀ SWORD
// Upgrade: Slowness III + 35% Weakness + 20% Burning
world.afterEvents.entityHurt.subscribe((event) => {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    
    if (!attacker || attacker.typeId !== 'minecraft:player') return;
    if (!hasFrizenWeapon(attacker)) return;
    
    try {
        // Slowness III (4 giây) - nâng cấp từ II
        victim.addEffect('slowness', 80, { 
            amplifier: 2, 
            showParticles: true 
        });
        
        // 35% Weakness II (6 giây) - tăng tỷ lệ và cấp độ
        if (Math.random() < 0.35) {
            victim.addEffect('weakness', 120, { 
                amplifier: 1,
                showParticles: true
            });
        }
        
        // 20% Burning effect (3 giây) - NEW
        if (Math.random() < 0.2) {
            victim.setOnFire(3, true);
            
            victim.dimension.playSound('mob.ghast.fireball', victim.location, {
                pitch: 1.8,
                volume: 0.5
            });
        }
        
        // Dual particles: Ice + Fire
        victim.dimension.spawnParticle(
            'minecraft:snowflake_particle',
            {
                x: victim.location.x - 0.3,
                y: victim.location.y + 1,
                z: victim.location.z
            }
        );
        
        victim.dimension.spawnParticle(
            'minecraft:lava_particle',
            {
                x: victim.location.x + 0.3,
                y: victim.location.y + 1,
                z: victim.location.z
            }
        );
        
        // Sound effect
        victim.dimension.playSound('block.glass.break', victim.location, {
            pitch: 1.3,
            volume: 0.6
        });
        
    } catch (error) {
        console.warn('[Infernal Frostbite] Error:', error);
    }
});

// ============== SKILL 2: HELLFIRE BARRIER (ACTIVE) ==============
// Áp dụng cho CẢ SCYTHE VÀ SWORD
// Upgrade: Shield + Knockback + Damage enemies + Fire immunity
let barrierChargingPlayers = new Map();

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasFrizenWeapon(player)) {
            barrierChargingPlayers.delete(player.id);
            continue;
        }
        
        if (player.isSneaking) {
            if (!barrierChargingPlayers.has(player.id)) {
                barrierChargingPlayers.set(player.id, Date.now());
            }
            
            const chargeTime = Date.now() - barrierChargingPlayers.get(player.id);
            
            // Enhanced charging particles: Ice + Fire spiral
            if (chargeTime < 1800) {
                const angle = (Date.now() / 80) % (Math.PI * 2);
                for (let i = 0; i < 4; i++) {
                    const offsetAngle = angle + (i * Math.PI / 2);
                    
                    // Ice particles
                    player.dimension.spawnParticle(
                        'minecraft:snowflake_particle',
                        {
                            x: player.location.x + Math.cos(offsetAngle) * 1.5,
                            y: player.location.y + 1,
                            z: player.location.z + Math.sin(offsetAngle) * 1.5
                        }
                    );
                    
                    // Fire particles
                    player.dimension.spawnParticle(
                        'minecraft:lava_particle',
                        {
                            x: player.location.x + Math.cos(offsetAngle + Math.PI/4) * 1.8,
                            y: player.location.y + 1.2,
                            z: player.location.z + Math.sin(offsetAngle + Math.PI/4) * 1.8
                        }
                    );
                }
            }
            
            // Activate at 1.8 seconds
            if (chargeTime >= 1800) {
                if (!isOnCooldown(player, 'hellfire_barrier')) {
                    executeHellfireBarrier(player);
                    setCooldown(player, 'hellfire_barrier');
                    player.sendMessage('§a✓ Hellfire Barrier activated!');
                } else {
                    const lastUse = COOLDOWNS.hellfire_barrier.get(player.id);
                    const remaining = Math.ceil((12000 - (Date.now() - lastUse)) / 1000);
                    player.sendMessage(`§c⚠ Hellfire Barrier on cooldown: ${remaining}s`);
                }
                barrierChargingPlayers.delete(player.id);
            }
            
        } else {
            barrierChargingPlayers.delete(player.id);
        }
    }
}, 5);

function executeHellfireBarrier(player) {
    try {
        // Enhanced barrier
        player.addEffect('absorption', 120, { 
            amplifier: 2, // +6 hearts (upgrade từ +4)
            showParticles: true 
        });
        
        player.addEffect('resistance', 120, { 
            amplifier: 1, // Upgrade từ 0
            showParticles: false
        });
        
        player.addEffect('fire_resistance', 120, { 
            amplifier: 0,
            showParticles: true
        });
        
        // Damage + knockback enemies
        const nearbyEntities = getEntitiesInRadius(player.dimension, player.location, 5);
        
        nearbyEntities.forEach(entity => {
            // Damage (NEW)
            entity.applyDamage(6, { 
                cause: EntityDamageCause.magic,
                damagingEntity: player
            });
            
            // Knockback
            const dx = entity.location.x - player.location.x;
            const dz = entity.location.z - player.location.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > 0) {
                entity.applyKnockback(
                    dx / distance,
                    dz / distance,
                    2.0, // Stronger knockback
                    0.7
                );
                
                // Debuffs
                entity.addEffect('slowness', 80, { amplifier: 2 });
                entity.addEffect('wither', 60, { amplifier: 0 }); // NEW
                entity.setOnFire(4, true); // NEW
            }
        });
        
        // MASSIVE VISUAL EFFECTS: Ice + Fire combined
        // Fire outer ring
        for (let i = 0; i < 100; i++) {
            const angle = (Math.PI * 2 * i) / 100;
            const radius = 3;
            player.dimension.spawnParticle(
                'minecraft:lava_particle',
                {
                    x: player.location.x + Math.cos(angle) * radius,
                    y: player.location.y + 1,
                    z: player.location.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Ice middle ring
        for (let i = 0; i < 80; i++) {
            const angle = (Math.PI * 2 * i) / 80;
            const radius = 2;
            player.dimension.spawnParticle(
                'minecraft:bleach',
                {
                    x: player.location.x + Math.cos(angle) * radius,
                    y: player.location.y + 1.5,
                    z: player.location.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Mixed particles rising
        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 2.5;
            const height = Math.random() * 3;
            
            if (Math.random() < 0.5) {
                player.dimension.spawnParticle(
                    'minecraft:snowflake_particle',
                    {
                        x: player.location.x + Math.cos(angle) * radius,
                        y: player.location.y + height,
                        z: player.location.z + Math.sin(angle) * radius
                    }
                );
            } else {
                player.dimension.spawnParticle(
                    'minecraft:basic_flame_particle',
                    {
                        x: player.location.x + Math.cos(angle) * radius,
                        y: player.location.y + height,
                        z: player.location.z + Math.sin(angle) * radius
                    }
                );
            }
        }
        
        // Soul fire particles
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 1;
            player.dimension.spawnParticle(
                'minecraft:soul_particle',
                {
                    x: player.location.x + Math.cos(angle) * radius,
                    y: player.location.y + 1.5,
                    z: player.location.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Sound effects
        player.dimension.playSound('block.glass.place', player.location, {
            pitch: 0.7,
            volume: 1.5
        });
        
        player.dimension.playSound('mob.ghast.fireball', player.location, {
            pitch: 1.5,
            volume: 1.0
        });
        
        player.sendMessage(`§c§l🔥 HELLFIRE BARRIER! §7(${nearbyEntities.length} enemies damaged)`);
        
    } catch (error) {
        console.warn('[Hellfire Barrier] Error:', error);
    }
}

// ============== SKILL 3: INFERNO PULSE (PASSIVE HOLD) ==============
// Áp dụng cho CẢ SCYTHE VÀ SWORD
// NEW: Cầm weapon 15 giây → tự động bắn xung kích AOE damage
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (hasFrizenWeapon(player)) {
            // Bắt đầu đếm thời gian cầm
            if (!holdingStartTime.has(player.id)) {
                holdingStartTime.set(player.id, Date.now());
            }
            
            const holdTime = Date.now() - holdingStartTime.get(player.id);
            
            // Visual charging effect (từ giây thứ 10)
            if (holdTime > 10000 && holdTime < 15000) {
                const progress = (holdTime - 10000) / 5000;
                
                // Particles tăng dần
                if (Math.random() < progress) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 1 + Math.random();
                    
                    player.dimension.spawnParticle(
                        'minecraft:lava_particle',
                        {
                            x: player.location.x + Math.cos(angle) * radius,
                            y: player.location.y + 1,
                            z: player.location.z + Math.sin(angle) * radius
                        }
                    );
                    
                    player.dimension.spawnParticle(
                        'minecraft:soul_particle',
                        {
                            x: player.location.x + Math.cos(angle) * radius * 0.8,
                            y: player.location.y + 1.3,
                            z: player.location.z + Math.sin(angle) * radius * 0.8
                        }
                    );
                }
            }
            
            // Kích hoạt Inferno Pulse sau 15 giây
            if (holdTime >= 15000) {
                if (!isOnCooldown(player, 'inferno_pulse')) {
                    executeInfernoPulse(player);
                    setCooldown(player, 'inferno_pulse');
                }
                // Reset timer để có thể kích hoạt lại sau cooldown
                holdingStartTime.set(player.id, Date.now());
            }
            
        } else {
            // Không cầm weapon → reset timer
            holdingStartTime.delete(player.id);
        }
    }
}, 10);

function executeInfernoPulse(player) {
    try {
        const pulseRadius = 7;
        const victims = getEntitiesInRadius(player.dimension, player.location, pulseRadius);
        
        // Damage và debuff tất cả enemies
        victims.forEach(entity => {
            // Heavy damage
            entity.applyDamage(12, { 
                cause: EntityDamageCause.magic,
                damagingEntity: player
            });
            
            // Debuffs
            entity.addEffect('slowness', 80, { amplifier: 2 }); // Slowness III (4s)
            entity.addEffect('weakness', 80, { amplifier: 1 });
            entity.addEffect('wither', 60, { amplifier: 0 }); // Wither I (3s)
            entity.setOnFire(6, true);
            
            // Knockback
            const dx = entity.location.x - player.location.x;
            const dz = entity.location.z - player.location.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > 0) {
                entity.applyKnockback(dx / distance, dz / distance, 1.8, 0.6);
            }
        });
        
        // MASSIVE PULSE VISUAL EFFECTS
        const centerLoc = player.location;
        
        // Expanding shockwave rings
        for (let ring = 0; ring < 5; ring++) {
            system.runTimeout(() => {
                const ringRadius = (ring + 1) * 1.5;
                
                // Fire ring
                for (let i = 0; i < 50; i++) {
                    const angle = (Math.PI * 2 * i) / 50;
                    player.dimension.spawnParticle(
                        'minecraft:lava_particle',
                        {
                            x: centerLoc.x + Math.cos(angle) * ringRadius,
                            y: centerLoc.y + 0.5,
                            z: centerLoc.z + Math.sin(angle) * ringRadius
                        }
                    );
                }
                
                // Ice ring
                for (let i = 0; i < 40; i++) {
                    const angle = (Math.PI * 2 * i) / 40;
                    player.dimension.spawnParticle(
                        'minecraft:snowflake_particle',
                        {
                            x: centerLoc.x + Math.cos(angle) * (ringRadius - 0.3),
                            y: centerLoc.y + 1,
                            z: centerLoc.z + Math.sin(angle) * (ringRadius - 0.3)
                        }
                    );
                }
                
                // Soul particles
                for (let i = 0; i < 30; i++) {
                    const angle = (Math.PI * 2 * i) / 30;
                    player.dimension.spawnParticle(
                        'minecraft:soul_particle',
                        {
                            x: centerLoc.x + Math.cos(angle) * ringRadius,
                            y: centerLoc.y + 1.5,
                            z: centerLoc.z + Math.sin(angle) * ringRadius
                        }
                    );
                }
                
                // Sound for each ring
                player.dimension.playSound('random.explode', centerLoc, {
                    pitch: 0.8 + (ring * 0.2),
                    volume: 1.0
                });
                
            }, ring * 50);
        }
        
        // Central explosion particles
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 3;
            const height = Math.random() * 2;
            
            player.dimension.spawnParticle(
                Math.random() < 0.5 ? 'minecraft:lava_particle' : 'minecraft:basic_flame_particle',
                {
                    x: centerLoc.x + Math.cos(angle) * radius,
                    y: centerLoc.y + height,
                    z: centerLoc.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Player buffs
        player.addEffect('speed', 120, { amplifier: 1, showParticles: true });
        player.addEffect('strength', 120, { amplifier: 1, showParticles: true });
        player.addEffect('regeneration', 80, { amplifier: 0, showParticles: true });
        
        // Sound effects
        player.dimension.playSound('ambient.weather.thunder', centerLoc, {
            pitch: 1.2,
            volume: 1.5
        });
        
        player.sendMessage(`§c§l⚡ INFERNO PULSE! §7(${victims.length} enemies hit) §e+Speed II +Strength II`);
        
    } catch (error) {
        console.warn('[Inferno Pulse] Error:', error);
    }
}

// ============== SKILL 4: NETHER WRATH (ULTIMATE) ==============
// Áp dụng cho CẢ SCYTHE VÀ SWORD
// NEW: Jump + Sneak in air = AOE explosion damage + extreme debuffs
let lastJumpTime = new Map();

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasFrizenWeapon(player)) continue;
        
        try {
            const isInAir = !player.isOnGround;
            const isSneaking = player.isSneaking;
            
            // Detect jump + sneak combo
            if (isInAir && isSneaking) {
                const lastJump = lastJumpTime.get(player.id) || 0;
                const timeSinceJump = Date.now() - lastJump;
                
                // Activate if jumped recently (within 1 second)
                if (timeSinceJump < 1000 && timeSinceJump > 100) {
                    if (!isOnCooldown(player, 'nether_wrath')) {
                        executeNetherWrath(player);
                        setCooldown(player, 'nether_wrath');
                        lastJumpTime.delete(player.id);
                    }
                }
            }
            
            // Track jumps
            if (player.isJumping) {
                lastJumpTime.set(player.id, Date.now());
            }
            
        } catch (error) {}
    }
}, 5);

function executeNetherWrath(player) {
    try {
        // Massive AOE damage
        const victims = getEntitiesInRadius(player.dimension, player.location, 8);
        
        victims.forEach(entity => {
            // Heavy damage
            entity.applyDamage(15, { 
                cause: EntityDamageCause.magic,
                damagingEntity: player
            });
            
            // Extreme debuffs
            entity.addEffect('slowness', 120, { amplifier: 4 });
            entity.addEffect('weakness', 120, { amplifier: 2 });
            entity.addEffect('wither', 100, { amplifier: 1 });
            entity.addEffect('mining_fatigue', 120, { amplifier: 3 });
            
            // Set on fire
            entity.setOnFire(8, true);
            
            // Strong knockback
            const dx = entity.location.x - player.location.x;
            const dz = entity.location.z - player.location.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > 0) {
                entity.applyKnockback(dx / distance, dz / distance, 2.5, 1.0);
            }
        });
        
        // ULTIMATE VISUAL EFFECTS
        const centerLoc = player.location;
        
        // Massive fire explosion
        for (let i = 0; i < 150; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 8;
            const height = Math.random() * 4;
            
            player.dimension.spawnParticle(
                'minecraft:lava_particle',
                {
                    x: centerLoc.x + Math.cos(angle) * radius,
                    y: centerLoc.y + height,
                    z: centerLoc.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Ice shards
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 7;
            const height = Math.random() * 3;
            
            player.dimension.spawnParticle(
                'minecraft:snowflake_particle',
                {
                    x: centerLoc.x + Math.cos(angle) * radius,
                    y: centerLoc.y + height,
                    z: centerLoc.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Soul vortex
        for (let i = 0; i < 80; i++) {
            const angle = (Math.PI * 2 * i) / 80;
            const radius = 5;
            player.dimension.spawnParticle(
                'minecraft:soul_particle',
                {
                    x: centerLoc.x + Math.cos(angle) * radius,
                    y: centerLoc.y + 1.5,
                    z: centerLoc.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Sound effects
        player.dimension.playSound('random.explode', centerLoc, {
            pitch: 0.5,
            volume: 2.0
        });
        
        player.dimension.playSound('ambient.weather.thunder', centerLoc, {
            pitch: 0.8,
            volume: 1.5
        });
        
        // Player buffs after ultimate
        player.addEffect('regeneration', 100, { amplifier: 1 });
        player.addEffect('resistance', 100, { amplifier: 1 });
        
        player.sendMessage(`§c§l💀 NETHER WRATH! §7(${victims.length} enemies obliterated)`);
        world.sendMessage(`§c⚡ ${player.name} §7unleashed §c§lNETHER WRATH§7!`);
        
    } catch (error) {
        console.warn('[Nether Wrath] Error:', error);
    }
}

// ============== SKILL 5: INFERNAL ENDURANCE (PASSIVE) ==============
// Áp dụng cho CẢ SCYTHE VÀ SWORD
// Upgrade: Fire immunity + Slowness immunity + Speed boost + HP regen
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasFrizenWeapon(player)) continue;
        
        try {
            // Fire immunity (permanent)
            player.addEffect('fire_resistance', 120, { 
                amplifier: 0,
                showParticles: false
            });
            
            // Complete slowness immunity
            const slownessEffect = player.getEffect('slowness');
            if (slownessEffect) {
                player.removeEffect('slowness');
            }
            
            // Speed boost always
            player.addEffect('speed', 60, { 
                amplifier: 0,
                showParticles: false
            });
            
            // Enhanced regen at low HP
            const health = player.getComponent('health');
            if (health && health.currentValue / health.effectiveMax < 0.4) {
                player.addEffect('regeneration', 40, { 
                    amplifier: 1, // Upgrade từ 0
                    showParticles: true
                });
            }
            
            // Bonus in Nether
            const dimension = player.dimension.id;
            if (dimension === 'minecraft:nether') {
                player.addEffect('strength', 60, { 
                    amplifier: 0,
                    showParticles: false
                });
                
                player.addEffect('resistance', 60, { 
                    amplifier: 0,
                    showParticles: false
                });
            }
            
        } catch (error) {
            console.warn('[Infernal Endurance] Error:', error);
        }
    }
}, 20);

// ============== ENHANCED TRAIL EFFECT ==============
// Áp dụng cho CẢ SCYTHE VÀ SWORD
// Dual trail: Ice + Fire
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasFrizenWeapon(player)) continue;
        
        const vel = player.getVelocity();
        if (Math.abs(vel.x) > 0.01 || Math.abs(vel.z) > 0.01) {
            // Ice particle
            player.dimension.spawnParticle(
                'minecraft:snowflake_particle',
                {
                    x: player.location.x - 0.3,
                    y: player.location.y + 0.5,
                    z: player.location.z
                }
            );
            
            // Fire particle
            player.dimension.spawnParticle(
                'minecraft:lava_particle',
                {
                    x: player.location.x + 0.3,
                    y: player.location.y + 0.5,
                    z: player.location.z
                }
            );
        }
    }
}, 10);

console.warn('[Frizen Weapons] Scythe & Sword system loaded successfully!');

// ============================================================
// SUMMARY OF SKILLS (ÁP DỤNG CHO CẢ SCYTHE & SWORD):
// ============================================================
// 1. Infernal Frostbite (Passive): Slowness III + 35% Weakness II + 20% Burning
// 2. Hellfire Barrier (Active): Sneak 1.8s → Shield +6 hearts + Damage + Fire immunity (12s CD)
// 3. Inferno Pulse (Passive Hold): Cầm weapon 15s → AOE damage pulse
//    - 7 radius, 12 damage, Slowness III (4s) + Weakness II (4s) + Wither I (3s) + Fire (6s)
//    - Buffs: Speed II + Strength II + Regeneration (20s CD)
// 4. Nether Wrath (Ultimate): Jump + Sneak → 8 radius explosion (15 damage, extreme debuffs, 30s CD)
// 5. Infernal Endurance (Passive): Fire immunity + Slowness immunity + Speed I + Regen at low HP
// ============================================================
// WEAPONS: pa:frizenscythe + pa:frizen_sword (cùng skill set)
// ============================================================