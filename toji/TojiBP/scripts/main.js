// Inverted Spear of Heaven — Toji Fushiguro skill kit (Jujutsu Kaisen / JJS style)
// for Minecraft Bedrock, Script API @minecraft/server 2.x
//
// While holding the spear:
//   Right-click                    Pierce Infinity (stab through an Infinity barrier)
//   Sneak + right-click            Thousand-Mile Chain whirl, then hurl
//   Sprint + attack                Heavenly Ambush: vanish, reappear behind the target, X cut (sprint + right-click too)
//   Hold the spear 20 s            Heavenly Restriction: Awakened (triggers by itself)
//   Hold 20 s + jump (awakened)    Heaven's Execution: chains hook every mob, hang them in the sky, pierce, slam
//   Jump + attack                  Sky Splitter (smash the target into the ground)
//   Crouch + attack                Low Sweep (sweep the legs, launch them up)
//   Normal attacks                 4-hit combo, the 4th hit is a spinning finisher
//   Every hit                      Passive: Nullification (strips the target's positive effects)
//
// Texts are translation keys (TojiRP/texts/en_US.lang).

import { world, system, ItemStack, EquipmentSlot, InputButton, ButtonState, EntityDamageCause, MolangVariableMap } from "@minecraft/server";
import { CONFIG } from "./config.js";

// Item variants (see packs.py): the script swaps the held spear between them
const ITEM_ID = "toji:inverted_spear";
const AWAKE_ID = "toji:inverted_spear_awakened"; // glowing edges while awakened
const THROWN_ID = "toji:inverted_spear_thrown"; // only the chain in the hand while the spear flies
const SPEAR_IDS = new Set([ITEM_ID, AWAKE_ID, THROWN_ID]);
const isSpearId = (id) => SPEAR_IDS.has(id);
const TPS = 20;
const SKILLS = ["thrust", "chain", "rush"];

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
  infinity: "toji:infinity",
  shardBlue: "toji:shard_blue",
  xSlash: "toji:x_slash",
  vanish: "toji:vanish",
  stun: "minecraft:villager_angry",
};

// Positive effects the spear cancels
const NULLIFIED_EFFECTS = [
  "speed", "haste", "strength", "jump_boost", "regeneration", "resistance", "fire_resistance", "water_breathing",
  "invisibility", "night_vision", "health_boost", "absorption", "saturation", "slow_falling", "conduit_power", "village_hero",
];
// Buffs granted by the awakening (removed if it ends early)
const AWAKEN_EFFECTS = ["speed", "strength", "jump_boost", "resistance"];

const ticks = (seconds) => Math.max(1, Math.round(seconds * TPS));
const now = () => system.currentTick;

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------

/** Translated text; args may be plain strings or other translated texts */
function tr(key, ...args) {
  if (!args.length) return { translate: key };
  return { translate: key, with: { rawtext: args.map((a) => (typeof a === "string" ? { text: a } : a)) } };
}

const skillName = (skill) => tr(`toji.skill.${skill}`);
const shortName = (skill) => tr(`toji.short.${skill}`);

// Item lore (tooltip)
const LORE = [
  "§7Right-click/tap: §fPierce Infinity",
  "§7Sneak + right-click: §fChain whirl + hurl",
  "§7Sprint + attack: §fHeavenly Ambush",
  "§7Hold 20s: §fHeavenly Restriction",
  "§7Hold 20s + jump: §dHeaven's Execution",
  "§7Jump + attack: §fSky Splitter",
  "§7Crouch + attack: §fLow Sweep",
  "§7Attack x4: §fcombo finisher",
  "§7Every hit: §5nullifies effects",
];
const loreLines = () => LORE;

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
      cd: { thrust: 0, chain: 0, rush: 0, jumpAttack: 0, crouchAttack: 0 },
      busyUntil: 0,
      holdTicks: 0,
      awakeUntil: 0,
      plungeUsed: false,
      plunging: false,
      thrownUntil: 0,
      combo: 0,
      lastHit: -100,
      lastUse: -100,
      notice: undefined,
      noticeUntil: 0,
    };
    states.set(player.id, state);
  }
  return state;
}

const isAwake = (state) => now() < state.awakeUntil;
const EMP = () => CONFIG.awaken.empowered;

// Awakened versions of the skills get a violet glow + Infinity-break ring when cast
function empoweredCue(player) {
  particle(player.dimension, P.glow, up(player.location, 1));
  particle(player.dimension, P.nullGround, up(player.location, 0.08), withRadius(3));
  sound(player.dimension, "item.trident.thunder", player.location, 2, 0.25);
}
const isThrown = (state) => now() < state.thrownUntil;
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

// Layered effects: some particles always come with a companion (glow halo, anime impact lines)
const COMPANIONS = { "toji:flash": "toji:glow", "toji:x_slash": "toji:impact" };

