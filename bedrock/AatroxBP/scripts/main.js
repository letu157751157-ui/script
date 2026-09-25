// The Darkin Blade — Aatrox skill kit for Minecraft Bedrock (Script API @minecraft/server 2.x)
//
// While holding the blade:
//   Normal attack           Passive  Deathbringer Stance (when ready)
//   Right-click             Q  The Darkin Blade (3 casts)
//   Sprint + attack         E  Umbral Dash (sprint + right-click also works)
//   Sneak + right-click     W  Infernal Chains
//   Sneak + jump            R  World Ender

import { world, system, ItemStack, EquipmentSlot, InputButton, ButtonState, EntityDamageCause, MolangVariableMap } from "@minecraft/server";
import { CONFIG } from "./config.js";

const ITEM_ID = "aatrox:darkin_blade";
const ULT_ITEM_ID = "aatrox:darkin_blade_ult"; // World Ender blade: its attachable adds 3D wings and horns
const isBladeId = (id) => id === ITEM_ID || id === ULT_ITEM_ID;
const TPS = 20;
const SKILLS = ["Q", "E", "W", "R"];

// Custom particles live in the resource pack (AatroxRP/particles)
const P = {
  ember: "aatrox:ember",
  spark: "aatrox:hit_spark",
  blood: "aatrox:blood_burst",
  flash: "aatrox:flash",
  slash: "aatrox:slash",
  mark: "aatrox:ground_mark",
  markSweet: "aatrox:ground_mark_sweet",
  ring: "aatrox:shock_ring",
  chain: "aatrox:chain_link",
  aura: "aatrox:ult_aura",
  lifesteal: "aatrox:lifesteal",
  stun: "minecraft:villager_angry",
  smoke: "aatrox:smoke",
  crack: "aatrox:ground_crack",
  debris: "aatrox:debris",
  pillar: "aatrox:fire_pillar",
  charge: "aatrox:charge",
  afterimage: "aatrox:afterimage",
  chainHead: "aatrox:chain_head",
  bind: "aatrox:bind_circle",
  xSlash: "aatrox:x_slash",
  bloodOrb: "aatrox:blood_orb",
  domain: "aatrox:domain",
  soul: "aatrox:soul",
  lightning: "aatrox:lightning",
  glyph: "aatrox:glyph",
  lavaDrip: "aatrox:lava_drip",
  fear: "aatrox:fear",
  mist: "aatrox:blood_mist",
  fireTrail: "aatrox:fire_trail",
};

const ticks = (seconds) => Math.max(1, Math.round(seconds * TPS));
const now = () => system.currentTick;

// ---------------------------------------------------------------------------
// Per-player state
// ---------------------------------------------------------------------------

const states = new Map(); // player.id -> state
const stunnedUntil = new Map(); // entity.id -> tick
const greeted = new Set();

function getState(player) {
  let state = states.get(player.id);
  if (!state) {
    state = {
      cd: { Q: 0, E: 0, W: 0, R: 0 },
      busyUntil: 0,
      qStage: 1,
      qWindowEnd: 0,
      qToken: 0,
      passiveReadyAt: 0,
      ultUntil: 0,
      lastUse: -100,
    };
    states.set(player.id, state);
  }
  return state;
}

function startCooldown(state, skill) {
  state.cd[skill] = now() + ticks(CONFIG[skill].cooldown);
}

const isUltActive = (state) => now() < state.ultUntil;
const isStunned = (entity) => (stunnedUntil.get(entity.id) ?? 0) > now();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flatUnit(v) {
  const length = Math.hypot(v.x, v.z);
  return length < 1e-4 ? undefined : { x: v.x / length, y: 0, z: v.z / length };
}

const add = (a, b, scale = 1) => ({ x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale });
const horizontalDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function aimDirection(player) {
  return flatUnit(player.getViewDirection()) ?? { x: 0, y: 0, z: 1 };
}

function holdsBlade(player) {
  try {
    const item = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
    return isBladeId(item?.typeId);
  } catch {
    return false;
  }
}

function canAct(player) {
  return player.isValid && holdsBlade(player) && (getHealth(player)?.currentValue ?? 0) > 0;
}

function getHealth(entity) {
  try {
    return entity.getComponent("minecraft:health");
  } catch {
    return undefined;
  }
}

function particle(dimension, id, location, molang) {
  try {
    dimension.spawnParticle(id, location, molang);
  } catch {
    // chunk not loaded or particle missing: ignore
  }
}

function sound(dimension, id, location, pitch = 1) {
  try {
    dimension.playSound(id, location, { pitch, volume: 1 });
  } catch {
    // ignore
  }
}

function particleLine(dimension, id, from, to, spacing = 0.7) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const steps = Math.max(1, Math.floor(distance / spacing));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    particle(dimension, id, {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
    });
  }
}

// Flat shockwave ring on the ground, expanding to `radius`
function shockRing(dimension, center, radius) {
  particle(dimension, P.ring, add(center, { x: 0, y: 0.15, z: 0 }), withRadius(radius));
}

// Blood burst: flash + blood spray
function bloodBurst(dimension, location) {
  particle(dimension, P.flash, location);
  particle(dimension, P.blood, location);
}

function withRadius(radius) {
  const molang = new MolangVariableMap();
  molang.setFloat("variable.radius", radius);
  return molang;
}

