import { world, system } from "@minecraft/server";

// Cấu hình Boss
const BOSS_CONFIG = {
    identifier: "pa:robot_crap",
    maxHealth: 300,
    phase2Health: 180,
    phase3Health: 100,
    skillCooldown: 120, // ticks (6 giây)
};

// Theo dõi trạng thái boss
const bossStates = new Map();

// Khởi tạo boss khi spawn
world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;
    
    if (entity.typeId === BOSS_CONFIG.identifier) {
        initializeBoss(entity);
    }
});

// Khởi tạo boss
function initializeBoss(boss) {
    bossStates.set(boss.id, {
        phase: 1,
        lastSkillTick: 0,
        isShieldActive: false,
        skillsUsed: []
    });
    
    boss.nameTag = "§c§l[ROBOT CRAB BOSS]";
    world.sendMessage("§e§l⚠ ROBOT CRAB BOSS ĐÃ XUẤT HIỆN! ⚠");
    boss.dimension.runCommand(`playsound mob.enderdragon.growl @a[r=50] ${Math.floor(boss.location.x)} ${Math.floor(boss.location.y)} ${Math.floor(boss.location.z)} 1 0.5`);
}

// Hệ thống cập nhật boss mỗi tick
system.runInterval(() => {
    for (const boss of world.getDimension("overworld").getEntities({ type: BOSS_CONFIG.identifier })) {
        updateBoss(boss);
    }
}, 1);

// Cập nhật boss
function updateBoss(boss) {
    try {
        const state = bossStates.get(boss.id);
        if (!state) return;
        
        const health = boss.getComponent("health");
        if (!health) return;
        
        const currentHealth = health.currentValue;
        const currentTick = system.currentTick;
        
        // Kiểm tra phase
        checkPhaseTransition(boss, currentHealth, state);
        
        // Sử dụng skill ngẫu nhiên
        if (currentTick - state.lastSkillTick > BOSS_CONFIG.skillCooldown) {
            useRandomSkill(boss, state);
            state.lastSkillTick = currentTick;
        }
        
        // Particles liên tục
        spawnBossParticles(boss);
        
    } catch (error) {
        // Boss đã chết hoặc không tồn tại
        bossStates.delete(boss.id);
    }
}

// Kiểm tra chuyển phase
function checkPhaseTransition(boss, health, state) {
    if (health <= BOSS_CONFIG.phase3Health && state.phase < 3) {
        enterPhase3(boss, state);
    } else if (health <= BOSS_CONFIG.phase2Health && state.phase < 2) {
        enterPhase2(boss, state);
    }
}

// Phase 2
function enterPhase2(boss, state) {
    state.phase = 2;
    world.sendMessage("§c§l[PHASE 2] §eRobot Crab đang tức giận!");
    
    const loc = boss.location;
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] resistance 999999 1 true`);
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] speed 999999 0 true`);
    boss.dimension.runCommand(`playsound mob.enderdragon.growl @a[r=50] ${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)} 1 0.5`);
    
    spawnParticleExplosion(boss, "minecraft:huge_explode_emitter");
}

