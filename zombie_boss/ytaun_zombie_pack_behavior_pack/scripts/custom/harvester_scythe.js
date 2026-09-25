import { world, system, EntityDamageCause } from "@minecraft/server"; // FIX: thêm EntityDamageCause

const scytheStates = new Map();
const playerLastHit = new Map();

const CONFIG = {
    itemId: "ytaun:harvester_scythe",
    skills: {
        reap:    { cd: 15000, damage: 8, radius: 5 },
        harvest: { cd: 20000, damage: 6, heal: 0.25, radius: 6 }
    },
    passive: {
        deathMark: {
            duration: 100,
            damageBonus: 0.3
        },
        soulExplosion: {
            cd: 30000,
            damage: 6,
            radius: 6
        }
    }
};

function initPlayer(player) {
    const id = player.id;
    if (!scytheStates.has(id)) {
        scytheStates.set(id, {
            lastReap: 0,
            lastHarvest: 0,
            lastExplosion: 0,
            markedEntities: new Set()
        });
    }
}

function hasScythe(player) {
    try {
        const inv  = player.getComponent("minecraft:inventory").container;
        const held = inv.getItem(player.selectedSlotIndex);
        return held && held.typeId === CONFIG.itemId;
    } catch {
        return false;
    }
}

function shadowReap(player) {
    try {
        const state = scytheStates.get(player.id);
        const now = Date.now();

        if (now - state.lastReap < CONFIG.skills.reap.cd) {
            const cooldown = Math.ceil((CONFIG.skills.reap.cd - (now - state.lastReap)) / 1000);
            player.sendMessage(`§c[Scythe] Shadow Reap cooldown: ${cooldown}s`);
            return;
        }

        player.sendMessage("§5[Scythe] §fShadow Reap!");

        for (let i = 0; i < 30; i++) {
            system.runTimeout(() => {
                try {
                    const angle  = (i / 30) * Math.PI * 2;
                    const radius = CONFIG.skills.reap.radius;

                    player.dimension.spawnParticle("minecraft:soul_particle", {
                        x: player.location.x + Math.cos(angle) * radius,
                        y: player.location.y + 1.5,
                        z: player.location.z + Math.sin(angle) * radius
                    });
                } catch {}
            }, i * 10);
        }

        system.runTimeout(() => {
            try {
                for (let i = 0; i < 50; i++) {
                    player.dimension.spawnParticle("minecraft:dragon_breath_fire", {
                        x: player.location.x + (Math.random() - 0.5) * CONFIG.skills.reap.radius * 2,
                        y: player.location.y + Math.random() * 2,
                        z: player.location.z + (Math.random() - 0.5) * CONFIG.skills.reap.radius * 2
                    });
                }

                const entities = player.dimension.getEntities({
                    location: player.location,
                    maxDistance: CONFIG.skills.reap.radius,
                    excludeTypes: ["minecraft:item"]
                });

                // FIX: stagger damage + dùng EntityDamageCause enum
                entities.forEach((e, index) => {
                    if (e.id === player.id) return;
                    system.runTimeout(() => {
                        try {
                            e.applyDamage(CONFIG.skills.reap.damage, { cause: EntityDamageCause.magic, damagingEntity: player }); // FIX: attribution
                            e.addEffect("slowness", 40, { amplifier: 0 });
                        } catch {}
                    }, index * 2);
                });

                player.playSound("mob.evocation_illager.cast_spell");
            } catch {}
        }, 300);

        state.lastReap = now;

    } catch {}
}