// Impact crater: cracked ground + debris + smoke
function crater(dimension, center, radius) {
  particle(dimension, P.crack, add(center, { x: 0, y: 0.06, z: 0 }), withRadius(radius));
  particle(dimension, P.debris, add(center, { x: 0, y: 0.2, z: 0 }));
  particle(dimension, P.smoke, add(center, { x: 0, y: 0.4, z: 0 }));
}

// Camera shake for players (mobs are skipped)
function shake(entity, intensity, seconds) {
  if (entity?.typeId !== "minecraft:player") return;
  try {
    entity.runCommand(`camerashake add @s ${intensity} ${seconds} positional`);
  } catch {
    // ignore
  }
}

// Tint the screen with a color flash (red when transforming)
function flashScreen(player, red, green, blue) {
  try {
    player.camera.fade({ fadeColor: { red, green, blue }, fadeTime: { fadeInTime: 0.05, holdTime: 0.05, fadeOutTime: 0.45 } });
  } catch {
    // ignore
  }
}

// Blood orbs flying from `from` to the player
function bloodOrbs(player, from) {
  const to = add(player.location, { x: 0, y: 1, z: 0 });
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance < 0.5 || distance > 24) return;
  const molang = new MolangVariableMap();
  molang.setFloat("variable.dir_x", dx / distance);
  molang.setFloat("variable.dir_y", dy / distance);
  molang.setFloat("variable.dir_z", dz / distance);
  molang.setFloat("variable.speed", distance / 0.42);
  particle(player.dimension, P.bloodOrb, from, molang);
}

function particleRing(dimension, id, center, radius, count = Math.ceil(radius * 6)) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    particle(dimension, id, { x: center.x + Math.cos(angle) * radius, y: center.y, z: center.z + Math.sin(angle) * radius });
  }
}

// ---------------------------------------------------------------------------
// Targets, damage, crowd control
// ---------------------------------------------------------------------------

function isTarget(player, entity) {
  if (!entity.isValid || entity.id === player.id) return false;
  if (entity.typeId === "minecraft:player" && !CONFIG.pvp) return false;
  const health = getHealth(entity);
  if (!health || health.currentValue <= 0) return false;
  try {
    // Never hit your own pets
    if (entity.getComponent("minecraft:tameable")?.tamedToPlayerId === player.id) return false;
  } catch {
    // ignore
  }
  return true;
}

function getTargetsNear(player, center, radius) {
  return player.dimension
    .getEntities({
      location: center,
      maxDistance: radius,
      excludeTypes: ["minecraft:item", "minecraft:xp_orb"],
      excludeFamilies: ["inanimate"],
    })
    .filter((entity) => isTarget(player, entity));
}

// Targets inside the box in front: `length` long, `width` wide
function getTargetsInBox(player, origin, direction, length, width) {
  const right = { x: -direction.z, z: direction.x };
  return getTargetsNear(player, origin, Math.hypot(length, width / 2) + 1.5).filter((entity) => {
    const dx = entity.location.x - origin.x;
    const dz = entity.location.z - origin.z;
    const dy = entity.location.y - origin.y;
    const along = dx * direction.x + dz * direction.z;
    const side = dx * right.x + dz * right.z;
    return along >= -0.5 && along <= length + 0.5 && Math.abs(side) <= width / 2 + 0.5 && dy > -2.5 && dy < 3;
  });
}

function dealDamage(player, target, amount) {
  if (!target.isValid) return false;
  if (isUltActive(getState(player))) amount *= CONFIG.R.damageMultiplier;
  try {
    const hit = target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
    if (hit) particle(target.dimension, P.spark, add(target.location, { x: 0, y: 1, z: 0 }));
    return hit;
  } catch {
    return false;
  }
}

function heal(player, amount) {
  const health = getHealth(player);
  if (!health || amount <= 0 || health.currentValue <= 0) return;
  if (isUltActive(getState(player))) amount *= CONFIG.R.healMultiplier;
  health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
  if (amount >= 1) particle(player.dimension, P.lifesteal, add(player.location, { x: 0, y: 0.3, z: 0 }));
}

function stun(entity, seconds) {
  if (!entity.isValid) return;
  const duration = ticks(seconds);
  stunnedUntil.set(entity.id, now() + duration);
  try {
    entity.addEffect("slowness", duration, { amplifier: 255, showParticles: false });
  } catch {
    // ignore
  }
  particleRing(entity.dimension, P.stun, add(entity.location, { x: 0, y: 2.2, z: 0 }), 0.5, 4);
}

// Player animation when casting (AatroxRP/animations/aatrox_player.animation.json)
function playAnim(player, name) {
  try {
    player.playAnimation(`animation.aatrox.${name}`, { blendOutTime: 0.12 });
  } catch {
    // ignore
  }
}

function knockback(entity, direction, strength, vertical) {
  try {
    entity.applyKnockback({ x: direction.x * strength, z: direction.z * strength }, vertical);
  } catch {
    // some entities cannot be knocked back
  }
}

// ---------------------------------------------------------------------------
// Passive — Deathbringer Stance
// ---------------------------------------------------------------------------

function isPassiveReady(state) {
  return now() >= state.passiveReadyAt;
}

