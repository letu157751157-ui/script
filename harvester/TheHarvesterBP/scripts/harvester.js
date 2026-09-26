import { world, system } from "@minecraft/server";

const bossStates = new Map();
const bossArena  = new Map();

const CONFIG = {
    typeId: "pa:harvester",
    enrageTime: 300000, // 5 minutes
    skills: {
        summon:    { cd: 14000, count: 3 },          // slightly faster
        dash:      { cd:  9000, dmg: 8,  radius: 3 },// dmg 6→8
        slam:      { cd: 18000, dmg: 12, radius: 6 },// dmg 8→12, radius 5→6
        regen:     { cd: 300000 },
        clone:     { cd: 22000 },
        beam:      { cd: 16000, dmg: 14 },            // dmg 10→14
        drain:     { cd: 20000, dmg: 8,  radius: 12 },// dmg 3→8, radius 8→12
        storm:     { cd: 32000, duration: 8000 },
        teleport:  { cd: 11000, dmg: 10 },            // dmg 7→10
        ultimate:  { cd: 40000, dmg: 22, radius: 14 },// dmg 15→22, radius 12→14
        // ── NEW SKILLS ──
        judgment:  { cd: 35000, dmg: 18, radius: 14, delay: 3000 }, // Reaper's Judgment
        vortex:    { cd: 28000, dmg: 4,  radius: 10, ticks: 6 },    // Soul Vortex
        curse:     { cd: 30000, dmg: 3,  duration: 100 }            // Reaper's Curse
    }
};

function initBoss(boss) {
    const id = boss.id;
    if (!bossStates.has(id)) {
        bossStates.set(id, {
            lastSummon: 0, lastDash: 0, lastSlam: 0, lastRegen: 0,
            lastClone: 0, lastBeam: 0, lastDrain: 0, lastStorm: 0,
            lastTeleport: 0, lastUltimate: 0,
            lastJudgment: 0, lastVortex: 0, lastCurse: 0,
            phase: 1, isEnraged: false, startTime: Date.now()
        });
        bossArena.set(id, { ...boss.location });
    }
}

function cdMod(boss) {
    const s = bossStates.get(boss.id);
    if (!s) return 1;
    if (s.isEnraged) return 0.5; // Enrage: all CDs 50% shorter
    if (s.phase === 3) return 0.7;
    if (s.phase === 2) return 0.85;
    return 1;
}

function getPhase(boss) {
    try {
        const health = boss.getComponent("minecraft:health");
        const hp = (health.currentValue / health.effectiveMax) * 100;
        const state = bossStates.get(boss.id);
        if (!state) return 1;

        if (hp <= 25 && state.phase < 3) {
            state.phase = 3;
            announcePhase(boss, 3);
            return 3;
        } else if (hp <= 50 && state.phase === 1) {
            state.phase = 2;
            announcePhase(boss, 2);
            return 2;
        }
        return state.phase;
    } catch { return 1; }
}

function announcePhase(boss, phase) {
    try {
        const msg  = phase === 3 ? "§4§l☠ THE HARVESTER AWAKENS — PHASE 3 ☠" : "§c§l⚔ THE HARVESTER RAGES — PHASE 2 ⚔";
        const part = phase === 3 ? "minecraft:dragon_breath_fire" : "minecraft:huge_explode_emitter";

        world.sendMessage(msg);

        for (let i = 0; i < 120; i++) {
            boss.dimension.spawnParticle(part, {
                x: boss.location.x + (Math.random() - 0.5) * 8,
                y: boss.location.y + Math.random() * 5,
                z: boss.location.z + (Math.random() - 0.5) * 8
            });
        }

        boss.dimension.playSound("mob.wither.spawn", boss.location);

        // Notify nearby players with title
        const players = boss.dimension.getEntities({
            location: boss.location, maxDistance: 40, type: "minecraft:player"
        });
        for (const p of players) {
            p.onScreenDisplay.setTitle(phase === 3 ? "§4§l☠ PHASE 3 ☠" : "§c§l⚔ PHASE 2 ⚔");
            p.onScreenDisplay.updateSubtitle(phase === 3 ? "§fThe Harvester's true form awakens!" : "§fThe Harvester grows stronger!");
        }

        if (phase === 2) {
            boss.addEffect("strength", 999999, { amplifier: 0 });
            boss.addEffect("speed",    999999, { amplifier: 0 });
        } else if (phase === 3) {
            boss.addEffect("strength",   999999, { amplifier: 2 });
            boss.addEffect("speed",      999999, { amplifier: 1 });
            boss.addEffect("resistance", 999999, { amplifier: 1 });
            boss.addEffect("fire_resistance", 999999, { amplifier: 0 });
        }
    } catch {}
}

