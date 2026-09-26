// ============================================================================
//  THE HARVESTER — Reaper x Plague Doctor boss
// ----------------------------------------------------------------------------
//  Phase 1 (100% → 60%)  "Doctor of the Dead"
//     Reaping Arc, Phantom Scythes, Death's Step, Chains of the Damned
//  Phase 2 (60% → 30%)   "Epidemic"      + Hands of the Underworld, Soul Rend,
//                                          Graves of the Plagued, Plague Aura (passive)
//  Phase 3 (below 30%)   "Final Harvest" + Death Sentence, Shadow Reapers,
//                                          The Black Death, Final Harvest (ultimate)
//
//  The boss aims its skills at whatever it is fighting (its current target), and
//  its skills hurt that target even when it is a mob (iron golem, another boss...).
//  Plague stacks: most skills infect. At 5 stacks the victim bursts.
//  Stacks fade over time; drinking milk cleanses them.
//
//  Every timing below is in game ticks (20 ticks = 1 second) and matches the
//  keyframes in TheHarvesterRP/animations/pa_harvester.animation.json.
// ============================================================================
import { world, system, MolangVariableMap } from "@minecraft/server";

const BOSS_ID = "pa:harvester";
const THRALL_TAG = "harvester_thrall";
const DIMENSIONS = ["overworld", "nether", "the_end"];
const NOT_FOES = new Set([BOSS_ID, "minecraft:item", "minecraft:xp_orb", "minecraft:armor_stand",
    "minecraft:arrow", "minecraft:wither_skull", "minecraft:wither_skull_dangerous", "minecraft:painting"]);

const CONFIG = {
    aggroRange: 32,
    arenaRadius: 50,
    enrageTicks: 5 * 60 * 20,
    phase2: 0.6,
    phase3: 0.3,
    targetMemory: 400,      // ticks a target is kept without a new hit
    foeMemory: 600,         // mobs that hurt the boss stay valid skill victims this long
    // pause between two skills (ticks), per phase; enraged uses the last value
    castGap: [40, 30, 22, 14],
    cooldownScale: [1, 0.85, 0.7, 0.5],
    damageScale: [1.15, 1.25, 1.4, 1.6],
    maxThralls: 8,
    plague: { max: 5, fadeAfter: 120, fadeEvery: 60, popDamage: 6 },
    skills: {
        reap:       { phase: 1, cd: 120, weight: 4, min: 0, max: 7,  lock: 27 },
        scythes:    { phase: 1, cd: 180, weight: 3, min: 4, max: 20, lock: 22 },
        step:       { phase: 1, cd: 220, weight: 2, min: 6, max: 24, lock: 30 },
        chains:     { phase: 1, cd: 240, weight: 3, min: 3, max: 16, lock: 30 },
        hands:      { phase: 2, cd: 300, weight: 3, min: 0, max: 18, lock: 36 },
        rend:       { phase: 2, cd: 360, weight: 2, min: 0, max: 10, lock: 30 },
        graves:     { phase: 2, cd: 480, weight: 1, min: 0, max: 30, lock: 36 },
        sentence:   { phase: 3, cd: 500, weight: 2, min: 0, max: 24, lock: 30 },
        reapers:    { phase: 3, cd: 420, weight: 3, min: 0, max: 20, lock: 36 },
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
    flames: "harvester:soul_flames",
    ember: "harvester:ember",
    trail: "harvester:scythe_trail",
    trailBig: "harvester:scythe_trail_big",
    spectral: "harvester:spectral_scythe",
    phantom: "harvester:phantom_scythe",
    xslash: "harvester:x_slash",
    reaper: "harvester:phantom_reaper",
    miasma: "harvester:miasma",
    deathField: "harvester:blackdeath_field",
    smoke: "harvester:black_smoke",
    auraMist: "harvester:aura_mist",
    rain: "harvester:black_rain",
    drip: "harvester:plague_drip",
    splash: "harvester:plague_splash",
    warn: "harvester:ground_warn",
    ringWarn: "harvester:ring_warn",
    runes: "harvester:rune_circle",
    shockwave: "harvester:shockwave",
    crack: "harvester:ground_crack",
    void: "harvester:void_rift",
    skull: "harvester:skull_sigil",
    mark: "harvester:death_mark",
    pips: "harvester:plague_pips",
    hourglass: "harvester:hourglass",
    beak: "harvester:beak_sigil",
    grave: "harvester:grave_rise",
    hand: "harvester:bone_hand",
    dirt: "harvester:dirt_burst",
    lantern: "harvester:lantern",
    chain: "harvester:chain_link",
    chainRise: "harvester:chain_rise"
};

// telegraph colours (r, g, b in 0..1)
const TEAL = [0.35, 1, 0.8];
const PLAGUE = [0.62, 0.85, 0.22];
const BLOOD = [1, 0.18, 0.2];
const VIOLET = [0.62, 0.4, 1];

const bosses = new Map();   // boss id -> state
const plague = new Map();   // entity id -> { stacks, lastGain }
const skillHitTick = new Map(); // entity id -> tick a skill last damaged it

// ─── small helpers ──────────────────────────────────────────────────────────

const now = () => system.currentTick;
const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const up = (a, h) => ({ x: a.x, y: a.y + h, z: a.z });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

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

// a particle flying from `from` to `to` in `life` seconds
function fly(dim, id, from, to, life, extra = {}) {
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 0.05) return;
    fx(dim, id, from, { dir_x: d.x / len, dir_y: d.y / len, dir_z: d.z / len, speed: len / life, life, ...extra });
}

