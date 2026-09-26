import { world, system } from "@minecraft/server";

const scytheStates = new Map();

const CONFIG = {
    itemId: "pa:harvester_scythe",
    skills: {
        // Shadow Reap: upgraded — dmg 8→14, CD 15s→12s, radius 5→7
        reap: { cd: 12000, damage: 14, radius: 7 },
        // Soul Harvest: upgraded — dmg 6→12, CD 20s→16s, heal 25%→45%, radius 6→9
        harvest: { cd: 16000, damage: 12, heal: 0.45, radius: 9 }
    },
    passive: {
        // Death Mark: upgraded — bonus 30%→50%, duration 5s→7s, now applies Wither
        deathMark: {
            duration: 140,
            damageBonus: 0.5
        },
        // Soul Explosion: upgraded — CD 30s→20s, dmg 6→14, radius 6→10, +2HP per enemy hit
        soulExplosion: {
            cd: 20000,
            damage: 14,
            radius: 10,
            healPerHit: 2
        },
        // Dark Blessing: NEW — killing an enemy grants Speed II + Strength I for 4s
        darkBlessing: {
            duration: 80
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
            markedEntities: new Set(),
            lastKill: 0
        });
    }
}

function hasScythe(player) {
    try {
        const inv = player.getComponent("minecraft:inventory").container;
        const held = inv.getItem(player.selectedSlotIndex);
        return held && held.typeId === CONFIG.itemId;
    } catch {
        return false;
    }
}

// ─── SHADOW REAP (Right-click) ───────────────────────────────────────────────
function shadowReap(player) {
    try {
        const state = scytheStates.get(player.id);
        const now = Date.now();

        if (now - state.lastReap < CONFIG.skills.reap.cd) {
            const cd = Math.ceil((CONFIG.skills.reap.cd - (now - state.lastReap)) / 1000);
            player.sendMessage(`§c[Scythe] Shadow Reap cooldown: ${cd}s`);
            return;
        }

        player.sendMessage("§5§l[Scythe] ☠ SHADOW REAP!");
        player.playSound("mob.evocation_illager.cast_spell");

        // Spiral particle wind-up
        for (let i = 0; i < 36; i++) {
            system.runTimeout(() => {
                try {
                    const angle = (i / 36) * Math.PI * 6; // 3 full rotations
                    const r = (i / 36) * CONFIG.skills.reap.radius;
                    player.dimension.spawnParticle("minecraft:soul_particle", {
                        x: player.location.x + Math.cos(angle) * r,
                        y: player.location.y + 1 + (i / 36) * 2,
                        z: player.location.z + Math.sin(angle) * r
                    });
                } catch {}
            }, i * 8);
        }

        // Impact at 300ms
        system.runTimeout(() => {
            try {
                // Outer ring burst
                for (let i = 0; i < 48; i++) {
                    const angle = (i / 48) * Math.PI * 2;
                    player.dimension.spawnParticle("minecraft:dragon_breath_fire", {
                        x: player.location.x + Math.cos(angle) * CONFIG.skills.reap.radius,
                        y: player.location.y + 1,
                        z: player.location.z + Math.sin(angle) * CONFIG.skills.reap.radius
                    });
                }
                // Inner scatter
                for (let i = 0; i < 40; i++) {
                    player.dimension.spawnParticle("minecraft:soul_flame_particle", {
                        x: player.location.x + (Math.random() - 0.5) * CONFIG.skills.reap.radius * 2,
                        y: player.location.y + Math.random() * 2.5,
                        z: player.location.z + (Math.random() - 0.5) * CONFIG.skills.reap.radius * 2
                    });
                }

                const entities = player.dimension.getEntities({
                    location: player.location,
                    maxDistance: CONFIG.skills.reap.radius,
                    excludeTypes: ["minecraft:item", "minecraft:player"]
                });

                for (const e of entities) {
                    try {
                        e.applyDamage(CONFIG.skills.reap.damage, { cause: "magic" });
                        e.addEffect("slowness", 60, { amplifier: 2 });    // Slowness III, 3s
                        e.addEffect("wither", 60, { amplifier: 1 });      // Wither II, 3s
                        e.addEffect("blindness", 40, { amplifier: 0 });   // NEW: Blindness 2s
                    } catch {}
                }

                player.playSound("mob.wither.shoot");
            } catch {}
        }, 300);

        state.lastReap = now;
    } catch {}
}