function checkEnrage(boss) {
    try {
        const state = bossStates.get(boss.id);
        if (!state || state.isEnraged) return;
        if (Date.now() - state.startTime < CONFIG.enrageTime) return;

        state.isEnraged = true;
        boss.addEffect("strength",   999999, { amplifier: 3 });
        boss.addEffect("speed",      999999, { amplifier: 2 });
        boss.addEffect("resistance", 999999, { amplifier: 2 });

        world.sendMessage("§4§l☠ THE HARVESTER ENRAGES! ALL COOLDOWNS HALVED! ☠");
        boss.dimension.playSound("mob.wither.spawn", boss.location);

        const players = boss.dimension.getEntities({
            location: boss.location, maxDistance: 50, type: "minecraft:player"
        });
        for (const p of players) {
            p.onScreenDisplay.setTitle("§4§l☠ ENRAGED ☠");
            p.onScreenDisplay.updateSubtitle("§cRun. There is no mercy.");
        }
    } catch {}
}

// ─── SUMMON MINIONS ──────────────────────────────────────────────────────────
function summonMinions(boss, phase) {
    try {
        // Phase 3 → wither skeletons; Phase 2 → powered zombies; Phase 1 → vanilla mobs
        const types = phase >= 3
            ? ["minecraft:wither_skeleton", "minecraft:wither_skeleton", "minecraft:wither_skeleton"]
            : phase === 2
                ? ["minecraft:zombie", "minecraft:zombie", "minecraft:skeleton"]
                : ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider"];

        const count = CONFIG.skills.summon.count + (phase - 1);

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const loc = {
                x: boss.location.x + Math.cos(angle) * 3.5,
                y: boss.location.y,
                z: boss.location.z + Math.sin(angle) * 3.5
            };
            const minion = boss.dimension.spawnEntity(types[i % types.length], loc);
            minion.addEffect("strength", 999999, { amplifier: phase >= 3 ? 1 : 0 });
            minion.addEffect("speed",    999999, { amplifier: 0 });
            if (phase >= 3) minion.addEffect("resistance", 999999, { amplifier: 0 });
            boss.dimension.spawnParticle("minecraft:soul_particle", loc);
        }

        boss.dimension.playSound("mob.evocation_illager.prepare_summon", boss.location);
    } catch {}
}

// ─── DASH ATTACK ─────────────────────────────────────────────────────────────
function dashAttack(boss) {
    try {
        boss.addEffect("speed", 40, { amplifier: 5 });

        for (let i = 0; i < 20; i++) {
            system.runTimeout(() => {
                try { boss.dimension.spawnParticle("minecraft:critical_hit_emitter", boss.location); } catch {}
            }, i * 2);
        }

        system.runTimeout(() => {
            try {
                const players = boss.dimension.getEntities({
                    location: boss.location, maxDistance: CONFIG.skills.dash.radius, type: "minecraft:player"
                });
                for (const p of players) {
                    p.applyDamage(CONFIG.skills.dash.dmg);
                    p.addEffect("levitation", 25, { amplifier: 2 });
                    p.addEffect("slowness",   40, { amplifier: 1 }); // NEW: slow on dash hit
                }
            } catch {}
        }, 40);
        boss.dimension.playSound("mob.irongolem.throw", boss.location);
    } catch {}
}

