// Inverted Spear of Heaven — Toji Fushiguro skill kit (Jujutsu Kaisen / JJS style)
// for Minecraft Bedrock, Script API @minecraft/server 2.x
//
// While holding the spear:
//   Right-click                    Nullifying Thrust
//   Sneak + right-click            Thousand-Mile Chain
//   Sprint + attack                Heavenly Rush (sprint + right-click also works)
//   Hold the spear 20 s            Heavenly Restriction: Awakened (triggers by itself)
//   Hold 20 s + jump (awakened)    Heaven-Splitting Plunge
//   Every hit                      Passive: Nullification (strips the target's positive effects)

import { world, system, ItemStack, EquipmentSlot, InputButton, ButtonState, EntityDamageCause, MolangVariableMap } from "@minecraft/server";
import { CONFIG } from "./config.js";

const ITEM_ID = "toji:inverted_spear";
const AWAKE_ID = "toji:inverted_spear_awakened"; // same spear with a glowing edge layer
const isSpearId = (id) => id === ITEM_ID || id === AWAKE_ID;
const TPS = 20;
const SKILLS = ["thrust", "chain", "rush"];
const SKILL_NAMES = {
  thrust: "Nullifying Thrust",
  chain: "Thousand-Mile Chain",
  rush: "Heavenly Rush",
  awaken: "Heavenly Restriction",
  plunge: "Heaven-Splitting Plunge",
};
const SHORT = { thrust: "Thrust", chain: "Chain", rush: "Rush" };

// Custom particles live in the resource pack (TojiRP/particles)
const P = {
  slash: "toji:slash",
  thrust: "toji:thrust",
  nullRing: "toji:null_ring",
  nullGround: "toji:null_ground",
  shard: "toji:shard",
  spark: "toji:spark",
  chain: "toji:chain_link",
  spear: "toji:spear",
  afterimage: "toji:afterimage",
  dust: "toji:dust",
  crack: "toji:crack",
  ring: "toji:shock_ring",
  aura: "toji:aura",
  charge: "toji:charge",
  flash: "toji:flash",
  blood: "toji:blood",
  debris: "toji:debris",
  stun: "minecraft:villager_angry",
};

// Positive effects the spear cancels
const NULLIFIED_EFFECTS = [
  "speed", "haste", "strength", "jump_boost", "regeneration", "resistance", "fire_resistance", "water_breathing",
  "invisibility", "night_vision", "health_boost", "absorption", "saturation", "slow_falling", "conduit_power", "village_hero",
];

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
      cd: { thrust: 0, chain: 0, rush: 0 },
      busyUntil: 0,
      holdTicks: 0,
      awakeUntil: 0,
      plungeUsed: false,
      plunging: false,
      lastUse: -100,
    };
    states.set(player.id, state);
  }
  return state;
}

const isAwake = (state) => now() < state.awakeUntil;
const isStunned = (entity) => (stunnedUntil.get(entity.id) ?? 0) > now();

function startCooldown(state, skill) {
  let seconds = CONFIG[skill].cooldown;
  if (isAwake(state)) seconds *= CONFIG.awaken.cooldownMultiplier;
  state.cd[skill] = now() + ticks(seconds);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flatUnit(v) {
  const length = Math.hypot(v.x, v.z);
  return length < 1e-4 ? undefined : { x: v.x / length, y: 0, z: v.z / length };
}

const add = (a, b, scale = 1) => ({ x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale });
const up = (location, y) => ({ x: location.x, y: location.y + y, z: location.z });
const horizontalDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function aimDirection(player) {
  return flatUnit(player.getViewDirection()) ?? { x: 0, y: 0, z: 1 };
}

function getHealth(entity) {
  try {
    return entity.getComponent("minecraft:health");
  } catch {
    return undefined;
  }
}

function heldItem(player) {
  try {
    return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

const holdsSpear = (player) => isSpearId(heldItem(player)?.typeId);

function canAct(player) {
  return player.isValid && holdsSpear(player) && (getHealth(player)?.currentValue ?? 0) > 0;
}

function particle(dimension, id, location, molang) {
  try {
    dimension.spawnParticle(id, location, molang);
  } catch {
    // chunk not loaded or particle missing: ignore
  }
}

function sound(dimension, id, location, pitch = 1, volume = 1) {
  try {
    dimension.playSound(id, location, { pitch, volume });
  } catch {
    // ignore
  }
}

function withRadius(radius) {
  const molang = new MolangVariableMap();
  molang.setFloat("variable.radius", radius);
  return molang;
}

function withDirection(direction) {
  const molang = new MolangVariableMap();
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  molang.setFloat("variable.dir_x", direction.x / length);
  molang.setFloat("variable.dir_y", direction.y / length);
  molang.setFloat("variable.dir_z", direction.z / length);
  return molang;
}

function particleLine(dimension, id, from, to, spacing = 0.5) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const steps = Math.max(1, Math.floor(distance / spacing));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    particle(dimension, id, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t });
  }
}