function consumePassive(state) {
  let cooldown = CONFIG.passive.cooldown;
  if (isUltActive(state)) cooldown *= CONFIG.R.passiveCooldownMultiplier;
  state.passiveReadyAt = now() + ticks(cooldown);
}

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity: player, hitEntity: target }) => {
  if (player.typeId !== "minecraft:player" || !holdsBlade(player) || !isTarget(player, target)) return;
  const state = getState(player);
  if (!isPassiveReady(state)) return;
  consumePassive(state);

  const cfg = CONFIG.passive;
  const maxHealth = getHealth(target)?.effectiveMax ?? 20;
  const bonus = Math.min(cfg.maxBonus, Math.max(cfg.minBonus, maxHealth * cfg.maxHealthPct));
  particle(target.dimension, P.ember, add(target.location, { x: 0, y: 1, z: 0 }));

  // Explode after the normal attack's invulnerability window
  system.runTimeout(() => {
    if (!player.isValid || !target.isValid) return;
    dealDamage(player, target, bonus);
    heal(player, bonus * cfg.healRatio);
    bloodBurst(target.dimension, add(target.location, { x: 0, y: 1, z: 0 }));
    particle(target.dimension, P.xSlash, add(target.location, { x: 0, y: 1, z: 0 }));
    particle(target.dimension, P.mist, add(target.location, { x: 0, y: 1, z: 0 }));
    particle(target.dimension, P.soul, add(target.location, { x: 0, y: 1.2, z: 0 }));
    sound(target.dimension, "random.anvil_land", target.location, 1.6);
    sound(target.dimension, "mob.zombie.woodbreak", target.location, 0.7);
    shake(player, 0.15, 0.15);
    shake(target, 0.25, 0.2);
  }, ticks(cfg.delay));
});

// Lifesteal on all damage dealt while holding the blade
world.afterEvents.entityHurt.subscribe(({ damageSource, damage, hurtEntity }) => {
  const player = damageSource.damagingEntity;
  if (!player || player.typeId !== "minecraft:player" || player.id === hurtEntity.id) return;
  if (!holdsBlade(player)) return;
  heal(player, damage * CONFIG.lifesteal);
  const state = getState(player);
  if (damage * CONFIG.lifesteal >= 0.5 && now() - (state.lastOrb ?? -100) >= 5) {
    state.lastOrb = now();
    bloodOrbs(player, add(hurtEntity.location, { x: 0, y: 1, z: 0 }));
  }
});

// ---------------------------------------------------------------------------
// Q — The Darkin Blade
// ---------------------------------------------------------------------------

function drawQTelegraph(player, cast, direction) {
  const dimension = player.dimension;
  const ground = add(player.location, { x: 0, y: 0.1, z: 0 });

  if (cast.shape === "circle") {
    const center = add(ground, direction, cast.offset);
    // Disc: the outer rim is the sweet spot
    for (let dx = -cast.radius; dx <= cast.radius; dx += 0.8) {
      for (let dz = -cast.radius; dz <= cast.radius; dz += 0.8) {
        const distance = Math.hypot(dx, dz);
        if (distance > cast.radius) continue;
        const id = distance >= cast.radius - cast.sweet ? P.markSweet : P.mark;
        particle(dimension, id, { x: center.x + dx, y: center.y, z: center.z + dz });
      }
    }
    return;
  }

  const right = { x: -direction.z, y: 0, z: direction.x };
  for (let along = 0.6; along <= cast.length; along += 0.8) {
    const isSweet = along >= cast.length - cast.sweet;
    for (let side = -cast.width / 2 + 0.4; side <= cast.width / 2 - 0.39; side += 0.8) {
      const point = add(add(ground, direction, along), right, side);
      particle(dimension, isSweet ? P.markSweet : P.mark, point);
    }
  }
}

function castQ(player, state, direction) {
  const cfg = CONFIG.Q;
  const t = now();
  if (t < state.busyUntil) return;
  if (state.qStage === 1 && t < state.cd.Q) return;

  const stage = state.qStage;
  /** @type {any} */
  let cast = cfg.casts[stage - 1];
  if (isUltActive(state)) {
    const k = CONFIG.R.empowered.qScale;
    cast = { ...cast, empowered: true, length: (cast.length ?? 0) * k, width: (cast.width ?? 0) * k,
      radius: (cast.radius ?? 0) * k, offset: (cast.offset ?? 0) * k, sweet: cast.sweet * k };
  }
  const windup = ticks(cfg.windup);
  state.busyUntil = t + windup + 2;
  const token = ++state.qToken;

  if (stage < cfg.casts.length) {
    const window = windup + ticks(cfg.recastWindow);
    state.qStage = stage + 1;
    state.qWindowEnd = t + window;
    // If the next cast is not used in time, start the cooldown
    system.runTimeout(() => {
      if (state.qToken === token) {
        state.qStage = 1;
        startCooldown(state, "Q");
      }
    }, window);
  } else {
    state.qStage = 1;
    startCooldown(state, "Q");
  }

  try {
    player.addEffect("slowness", windup, { amplifier: 1, showParticles: false });
  } catch {
    // ignore
  }
  sound(player.dimension, "item.trident.throw", player.location, 0.6);
  playAnim(player, `q${stage}`);
  drawQTelegraph(player, cast, direction);
  particle(player.dimension, P.charge, bladeLocation(player));
  system.runTimeout(() => player.isValid && particle(player.dimension, P.charge, bladeLocation(player)), 4);
  system.runTimeout(() => slamQ(player, cast, direction), windup);
}