// Phase 3
function enterPhase3(boss, state) {
    state.phase = 3;
    world.sendMessage("§4§l[PHASE 3] §c⚡ BERSERK MODE ACTIVATED! ⚡");
    
    const loc = boss.location;
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] resistance 999999 2 true`);
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] speed 999999 2 true`);
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] strength 999999 1 true`);
    boss.dimension.runCommand(`playsound mob.wither.spawn @a[r=50] ${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)} 1 0.5`);
    
    spawnParticleExplosion(boss, "minecraft:huge_explode_emitter");
}

// Sử dụng skill ngẫu nhiên
function useRandomSkill(boss, state) {
    const skills = [
        { name: "laser", weight: 20, func: skillLaserBeam },
        { name: "shield", weight: 15, func: skillEnergyShield },
        { name: "slam", weight: 15, func: skillGroundSlam },
        { name: "summon", weight: 10, func: skillSummonMinions },
        { name: "lightning", weight: 10, func: skillLightningStrike },
        { name: "poison", weight: 5, func: skillPoisonCloud },
        { name: "heal", weight: 5, func: skillRegeneration },
        { name: "teleport", weight: 5, func: skillTeleport },
        // ROBOT SKILLS
        { name: "emp", weight: 15, func: skillEMP },
        { name: "missile", weight: 15, func: skillMissileLauncher },
        { name: "turret", weight: 10, func: skillDeployTurret },
        { name: "nanobots", weight: 10, func: skillNanobots },
        { name: "overload", weight: 8, func: skillSystemOverload },
        { name: "cloak", weight: 7, func: skillCloaking },
        { name: "rockets", weight: 10, func: skillRocketBarrage }
    ];
    
    // Phase 3 tăng skill mạnh
    if (state.phase === 3) {
        skills.find(s => s.name === "emp").weight = 20;
        skills.find(s => s.name === "missile").weight = 20;
        skills.find(s => s.name === "overload").weight = 15;
    }
    
    const totalWeight = skills.reduce((sum, skill) => sum + skill.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const skill of skills) {
        random -= skill.weight;
        if (random <= 0) {
            skill.func(boss, state);
            break;
        }
    }
}

// ============ SKILLS ============

// Skill 1: Laser Beam
function skillLaserBeam(boss, state) {
    world.sendMessage("§6⚡ [LASER BEAM] ⚡");
    
    const { x, y, z } = boss.location;
    const players = boss.dimension.getPlayers({ location: boss.location, maxDistance: 20 });
    const mobs = boss.dimension.getEntities({ location: boss.location, maxDistance: 20 })
        .filter(e => e.typeId !== BOSS_CONFIG.identifier && 
                     e.typeId !== "minecraft:zombie" && 
                     e.typeId !== "minecraft:item" &&
                     !e.typeId.includes("item"));
    
    const targets = [...players, ...mobs];
    
    if (targets.length === 0) return;
    
    for (let i = 0; i < 5; i++) {
        system.runTimeout(() => {
            if (!boss.isValid()) return;
            
            boss.dimension.spawnParticle("minecraft:critical_hit_emitter", { x, y: y + 1, z });
            boss.dimension.spawnParticle("minecraft:sonic_explosion", { x, y: y + 1, z });
            
            for (const target of targets) {
                if (target.isValid()) {
                    const dx = target.location.x - x;
                    const dy = target.location.y - y;
                    const dz = target.location.z - z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    for (let j = 0; j < distance; j += 0.5) {
                        const px = x + (dx / distance) * j;
                        const py = y + 1 + (dy / distance) * j;
                        const pz = z + (dz / distance) * j;
                        boss.dimension.spawnParticle("minecraft:redstone_ore_dust_particle", { x: px, y: py, z: pz });
                    }
                    
                    target.applyDamage(3, { cause: "magic" });
                }
            }
        }, i * 8);
    }
}

// Skill 2: Energy Shield
function skillEnergyShield(boss, state) {
    if (state.isShieldActive) return;
    
    world.sendMessage("§b🛡 [ENERGY SHIELD] 🛡");
    state.isShieldActive = true;
    
    const loc = boss.location;
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] resistance 3 10 true`);
    
    for (let i = 0; i < 60; i++) {
        system.runTimeout(() => {
            if (boss.isValid()) {
                boss.dimension.spawnParticle("minecraft:blue_flame_particle", boss.location);
            }
        }, i);
    }
    
    system.runTimeout(() => {
        state.isShieldActive = false;
        world.sendMessage("§7Shield deactivated");
    }, 60);
}

// Skill 3: Ground Slam
function skillGroundSlam(boss, state) {
    world.sendMessage("§c💥 [GROUND SLAM] 💥");
    
    const { x, y, z } = boss.location;
    boss.dimension.runCommand(`playsound random.explode @a[r=50] ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} 2 0.5`);
    
    spawnParticleExplosion(boss, "minecraft:huge_explode_emitter");
    
    const nearbyPlayers = boss.dimension.getPlayers({ location: boss.location, maxDistance: 6 });
    const nearbyMobs = boss.dimension.getEntities({ location: boss.location, maxDistance: 6 })
        .filter(e => e.typeId !== BOSS_CONFIG.identifier && 
                     e.typeId !== "minecraft:zombie" && 
                     e.typeId !== "minecraft:item" &&
                     !e.typeId.includes("item"));
    
    for (const player of nearbyPlayers) {
        player.applyKnockback(x - player.location.x, z - player.location.z, 1.5, 0.8);
        player.applyDamage(6);
    }
    
    for (const mob of nearbyMobs) {
        mob.applyKnockback(x - mob.location.x, z - mob.location.z, 1.5, 0.8);
        mob.applyDamage(6);
    }
}

