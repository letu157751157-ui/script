// ============================================================================
//  THE HARVESTER — Reaper x Plague Doctor boss
// ----------------------------------------------------------------------------
//  Phase 1 (100% → 60%)  "Doctor of the Dead"
//     Reaping Arc, Field of Souls, Will-o'-the-Wisps, Candles of the Dead
//  Phase 2 (60% → 30%)   "Epidemic"      + Plague Pyre, Footsteps of the Dead, Buried Alive,
//                                          Plague Aura (passive)
//  Phase 3 (below 30%)   "Final Harvest" + Death Sentence, Danse Macabre,
//                                          The Black Death, Final Harvest (ultimate)
//  Soul fire is the Harvester's element: it burns on him all the time (resource pack),
//  and most skills leave burning ground behind.
//  The boss aims its skills at whatever it is fighting (its current target), and
//  its skills hurt that target even when it is a mob (iron golem, another boss...).
//  Plague stacks: most skills infect. At 5 stacks the victim bursts.
//  Stacks fade over time; drinking milk cleanses them.
//
//  Every timing below is in game ticks (20 ticks = 1 second) and matches the
//  keyframes in TheHarvesterRP/animations/pa_harvester.animation.json.
// ============================================================================
import { world, system, MolangVariableMap, ItemStack } from "@minecraft/server";

const BOSS_ID = "pa:harvester";
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
    plague: { max: 5, fadeAfter: 120, fadeEvery: 60, popDamage: 6 },
    skills: {
        reap:       { phase: 1, cd: 120, weight: 4, min: 0, max: 7,  lock: 27 },
        field:      { phase: 1, cd: 300, weight: 3, min: 0, max: 18, lock: 46 },
        wisps:      { phase: 1, cd: 260, weight: 3, min: 3, max: 24, lock: 26 },
        candles:    { phase: 1, cd: 420, weight: 2, min: 0, max: 20, lock: 30 },
        pyre:       { phase: 2, cd: 320, weight: 3, min: 0, max: 20, lock: 36 },
        trail:      { phase: 2, cd: 420, weight: 2, min: 0, max: 20, lock: 22 },
        coffin:     { phase: 2, cd: 280, weight: 3, min: 2, max: 16, lock: 28 },
        sentence:   { phase: 3, cd: 500, weight: 2, min: 0, max: 24, lock: 30 },
        danse:      { phase: 3, cd: 460, weight: 3, min: 0, max: 18, lock: 44 },
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
    firePatch: "harvester:fire_patch",
    column: "harvester:fire_column",
    ember: "harvester:ember",
    eyeGlow: "harvester:eye_glow",
    trail: "harvester:scythe_trail",
    trailBig: "harvester:scythe_trail_big",
    spectral: "harvester:spectral_scythe",
    miasma: "harvester:miasma",
    deathField: "harvester:blackdeath_field",
    smoke: "harvester:black_smoke",
    auraMist: "harvester:aura_mist",
    rain: "harvester:black_rain",
    drip: "harvester:plague_drip",
    splash: "harvester:plague_splash",
    ash: "harvester:ash_burst",
    warn: "harvester:ground_warn",
    ringWarn: "harvester:ring_warn",
    runes: "harvester:rune_circle",
    shockwave: "harvester:shockwave",
    skull: "harvester:skull_sigil",
    mark: "harvester:death_mark",
    pips: "harvester:plague_pips",
    hourglass: "harvester:hourglass",
    beak: "harvester:beak_sigil",
    lantern: "harvester:lantern",
    wheat: "harvester:soul_wheat",
    wheatBurst: "harvester:wheat_burst",
    candle: "harvester:candle",
    willo: "harvester:will_o_wisp",
    footprint: "harvester:footprint",
    coffin: "harvester:coffin",
    dancer: "harvester:dancer"
};

// telegraph colours (r, g, b in 0..1), taken from the model: its teal (1DE9B6), a murky sea-green
// for the plague, and the gold of its trim (F8DD72) for the one ring you must not stand in
const SOUL = [0.11, 0.91, 0.71];
const PLAGUE = [0.25, 0.69, 0.54];
const GOLD = [0.97, 0.87, 0.45];

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

