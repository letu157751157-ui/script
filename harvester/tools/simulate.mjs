// Headless smoke test for the Harvester scripts.
//
//   node harvester/tools/simulate.mjs
//
// Runs scripts/harvester.js and scripts/harvester_scythe.js against a mock of
// @minecraft/server through a full boss fight (spawn -> phase 2 -> phase 3 -> enrage -> death)
// and reports:
//   * exceptions swallowed by the scripts' try/catch blocks,
//   * particles spawned that don't exist or miss Molang variables they read,
//   * animations played that aren't defined in the resource pack.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const BP = path.join(ROOT, "TheHarvesterBP");
const RP = path.join(ROOT, "TheHarvesterRP");

// ---------------------------------------------------------------- resource pack facts
const BUILTIN = new Set(["particle_age", "particle_lifetime", "particle_random_1", "particle_random_2",
    "particle_random_3", "particle_random_4", "emitter_age", "emitter_lifetime", "emitter_random_1",
    "emitter_random_2", "emitter_random_3", "emitter_random_4"]);
const particles = {};
for (const file of fs.readdirSync(path.join(RP, "particles"))) {
    const text = fs.readFileSync(path.join(RP, "particles", file), "utf8");
    const data = JSON.parse(text);
    const id = data.particle_effect.description.identifier;
    const vars = new Set([...text.matchAll(/\b(?:v|variable)\.([a-z_0-9]+)/g)].map((m) => m[1]).filter((v) => !BUILTIN.has(v)));
    particles[id] = vars;
}
const animations = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(RP, "animations/pa_harvester.animation.json"), "utf8")).animations));
for (const file of fs.readdirSync(path.join(RP, "animations"))) {
    for (const id of Object.keys(JSON.parse(fs.readFileSync(path.join(RP, "animations", file), "utf8")).animations)) animations.add(id);
}

// ---------------------------------------------------------------- mock @minecraft/server
const problems = new Map();
function problem(kind, detail) {
    const key = kind + ": " + detail;
    problems.set(key, (problems.get(key) ?? 0) + 1);
}
const stats = { particles: {}, animations: {}, sounds: 0, damage: 0, casts: {} };

const mock = `
export const __hooks = globalThis.__harvesterMock;
const H = __hooks;
export class MolangVariableMap {
  constructor() { this.vars = {}; }
  setFloat(name, value) { if (!Number.isFinite(value)) H.problem("molang", name + " = " + value); this.vars[name.replace(/^variable\\./, "")] = value; }
  setColorRGB(name, c) { for (const k of ["r","g","b"]) this.vars[name.replace(/^variable\\./, "") + "." + k] = c[k === "r" ? "red" : k === "g" ? "green" : "blue"]; }
  setSpeedAndDirection(name, speed, d) { const n = name.replace(/^variable\\./, ""); this.vars[n + ".speed"] = speed; }
}
export const system = H.system;
export const world = H.world;
export const EquipmentSlot = { Mainhand: "Mainhand" };
export const GameMode = { creative: "creative", spectator: "spectator", survival: "survival", adventure: "adventure" };
`;

class Signal {
    constructor() { this.subs = []; }
    subscribe(fn) { this.subs.push(fn); return fn; }
    unsubscribe(fn) { this.subs = this.subs.filter((s) => s !== fn); }
    fire(e) { for (const fn of this.subs) fn(e); }
}

let tick = 0;
const timers = [];
const system = {
    get currentTick() { return tick; },
    runTimeout(fn, ticks = 1) { timers.push({ at: tick + Math.max(1, ticks | 0), fn }); return timers.length; },
    runInterval(fn, ticks = 1) { const t = { every: Math.max(1, ticks | 0), at: tick + Math.max(1, ticks | 0), fn }; timers.push(t); return timers.length; },
    run(fn) { timers.push({ at: tick + 1, fn }); },
    clearRun() {},
};

const after = {};
for (const n of ["entitySpawn", "entityHurt", "entityDie", "itemCompleteUse", "entityRemove", "playerLeave",
    "worldInitialize", "itemUse", "entityHitEntity", "playerSpawn"]) after[n] = new Signal();