// Skill 4: Summon Minions
function skillSummonMinions(boss, state) {
    world.sendMessage("§d👾 [SUMMON MINIONS] 👾");
    
    const { x, y, z } = boss.location;
    const minionCount = state.phase === 3 ? 3 : 2;
    
    for (let i = 0; i < minionCount; i++) {
        const offsetX = (Math.random() - 0.5) * 6;
        const offsetZ = (Math.random() - 0.5) * 6;
        
        try {
            const minion = boss.dimension.spawnEntity("minecraft:zombie", {
                x: x + offsetX,
                y: y,
                z: z + offsetZ
            });
            
            minion.nameTag = "§7Robot Minion";
        } catch (e) {
            // Spawn thất bại
        }
    }
}

// Skill 5: Lightning Strike
function skillLightningStrike(boss, state) {
    world.sendMessage("§e⚡ [LIGHTNING STRIKE] ⚡");
    
    const players = boss.dimension.getPlayers({ location: boss.location, maxDistance: 15 });
    const mobs = boss.dimension.getEntities({ location: boss.location, maxDistance: 15 })
        .filter(e => e.typeId !== BOSS_CONFIG.identifier && 
                     e.typeId !== "minecraft:zombie" && 
                     e.typeId !== "minecraft:item" &&
                     !e.typeId.includes("item"));
    
    const targets = [...players, ...mobs];
    
    if (targets.length > 0) {
        const randomTarget = targets[Math.floor(Math.random() * targets.length)];
        const loc = randomTarget.location;
        boss.dimension.runCommand(`summon lightning_bolt ${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)}`);
    }
    
    const bossLoc = boss.location;
    boss.dimension.runCommand(`playsound ambient.weather.lightning.impact @a[r=50] ${Math.floor(bossLoc.x)} ${Math.floor(bossLoc.y)} ${Math.floor(bossLoc.z)} 2 1`);
}

// Skill 6: Poison Cloud
function skillPoisonCloud(boss, state) {
    world.sendMessage("§a☠ [POISON CLOUD] ☠");
    
    for (let i = 0; i < 100; i++) {
        system.runTimeout(() => {
            if (boss.isValid()) {
                const { x, y, z } = boss.location;
                const offsetX = (Math.random() - 0.5) * 6;
                const offsetZ = (Math.random() - 0.5) * 6;
                
                boss.dimension.spawnParticle("minecraft:dragon_breath_trail", {
                    x: x + offsetX,
                    y: y + 0.5,
                    z: z + offsetZ
                });
            }
        }, i);
    }
    
    const nearbyPlayers = boss.dimension.getPlayers({ location: boss.location, maxDistance: 6 });
    const nearbyMobs = boss.dimension.getEntities({ location: boss.location, maxDistance: 6 })
        .filter(e => e.typeId !== BOSS_CONFIG.identifier && 
                     e.typeId !== "minecraft:zombie" && 
                     e.typeId !== "minecraft:item" &&
                     !e.typeId.includes("item"));
    
    for (const player of nearbyPlayers) {
        player.addEffect("poison", 120, { amplifier: 1, showParticles: true });
    }
    
    for (const mob of nearbyMobs) {
        try {
            mob.addEffect("poison", 120, { amplifier: 1, showParticles: true });
        } catch (e) {
            // Mob không thể nhận effect
        }
    }
}