function chainLine(dim, from, to, spacing = 0.9) {
    const len = dist3(from, to);
    const steps = Math.floor(len / spacing);
    for (let i = 1; i < steps; i++) fx(dim, P.chain, lerp(from, to, i / steps));
}

function groundLine(dim, from, to, ticks, c, spacing = 1.1) {
    const len = flatDist(from, to);
    const steps = Math.max(1, Math.floor(len / spacing));
    const vars = color(c, { life: ticks / 20 });
    for (let i = 0; i <= steps; i++) fx(dim, P.warn, up(lerp(from, to, i / steps), 0.06), vars);
}

function sound(dim, id, loc, pitch = 1, volume = 1) {
    try { dim.playSound(id, loc, { pitch, volume }); } catch {}
}

function title(p, text, subtitle = "", stay = 40) {
    if (p.typeId !== "minecraft:player") return; // mobs caught by a skill have no screen
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

function isSpectator(p) {
    try { return String(p.getGameMode()).toLowerCase() === "spectator"; } catch { return false; }
}

// Players near a point. Creative players count too (they take no damage, but the boss still
// fights them, which is how most people test it); spectators are ignored.
// The game mode is compared as text because its enum spelling differs between API versions.
function players(dim, center, radius) {
    let list = [];
    try { list = dim.getEntities({ location: center, maxDistance: radius, type: "minecraft:player" }); } catch { return []; }
    return list.filter((p) => !isSpectator(p) && (health(p)?.currentValue ?? 0) > 0);
}

function state(boss) { return bosses.get(boss.id); }

function on(signal, callback) {
    try { signal?.subscribe(callback); } catch {}
}

function tier(s) { return s.enraged ? 3 : s.phase - 1; }

// ─── targets ────────────────────────────────────────────────────────────────

// Something the boss can fight: a living entity that is not itself, its thralls or an object
function canFight(boss, e) {
    if (!alive(e) || NOT_FOES.has(e.typeId) || e.id === boss.id) return false;
    try {
        if (e.dimension.id !== boss.dimension.id) return false;
        if (e.hasTag(THRALL_TAG)) return false;
    } catch { return false; }
    if (e.typeId === "minecraft:player" && isSpectator(e)) return false;
    return (health(e)?.currentValue ?? 0) > 0;
}

function setTarget(boss, s, e) {
    if (!s || !canFight(boss, e)) return;
    s.target = e;
    s.targetTick = now();
    if (e.typeId !== "minecraft:player") s.foes.set(e.id, { entity: e, tick: now() });
}

// The entity the boss is fighting: the last thing that hurt it or that it hurt,
// otherwise the nearest player in range.
function currentTarget(boss, s) {
    const t = now();
    const tg = s.target;
    if (tg && t - s.targetTick < CONFIG.targetMemory && canFight(boss, tg)
        && flatDist(boss.location, tg.location) <= CONFIG.aggroRange + 8) {
        return tg;
    }
    s.target = undefined;
    let best, bestD = Infinity;
    for (const p of players(boss.dimension, boss.location, CONFIG.aggroRange)) {
        const d = flatDist(boss.location, p.location);
        if (d < bestD) { best = p; bestD = d; }
    }
    if (best) setTarget(boss, s, best);
    return best;
}

// Everything a skill can hit around `center`: players, the boss's target and mobs fighting it
function victims(boss, center, radius) {
    const s = state(boss);
    const list = players(boss.dimension, center, radius);
    const seen = new Set(list.map((p) => p.id));
    const extra = [];
    if (s) {
        if (s.target && s.target.typeId !== "minecraft:player") extra.push(s.target);
        for (const [id, foe] of s.foes) {
            if (now() - foe.tick > CONFIG.foeMemory || !canFight(boss, foe.entity)) { s.foes.delete(id); continue; }
            extra.push(foe.entity);
        }
    }
    for (const e of extra) {
        if (seen.has(e.id) || !canFight(boss, e)) continue;
        if (dist3(center, e.location) > radius + 1) continue;
        seen.add(e.id);
        list.push(e);
    }
    return list;
}

// the boss's target leads single-target picks (Death Sentence marks, grave anchors)
function targetFirst(target, list) {
    const i = list.findIndex((e) => e.id === target?.id);
    return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
}

function hurt(boss, e, amount, cause = "entityAttack") {
    const s = state(boss);
    const scaled = amount * (s ? CONFIG.damageScale[tier(s)] : 1);
    skillHitTick.set(e.id, now());
    try { e.applyDamage(scaled, { cause, damagingEntity: boss }); } catch {
        try { e.applyDamage(scaled); } catch {}
    }
}

function knockFrom(center, e, horizontal, vertical) {
    const d = flatDir(center, e.location);
    try { e.applyKnockback(d.x, d.z, horizontal, vertical); } catch {}
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

function chest(e) {
    try { return up(e.location, e.typeId === BOSS_ID ? 2.3 : 1.1); } catch { return e.location; }
}

// Tile a cone on the ground (0.8-block tiles)
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

function inCone(origin, dir, e, radius, halfAngle, height = 3.5) {
    const d = flatDist(origin, e.location);
    if (d > radius || Math.abs(e.location.y - origin.y) > height) return false;
    if (d < 1.2) return true;
    const to = flatDir(origin, e.location);
    return to.x * dir.x + to.z * dir.z >= Math.cos(halfAngle * Math.PI / 180);
}

// distance on the ground from `e` to the infinite line through `a` with direction `dir`
function lineDist(a, dir, e) {
    const dx = e.location.x - a.x, dz = e.location.z - a.z;
    return Math.abs(dx * dir.z - dz * dir.x);
}

// ─── plague stacks ──────────────────────────────────────────────────────────

function addPlague(boss, e, amount = 1) {
    const entry = plague.get(e.id) ?? { stacks: 0, lastGain: 0 };
    entry.stacks += amount;
    entry.lastGain = now();
    plague.set(e.id, entry);
    if (entry.stacks >= CONFIG.plague.max) {
        entry.stacks = 0;
        plagueBurst(boss, e);
    }
}

function plagueBurst(boss, e) {
    const dim = e.dimension;
    const at = up(e.location, 1);
    fx(dim, P.miasma, at);
    fx(dim, P.miasma, up(at, 0.6));
    fx(dim, P.beak, up(e.location, 2.4));
    fx(dim, P.splash, up(e.location, 0.08));
    sound(dim, "mob.zombie.unfect", at, 0.6);
    hurt(boss, e, CONFIG.plague.popDamage, "magic");
    effect(e, "wither", 60, 0);
    effect(e, "nausea", 80, 0);
}

function stacksOf(e) { return plague.get(e.id)?.stacks ?? 0; }

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
        fx(dim, P.crack, up(add(origin, dir, 3), 0.05), { radius: 2.2, life: 1.6 });
        for (const e of victims(boss, origin, radius + 1)) {
            if (!inCone(origin, dir, e, radius, 64)) continue;
            hurt(boss, e, 10);
            knockFrom(origin, e, 1.4, 0.35);
            addPlague(boss, e, 1);
            fx(dim, P.ember, up(e.location, 1));
        }
    });
}