const before = { playerInteractWithEntity: new Signal(), itemUse: new Signal() };
let readOnly = false; // before-event callbacks run in read-only mode
function fireBefore(signal, e) { readOnly = true; try { signal.fire(e); } finally { readOnly = false; } }
function writable(what) { if (readOnly) throw new Error(what + " can't be called in read-only mode"); }

let nextId = 1;
const entities = new Map();

class MockEntity {
    constructor(typeId, dim, loc, hp = 20) {
        this.id = String(nextId++);
        this.typeId = typeId;
        this.dimension = dim;
        this.location = { ...loc };
        this.hp = hp; this.maxHp = hp;
        this.tags = new Set();
        this.effects = {};
        this.valid = true;
        this.nameTag = "";
        this.velocity = { x: 0, y: 0, z: 0 };
        this.isOnGround = true;
        entities.set(this.id, this);
    }
    isValid() { return this.valid; }
    getComponent(id) {
        if (id === "minecraft:health") {
            const self = this;
            return {
                get currentValue() { return self.hp; }, get effectiveMax() { return self.maxHp; },
                setCurrentValue(v) { writable("setCurrentValue"); if (!Number.isFinite(v)) problem("health", "setCurrentValue " + v); self.hp = Math.min(v, self.maxHp); return true; },
                resetToMaxValue() { self.hp = self.maxHp; },
            };
        }
        if (id === "minecraft:inventory") {
            const self = this;
            return { container: { getItem(slot) { return self.held && slot === self.selectedSlotIndex ? { typeId: self.held } : undefined; } } };
        }
        if (id === "minecraft:equippable") {
            const self = this;
            return { getEquipment() { return self.held ? { typeId: self.held } : undefined; } };
        }
        return undefined;
    }
    addEffect(id, ticks, opts) {
        writable("addEffect");
        if (ticks < 1 || ticks > 20000000) problem("effect", `${id} duration ${ticks}`);
        if (opts && (opts.amplifier < 0 || opts.amplifier > 255)) problem("effect", `${id} amplifier ${opts.amplifier}`);
        this.effects[id] = { until: tick + ticks, amp: opts?.amplifier ?? 0 };
    }
    removeEffect(id) { delete this.effects[id]; return true; }
    getEffect(id) { return this.effects[id]; }
    applyDamage(amount, opts) {
        writable("applyDamage");
        if (!this.valid) throw new Error("InvalidEntity");
        if (!Number.isFinite(amount)) problem("damage", "non-finite " + amount);
        if (this.typeId === "minecraft:player") stats.damage += amount;
        const mitigated = (this.effects.resistance?.until > tick && this.effects.resistance.amp >= 4) ? 0 : amount;
        this.hp -= mitigated;
        world._afterQueue.push(() => after.entityHurt.fire({ hurtEntity: this, damage: amount, damageSource: { cause: opts?.cause ?? "none", damagingEntity: opts?.damagingEntity } }));
        if (this.hp <= 0 && this.valid) this.die(opts?.damagingEntity);
        return true;
    }
    die(killer) {
        this.hp = 0;
        const self = this;
        world._afterQueue.push(() => after.entityDie.fire({ deadEntity: self, damageSource: { cause: "entityAttack", damagingEntity: killer } }));
        world._afterQueue.push(() => {
            if (self.typeId === "minecraft:player") { self.hp = self.maxHp; self.location = { x: 0, y: 64, z: 0 }; return; }
            self.valid = false; entities.delete(self.id);
            after.entityRemove.fire({ removedEntityId: self.id, typeId: self.typeId });
        });
    }
    kill() { this.die(); return true; }
    remove() { this.valid = false; entities.delete(this.id); }
    applyKnockback(x, z, h, v) { if (arguments.length !== 4) problem("api", "applyKnockback expects 4 args in 1.14"); [x, z, h, v].forEach((n) => { if (!Number.isFinite(n)) problem("knockback", "NaN"); }); }
    applyImpulse() {}
    clearVelocity() {}
    getVelocity() { return { ...this.velocity }; }
    getViewDirection() { return { x: Math.sin(this.yaw ?? 0), y: 0, z: Math.cos(this.yaw ?? 0) }; }
    getHeadLocation() { return { x: this.location.x, y: this.location.y + 1.6, z: this.location.z }; }
    getRotation() { return { x: 0, y: 0 }; }
    teleport(loc, opts) {
        if (!this.valid) throw new Error("InvalidEntity");
        for (const k of ["x", "y", "z"]) if (!Number.isFinite(loc[k])) problem("teleport", "NaN location");
        if (opts?.facingLocation) for (const k of ["x", "y", "z"]) if (!Number.isFinite(opts.facingLocation[k])) problem("teleport", "NaN facing");
        this.location = { ...loc };
    }
    tryTeleport(loc, opts) { this.teleport(loc, opts); return Math.random() > 0.3; }
    playAnimation(name, opts) {
        if (!animations.has(name)) problem("animation", "missing " + name);
        stats.animations[name] = (stats.animations[name] ?? 0) + 1;
        const short = name.replace("animation.pa_harvester.", "");
        if (short.startsWith("skill_")) stats.casts[short] = (stats.casts[short] ?? 0) + 1;
    }
    addTag(t) { this.tags.add(t); return true; }
    removeTag(t) { return this.tags.delete(t); }
    hasTag(t) { return this.tags.has(t); }
    getTags() { return [...this.tags]; }
    triggerEvent() {}
    runCommand() { return { successCount: 1 }; }
    getDynamicProperty() { return undefined; }
    setDynamicProperty() {}
    getProperty() { return undefined; }
    setProperty() {}
}

