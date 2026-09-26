// ============================================================================
//  THE HARVESTER — Reaper x Plague Doctor boss
// ----------------------------------------------------------------------------
//  Phase 1 (100% → 60%)  "Doctor of the Dead"
//     Reaping Arc, Plague Flask, Murder of Crows, Death's Step
//  Phase 2 (60% → 30%)   "Epidemic"      + Pestilence Nova, Graves of the Plagued,
//                                          Soul Harvest, Plague Aura (passive)
//  Phase 3 (below 30%)   "Final Harvest" + Death Sentence, The Black Death,
//                                          Final Harvest (ultimate)
//  Plague stacks: most skills infect. At 5 stacks the victim bursts (Black Death pop).
//  Stacks fade over time; drinking milk cleanses them.
//
//  Every timing below is in game ticks (20 ticks = 1 second) and matches the
//  keyframes in TheHarvesterRP/animations/pa_harvester.animation.json.
// ============================================================================
import { world, system, MolangVariableMap } from "@minecraft/server";

const BOSS_ID = "pa:harvester";
const THRALL_TAG = "harvester_thrall";
const DIMENSIONS = ["overworld", "nether", "the_end"];

const CONFIG = {
    aggroRange: 32,
    arenaRadius: 50,
    enrageTicks: 5 * 60 * 20,
    phase2: 0.6,
    phase3: 0.3,
    // pause between two skills (ticks), per phase; enraged uses the last value
    castGap: [50, 38, 28, 18],
    cooldownScale: [1, 0.85, 0.7, 0.5],
    damageScale: [1, 1.1, 1.2, 1.35],
    maxThralls: 8,
    plague: { max: 5, fadeAfter: 120, fadeEvery: 60, popDamage: 6 },
    skills: {
        reap:       { phase: 1, cd: 140, weight: 4, min: 0, max: 7,  lock: 27 },
        flask:      { phase: 1, cd: 200, weight: 3, min: 4, max: 22, lock: 22 },
        crows:      { phase: 1, cd: 280, weight: 2, min: 3, max: 24, lock: 29 },
        step:       { phase: 1, cd: 240, weight: 2, min: 6, max: 24, lock: 30 },
        nova:       { phase: 2, cd: 320, weight: 3, min: 0, max: 11, lock: 36 },
        graves:     { phase: 2, cd: 440, weight: 2, min: 0, max: 30, lock: 36 },
        drain:      { phase: 2, cd: 400, weight: 2, min: 0, max: 12, lock: 60 },
        sentence:   { phase: 3, cd: 520, weight: 2, min: 0, max: 24, lock: 30 },
        blackdeath: { phase: 3, cd: 640, weight: 2, min: 0, max: 18, lock: 86 },
        ultimate:   { phase: 3, cd: 800, weight: 3, min: 0, max: 14, lock: 68 }
    }
};

// particle ids (TheHarvesterRP/particles/harvester_*.json)
const P = {
    wisp: "harvester:soul_wisp",
    souls: "harvester:soul_burst",
    stream: "harvester:soul_stream",
    pillar: "harvester:soul_pillar",
    ember: "harvester:ember",
    trail: "harvester:scythe_trail",
    trailBig: "harvester:scythe_trail_big",
    spectral: "harvester:spectral_scythe",
    miasma: "harvester:miasma",
    miasmaField: "harvester:miasma_field",
    deathField: "harvester:blackdeath_field",
    smoke: "harvester:black_smoke",
    auraMist: "harvester:aura_mist",
    rain: "harvester:black_rain",
    flask: "harvester:flask",
    drip: "harvester:plague_drip",
    shards: "harvester:glass_shards",
    splash: "harvester:plague_splash",
    warn: "harvester:ground_warn",
    ringWarn: "harvester:ring_warn",
    runes: "harvester:rune_circle",
    shockwave: "harvester:shockwave",
    skull: "harvester:skull_sigil",
    pips: "harvester:plague_pips",
    hourglass: "harvester:hourglass",
    beak: "harvester:beak_sigil",
    grave: "harvester:grave_rise",
    dirt: "harvester:dirt_burst",
    lantern: "harvester:lantern",
    crow: "harvester:crow",
    crowFlock: "harvester:crow_flock",
    feathers: "harvester:feathers",
    chain: "harvester:chain_link"
};

// telegraph colours (r, g, b in 0..1)
const TEAL = [0.35, 1, 0.8];
const PLAGUE = [0.62, 0.85, 0.22];
const BLOOD = [1, 0.18, 0.2];

const bosses = new Map();   // boss id -> state
const plague = new Map();   // player id -> { stacks, lastGain }
const fighters = new Map(); // player id -> last tick seen near a Harvester
const skillHitTick = new Map(); // player id -> tick a skill last damaged them

// ─── small helpers ──────────────────────────────────────────────────────────

const now = () => system.currentTick;
const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const up = (a, h) => ({ x: a.x, y: a.y + h, z: a.z });
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function flatDir(from, to) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    return len < 1e-4 ? { x: 0, y: 0, z: 1 } : { x: dx / len, y: 0, z: dz / len };
}

const rightOf = (d) => ({ x: -d.z, y: 0, z: d.x });

function rotateY(d, degrees) {
    const a = (degrees * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return { x: d.x * c - d.z * s, y: 0, z: d.x * s + d.z * c };
}

function alive(entity) {
    try { return entity.isValid(); } catch { return false; }
}

function later(ticks, fn) {
    system.runTimeout(() => { try { fn(); } catch {} }, Math.max(1, Math.round(ticks)));
}

function fx(dim, id, loc, vars) {
    try {
        if (!vars) return dim.spawnParticle(id, loc);
        const map = new MolangVariableMap();
        for (const key in vars) map.setFloat("variable." + key, vars[key]);
        dim.spawnParticle(id, loc, map);
    } catch {}
}

const color = (c, extra = {}) => ({ cr: c[0], cg: c[1], cb: c[2], ...extra });

function sound(dim, id, loc, pitch = 1, volume = 1) {
    try { dim.playSound(id, loc, { pitch, volume }); } catch {}
}

function title(p, text, subtitle = "", stay = 40) {
    try { p.onScreenDisplay.setTitle(text, { subtitle, fadeInDuration: 5, stayDuration: stay, fadeOutDuration: 10 }); } catch {}
}

function health(entity) {
    try { return entity.getComponent("minecraft:health"); } catch { return undefined; }
}

function heal(entity, amount) {
    const hp = health(entity);
    if (hp) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + amount));
}