function soulHarvest(player) {
    try {
        const state = scytheStates.get(player.id);
        const now = Date.now();

        if (now - state.lastHarvest < CONFIG.skills.harvest.cd) {
            const cooldown = Math.ceil((CONFIG.skills.harvest.cd - (now - state.lastHarvest)) / 1000);
            player.sendMessage(`§c[Scythe] Soul Harvest cooldown: ${cooldown}s`);
            return;
        }

        const entities = player.dimension.getEntities({
            location: player.location,
            maxDistance: CONFIG.skills.harvest.radius,
            excludeTypes: ["minecraft:item", "minecraft:player"]
        });

        let totalDamage = 0;

        // FIX: stagger damage + dùng EntityDamageCause enum
        entities.forEach((e, index) => {
            system.runTimeout(() => {
                try {
                    e.applyDamage(CONFIG.skills.harvest.damage, { cause: EntityDamageCause.magic, damagingEntity: player }); // FIX: attribution
                    totalDamage += CONFIG.skills.harvest.damage;

                    for (let i = 0; i < 10; i++) {
                        system.runTimeout(() => {
                            try {
                                const t = i / 10;
                                player.dimension.spawnParticle("minecraft:soul_particle", {
                                    x: e.location.x + (player.location.x - e.location.x) * t,
                                    y: e.location.y + 1 + (player.location.y - e.location.y) * t,
                                    z: e.location.z + (player.location.z - e.location.z) * t
                                });
                            } catch {}
                        }, i * 3);
                    }
                } catch {}
            }, index * 2);
        });

        system.runTimeout(() => {
            if (totalDamage > 0) {
                const health     = player.getComponent("minecraft:health");
                const healAmount = totalDamage * CONFIG.skills.harvest.heal;
                health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + healAmount));
                player.sendMessage(`§5[Scythe] §aHealed ${healAmount.toFixed(1)} HP!`);
            }
        }, entities.length * 2 + 5);

        state.lastHarvest = now;
        player.playSound("mob.witch.drink");
        player.sendMessage("§5[Scythe] §fSoul Harvest!");

    } catch {}
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item   = event.itemStack;

    if (item.typeId !== CONFIG.itemId) return;

    initPlayer(player);
    shadowReap(player);
});

const lastInteract = new Map();

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;

    if (!hasScythe(player)) return;

    const now  = Date.now();
    const last = lastInteract.get(player.id) || 0;

    if (now - last < 300) return;

    event.cancel = true;

    initPlayer(player);
    soulHarvest(player);

    lastInteract.set(player.id, now);
});

// Passive 1: Death Mark
world.afterEvents.entityHurt.subscribe((event) => {
    const attacker = event.damageSource.damagingEntity;
    const victim   = event.hurtEntity;

    if (!attacker || attacker.typeId !== "minecraft:player") return;

    const player = attacker;

    if (!hasScythe(player)) return;

    try {
        initPlayer(player);
        const state = scytheStates.get(player.id);

        if (victim.typeId !== "minecraft:player") {
            state.markedEntities.add(victim.id);
            victim.addEffect("glowing", CONFIG.passive.deathMark.duration, { amplifier: 0 });

            for (let i = 0; i < 5; i++) {
                player.dimension.spawnParticle("minecraft:villager_angry", {
                    x: victim.location.x + (Math.random() - 0.5),
                    y: victim.location.y + 1 + Math.random(),
                    z: victim.location.z + (Math.random() - 0.5)
                });
            }

            system.runTimeout(() => {
                state.markedEntities.delete(victim.id);
            }, CONFIG.passive.deathMark.duration);
        }

        // FIX: dùng EntityDamageCause enum
        if (state.markedEntities.has(victim.id)) {
            const bonusDamage = event.damage * CONFIG.passive.deathMark.damageBonus;
            system.runTimeout(() => {
                try {
                    victim.applyDamage(bonusDamage, { cause: EntityDamageCause.magic, damagingEntity: player }); // FIX: attribution

                    player.dimension.spawnParticle("minecraft:critical_hit_emitter", {
                        x: victim.location.x,
                        y: victim.location.y + 1,
                        z: victim.location.z
                    });
                } catch {}
            }, 1);
        }
    } catch {}
});