function particleRing(dimension, id, center, radius, count) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    particle(dimension, id, { x: center.x + Math.cos(angle) * radius, y: center.y, z: center.z + Math.sin(angle) * radius });
  }
}

function shockRing(dimension, center, radius) {
  particle(dimension, P.ring, up(center, 0.15), withRadius(radius));
}

// Impact crater: cracked ground + dust + debris
function crater(dimension, center, radius) {
  particle(dimension, P.crack, up(center, 0.06), withRadius(radius));
  particle(dimension, P.dust, up(center, 0.2));
  particle(dimension, P.debris, up(center, 0.2));
}

function shake(entity, intensity, seconds) {
  if (entity?.typeId !== "minecraft:player") return;
  try {
    entity.runCommand(`camerashake add @s ${intensity} ${seconds} positional`);
  } catch {
    // ignore
  }
}

function flashScreen(player, red, green, blue) {
  try {
    player.camera.fade({ fadeColor: { red, green, blue }, fadeTime: { fadeInTime: 0.05, holdTime: 0.05, fadeOutTime: 0.5 } });
  } catch {
    // ignore
  }
}

function playAnim(player, name) {
  try {
    player.playAnimation(`animation.toji.${name}`, { blendOutTime: 0.12 });
  } catch {
    // ignore
  }
}

function addEffect(entity, id, duration, amplifier = 0) {
  try {
    entity.addEffect(id, duration, { amplifier, showParticles: false });
  } catch {
    // ignore
  }
}

function knockback(entity, horizontal, vertical) {
  try {
    entity.applyKnockback(horizontal, vertical);
  } catch {
    // some entities cannot be knocked back
  }
}

// Approximate spear tip: held in the right hand, pointing forward
function spearTip(player, reach = 1.4) {
  const view = player.getViewDirection();
  const forward = aimDirection(player);
  const right = { x: -forward.z, y: 0, z: forward.x };
  return add(add(player.getHeadLocation(), right, 0.35), view, reach);
}

// ---------------------------------------------------------------------------
// Targets, damage, crowd control, nullification
// ---------------------------------------------------------------------------

function isTarget(player, entity) {
  if (!entity.isValid || entity.id === player.id) return false;
  if (entity.typeId === "minecraft:player" && !CONFIG.pvp) return false;
  const health = getHealth(entity);
  if (!health || health.currentValue <= 0) return false;
  try {
    if (entity.getComponent("minecraft:tameable")?.tamedToPlayerId === player.id) return false;
  } catch {
    // ignore
  }
  return true;
}

function getTargetsNear(player, center, radius) {
  return player.dimension
    .getEntities({ location: center, maxDistance: radius, excludeTypes: ["minecraft:item", "minecraft:xp_orb"], excludeFamilies: ["inanimate"] })
    .filter((entity) => isTarget(player, entity));
}

function getTargetsInBox(player, origin, direction, length, width) {
  const right = { x: -direction.z, z: direction.x };
  return getTargetsNear(player, origin, Math.hypot(length, width / 2) + 1.5).filter((entity) => {
    const dx = entity.location.x - origin.x;
    const dz = entity.location.z - origin.z;
    const dy = entity.location.y - origin.y;
    const along = dx * direction.x + dz * direction.z;
    const side = dx * right.x + dz * right.z;
    return along >= -0.5 && along <= length + 0.6 && Math.abs(side) <= width / 2 + 0.6 && dy > -2.5 && dy < 3;
  });
}

function aimedTarget(player, reach) {
  try {
    const hit = player.getEntitiesFromViewDirection({ maxDistance: reach })[0];
    return hit && isTarget(player, hit.entity) ? hit.entity : undefined;
  } catch {
    return undefined;
  }
}

function dealDamage(player, target, amount) {
  if (isAwake(getState(player))) amount *= CONFIG.awaken.damageMultiplier;
  return applySkillDamage(player, target, amount, 0);
}

// A mob that was just hit is invulnerable for ~0.5 s: retry a rejected hit a few times
function applySkillDamage(player, target, amount, attempt) {
  if (!target.isValid || !player.isValid) return false;
  let hit = false;
  try {
    hit = target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
  } catch {
    return false;
  }
  if (hit) particle(target.dimension, P.spark, up(target.location, 1));
  else if (attempt < 3) system.runTimeout(() => applySkillDamage(player, target, amount, attempt + 1), 4);
  return hit;
}

