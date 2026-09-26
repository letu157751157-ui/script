import { world, system, MolangVariableMap } from "@minecraft/server";

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

// Harvester particles (TheHarvesterRP/particles/harvester_*.json)
const P = {
    wisp: "harvester:soul_wisp",
    souls: "harvester:soul_burst",
    stream: "harvester:soul_stream",
    ember: "harvester:ember",
    trail: "harvester:scythe_trail_big",
    runes: "harvester:rune_circle",
    ring: "harvester:ring_warn",
    shockwave: "harvester:shockwave",
    skull: "harvester:skull_sigil",
    smoke: "harvester:black_smoke"
};
const TEAL = { cr: 0.35, cg: 1, cb: 0.8 };

function fx(dim, id, loc, vars) {
    try {
        if (!vars) return dim.spawnParticle(id, loc);
        const map = new MolangVariableMap();
        for (const key in vars) map.setFloat("variable." + key, vars[key]);
        dim.spawnParticle(id, loc, map);
    } catch {}
}

function soulStream(dim, from, to, life = 0.45) {
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 0.3) return;
    fx(dim, P.stream, from, { dir_x: d.x / len, dir_y: d.y / len, dir_z: d.z / len, speed: len / life, life });
}

// Enemies around the wielder: never players, villagers, traders, armor stands or tamed pets
function enemiesNear(player, radius) {
    try {
        return player.dimension.getEntities({
            location: player.location,
            maxDistance: radius,
            excludeTypes: ["minecraft:item", "minecraft:player", "minecraft:xp_orb", "minecraft:armor_stand"],
            excludeFamilies: ["inanimate", "villager", "wandering_trader", "player"]
        }).filter((e) => {
            try { return !e.getComponent("minecraft:tameable")?.isTamed; } catch { return true; }
        });
    } catch {
        return [];
    }
}

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

        const dim = player.dimension;
        const r = CONFIG.skills.reap.radius;
        player.sendMessage("§5§l[Scythe] ☠ SHADOW REAP!");
        player.playSound("mob.evocation_illager.cast_spell");

        // Rune circle + warning ring under the wielder during the wind-up
        const ground = { x: player.location.x, y: player.location.y + 0.06, z: player.location.z };
        fx(dim, P.runes, ground, { ...TEAL, radius: r, life: 0.6 });
        fx(dim, P.ring, ground, { ...TEAL, radius: r, life: 0.35 });

        // Spiral of souls winding up
        for (let i = 0; i < 18; i++) {
            system.runTimeout(() => {
                try {
                    const angle = (i / 18) * Math.PI * 6; // 3 full rotations
                    const rr = (i / 18) * r;
                    fx(dim, P.wisp, {
                        x: player.location.x + Math.cos(angle) * rr,
                        y: player.location.y + 1 + (i / 18) * 2,
                        z: player.location.z + Math.sin(angle) * rr
                    });
                } catch {}
            }, i * 2);
        }

        // Impact at 300ms (6 ticks): a ring of scythe slashes sweeping around the wielder
        system.runTimeout(() => {
            try {
                const c = player.location;
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    fx(dim, P.trail, { x: c.x + Math.cos(angle) * r * 0.6, y: c.y + 1, z: c.z + Math.sin(angle) * r * 0.6 }, { spin: (i / 12) * 360 });
                }
                fx(dim, P.shockwave, { x: c.x, y: c.y + 0.1, z: c.z }, { ...TEAL, radius: r, life: 0.4 });
                fx(dim, P.souls, { x: c.x, y: c.y + 1.2, z: c.z });

                for (const e of enemiesNear(player, r)) {
                    try {
                        e.applyDamage(CONFIG.skills.reap.damage, { cause: "magic", damagingEntity: player });
                        e.addEffect("slowness", 60, { amplifier: 2 });    // Slowness III, 3s
                        e.addEffect("wither", 60, { amplifier: 1 });      // Wither II, 3s
                        e.addEffect("blindness", 40, { amplifier: 0 });   // Blindness 2s
                        fx(dim, P.ember, { x: e.location.x, y: e.location.y + 1, z: e.location.z });
                    } catch {}
                }

                player.playSound("mob.wither.shoot");
            } catch {}
        }, 6);

        state.lastReap = now;
    } catch {}
}