function particle(dimension, id, location, molang) {
  try {
    dimension.spawnParticle(id, location, molang);
    const companion = COMPANIONS[id];
    if (companion) dimension.spawnParticle(companion, location);
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

// Player animation (TojiRP/animations/toji_player.animation.json)
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

function removeEffect(entity, id) {
  try {
    entity.removeEffect(id);
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
function spearTip(player, reach = 1.2) {
  const view = player.getViewDirection();
  const forward = aimDirection(player);
  const right = { x: -forward.z, y: 0, z: forward.x };
  return add(add(player.getHeadLocation(), right, 0.35), view, reach);
}

function handLocation(player) {
  const forward = aimDirection(player);
  return add(up(player.location, 1.3), { x: -forward.z, y: 0, z: forward.x }, 0.35);
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

// Targets within `radius` and inside an arc of `arc` degrees in front
function getTargetsInArc(player, origin, direction, radius, arc) {
  const minDot = Math.cos(((arc / 2) * Math.PI) / 180);
  return getTargetsNear(player, origin, radius + 0.5).filter((entity) => {
    const to = flatUnit({ x: entity.location.x - origin.x, z: entity.location.z - origin.z });
    if (!to || horizontalDistance(entity.location, origin) < 1) return true;
    return to.x * direction.x + to.z * direction.z >= minDot && Math.abs(entity.location.y - origin.y) < 2.5;
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
  if (!hit && target.typeId === "minecraft:player") hit = damagePlayerDirectly(target, amount);
  if (hit) particle(target.dimension, P.spark, up(target.location, 1));
  else if (attempt < 3) system.runTimeout(() => applySkillDamage(player, target, amount, attempt + 1), 4);
  return hit;
}

// Players often reject skill damage: the world's PvP setting is off, or they were hit less than 0.5 s ago.
// With CONFIG.pvp on, skills still hurt them by lowering their health directly (never in Creative/Spectator).
function damagePlayerDirectly(target, amount) {
  if (!CONFIG.pvp) return false;
  try {
    const mode = String(target.getGameMode()).toLowerCase();
    if (mode === "creative" || mode === "spectator") return false;
  } catch {
    return false;
  }
  const health = getHealth(target);
  if (!health || health.currentValue <= 0) return false;
  health.setCurrentValue(Math.max(0, health.currentValue - amount));
  sound(target.dimension, "game.player.hurt", target.location);
  return true;
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
      target.onScreenDisplay.setActionBar(tr("toji.notice.nullified"));
    } catch {
      // ignore
    }
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Item variants: the held spear shows the current form (normal / awakened / thrown)
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

function desiredVariant(state) {
  if (state && isThrown(state)) return THROWN_ID;
  if (state && isAwake(state)) return AWAKE_ID;
  return ITEM_ID;
}

// Held spear -> the variant for the current form; spears in any other slot -> normal spear
function syncSpear(player) {
  try {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;
    const selected = player.selectedSlotIndex;
    const state = states.get(player.id);
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item || !isSpearId(item.typeId)) continue;
      const want = i === selected ? desiredVariant(state) : ITEM_ID;
      if (item.typeId !== want) container.setItem(i, convertSpear(item, want));
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Normal attacks — 4-hit combo + passive nullification (+ sprint attack = Heavenly Ambush)
// ---------------------------------------------------------------------------

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity: player, hitEntity: target }) => {
  if (player.typeId !== "minecraft:player" || !holdsSpear(player)) return;
  const state = getState(player);
  if (player.isSprinting && now() >= state.cd.rush) {
    trySkill(player, "rush", true);
    return;
  }
  if (!isTarget(player, target)) return;
  if (canUseAttackSkill(player, state)) {
    // Jump + attack: Sky Splitter / Crouch + attack: Low Sweep
    if (!player.isOnGround && now() >= state.cd.jumpAttack) {
      jumpAttack(player, state, target);
      notify(state, tr("toji.notice.cast", skillName("jumpAttack")));
      return;
    }
    if (player.isSneaking && now() >= state.cd.crouchAttack) {
      crouchAttack(player, state);
      notify(state, tr("toji.notice.cast", skillName("crouchAttack")));
      return;
    }
  }
  if (CONFIG.passive.nullifyOnHit) nullify(target);
  particle(target.dimension, P.spark, up(target.location, 1));
  countComboHit(player, state);
});

// Sprint + hitting a block also starts the rush
world.afterEvents.entityHitBlock.subscribe(({ damagingEntity: player }) => {
  if (player?.typeId === "minecraft:player" && player.isSprinting && holdsSpear(player)) trySkill(player, "rush", true);
});

function canUseAttackSkill(player, state) {
  return !isStunned(player) && now() >= state.busyUntil && !state.plunging && !isThrown(state);
}

function countComboHit(player, state) {
  const t = now();
  if (t - state.lastHit < 4) return; // several events from one click
  state.combo = t - state.lastHit <= ticks(CONFIG.combo.window) ? state.combo + 1 : 1;
  state.lastHit = t;
  const needed = isAwake(state) ? EMP().comboHits : 4;
  if (state.combo >= needed && t >= state.busyUntil && !state.plunging) {
    state.combo = 0;
    comboFinisher(player, state);
  }
}

function comboFinisher(player, state) {
  const cfg = CONFIG.combo;
  const delay = ticks(cfg.finisherDelay);
  state.busyUntil = now() + delay + 4;
  playAnim(player, "finisher");
  sound(player.dimension, "item.trident.riptide_1", player.location, 1.6, 0.7);
  notify(state, tr("toji.notice.cast", skillName("finisher")), 0.8);

  system.runTimeout(() => {
    if (!canAct(player)) return;
    const dimension = player.dimension;
    const origin = player.location;
    const direction = aimDirection(player);
    const right = { x: -direction.z, y: 0, z: direction.x };
    const empowered = isAwake(state);
    const arc = empowered ? EMP().finisherArc : cfg.arc;
    if (empowered) {
      empoweredCue(player);
      shockRing(dimension, origin, cfg.radius + 1.5);
    }
    // Crescent slashes sweeping from right to left in front (a full circle when awakened)
    const count = empowered ? 10 : 5;
    for (let i = 0; i < count; i++) {
      const angle = ((i / (count - 1)) * 2 - 1) * ((arc / 2) * Math.PI) / 180;
      const d = add({ x: direction.x * Math.cos(angle), y: 0, z: direction.z * Math.cos(angle) }, right, -Math.sin(angle));
      system.runTimeout(() => particle(dimension, P.slash, up(add(origin, d, 2), 1.1)), i);
    }
    particle(dimension, P.dust, up(origin, 0.1));
    sound(dimension, "item.trident.throw", origin, 1.1);
    shake(player, 0.15, 0.15);
    for (const target of getTargetsInArc(player, origin, direction, cfg.radius, arc)) {
      const away = flatUnit({ x: target.location.x - origin.x, z: target.location.z - origin.z }) ?? direction;
      nullify(target);
      dealDamage(player, target, cfg.damage * (empowered ? EMP().finisherDamage : 1));
      knockback(target, { x: away.x * cfg.knockback, z: away.z * cfg.knockback }, cfg.vertical);
      particle(dimension, P.flash, up(target.location, 1));
      particle(dimension, P.blood, up(target.location, 1));
      sound(dimension, "item.trident.hit", target.location, 0.9);
      shake(target, 0.3, 0.25);
    }
  }, delay);
}

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

  const empowered = isAwake(state);
  const length = cfg.length * (empowered ? EMP().thrustRange : 1);
  const damage = cfg.damage * (empowered ? EMP().thrustDamage : 1);
  if (empowered) empoweredCue(player);

  system.runTimeout(() => {
    if (!canAct(player)) return;
    const dimension = player.dimension;
    const origin = player.location;
    const view = player.getViewDirection();
    const tip = spearTip(player);
    // Awakened: three stabs in a blink (the damage of all three lands as one hit)
    for (let k = 0; k < (empowered ? 3 : 1); k++) {
      system.runTimeout(() => {
        const side = { x: -direction.z * (k - 1) * 0.35, y: (k - 1) * 0.25, z: direction.x * (k - 1) * 0.35 };
        particle(dimension, P.thrust, add(tip, side), withDirection(view));
        particle(dimension, P.flash, add(add(tip, direction, 0.6), side));
        if (k) sound(dimension, "item.trident.throw", origin, 0.9 + k * 0.15);
      }, k * 3);
    }
    if (empowered) {
      for (let along = 2; along <= length; along += 2.5) shockRing(dimension, add(origin, direction, along), 1.8);
    }
    particleLine(dimension, P.spark, tip, add(tip, direction, length - 1), 1.6);
    sound(dimension, "item.trident.throw", origin, 0.8);
    sound(dimension, "random.anvil_land", origin, 1.9, 0.5);
    shake(player, 0.12, 0.15);

    const targets = getTargetsInBox(player, origin, direction, length, cfg.width);
    const aimed = aimedTarget(player, length + 1);
    if (aimed && !targets.some((e) => e.id === aimed.id)) targets.push(aimed);
    for (const target of targets) {
      // The Infinity barrier appears between the spear and the target, then shatters as the spear goes through
      const front = add(up(target.location, 1.1), direction, -0.7);
      particle(dimension, P.infinity, front);
      system.runTimeout(() => {
        particle(dimension, P.shardBlue, front);
        particle(dimension, P.flash, front);
        sound(dimension, "random.glass", front, 1.4);
      }, 2);
      nullify(target, true);
      dealDamage(player, target, damage);
      stun(target, cfg.stun);
      knockback(target, { x: direction.x * cfg.knockback, z: direction.z * cfg.knockback }, 0.25);
      particle(dimension, P.blood, up(target.location, 1));
      shake(target, 0.3, 0.25);
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

const MAX_THROW = 40; // ticks: a hurled spear always comes back after this long

function isBlocked(dimension, location) {
  try {
    const block = dimension.getBlock(location);
    return block !== undefined && !block.isAir && !block.isLiquid;
  } catch {
    return true;
  }
}

// Thousand-Mile Chain: the spear leaves the hand at once and whirls around Toji on its chain,
// hitting everything in the ring on each lap, then is hurled forward (launchChain)
function castChain(player, state) {
  const cfg = CONFIG.chain;
  startCooldown(state, "chain");
  const spinTicks = ticks(cfg.spinTime);
  const release = ticks(cfg.release);
  state.busyUntil = now() + release + MAX_THROW;
  playAnim(player, "whirl");
  sound(player.dimension, "item.trident.return", player.location, 0.6);
  releaseSpear(player, state, release + MAX_THROW);

  const dimension = player.dimension;
  const empowered = isAwake(state);
  const laps = empowered ? EMP().chainLaps : cfg.laps;
  const spinRadius = cfg.spinRadius * (empowered ? EMP().chainRadius : 1);
  if (empowered) empoweredCue(player);
  const start = Math.atan2(aimDirection(player).z, aimDirection(player).x) + Math.PI; // start behind
  const hitOnLap = new Map(); // entity id -> last lap it was hit on
  let elapsed = 0;
  const spin = system.runInterval(() => {
    if (!player.isValid || ++elapsed > spinTicks) return system.clearRun(spin);
    const progress = elapsed / spinTicks;
    const lap = Math.floor(progress * laps);
    // The chain pays out during the first half-lap, then keeps full length
    const radius = spinRadius * Math.min(1, 0.35 + progress * 2);
    const angle = start + progress * laps * Math.PI * 2;
    const center = up(player.location, 1.5);
    const head = { x: center.x + Math.cos(angle) * radius, y: center.y + 0.3 * Math.sin(angle * 2), z: center.z + Math.sin(angle) * radius };
    const tangent = { x: -Math.sin(angle), y: 0, z: Math.cos(angle) };
    particle(dimension, P.spear, head, withDirection(tangent));
    particleLine(dimension, P.chain, handLocation(player), head, 0.6);
    if (elapsed % 2 === 0) particle(dimension, P.slash, head);
    if (elapsed % 5 === 0) sound(dimension, "mob.phantom.swoop", head, 1.6, 0.8);
    if (elapsed % 3 === 0) particle(dimension, P.dust, { x: head.x, y: player.location.y + 0.1, z: head.z });

    if (empowered && elapsed % 3 === 0) particle(dimension, P.glow, head);
    for (const target of getTargetsNear(player, head, empowered ? 2.4 : 1.8)) {
      if ((hitOnLap.get(target.id) ?? -1) >= lap) continue;
      hitOnLap.set(target.id, lap);
      const away = flatUnit({ x: target.location.x - player.location.x, z: target.location.z - player.location.z }) ?? tangent;
      nullify(target);
      dealDamage(player, target, cfg.spinDamage);
      knockback(target, { x: away.x * cfg.spinKnockback, z: away.z * cfg.spinKnockback }, 0.3);
      particle(dimension, P.blood, up(target.location, 1));
      sound(dimension, "item.trident.hit", target.location, 1.1);
      shake(target, 0.2, 0.2);
    }
  }, 1);
  system.runTimeout(() => launchChain(player, state), release);
}

// The spear leaves the hand: only the chain stays until it comes back
function releaseSpear(player, state, duration = MAX_THROW) {
  state.thrownUntil = now() + duration;
  syncSpear(player);
  system.runTimeout(() => {
    if (state.thrownUntil && !isThrown(state)) returnSpear(player, state);
  }, duration + 1);
}

function returnSpear(player, state) {
  state.thrownUntil = 0;
  state.busyUntil = Math.min(state.busyUntil, now() + 2);
  if (!player.isValid) return;
  syncSpear(player);
  sound(player.dimension, "item.trident.return", player.location, 1.2);
  particle(player.dimension, P.spark, handLocation(player));
}

function launchChain(player, state) {
  if (!canAct(player)) {
    returnSpear(player, state);
    return;
  }
  const cfg = CONFIG.chain;
  const dimension = player.dimension;
  const direction = player.getViewDirection();
  let head = add(player.getHeadLocation(), direction, 0.8);
  let travelled = 0;
  releaseSpear(player, state);
  sound(dimension, "item.trident.throw", player.location, 0.7);
  sound(dimension, "mob.phantom.swoop", player.location, 0.8);
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
        chainHitTarget(player, state, target);
        if (isAwake(state)) {
          // Awakened: the chain splits and hooks the enemies around the first one too
          getTargetsNear(player, target.location, EMP().chainHookRadius)
            .filter((e) => e.id !== target.id)
            .slice(0, EMP().chainExtraHooks)
            .forEach((extra, i) => system.runTimeout(() => chainHitTarget(player, state, extra, false), 2 + i * 2));
        }
        return;
      }
      if (isBlocked(dimension, head)) {
        system.clearRun(flight);
        grapple(player, state, previous);
        return;
      }
      if (travelled >= cfg.range) {
        system.clearRun(flight);
        particle(dimension, P.dust, head);
        sound(dimension, "random.break", head, 1.2);
        // Reel the spear back in
        drawChain(player, () => head, 4);
        system.runTimeout(() => returnSpear(player, state), 4);
        return;
      }
    }
    particle(dimension, P.spear, head, withDirection(direction));
    particleLine(dimension, P.chain, handLocation(player), head, 0.55);
  }, 1);
}

// Keep the chain (and the spear at its end) drawn for a few ticks
function drawChain(player, getEnd, duration) {
  let elapsed = 0;
  const run = system.runInterval(() => {
    const end = getEnd();
    if (!player.isValid || !end || ++elapsed > duration) return system.clearRun(run);
    const hand = handLocation(player);
    particleLine(player.dimension, P.chain, hand, end, 0.45);
    particle(player.dimension, P.spear, end, withDirection({ x: end.x - hand.x, y: end.y - hand.y, z: end.z - hand.z }));
  }, 1);
}

// Spear hooks an enemy: drag it along the chain all the way to just in front of you
// owner: this hook brings the spear back when it is done (extra hooks from the awakened split do not)
function chainHitTarget(player, state, target, owner = true) {
  const cfg = CONFIG.chain;
  const dimension = player.dimension;
  nullify(target, true);
  dealDamage(player, target, cfg.damage);
  stun(target, cfg.stun + cfg.reelTime);
  particle(dimension, P.blood, up(target.location, 1));
  particle(dimension, P.flash, up(target.location, 1));
  sound(dimension, "item.trident.hit", target.location, 0.8);
  sound(dimension, "random.anvil_land", target.location, 1.6, 0.5);
  shake(target, 0.3, 0.25);
  shake(player, 0.15, 0.15);

  const reel = ticks(cfg.reelTime);
  const from = { ...target.location };
  let elapsed = 0;
  const run = system.runInterval(() => {
    if (!player.isValid || !target.isValid || ++elapsed > reel) {
      system.clearRun(run);
      if (owner) returnSpear(player, state);
      return;
    }
    // Destination: 1.5 blocks in front of you (follows you if you move); a small hop on the way
    const dest = add(player.location, aimDirection(player), 1.5);
    const t = elapsed / reel;
    const ease = 1 - (1 - t) * (1 - t);
    const at = {
      x: from.x + (dest.x - from.x) * ease,
      y: from.y + (dest.y - from.y) * ease + Math.sin(t * Math.PI) * 1.2,
      z: from.z + (dest.z - from.z) * ease,
    };
    if (isFree(dimension, at)) moveTo(target, at, up(player.location, 1));
    const hand = handLocation(player);
    particleLine(dimension, P.chain, hand, up(target.location, 1), 0.45);
    particle(dimension, P.spear, up(target.location, 1), withDirection({ x: target.location.x - hand.x, y: 0, z: target.location.z - hand.z }));
    if (elapsed % 2 === 0) particle(dimension, P.dust, up(target.location, 0.1));
    if (elapsed % 4 === 1) sound(dimension, "random.break", target.location, 0.7, 0.6);
    if (elapsed === reel) {
      particle(dimension, P.flash, up(target.location, 1));
      sound(dimension, "item.trident.hit", target.location, 0.6);
      shake(player, 0.2, 0.15);
    }
  }, 1);
}

// Spear sticks in a wall/ground: swing yourself along the chain to it (an arc, like swinging on a rope)
function grapple(player, state, point) {
  const cfg = CONFIG.chain;
  const dimension = player.dimension;
  particle(dimension, P.dust, point);
  particle(dimension, P.spark, point);
  crater(dimension, point, 1.2);
  sound(dimension, "item.trident.hit_ground", point, 0.8);
  shake(player, 0.15, 0.15);

  const from = { ...player.location };
  // Stop a block short of the spear, feet below it
  const back = flatUnit({ x: from.x - point.x, z: from.z - point.z }) ?? { x: 0, y: 0, z: 0 };
  let dest = add({ x: point.x, y: point.y - 1, z: point.z }, back, 1);
  if (!isFree(dimension, dest)) dest = add(dest, { x: 0, y: 1, z: 0 });
  const swing = ticks(cfg.swingTime);
  const lift = Math.max(1.5, Math.hypot(dest.x - from.x, dest.z - from.z) * 0.2);
  sound(dimension, "mob.phantom.swoop", from, 1.1);
  let elapsed = 0;
  const run = system.runInterval(() => {
    if (!player.isValid || ++elapsed > swing) {
      system.clearRun(run);
      if (player.isValid) addEffect(player, "slow_falling", 10);
      returnSpear(player, state);
      return;
    }
    const t = elapsed / swing;
    const ease = t * t * (3 - 2 * t);
    const at = {
      x: from.x + (dest.x - from.x) * ease,
      y: from.y + (dest.y - from.y) * ease + Math.sin(t * Math.PI) * lift,
      z: from.z + (dest.z - from.z) * ease,
    };
    if (isFree(dimension, at)) {
      try {
        player.teleport(at);
      } catch {
        // ignore
      }
    }
    particleLine(dimension, P.chain, handLocation(player), point, 0.45);
    particle(dimension, P.spear, point, withDirection({ x: point.x - player.location.x, y: point.y - player.location.y - 1, z: point.z - player.location.z }));
    if (elapsed % 2 === 0) particle(dimension, P.afterimage, up(player.location, 0.9));
  }, 1);
}

// ---------------------------------------------------------------------------
// Sprint + attack — Heavenly Ambush
// ---------------------------------------------------------------------------

// The enemy you look at: under the crosshair first, else the closest one inside a narrow cone
function ambushTarget(player, range) {
  const aimed = aimedTarget(player, range);
  if (aimed) return aimed;
  const eye = player.getHeadLocation();
  const view = player.getViewDirection();
  let best;
  let bestScore = Infinity;
  for (const entity of getTargetsNear(player, player.location, range)) {
    const to = { x: entity.location.x - eye.x, y: entity.location.y + 1 - eye.y, z: entity.location.z - eye.z };
    const distance = Math.hypot(to.x, to.y, to.z);
    const dot = (to.x * view.x + to.y * view.y + to.z * view.z) / (distance || 1);
    if (dot < 0.9) continue;
    const score = distance * (2 - dot);
    if (score < bestScore) {
      bestScore = score;
      best = entity;
    }
  }
  return best;
}

function isFree(dimension, location) {
  return !isBlocked(dimension, location) && !isBlocked(dimension, up(location, 1));
}

function castRush(player, state, direction) {
  const cfg = CONFIG.rush;
  const dimension = player.dimension;
  const target = ambushTarget(player, cfg.range);
  startCooldown(state, "rush");
  // Vanish: smoke and an afterimage stay where Toji was
  particle(dimension, P.vanish, up(player.location, 1));
  particle(dimension, P.afterimage, up(player.location, 0.9));
  sound(dimension, "mob.phantom.swoop", player.location, 1.8);
  sound(dimension, "mob.endermen.portal", player.location, 1.6, 0.5);

  if (!target) {
    // Nobody in sight: a vanishing dash
    state.busyUntil = now() + 6;
    knockback(player, { x: direction.x * cfg.strength, z: direction.z * cfg.strength }, cfg.vertical);
    let count = 0;
    const trail = system.runInterval(() => {
      if (!player.isValid || ++count > 6) return system.clearRun(trail);
      if (count % 2 === 0) particle(player.dimension, P.afterimage, up(player.location, 0.9));
    }, 1);
    return;
  }

  if (isAwake(state)) empoweredCue(player);
  ambushStrike(player, state, target, isAwake(state) ? EMP().ambushChain - 1 : 0, new Set());
}

// Reappear behind `target`, cut an X into its back; awakened: jump on to the next enemy's back
function ambushStrike(player, state, target, remaining, visited) {
  const cfg = CONFIG.rush;
  const dimension = player.dimension;
  if (!player.isValid || !target.isValid) return;
  visited.add(target.id);
  const direction = aimDirection(player);
  const toTarget = flatUnit({ x: target.location.x - player.location.x, z: target.location.z - player.location.z }) ?? direction;
  let spot = add(target.location, toTarget, cfg.behind);
  if (!isFree(dimension, spot)) spot = add(target.location, { x: -toTarget.z, y: 0, z: toTarget.x }, cfg.behind); // side
  if (!isFree(dimension, spot)) spot = add(target.location, toTarget, -cfg.behind); // in front
  const trail = player.location;
  try {
    player.teleport(spot, { facingLocation: up(target.location, 1) });
  } catch {
    return;
  }
  particleLine(dimension, P.afterimage, up(trail, 0.9), up(spot, 0.9), 1.4);
  particle(dimension, P.vanish, up(spot, 1));
  playAnim(player, "ambush");
  stun(target, cfg.stun + cfg.cuts[cfg.cuts.length - 1]);
  const lastCut = ticks(cfg.cuts[cfg.cuts.length - 1]);
  state.busyUntil = now() + lastCut + 6;

  // Two cuts crossing into an X; the damage lands once on the second one
  // (mobs are briefly invulnerable after a hit, so two separate hits would lose one)
  const back = { x: -toTarget.x, y: 0, z: -toTarget.z };
  cfg.cuts.forEach((at, i) => {
    system.runTimeout(() => {
      if (!player.isValid || !target.isValid) return;
      const where = add(up(target.location, 1.1), back, 0.3);
      particle(dimension, P.slash, where);
      particle(dimension, P.spark, where);
      sound(dimension, "item.trident.hit", target.location, 1.2 + i * 0.3);
      if (i < cfg.cuts.length - 1) return;
      particle(dimension, P.xSlash, where, withRadius(2.6));
      particle(dimension, P.flash, where);
      particle(dimension, P.blood, where);
      nullify(target, true);
      dealDamage(player, target, cfg.damage * cfg.cuts.length);
      knockback(target, { x: toTarget.x * 0.9, z: toTarget.z * 0.9 }, 0.35);
      sound(dimension, "random.anvil_land", target.location, 1.8, 0.6);
      shake(target, 0.35, 0.3);
      shake(player, 0.2, 0.15);
      if (remaining > 0) {
        const next = getTargetsNear(player, target.location, EMP().ambushHop)
          .filter((e) => !visited.has(e.id))
          .sort((a, b) => horizontalDistance(a.location, target.location) - horizontalDistance(b.location, target.location))[0];
        if (next) system.runTimeout(() => ambushStrike(player, state, next, remaining - 1, visited), 2);
      }
    }, ticks(at));
  });
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
  syncSpear(player);
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
    player.onScreenDisplay.setTitle(tr("toji.title.awaken"), {
      subtitle: tr("toji.title.awaken_hint"),
      fadeInDuration: 5,
      stayDuration: 40,
      fadeOutDuration: 15,
    });
  } catch {
    // ignore
  }
}

// The Inventory Curse worm coiling around the body while awakened is a 3D model: it is part of the awakened
// spear's attachable (bound to the player's body bone, see model.py worm_bones and packs.py).

// Let go of the spear while awakened: the awakening and its buffs end
function endAwakeningEarly(player, state) {
  state.awakeUntil = 0;
  state.holdTicks = 0;
  if (state.plunging) return;
  for (const id of AWAKEN_EFFECTS) removeEffect(player, id);
  sound(player.dimension, "random.fizz", player.location, 1.4, 0.5);
}

// ---------------------------------------------------------------------------
// Held 20 s + jump — Sorcerer Killer: Heaven's Execution
// ---------------------------------------------------------------------------

function moveTo(entity, spot, facing) {
  try {
    entity.teleport(spot, facing ? { facingLocation: facing } : undefined);
    return true;
  } catch {
    return false;
  }
}

// Slot i of the ring the victims hang in, turning slowly
function ringSpot(center, cfg, i, count, t) {
  const angle = (i / count) * Math.PI * 2 + t * 0.03;
  return { x: center.x + Math.cos(angle) * cfg.ringRadius, y: center.y + cfg.ringHeight, z: center.z + Math.sin(angle) * cfg.ringRadius };
}

function castPlunge(player, state) {
  const cfg = CONFIG.plunge;
  const dimension = player.dimension;
  const center = { ...player.location };
  const view = player.getViewDirection();
  const victims = getTargetsNear(player, center, cfg.radius)
    .sort((a, b) => horizontalDistance(a.location, center) - horizontalDistance(b.location, center))
    .slice(0, cfg.maxTargets);
  const lift = ticks(cfg.liftTime);
  const pierces = victims.length * cfg.pierceRounds;
  const pierceEnd = lift + 6 + pierces * cfg.pierceInterval;
  const total = pierceEnd + 14;
  state.plungeUsed = true;
  state.plunging = true;
  state.busyUntil = now() + total + 30;
  addEffect(player, "resistance", total + 40, 4); // untouchable, no fall damage
  for (const v of victims) stun(v, total / TPS + cfg.stun);

  // Phase 1 — the worm opens, chains shoot out and hook every victim
  playAnim(player, "chain_summon");
  flashScreen(player, 0.3, 0.2, 0.5);
  shake(player, 0.4, 0.5);
  sound(dimension, "mob.ravager.roar", center, 0.9);
  sound(dimension, "item.trident.thunder", center, 1.6, 0.5);
  particle(dimension, P.nullGround, up(center, 0.08), withRadius(cfg.radius * 1.4));
  for (let i = 0; i < 3; i++) system.runTimeout(() => shockRing(dimension, center, 3 + i * 3), i * 3);

  const starts = new Map(victims.map((v) => [v.id, { ...v.location }]));
  const tally = new Map();
  let elapsed = 0;
  let pierce = 0;
  let previous = { ...center };
  const run = system.runInterval(() => {
    elapsed++;
    if (!player.isValid) {
      state.plunging = false;
      return system.clearRun(run);
    }
    const alive = victims.filter((v) => v.isValid);
    const t = now();

    // Victims are dragged up into the ring, then held there (turning slowly) until the slam
    alive.forEach((v, i) => {
      const slot = ringSpot(center, cfg, victims.indexOf(v), victims.length, t);
      if (elapsed <= lift) {
        const from = starts.get(v.id);
        const k = elapsed / lift;
        const ease = k * k * (3 - 2 * k);
        const at = { x: from.x + (slot.x - from.x) * ease, y: from.y + (slot.y - from.y) * ease, z: from.z + (slot.z - from.z) * ease };
        moveTo(v, at, up(center, 1));
        if (elapsed % 2 === 0) particleLine(dimension, P.chain, up(center, 1.6), up(v.location, 1), 0.6);
        if (elapsed === 1) {
          particle(dimension, P.flash, up(v.location, 1));
          sound(dimension, "item.trident.hit", v.location, 0.8);
        }
      } else if (elapsed < pierceEnd) {
        moveTo(v, slot, up(center, cfg.ringHeight));
        if (elapsed % 6 === i % 6) particleLine(dimension, P.chain, up(center, 1.6), up(v.location, 1), 0.9);
      }
    });
    if (elapsed === lift) sound(dimension, "random.break", center, 0.5);

    // Phase 2 — Toji flies up and pierces through each of them, round after round
    if (elapsed === lift + 3) {
      playAnim(player, "leap_cut");
      moveTo(player, up(center, cfg.ringHeight), undefined);
      particle(dimension, P.vanish, up(center, 1));
      sound(dimension, "mob.phantom.swoop", center, 0.8);
      previous = up(center, cfg.ringHeight);
    }
    if (elapsed > lift + 6 && elapsed <= pierceEnd && (elapsed - lift - 6) % cfg.pierceInterval === 0 && alive.length) {
      const v = alive[pierce % alive.length];
      // Stab through from the inside of the ring out: land on the far side of the victim
      const out = flatUnit({ x: v.location.x - center.x, z: v.location.z - center.z }) ?? { x: 1, y: 0, z: 0 };
      const spot = add(v.location, out, 1.3 * (pierce % 2 ? 1 : -1));
      particleLine(dimension, P.afterimage, up(previous, 0.9), up(spot, 0.9), 2);
      moveTo(player, spot, up(v.location, 1));
      previous = spot;
      playAnim(player, pierce % 3 === 2 ? "ambush" : pierce % 2 ? "cut_b" : "cut_a");
      const at = up(v.location, 1);
      particle(dimension, P.thrust, at, withDirection({ x: v.location.x - spot.x, y: 0, z: v.location.z - spot.z }));
      particle(dimension, pierce % 3 === 2 ? P.xSlash : P.slash, at, withRadius(2));
      particle(dimension, P.spark, at);
      if (pierce % 2 === 0) particle(dimension, P.blood, at);
      if (pierce < victims.length) {
        particle(dimension, P.infinity, at);
        system.runTimeout(() => particle(dimension, P.shardBlue, at), 2);
      }
      tally.set(v.id, (tally.get(v.id) ?? 0) + 1);
      sound(dimension, "item.trident.hit", v.location, 1 + (pierce % 5) * 0.12, 0.8);
      if (pierce % 3 === 0) sound(dimension, "mob.phantom.swoop", spot, 1.5, 0.6);
      pierce++;
    }

    // Phase 3 — rise above them all, then slam everyone into the ground
    if (elapsed === pierceEnd + 2) {
      moveTo(player, up(center, cfg.ringHeight + 3), add(up(center, 0), view, 3));
      playAnim(player, "aerial_slam");
      particle(dimension, P.charge, up(center, cfg.ringHeight + 3.5));
      sound(dimension, "item.trident.return", center, 0.5);
    }
    if (elapsed === total) {
      system.clearRun(run);
      executionSlam(player, state, center, view, victims, tally);
    }
  }, 1);
}

function executionSlam(player, state, center, view, victims, tally) {
  const cfg = CONFIG.plunge;
  const dimension = player.dimension;
  moveTo(player, center, add(up(center, 1.6), view, 5));
  playAnim(player, "rampage_end");
  flashScreen(player, 1, 1, 1);
  shake(player, 0.7, 0.7);
  sound(dimension, "random.explode", center, 0.6);
  sound(dimension, "item.trident.thunder", center, 1.1, 0.7);
  sound(dimension, "random.anvil_land", center, 0.5);
  crater(dimension, center, cfg.radius);
  system.runTimeout(() => crater(dimension, center, cfg.radius * 1.5), 4);
  particle(dimension, P.nullGround, up(center, 0.1), withRadius(cfg.radius * 2));
  particle(dimension, P.xSlash, up(center, 1.5), withRadius(6));
  particle(dimension, P.shardBlue, up(center, 1.5));
  for (let i = 0; i < 4; i++) system.runTimeout(() => shockRing(dimension, center, 4 + i * 4), i * 3);

  victims.forEach((v, i) => {
    if (!v.isValid) return;
    // Slammed straight down onto the ground ring
    const angle = (i / victims.length) * Math.PI * 2;
    const spot = { x: center.x + Math.cos(angle) * cfg.ringRadius, y: center.y, z: center.z + Math.sin(angle) * cfg.ringRadius };
    moveTo(v, isFree(dimension, spot) ? spot : { ...center }, undefined);
    crater(dimension, spot, 2);
    particle(dimension, P.xSlash, up(spot, 1), withRadius(3));
    particle(dimension, P.blood, up(spot, 1));
    particle(dimension, P.debris, up(spot, 0.2));
    nullify(v, true);
    dealDamage(player, v, (tally.get(v.id) ?? 0) * cfg.damagePerPierce + cfg.slamDamage);
    shake(v, 0.6, 0.5);
  });

  system.runTimeout(() => {
    state.plunging = false;
    state.busyUntil = now() + 4;
    if (!player.isValid) return;
    removeEffect(player, "resistance");
    const left = state.awakeUntil - now();
    if (left > 0) addEffect(player, "resistance", left, CONFIG.awaken.resistanceAmplifier);
    else for (const id of AWAKEN_EFFECTS) removeEffect(player, id);
  }, 24);
}

// ---------------------------------------------------------------------------
// Jump + attack — Sky Splitter / Crouch + attack — Low Sweep
// ---------------------------------------------------------------------------

function jumpAttack(player, state, target) {
  const cfg = CONFIG.jumpAttack;
  startCooldown(state, "jumpAttack");
  state.busyUntil = now() + 6;
  playAnim(player, "aerial_slam");
  const dimension = player.dimension;
  knockback(player, { x: 0, z: 0 }, -cfg.dive);
  system.runTimeout(() => {
    if (!player.isValid || !target.isValid) return;
    const at = target.location;
    const empowered = isAwake(state);
    const radius = cfg.radius * (empowered ? EMP().jumpRadius : 1);
    if (empowered) {
      empoweredCue(player);
      for (let i = 1; i <= 2; i++) system.runTimeout(() => shockRing(dimension, at, radius + 1 + i * 2), i * 3);
      system.runTimeout(() => crater(dimension, at, radius * 1.5), 3);
    }
    knockback(target, { x: 0, z: 0 }, -1.5); // driven into the ground
    stun(target, 0.5);
    nullify(target);
    dealDamage(player, target, cfg.damage);
    crater(dimension, at, 2.4);
    shockRing(dimension, at, radius + 1);
    particle(dimension, P.xSlash, up(at, 1), withRadius(2.2));
    particle(dimension, P.blood, up(at, 1));
    sound(dimension, "random.anvil_land", at, 0.8);
    sound(dimension, "item.trident.hit_ground", at, 0.7);
    shake(player, 0.3, 0.25);
    shake(target, 0.4, 0.3);
    for (const other of getTargetsNear(player, at, radius)) {
      if (other.id === target.id) continue;
      dealDamage(player, other, empowered ? cfg.damage : cfg.splashDamage);
      knockback(other, { x: 0, z: 0 }, empowered ? 0.8 : 0.4);
    }
  }, 3);
}

function crouchAttack(player, state) {
  const cfg = CONFIG.crouchAttack;
  startCooldown(state, "crouchAttack");
  state.busyUntil = now() + 8;
  playAnim(player, "low_sweep");
  const dimension = player.dimension;
  const direction = aimDirection(player);
  const right = { x: -direction.z, y: 0, z: direction.x };
  const empowered = isAwake(state);
  const arc = empowered ? EMP().sweepArc : cfg.arc;
  const radius = cfg.radius * (empowered ? EMP().sweepRadius : 1);
  const launch = cfg.launch * (empowered ? EMP().sweepLaunch : 1);
  if (empowered) empoweredCue(player);
  sound(dimension, "mob.phantom.swoop", player.location, 1.7, 0.8);
  // Low sweep at the ankles, then the upward flick launches everything it caught
  system.runTimeout(() => {
    if (!canAct(player)) return;
    const origin = player.location;
    const count = empowered ? 10 : 5;
    for (let i = 0; i < count; i++) {
      const angle = ((i / (count - 1)) * 2 - 1) * ((arc / 2) * Math.PI) / 180;
      const d = add({ x: direction.x * Math.cos(angle), y: 0, z: direction.z * Math.cos(angle) }, right, Math.sin(angle));
      system.runTimeout(() => {
        particle(dimension, P.slash, up(add(origin, d, radius * 0.63), 0.4));
        particle(dimension, P.dust, up(add(origin, d, radius * 0.63), 0.1));
      }, Math.floor(i / 2));
    }
    if (empowered) shockRing(dimension, origin, radius + 1);
    for (const target of getTargetsInArc(player, origin, direction, radius, arc)) {
      nullify(target);
      dealDamage(player, target, cfg.damage);
      stun(target, cfg.stun);
      particle(dimension, P.spark, up(target.location, 0.4));
      system.runTimeout(() => {
        if (!target.isValid) return;
        knockback(target, { x: 0, z: 0 }, launch);
        particle(dimension, P.slash, up(target.location, 1.2));
        particle(dimension, P.flash, up(target.location, 1));
        sound(dimension, "item.trident.hit", target.location, 1.3);
      }, 2);
    }
    shake(player, 0.15, 0.15);
  }, 2);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const INTERACTIVE_BLOCK =
  /door|gate|button|lever|chest|barrel|shulker|furnace|smoker|crafting|crafter|anvil|table|:bed$|bell|hopper|dispenser|dropper|loom|grindstone|stonecutter|beacon|lectern|repeater|comparator|noteblock|jukebox|cake|campfire|anchor|lodestone|composter|cauldron|brewing|sign|frame|vault|chiseled_bookshelf|decorated_pot/;
const INTERACTIVE_ENTITY = new Set(["minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader", "minecraft:armor_stand"]);

// Skill cast by right-click, depending on the stance
function chooseSkill(player) {
  if (player.isSneaking) return "chain";
  if (player.isSprinting) return "rush";
  return "thrust";
}

function notify(state, message, seconds = 1.2) {
  state.notice = message;
  state.noticeUntil = now() + ticks(seconds);
}

// forced: skill fixed by the input (rush on sprint-attack); quiet: no cooldown message
function trySkill(player, forced, quiet = false) {
  if (!canAct(player)) return;
  const state = getState(player);
  if (now() - state.lastUse < 4) return; // one press can fire several events
  state.lastUse = now();
  if (isStunned(player)) return notify(state, tr("toji.notice.stunned"));
  if (now() < state.busyUntil || state.plunging || isThrown(state)) return;

  const skill = forced ?? chooseSkill(player);
  const left = state.cd[skill] - now();
  if (left > 0) {
    if (quiet) return;
    try {
      player.playSound("note.bass", { pitch: 0.6, volume: 0.7 });
    } catch {
      // ignore
    }
    return notify(state, tr("toji.notice.cooldown", shortName(skill), (left / TPS).toFixed(1)));
  }

  const direction = aimDirection(player);
  if (skill === "chain") castChain(player, state);
  else if (skill === "rush") castRush(player, state, direction);
  else castThrust(player, state, direction);
  notify(state, tr("toji.notice.cast", skillName(skill)));
}

// Right-click / tap into the air
world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (isSpearId(itemStack?.typeId)) trySkill(source);
});

// Right-click / tap while aiming at a block (ground, wall...)
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (!isSpearId(event.itemStack?.typeId) || event.isFirstEvent === false) return;
  if (INTERACTIVE_BLOCK.test(event.block.typeId)) return;
  const player = event.player;
  system.run(() => trySkill(player));
});