function slamQ(player, cast, direction) {
  if (!canAct(player)) return;
  const cfg = CONFIG.Q;
  const origin = player.location;
  const dimension = player.dimension;

  let targets;
  let isSweetSpot;
  if (cast.shape === "circle") {
    const center = add(origin, direction, cast.offset);
    targets = getTargetsNear(player, center, cast.radius + 0.5);
    isSweetSpot = (entity) => horizontalDistance(entity.location, center) >= cast.radius - cast.sweet;
    shockRing(dimension, center, cast.radius + 0.5);
    bloodBurst(dimension, add(center, { x: 0, y: 0.5, z: 0 }));
    crater(dimension, center, cast.radius);
    // Fire pillars erupt around the rim (sweet spot)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const at = { x: center.x + Math.cos(angle) * cast.radius, y: center.y, z: center.z + Math.sin(angle) * cast.radius };
      system.runTimeout(() => particle(dimension, P.pillar, at), i);
    }
    system.runTimeout(() => shockRing(dimension, center, cast.radius + 1.5), 3);
    particle(dimension, P.lightning, add(center, { x: 0, y: 1.6, z: 0 }));
    particle(dimension, P.soul, add(center, { x: 0, y: 0.5, z: 0 }));
    shake(player, 0.4, 0.35);
    sound(dimension, "mob.irongolem.throw", center, 0.6);
  } else {
    targets = getTargetsInBox(player, origin, direction, cast.length, cast.width);
    isSweetSpot = (entity) => {
      const along = (entity.location.x - origin.x) * direction.x + (entity.location.z - origin.z) * direction.z;
      return along >= cast.length - cast.sweet;
    };
    for (let along = 1.5; along <= cast.length; along += 1.5) {
      particle(dimension, P.slash, add(add(origin, direction, along), { x: 0, y: 1, z: 0 }));
    }
    const sweetCenter = add(origin, direction, cast.length - cast.sweet / 2);
    particle(dimension, P.flash, add(sweetCenter, { x: 0, y: 0.5, z: 0 }));
    crater(dimension, sweetCenter, 1.1);
    if (cast.empowered) {
      // Transformed: fire pillars erupt along the slash
      for (let along = 1; along <= cast.length; along += 1.3) {
        const at = add(origin, direction, along);
        system.runTimeout(() => particle(dimension, P.pillar, at), Math.round(along));
      }
    }
    // A second, higher slash streak for a thicker swing
    for (let along = 2.25; along <= cast.length; along += 1.5) {
      particle(dimension, P.slash, add(add(origin, direction, along), { x: 0, y: 1.6, z: 0 }));
    }
    shake(player, 0.15, 0.2);
  }
  sound(dimension, "random.explode", origin, 1.4);

  let hitSweetSpot = false;
  for (const target of targets) {
    let damage = cast.damage;
    if (isSweetSpot(target)) {
      hitSweetSpot = true;
      damage *= cfg.sweetMultiplier;
      knockback(target, { x: 0, z: 0 }, 0, cfg.knockup);
      stun(target, cfg.stun);
      bloodBurst(dimension, add(target.location, { x: 0, y: 1, z: 0 }));
      particle(dimension, P.xSlash, add(target.location, { x: 0, y: 1, z: 0 }));
      particle(dimension, P.mist, add(target.location, { x: 0, y: 1, z: 0 }));
      shake(target, 0.3, 0.25);
    }
    dealDamage(player, target, damage);
  }

  const state = getState(player);
  if (hitSweetSpot) {
    shake(player, 0.25, 0.2);
    sound(dimension, "random.anvil_land", origin, 0.8);
  }
  if (hitSweetSpot && !isPassiveReady(state)) {
    state.passiveReadyAt -= ticks(CONFIG.passive.sweetSpotReduction);
  }
}

// ---------------------------------------------------------------------------
// E — Umbral Dash
// ---------------------------------------------------------------------------

function castE(player, state, direction) {
  const cfg = CONFIG.E;
  if (now() < state.cd.E) return;
  startCooldown(state, "E");
  const empowered = isUltActive(state);
  const emp = CONFIG.R.empowered;
  if (empowered) state.cd.E = now() + ticks(cfg.cooldown * emp.eCooldown);
  playAnim(player, "e");
  knockback(player, direction, cfg.strength * (empowered ? emp.eStrength : 1), cfg.vertical);
  sound(player.dimension, "item.trident.riptide_1", player.location, 1.2);

  particle(player.dimension, P.smoke, add(player.location, { x: 0, y: 0.3, z: 0 }));
  particle(player.dimension, P.debris, add(player.location, { x: 0, y: 0.1, z: 0 }));
  const burned = new Set();
  let count = 0;
  const trail = system.runInterval(() => {
    if (!player.isValid || ++count > 7) return system.clearRun(trail);
    if (count % 2 === 1) particle(player.dimension, P.afterimage, add(player.location, { x: 0, y: 1, z: 0 }));
    particle(player.dimension, P.ember, add(player.location, { x: 0, y: 1.1, z: 0 }));
    if (count === 7) particle(player.dimension, P.smoke, add(player.location, { x: 0, y: 0.3, z: 0 }));
    if (empowered) {
      // Transformed: leave a fire trail that burns enemies standing on it
      const at = player.location;
      particle(player.dimension, P.fireTrail, add(at, { x: 0, y: 0.1, z: 0 }));
      for (const target of getTargetsNear(player, at, 1.4)) {
        if (burned.has(target.id)) continue;
        burned.add(target.id);
        dealDamage(player, target, emp.eTrailDamage);
        try {
          target.setOnFire(3, true);
        } catch {
          // ignore
        }
      }
    }
  }, 1);
}