function effect(entity, id, ticks, amplifier = 0) {
    try { entity.addEffect(id, ticks, { amplifier, showParticles: true }); } catch {}
}

// Players the boss fights. Creative players count too (they take no damage, but the boss still
// casts at them, which is how most people test it); spectators are ignored.
// The game mode is compared as text because its enum spelling differs between API versions.
function players(dim, center, radius) {
    let list = [];
    try { list = dim.getEntities({ location: center, maxDistance: radius, type: "minecraft:player" }); } catch { return []; }
    return list.filter((p) => {
        try {
            if (String(p.getGameMode()).toLowerCase() === "spectator") return false;
        } catch {}
        return (health(p)?.currentValue ?? 0) > 0;
    });
}

function tell(boss, radius, message) {
    for (const p of players(boss.dimension, boss.location, radius)) {
        try { p.sendMessage(message); } catch {}
    }
}

function state(boss) { return bosses.get(boss.id); }

function on(signal, callback) {
    try { signal?.subscribe(callback); } catch {}
}

function tier(s) { return s.enraged ? 3 : s.phase - 1; }

function hurt(boss, p, amount, cause = "entityAttack") {
    const s = state(boss);
    const scaled = amount * (s ? CONFIG.damageScale[tier(s)] : 1);
    skillHitTick.set(p.id, now());
    try { p.applyDamage(scaled, { cause, damagingEntity: boss }); } catch {
        try { p.applyDamage(scaled); } catch {}
    }
}

function knockFrom(center, p, horizontal, vertical) {
    const d = flatDir(center, p.location);
    try { p.applyKnockback(d.x, d.z, horizontal, vertical); } catch {}
}

function play(boss, name, blend = 0.2) {
    try { boss.playAnimation("animation.pa_harvester." + name, { blendOutTime: blend, controller: "harvester.skill" }); } catch {}
}

function face(boss, target) {
    try { boss.teleport(boss.location, { facingLocation: target.location, keepVelocity: false }); } catch {}
}

function root(boss, ticks) {
    try { boss.addEffect("slowness", ticks, { amplifier: 12, showParticles: false }); } catch {}
}

// Tile a cone on the ground (0.8-block tiles, like the telegraphs players already know)
function telegraphCone(dim, origin, dir, radius, halfAngle, ticks, c) {
    const vars = color(c, { life: ticks / 20 });
    const ground = up(origin, 0.06);
    for (let r = 0.9; r <= radius; r += 0.8) {
        const arc = (2 * halfAngle * Math.PI / 180) * r;
        const n = Math.max(1, Math.round(arc / 0.8));
        for (let i = 0; i < n; i++) {
            const a = -halfAngle + (2 * halfAngle) * ((i + 0.5) / n);
            fx(dim, P.warn, add(ground, rotateY(dir, a), r), vars);
        }
    }
}

function inCone(origin, dir, p, radius, halfAngle, height = 3.5) {
    const d = flatDist(origin, p.location);
    if (d > radius || Math.abs(p.location.y - origin.y) > height) return false;
    if (d < 1.2) return true;
    const to = flatDir(origin, p.location);
    return to.x * dir.x + to.z * dir.z >= Math.cos(halfAngle * Math.PI / 180);
}

// ─── plague stacks ──────────────────────────────────────────────────────────

function addPlague(boss, p, amount = 1) {
    const entry = plague.get(p.id) ?? { stacks: 0, lastGain: 0 };
    entry.stacks += amount;
    entry.lastGain = now();
    plague.set(p.id, entry);
    if (entry.stacks >= CONFIG.plague.max) {
        entry.stacks = 0;
        plagueBurst(boss, p);
    }
}

function plagueBurst(boss, p) {
    const dim = p.dimension;
    const at = up(p.location, 1);
    fx(dim, P.miasma, at);
    fx(dim, P.miasma, up(at, 0.6));
    fx(dim, P.beak, up(p.location, 2.4));
    fx(dim, P.splash, up(p.location, 0.08));
    sound(dim, "mob.zombie.unfect", at, 0.6);
    hurt(boss, p, CONFIG.plague.popDamage, "magic");
    effect(p, "wither", 60, 0);
    effect(p, "nausea", 80, 0);
    title(p, "§2§l☣ BLACK DEATH ☣", "§7The plague bursts inside you!", 30);
}

function stacksOf(p) { return plague.get(p.id)?.stacks ?? 0; }

// ─── skills: phase 1 ────────────────────────────────────────────────────────

// Reaping Arc: cone telegraph, then a low scythe sweep from right to left. Hit at tick 13.
function castReap(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_reap");
    const origin = { ...boss.location };
    const dir = flatDir(origin, target.location);
    const radius = s.phase >= 3 ? 7.5 : 6.5;
    telegraphCone(dim, origin, dir, radius, 62, 13, TEAL);
    sound(dim, "mob.evocation_illager.prepare_attack", origin, 0.6);

    later(13, () => {
        if (!alive(boss)) return;
        sound(dim, "mob.wither.shoot", origin, 0.7);
        for (let k = 0; k < 5; k++) {
            later(1 + k, () => {
                // from his right (+angle) across to his left (-angle), like the animation
                for (const a of [62 - k * 31, 62 - k * 31 - 15]) {
                    fx(dim, P.trailBig, add(up(origin, 1.1), rotateY(dir, a), radius * 0.55), { spin: k * 30 - 60 });
                }
            });
        }
        for (const p of players(dim, origin, radius + 1)) {
            if (!inCone(origin, dir, p, radius, 64)) continue;
            hurt(boss, p, 10);
            knockFrom(origin, p, 1.4, 0.35);
            addPlague(boss, p, 1);
            fx(dim, P.ember, up(p.location, 1));
        }
    });
}