// Skill 7: Regeneration
function skillRegeneration(boss, state) {
    world.sendMessage("§c❤ [REGENERATION] ❤");
    
    const health = boss.getComponent("health");
    if (!health) return;
    
    const healAmount = state.phase === 3 ? 40 : 25;
    
    health.setCurrentValue(Math.min(health.currentValue + healAmount, BOSS_CONFIG.maxHealth));
    
    for (let i = 0; i < 50; i++) {
        system.runTimeout(() => {
            if (boss.isValid()) {
                boss.dimension.spawnParticle("minecraft:heart_particle", boss.location);
            }
        }, i);
    }
}

// Skill 8: Teleport
function skillTeleport(boss, state) {
    world.sendMessage("§5✨ [TELEPORT] ✨");
    
    const targets = boss.dimension.getPlayers({ location: boss.location, maxDistance: 30 });
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    const offsetX = (Math.random() - 0.5) * 10;
    const offsetZ = (Math.random() - 0.5) * 10;
    
    spawnParticleExplosion(boss, "minecraft:portal_particle");
    
    try {
        boss.teleport({
            x: target.location.x + offsetX,
            y: target.location.y,
            z: target.location.z + offsetZ
        });
        
        system.runTimeout(() => {
            if (boss.isValid()) {
                spawnParticleExplosion(boss, "minecraft:portal_particle");
            }
        }, 10);
    } catch (e) {
        // Teleport thất bại
    }
}

// ============ ROBOT SKILLS ============

// Skill 9: EMP Blast
function skillEMP(boss, state) {
    world.sendMessage("§b⚡ [EMP BLAST] ⚡ §7Vô hiệu hóa thiết bị!");
    
    const { x, y, z } = boss.location;
    
    for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        const radius = 8;
        const px = x + Math.cos(angle) * radius;
        const pz = z + Math.sin(angle) * radius;
        boss.dimension.spawnParticle("minecraft:electric_spark_particle", { x: px, y: y + 1, z: pz });
    }
    
    boss.dimension.runCommand(`playsound beacon.power @a[r=50] ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} 2 0.5`);
    
    const nearbyPlayers = boss.dimension.getPlayers({ location: boss.location, maxDistance: 8 });
    const nearbyMobs = boss.dimension.getEntities({ location: boss.location, maxDistance: 8 })
        .filter(e => e.typeId !== BOSS_CONFIG.identifier && 
                     e.typeId !== "minecraft:zombie" && 
                     e.typeId !== "minecraft:item" &&
                     !e.typeId.includes("item"));
    
    for (const player of nearbyPlayers) {
        player.addEffect("slowness", 100, { amplifier: 2, showParticles: true });
        player.addEffect("weakness", 100, { amplifier: 1, showParticles: true });
        player.addEffect("mining_fatigue", 100, { amplifier: 2, showParticles: true });
    }
    
    for (const mob of nearbyMobs) {
        try {
            mob.addEffect("slowness", 100, { amplifier: 2, showParticles: true });
            mob.addEffect("weakness", 100, { amplifier: 1, showParticles: true });
        } catch (e) {
            // Mob không thể nhận effect
        }
    }
}

// Skill 10: Missile Launcher
function skillMissileLauncher(boss, state) {
    world.sendMessage("§c🚀 [MISSILE LAUNCHER] 🚀");
    
    const { x, y, z } = boss.location;
    const targets = boss.dimension.getPlayers({ location: boss.location, maxDistance: 25 });
    
    if (targets.length === 0) return;
    
    for (let i = 0; i < 8; i++) {
        system.runTimeout(() => {
            if (!boss.isValid()) return;
            
            boss.dimension.spawnParticle("minecraft:huge_explosion_emitter", { x, y: y + 2, z });
            boss.dimension.runCommand(`playsound firework.blast @a[r=50] ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} 1 0.8`);
            
            try {
                const fireball = boss.dimension.spawnEntity("minecraft:fireball", { x, y: y + 2, z });
                
                const target = targets[Math.floor(Math.random() * targets.length)];
                system.runTimeout(() => {
                    if (target.isValid() && fireball.isValid()) {
                        const dx = (target.location.x - x) * 0.1;
                        const dy = (target.location.y - y) * 0.1;
                        const dz = (target.location.z - z) * 0.1;
                        fireball.applyImpulse({ x: dx, y: dy, z: dz });
                    }
                }, 1);
            } catch (e) {
                // Spawn thất bại
            }
            
        }, i * 10);
    }
}