// ─── SOUL HARVEST (Attack entity) ────────────────────────────────────────────
function soulHarvest(player) {
    try {
        const state = scytheStates.get(player.id);
        const now = Date.now();

        if (now - state.lastHarvest < CONFIG.skills.harvest.cd) {
            const cd = Math.ceil((CONFIG.skills.harvest.cd - (now - state.lastHarvest)) / 1000);
            player.sendMessage(`§c[Scythe] Soul Harvest cooldown: ${cd}s`);
            return;
        }

        const entities = player.dimension.getEntities({
            location: player.location,
            maxDistance: CONFIG.skills.harvest.radius,
            excludeTypes: ["minecraft:item", "minecraft:player"]
        });

        let totalDamage = 0;

        for (const e of entities) {
            try {
                e.applyDamage(CONFIG.skills.harvest.damage, { cause: "magic" });
                e.addEffect("slowness", 80, { amplifier: 3 }); // Slowness IV — pull-trapped
                totalDamage += CONFIG.skills.harvest.damage;

                // Souls flowing toward player
                for (let i = 0; i < 12; i++) {
                    system.runTimeout(() => {
                        try {
                            const t = i / 12;
                            player.dimension.spawnParticle("minecraft:soul_particle", {
                                x: e.location.x + (player.location.x - e.location.x) * t,
                                y: e.location.y + 1 + (player.location.y + 1 - e.location.y) * t,
                                z: e.location.z + (player.location.z - e.location.z) * t
                            });
                        } catch {}
                    }, i * 4);
                }
            } catch {}
        }

        if (totalDamage > 0) {
            const health = player.getComponent("minecraft:health");
            const heal = totalDamage * CONFIG.skills.harvest.heal;
            health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + heal));
            player.sendMessage(`§5[Scythe] §aSoul Harvest — Healed §f+${heal.toFixed(1)}§a HP from ${entities.length} enemies!`);
        } else {
            player.sendMessage("§5[Scythe] §fSoul Harvest — No enemies in range!");
        }

        // Green absorption particles on player
        for (let i = 0; i < 20; i++) {
            system.runTimeout(() => {
                try {
                    player.dimension.spawnParticle("minecraft:heart_particle", {
                        x: player.location.x + (Math.random() - 0.5),
                        y: player.location.y + 1 + Math.random(),
                        z: player.location.z + (Math.random() - 0.5)
                    });
                } catch {}
            }, i * 5);
        }

        state.lastHarvest = now;
        player.playSound("mob.witch.drink");
    } catch {}
}

// ─── EVENT: Right-click → Shadow Reap ────────────────────────────────────────
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (item.typeId !== CONFIG.itemId) return;
    initPlayer(player);
    shadowReap(player);
});

// ─── EVENT: Attack entity → Soul Harvest ─────────────────────────────────────
let lastInteract = new Map();
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    if (!hasScythe(player)) return;
    const now = Date.now();
    if (now - (lastInteract.get(player.id) || 0) < 300) return;
    event.cancel = true;
    initPlayer(player);
    soulHarvest(player);
    lastInteract.set(player.id, now);
});

// ─── PASSIVE 1: Death Mark — hit = mark, marked = +50% dmg + Wither ──────────
world.afterEvents.entityHurt.subscribe((event) => {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    if (!attacker || attacker.typeId !== "minecraft:player") return;
    const player = attacker;
    if (!hasScythe(player)) return;

    try {
        initPlayer(player);
        const state = scytheStates.get(player.id);

        if (victim.typeId !== "minecraft:player") {
            const alreadyMarked = state.markedEntities.has(victim.id);

            // Apply mark
            state.markedEntities.add(victim.id);
            victim.addEffect("glowing", CONFIG.passive.deathMark.duration, { amplifier: 0 });
            victim.addEffect("wither", CONFIG.passive.deathMark.duration, { amplifier: 0 }); // NEW: Wither on mark

            // Skull particles on fresh mark
            if (!alreadyMarked) {
                for (let i = 0; i < 8; i++) {
                    player.dimension.spawnParticle("minecraft:villager_angry", {
                        x: victim.location.x + (Math.random() - 0.5),
                        y: victim.location.y + 1.5 + Math.random(),
                        z: victim.location.z + (Math.random() - 0.5)
                    });
                }
            }

            // Reset mark timer
            system.runTimeout(() => {
                state.markedEntities.delete(victim.id);
            }, CONFIG.passive.deathMark.duration);

            // Apply bonus damage if already marked
            if (alreadyMarked) {
                const bonus = event.damage * CONFIG.passive.deathMark.damageBonus;
                system.runTimeout(() => {
                    try {
                        victim.applyDamage(bonus, { cause: "magic" });
                        player.dimension.spawnParticle("minecraft:critical_hit_emitter", {
                            x: victim.location.x,
                            y: victim.location.y + 1,
                            z: victim.location.z
                        });
                        // Small HP drain back to player on mark proc
                        const hp = player.getComponent("minecraft:health");
                        hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 1));
                    } catch {}
                }, 1);
            }
        }
    } catch {}
});

// ─── PASSIVE 2 (NEW): Dark Blessing — killing grants Speed II + Strength I ───
world.afterEvents.entityDie.subscribe((event) => {
    try {
        const killer = event.damageSource?.damagingEntity;
        if (!killer || killer.typeId !== "minecraft:player") return;
        if (!hasScythe(killer)) return;

        initPlayer(killer);
        killer.addEffect("speed", CONFIG.passive.darkBlessing.duration, { amplifier: 1 });
        killer.addEffect("strength", CONFIG.passive.darkBlessing.duration, { amplifier: 0 });

        for (let i = 0; i < 10; i++) {
            killer.dimension.spawnParticle("minecraft:soul_flame_particle", {
                x: killer.location.x + (Math.random() - 0.5),
                y: killer.location.y + 1 + Math.random(),
                z: killer.location.z + (Math.random() - 0.5)
            });
        }
    } catch {}
});