// ---------------------------------------------------------------------------
// W — Infernal Chains
// ---------------------------------------------------------------------------

function isBlocked(dimension, location) {
  try {
    const block = dimension.getBlock(location);
    return block !== undefined && !block.isAir && !block.isLiquid;
  } catch {
    return true;
  }
}

function castW(player, state, direction) {
  const t = now();
  if (t < state.busyUntil || t < state.cd.W) return;
  startCooldown(state, "W");
  state.busyUntil = t + 8;
  playAnim(player, "w");
  const emp = CONFIG.R.empowered;
  const directions = [direction];
  if (isUltActive(state)) {
    // Transformed: fire several chains in a fan, shorter cooldown
    state.cd.W = t + ticks(CONFIG.W.cooldown * emp.wCooldown);
    for (let i = 1; i < emp.wChains; i++) {
      const angle = ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * emp.wSpread * Math.PI) / 180;
      directions.push({
        x: direction.x * Math.cos(angle) - direction.z * Math.sin(angle),
        y: 0,
        z: direction.x * Math.sin(angle) + direction.z * Math.cos(angle),
      });
    }
  }
  const tethered = new Set();
  // The chain leaves exactly when the left arm swings forward in the animation (0.25 s)
  system.runTimeout(() => directions.forEach((d) => launchChain(player, d, tethered)), 5);
}

function launchChain(player, direction, tethered = new Set()) {
  if (!canAct(player)) return;
  const cfg = CONFIG.W;
  const dimension = player.dimension;
  sound(dimension, "mob.blaze.shoot", player.location, 0.7);
  const left = { x: direction.z, y: 0, z: -direction.x };
  let head = add(add(player.location, { x: 0, y: 1.3, z: 0 }), left, 0.35);
  let travelled = 0;

  const flight = system.runInterval(() => {
    if (!player.isValid) return system.clearRun(flight);
    // Sub-steps so the chain never tunnels through targets or walls
    for (let step = 0; step < 3; step++) {
      head = add(head, direction, cfg.speed / 3);
      travelled += cfg.speed / 3;
      particle(dimension, P.chain, head);
      if (step === 0) particle(dimension, P.ember, head);
      if (step === 2) particle(dimension, P.chainHead, head);

      const target = getTargetsNear(player, head, cfg.hitRadius).find((e) => !tethered.has(e.id));
      if (target) {
        tethered.add(target.id);
        system.clearRun(flight);
        tether(player, target);
        return;
      }
      if (travelled >= cfg.range || isBlocked(dimension, head)) {
        particle(dimension, P.smoke, head);
        return system.clearRun(flight);
      }
    }
  }, 1);
}

function tether(player, target) {
  const cfg = CONFIG.W;
  const dimension = player.dimension;
  const anchor = target.location;
  const pullTick = ticks(cfg.pullDelay);

  dealDamage(player, target, cfg.damage);
  sound(dimension, "random.anvil_land", target.location, 0.6);
  sound(dimension, "mob.evocation_illager.cast_spell", anchor, 0.8);
  particle(dimension, P.bind, add(anchor, { x: 0, y: 0.08, z: 0 }), withRadius(cfg.escapeRadius));
  particle(dimension, P.smoke, add(anchor, { x: 0, y: 0.5, z: 0 }));
  particle(dimension, P.glyph, add(anchor, { x: 0, y: 0.2, z: 0 }));
  shake(target, 0.2, 0.2);
  try {
    target.addEffect("slowness", pullTick, { amplifier: cfg.slowAmplifier, showParticles: false });
  } catch {
    // ignore
  }

  let elapsed = 0;
  const run = system.runInterval(() => {
    elapsed++;
    if (!player.isValid || !target.isValid || (getHealth(target)?.currentValue ?? 0) <= 0) {
      return system.clearRun(run);
    }
    // Target ran out of the binding circle: the chain breaks
    if (horizontalDistance(target.location, anchor) > cfg.escapeRadius) {
      particle(dimension, P.smoke, add(target.location, { x: 0, y: 1, z: 0 }));
      particle(dimension, P.spark, add(target.location, { x: 0, y: 1, z: 0 }));
      sound(dimension, "random.break", target.location);
      return system.clearRun(run);
    }

    if (elapsed % 2 === 0) {
      particleLine(dimension, P.chain, add(player.location, { x: 0, y: 1.2, z: 0 }), add(target.location, { x: 0, y: 1, z: 0 }), 0.4);
    }
    if (elapsed % 8 === 0) {
      particleRing(dimension, P.chain, add(anchor, { x: 0, y: 0.1, z: 0 }), cfg.escapeRadius, 24);
    }

    if (elapsed >= pullTick) {
      system.clearRun(run);
      const toPlayer = { x: player.location.x - target.location.x, y: 0, z: player.location.z - target.location.z };
      const distance = Math.hypot(toPlayer.x, toPlayer.z);
      const direction = flatUnit(toPlayer);
      if (direction && distance > 1.5) {
        knockback(target, direction, Math.min(cfg.maxPull, distance * cfg.pullPerBlock), 0.3);
      }
      stun(target, cfg.stun);
      dealDamage(player, target, cfg.pullDamage);
      bloodBurst(dimension, add(target.location, { x: 0, y: 1, z: 0 }));
      crater(dimension, anchor, 1.3);
      shake(player, 0.2, 0.2);
      shake(target, 0.35, 0.3);
      sound(dimension, "mob.ravager.stun", target.location);
    }
  }, 1);
}