class MockPlayer extends MockEntity {
    constructor(name, dim, loc) {
        super("minecraft:player", dim, loc, 20);
        this.name = name;
        this.selectedSlotIndex = 0;
        this.gameMode = "survival";
        this.onScreenDisplay = {
            setTitle(t, o) { if (o && (o.fadeInDuration === undefined || o.stayDuration === undefined || o.fadeOutDuration === undefined)) problem("api", "setTitle options need fadeIn/stay/fadeOut in 1.14"); },
            updateSubtitle() {}, setActionBar() {},
        };
    }
    sendMessage() {}
    playSound() { stats.sounds++; }
    getGameMode() { return this.gameMode; }
}

function matches(e, o, dim) {
    if (e.dimension !== dim || !e.valid) return false;
    if (o.type && e.typeId !== o.type) return false;
    if (o.excludeTypes && o.excludeTypes.includes(e.typeId)) return false;
    if (o.tags && !o.tags.every((t) => e.tags.has(t))) return false;
    if (o.excludeGameModes && e.gameMode && o.excludeGameModes.includes(e.gameMode)) return false;
    if (o.location && o.maxDistance !== undefined) {
        const d = Math.hypot(e.location.x - o.location.x, e.location.y - o.location.y, e.location.z - o.location.z);
        if (d > o.maxDistance) return false;
    }
    return true;
}

function makeDim(id) {
    const dim = {
        id: "minecraft:" + id,
        getEntities(o = {}) {
            for (const k of ["x", "y", "z"]) if (o.location && !Number.isFinite(o.location[k])) problem("query", "NaN location");
            return [...entities.values()].filter((e) => matches(e, o, dim));
        },
        getPlayers(o = {}) { return dim.getEntities({ ...o, type: "minecraft:player" }); },
        spawnParticle(pid, loc, map) {
            stats.particles[pid] = (stats.particles[pid] ?? 0) + 1;
            if (!particles[pid]) { if (pid.startsWith("harvester:")) problem("particle", "missing " + pid); return; }
            for (const k of ["x", "y", "z"]) if (!Number.isFinite(loc[k])) problem("particle", pid + " at NaN");
            const given = map ? Object.keys(map.vars) : [];
            for (const v of particles[pid]) if (!given.includes(v)) problem("particle", `${pid} reads v.${v} but the script did not set it`);
        },
        playSound(sid, loc, opts) { stats.sounds++; for (const k of ["x", "y", "z"]) if (!Number.isFinite(loc[k])) problem("sound", "NaN"); },
        spawnEntity(type, loc) { const e = new MockEntity(type, dim, loc, 20); world._afterQueue.push(() => after.entitySpawn.fire({ entity: e, cause: "Spawned" })); return e; },
        getBlock() { return { isAir: true, isLiquid: false, typeId: "minecraft:air" }; },
        getTopmostBlock() { return undefined; },
        runCommand() { return { successCount: 1 }; },
    };
    return dim;
}