// Plague Flask: lobbed flasks (1/2/3 by phase) that shatter into a plague pool. Release at tick 9.
function castFlask(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_flask");
    sound(dim, "mob.witch.throw", boss.location, 0.7);
    later(9, () => {
        if (!alive(boss)) return;
        const count = s.phase;
        const base = boss.location;
        const dir = flatDir(base, target.location);
        const start = add(up(base, 3.2), rightOf(dir), -0.9);
        for (let i = 0; i < count; i++) {
            const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 3.2;
            let aim = target.location;
            try {
                const v = target.getVelocity();
                aim = { x: aim.x + v.x * 8, y: aim.y, z: aim.z + v.z * 8 };
            } catch {}
            aim = add(aim, rightOf(dir), spread);
            throwFlask(boss, dim, start, aim);
        }
    });
}

function throwFlask(boss, dim, start, aim) {
    const g = 16;
    const dist = Math.hypot(aim.x - start.x, aim.z - start.z);
    const t = Math.min(1.3, Math.max(0.6, dist / 13));
    const v = {
        x: (aim.x - start.x) / t,
        y: (aim.y + 0.2 - start.y + 0.5 * g * t * t) / t,
        z: (aim.z - start.z) / t
    };
    const speed = Math.hypot(v.x, v.y, v.z);
    fx(dim, P.flask, start, { dir_x: v.x / speed, dir_y: v.y / speed, dir_z: v.z / speed, speed, life: t, grav: g });
    fx(dim, P.ringWarn, up(aim, 0.08), color(PLAGUE, { radius: 3, life: t + 0.2 }));
    const ticks = Math.round(t * 20);
    for (let k = 2; k < ticks; k += 3) {
        later(k, () => {
            const tau = k / 20;
            fx(dim, P.drip, { x: start.x + v.x * tau, y: start.y + v.y * tau - 0.5 * g * tau * tau, z: start.z + v.z * tau });
        });
    }
    later(ticks, () => {
        const at = up(aim, 0.1);
        fx(dim, P.shards, up(at, 0.3));
        fx(dim, P.splash, at);
        fx(dim, P.miasma, up(at, 0.5));
        fx(dim, P.miasmaField, at, { radius: 3, duration: 6 });
        sound(dim, "random.glass", at, 0.8);
        for (const p of players(dim, at, 3.2)) {
            hurt(boss, p, 4, "magic");
            addPlague(boss, p, 1);
        }
        const s = state(boss);
        if (s) s.pools.push({ dim, at, radius: 3, until: now() + 120, lastTick: {} });
    });
}

// Murder of Crows: crows dive at where each player stood — keep moving to dodge. Release at tick 11.
function castCrows(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_crows");
    sound(dim, "mob.bat.takeoff", boss.location, 0.5);
    later(11, () => {
        if (!alive(boss)) return;
        const from = up(boss.location, 3.3);
        sound(dim, "mob.phantom.swoop", from, 0.8, 1.5);
        const victims = players(dim, boss.location, CONFIG.skills.crows.max).slice(0, 4);
        const perPlayer = s.phase >= 2 ? 3 : 2;
        for (const p of victims) {
            for (let i = 0; i < perPlayer; i++) {
                later(1 + i * 4, () => {
                    if (!alive(p)) return;
                    const aim = up(p.location, 1 + (Math.random() - 0.5) * 0.6);
                    const d = { x: aim.x - from.x, y: aim.y - from.y, z: aim.z - from.z };
                    const len = Math.hypot(d.x, d.y, d.z) || 1;
                    const life = Math.max(0.15, len / 16);
                    fx(dim, P.crow, from, { dir_x: d.x / len, dir_y: d.y / len, dir_z: d.z / len, speed: 16, life });
                    later(life * 20, () => {
                        for (const hit of players(dim, aim, 1.7)) {
                            hurt(boss, hit, 3);
                            effect(hit, "slowness", 30, 1);
                            if (i === 0) addPlague(boss, hit, 1);
                            fx(dim, P.feathers, up(hit.location, 1.2));
                        }
                    });
                });
            }
        }
    });
}

// Death's Step: skull under the target, vanish, reappear behind them and slash.
// Teleport at tick 10, slash at tick 17.
function castDeathStep(boss, s, target) {
    const dim = boss.dimension;
    play(boss, "skill_vanish", 0.05);
    fx(dim, P.smoke, up(boss.location, 1.5));
    fx(dim, P.skull, up(target.location, 0.07), { life: 0.9 });
    sound(dim, "mob.endermen.portal", boss.location, 0.6);
    later(10, () => {
        if (!alive(boss) || !alive(target)) return;
        let behind;
        try { behind = flatDir({ x: 0, y: 0, z: 0 }, target.getViewDirection()); } catch { behind = flatDir(boss.location, target.location); }
        const spots = [
            add(target.location, behind, -2.2),
            add(target.location, rightOf(behind), 2.2),
            add(target.location, rightOf(behind), -2.2)
        ];
        let moved = false;
        for (const spot of spots) {
            try {
                if (boss.tryTeleport(spot, { checkForBlocks: true, facingLocation: target.location })) { moved = true; break; }
            } catch {}
        }
        if (!moved) face(boss, target);
        play(boss, "skill_ambush", 0.2);
        fx(dim, P.smoke, up(boss.location, 1.2));
        sound(dim, "mob.endermen.portal", boss.location, 0.8);
        later(7, () => {
            if (!alive(boss)) return;
            const origin = { ...boss.location };
            const dir = flatDir(origin, target.location);
            fx(dim, P.trailBig, add(up(origin, 1.4), dir, 1.8), { spin: 120 });
            sound(dim, "mob.wither.shoot", origin, 1.2);
            for (const p of players(dim, origin, 4.2)) {
                if (!inCone(origin, dir, p, 4, 70)) continue;
                hurt(boss, p, 9);
                effect(p, "slowness", 40, 1);
                addPlague(boss, p, 1);
                fx(dim, P.ember, up(p.location, 1));
            }
        });
    });
}