function stun(entity, seconds) {
  if (!entity.isValid) return;
  const duration = ticks(seconds);
  stunnedUntil.set(entity.id, now() + duration);
  addEffect(entity, "slowness", duration, 255);
  particleRing(entity.dimension, P.stun, up(entity.location, 2.2), 0.5, 4);
}

// The Inverted Spear of Heaven cancels techniques: strip every positive effect, shatter them visually
function nullify(target, big = false) {
  if (!target.isValid) return 0;
  let removed = 0;
  for (const id of NULLIFIED_EFFECTS) {
    try {
      if (target.getEffect(id)) {
        target.removeEffect(id);
        removed++;
      }
    } catch {
      // ignore
    }
  }
  const at = up(target.location, 1);
  particle(target.dimension, P.nullRing, at);
  if (removed > 0 || big) {
    particle(target.dimension, P.shard, at);
    particle(target.dimension, P.nullGround, up(target.location, 0.08), withRadius(big ? 3 : 2));
    sound(target.dimension, "random.glass", target.location, 0.7);
  }
  if (removed > 0 && target.typeId === "minecraft:player") {
    try {
      target.onScreenDisplay.setActionBar("§5Your effects were nullified!");
    } catch {
      // ignore
    }
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Passive — Nullification on every normal hit
// ---------------------------------------------------------------------------

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity: player, hitEntity: target }) => {
  if (!CONFIG.passive.nullifyOnHit || player.typeId !== "minecraft:player" || !holdsSpear(player)) return;
  if (!isTarget(player, target)) return;
  nullify(target);
  particle(target.dimension, P.spark, up(target.location, 1));
});

// ---------------------------------------------------------------------------
// Right-click — Nullifying Thrust
// ---------------------------------------------------------------------------

function castThrust(player, state, direction) {
  const cfg = CONFIG.thrust;
  startCooldown(state, "thrust");
  const windup = ticks(cfg.windup);
  state.busyUntil = now() + windup + 4;
  playAnim(player, "thrust");
  sound(player.dimension, "item.trident.return", player.location, 1.4);
  particle(player.dimension, P.charge, spearTip(player, 0.8));
  addEffect(player, "slowness", windup, 2);

  // Lunge just before the stab lands
  system.runTimeout(() => {
    if (!canAct(player)) return;
    knockback(player, { x: direction.x * cfg.lunge, z: direction.z * cfg.lunge }, 0.05);
    particle(player.dimension, P.dust, up(player.location, 0.1));
    particle(player.dimension, P.afterimage, up(player.location, 0.9));
  }, Math.max(1, windup - 3));

  system.runTimeout(() => {
    if (!canAct(player)) return;
    const dimension = player.dimension;
    const origin = player.location;
    const view = player.getViewDirection();
    const tip = spearTip(player);
    particle(dimension, P.thrust, tip, withDirection(view));
    particle(dimension, P.flash, add(tip, direction, 0.6));
    particleLine(dimension, P.spark, tip, add(tip, direction, cfg.length - 1), 1.6);
    sound(dimension, "item.trident.throw", origin, 0.8);
    sound(dimension, "random.anvil_land", origin, 1.9, 0.5);
    shake(player, 0.12, 0.15);

    const targets = getTargetsInBox(player, origin, direction, cfg.length, cfg.width);
    const aimed = aimedTarget(player, cfg.length + 1);
    if (aimed && !targets.some((e) => e.id === aimed.id)) targets.push(aimed);
    for (const target of targets) {
      nullify(target, true);
      dealDamage(player, target, cfg.damage);
      knockback(target, { x: direction.x * cfg.knockback, z: direction.z * cfg.knockback }, 0.25);
      particle(dimension, P.blood, up(target.location, 1));
      particle(dimension, P.flash, up(target.location, 1));
      shake(target, 0.25, 0.2);
    }
    if (targets.length) {
      sound(dimension, "item.trident.hit", origin, 0.9);
      shake(player, 0.2, 0.15);
    }
  }, windup);
}

// ---------------------------------------------------------------------------
// Sneak + right-click — Thousand-Mile Chain
// ---------------------------------------------------------------------------

function isBlocked(dimension, location) {
  try {
    const block = dimension.getBlock(location);
    return block !== undefined && !block.isAir && !block.isLiquid;
  } catch {
    return true;
  }
}

function castChain(player, state) {
  startCooldown(state, "chain");
  state.busyUntil = now() + ticks(CONFIG.chain.release) + 4;
  playAnim(player, "throw");
  sound(player.dimension, "item.trident.return", player.location, 0.6);
  system.runTimeout(() => launchChain(player), ticks(CONFIG.chain.release));
}