// Right-click / hold on a mob
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  if (!isSpearId(event.itemStack?.typeId)) return;
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

// Jump while awakened (held 20 s): Heaven-Splitting Plunge
world.afterEvents.playerButtonInput.subscribe(({ player, button, newButtonState }) => {
  if (button !== InputButton.Jump || newButtonState !== ButtonState.Pressed) return;
  if (!canAct(player) || isStunned(player)) return;
  const state = getState(player);
  if (!isAwake(state) || state.plungeUsed || state.plunging || isThrown(state) || now() < state.busyUntil) return;
  castPlunge(player, state);
  notify(state, tr("toji.notice.cast_ult", skillName("plunge")));
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  states.delete(playerId);
  greeted.delete(playerId);
});

// ---------------------------------------------------------------------------
// Guide
// ---------------------------------------------------------------------------

function sendGuide(player) {
  for (let i = 0; i <= 8; i++) player.sendMessage(tr(`toji.guide.${i}`));
}

function ensureLore(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    const item = equippable?.getEquipment(EquipmentSlot.Mainhand);
    const lore = loreLines();
    if (!isSpearId(item?.typeId) || item.getLore().join("\n") === lore.join("\n")) return;
    item.setLore(lore);
    equippable.setEquipment(EquipmentSlot.Mainhand, item);
  } catch {
    // ignore
  }
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id === "toji:help" && sourceEntity?.typeId === "minecraft:player") sendGuide(sourceEntity);
});