// ─── GROUND SLAM ─────────────────────────────────────────────────────────────
function groundSlam(boss) {
    try {
        world.sendMessage("§c§l[HARVESTER] ⚠ GROUND SLAM!");
        boss.addEffect("levitation", 20, { amplifier: 3 });

        system.runTimeout(() => {
            try {
                for (let i = 0; i < 120; i++) {
                    boss.dimension.spawnParticle("minecraft:huge_explode_emitter", {
                        x: boss.location.x + (Math.random() - 0.5) * 12,
                        y: boss.location.y + 0.5,
                        z: boss.location.z + (Math.random() - 0.5) * 12
                    });
                }
                for (let i = 0; i < 40; i++) {
                    const angle = (i / 40) * Math.PI * 2;
                    boss.dimension.spawnParticle("minecraft:soul_particle", {
                        x: boss.location.x + Math.cos(angle) * CONFIG.skills.slam.radius,
                        y: boss.location.y + 0.5,
                        z: boss.location.z + Math.sin(angle) * CONFIG.skills.slam.radius
                    });
                }

                const players = boss.dimension.getEntities({
                    location: boss.location, maxDistance: CONFIG.skills.slam.radius, type: "minecraft:player"
                });
                for (const p of players) {
                    p.applyDamage(CONFIG.skills.slam.dmg);
                    const dx = p.location.x - boss.location.x;
                    const dz = p.location.z - boss.location.z;
                    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                    p.applyKnockback(dx / dist, dz / dist, 3, 0.7); // stronger knockback
                    p.addEffect("slowness",  80, { amplifier: 2 });
                    p.addEffect("weakness",  60, { amplifier: 0 }); // NEW: Weakness
                }

                boss.dimension.playSound("random.explode", boss.location);
            } catch {}
        }, 20);
    } catch {}
}

// ─── REGENERATION ────────────────────────────────────────────────────────────
function regeneration(boss) {
    try {
        boss.addEffect("regeneration", 100, { amplifier: 3 });
        boss.addEffect("resistance",   100, { amplifier: 2 });

        for (let i = 0; i < 50; i++) {
            system.runTimeout(() => {
                try {
                    boss.dimension.spawnParticle("minecraft:heart_particle", {
                        x: boss.location.x + (Math.random() - 0.5) * 4,
                        y: boss.location.y + Math.random() * 3,
                        z: boss.location.z + (Math.random() - 0.5) * 4
                    });
                } catch {}
            }, i * 2);
        }
        world.sendMessage("§2§l[HARVESTER] 💚 REGENERATING!");
        boss.dimension.playSound("random.levelup", boss.location);
    } catch {}
}

// ─── SHADOW CLONE (upgraded: wither skeletons instead of vex) ────────────────
function shadowClone(boss) {
    try {
        world.sendMessage("§5§l[HARVESTER] 👥 SHADOW CLONES!");
        for (let i = 0; i < 3; i++) { // was 2, now 3
            const angle = (i / 3) * Math.PI * 2;
            const loc = {
                x: boss.location.x + Math.cos(angle) * 4,
                y: boss.location.y,
                z: boss.location.z + Math.sin(angle) * 4
            };
            const clone = boss.dimension.spawnEntity("minecraft:wither_skeleton", loc);
            clone.addEffect("strength", 400, { amplifier: 2 });
            clone.addEffect("speed",    400, { amplifier: 2 });
            clone.addEffect("resistance", 200, { amplifier: 1 });

            for (let j = 0; j < 10; j++) {
                boss.dimension.spawnParticle("minecraft:end_rod", loc);
            }
        }
        boss.dimension.playSound("mob.evocation_illager.prepare_attack", boss.location);
    } catch {}
}

// ─── DARK BEAM (upgraded: wider targeting) ───────────────────────────────────
function darkBeam(boss) {
    try {
        world.sendMessage("§4§l[HARVESTER] 🔴 DARK BEAM!");
        const dir = boss.getViewDirection();

        for (let i = 0; i < 25; i++) {
            system.runTimeout(() => {
                try {
                    for (let d = 0; d < 22; d++) {
                        boss.dimension.spawnParticle("minecraft:dragon_breath_trail", {
                            x: boss.location.x + dir.x * d,
                            y: boss.location.y + 1.5 + dir.y * d,
                            z: boss.location.z + dir.z * d
                        });
                    }
                } catch {}
            }, i * 2);
        }

        system.runTimeout(() => {
            try {
                const players = boss.dimension.getEntities({
                    location: boss.location, maxDistance: 22, type: "minecraft:player"
                });
                for (const p of players) {
                    const to = {
                        x: p.location.x - boss.location.x,
                        y: p.location.y - boss.location.y,
                        z: p.location.z - boss.location.z
                    };
                    const dist = Math.sqrt(to.x ** 2 + to.y ** 2 + to.z ** 2) || 1;
                    const dot  = (to.x * dir.x + to.y * dir.y + to.z * dir.z) / dist;
                    if (dot > 0.85) { // wider cone than before (was 0.9)
                        p.applyDamage(CONFIG.skills.beam.dmg);
                        p.addEffect("wither",   80, { amplifier: 1 });
                        p.addEffect("slowness", 60, { amplifier: 1 }); // NEW
                    }
                }
            } catch {}
        }, 50);
        boss.dimension.playSound("mob.enderdragon.growl", boss.location);
    } catch {}
}