function launchChain(player) {
  if (!canAct(player)) return;
  const cfg = CONFIG.chain;
  const dimension = player.dimension;
  const direction = player.getViewDirection();
  const hand = () => add(up(player.location, 1.3), { x: -aimDirection(player).z, y: 0, z: aimDirection(player).x }, 0.35);
  let head = add(player.getHeadLocation(), direction, 0.8);
  let travelled = 0;
  sound(dimension, "item.trident.throw", player.location, 0.7);
  shake(player, 0.1, 0.1);

  const flight = system.runInterval(() => {
    if (!player.isValid) return system.clearRun(flight);
    // Sub-steps so the spear never tunnels through targets or walls
    for (let step = 0; step < 3; step++) {
      const previous = head;
      head = add(head, direction, cfg.speed / 3);
      travelled += cfg.speed / 3;

      const target = getTargetsNear(player, head, cfg.hitRadius + 2.5).find(
        (e) => horizontalDistance(e.location, head) <= cfg.hitRadius && head.y - e.location.y > -0.8 && head.y - e.location.y < 2.6
      );
      if (target) {
        system.clearRun(flight);
        chainHitTarget(player, target);
        return;
      }
      if (isBlocked(dimension, head)) {
        system.clearRun(flight);
        grapple(player, previous);
        return;
      }
      if (travelled >= cfg.range) {
        system.clearRun(flight);
        particle(dimension, P.dust, head);
        sound(dimension, "random.break", head, 1.2);
        return;
      }
    }
    particle(dimension, P.spear, head, withDirection(direction));
    particleLine(dimension, P.chain, hand(), head, 0.55);
  }, 1);
}

// Keep the chain drawn between the player and a moving end for a few ticks
function drawChain(player, getEnd, duration) {
  let elapsed = 0;
  const run = system.runInterval(() => {
    const end = getEnd();
    if (!player.isValid || !end || ++elapsed > duration) return system.clearRun(run);
    particleLine(player.dimension, P.chain, up(player.location, 1.2), end, 0.45);
    particle(player.dimension, P.spear, end, withDirection({ x: end.x - player.location.x, y: end.y - player.location.y - 1.2, z: end.z - player.location.z }));
  }, 1);
}

function chainHitTarget(player, target) {
  const cfg = CONFIG.chain;
  const dimension = player.dimension;
  nullify(target, true);
  dealDamage(player, target, cfg.damage);
  stun(target, cfg.stun);
  particle(dimension, P.blood, up(target.location, 1));
  particle(dimension, P.flash, up(target.location, 1));
  sound(dimension, "item.trident.hit", target.location, 0.8);
  sound(dimension, "random.anvil_land", target.location, 1.6, 0.5);
  shake(target, 0.3, 0.25);

  // Yank the target back
  system.runTimeout(() => {
    if (!player.isValid || !target.isValid) return;
    const toPlayer = flatUnit({ x: player.location.x - target.location.x, z: player.location.z - target.location.z });
    const distance = horizontalDistance(player.location, target.location);
    if (toPlayer && distance > 1.5) {
      const strength = Math.min(cfg.maxPull, distance * cfg.pullPerBlock);
      knockback(target, { x: toPlayer.x * strength, z: toPlayer.z * strength }, 0.35);
    }
    sound(dimension, "random.break", player.location, 0.6);
    shake(player, 0.15, 0.15);
  }, 3);
  drawChain(player, () => (target.isValid ? up(target.location, 1) : undefined), 12);
}

// Spear sticks in a wall/ground: pull yourself to it
function grapple(player, point) {
  const cfg = CONFIG.chain;
  const dimension = player.dimension;
  particle(dimension, P.dust, point);
  particle(dimension, P.spark, point);
  crater(dimension, point, 1.2);
  sound(dimension, "item.trident.hit_ground", point, 0.8);
  const toPoint = { x: point.x - player.location.x, y: point.y - player.location.y, z: point.z - player.location.z };
  const distance = Math.hypot(toPoint.x, toPoint.z);
  const direction = flatUnit(toPoint);
  system.runTimeout(() => {
    if (!player.isValid) return;
    const strength = Math.min(cfg.maxGrapple, distance * cfg.grapplePerBlock);
    const vertical = Math.max(0.35, Math.min(1.3, 0.35 + toPoint.y * 0.13));
    knockback(player, direction ? { x: direction.x * strength, z: direction.z * strength } : { x: 0, z: 0 }, vertical);
    addEffect(player, "slow_falling", 10);
    sound(dimension, "random.break", player.location, 0.5);
    particle(dimension, P.afterimage, up(player.location, 0.9));
  }, 2);
  drawChain(player, () => point, 8);
}