// Something the boss can fight: a living entity that is not itself or an object
function canFight(boss, e) {
    if (!alive(e) || NOT_FOES.has(e.typeId) || e.id === boss.id) return false;
    try {
        if (e.dimension.id !== boss.dimension.id) return false;
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

// the boss's target leads single-target picks (Death Sentence marks, footprints)
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

// ─── burning ground ─────────────────────────────────────────────────────────

// Soul fire left on the ground: every 10 ticks for `ticks`, whatever stands within `radius` of any of
// the points burns for `dmg` (fire damage, so Fire Resistance protects). One pulse per victim even
// where patches overlap. The first burn also gives 1 plague when `plagueOnce` is set.
function burnPoints(boss, points, radius, ticks, dmg, plagueOnce = false) {
    if (!points.length) return;
    const dim = boss.dimension;
    const c = points.reduce((acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length, z: acc.z + p.z / points.length }), { x: 0, y: 0, z: 0 });
    const reach = Math.max(...points.map((p) => flatDist(c, p))) + radius + 1;
    const infected = new Set();
    for (let t = 10; t <= ticks; t += 10) {
        later(t, () => {
            if (!alive(boss)) return;
            for (const e of victims(boss, c, reach)) {
                if (!points.some((p) => flatDist(p, e.location) <= radius && Math.abs(e.location.y - p.y) < 2)) continue;
                hurt(boss, e, dmg, "fire");
                if (plagueOnce && !infected.has(e.id)) {
                    infected.add(e.id);
                    addPlague(boss, e, 1);
                }
            }
        });
    }
}

// ─── skills: phase 1 ────────────────────────────────────────────────────────

// Reaping Arc: cone telegraph, then a low scythe sweep from right to left. Hit at tick 13.
// The swept ground catches soul fire and burns for 3 s.
function castReap(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_reap");
    const origin = { ...boss.location };
    const dir = flatDir(origin, target.location);
    const radius = s.phase >= 3 ? 7.5 : 6.5;
    telegraphCone(dim, origin, dir, radius, 62, 13, SOUL);
    sound(dim, "mob.evocation_illager.prepare_attack", origin, 0.6);

    later(13, () => {
        if (!alive(boss)) return;
        sound(dim, "mob.wither.shoot", origin, 0.7);
        sound(dim, "mob.ghast.fireball", origin, 0.8, 0.6);
        for (let k = 0; k < 5; k++) {
            later(1 + k, () => {
                // from his right (+angle) across to his left (-angle), like the animation
                for (const a of [62 - k * 31, 62 - k * 31 - 15]) {
                    fx(dim, P.trailBig, add(up(origin, 1.1), rotateY(dir, a), radius * 0.55), { spin: k * 30 - 60 });
                }
            });
        }
        for (const e of victims(boss, origin, radius + 1)) {
            if (!inCone(origin, dir, e, radius, 64)) continue;
            hurt(boss, e, 10);
            knockFrom(origin, e, 1.4, 0.35);
            addPlague(boss, e, 1);
            fx(dim, P.ember, up(e.location, 1));
        }
        // the crescent of burning ground
        const burning = [];
        for (const [a, r] of [[-45, 0.5], [-15, 0.5], [15, 0.5], [45, 0.5], [-30, 0.82], [0, 0.82], [30, 0.82]]) {
            const p = add(origin, rotateY(dir, a), radius * r);
            burning.push(p);
            fx(dim, P.firePatch, up(p, 0.05), { radius: 1.1, duration: 3 });
        }
        burnPoints(boss, burning, 1.3, 60, 1.5);
    });
}

// Field of Souls: the scythe is stabbed into the earth and rows of soul wheat sprout around the
// target, every other furrow left bare. Then the Harvester reaps the field: every planted row bursts
// into soul fire. Stand in a bare furrow. Sprout at tick 13, harvest at tick 34.
function castField(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_field");
    const center = { ...target.location };
    const along = flatDir(boss.location, center);
    const across = rightOf(along);
    const half = s.phase >= 3 ? 7 : 6;
    const lane = 1.6; // planted and bare furrows alternate
    const rows = [];
    for (let k = -4; k <= 4; k += 2) rows.push(k * lane); // the target's own furrow is always planted
    sound(dim, "mob.evocation_illager.prepare_attack", boss.location, 0.6);
    later(13, () => {
        if (!alive(boss)) return;
        sound(dim, "dig.grass", center, 0.6);
        sound(dim, "block.sweet_berry_bush.place", center, 0.7);
        for (const off of rows) {
            for (let a = -half; a <= half + 0.01; a += 1.2) {
                fx(dim, P.wheat, up(add(add(center, across, off), along, a), 0.02), { life: 1.15 });
            }
        }
    });
    later(34, () => {
        if (!alive(boss)) return;
        sound(dim, "mob.wither.shoot", center, 0.8);
        sound(dim, "mob.blaze.shoot", center, 0.7);
        for (const off of rows) {
            for (let a = -half; a <= half + 0.01; a += 2.4) fx(dim, P.wheatBurst, up(add(add(center, across, off), along, a), 0.3));
        }
        for (const e of victims(boss, center, half + 4)) {
            const dx = e.location.x - center.x, dz = e.location.z - center.z;
            const a = dx * along.x + dz * along.z;
            const c = dx * across.x + dz * across.z;
            if (Math.abs(a) > half + 0.6 || Math.abs(e.location.y - center.y) > 2.5) continue;
            if (!rows.some((off) => Math.abs(c - off) <= lane / 2 + 0.2)) continue;
            hurt(boss, e, 11, "magic");
            addPlague(boss, e, 1);
            try { e.applyKnockback(0, 0, 0, 0.45); } catch {}
            fx(dim, P.ember, chest(e));
        }
    });
}

// Will-o'-the-Wisps (ma troi): the lantern hand calls 3 / 4 / 5 ghost fires that drift after the
// target for up to 7 s, each a little faster than the last. Walking outpaces the slow ones, sprinting
// outpaces them all; touching one makes it burst. Gather at tick 11, chase from tick 15.
function castWisps(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_wisps");
    sound(dim, "mob.evocation_illager.prepare_summon", boss.location, 0.8);
    const count = s.phase + 2;
    const base = flatDir(boss.location, target.location);
    const wisps = [];
    const burst = (w, e) => {
        w.alive = false;
        fx(dim, P.wheatBurst, w.pos);
        fx(dim, P.ember, w.pos);
        sound(dim, "mob.ghast.fireball", w.pos, 1.3, 0.7);
        if (!e) return;
        hurt(boss, e, 6, "magic");
        effect(e, "darkness", 40, 0);
        addPlague(boss, e, 1);
    };
    const step = (tick) => {
        if (tick > 155 || !alive(boss)) {
            for (const w of wisps) if (w.alive) { w.alive = false; fx(dim, P.smoke, w.pos); }
            return;
        }
        const goal = alive(target) ? chest(target) : undefined;
        for (const w of wisps) {
            if (!w.alive) continue;
            if (tick >= 15 && goal) {
                const d = { x: goal.x - w.pos.x, y: goal.y - w.pos.y, z: goal.z - w.pos.z };
                const len = Math.hypot(d.x, d.y, d.z) || 1;
                w.vel = { x: w.vel.x * 0.75 + (d.x / len) * w.speed * 0.25, y: w.vel.y * 0.75 + (d.y / len) * w.speed * 0.25, z: w.vel.z * 0.75 + (d.z / len) * w.speed * 0.25 };
            } else {
                w.vel = { x: w.vel.x * 0.8, y: w.vel.y * 0.8, z: w.vel.z * 0.8 };
            }
            w.pos = add(w.pos, w.vel, 2);
            fx(dim, P.willo, w.pos);
            for (const e of victims(boss, w.pos, 2)) {
                if (dist3(w.pos, chest(e)) > 1.2) continue;
                burst(w, e);
                break;
            }
        }
        if (wisps.some((w) => w.alive)) later(2, () => step(tick + 2));
    };
    later(11, () => {
        if (!alive(boss)) return;
        const hand = add(up(boss.location, 3.3), rightOf(base), -0.9);
        for (let i = 0; i < count; i++) {
            const dir = rotateY(base, (i - (count - 1) / 2) * 35);
            wisps.push({ pos: add(hand, dir, 0.6), vel: { x: dir.x * 0.25, y: 0.04, z: dir.z * 0.25 }, speed: 0.19 + 0.02 * i, alive: true });
        }
        sound(dim, "mob.allay.idle", hand, 0.6);
        step(11);
    });
}

// Candles of the Dead: soul candles light up in a ring around the target (3 / 4 / 5). While they
// burn, each one gives back 10% of the damage the Harvester takes. A player snuffs a candle by
// standing on it for 1 s. After 7 s every candle still lit erupts and feeds the Harvester.
// Candles at tick 14, eruption at tick 154.
function castCandles(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_candles");
    sound(dim, "mob.evocation_illager.prepare_summon", boss.location, 0.6);
    const count = 2 + s.phase;
    const center = { ...target.location };
    const a0 = Math.random() * 360;
    const candles = [];
    for (let i = 0; i < count; i++) {
        candles.push({ pos: add(center, rotateY({ x: 0, y: 0, z: 1 }, a0 + (i * 360) / count), 5.5), lit: true, snuff: 0 });
    }
    const START = 14, LIFE = 140;
    const snuff = (c) => {
        c.lit = false;
        s.candlesLit = Math.max(0, (s.candlesLit ?? 0) - 1);
        fx(dim, P.smoke, up(c.pos, 0.6));
        fx(dim, P.wisp, up(c.pos, 0.8));
        sound(dim, "random.fizz", c.pos, 1.2, 0.8);
    };
    later(START, () => {
        if (!alive(boss)) return;
        s.candlesLit = (s.candlesLit ?? 0) + count;
        for (const c of candles) fx(dim, P.flames, up(c.pos, 0.3));
        sound(dim, "fire.ignite", center, 0.7);
    });
    for (let t = START; t < START + LIFE; t += 10) {
        later(t, () => {
            if (!alive(boss)) return;
            const frame = Math.min(5, Math.floor(((t - START) / LIFE) * 6));
            for (const c of candles) {
                if (!c.lit) continue;
                fx(dim, P.candle, up(c.pos, 0.3), { frame, life: 0.55 });
                fx(dim, P.ringWarn, up(c.pos, 0.07), color(SOUL, { radius: 2.5, life: 0.55 }));
                const standing = players(dim, c.pos, 1.8).some((p) => flatDist(p.location, c.pos) <= 1.3 && Math.abs(p.location.y - c.pos.y) < 2);
                c.snuff = standing ? c.snuff + 10 : 0;
                if (c.snuff >= 20) snuff(c);
            }
        });
    }
    later(START + LIFE, () => {
        const lit = candles.filter((c) => c.lit);
        for (const c of lit) {
            c.lit = false;
            s.candlesLit = Math.max(0, (s.candlesLit ?? 0) - 1);
        }
        if (!alive(boss) || lit.length === 0) return;
        sound(dim, "mob.blaze.shoot", center, 0.6);
        for (const c of lit) {
            fx(dim, P.column, c.pos);
            fx(dim, P.flames, up(c.pos, 0.3));
            fx(dim, P.shockwave, up(c.pos, 0.1), color(SOUL, { radius: 2.5, life: 0.5 }));
            fly(dim, P.stream, up(c.pos, 1.2), chest(boss), 0.6);
            for (const e of victims(boss, c.pos, 3.5)) {
                if (flatDist(c.pos, e.location) > 2.5 || Math.abs(e.location.y - c.pos.y) > 2.5) continue;
                hurt(boss, e, 9, "magic");
                addPlague(boss, e, 1);
            }
        }
        const hp = health(boss);
        if (hp) heal(boss, hp.effectiveMax * 0.025 * lit.length);
    });
}

// ─── skills: phase 2 ────────────────────────────────────────────────────────

// Plague Pyre: the plague doctor burns the infection out. A skull and a pyre ring follow the target
// for 1.5 s, then soul fire erupts on it: 8 + 2 per plague stack. The fire spreads: everyone within
// 3.5 blocks of the target burns too and catches 2 plague. The ground keeps burning for 4 s.
// Ignite at tick 30.
function castPyre(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_pyre");
    sound(dim, "mob.evocation_illager.cast_spell", boss.location, 0.5);
    for (let t = 4; t < 30; t += 4) {
        later(t, () => {
            if (!alive(boss) || !alive(target)) return;
            fx(dim, P.mark, up(target.getHeadLocation(), 0.8));
            fx(dim, P.ringWarn, up(target.location, 0.07), color(SOUL, { radius: 3.5, life: 0.25 }));
            if (t % 8 === 0) fx(dim, P.firePatch, up(target.location, 0.05), { radius: 0.6, duration: 0.3 });
        });
    }
    later(30, () => {
        if (!alive(boss) || !alive(target)) return;
        const center = { ...target.location };
        fx(dim, P.column, center);
        fx(dim, P.flames, up(center, 0.3));
        fx(dim, P.shockwave, up(center, 0.1), color(SOUL, { radius: 3.5, life: 0.5 }));
        sound(dim, "mob.ghast.fireball", center, 0.7);
        sound(dim, "fire.ignite", center, 0.8);
        for (const e of victims(boss, center, 4.5)) {
            if (e.id !== target.id && flatDist(center, e.location) > 3.5) continue;
            hurt(boss, e, 8 + 2 * stacksOf(e), "magic");
            addPlague(boss, e, e.id === target.id ? 1 : 2);
            if (e.id !== target.id) fx(dim, P.column, e.location);
        }
        fx(dim, P.firePatch, up(center, 0.05), { radius: 2.2, duration: 4 });
        burnPoints(boss, [center], 2.2, 80, 1.5);
    });
}

// Footsteps of the Dead: for 3 s the Harvester marks where everyone walks with glowing footprints,
// then every footprint ignites at once and burns for 3 s. Don't retrace your steps, don't stand still.
// Footprints from tick 16 to 76, ignition at tick 82.
function castTrail(boss, s, target) {
    const dim = boss.dimension;
    play(boss, "skill_trail");
    sound(dim, "mob.evocation_illager.cast_spell", boss.location, 0.4);
    const prints = [];
    for (let t = 16; t <= 76; t += 6) {
        later(t, () => {
            if (!alive(boss)) return;
            for (const e of targetFirst(target, victims(boss, boss.location, 22))) {
                const pos = { ...e.location };
                if (prints.some((p) => flatDist(p, pos) < 0.8 && Math.abs(p.y - pos.y) < 1)) continue;
                prints.push(pos);
                let yaw = 0;
                try { yaw = e.getRotation().y; } catch {}
                fx(dim, P.footprint, up(pos, 0.04), { life: (82 - t) / 20 + 0.3, spin: yaw });
            }
            if (t === 16 || t === 46) sound(dim, "mob.warden.heartbeat", boss.location, 0.8);
        });
    }
    later(82, () => {
        if (!alive(boss) || prints.length === 0) return;
        sound(dim, "mob.blaze.shoot", boss.location, 0.6);
        for (const p of prints) fx(dim, P.firePatch, up(p, 0.05), { radius: 0.55, duration: 3 });
        burnPoints(boss, prints, 0.9, 60, 2, true);
    });
}

// Buried Alive: a coffin opens on the ground under the target (2 x 4 blocks, leading its movement).
// 1 s later the lid slams: anyone inside is buried — held in place in the dark for 1.5 s while the
// coffin burns with soul fire. Lid at tick 20.
function castCoffin(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_coffin");
    let v = { x: 0, z: 0 };
    try { v = target.getVelocity(); } catch {}
    const center = { x: target.location.x + v.x * 6, y: target.location.y, z: target.location.z + v.z * 6 };
    const along = flatDir(boss.location, center);
    // the decal only lies along the world axes: long side on z (spin 0) or on x (spin 90)
    const longZ = Math.abs(along.z) >= Math.abs(along.x);
    const hx = longZ ? 1 : 2, hz = longZ ? 2 : 1;
    fx(dim, P.coffin, up(center, 0.06), { life: 2.6, spin: longZ ? 0 : 90 });
    sound(dim, "random.chestopen", center, 0.6);
    const inside = (e) => Math.abs(e.location.x - center.x) <= hx + 0.3 && Math.abs(e.location.z - center.z) <= hz + 0.3
        && Math.abs(e.location.y - center.y) < 2;
    later(20, () => {
        if (!alive(boss)) return;
        sound(dim, "random.chestclosed", center, 0.5);
        sound(dim, "random.anvil_land", center, 0.5, 0.6);
        fx(dim, P.ash, up(center, 0.1));
        const edge = [];
        for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) edge.push({ x: center.x + sx * hx, y: center.y, z: center.z + sz * hz });
        for (const p of edge) fx(dim, P.firePatch, up(p, 0.05), { radius: 0.6, duration: 1.6 });
        fx(dim, P.flames, up(center, 0.3));
        const buried = victims(boss, center, 5).filter(inside);
        for (const e of buried) {
            hurt(boss, e, 6, "magic");
            effect(e, "slowness", 30, 10);
            effect(e, "darkness", 60, 0);
            addPlague(boss, e, 2);
        }
        for (let t = 10; t <= 30; t += 10) {
            later(t, () => {
                if (!alive(boss)) return;
                for (const e of buried) if (alive(e) && inside(e)) hurt(boss, e, 3, "fire");
            });
        }
    });
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
                fx(dim, P.column, e.location);
                sound(dim, "mob.wither.shoot", e.location, 0.5);
                hurt(boss, e, 6 + 3 * stacks, "magic");
                effect(e, "wither", 40, 1);
            });
        }
    });
}