// ─── LIFE DRAIN (upgraded: bigger radius, more dmg, more heal) ───────────────
function lifeDrain(boss) {
    try {
        world.sendMessage("§5§l[HARVESTER] 🩸 LIFE DRAIN!");
        const players = boss.dimension.getEntities({
            location: boss.location, maxDistance: CONFIG.skills.drain.radius, type: "minecraft:player"
        });

        let totalDmg = 0;
        for (const p of players) {
            p.applyDamage(CONFIG.skills.drain.dmg);
            totalDmg += CONFIG.skills.drain.dmg;
            p.addEffect("weakness", 80, { amplifier: 0 }); // NEW: Weakness on drain

            for (let i = 0; i < 14; i++) {
                system.runTimeout(() => {
                    try {
                        const t = i / 14;
                        boss.dimension.spawnParticle("minecraft:soul_particle", {
                            x: p.location.x + (boss.location.x - p.location.x) * t,
                            y: p.location.y + 1 + (boss.location.y - p.location.y) * t,
                            z: p.location.z + (boss.location.z - p.location.z) * t
                        });
                    } catch {}
                }, i * 4);
            }
        }

        if (totalDmg > 0) {
            const health = boss.getComponent("minecraft:health");
            health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + totalDmg * 0.75)); // 50%→75%
        }
        boss.dimension.playSound("mob.witch.drink", boss.location);
    } catch {}
}

// ─── CHAOS STORM ─────────────────────────────────────────────────────────────
function chaosStorm(boss) {
    try {
        world.sendMessage("§6§l[HARVESTER] ⛈ CHAOS STORM!");
        for (let i = 0; i < 80; i++) {
            system.runTimeout(() => {
                try {
                    for (let j = 0; j < 3; j++) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist  = Math.random() * 12; // radius 10→12
                        const loc   = {
                            x: boss.location.x + Math.cos(angle) * dist,
                            y: boss.location.y,
                            z: boss.location.z + Math.sin(angle) * dist
                        };
                        for (let k = 0; k < 5; k++) {
                            boss.dimension.spawnParticle("minecraft:dragon_breath_fire", {
                                x: loc.x, y: loc.y + k, z: loc.z
                            });
                        }
                        const victims = boss.dimension.getEntities({
                            location: loc, maxDistance: 2, type: "minecraft:player"
                        });
                        for (const v of victims) {
                            v.applyDamage(2);
                            v.addEffect("slowness", 20, { amplifier: 0 }); // NEW: slow in storm
                        }
                    }
                } catch {}
            }, i * 100);
        }
        boss.dimension.playSound("ambient.weather.thunder", boss.location);
    } catch {}
}

// ─── TELEPORT STRIKE ─────────────────────────────────────────────────────────
function teleportStrike(boss) {
    try {
        const players = boss.dimension.getEntities({
            location: boss.location, maxDistance: 18, type: "minecraft:player"
        });
        if (players.length === 0) return;

        const target = players[Math.floor(Math.random() * players.length)];
        for (let i = 0; i < 25; i++) boss.dimension.spawnParticle("minecraft:end_rod", boss.location);
        boss.teleport(target.location);
        for (let i = 0; i < 25; i++) boss.dimension.spawnParticle("minecraft:end_rod", boss.location);

        target.applyDamage(CONFIG.skills.teleport.dmg);
        target.addEffect("blindness", 80, { amplifier: 0 });
        target.addEffect("wither",    60, { amplifier: 0 }); // NEW: Wither on teleport
        boss.dimension.playSound("mob.endermen.portal", boss.location);
    } catch {}
}