// ---------------------------------------------------------------------------
// Sprint + attack — Heavenly Rush
// ---------------------------------------------------------------------------

function castRush(player, state, direction) {
  const cfg = CONFIG.rush;
  startCooldown(state, "rush");
  state.busyUntil = now() + 6;
  playAnim(player, "rush");
  knockback(player, { x: direction.x * cfg.strength, z: direction.z * cfg.strength }, cfg.vertical);
  sound(player.dimension, "item.trident.riptide_1", player.location, 1.3);
  sound(player.dimension, "mob.phantom.swoop", player.location, 1.6);
  particle(player.dimension, P.dust, up(player.location, 0.1));

  const caught = new Set();
  let count = 0;
  const trail = system.runInterval(() => {
    if (!player.isValid || ++count > 9) return system.clearRun(trail);
    const at = player.location;
    if (count % 2 === 1) particle(player.dimension, P.afterimage, up(at, 0.9));
    if (count % 3 === 0) particle(player.dimension, P.dust, up(at, 0.1));
    for (const target of getTargetsNear(player, up(at, 0.8), cfg.hitRadius + 0.6)) {
      if (caught.has(target.id)) continue;
      caught.add(target.id);
      slashTarget(player, target, direction);
    }
  }, 1);
}

// 3 flashing slashes on a caught target; the damage lands once on the last one
// (mobs are briefly invulnerable after each hit, so separate hits would be lost)
function slashTarget(player, target, direction) {
  const cfg = CONFIG.rush;
  const dimension = player.dimension;
  stun(target, (cfg.slashes * cfg.slashInterval) / TPS + 0.2);
  for (let i = 0; i < cfg.slashes; i++) {
    system.runTimeout(() => {
      if (!target.isValid) return;
      const at = up(target.location, 1 + (i - 1) * 0.3);
      particle(dimension, P.slash, at);
      particle(dimension, P.spark, at);
      sound(dimension, "item.trident.hit", target.location, 1.2 + i * 0.2, 0.7);
      if (i === cfg.slashes - 1) {
        nullify(target);
        dealDamage(player, target, cfg.damage * cfg.slashes);
        particle(dimension, P.blood, at);
        particle(dimension, P.flash, at);
        knockback(target, { x: direction.x * 0.6, z: direction.z * 0.6 }, 0.3);
        shake(target, 0.25, 0.2);
        shake(player, 0.1, 0.1);
      }
    }, i * cfg.slashInterval);
  }
}

// ---------------------------------------------------------------------------
// Held 20 s — Heavenly Restriction: Awakened
// ---------------------------------------------------------------------------

function awaken(player, state) {
  const cfg = CONFIG.awaken;
  const duration = ticks(cfg.duration);
  state.awakeUntil = now() + duration;
  state.plungeUsed = false;
  state.holdTicks = 0;
  playAnim(player, "awaken");
  swapMainhand(player, ITEM_ID, AWAKE_ID);
  addEffect(player, "speed", duration, cfg.speedAmplifier);
  addEffect(player, "strength", duration, cfg.strengthAmplifier);
  addEffect(player, "jump_boost", duration, cfg.jumpAmplifier);
  addEffect(player, "resistance", duration, cfg.resistanceAmplifier);

  const dimension = player.dimension;
  const origin = player.location;
  particle(dimension, P.charge, up(origin, 1));
  system.runTimeout(() => player.isValid && particle(dimension, P.charge, up(player.location, 1)), 4);
  system.runTimeout(() => {
    if (!player.isValid) return;
    const at = player.location;
    flashScreen(player, 0.85, 0.85, 1);
    for (let i = 0; i < 3; i++) system.runTimeout(() => shockRing(dimension, at, 3 + i * 1.8), i * 3);
    crater(dimension, at, 2.5);
    particle(dimension, P.nullGround, up(at, 0.08), withRadius(4));
    particle(dimension, P.flash, up(at, 1));
    shake(player, 0.35, 0.4);
    sound(dimension, "mob.ravager.roar", at, 1.3);
    sound(dimension, "random.explode", at, 1.6, 0.6);
  }, 9);
  sound(dimension, "item.trident.thunder", origin, 1.8, 0.4);
  try {
    player.onScreenDisplay.setTitle("§f§lHEAVENLY RESTRICTION", {
      subtitle: "§7Awakened — §fjump §7to use §dHeaven-Splitting Plunge",
      fadeInDuration: 5,
      stayDuration: 40,
      fadeOutDuration: 15,
    });
  } catch {
    // ignore
  }
}

function endAwakening(state) {
  state.awakeUntil = 0;
  state.holdTicks = 0;
}