// ---------------------------------------------------------------------------
// R — World Ender
// ---------------------------------------------------------------------------

function castR(player, state) {
  const cfg = CONFIG.R;
  const t = now();
  if (t < state.busyUntil || t < state.cd.R) return;
  startCooldown(state, "R");
  playAnim(player, "r");
  const castTicks = ticks(cfg.castTime);
  state.busyUntil = t + castTicks;

  try {
    player.addEffect("slowness", castTicks, { amplifier: 3, showParticles: false });
  } catch {
    // ignore
  }
  sound(player.dimension, "mob.wither.spawn", player.location, 1.3);
  particle(player.dimension, P.aura, player.location);
  particle(player.dimension, P.charge, add(player.location, { x: 0, y: 1.2, z: 0 }));
  particle(player.dimension, P.smoke, add(player.location, { x: 0, y: 0.4, z: 0 }));
  shockRing(player.dimension, player.location, 1.5);

  system.runTimeout(() => {
    if (!canAct(player)) return;
    const origin = player.location;
    const dimension = player.dimension;
    const duration = ticks(cfg.duration);

    // Transform first so the shockwave damage gets the bonus
    state.ultUntil = now() + duration;
    try {
      player.addEffect("speed", duration, { amplifier: cfg.speedAmplifier, showParticles: false });
      player.addEffect("strength", duration, { amplifier: cfg.strengthAmplifier, showParticles: false });
    } catch {
      // ignore
    }
    if (!isPassiveReady(state)) {
      const remaining = state.passiveReadyAt - now();
      state.passiveReadyAt = now() + Math.floor(remaining * cfg.passiveCooldownMultiplier);
    }

    // Reveal the World Ender form: swap to the blade with 3D wings + horns
    swapMainhand(player, ITEM_ID, ULT_ITEM_ID);

    // Red screen flash, shake, fire pillars around, cracked ground, lightning, souls
    flashScreen(player, 0.55, 0.02, 0.02);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.4;
      const at = { x: origin.x + Math.cos(angle) * 3.5, y: origin.y + 1.6, z: origin.z + Math.sin(angle) * 3.5 };
      system.runTimeout(() => particle(dimension, P.lightning, at), i * 2);
    }
    particle(dimension, P.soul, add(origin, { x: 0, y: 1, z: 0 }));
    particle(dimension, P.soul, add(origin, { x: 0, y: 1.6, z: 0 }));
    shake(player, 0.5, 0.7);
    sound(dimension, "mob.enderdragon.growl", origin, 0.8);
    sound(dimension, "mob.ravager.roar", origin, 0.7);
    particle(dimension, P.pillar, origin);
    crater(dimension, origin, cfg.radius * 0.55);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const at = { x: origin.x + Math.cos(angle) * 2.6, y: origin.y, z: origin.z + Math.sin(angle) * 2.6 };
      system.runTimeout(() => {
        particle(dimension, P.pillar, at);
        particle(dimension, P.debris, add(at, { x: 0, y: 0.2, z: 0 }));
      }, 2 + i);
    }

    // Expanding shockwave
    bloodBurst(dimension, add(origin, { x: 0, y: 1, z: 0 }));
    for (let i = 0; i < 3; i++) {
      system.runTimeout(() => shockRing(dimension, origin, cfg.radius * (0.6 + i * 0.25)), i * 3);
    }
    sound(dimension, "random.explode", origin, 0.6);

    for (const target of getTargetsNear(player, origin, cfg.radius)) {
      const away = flatUnit({ x: target.location.x - origin.x, z: target.location.z - origin.z }) ?? aimDirection(player);
      knockback(target, away, cfg.knockback, 0.5);
      try {
        target.addEffect("slowness", ticks(cfg.fearDuration), { amplifier: cfg.fearSlowAmplifier });
      } catch {
        // ignore
      }
      dealDamage(player, target, cfg.castDamage);
      shake(target, 0.35, 0.35);
      // Fear icon above the head while feared
      for (let k = 0; k < cfg.fearDuration * 2; k++) {
        system.runTimeout(() => target.isValid && particle(dimension, P.fear, add(target.location, { x: 0, y: 2.4, z: 0 })), k * 10);
      }
    }
  }, castTicks);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const SKILL_NAMES = { Q: "The Darkin Blade", E: "Umbral Dash", W: "Infernal Chains", R: "World Ender" };
const STANCE_HINT = { Q: "", E: " (sprinting)", W: " (sneaking)  §7Jump: §eR" };
// Shown in the blade's tooltip (hover the blade in the inventory)
const LORE = [
  "§7Right-click/tap: §cQ §7Darkin Blade",
  "§7Sprint + attack: §cE §7Umbral Dash",
  "§7Sneak + right-click: §cW §7Chains",
  "§7Sneak + jump: §cR §7World Ender",
  "§7Normal attack: §cPassive",
];
// Clicking blocks/mobs that have their own interaction uses them normally instead of casting
const INTERACTIVE_BLOCK =
  /door|gate|button|lever|chest|barrel|shulker|furnace|smoker|crafting|crafter|anvil|table|:bed$|bell|hopper|dispenser|dropper|loom|grindstone|stonecutter|beacon|lectern|repeater|comparator|noteblock|jukebox|cake|campfire|anchor|lodestone|composter|cauldron|brewing|sign|frame|vault|chiseled_bookshelf|decorated_pot/;