// ─── skills: phase 2 ────────────────────────────────────────────────────────

// Pestilence Nova: three plague rings roll outward from the slam. Jump over them. Slam at tick 16.
function castNova(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_nova");
    const center = { ...boss.location };
    const radius = 12;
    fx(dim, P.runes, up(center, 0.05), color(PLAGUE, { radius: 4, life: 1.8 }));
    fx(dim, P.ringWarn, up(center, 0.06), color(PLAGUE, { radius, life: 0.8 }));
    sound(dim, "mob.evocation_illager.prepare_summon", center, 0.6);
    if (!s.novaHintShown) {
        s.novaHintShown = true;
        tell(boss, 40, "§2[Harvester] §aPestilence Nova — §fjump over the plague rings!");
    }
    for (const wave of [16, 26, 36]) {
        later(wave, () => {
            if (!alive(boss)) return;
            sound(dim, "random.explode", center, 0.5, 0.6);
            fx(dim, P.shockwave, up(center, 0.1), color(PLAGUE, { radius, life: 0.8 }));
            fx(dim, P.miasma, up(center, 0.4));
            const hit = new Set();
            for (let t = 1; t <= 16; t++) {
                later(t, () => {
                    const r = (radius * t) / 16;
                    if (t % 4 === 0) {
                        for (let i = 0; i < 6; i++) {
                            const a = (i / 6) * Math.PI * 2 + wave;
                            fx(dim, P.miasma, { x: center.x + Math.cos(a) * r, y: center.y + 0.3, z: center.z + Math.sin(a) * r });
                        }
                    }
                    for (const p of players(dim, center, r + 1)) {
                        if (hit.has(p.id)) continue;
                        const d = flatDist(center, p.location);
                        // jumping over the ring dodges it
                        const grounded = p.isOnGround && p.location.y - center.y < 1.5;
                        if (d >= r - 1.1 && d <= r + 0.6 && grounded) {
                            hit.add(p.id);
                            hurt(boss, p, 5, "magic");
                            knockFrom(center, p, 0.8, 0.25);
                            addPlague(boss, p, 1);
                        }
                    }
                });
            }
        });
    }
}

// Graves of the Plagued: tombstones rise, plague thralls climb out. Graves at tick 18, thralls 1.2 s later.
function castGraves(boss, s) {
    const dim = boss.dimension;
    play(boss, "skill_summon");
    sound(dim, "mob.evocation_illager.prepare_summon", boss.location, 0.5);
    later(18, () => {
        if (!alive(boss)) return;
        sound(dim, "mob.warden.emerge", boss.location, 1.2, 0.8);
        const alivePlayers = players(dim, boss.location, 30);
        const count = Math.min(s.phase >= 3 ? 4 : 3, CONFIG.maxThralls - countThralls(boss));
        const types = s.phase >= 3
            ? ["minecraft:husk", "minecraft:bogged", "minecraft:wither_skeleton", "minecraft:husk"]
            : ["minecraft:husk", "minecraft:husk", "minecraft:bogged"];
        for (let i = 0; i < count; i++) {
            const anchor = alivePlayers.length ? alivePlayers[i % alivePlayers.length].location : boss.location;
            const a = Math.random() * Math.PI * 2;
            const r = 3 + Math.random() * 2.5;
            const spot = { x: anchor.x + Math.cos(a) * r, y: anchor.y, z: anchor.z + Math.sin(a) * r };
            fx(dim, P.grave, up(spot, 0.35), { life: 3.2 });
            fx(dim, P.dirt, up(spot, 0.1));
            fx(dim, P.warn, up(spot, 0.06), color(PLAGUE, { life: 1.2 }));
            later(24, () => {
                fx(dim, P.dirt, up(spot, 0.1));
                fx(dim, P.miasma, up(spot, 0.6));
                sound(dim, "dig.gravel", spot, 0.7);
                try {
                    const thrall = dim.spawnEntity(types[i % types.length], spot);
                    thrall.addTag(THRALL_TAG);
                    thrall.nameTag = "§2Plague Thrall";
                    effect(thrall, "fire_resistance", 20000000, 0);
                    effect(thrall, "speed", 20000000, 0);
                    if (s.phase >= 3) effect(thrall, "strength", 20000000, 0);
                } catch {}
            });
        }
    });
}

function countThralls(boss) {
    try { return boss.dimension.getEntities({ location: boss.location, maxDistance: 64, tags: [THRALL_TAG] }).length; } catch { return 0; }
}

// Soul Harvest: chain tethers to every player within 12 blocks, draining life for 2.4 s.
// Get more than 16 blocks away to snap the chain.
function castDrain(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_drain");
    sound(dim, "mob.evocation_illager.cast_spell", boss.location, 0.5);
    const tethered = players(dim, boss.location, 12).slice(0, 5);
    const broken = new Set();
    for (let t = 6; t <= 54; t += 3) {
        later(t, () => {
            if (!alive(boss)) return;
            const chest = up(boss.location, 2.3);
            for (const p of tethered) {
                if (broken.has(p.id) || !alive(p)) continue;
                const from = up(p.location, 1.1);
                const len = Math.hypot(from.x - chest.x, from.y - chest.y, from.z - chest.z);
                if (len > 16) {
                    broken.add(p.id);
                    fx(dim, P.ember, from);
                    sound(dim, "random.break", from, 0.6);
                    try { p.sendMessage("§3[Harvester] §bYou broke free of the soul chain!"); } catch {}
                    continue;
                }
                const steps = Math.floor(len / 0.9);
                for (let i = 1; i < steps; i++) {
                    const k = i / steps;
                    fx(dim, P.chain, { x: from.x + (chest.x - from.x) * k, y: from.y + (chest.y - from.y) * k, z: from.z + (chest.z - from.z) * k });
                }
                if (t % 9 === 0) {
                    const dmg = 2 + 0.5 * stacksOf(p);
                    hurt(boss, p, dmg, "magic");
                    heal(boss, dmg);
                    const life = 0.4;
                    fx(dim, P.stream, from, {
                        dir_x: (chest.x - from.x) / len, dir_y: (chest.y - from.y) / len, dir_z: (chest.z - from.z) / len,
                        speed: len / life, life
                    });
                }
            }
        });
    }
}