// ─── SOUL HARVEST (Interact with an entity) ──────────────────────────────────
function soulHarvest(player) {
    try {
        const state = scytheStates.get(player.id);
        const now = Date.now();

        if (now - state.lastHarvest < CONFIG.skills.harvest.cd) {
            const cd = Math.ceil((CONFIG.skills.harvest.cd - (now - state.lastHarvest)) / 1000);
            player.sendMessage(`§c[Scythe] Soul Harvest cooldown: ${cd}s`);
            return;
        }

        const dim = player.dimension;
        const entities = enemiesNear(player, CONFIG.skills.harvest.radius);
        let totalDamage = 0;

        for (const e of entities) {
            try {
                e.applyDamage(CONFIG.skills.harvest.damage, { cause: "magic", damagingEntity: player });
                e.addEffect("slowness", 80, { amplifier: 3 }); // Slowness IV — pull-trapped
                totalDamage += CONFIG.skills.harvest.damage;

                // Harvested souls fly from each victim into the wielder
                const from = { x: e.location.x, y: e.location.y + 1, z: e.location.z };
                for (let i = 0; i < 3; i++) {
                    system.runTimeout(() => {
                        try { soulStream(dim, from, { x: player.location.x, y: player.location.y + 1.1, z: player.location.z }); } catch {}
                    }, 1 + i * 4);
                }
            } catch {}
        }

        if (totalDamage > 0) {
            const health = player.getComponent("minecraft:health");
            const heal = totalDamage * CONFIG.skills.harvest.heal;
            health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + heal));
            player.sendMessage(`§5[Scythe] §aSoul Harvest — Healed §f+${heal.toFixed(1)}§a HP from ${entities.length} enemies!`);
            system.runTimeout(() => fx(dim, P.souls, { x: player.location.x, y: player.location.y + 1, z: player.location.z }), 12);
        } else {
            player.sendMessage("§5[Scythe] §fSoul Harvest — No enemies in range!");
        }

        state.lastHarvest = now;
        player.playSound("mob.witch.drink");
    } catch {}
}

// ─── EVENT: Right-click → Shadow Reap ────────────────────────────────────────
world.afterEvents.itemUse?.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (item.typeId !== CONFIG.itemId) return;
    initPlayer(player);
    shadowReap(player);
});

// ─── EVENT: Interact with an entity → Soul Harvest ───────────────────────────
// Before-events run in read-only mode (no damage/effects/health changes allowed),
// so the skill itself runs on the next tick.
let lastInteract = new Map();
world.beforeEvents.playerInteractWithEntity?.subscribe((event) => {
    const player = event.player;
    if (!hasScythe(player)) return;
    const now = Date.now();
    if (now - (lastInteract.get(player.id) || 0) < 300) return;
    event.cancel = true;
    lastInteract.set(player.id, now);
    system.run(() => {
        initPlayer(player);
        soulHarvest(player);
    });
});

// ─── PASSIVE 1: Death Mark — hit = mark, marked = +50% dmg + Wither ──────────
world.afterEvents.entityHurt?.subscribe((event) => {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    if (!attacker || attacker.typeId !== "minecraft:player") return;
    // the scythe's own skill damage (magic) must not re-trigger the mark
    if (event.damageSource.cause === "magic") return;
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
            victim.addEffect("wither", CONFIG.passive.deathMark.duration, { amplifier: 0 });

            // Skull sigil under a freshly marked target
            if (!alreadyMarked) {
                fx(player.dimension, P.skull, { x: victim.location.x, y: victim.location.y + 0.07, z: victim.location.z }, { life: 1.2 });
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
                        victim.applyDamage(bonus, { cause: "magic", damagingEntity: player });
                        fx(player.dimension, P.ember, { x: victim.location.x, y: victim.location.y + 1, z: victim.location.z });
                        // Small HP drain back to player on mark proc
                        const hp = player.getComponent("minecraft:health");
                        hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 1));
                    } catch {}
                }, 1);
            }
        }
    } catch {}
});

