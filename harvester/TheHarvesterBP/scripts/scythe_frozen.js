// ============================================================
// FROZEN SCYTHE ADDON - COMPLETE SCRIPT
// Item ID: pa:frozenscythe
// MCPE Version: 1.21.50
// ============================================================

import { world, system, EquipmentSlot, EntityDamageCause } from '@minecraft/server';

// ============== CONFIG ==============
const SCYTHE_ID = 'pa:frozenscythe';
const COOLDOWNS = {
    iceBarrier: new Map(),
    iceShardBarrage: new Map()
};

// ============== UTILITY FUNCTIONS ==============
function hasScythe(player) {
    const inv = player.getComponent('inventory');
    const item = inv.container.getItem(player.selectedSlotIndex);
    return item?.typeId === SCYTHE_ID;
}

function isOnCooldown(player, skillName) {
    const lastUse = COOLDOWNS[skillName].get(player.id);
    if (!lastUse) return false;
    const cooldownTime = skillName === 'iceBarrier' ? 10000 : 25000;
    return (Date.now() - lastUse) < cooldownTime;
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

// ============== SKILL 1: PASSIVE FROSTBITE ==============
// Tự động khi đánh: Slowness II + 20% Weakness
world.afterEvents.entityHurt.subscribe((event) => {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    
    if (!attacker || attacker.typeId !== 'minecraft:player') return;
    if (!hasScythe(attacker)) return;
    
    try {
        // Slowness II (3 giây)
        victim.addEffect('slowness', 60, { 
            amplifier: 1, 
            showParticles: true 
        });
        
        // 20% Weakness I (5 giây)
        if (Math.random() < 0.2) {
            victim.addEffect('weakness', 100, { 
                amplifier: 0,
                showParticles: true
            });
        }
        
        // Particle tuyết
        victim.dimension.spawnParticle(
            'minecraft:snowflake_particle',
            {
                x: victim.location.x,
                y: victim.location.y + 1,
                z: victim.location.z
            }
        );
        
        // Sound effect
        victim.dimension.playSound(
            'block.glass.break',
            victim.location,
            { pitch: 1.5, volume: 0.5 }
        );
        
    } catch (error) {
        console.warn('[Frostbite] Error:', error);
    }
});

// ============== SKILL 2: ICE BARRIER ==============
// Cúi + giữ 2 giây: Tạo khiên băng hấp thụ damage + đẩy lùi kẻ địch gần
let barrierChargingPlayers = new Map();

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasScythe(player)) {
            barrierChargingPlayers.delete(player.id);
            continue;
        }
        
        // Detect sneaking only
        if (player.isSneaking) {
            if (!barrierChargingPlayers.has(player.id)) {
                barrierChargingPlayers.set(player.id, Date.now());
            }
            
            const chargeTime = Date.now() - barrierChargingPlayers.get(player.id);
            
            // Charging particles (xoay quanh người chơi)
            if (chargeTime < 2000) {
                const angle = (Date.now() / 100) % (Math.PI * 2);
                for (let i = 0; i < 3; i++) {
                    const offsetAngle = angle + (i * Math.PI * 2 / 3);
                    player.dimension.spawnParticle(
                        'minecraft:snowflake_particle',
                        {
                            x: player.location.x + Math.cos(offsetAngle) * 1.5,
                            y: player.location.y + 1,
                            z: player.location.z + Math.sin(offsetAngle) * 1.5
                        }
                    );
                }
            }
            
            // Activate at 2 seconds
            if (chargeTime >= 2000 && chargeTime < 2100) {
                if (!isOnCooldown(player, 'iceBarrier')) {
                    executeIceBarrier(player);
                    setCooldown(player, 'iceBarrier');
                } else {
                    player.sendMessage('§c⚠ Ice Barrier on cooldown!');
                }
                barrierChargingPlayers.delete(player.id);
            }
            
        } else {
            barrierChargingPlayers.delete(player.id);
        }
    }
}, 5);