// Plague Aura (phase 2+ passive): standing next to the doctor infects you every 3 s.
function plagueAura(boss, s, t) {
    const dim = boss.dimension;
    if (t % 8 === 0) fx(dim, P.auraMist, boss.location);
    if (t % 20 !== 0) return;
    for (const p of players(dim, boss.location, 3.5)) {
        const last = s.auraHits[p.id] ?? 0;
        if (t - last < 60) continue;
        s.auraHits[p.id] = t;
        addPlague(boss, p, 1);
        fx(dim, P.miasma, up(p.location, 1));
    }
}

// ─── skills: phase 3 ────────────────────────────────────────────────────────

// Death Sentence: an hourglass over each head; when it runs out a spectral scythe falls.
// Damage grows with the victim's plague stacks (which it consumes). Marks at tick 8, execution 4 s later.
function castSentence(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_sentence");
    sound(dim, "block.bell.hit", boss.location, 0.5, 1.2);
    later(8, () => {
        if (!alive(boss)) return;
        const condemned = players(dim, boss.location, CONFIG.skills.sentence.max).slice(0, 4);
        const duration = 80;
        for (const p of condemned) {
            title(p, "§4§l⌛ SENTENCED ⌛", "§7Cleanse your plague (milk) to soften the blow", 50);
            for (let t = 0; t < duration; t += 2) {
                later(t + 1, () => {
                    if (!alive(p)) return;
                    fx(dim, P.hourglass, up(p.getHeadLocation(), 0.85), { frame: Math.floor((t / duration) * 8) });
                    if (t % 20 === 0) sound(dim, "random.click", p.location, 0.5, 0.6);
                });
            }
            later(duration, () => {
                if (!alive(p) || !alive(boss)) return;
                const stacks = stacksOf(p);
                plague.delete(p.id);
                fx(dim, P.spectral, up(p.location, 1.4));
                fx(dim, P.souls, up(p.location, 1));
                sound(dim, "mob.wither.shoot", p.location, 0.5);
                hurt(boss, p, 6 + 3 * stacks, "magic");
                effect(p, "wither", 40, 1);
                if (stacks > 0) title(p, "§4☠", `§7The sentence consumed §2${stacks}§7 plague stacks`, 30);
            });
        }
    });
}

// The Black Death: a killing miasma floods the arena. Only the soul lanterns' light is safe. Hit at tick 72.
function castBlackDeath(boss, s) {
    const dim = boss.dimension;
    play(boss, "skill_blackdeath");
    const center = { ...boss.location };
    const radius = 16;
    const victims = players(dim, center, CONFIG.skills.blackdeath.max + 4);
    for (const p of victims) title(p, "§0§l☣ §2THE BLACK DEATH §0☣", "§bHide in a soul lantern's light!", 60);
    sound(dim, "mob.wither.spawn", center, 0.5, 0.8);
    fx(dim, P.deathField, up(center, 0.1), { radius, duration: 4.3 });
    fx(dim, P.rain, center, { radius, duration: 3.6 });

    const zones = [];
    const count = Math.max(2, Math.min(5, victims.length + 1));
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.8;
        const r = 5 + Math.random() * 5;
        const spot = { x: center.x + Math.cos(a) * r, y: center.y, z: center.z + Math.sin(a) * r };
        zones.push(spot);
        fx(dim, P.ringWarn, up(spot, 0.07), color(TEAL, { radius: 2.5, life: 3.6 }));
        fx(dim, P.lantern, up(spot, 1.3), { life: 3.6 });
    }
    for (let t = 10; t < 72; t += 10) {
        later(t, () => {
            for (const z of zones) fx(dim, P.wisp, up(z, 0.4));
        });
    }
    later(72, () => {
        if (!alive(boss)) return;
        sound(dim, "mob.warden.sonic_boom", center, 0.7);
        fx(dim, P.shockwave, up(center, 0.12), color(PLAGUE, { radius, life: 0.6 }));
        for (const p of players(dim, center, radius + 2)) {
            const safe = zones.some((z) => flatDist(z, p.location) <= 2.6);
            if (safe) {
                fx(dim, P.wisp, up(p.location, 1));
                continue;
            }
            hurt(boss, p, 14, "magic");
            effect(p, "wither", 60, 1);
            addPlague(boss, p, 2);
            fx(dim, P.miasma, up(p.location, 1));
        }
    });
}

// Final Harvest: circles the scythe overhead, then a full spin. Safe right next to him or far away.
// Hit at tick 49.
function castUltimate(boss, s) {
    const dim = boss.dimension;
    play(boss, "skill_ultimate");
    const center = { ...boss.location };
    const inner = 3, outer = 11.5;
    for (const p of players(dim, center, 40)) title(p, "§4§l☠ FINAL HARVEST ☠", "§7Get close... or get far away", 50);
    tell(boss, 40, "§4§l[HARVESTER] §r§cYour souls are ripe for the harvest.");
    sound(dim, "mob.wither.ambient", center, 0.5);
    fx(dim, P.runes, up(center, 0.05), color(BLOOD, { radius: outer, life: 2.5 }));
    fx(dim, P.ringWarn, up(center, 0.07), color(TEAL, { radius: inner, life: 2.5 }));
    fx(dim, P.ringWarn, up(center, 0.08), color(BLOOD, { radius: outer, life: 2.5 }));
    for (const t of [10, 20, 30, 40]) later(t, () => sound(dim, "block.bell.hit", center, 0.4 + t / 100));

    later(45, () => {
        for (let k = 0; k < 16; k++) {
            later(1 + (k >> 2), () => {
                const a = (k / 16) * 360;
                fx(dim, P.trailBig, add(up(center, 1.2), rotateY({ x: 0, y: 0, z: 1 }, a), 6.5), { spin: a });
            });
        }
    });
    later(49, () => {
        if (!alive(boss)) return;
        sound(dim, "mob.wither.death", center, 1.4, 0.8);
        fx(dim, P.shockwave, up(center, 0.1), color(TEAL, { radius: outer + 1, life: 0.5 }));
        fx(dim, P.souls, up(center, 2));
        let victims = 0;
        for (const p of players(dim, center, outer + 1)) {
            const d = flatDist(center, p.location);
            if (d <= inner || d > outer || Math.abs(p.location.y - center.y) > 4) continue;
            victims++;
            hurt(boss, p, 18);
            effect(p, "wither", 60, 1);
            addPlague(boss, p, 1);
            const from = up(p.location, 1);
            const to = up(center, 2.3);
            const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
            fx(dim, P.stream, from, { dir_x: (to.x - from.x) / len, dir_y: (to.y - from.y) / len, dir_z: (to.z - from.z) / len, speed: len / 0.5, life: 0.5 });
        }
        if (victims > 0) heal(boss, victims * 6);
    });
}