// ─── PASSIVE 2: Dark Blessing — killing grants Speed II + Strength I ─────────
world.afterEvents.entityDie?.subscribe((event) => {
    try {
        const killer = event.damageSource?.damagingEntity;
        if (!killer || killer.typeId !== "minecraft:player") return;
        if (!hasScythe(killer)) return;

        initPlayer(killer);
        killer.addEffect("speed", CONFIG.passive.darkBlessing.duration, { amplifier: 1 });
        killer.addEffect("strength", CONFIG.passive.darkBlessing.duration, { amplifier: 0 });

        const dead = event.deadEntity;
        soulStream(killer.dimension,
            { x: dead.location.x, y: dead.location.y + 1, z: dead.location.z },
            { x: killer.location.x, y: killer.location.y + 1.1, z: killer.location.z });
    } catch {}
});

// ─── PASSIVE 3: Soul Explosion — auto every 20s + aura ───────────────────────
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasScythe(player)) continue;
        initPlayer(player);

        const state = scytheStates.get(player.id);
        const now = Date.now();
        const dim = player.dimension;
        const r = CONFIG.passive.soulExplosion.radius;

        // Soul Explosion auto-trigger (only when there is something to hit)
        if (now - state.lastExplosion >= CONFIG.passive.soulExplosion.cd && enemiesNear(player, r).length > 0) {
            state.lastExplosion = now;

            player.sendMessage("§5§l[Scythe] 💥 SOUL EXPLOSION!");
            player.playSound("random.explode");

            // Warning ring (0.9 s) then the blast
            const ground = { x: player.location.x, y: player.location.y + 0.06, z: player.location.z };
            fx(dim, P.ring, ground, { ...TEAL, radius: r, life: 0.9 });
            fx(dim, P.runes, ground, { ...TEAL, radius: r * 0.6, life: 0.9 });

            system.runTimeout(() => {
                try {
                    const c = player.location;
                    fx(dim, P.shockwave, { x: c.x, y: c.y + 0.1, z: c.z }, { ...TEAL, radius: r, life: 0.5 });
                    fx(dim, P.souls, { x: c.x, y: c.y + 1, z: c.z });
                    for (let i = 0; i < 8; i++) {
                        const a = (i / 8) * Math.PI * 2;
                        fx(dim, P.smoke, { x: c.x + Math.cos(a) * r * 0.5, y: c.y + 0.8, z: c.z + Math.sin(a) * r * 0.5 });
                    }

                    let hitCount = 0;
                    let totalHeal = 0;
                    for (const e of enemiesNear(player, r)) {
                        try {
                            e.applyDamage(CONFIG.passive.soulExplosion.damage, { cause: "magic", damagingEntity: player });
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
            }, 18);
        }

        // Orbiting soul aura (2 wisps)
        const angle = (Date.now() / 400) % (Math.PI * 2);
        try {
            if (system.currentTick % 20 === 0) {
                for (const a of [angle, angle + Math.PI]) {
                    fx(dim, P.wisp, {
                        x: player.location.x + Math.cos(a) * 0.9,
                        y: player.location.y + 0.6,
                        z: player.location.z + Math.sin(a) * 0.9
                    });
                }
            }
        } catch {}
    }
}, 10);

world.afterEvents.worldInitialize?.subscribe(() => {
    console.warn("§5[Harvester Scythe v3] §fLoaded!");
    console.warn("§7Active: Shadow Reap (right-click) | Soul Harvest (interact with a mob)");
    console.warn("§7Passive: Death Mark (+50% dmg) | Soul Explosion (auto 20s) | Dark Blessing (kill→Speed+Strength)");
});