// Passive 2: Soul Explosion
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (hasScythe(player)) {
            initPlayer(player);

            const state = scytheStates.get(player.id);
            const now   = Date.now();

            if (now - state.lastExplosion >= CONFIG.passive.soulExplosion.cd) {
                state.lastExplosion = now;

                player.sendMessage("§5[Scythe] §cSoul Explosion!");
                player.playSound("random.explode");

                for (let i = 0; i < 20; i++) {
                    system.runTimeout(() => {
                        try {
                            const angle  = (i / 20) * Math.PI * 2;
                            const radius = CONFIG.passive.soulExplosion.radius;

                            player.dimension.spawnParticle("minecraft:critical_hit_emitter", {
                                x: player.location.x + Math.cos(angle) * radius,
                                y: player.location.y + 0.5,
                                z: player.location.z + Math.sin(angle) * radius
                            });
                        } catch {}
                    }, i * 15);
                }

                system.runTimeout(() => {
                    try {
                        for (let i = 0; i < 80; i++) {
                            player.dimension.spawnParticle("minecraft:soul_particle", {
                                x: player.location.x + (Math.random() - 0.5) * CONFIG.passive.soulExplosion.radius * 2,
                                y: player.location.y + Math.random() * 3,
                                z: player.location.z + (Math.random() - 0.5) * CONFIG.passive.soulExplosion.radius * 2
                            });
                        }

                        for (let i = 0; i < 60; i++) {
                            player.dimension.spawnParticle("minecraft:soul_flame_particle", {
                                x: player.location.x + (Math.random() - 0.5) * CONFIG.passive.soulExplosion.radius * 2,
                                y: player.location.y + Math.random() * 3,
                                z: player.location.z + (Math.random() - 0.5) * CONFIG.passive.soulExplosion.radius * 2
                            });
                        }

                        for (let i = 0; i < 40; i++) {
                            player.dimension.spawnParticle("minecraft:huge_explosion_emitter", {
                                x: player.location.x + (Math.random() - 0.5) * CONFIG.passive.soulExplosion.radius * 2,
                                y: player.location.y + Math.random() * 3,
                                z: player.location.z + (Math.random() - 0.5) * CONFIG.passive.soulExplosion.radius * 2
                            });
                        }

                        const entities = player.dimension.getEntities({
                            location: player.location,
                            maxDistance: CONFIG.passive.soulExplosion.radius,
                            excludeTypes: ["minecraft:item"]
                        });

                        let hitCount = 0;
                        // FIX: stagger + EntityDamageCause enum
                        entities.forEach((e, index) => {
                            if (e.id === player.id) return;
                            system.runTimeout(() => {
                                try {
                                    e.applyDamage(CONFIG.passive.soulExplosion.damage, { cause: EntityDamageCause.magic, damagingEntity: player }); // FIX: attribution
                                    e.addEffect("wither", 60, { amplifier: 1 });
                                    hitCount++;
                                } catch {}
                            }, index * 2);
                        });

                        system.runTimeout(() => {
                            if (hitCount > 0) player.sendMessage(`§5[Scythe] §cHit ${hitCount} enemies!`);
                        }, entities.length * 2 + 5);

                        player.playSound("random.explode");

                    } catch {}
                }, 300);
            }

            // Soul aura
            const angle  = (Date.now() / 400) % (Math.PI * 2);
            const radius = 0.8;

            try {
                player.dimension.spawnParticle("minecraft:soul_particle", {
                    x: player.location.x + Math.cos(angle) * radius,
                    y: player.location.y + 1,
                    z: player.location.z + Math.sin(angle) * radius
                });

                player.dimension.spawnParticle("minecraft:soul_particle", {
                    x: player.location.x + Math.cos(angle + Math.PI) * radius,
                    y: player.location.y + 1,
                    z: player.location.z + Math.sin(angle + Math.PI) * radius
                });
            } catch {}

            // Display cooldowns
            const reapCd      = Math.max(0, Math.ceil((CONFIG.skills.reap.cd             - (now - state.lastReap))      / 1000));
            const harvestCd   = Math.max(0, Math.ceil((CONFIG.skills.harvest.cd          - (now - state.lastHarvest))   / 1000));
            const explosionCd = Math.max(0, Math.ceil((CONFIG.passive.soulExplosion.cd   - (now - state.lastExplosion)) / 1000));

            if (reapCd > 0 || harvestCd > 0) {
                player.onScreenDisplay.setActionBar(`§5Reap: §f${reapCd}s §7| §5Harvest: §f${harvestCd}s §7| §cExplosion: §f${explosionCd}s`);
            } else {
                player.onScreenDisplay.setActionBar(`§cSoul Explosion: §f${explosionCd}s`);
            }
        }
    }
}, 10);

world.afterEvents.worldInitialize.subscribe(() => {
    console.warn("§5[Harvester Scythe] §fLoaded!");
    console.warn("§7Skills: Shadow Reap (Right-click) | Soul Harvest (Attack entity)");
    console.warn("§7Passives: Death Mark (30% bonus damage) | Soul Explosion (Auto 30s)");
});