// ---------------------------------------------------------------------------
// Held 20 s + jump — Heaven-Splitting Plunge
// ---------------------------------------------------------------------------

function castPlunge(player, state) {
  const cfg = CONFIG.plunge;
  const direction = aimDirection(player);
  state.plungeUsed = true;
  state.plunging = true;
  const diveTick = ticks(cfg.diveAt);
  const maxTick = diveTick + ticks(cfg.maxFall);
  state.busyUntil = now() + maxTick;
  playAnim(player, "plunge");
  // Full damage immunity while leaping/falling (no fall damage on landing)
  addEffect(player, "resistance", maxTick + 10, 4);
  const dimension = player.dimension;
  sound(dimension, "item.trident.riptide_3", player.location, 0.9);
  particle(dimension, P.dust, up(player.location, 0.1));
  shockRing(dimension, player.location, 2.5);

  system.runTimeout(() => {
    if (!player.isValid) return;
    knockback(player, { x: direction.x * cfg.forward, z: direction.z * cfg.forward }, cfg.leap);
    particle(dimension, P.afterimage, up(player.location, 0.9));
  }, 2);

  let elapsed = 0;
  const run = system.runInterval(() => {
    elapsed++;
    if (!player.isValid) {
      state.plunging = false;
      return system.clearRun(run);
    }
    if (elapsed < diveTick) {
      if (elapsed % 3 === 0) particle(dimension, P.aura, player.location);
      if (elapsed === diveTick - 5) {
        particle(dimension, P.charge, spearTip(player, 0.6));
        sound(dimension, "item.trident.return", player.location, 0.6);
      }
      return;
    }
    if (elapsed === diveTick) {
      knockback(player, { x: direction.x * 0.3, z: direction.z * 0.3 }, -cfg.diveSpeed);
      sound(dimension, "mob.phantom.swoop", player.location, 0.6);
      flashScreen(player, 0.7, 0.6, 0.95);
    }
    particle(dimension, P.afterimage, up(player.location, 0.9));
    particle(dimension, P.thrust, up(player.location, 0.2), withDirection({ x: 0, y: -1, z: 0 }));
    if ((elapsed > diveTick + 1 && player.isOnGround) || elapsed >= maxTick) {
      system.clearRun(run);
      plungeImpact(player, state, direction);
    }
  }, 1);
}

function plungeImpact(player, state, direction) {
  const cfg = CONFIG.plunge;
  state.plunging = false;
  state.busyUntil = now() + 8;
  const dimension = player.dimension;
  const center = player.location;

  crater(dimension, center, cfg.radius * 0.9);
  particle(dimension, P.nullGround, up(center, 0.1), withRadius(cfg.radius * 1.6));
  particle(dimension, P.flash, up(center, 0.8));
  particle(dimension, P.debris, up(center, 0.2));
  for (let i = 0; i < 3; i++) system.runTimeout(() => shockRing(dimension, center, cfg.radius * (0.5 + i * 0.35)), i * 3);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const at = { x: center.x + Math.cos(angle) * cfg.radius * 0.6, y: center.y, z: center.z + Math.sin(angle) * cfg.radius * 0.6 };
    system.runTimeout(() => {
      particle(dimension, P.debris, up(at, 0.2));
      particle(dimension, P.slash, up(at, 0.8));
    }, 1 + i);
  }
  sound(dimension, "random.explode", center, 0.7);
  sound(dimension, "item.trident.thunder", center, 1.2, 0.6);
  sound(dimension, "random.anvil_land", center, 0.5);
  shake(player, 0.6, 0.6);
  flashScreen(player, 1, 1, 1);

  for (const target of getTargetsNear(player, center, cfg.radius)) {
    const away = flatUnit({ x: target.location.x - center.x, z: target.location.z - center.z }) ?? direction;
    nullify(target, true);
    dealDamage(player, target, cfg.damage);
    knockback(target, { x: away.x * 0.5, z: away.z * 0.5 }, cfg.knockup);
    system.runTimeout(() => stun(target, cfg.stun), 8);
    particle(dimension, P.blood, up(target.location, 1));
    shake(target, 0.5, 0.45);
  }

  // Take the plunge immunity off, keep the awakening resistance if it is still running
  system.runTimeout(() => {
    if (!player.isValid) return;
    try {
      player.removeEffect("resistance");
    } catch {
      // ignore
    }
    const left = state.awakeUntil - now();
    if (left > 0) addEffect(player, "resistance", left, CONFIG.awaken.resistanceAmplifier);
  }, 10);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const LORE = [
  "§7Right-click/tap: §fNullifying Thrust",
  "§7Sneak + right-click: §fThousand-Mile Chain",
  "§7Sprint + attack: §fHeavenly Rush",
  "§7Hold 20 s: §fHeavenly Restriction",
  "§7Hold 20 s + jump: §dHeaven-Splitting Plunge",
  "§7Every hit: §5nullifies effects",
];
const INTERACTIVE_BLOCK =
  /door|gate|button|lever|chest|barrel|shulker|furnace|smoker|crafting|crafter|anvil|table|:bed$|bell|hopper|dispenser|dropper|loom|grindstone|stonecutter|beacon|lectern|repeater|comparator|noteblock|jukebox|cake|campfire|anchor|lodestone|composter|cauldron|brewing|sign|frame|vault|chiseled_bookshelf|decorated_pot/;