const CASTS = {
    reap: castReap, flask: castFlask, crows: castCrows, step: castDeathStep,
    nova: castNova, graves: castGraves, drain: castDrain,
    sentence: castSentence, blackdeath: castBlackDeath, ultimate: castUltimate
};

// ─── phases, enrage, name ───────────────────────────────────────────────────

const PHASE_NAMES = [
    "§8§lThe Harvester§r §7— §2Doctor of the Dead",
    "§8§lThe Harvester§r §7— §aEpidemic",
    "§4§lThe Harvester§r §7— §cFinal Harvest"
];

function setName(boss, s) {
    try { boss.nameTag = s.enraged ? "§4§lThe Harvester§r §7— §4§lENRAGED" : PHASE_NAMES[s.phase - 1]; } catch {}
}

function enterPhase(boss, s, phase) {
    s.phase = phase;
    const t = now();
    s.busyUntil = t + 44;
    s.nextCast = t + 60;
    const dim = boss.dimension;
    root(boss, 44);
    effect(boss, "resistance", 44, 4);
    play(boss, "phase_roar", 0.25);
    setName(boss, s);
    const center = { ...boss.location };
    fx(dim, P.runes, up(center, 0.05), color(phase === 3 ? BLOOD : PLAGUE, { radius: 6, life: 2.2 }));
    later(20, () => {
        fx(dim, P.shockwave, up(center, 0.1), color(phase === 3 ? TEAL : PLAGUE, { radius: 10, life: 0.7 }));
        fx(dim, phase === 3 ? P.souls : P.miasma, up(center, 2));
        fx(dim, P.beak, up(center, 4.2));
        sound(dim, "mob.wither.spawn", center, phase === 3 ? 0.6 : 0.8);
        for (const p of players(dim, center, 6)) knockFrom(center, p, 2.2, 0.5);
    });
    const subtitle = phase === 3 ? "§7Death itself takes the field." : "§7The plague spreads...";
    for (const p of players(dim, center, 40)) title(p, phase === 3 ? "§4§l☠ PHASE 3 ☠" : "§2§l☣ PHASE 2 ☣", subtitle, 50);
    tell(boss, 40, phase === 3
        ? "§4§l[HARVESTER] §r§cThe doctor is done treating you. Now I reap."
        : "§2§l[HARVESTER] §r§aHold still. This will only hurt... forever.");
    if (phase === 2) {
        effect(boss, "speed", 20000000, 0);
    } else {
        effect(boss, "speed", 20000000, 1);
        effect(boss, "strength", 20000000, 0);
        effect(boss, "fire_resistance", 20000000, 0);
    }
}

function checkPhase(boss, s) {
    const hp = health(boss);
    if (!hp) return;
    const ratio = hp.currentValue / hp.effectiveMax;
    if (s.phase < 3 && ratio <= CONFIG.phase3) enterPhase(boss, s, 3);
    else if (s.phase < 2 && ratio <= CONFIG.phase2) enterPhase(boss, s, 2);
}

function checkEnrage(boss, s) {
    if (s.enraged || s.startTick === undefined || now() - s.startTick < CONFIG.enrageTicks) return;
    s.enraged = true;
    setName(boss, s);
    effect(boss, "strength", 20000000, 1);
    effect(boss, "speed", 20000000, 1);
    effect(boss, "resistance", 20000000, 1);
    sound(boss.dimension, "mob.wither.spawn", boss.location, 0.5);
    fx(boss.dimension, P.runes, up(boss.location, 0.05), color(BLOOD, { radius: 8, life: 2 }));
    for (const p of players(boss.dimension, boss.location, 50)) title(p, "§4§l☠ ENRAGED ☠", "§cThe harvest will not wait any longer.", 60);
}

function resetFight(boss, s) {
    s.startTick = undefined;
    if (!s.enraged) return;
    s.enraged = false;
    for (const id of ["strength", "speed", "resistance"]) {
        try { boss.removeEffect(id); } catch {}
    }
    if (s.phase >= 2) effect(boss, "speed", 20000000, s.phase >= 3 ? 1 : 0);
    if (s.phase >= 3) effect(boss, "strength", 20000000, 0);
    setName(boss, s);
}

// ─── AI loop ────────────────────────────────────────────────────────────────

function initState(boss) {
    let s = bosses.get(boss.id);
    if (s) return s;
    const t = now();
    s = {
        // startTick: when players first engaged (enrage timer); undefined while nobody fights
        phase: 1, enraged: false, startTick: undefined, lastEngaged: 0, arena: { ...boss.location },
        cds: {}, busyUntil: 0, nextCast: t + 40, lastSkill: "", pools: [], auraHits: {},
        novaHintShown: false, lastBlink: 0, lastMelee: 0
    };
    bosses.set(boss.id, s);
    const hp = health(boss);
    if (hp) {
        const ratio = hp.currentValue / hp.effectiveMax;
        if (ratio <= CONFIG.phase3) s.phase = 3;
        else if (ratio <= CONFIG.phase2) s.phase = 2;
    }
    setName(boss, s);
    return s;
}