// Phantom Scythes: spectral scythes thrown in a fan (3/4/5), they fly out and come back
// like boomerangs, cutting on the way out and on the way back. Release at tick 9.
function castScythes(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_throw");
    const count = s.phase + 2;
    const base = flatDir(boss.location, target.location);
    const reach = Math.min(18, Math.max(7, flatDist(boss.location, target.location) + 3));
    const paths = [];
    for (let i = 0; i < count; i++) {
        const dir = rotateY(base, (i - (count - 1) / 2) * 16);
        const start = up(boss.location, 1.6);
        const out = { x: start.x + dir.x * reach, y: target.location.y + 1, z: start.z + dir.z * reach };
        paths.push({ start, out });
        groundLine(dim, boss.location, add(boss.location, dir, reach), 9, TEAL);
    }
    sound(dim, "mob.evocation_illager.prepare_attack", boss.location, 0.9);
    const OUT = 12, BACK = 12;
    later(9, () => {
        if (!alive(boss)) return;
        sound(dim, "item.trident.throw", boss.location, 0.6);
        sound(dim, "mob.phantom.swoop", boss.location, 0.8);
        for (const { start, out } of paths) {
            fly(dim, P.phantom, start, out, OUT / 20);
            const hitOut = new Set();
            for (let k = 2; k <= OUT; k += 2) {
                later(k, () => {
                    const pos = lerp(start, out, k / OUT);
                    fx(dim, P.wisp, pos);
                    for (const e of victims(boss, pos, 1.6)) {
                        if (hitOut.has(e.id) || dist3(pos, chest(e)) > 1.7) continue;
                        hitOut.add(e.id);
                        hurt(boss, e, 6);
                        effect(e, "slowness", 30, 1);
                        addPlague(boss, e, 1);
                    }
                });
            }
            // the way back, toward wherever the boss stands now
            later(OUT, () => {
                if (!alive(boss)) return;
                const home = chest(boss);
                fly(dim, P.phantom, out, home, BACK / 20);
                sound(dim, "mob.phantom.swoop", out, 1.2);
                const hitBack = new Set();
                for (let k = 2; k <= BACK; k += 2) {
                    later(k, () => {
                        const pos = lerp(out, home, k / BACK);
                        for (const e of victims(boss, pos, 1.6)) {
                            if (hitBack.has(e.id) || dist3(pos, chest(e)) > 1.7) continue;
                            hitBack.add(e.id);
                            hurt(boss, e, 6);
                        }
                    });
                }
            });
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
            fx(dim, P.xslash, add(up(origin, 1.3), dir, 2.2), { spin: 20 });
            sound(dim, "mob.wither.shoot", origin, 1.2);
            for (const e of victims(boss, origin, 4.2)) {
                if (!inCone(origin, dir, e, 4, 70)) continue;
                hurt(boss, e, 9);
                effect(e, "slowness", 40, 1);
                addPlague(boss, e, 1);
                fx(dim, P.ember, up(e.location, 1));
            }
        });
    });
}