// Skill 11: Deploy Turret
function skillDeployTurret(boss, state) {
    world.sendMessage("§e🔫 [DEPLOY TURRET] 🔫");
    
    const { x, y, z } = boss.location;
    
    for (let i = 0; i < 2; i++) {
        const offsetX = (Math.random() - 0.5) * 8;
        const offsetZ = (Math.random() - 0.5) * 8;
        
        try {
            const turret = boss.dimension.spawnEntity("minecraft:skeleton", {
                x: x + offsetX,
                y: y,
                z: z + offsetZ
            });
            
            turret.nameTag = "§7[TURRET]";
            
            const tLoc = turret.location;
            boss.dimension.runCommand(`effect @e[type=skeleton,r=3,x=${Math.floor(tLoc.x)},y=${Math.floor(tLoc.y)},z=${Math.floor(tLoc.z)}] regeneration 30 2 true`);
            boss.dimension.runCommand(`effect @e[type=skeleton,r=3,x=${Math.floor(tLoc.x)},y=${Math.floor(tLoc.y)},z=${Math.floor(tLoc.z)}] resistance 30 1 true`);
            
            system.runTimeout(() => {
                if (turret.isValid()) {
                    turret.dimension.spawnParticle("minecraft:huge_explode_emitter", turret.location);
                    turret.remove();
                }
            }, 600);
        } catch (e) {
            // Spawn thất bại
        }
    }
    
    boss.dimension.spawnParticle("minecraft:huge_explode_emitter", boss.location);
}

// Skill 12: Nanobots
function skillNanobots(boss, state) {
    world.sendMessage("§a🔬 [NANOBOTS ACTIVATED] 🔬");
    
    const { x, y, z } = boss.location;
    
    for (let i = 0; i < 150; i++) {
        system.runTimeout(() => {
            if (boss.isValid()) {
                const offsetX = (Math.random() - 0.5) * 2;
                const offsetY = Math.random() * 2;
                const offsetZ = (Math.random() - 0.5) * 2;
                boss.dimension.spawnParticle("minecraft:villager_happy", {
                    x: x + offsetX,
                    y: y + offsetY,
                    z: z + offsetZ
                });
            }
        }, i);
    }
    
    const health = boss.getComponent("health");
    if (!health) return;
    
    for (let i = 0; i < 10; i++) {
        system.runTimeout(() => {
            if (boss.isValid() && health) {
                health.setCurrentValue(Math.min(health.currentValue + 5, BOSS_CONFIG.maxHealth));
            }
        }, i * 15);
    }
    
    const bLoc = boss.location;
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] speed 8 1`);
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] resistance 8 1`);
}

// Skill 13: System Overload
function skillSystemOverload(boss, state) {
    world.sendMessage("§4⚠ [SYSTEM OVERLOAD] ⚠ §cNGUY HIỂM!");
    
    const { x, y, z } = boss.location;
    
    boss.dimension.runCommand(`playsound random.explode @a[r=50] ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} 3 0.3`);
    
    for (let i = 0; i < 5; i++) {
        system.runTimeout(() => {
            if (!boss.isValid()) return;
            
            const offsetX = (Math.random() - 0.5) * 12;
            const offsetZ = (Math.random() - 0.5) * 12;
            const targetLoc = { x: x + offsetX, y: y, z: z + offsetZ };
            
            boss.dimension.spawnParticle("minecraft:huge_explode_emitter", targetLoc);
            
            const nearbyPlayers = boss.dimension.getPlayers({
                location: targetLoc,
                maxDistance: 3
            });
            
            const nearbyMobs = boss.dimension.getEntities({
                location: targetLoc,
                maxDistance: 3
            }).filter(e => e.typeId !== BOSS_CONFIG.identifier && 
                          e.typeId !== "minecraft:zombie" && 
                          e.typeId !== "minecraft:item" &&
                          !e.typeId.includes("item"));
            
            for (const player of nearbyPlayers) {
                player.applyDamage(5);
            }
            
            for (const mob of nearbyMobs) {
                mob.applyDamage(5);
            }
        }, i * 15);
    }
}