// ─── PASSIVE 3: Soul Explosion — auto every 20s + aura ───────────────────────
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasScythe(player)) continue;
        initPlayer(player);

        const state = scytheStates.get(player.id);
        const now = Date.now();

        // Soul Explosion auto-trigger
        if (now - state.lastExplosion >= CONFIG.passive.soulExplosion.cd) {
            state.lastExplosion = now;

            player.sendMessage("§5§l[Scythe] 💥 SOUL EXPLOSION!");
            player.playSound("random.explode");

            // Warning ring
            for (let i = 0; i < 36; i++) {
                system.runTimeout(() => {
                    try {
                        const angle = (i / 36) * Math.PI * 2;
                        const r = CONFIG.passive.soulExplosion.radius;
                        player.dimension.spawnParticle("minecraft:critical_hit_emitter", {
                            x: player.location.x + Math.cos(angle) * r,
                            y: player.location.y + 0.3,
                            z: player.location.z + Math.sin(angle) * r
                        });
                    } catch {}
                }, i * 10);
            }

            // Explosion
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
                    for (let i = 0; i < 30; i++) {
                        player.dimension.spawnParticle("minecraft:huge_explosion_emitter", {
                            x: player.location.x + (Math.random() - 0.5) * CONFIG.passive.soulExplosion.radius * 2,
                            y: player.location.y + Math.random() * 2,
                            z: player.location.z + (Math.random() - 0.5) * CONFIG.passive.soulExplosion.radius * 2
                        });
                    }

                    const entities = player.dimension.getEntities({
                        location: player.location,
                        maxDistance: CONFIG.passive.soulExplosion.radius,
                        excludeTypes: ["minecraft:item", "minecraft:player"]
                    });

                    let hitCount = 0;
                    let totalHeal = 0;
                    for (const e of entities) {
                        try {
                            e.applyDamage(CONFIG.passive.soulExplosion.damage, { cause: "magic" });
                            e.addEffect("wither", 80, { amplifier: 1 });
                            e.addEffect("slowness", 60, { amplifier: 1 });
                            hitCount++;
                            totalHeal += CONFIG.passive.soulExplosion.healPerHit;
                        } catch {}
                    }

                    if (hitCount > 0) {
                        const hp = player.getComponent("minecraft:health");
                        hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + totalHeal));
                        player.sendMessage(`§5[Scythe] §cHit ${hitCount} enemies — §aHealed §f+${totalHeal}§a HP!`);
                    }

                    player.playSound("random.explode");
                } catch {}
            }, 360);
        }

        // Orbiting soul aura (2 particles)
        const angle = (Date.now() / 400) % (Math.PI * 2);
        try {
            player.dimension.spawnParticle("minecraft:soul_particle", {
                x: player.location.x + Math.cos(angle) * 0.9,
                y: player.location.y + 1,
                z: player.location.z + Math.sin(angle) * 0.9
            });
            player.dimension.spawnParticle("minecraft:soul_particle", {
                x: player.location.x + Math.cos(angle + Math.PI) * 0.9,
                y: player.location.y + 1,
                z: player.location.z + Math.sin(angle + Math.PI) * 0.9
            });
        } catch {}

        // Action bar HUD
        const reapCd   = Math.max(0, Math.ceil((CONFIG.skills.reap.cd    - (now - state.lastReap))    / 1000));
        const hvstCd   = Math.max(0, Math.ceil((CONFIG.skills.harvest.cd - (now - state.lastHarvest)) / 1000));
        const explodCd = Math.max(0, Math.ceil((CONFIG.passive.soulExplosion.cd - (now - state.lastExplosion)) / 1000));

        const reapStr   = reapCd  === 0 ? "§a§lREADY" : `§f${reapCd}s`;
        const hvstStr   = hvstCd  === 0 ? "§a§lREADY" : `§f${hvstCd}s`;
        const expStr    = explodCd === 0 ? "§a§lREADY" : `§f${explodCd}s`;

        player.onScreenDisplay.setActionBar(
            `§5☠ §7Reap:${reapStr} §7| §5Harvest:${hvstStr} §7| §cExplosion:${expStr}`
        );
    }
}, 10);

world.afterEvents.worldInitialize.subscribe(() => {
    console.warn("§5[Harvester Scythe v2] §fLoaded!");
    console.warn("§7Active: Shadow Reap (right-click) | Soul Harvest (sneak-attack)");
    console.warn("§7Passive: Death Mark (+50% dmg) | Soul Explosion (auto 20s) | Dark Blessing (kill→Speed+Strength)");
});