function chooseSkill(boss, s, nearby) {
    const t = now();
    const options = [];
    for (const [name, cfg] of Object.entries(CONFIG.skills)) {
        if (s.phase < cfg.phase || (s.cds[name] ?? 0) > t) continue;
        const inRange = nearby.filter((p) => {
            const d = flatDist(boss.location, p.location);
            return d >= cfg.min && d <= cfg.max;
        });
        if (inRange.length === 0) continue;
        if (name === "graves" && countThralls(boss) >= CONFIG.maxThralls) continue;
        let weight = cfg.weight;
        if (name === s.lastSkill) weight *= 0.25;
        if (cfg.phase === s.phase && s.phase > 1) weight *= 1.5; // favour the new phase's skills
        options.push({ name, weight, target: inRange[Math.floor(Math.random() * inRange.length)] });
    }
    if (options.length === 0) return undefined;
    let roll = Math.random() * options.reduce((sum, o) => sum + o.weight, 0);
    for (const o of options) {
        roll -= o.weight;
        if (roll <= 0) return o;
    }
    return options[options.length - 1];
}

function tickPools(boss, s, t) {
    if (s.pools.length === 0) return;
    s.pools = s.pools.filter((pool) => pool.until > t);
    if (t % 10 !== 0) return;
    for (const pool of s.pools) {
        for (const p of players(pool.dim, pool.at, pool.radius)) {
            if (t - (pool.lastTick[p.id] ?? 0) < 20) continue;
            pool.lastTick[p.id] = t;
            hurt(boss, p, 1.5, "magic");
            addPlague(boss, p, 1);
        }
    }
}

function hud(boss, s, nearby, t) {
    const hp = health(boss);
    if (!hp) return;
    const pct = Math.max(0, (hp.currentValue / hp.effectiveMax) * 100).toFixed(1);
    const phaseColor = ["§2", "§a", "§c"][s.phase - 1];
    const left = CONFIG.enrageTicks - (t - (s.startTick ?? t));
    const timer = s.enraged ? " §4§lENRAGED" : ` §7⌛ §f${Math.floor(Math.max(0, left) / 1200)}:${String(Math.floor((Math.max(0, left) % 1200) / 20)).padStart(2, "0")}`;
    for (const p of nearby) {
        fighters.set(p.id, t);
        const stacks = stacksOf(p);
        const pl = stacks > 0 ? ` §f| §2☣ ${"■".repeat(stacks)}§8${"■".repeat(CONFIG.plague.max - stacks)}` : "";
        try { p.onScreenDisplay.setActionBar(`§8☠ §lHARVESTER §r${phaseColor}P${s.phase} §f| §a${pct}%${pl} §f|${timer}`); } catch {}
    }
}

function bossTick(boss) {
    const s = initState(boss);
    const t = now();
    const dim = boss.dimension;
    const nearby = players(dim, boss.location, CONFIG.aggroRange);

    tickPools(boss, s, t);
    if (nearby.length === 0) {
        // nobody fought for 30 s: the enrage timer resets
        if (s.startTick !== undefined && t - s.lastEngaged > 600) resetFight(boss, s);
        return;
    }
    if (s.startTick === undefined) s.startTick = t;
    s.lastEngaged = t;

    checkPhase(boss, s);
    checkEnrage(boss, s);
    if (s.phase >= 2) plagueAura(boss, s, t);
    if (t % 10 === 0) hud(boss, s, players(dim, boss.location, 40), t);

    // ambient: souls rise from the robe, stronger each phase
    if (t % (12 - s.phase * 3) === 0) {
        fx(dim, P.wisp, { x: boss.location.x + (Math.random() - 0.5) * 1.6, y: boss.location.y + 0.4, z: boss.location.z + (Math.random() - 0.5) * 1.6 });
    }

    // leash to the arena
    if (t % 20 === 0 && flatDist(boss.location, s.arena) > CONFIG.arenaRadius) {
        fx(dim, P.smoke, up(boss.location, 1.5));
        try { boss.teleport(s.arena); } catch {}
        heal(boss, 20);
        fx(dim, P.smoke, up(s.arena, 1.5));
    }

    if (t < s.busyUntil || t < s.nextCast) return;
    const pick = chooseSkill(boss, s, nearby);
    if (!pick) return;
    const cfg = CONFIG.skills[pick.name];
    const tr = tier(s);
    s.cds[pick.name] = t + Math.round(cfg.cd * CONFIG.cooldownScale[tr]);
    s.busyUntil = t + cfg.lock;
    s.nextCast = t + cfg.lock + CONFIG.castGap[tr];
    s.lastSkill = pick.name;
    root(boss, cfg.lock);
    try { CASTS[pick.name](boss, s, pick.target); } catch {}
}

system.runInterval(() => {
    for (const id of DIMENSIONS) {
        let list = [];
        try { list = world.getDimension(id).getEntities({ type: BOSS_ID }); } catch {}
        for (const boss of list) {
            try { bossTick(boss); } catch {}
        }
    }
    const t = now();
    // plague markers above heads, and stacks fading with time
    if (t % 5 === 0) {
        for (const [pid, entry] of plague) {
            const p = world.getEntity(pid);
            if (!p || !alive(p)) { plague.delete(pid); continue; }
            if (t - entry.lastGain > CONFIG.plague.fadeAfter) {
                entry.stacks -= 1;
                entry.lastGain = t - CONFIG.plague.fadeAfter + CONFIG.plague.fadeEvery;
            }
            if (entry.stacks <= 0) { plague.delete(pid); continue; }
            fx(p.dimension, P.pips, up(p.getHeadLocation(), 0.75), { stacks: entry.stacks });
            if (t % 20 === 0) fx(p.dimension, P.drip, up(p.location, 1.2));
        }
    }
}, 1);

// ─── events ─────────────────────────────────────────────────────────────────