function executeIceBarrier(player) {
    try {
        // Tạo barrier (absorption effect)
        player.addEffect('absorption', 100, { 
            amplifier: 1, // +4 hearts
            showParticles: true 
        });
        
        player.addEffect('resistance', 100, { 
            amplifier: 0,
            showParticles: false
        });
        
        // Đẩy lùi kẻ địch xung quanh
        const nearbyEntities = getEntitiesInRadius(player.dimension, player.location, 4);
        
        nearbyEntities.forEach(entity => {
            // Tính vector đẩy ra xa
            const dx = entity.location.x - player.location.x;
            const dz = entity.location.z - player.location.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > 0) {
                const pushStrength = 1.5;
                entity.applyKnockback(
                    dx / distance,
                    dz / distance,
                    pushStrength,
                    0.5
                );
                
                // Slowness
                entity.addEffect('slowness', 60, { amplifier: 1 });
            }
        });
        
        // ENHANCED VISUAL: Massive particle effects
        // Vòng tròn ngoài
        for (let i = 0; i < 80; i++) {
            const angle = (Math.PI * 2 * i) / 80;
            const radius = 2.5;
            player.dimension.spawnParticle(
                'minecraft:bleach',
                {
                    x: player.location.x + Math.cos(angle) * radius,
                    y: player.location.y + 1,
                    z: player.location.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Vòng tròn giữa
        for (let i = 0; i < 60; i++) {
            const angle = (Math.PI * 2 * i) / 60;
            const radius = 1.5;
            player.dimension.spawnParticle(
                'minecraft:snowflake_particle',
                {
                    x: player.location.x + Math.cos(angle) * radius,
                    y: player.location.y + 1.5,
                    z: player.location.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Vòng tròn trong
        for (let i = 0; i < 40; i++) {
            const angle = (Math.PI * 2 * i) / 40;
            const radius = 0.8;
            player.dimension.spawnParticle(
                'minecraft:ice_evaporation_particle',
                {
                    x: player.location.x + Math.cos(angle) * radius,
                    y: player.location.y + 1,
                    z: player.location.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Particles bay lên
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 2;
            const height = Math.random() * 2.5;
            player.dimension.spawnParticle(
                'minecraft:snowflake_particle',
                {
                    x: player.location.x + Math.cos(angle) * radius,
                    y: player.location.y + height,
                    z: player.location.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Particles xung quanh người chơi
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.5;
            player.dimension.spawnParticle(
                'minecraft:blue_flame_particle',
                {
                    x: player.location.x + Math.cos(angle) * radius,
                    y: player.location.y + 1.2,
                    z: player.location.z + Math.sin(angle) * radius
                }
            );
        }
        
        // Sound effect
        player.dimension.playSound('block.glass.place', player.location, {
            pitch: 0.8,
            volume: 1.5
        });
        
        player.dimension.playSound('ambient.weather.thunder', player.location, {
            pitch: 2.0,
            volume: 0.8
        });
        
        player.sendMessage(`§b§l🛡 ICE BARRIER! §7(${nearbyEntities.length} enemies knocked back)`);
        
    } catch (error) {
        console.warn('[Ice Barrier] Error:', error);
    }
}

// ============== SKILL 3: ICE SHARD STORM ==============
// Click phải (không cúi): Bắn 16 mảnh băng theo hình vòng tròn
world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    
    if (item.typeId !== SCYTHE_ID) return;
    if (player.isSneaking) return; // Không kích hoạt khi đang cúi
    
    event.cancel = true;
    
    if (isOnCooldown(player, 'iceShardBarrage')) {
        const lastUse = COOLDOWNS.iceShardBarrage.get(player.id);
        const remaining = Math.ceil((25000 - (Date.now() - lastUse)) / 1000);
        player.sendMessage(`§c⚠ Ice Shard Storm cooldown: ${remaining}s`);
        return;
    }
    
    executeIceShardStorm(player);
    setCooldown(player, 'iceShardBarrage');
});

function executeIceShardStorm(player) {
    try {
        const totalShards = 16;
        const waves = 2;
        const shardsPerWave = totalShards / waves;
        
        // Buff cho player khi kích hoạt
        player.addEffect('speed', 80, { 
            amplifier: 1,
            showParticles: true
        });
        
        player.addEffect('strength', 80, { 
            amplifier: 0,
            showParticles: true
        });
        
        // Bắn theo waves
        for (let wave = 0; wave < waves; wave++) {
            system.runTimeout(() => {
                
                // Bắn mảnh băng theo vòng tròn
                for (let i = 0; i < shardsPerWave; i++) {
                    const angle = (Math.PI * 2 * i) / shardsPerWave + (wave * Math.PI / shardsPerWave);
                    
                    system.runTimeout(() => {
                        
                        // FIXED: Spawn arrow thay vì snowball để gây damage
                        const arrow = player.dimension.spawnEntity(
                            'minecraft:arrow',
                            {
                                x: player.location.x + Math.cos(angle) * 0.5,
                                y: player.location.y + 1.5,
                                z: player.location.z + Math.sin(angle) * 0.5
                            }
                        );
                        
                        // Set owner để damage được tính
                        const arrowComp = arrow.getComponent('projectile');
                        if (arrowComp) {
                            arrowComp.owner = player;
                        }
                        
                        // Velocity theo hướng vòng tròn
                        const speed = 1.5;
                        const horizontalSpeed = speed * 0.95;
                        const verticalSpeed = speed * 0.2;
                        
                        arrow.applyImpulse({
                            x: Math.cos(angle) * horizontalSpeed,
                            y: verticalSpeed,
                            z: Math.sin(angle) * horizontalSpeed
                        });
                        
                        // Enhanced particle trail - nhiều hơn
                        const trailInterval = system.runInterval(() => {
                            try {
                                if (!arrow.isValid()) {
                                    system.clearRun(trailInterval);
                                    return;
                                }
                                
                                // Multiple layered particles
                                for (let p = 0; p < 3; p++) {
                                    arrow.dimension.spawnParticle(
                                        'minecraft:snowflake_particle',
                                        {
                                            x: arrow.location.x + (Math.random() - 0.5) * 0.3,
                                            y: arrow.location.y + (Math.random() - 0.5) * 0.3,
                                            z: arrow.location.z + (Math.random() - 0.5) * 0.3
                                        }
                                    );
                                }
                                
                                arrow.dimension.spawnParticle(
                                    'minecraft:ice_evaporation_particle',
                                    arrow.location
                                );
                                
                                arrow.dimension.spawnParticle(
                                    'minecraft:blue_flame_particle',
                                    arrow.location
                                );
                                
                            } catch (e) {
                                system.clearRun(trailInterval);
                            }
                        }, 1);
                        
                        // Cleanup sau 5 giây
                        system.runTimeout(() => {
                            system.clearRun(trailInterval);
                            if (arrow.isValid()) {
                                arrow.remove();
                            }
                        }, 100);
                        
                    }, i * 3);
                }
                
                // Massive particle explosion mỗi wave
                for (let p = 0; p < 40; p++) {
                    const pAngle = Math.random() * Math.PI * 2;
                    const radius = 1 + Math.random() * 1.5;
                    player.dimension.spawnParticle(
                        'minecraft:bleach',
                        {
                            x: player.location.x + Math.cos(pAngle) * radius,
                            y: player.location.y + 1,
                            z: player.location.z + Math.sin(pAngle) * radius
                        }
                    );
                }
                
                // Snowflakes bay lên
                for (let p = 0; p < 30; p++) {
                    const pAngle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * 2;
                    const height = Math.random() * 2;
                    player.dimension.spawnParticle(
                        'minecraft:snowflake_particle',
                        {
                            x: player.location.x + Math.cos(pAngle) * radius,
                            y: player.location.y + 1 + height,
                            z: player.location.z + Math.sin(pAngle) * radius
                        }
                    );
                }
                
            }, wave * 400);
        }
        
        // Sound effects
        player.dimension.playSound('random.bow', player.location, {
            pitch: 1.2,
            volume: 1.2
        });
        
        system.runTimeout(() => {
            player.dimension.playSound('random.bow', player.location, {
                pitch: 1.5,
                volume: 1.2
            });
        }, 20);
        
        player.dimension.playSound('ambient.weather.thunder', player.location, {
            pitch: 1.8,
            volume: 0.8
        });
        
        player.sendMessage('§b§l❄ ICE SHARD STORM! §7(+Speed II, +Strength I)');
        
    } catch (error) {
        console.warn('[Ice Shard Storm] Error:', error);
    }
}

// Xử lý damage khi arrow đánh trúng
world.afterEvents.projectileHitEntity.subscribe((event) => {
    const projectile = event.projectile;
    const shooter = event.source;
    const victim = event.getEntityHit()?.entity;
    
    if (!shooter || shooter.typeId !== 'minecraft:player') return;
    if (!victim) return;
    if (!hasScythe(shooter)) return;
    
    // Xử lý cho arrow (Ice Shard Storm)
    if (projectile.typeId === 'minecraft:arrow') {
        try {
            // Enhanced damage + Multiple effects
            victim.applyDamage(7, { 
                cause: EntityDamageCause.projectile,
                damagingEntity: shooter
            });
            
            // Multiple debuffs
            victim.addEffect('slowness', 60, { amplifier: 1 });
            victim.addEffect('weakness', 40, { amplifier: 0 });
            
            // 30% chance to freeze (Slowness IV)
            if (Math.random() < 0.3) {
                victim.addEffect('slowness', 40, { amplifier: 3 });
                victim.addEffect('mining_fatigue', 40, { amplifier: 2 });
                
                victim.dimension.playSound('block.glass.break', victim.location, {
                    pitch: 1.2,
                    volume: 0.8
                });
            }
            
            // Massive particle explosion on hit
            for (let i = 0; i < 15; i++) {
                const angle = (Math.PI * 2 * i) / 15;
                const radius = 0.7;
                victim.dimension.spawnParticle(
                    'minecraft:snowflake_particle',
                    {
                        x: victim.location.x + Math.cos(angle) * radius,
                        y: victim.location.y + 1,
                        z: victim.location.z + Math.sin(angle) * radius
                    }
                );
            }
            
            // Additional particles
            for (let i = 0; i < 10; i++) {
                victim.dimension.spawnParticle(
                    'minecraft:ice_evaporation_particle',
                    {
                        x: victim.location.x + (Math.random() - 0.5),
                        y: victim.location.y + 1 + Math.random(),
                        z: victim.location.z + (Math.random() - 0.5)
                    }
                );
            }
            
            victim.dimension.playSound('block.glass.break', victim.location, {
                pitch: 1.8,
                volume: 0.8
            });
            
            // Remove arrow immediately for visual effect
            projectile.remove();
            
        } catch (error) {
            console.warn('[Ice Shard Hit] Error:', error);
        }
    }
});

// ============== SKILL 4: YETI'S ENDURANCE (PASSIVE) ==============
// Kháng Slowness (tối đa cấp 3) + Regen khi HP thấp + Speed trên tuyết
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasScythe(player)) continue;
        
        try {
            // Loại bỏ hoặc giảm Slowness effect
            const slownessEffect = player.getEffect('slowness');
            if (slownessEffect) {
                const currentAmplifier = slownessEffect.amplifier;
                
                // Nếu Slowness <= cấp 3, loại bỏ hoàn toàn
                if (currentAmplifier <= 2) {
                    player.removeEffect('slowness');
                } else {
                    // Nếu > cấp 3, giảm xuống 3 cấp
                    player.removeEffect('slowness');
                    player.addEffect('slowness', slownessEffect.duration, {
                        amplifier: currentAmplifier - 3,
                        showParticles: false
                    });
                }
            }
            
            // Speed in Snow Biome
            const block = player.dimension.getBlock({
                x: Math.floor(player.location.x),
                y: Math.floor(player.location.y - 1),
                z: Math.floor(player.location.z)
            });
            
            if (block?.typeId.includes('snow') || block?.typeId.includes('ice')) {
                player.addEffect('speed', 60, { 
                    amplifier: 0,
                    showParticles: false
                });
            }
            
            // Regeneration below 30% HP
            const health = player.getComponent('health');
            if (health && health.currentValue / health.effectiveMax < 0.3) {
                player.addEffect('regeneration', 40, { 
                    amplifier: 0,
                    showParticles: true
                });
            }
            
        } catch (error) {
            console.warn('[Yeti Endurance] Error:', error);
        }
    }
}, 20);

// ============== TRAIL EFFECT ==============
// Visual: Particle trail khi di chuyển
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasScythe(player)) continue;
        
        // Trail when moving
        const vel = player.getVelocity();
        if (Math.abs(vel.x) > 0.01 || Math.abs(vel.z) > 0.01) {
            player.dimension.spawnParticle(
                'minecraft:snowflake_particle',
                {
                    x: player.location.x,
                    y: player.location.y + 1,
                    z: player.location.z
                }
            );
        }
    }
}, 10);

console.warn('[Frozen Scythe Skills] All skills loaded successfully!');

// ============================================================
// SUMMARY OF SKILLS:
// ============================================================
// 1. Frostbite (Passive): Auto Slowness II + 20% Weakness on hit
// 2. Ice Barrier (Active): Sneak + Hold 2s → Shield + Knockback (10s CD) - ENHANCED PARTICLES
// 3. Ice Shard Storm (Active): Right Click → 16 arrows in circle + Speed II + Strength (25s CD)
//    - Each arrow: 7 damage, Slowness + Weakness, 30% freeze - FIXED DAMAGE
// 4. Yeti's Endurance (Passive): Slowness resistance (max lv3) + Speed on snow + Low HP regen
// ============================================================