const INTERACTIVE_ENTITY = new Set(["minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader", "minecraft:armor_stand"]);

// Skill cast by right-click (R is sneak + jump, see playerButtonInput below)
function chooseSkill(player) {
  if (player.isSneaking) return "W";
  if (player.isSprinting) return "E";
  return "Q";
}

function notify(state, text, seconds = 1.2) {
  state.notice = text;
  state.noticeUntil = now() + ticks(seconds);
}

function cooldownLeft(state, skill) {
  if (skill === "Q" && state.qStage > 1) return 0; // still inside the recast window
  return state.cd[skill] - now();
}

// skill: fixed skill (E on sprint-attack, R on sneak-jump); omitted = chosen by stance.
// quiet: no cooldown message (used for normal hits while sprinting, avoids constant beeps)
function trySkill(player, forced, quiet = false) {
  if (!canAct(player)) return;
  const state = getState(player);
  // One press can fire several events (item use + block interaction)
  if (now() - state.lastUse < 4) return;
  state.lastUse = now();
  if (isStunned(player)) return notify(state, "§cYou are stunned and cannot cast!");
  if (now() < state.busyUntil) return;

  const skill = forced ?? chooseSkill(player);
  const left = cooldownLeft(state, skill);
  if (left > 0) {
    if (quiet) return;
    try {
      player.playSound("note.bass", { pitch: 0.6, volume: 0.7 });
    } catch {
      // ignore
    }
    return notify(state, `§c${skill} on cooldown: ${(left / TPS).toFixed(1)}s`);
  }

  const direction = aimDirection(player);
  const stage = state.qStage;
  if (skill === "R") castR(player, state);
  else if (skill === "E") castE(player, state, direction);
  else if (skill === "W") castW(player, state, direction);
  else castQ(player, state, direction);
  const label = skill === "Q" ? `Q${stage}` : skill;
  notify(state, `§6▶ ${label}: ${SKILL_NAMES[skill]}`);
}

// Right-click / tap into the air
world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (isBladeId(itemStack?.typeId)) trySkill(source);
});

// Right-click / tap while aiming at a block (ground, wall...)
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (!isBladeId(event.itemStack?.typeId) || event.isFirstEvent === false) return;
  if (INTERACTIVE_BLOCK.test(event.block.typeId)) return;
  const player = event.player;
  system.run(() => trySkill(player));
});

// Right-click / hold on a mob
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  if (!isBladeId(event.itemStack?.typeId)) return;
  const target = event.target;
  if (INTERACTIVE_ENTITY.has(target.typeId)) return;
  try {
    if (target.getComponent("minecraft:rideable")) return; // horses, boats... ride them as usual
  } catch {
    // ignore
  }
  const player = event.player;
  system.run(() => trySkill(player));
});

// Sneak + jump: R
world.afterEvents.playerButtonInput.subscribe(({ player, button, newButtonState }) => {
  if (button !== InputButton.Jump || newButtonState !== ButtonState.Pressed) return;
  if (player.isSneaking && holdsBlade(player)) trySkill(player, "R");
});

// Sprint + attack (hitting a mob or block): E
function sprintSlash(player) {
  if (player?.typeId === "minecraft:player" && player.isSprinting && holdsBlade(player)) trySkill(player, "E", true);
}
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity }) => sprintSlash(damagingEntity));
world.afterEvents.entityHitBlock.subscribe(({ damagingEntity }) => sprintSlash(damagingEntity));

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  states.delete(playerId);
  greeted.delete(playerId);
});

// ---------------------------------------------------------------------------
// Guide: title + chat on first hold, blade tooltip, /scriptevent aatrox:help
// ---------------------------------------------------------------------------

function sendGuide(player) {
  player.sendMessage("§4━━━━━━━━ The Darkin Blade ━━━━━━━━");
  player.sendMessage("§7Hold the blade and use these controls (mobile: right-click = §ftap the screen§7 / §fUse§7 button):");
  player.sendMessage("§c Q §f— right-click: §7slash 3 times, the orange rune tiles are the sweet spot");
  player.sendMessage("§c E §f— sprint + attack (or sprint + right-click): §7dash where you look");
  player.sendMessage("§c W §f— sneak (Shift / sneak button) + right-click: §7launch fiery chains");
  player.sendMessage("§c R §f— sneak + jump: §7transform into the World Ender");
  player.sendMessage("§c Passive §f— normal attack: §7the wound explodes and heals you");
  player.sendMessage("§7The bar above the hotbar shows the next skill and cooldowns. Type §f/scriptevent aatrox:help §7to see this again.");
}

function ensureLore(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    const item = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (!isBladeId(item?.typeId) || item.getLore().join("\n") === LORE.join("\n")) return;
    item.setLore(LORE);
    equippable.setEquipment(EquipmentSlot.Mainhand, item);
  } catch {
    // ignore
  }
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id === "aatrox:help" && sourceEntity?.typeId === "minecraft:player") sendGuide(sourceEntity);
});

// ---------------------------------------------------------------------------
// World Ender form: swap normal blade <-> blade with 3D wings + horns, World Ender zone
// ---------------------------------------------------------------------------