// Skill 14: Cloaking Device
function skillCloaking(boss, state) {
    world.sendMessage("§5👻 [CLOAKING DEVICE] 👻");
    
    const loc = boss.location;
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] invisibility 8 0 true`);
    boss.dimension.runCommand(`effect @e[type=${BOSS_CONFIG.identifier},r=5] speed 8 2`);
    
    for (let i = 0; i < 160; i++) {
        system.runTimeout(() => {
            if (boss.isValid()) {
                boss.dimension.spawnParticle("minecraft:portal_particle", boss.location);
            }
        }, i);
    }
}

// Skill 15: Rocket Barrage
function skillRocketBarrage(boss, state) {
    world.sendMessage("§6💥 [ROCKET BARRAGE] 💥");
    
    const { x, y, z } = boss.location;
    const players = boss.dimension.getPlayers({ location: boss.location, maxDistance: 20 });
    const mobs = boss.dimension.getEntities({ location: boss.location, maxDistance: 20 })
        .filter(e => e.typeId !== BOSS_CONFIG.identifier && 
                     e.typeId !== "minecraft:zombie" && 
                     e.typeId !== "minecraft:item" &&
                     !e.typeId.includes("item"));
    
    const targets = [...players, ...mobs];
    
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    for (let i = 0; i < 12; i++) {
        system.runTimeout(() => {
            if (!boss.isValid() || !target.isValid()) return;
            
            const offsetX = (Math.random() - 0.5) * 4;
            const offsetZ = (Math.random() - 0.5) * 4;
            const explosionLoc = {
                x: target.location.x + offsetX,
                y: target.location.y,
                z: target.location.z + offsetZ
            };
            
            boss.dimension.spawnParticle("minecraft:critical_hit_emitter", {
                x: explosionLoc.x,
                y: explosionLoc.y + 3,
                z: explosionLoc.z
            });
            
            const affectedPlayers = boss.dimension.getPlayers({
                location: explosionLoc,
                maxDistance: 2.5
            });
            
            const affectedMobs = boss.dimension.getEntities({
                location: explosionLoc,
                maxDistance: 2.5
            }).filter(e => e.typeId !== BOSS_CONFIG.identifier && 
                          e.typeId !== "minecraft:zombie" && 
                          e.typeId !== "minecraft:item" &&
                          !e.typeId.includes("item"));
            
            for (const p of affectedPlayers) {
                p.applyDamage(2);
            }
            
            for (const m of affectedMobs) {
                m.applyDamage(2);
            }
            
        }, i * 8);
    }
    
    boss.dimension.runCommand(`playsound firework.twinkle @a[r=50] ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} 2 0.5`);
}

// ============ PARTICLE EFFECTS ============

function spawnBossParticles(boss) {
    if (system.currentTick % 20 === 0) {
        boss.dimension.spawnParticle("minecraft:villager_angry", {
            x: boss.location.x,
            y: boss.location.y + 2,
            z: boss.location.z
        });
    }
}

function spawnParticleExplosion(boss, particleType) {
    const { x, y, z } = boss.location;
    
    for (let i = 0; i < 20; i++) {
        const offsetX = (Math.random() - 0.5) * 2;
        const offsetY = Math.random() * 2;
        const offsetZ = (Math.random() - 0.5) * 2;
        
        boss.dimension.spawnParticle(particleType, {
            x: x + offsetX,
            y: y + offsetY,
            z: z + offsetZ
        });
    }
}

// Xóa boss khỏi tracking khi chết
world.afterEvents.entityDie.subscribe((event) => {
    if (event.deadEntity.typeId === BOSS_CONFIG.identifier) {
        world.sendMessage("§a§l✅ ROBOT CRAB BOSS ĐÃ BỊ ĐÁNH BẠI! ✅");
        const loc = event.deadEntity.location;
        event.deadEntity.dimension.runCommand(`playsound random.levelup @a[r=50] ${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)} 2 1`);
        bossStates.delete(event.deadEntity.id);
    }
});