// Chains of the Damned: a rift opens under the target, chains burst out and bind whoever
// stands on it, then the boss yanks them in (and follows up with a Reaping Arc).
// Rift at tick 0, chains at tick 8, pull at tick 18.
function castChains(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_chains");
    const spot = { ...target.location };
    fx(dim, P.void, up(spot, 0.06), { radius: 1.9, life: 1.3 });
    fx(dim, P.ringWarn, up(spot, 0.07), color(VIOLET, { radius: 1.9, life: 0.4 }));
    sound(dim, "mob.evocation_illager.prepare_attack", boss.location, 0.5);
    const bound = [];
    later(8, () => {
        if (!alive(boss)) return;
        sound(dim, "random.anvil_land", spot, 0.5, 0.7);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const r = i === 4 ? 0 : 0.9;
            const base = { x: spot.x + Math.cos(a) * r, y: spot.y, z: spot.z + Math.sin(a) * r };
            for (const h of [0.35, 1.05, 1.75]) fx(dim, P.chainRise, up(base, h), { life: 1.1 });
        }
        fx(dim, P.flames, up(spot, 0.2));
        fx(dim, P.dirt, up(spot, 0.1));
        for (const e of victims(boss, spot, 2)) {
            if (flatDist(spot, e.location) > 2 || Math.abs(e.location.y - spot.y) > 2) continue;
            bound.push(e);
            effect(e, "slowness", 12, 10);
            effect(e, "weakness", 60, 0);
            hurt(boss, e, 5, "magic");
            addPlague(boss, e, 1);
        }
    });
    for (let t = 9; t <= 20; t += 2) {
        later(t, () => {
            if (!alive(boss)) return;
            const hand = add(chest(boss), rightOf(flatDir(boss.location, spot)), -0.9);
            for (const e of bound) if (alive(e)) chainLine(dim, chest(e), hand);
        });
    }
    later(18, () => {
        if (!alive(boss) || bound.length === 0) return;
        sound(dim, "random.anvil_use", boss.location, 0.5);
        for (const e of bound) {
            if (!alive(e)) continue;
            const d = flatDist(e.location, boss.location);
            const dir = flatDir(e.location, boss.location);
            try { e.applyKnockback(dir.x, dir.z, Math.min(3.5, Math.max(0.8, d * 0.3)), 0.35); } catch {}
            hurt(boss, e, 5);
            fx(dim, P.ember, chest(e));
        }
        // dragged in: reap them right away
        s.cds.reap = 0;
        s.nextCast = Math.min(s.nextCast, now() + 14);
    });
}

// ─── skills: phase 2 ────────────────────────────────────────────────────────

// Hands of the Underworld: rifts open one after another under the target; 0.7 s later
// skeletal hands burst out and drag down whoever is still there. Slam at tick 16.
function castHands(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_hands");
    sound(dim, "mob.warden.emerge", boss.location, 0.6, 0.8);
    const count = 5 + (s.phase >= 3 ? 2 : 0);
    for (let i = 0; i < count; i++) {
        later(12 + i * 6, () => {
            if (!alive(boss)) return;
            let spot;
            if (alive(target)) {
                let v = { x: 0, z: 0 };
                try { v = target.getVelocity(); } catch {}
                const jitter = i === 0 ? 0 : 1.4;
                const a = Math.random() * Math.PI * 2;
                spot = { x: target.location.x + v.x * 8 + Math.cos(a) * jitter, y: target.location.y, z: target.location.z + v.z * 8 + Math.sin(a) * jitter };
            } else {
                const a = Math.random() * Math.PI * 2;
                spot = { x: boss.location.x + Math.cos(a) * 6, y: boss.location.y, z: boss.location.z + Math.sin(a) * 6 };
            }
            fx(dim, P.void, up(spot, 0.06), { radius: 1.7, life: 1.2 });
            sound(dim, "dig.gravel", spot, 0.6);
            later(14, () => {
                if (!alive(boss)) return;
                for (let k = 0; k < 5; k++) {
                    const a = (k / 5) * Math.PI * 2 + i;
                    const r = k === 4 ? 0 : 0.8;
                    fx(dim, P.hand, up({ x: spot.x + Math.cos(a) * r, y: spot.y, z: spot.z + Math.sin(a) * r }, 0.4), { life: 0.9 });
                }
                fx(dim, P.dirt, up(spot, 0.1));
                fx(dim, P.flames, up(spot, 0.2));
                fx(dim, P.crack, up(spot, 0.05), { radius: 1.8, life: 1.8 });
                sound(dim, "mob.skeleton.hurt", spot, 0.5);
                for (const e of victims(boss, spot, 2)) {
                    if (flatDist(spot, e.location) > 1.9 || Math.abs(e.location.y - spot.y) > 1.6) continue;
                    hurt(boss, e, 7);
                    effect(e, "slowness", 40, 2);
                    addPlague(boss, e, 1);
                    try { e.applyKnockback(0, 0, 0, 0.35); } catch {}
                }
            });
        });
    }
}