// ---------------------------------------------------------------------------
// Main loop: hold timer, awakening, spear variant, action bar
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

function actionBar(player, state, t) {
  const parts = [];
  if (isAwake(state)) {
    parts.push(tr("toji.bar.awake", String(Math.ceil((state.awakeUntil - t) / TPS))));
    parts.push(tr(state.plungeUsed ? "toji.bar.plunge_used" : "toji.bar.plunge_ready"));
  } else {
    parts.push(tr("toji.bar.hold", holdBar(state)));
  }
  if (t < state.noticeUntil && state.notice) parts.push(state.notice);
  else if (isThrown(state)) parts.push(tr("toji.bar.thrown"));
  else if (state.combo > 0 && t - state.lastHit <= ticks(CONFIG.combo.window)) parts.push(tr("toji.bar.combo", String(state.combo)));
  else parts.push(tr("toji.bar.press", shortName(chooseSkill(player))));
  for (const skill of SKILLS) {
    parts.push({ rawtext: [{ text: "§b" }, shortName(skill), { text: ` ${formatCooldown(state.cd[skill] - t)}` }] });
  }
  const rawtext = [];
  parts.forEach((part, i) => {
    if (i) rawtext.push({ text: "§r  " });
    rawtext.push(part);
  });
  return { rawtext };
}