// Rise from the grave on a real spawn (not when the chunk loads)
on(world.afterEvents.entitySpawn, (e) => {
    try {
        if (e.entity.typeId !== BOSS_ID || e.cause === "Loaded") return;
        const boss = e.entity;
        const dim = boss.dimension;
        const at = { ...boss.location };
        later(2, () => {
            if (!alive(boss)) return;
            play(boss, "spawn", 0.3);
            root(boss, 52);
            const s = initState(boss);
            s.busyUntil = now() + 52;
            s.nextCast = now() + 70;
        });
        fx(dim, P.runes, up(at, 0.05), color(TEAL, { radius: 4, life: 2.6 }));
        fx(dim, P.miasmaField, up(at, 0.1), { radius: 2.5, duration: 2.5 });
        fx(dim, P.dirt, up(at, 0.1));
        later(12, () => fx(dim, P.dirt, up(at, 0.1)));
        later(38, () => { fx(dim, P.souls, up(at, 2)); fx(dim, P.beak, up(at, 4)); });
        sound(dim, "mob.warden.emerge", at, 0.7);
        for (const p of players(dim, at, 48)) title(p, "§8§l☠ THE HARVESTER ☠", "§2The plague doctor has come to collect.", 60);
    } catch {}
});

// Melee hits spread the plague (phase 2+) + counter blink when struck
on(world.afterEvents.entityHurt, (e) => {
    try {
        const victim = e.hurtEntity;
        const source = e.damageSource;
        // the boss landed a melee hit on a player
        if (source?.damagingEntity?.typeId === BOSS_ID && victim.typeId === "minecraft:player" && source.cause === "entityAttack") {
            const boss = source.damagingEntity;
            const s = bosses.get(boss.id);
            const t = now();
            // (the swing animation itself is played by the resource pack from variable.attack_time)
            if (s && skillHitTick.get(victim.id) !== t && t - s.lastMelee > 12) {
                s.lastMelee = t;
                if (s.phase >= 2) addPlague(boss, victim, 1);
            }
            return;
        }
        if (victim.typeId !== BOSS_ID) return;
        const boss = victim;
        const s = bosses.get(boss.id);
        const attacker = source?.damagingEntity;
        if (!s || !attacker || attacker.typeId !== "minecraft:player") return;
        const t = now();
        // Shadow Blink: 7% on hit, at most every 8 s, never mid-cast
        if (t < s.busyUntil || t - s.lastBlink < 160 || Math.random() > 0.07) return;
        s.lastBlink = t;
        const dim = boss.dimension;
        fx(dim, P.smoke, up(boss.location, 1.5));
        let behind;
        try { behind = flatDir({ x: 0, y: 0, z: 0 }, attacker.getViewDirection()); } catch { behind = flatDir(boss.location, attacker.location); }
        try { boss.tryTeleport(add(attacker.location, behind, -2.5), { checkForBlocks: true, facingLocation: attacker.location }); } catch {}
        fx(dim, P.smoke, up(boss.location, 1.5));
        sound(dim, "mob.endermen.portal", boss.location, 0.7);
    } catch {}
});

// Soul Toll: a player dying near the Harvester heals it
on(world.afterEvents.entityDie, (e) => {
    const dead = e.deadEntity;
    try {
        if (dead.typeId === "minecraft:player") {
            plague.delete(dead.id);
            const dim = dead.dimension;
            const loc = { ...dead.location };
            for (const boss of dim.getEntities({ type: BOSS_ID, location: loc, maxDistance: 30 })) {
                const hp = health(boss);
                if (hp) heal(boss, hp.effectiveMax * 0.03);
                fx(dim, P.souls, up(loc, 1));
                tell(boss, 40, "§8[Harvester] §7Another soul for the harvest...");
            }
            return;
        }
        if (dead.typeId !== BOSS_ID) return;
        const dim = dead.dimension;
        const loc = { ...dead.location };
        bosses.delete(dead.id);
        fx(dim, P.pillar, loc, { duration: 3 });
        fx(dim, P.souls, up(loc, 1.5));
        fx(dim, P.beak, up(loc, 3.5));
        fx(dim, P.shockwave, up(loc, 0.1), color(TEAL, { radius: 8, life: 0.8 }));
        later(20, () => fx(dim, P.souls, up(loc, 2.5)));
        later(40, () => fx(dim, P.souls, up(loc, 3.5)));
        sound(dim, "mob.wither.death", loc, 0.8);
        for (const p of players(dim, loc, 60)) {
            plague.delete(p.id);
            title(p, "§6§l☠ THE HARVESTER FALLS ☠", "§7The plague lifts. The souls are free.", 70);
            try { p.sendMessage("§6§l[Harvester] §r§eDefeated! The plague is cured and your stacks are gone."); } catch {}
        }
        // thralls crumble with their master
        try {
            for (const thrall of dim.getEntities({ location: loc, maxDistance: 80, tags: [THRALL_TAG] })) {
                fx(dim, P.smoke, up(thrall.location, 1));
                thrall.kill();
            }
        } catch {}
    } catch {}
});

// Milk cures the plague
on(world.afterEvents.itemCompleteUse, (e) => {
    try {
        if (e.itemStack?.typeId !== "minecraft:milk_bucket") return;
        if (!plague.has(e.source.id)) return;
        plague.delete(e.source.id);
        fx(e.source.dimension, P.wisp, up(e.source.location, 1));
        e.source.sendMessage("§a[Harvester] The plague leaves your body.");
    } catch {}
});

on(world.afterEvents.entityRemove, (e) => {
    if (e.typeId === BOSS_ID) bosses.delete(e.removedEntityId);
});

on(world.afterEvents.playerLeave, (e) => {
    plague.delete(e.playerId);
    fighters.delete(e.playerId);
});

// Used by the Harvester Scythe HUD so both scripts don't fight over the action bar
export function inHarvesterFight(player) {
    return now() - (fighters.get(player.id) ?? -1000) < 40;
}

on(world.afterEvents.worldInitialize, () => {
    console.warn("[Harvester Boss v3] Reaper x Plague Doctor loaded: 10 skills, 3 phases, plague stacks.");
});