const INTERACTIVE_ENTITY = new Set(["minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader", "minecraft:armor_stand"]);

function chooseSkill(player) {
  if (player.isSneaking) return "chain";
  if (player.isSprinting) return "rush";
  return "thrust";
}

function notify(state, text, seconds = 1.2) {
  state.notice = text;
  state.noticeUntil = now() + ticks(seconds);
}

function trySkill(player, forced, quiet = false) {
  if (!canAct(player)) return;
  const state = getState(player);
  if (now() - state.lastUse < 4) return; // one press can fire several events
  state.lastUse = now();
  if (isStunned(player)) return notify(state, "§cYou are stunned!");
  if (now() < state.busyUntil || state.plunging) return;

  const skill = forced ?? chooseSkill(player);
  const left = state.cd[skill] - now();
  if (left > 0) {
    if (quiet) return;
    try {
      player.playSound("note.bass", { pitch: 0.6, volume: 0.7 });
    } catch {
      // ignore
    }
    return notify(state, `§c${SHORT[skill]} on cooldown: ${(left / TPS).toFixed(1)}s`);
  }

  const direction = aimDirection(player);
  if (skill === "chain") castChain(player, state);
  else if (skill === "rush") castRush(player, state, direction);
  else castThrust(player, state, direction);
  notify(state, `§f▶ ${SKILL_NAMES[skill]}`);
}

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (isSpearId(itemStack?.typeId)) trySkill(source);
});

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (!isSpearId(event.itemStack?.typeId) || event.isFirstEvent === false) return;
  if (INTERACTIVE_BLOCK.test(event.block.typeId)) return;
  const player = event.player;
  system.run(() => trySkill(player));
});

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  if (!isSpearId(event.itemStack?.typeId)) return;
  const target = event.target;
  if (INTERACTIVE_ENTITY.has(target.typeId)) return;
  try {
    if (target.getComponent("minecraft:rideable")) return;
  } catch {
    // ignore
  }
  const player = event.player;
  system.run(() => trySkill(player));
});

// Jump while awakened (held 20 s): Heaven-Splitting Plunge
world.afterEvents.playerButtonInput.subscribe(({ player, button, newButtonState }) => {
  if (button !== InputButton.Jump || newButtonState !== ButtonState.Pressed) return;
  if (!canAct(player) || isStunned(player)) return;
  const state = getState(player);
  if (!isAwake(state) || state.plungeUsed || state.plunging || now() < state.busyUntil) return;
  castPlunge(player, state);
  notify(state, `§d▶ ${SKILL_NAMES.plunge}`);
});

// Sprint + attack (hitting a mob or block): Heavenly Rush
function sprintSlash(player) {
  if (player?.typeId === "minecraft:player" && player.isSprinting && holdsSpear(player)) trySkill(player, "rush", true);
}
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity }) => sprintSlash(damagingEntity));
world.afterEvents.entityHitBlock.subscribe(({ damagingEntity }) => sprintSlash(damagingEntity));

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  states.delete(playerId);
  greeted.delete(playerId);
});

// ---------------------------------------------------------------------------
// Guide
// ---------------------------------------------------------------------------

function sendGuide(player) {
  player.sendMessage("§5━━━━━━ Inverted Spear of Heaven ━━━━━━");
  player.sendMessage("§7Hold the spear (mobile: right-click = §ftap the screen§7 / §fUse§7 button):");
  player.sendMessage("§f Right-click §7— §fNullifying Thrust§7: lunge and stab, pierces a line and strips all buffs");
  player.sendMessage("§f Sneak + right-click §7— §fThousand-Mile Chain§7: throw the spear; hit = yank the target, wall = grapple");
  player.sendMessage("§f Sprint + attack §7— §fHeavenly Rush§7: dash through enemies with 3 slashes");
  player.sendMessage("§f Hold 20 s §7— §fHeavenly Restriction§7: awaken for 15 s (speed, strength, halved cooldowns)");
  player.sendMessage("§f Hold 20 s + jump §7— §dHeaven-Splitting Plunge§7: leap and drive the spear into the ground");
  player.sendMessage("§7Every hit nullifies the target's positive effects. §f/scriptevent toji:help §7shows this again.");
}