// Soul Rend: the boss grabs the target's soul (skull mark + chain) and rips it out.
// Damage scales with the victim's max health; the boss drinks it. Break the chain by
// getting more than 13 blocks away. Grab at tick 7, rip at tick 16.
function castRend(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_rend");
    sound(dim, "mob.evocation_illager.cast_spell", boss.location, 0.4);
    for (let t = 7; t <= 16; t += 2) {
        later(t, () => {
            if (!alive(boss) || !alive(target) || flatDist(boss.location, target.location) > 13) return;
            fx(dim, P.mark, up(target.getHeadLocation(), 0.8));
            chainLine(dim, chest(target), add(chest(boss), rightOf(flatDir(boss.location, target.location)), -0.9));
        });
    }
    later(16, () => {
        if (!alive(boss) || !alive(target)) return;
        const from = chest(target);
        if (flatDist(boss.location, target.location) > 13) {
            fx(dim, P.ember, from);
            sound(dim, "random.break", from, 0.6);
            return;
        }
        const maxHp = health(target)?.effectiveMax ?? 20;
        const dmg = Math.min(40, Math.max(6, maxHp * 0.12));
        hurt(boss, target, dmg, "magic");
        heal(boss, dmg * 2);
        effect(target, "weakness", 100, 1);
        effect(target, "slowness", 60, 1);
        effect(target, "darkness", 60, 0);
        addPlague(boss, target, 1);
        fx(dim, P.souls, from);
        sound(dim, "mob.wither.hurt", from, 0.5);
        for (let k = 0; k < 3; k++) later(k * 3 + 1, () => fly(dim, P.stream, from, chest(boss), 0.45));
    });
}