function convertBlade(stack, typeId) {
  const out = new ItemStack(typeId, 1);
  try {
    if (stack.nameTag) out.nameTag = stack.nameTag;
  } catch {
    // ignore
  }
  try {
    out.setLore(stack.getLore());
  } catch {
    // ignore
  }
  try {
    const from = stack.getComponent("minecraft:durability");
    const to = out.getComponent("minecraft:durability");
    if (from && to) to.damage = from.damage;
  } catch {
    // ignore
  }
  try {
    const from = stack.getComponent("minecraft:enchantable");
    const to = out.getComponent("minecraft:enchantable");
    if (from && to) to.addEnchantments(from.getEnchantments());
  } catch {
    // ignore
  }
  return out;
}

function swapMainhand(player, fromId, toId) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    const item = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (item?.typeId === fromId) equippable.setEquipment(EquipmentSlot.Mainhand, convertBlade(item, toId));
  } catch {
    // ignore
  }
}

// Form ended: turn every World Ender blade in the inventory back into the normal blade
function revertUltItems(player) {
  try {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (item?.typeId === ULT_ITEM_ID) container.setItem(i, convertBlade(item, ITEM_ID));
    }
  } catch {
    // ignore
  }
}

system.runInterval(() => {
  const t = now();
  for (const player of world.getAllPlayers()) {
    const state = states.get(player.id);
    if (!state || !isUltActive(state)) {
      revertUltItems(player);
      continue;
    }
    const cfg = CONFIG.R;
    const center = player.location;
    const dimension = player.dimension;
    // World Ender circle under the feet, spinning seamlessly across respawns (20 degrees/second)
    const molang = withRadius(cfg.zoneRadius);
    molang.setFloat("variable.spin", t);
    particle(dimension, P.domain, add(center, { x: 0, y: 0.07, z: 0 }), molang);
    const angle = t * 0.25;
    particle(dimension, P.glyph, { x: center.x + Math.cos(angle) * cfg.zoneRadius, y: center.y + 0.2, z: center.z + Math.sin(angle) * cfg.zoneRadius });
    particle(dimension, P.fireTrail, { x: center.x - Math.cos(angle) * cfg.zoneRadius, y: center.y + 0.1, z: center.z - Math.sin(angle) * cfg.zoneRadius });
    if (t % 20 === 0) {
      particle(dimension, P.soul, add(center, { x: 0, y: 0.8, z: 0 }));
      for (const target of getTargetsNear(player, center, cfg.zoneRadius)) {
        dealDamage(player, target, cfg.zoneDamage);
        particle(dimension, P.mist, add(target.location, { x: 0, y: 1, z: 0 }));
        try {
          target.addEffect("slowness", 25, { amplifier: 0, showParticles: false });
        } catch {
          // ignore
        }
      }
    }
  }
}, 10);


// ---------------------------------------------------------------------------
// Cooldown bar (action bar) + aura while transformed
// ---------------------------------------------------------------------------

// Approximate blade location: held in the right hand, blade pointing forward
function bladeLocation(player) {
  const forward = aimDirection(player);
  const right = { x: -forward.z, y: 0, z: forward.x };
  return add(add(add(player.location, { x: 0, y: 1.6, z: 0 }), right, 0.55), forward, 0.8);
}

function formatCooldown(ticksLeft) {
  if (ticksLeft <= 0) return "§a✔";
  const seconds = ticksLeft / TPS;
  return `§7${seconds >= 10 ? Math.ceil(seconds) : seconds.toFixed(1)}s`;
}

system.runInterval(() => {
  const t = now();
  for (const player of world.getAllPlayers()) {
    if (!holdsBlade(player)) continue;
    const state = getState(player);

    if (!greeted.has(player.id)) {
      greeted.add(player.id);
      sendGuide(player);
      try {
        player.onScreenDisplay.setTitle("§4The Darkin Blade", {
          subtitle: "§7Right-click / tap the screen to cast §cQ",
          fadeInDuration: 10,
          stayDuration: 60,
          fadeOutDuration: 20,
        });
      } catch {
        // ignore
      }
      particle(player.dimension, P.aura, player.location);
      sound(player.dimension, "mob.wither.ambient", player.location, 1.4);
    }
    ensureLore(player);

    const parts = [`§4Passive ${formatCooldown(state.passiveReadyAt - t)}`];
    if (t < (state.noticeUntil ?? 0)) {
      parts.push(state.notice);
    } else {
      const next = chooseSkill(player);
      parts.push(`§fPress: §e${next}${STANCE_HINT[next]}`);
    }
    for (const skill of SKILLS) {
      if (skill === "Q" && state.qStage > 1 && t < state.qWindowEnd) {
        parts.push(`§6Q ${state.qStage}/${CONFIG.Q.casts.length}`);
      } else {
        parts.push(`§c${skill} ${formatCooldown(state.cd[skill] - t)}`);
      }
    }
    if (isUltActive(state)) {
      parts.push(`§6§lWORLD ENDER ${Math.ceil((state.ultUntil - t) / TPS)}s`);
      particle(player.dimension, P.aura, player.location);
    } else if (t % 10 === 0) {
      // Embers rise and lava drips from the held blade
      particle(player.dimension, P.ember, bladeLocation(player));
      if (t % 20 === 0) particle(player.dimension, P.lavaDrip, bladeLocation(player));
    }
    player.onScreenDisplay.setActionBar(parts.join("§r  "));
  }

  for (const [id, until] of stunnedUntil) {
    if (until <= t) stunnedUntil.delete(id);
  }
}, 5);