const dims = { overworld: makeDim("overworld"), nether: makeDim("nether"), the_end: makeDim("the_end") };
const world = {
    _afterQueue: [],
    afterEvents: after,
    beforeEvents: before,
    getDimension(id) { return dims[id.replace("minecraft:", "")]; },
    getAllPlayers() { return [...entities.values()].filter((e) => e.typeId === "minecraft:player"); },
    getPlayers() { return world.getAllPlayers(); },
    getEntity(id) { return entities.get(id); },
    sendMessage() {},
    getDynamicProperty() { return undefined; },
    setDynamicProperty() {},
};

globalThis.__harvesterMock = { system, world, problem };

// ---------------------------------------------------------------- load the scripts (instrumented copy)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "harvester-sim-"));
fs.writeFileSync(path.join(tmp, "package.json"), '{"type":"module"}');
fs.mkdirSync(path.join(tmp, "node_modules/@minecraft/server"), { recursive: true });
fs.writeFileSync(path.join(tmp, "node_modules/@minecraft/server/package.json"), '{"name":"@minecraft/server","type":"module","main":"index.js"}');
fs.writeFileSync(path.join(tmp, "node_modules/@minecraft/server/index.js"), mock);
for (const file of ["harvester.js", "harvester_scythe.js"]) {
    let src = fs.readFileSync(path.join(BP, "scripts", file), "utf8");
    // report everything the scripts' catch blocks would swallow
    src = src.replace(/from "\.\/harvester"/g, 'from "./harvester.js"');
    src = src.replace(/catch\s*\{/g, "catch (__e) { globalThis.__harvesterMock.problem('swallowed', '" + file + ": ' + (__e && __e.stack ? __e.stack.split('\\n').slice(0, 2).join(' | ') : __e));");
    fs.writeFileSync(path.join(tmp, file), src);
}
await import(pathToFileURL(path.join(tmp, "harvester.js")));
await import(pathToFileURL(path.join(tmp, "harvester_scythe.js")));

function flush() {
    while (world._afterQueue.length) world._afterQueue.shift()();
}

function step() {
    tick++;
    const due = timers.filter((t) => t.at <= tick);
    for (const t of due) {
        t.fn();
        if (t.every) t.at = tick + t.every; else timers.splice(timers.indexOf(t), 1);
    }
    flush();
}

// ---------------------------------------------------------------- scenario
after.worldInitialize.fire({});
const ow = dims.overworld;
const boss = new MockEntity("pa:harvester", ow, { x: 0, y: 64, z: 0 }, 600);
after.entitySpawn.fire({ entity: boss, cause: "Spawned" });
const heroes = [
    new MockPlayer("Near", ow, { x: 3, y: 64, z: 2 }),
    new MockPlayer("Mid", ow, { x: -8, y: 64, z: 5 }),
    new MockPlayer("Far", ow, { x: 14, y: 64, z: -10 }),
];
heroes[0].held = "pa:harvester_scythe";
const creative = new MockPlayer("Builder", ow, { x: 2, y: 64, z: 0 });
creative.gameMode = "creative";

const TOTAL = 20 * 60 * 10;
for (let i = 0; i < TOTAL && boss.valid; i++) {
    // players wander around the boss, sometimes jumping
    for (const [k, p] of heroes.entries()) {
        const a = tick / (40 + k * 17) + k * 2;
        const r = [3, 8, 14][k];
        p.location = { x: boss.location.x + Math.cos(a) * r, y: 64 + (tick % 23 < 6 ? 0.8 : 0), z: boss.location.z + Math.sin(a) * r };
        p.isOnGround = tick % 23 >= 6;
        p.velocity = { x: -Math.sin(a) * 0.2, y: 0, z: Math.cos(a) * 0.2 };
        p.yaw = a;
        if (p.hp <= 0) p.hp = p.maxHp;
        if (p.hp < 8) p.hp = 20; // potion
    }
    // players chip at the boss: phase 2 around 2.5 min, phase 3 around 4 min, enrage at 5 min
    if (tick % 20 === 0 && tick > 100) {
        const dmg = tick < 20 * 330 ? 1.9 : 12;
        boss.applyDamage(dmg, { cause: "entityAttack", damagingEntity: heroes[tick % 3] });
    }
    // the boss hits someone in melee now and then
    if (tick % 57 === 0) heroes[0].applyDamage(3, { cause: "entityAttack", damagingEntity: boss });
    // scythe skills
    if (tick % 300 === 10) after.itemUse.fire({ source: heroes[0], itemStack: { typeId: "pa:harvester_scythe" } });
    if (tick % 400 === 20) {
        const ev = { player: heroes[0], target: boss, cancel: false, itemStack: { typeId: "pa:harvester_scythe" } };
        fireBefore(before.playerInteractWithEntity, ev);
    }
    if (process.env.SIM_DEBUG && tick % 600 === 0) console.log("t", tick / 20, "boss hp", boss.hp.toFixed(1), "name", boss.nameTag, "effects", Object.keys(boss.effects).filter((k) => boss.effects[k].until > tick).join(","));
    if (tick === 20 * 100) after.itemCompleteUse.fire({ source: heroes[1], itemStack: { typeId: "minecraft:milk_bucket" }, useDuration: 32 });
    step();
}
for (let i = 0; i < 200; i++) step(); // let death effects play out
const firstDefeated = !boss.valid;

// scenario 2: a boss already in phase 3 (exercises Death Sentence / Black Death / Final Harvest)
const boss2 = new MockEntity("pa:harvester", ow, { x: 100, y: 64, z: 100 }, 600);
boss2.hp = 150;
after.entitySpawn.fire({ entity: boss2, cause: "Loaded" });
for (let i = 0; i < 20 * 150; i++) {
    for (const [k, p] of heroes.entries()) {
        const a = tick / (30 + k * 11) + k;
        const r = [2, 7, 13][k];
        p.location = { x: boss2.location.x + Math.cos(a) * r, y: 64, z: boss2.location.z + Math.sin(a) * r };
        p.isOnGround = true;
        if (p.hp < 8) p.hp = 20;
    }
    step();
}
boss2.applyDamage(1000, { cause: "entityAttack", damagingEntity: heroes[0] });
const lonely = new MockEntity("pa:harvester", ow, { x: -400, y: 64, z: -400 }, 600);
for (let i = 0; i < 20 * 60 * 6; i++) step();
if (lonely.nameTag.includes("ENRAGED")) problem("scenario", "idle boss enraged before anyone fought it");
for (const p of heroes) p.location = { x: -398, y: 64, z: -398 };
for (let i = 0; i < 40; i++) step();
if (lonely.nameTag.includes("ENRAGED")) problem("scenario", "boss enraged immediately when players arrived");
lonely.remove();
for (let i = 0; i < 100; i++) step();
if (boss2.valid) problem("scenario", "second boss did not die");
after.playerLeave.fire({ playerId: heroes[2].id, playerName: "Far" });
step();

// ---------------------------------------------------------------- report
console.log(`Simulated ${tick} ticks (${(tick / 1200).toFixed(1)} min). First boss ${firstDefeated ? "defeated" : "ALIVE hp=" + boss.hp.toFixed(0)}.`);
if (!firstDefeated) problem("scenario", "first boss survived the scripted damage");
console.log("Skill casts:", JSON.stringify(stats.casts));
console.log("Animations:", Object.keys(stats.animations).length, "distinct;", "particles:", Object.keys(stats.particles).filter((p) => p.startsWith("harvester:")).length, "distinct harvester ids;", "damage dealt to players:", stats.damage.toFixed(0));
const unused = Object.keys(particles).filter((p) => p.startsWith("harvester:") && !stats.particles[p]);
console.log("Particles never spawned by script (animation-only or unused):", unused.join(", ") || "none");
const creativeHurt = creative.hp < creative.maxHp;
if (creativeHurt) problem("targeting", "creative player took damage");
if (problems.size === 0) {
    console.log("OK: no problems found.");
} else {
    console.log("PROBLEMS:");
    for (const [k, n] of problems) console.log(`  x${n}  ${k}`);
    process.exitCode = 1;
}
fs.rmSync(tmp, { recursive: true, force: true });