// ─── SOUL HARVEST (Ultimate Phase 3, upgraded) ───────────────────────────────
function soulHarvestUltimate(boss) {
    try {
        world.sendMessage("§4§l☠ [HARVESTER] SOUL HARVEST — ULTIMATE! ☠");

        // Wind-up ring
        for (let i = 0; i < 56; i++) {
            system.runTimeout(() => {
                try {
                    const angle = (i / 56) * Math.PI * 2;
                    boss.dimension.spawnParticle("minecraft:soul_particle", {
                        x: boss.location.x + Math.cos(angle) * 4,
                        y: boss.location.y + 2,
                        z: boss.location.z + Math.sin(angle) * 4
                    });
                } catch {}
            }, i * 8);
        }

        system.runTimeout(() => {
            try {
                // Massive particle burst
                for (let i = 0; i < 200; i++) {
                    boss.dimension.spawnParticle("minecraft:dragon_death_explosion_emitter", {
                        x: boss.location.x + (Math.random() - 0.5) * 28,
                        y: boss.location.y + Math.random() * 6,
                        z: boss.location.z + (Math.random() - 0.5) * 28
                    });
                }

                const victims = boss.dimension.getEntities({
                    location: boss.location, maxDistance: CONFIG.skills.ultimate.radius, type: "minecraft:player"
                });

                for (const v of victims) {
                    v.applyDamage(CONFIG.skills.ultimate.dmg);
                    v.addEffect("wither",    120, { amplifier: 2 });
                    v.addEffect("weakness",  100, { amplifier: 1 });
                    v.addEffect("slowness",   80, { amplifier: 2 }); // NEW
                    v.addEffect("blindness",  60, { amplifier: 0 }); // NEW

                    v.onScreenDisplay.setTitle("§4§l☠ SOUL HARVEST ☠");
                    v.onScreenDisplay.updateSubtitle("§cYour soul belongs to the Harvester!");
                }

                // Heal boss for each victim hit
                if (victims.length > 0) {
                    const health = boss.getComponent("minecraft:health");
                    health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + victims.length * 10));
                }

                boss.dimension.playSound("mob.wither.shoot", boss.location);
            } catch {}
        }, 450);
    } catch {}
}

// ─── NEW: REAPER'S JUDGMENT (Phase 3, CD 35s) ────────────────────────────────
// Marks all nearby players → 3s countdown → explosion on each marked player
function reaperJudgment(boss) {
    try {
        world.sendMessage("§4§l☠ [HARVESTER] REAPER'S JUDGMENT — MARKED FOR DEATH! ☠");
        boss.dimension.playSound("mob.wither.spawn", boss.location);

        const players = boss.dimension.getEntities({
            location: boss.location, maxDistance: CONFIG.skills.judgment.radius, type: "minecraft:player"
        });

        for (const p of players) {
            p.addEffect("glowing",   60, { amplifier: 0 });
            p.addEffect("slowness",  40, { amplifier: 1 });
            p.onScreenDisplay.setTitle("§4§l☠ MARKED ☠");
            p.onScreenDisplay.updateSubtitle("§cJudgment falls in 3 seconds!");

            // Countdown particles around each marked player
            for (let tick = 0; tick < 30; tick++) {
                system.runTimeout(() => {
                    try {
                        const angle = (tick / 30) * Math.PI * 2;
                        p.dimension.spawnParticle("minecraft:villager_angry", {
                            x: p.location.x + Math.cos(angle),
                            y: p.location.y + 2,
                            z: p.location.z + Math.sin(angle)
                        });
                    } catch {}
                }, tick * 10);
            }
        }

        // Judgment detonation after 3s
        system.runTimeout(() => {
            try {
                for (const p of players) {
                    try {
                        p.applyDamage(CONFIG.skills.judgment.dmg);
                        p.addEffect("wither",   100, { amplifier: 2 });
                        p.addEffect("blindness", 60, { amplifier: 0 });
                        p.addEffect("weakness",  80, { amplifier: 1 });

                        for (let i = 0; i < 30; i++) {
                            p.dimension.spawnParticle("minecraft:huge_explosion_emitter", {
                                x: p.location.x + (Math.random() - 0.5) * 3,
                                y: p.location.y + Math.random() * 2,
                                z: p.location.z + (Math.random() - 0.5) * 3
                            });
                        }
                        p.dimension.playSound("random.explode", p.location);
                    } catch {}
                }
            } catch {}
        }, CONFIG.skills.judgment.delay);
    } catch {}
}