// Graves of the Plagued: tombstones rise, plague thralls climb out. Graves at tick 18, thralls 1.2 s later.
function castGraves(boss, s, target) {
    const dim = boss.dimension;
    play(boss, "skill_summon");
    sound(dim, "mob.evocation_illager.prepare_summon", boss.location, 0.5);
    later(18, () => {
        if (!alive(boss)) return;
        sound(dim, "mob.warden.emerge", boss.location, 1.2, 0.8);
        const anchors = targetFirst(target, victims(boss, boss.location, 30));
        const count = Math.min(s.phase >= 3 ? 4 : 3, CONFIG.maxThralls - countThralls(boss));
        const types = s.phase >= 3
            ? ["minecraft:husk", "minecraft:bogged", "minecraft:wither_skeleton", "minecraft:husk"]
            : ["minecraft:husk", "minecraft:husk", "minecraft:bogged"];
        for (let i = 0; i < count; i++) {
            const anchor = anchors.length ? anchors[i % anchors.length].location : boss.location;
            const a = Math.random() * Math.PI * 2;
            const r = 3 + Math.random() * 2.5;
            const spot = { x: anchor.x + Math.cos(a) * r, y: anchor.y, z: anchor.z + Math.sin(a) * r };
            fx(dim, P.grave, up(spot, 0.35), { life: 3.2 });
            fx(dim, P.void, up(spot, 0.06), { radius: 1.2, life: 1.6 });
            fx(dim, P.dirt, up(spot, 0.1));
            later(24, () => {
                fx(dim, P.dirt, up(spot, 0.1));
                fx(dim, P.flames, up(spot, 0.2));
                for (let k = 0; k < 3; k++) fx(dim, P.hand, up({ x: spot.x + (k - 1) * 0.5, y: spot.y, z: spot.z }, 0.4), { life: 0.8 });
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

// Plague Aura (phase 2+ passive): standing next to the boss infects you every 3 s.
function plagueAura(boss, s, t) {
    const dim = boss.dimension;
    if (t % 8 === 0) fx(dim, P.auraMist, boss.location);
    if (t % 20 !== 0) return;
    for (const e of victims(boss, boss.location, 3.5)) {
        const last = s.auraHits[e.id] ?? 0;
        if (t - last < 60) continue;
        s.auraHits[e.id] = t;
        addPlague(boss, e, 1);
        fx(dim, P.miasma, up(e.location, 1));
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
        const condemned = targetFirst(target, victims(boss, boss.location, CONFIG.skills.sentence.max)).slice(0, 4);
        const duration = 80;
        for (const e of condemned) {
            title(e, "§4§l⌛ SENTENCED ⌛", "§7Cleanse your plague (milk) to soften the blow", 50);
            for (let t = 0; t < duration; t += 2) {
                later(t + 1, () => {
                    if (!alive(e)) return;
                    fx(dim, P.hourglass, up(e.getHeadLocation(), 0.85), { frame: Math.floor((t / duration) * 8) });
                    if (t % 20 === 0) sound(dim, "random.click", e.location, 0.5, 0.6);
                });
            }
            later(duration, () => {
                if (!alive(e) || !alive(boss)) return;
                const stacks = stacksOf(e);
                plague.delete(e.id);
                fx(dim, P.spectral, up(e.location, 1.4));
                fx(dim, P.souls, up(e.location, 1));
                fx(dim, P.crack, up(e.location, 0.05), { radius: 1.6, life: 1.6 });
                sound(dim, "mob.wither.shoot", e.location, 0.5);
                hurt(boss, e, 6 + 3 * stacks, "magic");
                effect(e, "wither", 40, 1);
            });
        }
    });
}

// Shadow Reapers: four phantom reapers appear around the target, their paths drawn on the
// ground as a cross. 1 s later they dash through the centre, cutting everything on the lines.
// Reapers at tick 8, dash at tick 28.
function castReapers(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_reapers");
    sound(dim, "mob.wither.ambient", boss.location, 0.6);
    let center, a0;
    later(8, () => {
        if (!alive(boss)) return;
        center = alive(target) ? { ...target.location } : { ...boss.location };
        a0 = Math.random() * 90;
        for (let i = 0; i < 4; i++) {
            const dir = rotateY({ x: 0, y: 0, z: 1 }, a0 + i * 90);
            const pos = add(center, dir, 5);
            fx(dim, P.reaper, up(pos, 1.2), { dir_x: 0, dir_z: 0, speed: 0, life: 1.1 });
            fx(dim, P.smoke, up(pos, 1));
            if (i < 2) groundLine(dim, pos, add(center, dir, -5), 20, VIOLET);
        }
        sound(dim, "mob.endermen.portal", center, 0.5);
    });
    later(28, () => {
        if (!alive(boss) || !center) return;
        sound(dim, "mob.wither.shoot", center, 0.8);
        sound(dim, "mob.phantom.swoop", center, 0.6);
        for (let i = 0; i < 4; i++) {
            const dir = rotateY({ x: 0, y: 0, z: 1 }, a0 + i * 90);
            const from = up(add(center, dir, 5), 1.2);
            fly(dim, P.reaper, from, up(add(center, dir, -5), 1.2), 0.3);
            for (const k of [-3, 0, 3]) fx(dim, P.trail, up(add(center, dir, k), 1.1), { spin: a0 + i * 90 });
        }
        fx(dim, P.xslash, up(center, 1.2), { spin: a0 + 45 });
        fx(dim, P.crack, up(center, 0.05), { radius: 2.6, life: 2 });
        const dirs = [rotateY({ x: 0, y: 0, z: 1 }, a0), rotateY({ x: 0, y: 0, z: 1 }, a0 + 90)];
        for (const e of victims(boss, center, 6)) {
            if (flatDist(center, e.location) > 5.5) continue;
            if (!dirs.some((d) => lineDist(center, d, e) < 1.2)) continue;
            hurt(boss, e, 12);
            effect(e, "wither", 40, 1);
            addPlague(boss, e, 1);
            fx(dim, P.ember, chest(e));
        }
    });
}

// The Black Death: a killing miasma floods the arena. Only the soul lanterns' light is safe. Hit at tick 72.
function castBlackDeath(boss, s) {
    const dim = boss.dimension;
    play(boss, "skill_blackdeath");
    const center = { ...boss.location };
    const radius = 16;
    const nearby = victims(boss, center, CONFIG.skills.blackdeath.max + 4);
    for (const e of nearby) title(e, "§0§l☣ §2THE BLACK DEATH §0☣", "§bHide in a soul lantern's light!", 60);
    sound(dim, "mob.wither.spawn", center, 0.5, 0.8);
    fx(dim, P.deathField, up(center, 0.1), { radius, duration: 4.3 });
    fx(dim, P.rain, center, { radius, duration: 3.6 });

    const zones = [];
    const count = Math.max(2, Math.min(5, nearby.length + 1));
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
        for (const e of victims(boss, center, radius + 2)) {
            const safe = zones.some((z) => flatDist(z, e.location) <= 2.6);
            if (safe) {
                fx(dim, P.wisp, up(e.location, 1));
                continue;
            }
            hurt(boss, e, 14, "magic");
            effect(e, "wither", 60, 1);
            addPlague(boss, e, 2);
            fx(dim, P.miasma, up(e.location, 1));
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
    for (const e of victims(boss, center, 40)) title(e, "§4§l☠ FINAL HARVEST ☠", "§7Get close... or get far away", 50);
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
        fx(dim, P.crack, up(center, 0.05), { radius: 4, life: 2.5 });
        fx(dim, P.souls, up(center, 2));
        let reaped = 0;
        for (const e of victims(boss, center, outer + 1)) {
            const d = flatDist(center, e.location);
            if (d <= inner || d > outer || Math.abs(e.location.y - center.y) > 4) continue;
            reaped++;
            hurt(boss, e, 18);
            effect(e, "wither", 60, 1);
            addPlague(boss, e, 1);
            fly(dim, P.stream, chest(e), up(center, 2.3), 0.5);
        }
        if (reaped > 0) heal(boss, reaped * 6);
    });
}

const CASTS = {
    reap: castReap, scythes: castScythes, step: castDeathStep, chains: castChains,
    hands: castHands, rend: castRend, graves: castGraves,
    sentence: castSentence, reapers: castReapers, blackdeath: castBlackDeath, ultimate: castUltimate
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

// Permanent buffs: tougher every phase (Resistance I = -20% damage, II = -40%)
function applyBuffs(boss, s) {
    const lasting = 20000000;
    const table = s.enraged
        ? { resistance: 1, strength: 2, speed: 1, fire_resistance: 0 }
        : [{ resistance: 0 }, { resistance: 0, strength: 0, speed: 0 }, { resistance: 1, strength: 1, speed: 1, fire_resistance: 0 }][s.phase - 1];
    for (const [id, amp] of Object.entries(table)) {
        try {
            const cur = boss.getEffect(id);
            if (cur && cur.amplifier === amp && cur.duration > 1000000) continue;
            if (cur) boss.removeEffect(id);
        } catch {}
        try { boss.addEffect(id, lasting, { amplifier: amp, showParticles: false }); } catch {}
    }
}

// Phase change: roar and shockwave only, no titles or chat
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
        fx(dim, P.crack, up(center, 0.05), { radius: 3.5, life: 2.5 });
        fx(dim, P.beak, up(center, 4.2));
        sound(dim, "mob.wither.spawn", center, phase === 3 ? 0.6 : 0.8);
        for (const e of victims(boss, center, 6)) knockFrom(center, e, 2.2, 0.5);
    });
    later(45, () => { if (alive(boss)) applyBuffs(boss, s); });
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
    applyBuffs(boss, s);
    sound(boss.dimension, "mob.wither.spawn", boss.location, 0.5);
    fx(boss.dimension, P.runes, up(boss.location, 0.05), color(BLOOD, { radius: 8, life: 2 }));
}

// Nobody fought for 30 s: the enrage timer resets and the boss mends slowly
function resetFight(boss, s) {
    s.startTick = undefined;
    s.target = undefined;
    s.foes.clear();
    if (!s.enraged) return;
    s.enraged = false;
    for (const id of ["strength", "speed", "resistance"]) {
        try { boss.removeEffect(id); } catch {}
    }
    applyBuffs(boss, s);
    setName(boss, s);
}

// ─── AI loop ────────────────────────────────────────────────────────────────

function initState(boss) {
    let s = bosses.get(boss.id);
    if (s) return s;
    const t = now();
    s = {
        // startTick: when the fight started (enrage timer); undefined while nobody fights
        phase: 1, enraged: false, startTick: undefined, lastEngaged: 0, arena: { ...boss.location },
        cds: {}, busyUntil: 0, nextCast: t + 40, lastSkill: "", auraHits: {},
        target: undefined, targetTick: 0, foes: new Map(), lastBlink: 0, lastMelee: 0
    };
    bosses.set(boss.id, s);
    const hp = health(boss);
    if (hp) {
        const ratio = hp.currentValue / hp.effectiveMax;
        if (ratio <= CONFIG.phase3) s.phase = 3;
        else if (ratio <= CONFIG.phase2) s.phase = 2;
    }
    setName(boss, s);
    applyBuffs(boss, s);
    return s;
}

function chooseSkill(boss, s, target) {
    const t = now();
    const d = flatDist(boss.location, target.location);
    const options = [];
    for (const [name, cfg] of Object.entries(CONFIG.skills)) {
        if (s.phase < cfg.phase || (s.cds[name] ?? 0) > t) continue;
        if (d < cfg.min || d > cfg.max) continue;
        if (name === "graves" && countThralls(boss) >= CONFIG.maxThralls) continue;
        let weight = cfg.weight;
        if (name === s.lastSkill) weight *= 0.25;
        if (cfg.phase === s.phase && s.phase > 1) weight *= 1.5; // favour the new phase's skills
        if (name === "reap" && s.cds.reap === 0) weight *= 4;     // follow-up after Chains of the Damned
        options.push({ name, weight });
    }
    if (options.length === 0) return undefined;
    let roll = Math.random() * options.reduce((sum, o) => sum + o.weight, 0);
    for (const o of options) {
        roll -= o.weight;
        if (roll <= 0) return o.name;
    }
    return options[options.length - 1].name;
}

function bossTick(boss) {
    const s = initState(boss);
    const t = now();
    const dim = boss.dimension;
    const target = currentTarget(boss, s);

    if (!target) {
        if (s.startTick !== undefined && t - s.lastEngaged > 600) resetFight(boss, s);
        // out of combat: mend 1% of max health per second
        if (s.startTick === undefined && t % 20 === 0) {
            const hp = health(boss);
            if (hp && hp.currentValue < hp.effectiveMax) heal(boss, hp.effectiveMax * 0.01);
        }
        return;
    }
    if (s.startTick === undefined) s.startTick = t;
    s.lastEngaged = t;

    checkPhase(boss, s);
    checkEnrage(boss, s);
    if (s.phase >= 2) plagueAura(boss, s, t);

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
    const pick = chooseSkill(boss, s, target);
    if (!pick) return;
    const cfg = CONFIG.skills[pick];
    const tr = tier(s);
    s.cds[pick] = t + Math.round(cfg.cd * CONFIG.cooldownScale[tr]);
    s.busyUntil = t + cfg.lock;
    s.nextCast = t + cfg.lock + CONFIG.castGap[tr];
    s.lastSkill = pick;
    root(boss, cfg.lock);
    try { CASTS[pick](boss, s, target); } catch {}
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
        for (const [id, entry] of plague) {
            const e = world.getEntity(id);
            if (!e || !alive(e)) { plague.delete(id); continue; }
            if (t - entry.lastGain > CONFIG.plague.fadeAfter) {
                entry.stacks -= 1;
                entry.lastGain = t - CONFIG.plague.fadeAfter + CONFIG.plague.fadeEvery;
            }
            if (entry.stacks <= 0) { plague.delete(id); continue; }
            fx(e.dimension, P.pips, up(e.getHeadLocation(), 0.75), { stacks: entry.stacks });
            if (t % 20 === 0) fx(e.dimension, P.drip, up(e.location, 1.2));
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
        fx(dim, P.void, up(at, 0.06), { radius: 2.8, life: 2.4 });
        fx(dim, P.dirt, up(at, 0.1));
        later(12, () => fx(dim, P.dirt, up(at, 0.1)));
        later(38, () => { fx(dim, P.souls, up(at, 2)); fx(dim, P.beak, up(at, 4)); });
        sound(dim, "mob.warden.emerge", at, 0.7);
    } catch {}
});

// Targeting: whatever hurts the boss, or whatever the boss hits in melee / with a skull,
// becomes its target. Melee hits spread the plague (phase 2+). Counter blink when struck.
on(world.afterEvents.entityHurt, (e) => {
    try {
        const victim = e.hurtEntity;
        const source = e.damageSource;
        const t = now();
        if (source?.damagingEntity?.typeId === BOSS_ID && victim.typeId !== BOSS_ID) {
            const boss = source.damagingEntity;
            const s = bosses.get(boss.id);
            if (!s || skillHitTick.get(victim.id) === t) return;
            if (source.cause === "entityAttack" || source.cause === "projectile") setTarget(boss, s, victim);
            // (the swing animation itself is played by the resource pack from variable.attack_time)
            if (source.cause === "entityAttack" && t - s.lastMelee > 12) {
                s.lastMelee = t;
                if (s.phase >= 2) addPlague(boss, victim, 1);
            }
            return;
        }
        if (victim.typeId !== BOSS_ID) return;
        const boss = victim;
        const s = bosses.get(boss.id);
        const attacker = source?.damagingEntity;
        if (!s || !attacker || attacker.typeId === BOSS_ID) return;
        setTarget(boss, s, attacker);
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
        plague.delete(dead.id);
        if (dead.typeId === "minecraft:player") {
            const dim = dead.dimension;
            const loc = { ...dead.location };
            for (const boss of dim.getEntities({ type: BOSS_ID, location: loc, maxDistance: 30 })) {
                const hp = health(boss);
                if (hp) heal(boss, hp.effectiveMax * 0.03);
                fx(dim, P.souls, up(loc, 1));
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
    } catch {}
});

on(world.afterEvents.entityRemove, (e) => {
    if (e.typeId === BOSS_ID) bosses.delete(e.removedEntityId);
});

on(world.afterEvents.playerLeave, (e) => {
    plague.delete(e.playerId);
});

on(world.afterEvents.worldInitialize, () => {
    console.warn("[Harvester Boss v4] loaded: 11 skills, 3 phases, targets whatever it fights.");
});