function ensureLore(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    const item = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (!isSpearId(item?.typeId) || item.getLore().join("\n") === LORE.join("\n")) return;
    item.setLore(LORE);
    equippable.setEquipment(EquipmentSlot.Mainhand, item);
  } catch {
    // ignore
  }
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id === "toji:help" && sourceEntity?.typeId === "minecraft:player") sendGuide(sourceEntity);
});

// ---------------------------------------------------------------------------
// Awakened spear swap (keeps durability, enchantments, name, lore)
// ---------------------------------------------------------------------------

function convertSpear(stack, typeId) {
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
    if (item?.typeId === fromId) equippable.setEquipment(EquipmentSlot.Mainhand, convertSpear(item, toId));
  } catch {
    // ignore
  }
}

function revertAwakenedItems(player) {
  try {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (item?.typeId === AWAKE_ID) container.setItem(i, convertSpear(item, ITEM_ID));
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Main loop: hold timer, awakening, action bar
// ---------------------------------------------------------------------------

const LOOP = 5;

function formatCooldown(ticksLeft) {
  if (ticksLeft <= 0) return "§a✔";
  const seconds = ticksLeft / TPS;
  return `§7${seconds >= 10 ? Math.ceil(seconds) : seconds.toFixed(1)}s`;
}

function holdBar(state) {
  const need = ticks(CONFIG.awaken.holdTime);
  const filled = Math.min(10, Math.floor((state.holdTicks / need) * 10));
  return `§f${"▮".repeat(filled)}§8${"▮".repeat(10 - filled)} §7${Math.floor(state.holdTicks / TPS)}/${CONFIG.awaken.holdTime}s`;
}

system.runInterval(() => {
  const t = now();
  for (const player of world.getAllPlayers()) {
    const state = states.get(player.id);
    const holding = holdsSpear(player) && (getHealth(player)?.currentValue ?? 0) > 0;

    if (!holding) {
      // Letting go of the spear resets the hold timer and ends the awakening
      if (state) {
        state.holdTicks = 0;
        if (isAwake(state)) endAwakening(state);
      }
      revertAwakenedItems(player);
      continue;
    }
    const s = state ?? getState(player);

    if (!greeted.has(player.id)) {
      greeted.add(player.id);
      sendGuide(player);
      try {
        player.onScreenDisplay.setTitle("§fInverted Spear of Heaven", {
          subtitle: "§7Right-click / tap to §fthrust§7 — hold it §f20s§7 to awaken",
          fadeInDuration: 10,
          stayDuration: 60,
          fadeOutDuration: 20,
        });
      } catch {
        // ignore
      }
      sound(player.dimension, "item.trident.return", player.location, 0.7);
    }
    ensureLore(player);

    if (isAwake(s)) {
      particle(player.dimension, P.aura, player.location);
      if (t % 20 === 0) particle(player.dimension, P.spark, spearTip(player, 0.9));
    } else {
      if (s.awakeUntil) {
        // Awakening just ran out
        s.awakeUntil = 0;
        s.holdTicks = 0;
        revertAwakenedItems(player);
        sound(player.dimension, "random.fizz", player.location, 1.4, 0.5);
      }
      s.holdTicks += LOOP;
      const need = ticks(CONFIG.awaken.holdTime);
      if (s.holdTicks >= need - 20 && s.holdTicks < need && t % 10 === 0) {
        particle(player.dimension, P.charge, up(player.location, 1));
      }
      if (s.holdTicks >= need && !s.plunging) awaken(player, s);
    }

    const parts = [];
    if (isAwake(s)) {
      parts.push(`§f§lAWAKENED ${Math.ceil((s.awakeUntil - t) / TPS)}s§r`);
      parts.push(s.plungeUsed ? "§8Plunge used" : "§dJump: Plunge");
    } else {
      parts.push(`§7Hold ${holdBar(s)}`);
    }
    if (t < (s.noticeUntil ?? 0)) {
      parts.push(s.notice);
    } else {
      parts.push(`§fPress: §e${SHORT[chooseSkill(player)]}`);
    }
    for (const skill of SKILLS) parts.push(`§b${SHORT[skill]} ${formatCooldown(s.cd[skill] - t)}`);
    player.onScreenDisplay.setActionBar(parts.join("§r  "));
  }

  for (const [id, until] of stunnedUntil) {
    if (until <= t) stunnedUntil.delete(id);
  }
}, LOOP);