// ─── NEW: SOUL VORTEX (Phase 2+, CD 28s) ─────────────────────────────────────
// Spinning ring of souls that damages and pulls players inward
function soulVortex(boss) {
    try {
        world.sendMessage("§5§l[HARVESTER] 🌀 SOUL VORTEX!");
        boss.dimension.playSound("mob.enderdragon.growl", boss.location);

        const r = CONFIG.skills.vortex.radius;

        for (let tick = 0; tick < CONFIG.skills.vortex.ticks * 20; tick++) {
            system.runTimeout(() => {
                try {
                    const angle = (tick / 10) * Math.PI; // spinning
                    for (let a = 0; a < 8; a++) {
                        const ringAngle = angle + (a / 8) * Math.PI * 2;
                        boss.dimension.spawnParticle("minecraft:soul_particle", {
                            x: boss.location.x + Math.cos(ringAngle) * r,
                            y: boss.location.y + 1.5 + Math.sin(tick / 20) * 1.5,
                            z: boss.location.z + Math.sin(ringAngle) * r
                        });
                    }

                    // Every 20 ticks: damage + pull players
                    if (tick % 20 === 0) {
                        const players = boss.dimension.getEntities({
                            location: boss.location, maxDistance: r, type: "minecraft:player"
                        });
                        for (const p of players) {
                            p.applyDamage(CONFIG.skills.vortex.dmg);

                            // Pull toward boss center
                            const dx = boss.location.x - p.location.x;
                            const dz = boss.location.z - p.location.z;
                            const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                            p.applyKnockback(-dx / dist, -dz / dist, 1.5, 0.2); // negative = toward boss
                        }
                    }
                } catch {}
            }, tick * 50);
        }
    } catch {}
}

// ─── NEW: REAPER'S CURSE (Phase 3, CD 30s) ───────────────────────────────────
// Curses all nearby players — they take 3 dmg/s for 5s from the curse
function reaperCurse(boss) {
    try {
        world.sendMessage("§4§l[HARVESTER] 🪦 REAPER'S CURSE!");
        boss.dimension.playSound("mob.witch.ambient", boss.location);

        const players = boss.dimension.getEntities({
            location: boss.location, maxDistance: 16, type: "minecraft:player"
        });

        for (const p of players) {
            p.addEffect("wither",    CONFIG.skills.curse.duration, { amplifier: 1 });
            p.addEffect("slowness",  CONFIG.skills.curse.duration, { amplifier: 1 });
            p.addEffect("weakness",  CONFIG.skills.curse.duration, { amplifier: 0 });

            for (let i = 0; i < 15; i++) {
                system.runTimeout(() => {
                    try {
                        p.dimension.spawnParticle("minecraft:soul_flame_particle", {
                            x: p.location.x + (Math.random() - 0.5) * 1.5,
                            y: p.location.y + Math.random() * 2,
                            z: p.location.z + (Math.random() - 0.5) * 1.5
                        });
                    } catch {}
                }, i * 10);
            }

            p.onScreenDisplay.setTitle("§5§l🪦 CURSED 🪦");
            p.onScreenDisplay.updateSubtitle("§7Your soul is withering away...");
        }
    } catch {}
}