system.runInterval(() => {
  const t = now();
  for (const player of world.getAllPlayers()) {
    const existing = states.get(player.id);
    const holding = holdsSpear(player) && (getHealth(player)?.currentValue ?? 0) > 0;

    if (!holding) {
      // Letting go of the spear resets the hold timer and ends the awakening
      if (existing) {
        existing.holdTicks = 0;
        existing.combo = 0;
        if (isAwake(existing)) endAwakeningEarly(player, existing);
      }
      syncSpear(player);
      continue;
    }
    const state = existing ?? getState(player);

    if (!greeted.has(player.id)) {
      greeted.add(player.id);
      sendGuide(player);
      try {
        player.onScreenDisplay.setTitle(tr("toji.title.name"), {
          subtitle: tr("toji.title.hint"),
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

    if (isAwake(state)) {
      particle(player.dimension, P.aura, player.location);
      if (t % 20 === 0 && !isThrown(state)) particle(player.dimension, P.spark, spearTip(player, 0.9));
    } else {
      if (state.awakeUntil) {
        // Awakening just ran out
        state.awakeUntil = 0;
        state.holdTicks = 0;
        sound(player.dimension, "random.fizz", player.location, 1.4, 0.5);
      }
      state.holdTicks += LOOP;
      const need = ticks(CONFIG.awaken.holdTime);
      if (state.holdTicks >= need - 20 && state.holdTicks < need && t % 10 === 0) {
        particle(player.dimension, P.charge, up(player.location, 1));
      }
      if (state.holdTicks >= need && !state.plunging && !isThrown(state)) awaken(player, state);
    }
    syncSpear(player);
    player.onScreenDisplay.setActionBar(actionBar(player, state, t));
  }

  for (const [id, until] of stunnedUntil) {
    if (until <= t) stunnedUntil.delete(id);
  }
}, LOOP);