// Danse Macabre: five hooded dancers carrying soul candles circle the target and close in over 3 s,
// one place in the ring of six left empty. Touching a dancer burns; when the ring closes they burst.
// Slip out through the gap (or between two dancers) early. Dancers at tick 8, burst at tick 68.
function castDanse(boss, s, target) {
    const dim = boss.dimension;
    face(boss, target);
    play(boss, "skill_danse");
    const notes = [1.0, 1.2, 0.9, 1.35];
    for (let i = 0; i < 4; i++) later(i * 16, () => sound(dim, "block.bell.hit", boss.location, notes[i], 0.5));
    const DANCE = 60, r0 = 7, shrink = r0 / (DANCE / 20);
    later(8, () => {
        if (!alive(boss)) return;
        const center = alive(target) ? { ...target.location } : { ...boss.location };
        const w = Math.random() < 0.5 ? 60 : -60; // degrees per second
        const gap = Math.floor(Math.random() * 6);
        const a0 = Math.random() * 360;
        const angles = [];
        for (let k = 0; k < 6; k++) if (k !== gap) angles.push(a0 + k * 60);
        for (const a of angles) fx(dim, P.dancer, center, { a0: a, r0, w, shrink, life: DANCE / 20 + 0.05 });
        fx(dim, P.ringWarn, up(center, 0.07), color(SOUL, { radius: r0, life: DANCE / 20 }));
        sound(dim, "mob.endermen.portal", center, 0.6);
        const touched = new Map();
        for (let t = 2; t <= DANCE; t += 2) {
            later(t, () => {
                if (!alive(boss)) return;
                const sec = t / 20;
                const r = Math.max(r0 - sec * shrink, 0);
                const spots = angles.map((a) => {
                    const rad = ((a + w * sec) * Math.PI) / 180;
                    return { x: center.x + Math.cos(rad) * r, y: center.y, z: center.z + Math.sin(rad) * r };
                });
                if (t % 6 === 0) for (const p of spots) fx(dim, P.eyeGlow, up(p, 2));
                for (const e of victims(boss, center, r + 2)) {
                    if (Math.abs(e.location.y - center.y) > 2.5) continue;
                    spots.forEach((p, i) => {
                        const key = e.id + ":" + i;
                        if (flatDist(p, e.location) > 1.1 || t - (touched.get(key) ?? -99) < 10) return;
                        touched.set(key, t);
                        hurt(boss, e, 5, "magic");
                        effect(e, "slowness", 20, 1);
                        addPlague(boss, e, 1);
                        fx(dim, P.ember, chest(e));
                    });
                }
            });
        }
        later(DANCE, () => {
            if (!alive(boss)) return;
            fx(dim, P.column, center);
            fx(dim, P.souls, up(center, 1));
            fx(dim, P.shockwave, up(center, 0.1), color(SOUL, { radius: 3, life: 0.5 }));
            sound(dim, "mob.wither.shoot", center, 0.7);
            for (const e of victims(boss, center, 3.5)) {
                if (flatDist(center, e.location) > 2.5 || Math.abs(e.location.y - center.y) > 2.5) continue;
                hurt(boss, e, 12, "magic");
                effect(e, "wither", 60, 1);
                addPlague(boss, e, 1);
            }
        });
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
        fx(dim, P.ringWarn, up(spot, 0.07), color(SOUL, { radius: 2.5, life: 3.6 }));
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

// Final Harvest: the whole ring between 3 and 11.5 blocks sprouts soul wheat while the scythe circles
// overhead, then a full spin reaps it all. Safe right next to him or beyond the wheat. Hit at tick 49.
function castUltimate(boss, s) {
    const dim = boss.dimension;
    play(boss, "skill_ultimate");
    const center = { ...boss.location };
    const inner = 3, outer = 11.5;
    for (const e of victims(boss, center, 40)) title(e, "§4§l☠ FINAL HARVEST ☠", "§7Get close... or get far away", 50);
    sound(dim, "mob.wither.ambient", center, 0.5);
    fx(dim, P.runes, up(center, 0.05), color(GOLD, { radius: outer, life: 2.5 }));
    fx(dim, P.ringWarn, up(center, 0.07), color(SOUL, { radius: inner, life: 2.5 }));
    fx(dim, P.ringWarn, up(center, 0.08), color(GOLD, { radius: outer, life: 2.5 }));
    later(4, () => {
        for (let r = 4; r <= outer - 0.4; r += 1.5) {
            const n = Math.round((2 * Math.PI * r) / 1.7);
            const off = Math.random() * 360;
            for (let i = 0; i < n; i++) {
                fx(dim, P.wheat, up(add(center, rotateY({ x: 0, y: 0, z: 1 }, off + (i * 360) / n), r), 0.02), { life: 2.3 });
            }
        }
        sound(dim, "block.sweet_berry_bush.place", center, 0.6);
    });
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
        fx(dim, P.shockwave, up(center, 0.1), color(SOUL, { radius: outer + 1, life: 0.5 }));
        for (let i = 0; i < 20; i++) {
            const a = (i / 20) * 360, r = inner + 1 + ((i * 7) % 8);
            fx(dim, P.wheatBurst, up(add(center, rotateY({ x: 0, y: 0, z: 1 }, a), r), 0.3));
        }
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
    reap: castReap, field: castField, wisps: castWisps, candles: castCandles,
    pyre: castPyre, trail: castTrail, coffin: castCoffin,
    sentence: castSentence, danse: castDanse, blackdeath: castBlackDeath, ultimate: castUltimate
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
    fx(dim, P.runes, up(center, 0.05), color(phase === 3 ? GOLD : PLAGUE, { radius: 6, life: 2.2 }));
    later(20, () => {
        fx(dim, P.shockwave, up(center, 0.1), color(phase === 3 ? SOUL : PLAGUE, { radius: 10, life: 0.7 }));
        fx(dim, phase === 3 ? P.souls : P.miasma, up(center, 2));
        fx(dim, P.firePatch, up(center, 0.05), { radius: 3.5, duration: 1.5 });
        fx(dim, P.column, center);
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
    fx(boss.dimension, P.runes, up(boss.location, 0.05), color(GOLD, { radius: 8, life: 2 }));
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
        target: undefined, targetTick: 0, foes: new Map(), lastBlink: 0, lastMelee: 0, candlesLit: 0
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
        let weight = cfg.weight;
        if (name === s.lastSkill) weight *= 0.25;
        if (cfg.phase === s.phase && s.phase > 1) weight *= 1.5; // favour the new phase's skills
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
        fx(dim, P.runes, up(at, 0.05), color(SOUL, { radius: 4, life: 2.6 }));
        fx(dim, P.firePatch, up(at, 0.05), { radius: 2.4, duration: 2.4 });
        fx(dim, P.ash, up(at, 0.1));
        later(12, () => fx(dim, P.ash, up(at, 0.1)));
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
        // Candles of the Dead: each lit candle gives back 10% of the damage taken
        if (s.candlesLit > 0 && e.damage > 0) heal(boss, e.damage * Math.min(0.5, 0.1 * s.candlesLit));
        // Ember Retreat: 7% when struck, at most every 8 s, never mid-cast: he burns away and reforms
        // 5 blocks back from the attacker; the spot he left keeps burning for 3 s
        if (t < s.busyUntil || t - s.lastBlink < 160 || Math.random() > 0.07) return;
        s.lastBlink = t;
        s.busyUntil = Math.max(s.busyUntil, t + 12);
        const dim = boss.dimension;
        const from = { ...boss.location };
        root(boss, 10);
        play(boss, "skill_vanish", 0.05);
        fx(dim, P.flames, up(from, 0.3));
        sound(dim, "mob.blaze.breathe", from, 0.8);
        later(9, () => {
            if (!alive(boss)) return;
            const away = alive(attacker) ? flatDir(attacker.location, from) : { x: 0, y: 0, z: 1 };
            for (const d of [away, rotateY(away, 50), rotateY(away, -50)]) {
                try {
                    if (boss.tryTeleport(add(from, d, 5), { checkForBlocks: true, facingLocation: alive(attacker) ? attacker.location : from })) break;
                } catch {}
            }
            fx(dim, P.flames, up(boss.location, 0.3));
            fx(dim, P.smoke, up(boss.location, 1.5));
            fx(dim, P.firePatch, up(from, 0.05), { radius: 1.6, duration: 3 });
            burnPoints(boss, [from], 1.6, 60, 1.5);
        });
    } catch {}
});

// ─── loot ───────────────────────────────────────────────────────────────────

// The Harvester's drops, thrown out of the soul pillar when he dies. Dropped by the script (the entity
// has no loot table any more): the old AddOns Maker table did not load in game, so nothing dropped.
const LOOT = [
    { item: "pa:reaper_skull", min: 1, max: 1 },
    { item: "pa:soul", min: 8, max: 12 }
];

function dropLoot(dim, loc) {
    const at = up(loc, 1.2);
    for (const { item, min, max } of LOOT) {
        const count = min + Math.floor(Math.random() * (max - min + 1));
        for (let i = 0; i < count; i++) {
            try {
                const drop = dim.spawnItem(new ItemStack(item, 1), at);
                const a = Math.random() * Math.PI * 2, force = 0.12 + Math.random() * 0.15;
                try { drop.applyImpulse({ x: Math.cos(a) * force, y: 0.3 + Math.random() * 0.15, z: Math.sin(a) * force }); } catch {}
            } catch {}
        }
    }
    fx(dim, P.flames, up(loc, 0.5));
    fx(dim, P.column, loc);
    sound(dim, "random.levelup", loc, 0.7, 0.8);
}

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
        later(20, () => dropLoot(dim, loc)); // after the death animation
        fx(dim, P.beak, up(loc, 3.5));
        fx(dim, P.shockwave, up(loc, 0.1), color(SOUL, { radius: 8, life: 0.8 }));
        later(20, () => fx(dim, P.souls, up(loc, 2.5)));
        later(40, () => fx(dim, P.souls, up(loc, 3.5)));
        sound(dim, "mob.wither.death", loc, 0.8);
        for (const p of players(dim, loc, 60)) {
            plague.delete(p.id);
            title(p, "§6§l☠ THE HARVESTER FALLS ☠", "§7The plague lifts. The souls are free.", 70);
        }
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
    console.warn("[Harvester Boss v5] loaded: 11 soul-fire skills, 3 phases, targets whatever it fights.");
});

// Test hook for tools/simulate.mjs (the game never calls it): cast one skill now at `target`
// and keep the AI from casting anything else for a while.
export function castForTest(boss, name, target) {
    const s = initState(boss);
    s.busyUntil = now() + CONFIG.skills[name].lock;
    s.nextCast = now() + 1000;
    CASTS[name](boss, s, target);
}