// ─── AURA ────────────────────────────────────────────────────────────────────
function createAura(boss, phase, enraged) {
    try {
        let p1 = "minecraft:soul_particle";
        let p2 = "minecraft:end_rod";
        if (enraged) { p1 = "minecraft:dragon_breath_fire"; p2 = "minecraft:huge_explosion_emitter"; }
        else if (phase === 3) { p1 = "minecraft:soul_particle"; p2 = "minecraft:soul_flame_particle"; }
        else if (phase === 2) { p1 = "minecraft:end_rod"; p2 = "minecraft:soul_particle"; }

        const t = Date.now() / 500;
        for (let i = 0; i < 4; i++) {
            const angle = t + (i / 4) * Math.PI * 2;
            const sel = i % 2 === 0 ? p1 : p2;
            boss.dimension.spawnParticle(sel, {
                x: boss.location.x + Math.cos(angle) * 2.2,
                y: boss.location.y + 1.8,
                z: boss.location.z + Math.sin(angle) * 2.2
            });
        }
    } catch {}
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function displayInfo(boss, phase, state) {
    try {
        const health  = boss.getComponent("minecraft:health");
        const hpPct   = ((health.currentValue / health.effectiveMax) * 100).toFixed(1);
        const players = boss.dimension.getEntities({
            location: boss.location, maxDistance: 40, type: "minecraft:player"
        });

        const color  = phase === 3 ? "§4" : (phase === 2 ? "§c" : "§e");
        const enrage = state.isEnraged ? " §4§l[ENRAGED]" : "";
        const timeLeft = CONFIG.enrageTime - (Date.now() - state.startTime);
        const min  = Math.max(0, Math.floor(timeLeft / 60000));
        const sec  = Math.max(0, Math.floor((timeLeft % 60000) / 1000));

        for (const p of players) {
            if (!state.isEnraged && timeLeft > 0) {
                p.onScreenDisplay.setActionBar(
                    `§c§l☠ HARVESTER${enrage} ${color}P${phase} §f| §a${hpPct}% §f| §e${min}:${sec.toString().padStart(2, "0")}`
                );
            } else {
                p.onScreenDisplay.setActionBar(
                    `§c§l☠ HARVESTER${enrage} ${color}P${phase} §f| §a${hpPct}%`
                );
            }
        }
    } catch {}
}

// ─── BOUNDARY CHECK ──────────────────────────────────────────────────────────
function checkBoundary(boss) {
    try {
        const center = bossArena.get(boss.id);
        if (!center) return;
        const dist = Math.sqrt((boss.location.x - center.x) ** 2 + (boss.location.z - center.z) ** 2);
        if (dist > 50) {
            boss.teleport(center);
            const health = boss.getComponent("minecraft:health");
            health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 20));
        }
    } catch {}
}

// ─── BOSS AI LOOP ─────────────────────────────────────────────────────────────
function bossAI(boss) {
    try {
        initBoss(boss);

        const id = boss.id;
        const s  = bossStates.get(id);
        const t  = Date.now();
        const mod = cdMod(boss);
        const phase = getPhase(boss);

        checkEnrage(boss);

        const players = boss.dimension.getEntities({
            location: boss.location, maxDistance: 30, type: "minecraft:player"
        });
        if (players.length === 0) return;

        const skills = [];

        // Phase 1+ skills
        if (t - s.lastSummon   >= CONFIG.skills.summon.cd   * mod) skills.push("summon");
        if (t - s.lastDash     >= CONFIG.skills.dash.cd     * mod) skills.push("dash");
        if (t - s.lastSlam     >= CONFIG.skills.slam.cd     * mod) skills.push("slam");
        if (t - s.lastBeam     >= CONFIG.skills.beam.cd     * mod) skills.push("beam");

        // Phase 2+ skills
        if (phase >= 2) {
            const hp = (boss.getComponent("minecraft:health").currentValue / boss.getComponent("minecraft:health").effectiveMax) * 100;
            if (hp < 50 && t - s.lastRegen    >= CONFIG.skills.regen.cd    * mod) skills.push("regen");
            if (t - s.lastClone    >= CONFIG.skills.clone.cd    * mod) skills.push("clone");
            if (t - s.lastDrain    >= CONFIG.skills.drain.cd    * mod) skills.push("drain");
            if (t - s.lastStorm    >= CONFIG.skills.storm.cd    * mod) skills.push("storm");
            if (t - s.lastTeleport >= CONFIG.skills.teleport.cd * mod) skills.push("teleport");
            if (t - s.lastVortex   >= CONFIG.skills.vortex.cd   * mod) skills.push("vortex");  // NEW
        }

        // Phase 3 skills
        if (phase === 3) {
            if (t - s.lastUltimate  >= CONFIG.skills.ultimate.cd  * mod) skills.push("ultimate");
            if (t - s.lastJudgment  >= CONFIG.skills.judgment.cd  * mod) skills.push("judgment"); // NEW
            if (t - s.lastCurse     >= CONFIG.skills.curse.cd      * mod) skills.push("curse");   // NEW
        }

        if (skills.length > 0) {
            const skill = skills[Math.floor(Math.random() * skills.length)];
            switch (skill) {
                case "summon":   summonMinions(boss, phase);   s.lastSummon   = t; break;
                case "dash":     dashAttack(boss);             s.lastDash     = t; break;
                case "slam":     groundSlam(boss);             s.lastSlam     = t; break;
                case "regen":    regeneration(boss);           s.lastRegen    = t; break;
                case "clone":    shadowClone(boss);            s.lastClone    = t; break;
                case "beam":     darkBeam(boss);               s.lastBeam     = t; break;
                case "drain":    lifeDrain(boss);              s.lastDrain    = t; break;
                case "storm":    chaosStorm(boss);             s.lastStorm    = t; break;
                case "teleport": teleportStrike(boss);         s.lastTeleport = t; break;
                case "ultimate": soulHarvestUltimate(boss);   s.lastUltimate = t; break;
                case "vortex":   soulVortex(boss);             s.lastVortex   = t; break; // NEW
                case "judgment": reaperJudgment(boss);         s.lastJudgment = t; break; // NEW
                case "curse":    reaperCurse(boss);            s.lastCurse    = t; break; // NEW
            }
        }

        createAura(boss, phase, s.isEnraged);
        displayInfo(boss, phase, s);
        checkBoundary(boss);
    } catch {}
}

// ─── MAIN LOOP ───────────────────────────────────────────────────────────────
system.runInterval(() => {
    try {
        for (const dim of [
            world.getDimension("overworld"),
            world.getDimension("nether"),
            world.getDimension("the_end")
        ]) {
            const bosses = dim.getEntities({ type: CONFIG.typeId });
            for (const boss of bosses) bossAI(boss);
        }
    } catch {}
}, 20);

// ─── DEATH EVENT ─────────────────────────────────────────────────────────────
world.afterEvents.entityDie.subscribe((e) => {
    if (e.deadEntity.typeId !== CONFIG.typeId) return;
    try {
        const loc = e.deadEntity.location;
        for (let i = 0; i < 250; i++) {
            system.runTimeout(() => {
                try {
                    e.deadEntity.dimension.spawnParticle("minecraft:dragon_death_explosion_emitter", {
                        x: loc.x + (Math.random() - 0.5) * 10,
                        y: loc.y + Math.random() * 6,
                        z: loc.z + (Math.random() - 0.5) * 10
                    });
                } catch {}
            }, i * 10);
        }
        e.deadEntity.dimension.playSound("mob.wither.death", loc);
        world.sendMessage("§4§l☠ THE HARVESTER HAS BEEN DEFEATED! ☠");
        world.sendMessage("§6Congratulations to all who fought!");

        system.runTimeout(() => {
            try { e.deadEntity.dimension.spawnEntity("minecraft:chest", loc); } catch {}
        }, 60);

        bossStates.delete(e.deadEntity.id);
        bossArena.delete(e.deadEntity.id);
    } catch {}
});

// ─── HIT COUNTER-TELEPORT ─────────────────────────────────────────────────────
world.afterEvents.entityHurt.subscribe((e) => {
    if (e.hurtEntity.typeId !== CONFIG.typeId) return;
    try {
        const vel = e.hurtEntity.getVelocity();
        if (Math.abs(vel.x) < 0.1 && Math.abs(vel.z) < 0.1 && Math.random() < 0.08) {
            const players = e.hurtEntity.dimension.getEntities({
                location: e.hurtEntity.location, maxDistance: 20, type: "minecraft:player"
            });
            if (players.length > 0) {
                const target = players[Math.floor(Math.random() * players.length)];
                e.hurtEntity.teleport(target.location);
                e.hurtEntity.dimension.spawnParticle("minecraft:end_rod", e.hurtEntity.location);
            }
        }
    } catch {}
});

world.afterEvents.worldInitialize.subscribe(() => {
    console.warn("§c[Harvester Boss v2] §fLoaded!");
    console.warn("§713 skills | 3 phases | Enrage timer | NEW: Judgment + Vortex + Curse");
});
