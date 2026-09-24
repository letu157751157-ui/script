// Quỷ Kiếm Darkin — bộ chiêu Aatrox cho Minecraft Bedrock (Script API @minecraft/server 2.x)
//
// Cầm kiếm rồi:
//   Đánh thường          Nội tại Tư Thế Tử Thần (khi sẵn sàng)
//   Chuột phải           Q  Quỷ Kiếm Darkin (3 lần chém)
//   Ngồi + chuột phải    E  Bước Nhảy Hắc Ám
//   Nhảy + chuột phải    W  Xiềng Xích Địa Ngục
//   Nhìn lên + chuột phải R Kẻ Diệt Thế

import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { CONFIG } from "./config.js";

const ITEM_ID = "aatrox:darkin_blade";
const TPS = 20;
const SKILLS = ["Q", "E", "W", "R"];

const P = {
  flame: "minecraft:basic_flame_particle",
  lava: "minecraft:lava_particle",
  crit: "minecraft:critical_hit_emitter",
  boom: "minecraft:large_explosion",
  bigBoom: "minecraft:huge_explosion_emitter",
  heart: "minecraft:heart_particle",
  angry: "minecraft:villager_angry",
  smoke: "minecraft:basic_smoke_particle",
};

const ticks = (seconds) => Math.max(1, Math.round(seconds * TPS));
const now = () => system.currentTick;

// ---------------------------------------------------------------------------
// Trạng thái từng người chơi
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
// Tiện ích
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
    return item?.typeId === ITEM_ID;
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

function particle(dimension, id, location) {
  try {
    dimension.spawnParticle(id, location);
  } catch {
    // chunk chưa tải hoặc particle không tồn tại: bỏ qua
  }
}

function sound(dimension, id, location, pitch = 1) {
  try {
    dimension.playSound(id, location, { pitch, volume: 1 });
  } catch {
    // bỏ qua
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

function particleRing(dimension, id, center, radius, count = Math.ceil(radius * 6)) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    particle(dimension, id, { x: center.x + Math.cos(angle) * radius, y: center.y, z: center.z + Math.sin(angle) * radius });
  }
}

// ---------------------------------------------------------------------------
// Mục tiêu, sát thương, khống chế
// ---------------------------------------------------------------------------

function isTarget(player, entity) {
  if (!entity.isValid || entity.id === player.id) return false;
  if (entity.typeId === "minecraft:player" && !CONFIG.pvp) return false;
  const health = getHealth(entity);
  if (!health || health.currentValue <= 0) return false;
  try {
    // Không đánh thú cưng của chính mình
    if (entity.getComponent("minecraft:tameable")?.tamedToPlayerId === player.id) return false;
  } catch {
    // bỏ qua
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

// Mục tiêu trong hình hộp phía trước: dài `length`, rộng `width`
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
    return target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
  } catch {
    return false;
  }
}

function heal(player, amount) {
  const health = getHealth(player);
  if (!health || amount <= 0 || health.currentValue <= 0) return;
  if (isUltActive(getState(player))) amount *= CONFIG.R.healMultiplier;
  health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
}

function stun(entity, seconds) {
  if (!entity.isValid) return;
  const duration = ticks(seconds);
  stunnedUntil.set(entity.id, now() + duration);
  try {
    entity.addEffect("slowness", duration, { amplifier: 255, showParticles: false });
  } catch {
    // bỏ qua
  }
  particleRing(entity.dimension, P.angry, add(entity.location, { x: 0, y: 2.2, z: 0 }), 0.5, 4);
}

function knockback(entity, direction, strength, vertical) {
  try {
    entity.applyKnockback({ x: direction.x * strength, z: direction.z * strength }, vertical);
  } catch {
    // một số entity không bị đẩy được
  }
}

// ---------------------------------------------------------------------------
// Nội tại — Tư Thế Tử Thần
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
  particle(target.dimension, P.lava, add(target.location, { x: 0, y: 1, z: 0 }));

  // Nổ sau khi hết thời gian bất tử của đòn đánh thường
  system.runTimeout(() => {
    if (!player.isValid || !target.isValid) return;
    dealDamage(player, target, bonus);
    heal(player, bonus * cfg.healRatio);
    particle(target.dimension, P.boom, add(target.location, { x: 0, y: 1, z: 0 }));
    sound(target.dimension, "random.anvil_land", target.location, 1.6);
  }, ticks(cfg.delay));
});

// Hút máu cho mọi sát thương gây ra khi đang cầm kiếm
world.afterEvents.entityHurt.subscribe(({ damageSource, damage, hurtEntity }) => {
  const player = damageSource.damagingEntity;
  if (!player || player.typeId !== "minecraft:player" || player.id === hurtEntity.id) return;
  if (!holdsBlade(player)) return;
  heal(player, damage * CONFIG.lifesteal);
});

// ---------------------------------------------------------------------------
// Q — Quỷ Kiếm Darkin
// ---------------------------------------------------------------------------

function drawQTelegraph(player, cast, direction) {
  const dimension = player.dimension;
  const ground = add(player.location, { x: 0, y: 0.1, z: 0 });

  if (cast.shape === "circle") {
    const center = add(ground, direction, cast.offset);
    particleRing(dimension, P.lava, center, cast.radius);
    particleRing(dimension, P.flame, center, cast.radius - cast.sweet);
    particle(dimension, P.flame, center);
    return;
  }

  const right = { x: -direction.z, y: 0, z: direction.x };
  for (let along = 1; along <= cast.length; along += 0.8) {
    const isSweet = along >= cast.length - cast.sweet;
    for (let side = -cast.width / 2; side <= cast.width / 2 + 0.01; side += 1.2) {
      const point = add(add(ground, direction, along), right, side);
      particle(dimension, isSweet ? P.lava : P.flame, point);
    }
  }
}

function castQ(player, state, direction) {
  const cfg = CONFIG.Q;
  const t = now();
  if (t < state.busyUntil) return;
  if (state.qStage === 1 && t < state.cd.Q) return;

  const stage = state.qStage;
  const cast = cfg.casts[stage - 1];
  const windup = ticks(cfg.windup);
  state.busyUntil = t + windup + 2;
  const token = ++state.qToken;

  if (stage < cfg.casts.length) {
    const window = windup + ticks(cfg.recastWindow);
    state.qStage = stage + 1;
    state.qWindowEnd = t + window;
    // Hết thời gian mà không chém tiếp thì bắt đầu hồi chiêu
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
    // bỏ qua
  }
  sound(player.dimension, "item.trident.throw", player.location, 0.6);
  drawQTelegraph(player, cast, direction);
  system.runTimeout(() => player.isValid && drawQTelegraph(player, cast, direction), Math.floor(windup / 2));
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
    particle(dimension, P.bigBoom, add(center, { x: 0, y: 0.5, z: 0 }));
  } else {
    targets = getTargetsInBox(player, origin, direction, cast.length, cast.width);
    isSweetSpot = (entity) => {
      const along = (entity.location.x - origin.x) * direction.x + (entity.location.z - origin.z) * direction.z;
      return along >= cast.length - cast.sweet;
    };
    particleLine(dimension, P.crit, add(origin, { x: 0, y: 1, z: 0 }), add(add(origin, direction, cast.length), { x: 0, y: 1, z: 0 }), 1);
    particle(dimension, P.boom, add(add(origin, direction, cast.length - cast.sweet / 2), { x: 0, y: 0.5, z: 0 }));
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
      particle(dimension, P.lava, add(target.location, { x: 0, y: 1, z: 0 }));
    }
    particle(dimension, P.crit, add(target.location, { x: 0, y: 1, z: 0 }));
    dealDamage(player, target, damage);
  }

  const state = getState(player);
  if (hitSweetSpot && !isPassiveReady(state)) {
    state.passiveReadyAt -= ticks(CONFIG.passive.sweetSpotReduction);
  }
}

// ---------------------------------------------------------------------------
// E — Bước Nhảy Hắc Ám
// ---------------------------------------------------------------------------

function castE(player, state, direction) {
  const cfg = CONFIG.E;
  if (now() < state.cd.E) return;
  startCooldown(state, "E");
  knockback(player, direction, cfg.strength, cfg.vertical);
  sound(player.dimension, "item.trident.riptide_1", player.location, 1.2);

  let count = 0;
  const trail = system.runInterval(() => {
    if (!player.isValid || ++count > 6) return system.clearRun(trail);
    particle(player.dimension, P.smoke, add(player.location, { x: 0, y: 0.8, z: 0 }));
    particle(player.dimension, P.flame, add(player.location, { x: 0, y: 1.2, z: 0 }));
  }, 1);
}

// ---------------------------------------------------------------------------
// W — Xiềng Xích Địa Ngục
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
  const cfg = CONFIG.W;
  const t = now();
  if (t < state.busyUntil || t < state.cd.W) return;
  startCooldown(state, "W");
  state.busyUntil = t + 4;
  sound(player.dimension, "mob.blaze.shoot", player.location, 0.7);

  const dimension = player.dimension;
  let head = add(player.location, { x: 0, y: 1.3, z: 0 });
  let travelled = 0;

  const flight = system.runInterval(() => {
    if (!player.isValid) return system.clearRun(flight);
    // Chia nhỏ bước để không xuyên qua mục tiêu / tường
    for (let step = 0; step < 3; step++) {
      head = add(head, direction, cfg.speed / 3);
      travelled += cfg.speed / 3;
      particle(dimension, P.flame, head);

      const target = getTargetsNear(player, head, cfg.hitRadius)[0];
      if (target) {
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
  try {
    target.addEffect("slowness", pullTick, { amplifier: cfg.slowAmplifier, showParticles: false });
  } catch {
    // bỏ qua
  }

  let elapsed = 0;
  const run = system.runInterval(() => {
    elapsed++;
    if (!player.isValid || !target.isValid || (getHealth(target)?.currentValue ?? 0) <= 0) {
      return system.clearRun(run);
    }
    // Mục tiêu chạy ra khỏi vòng trói: xích đứt
    if (horizontalDistance(target.location, anchor) > cfg.escapeRadius) {
      particle(dimension, P.smoke, add(target.location, { x: 0, y: 1, z: 0 }));
      sound(dimension, "random.break", target.location);
      return system.clearRun(run);
    }

    if (elapsed % 2 === 0) {
      particleLine(dimension, P.flame, add(player.location, { x: 0, y: 1.2, z: 0 }), add(target.location, { x: 0, y: 1, z: 0 }));
    }
    if (elapsed % 8 === 0) {
      particleRing(dimension, P.lava, add(anchor, { x: 0, y: 0.1, z: 0 }), cfg.escapeRadius, 16);
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
      particle(dimension, P.boom, add(target.location, { x: 0, y: 1, z: 0 }));
      sound(dimension, "mob.ravager.stun", target.location);
    }
  }, 1);
}

// ---------------------------------------------------------------------------
// R — Kẻ Diệt Thế
// ---------------------------------------------------------------------------

function castR(player, state) {
  const cfg = CONFIG.R;
  const t = now();
  if (t < state.busyUntil || t < state.cd.R) return;
  startCooldown(state, "R");
  const castTicks = ticks(cfg.castTime);
  state.busyUntil = t + castTicks;

  try {
    player.addEffect("slowness", castTicks, { amplifier: 3, showParticles: false });
  } catch {
    // bỏ qua
  }
  sound(player.dimension, "mob.wither.spawn", player.location, 1.3);
  particleRing(player.dimension, P.lava, player.location, 1.5, 10);

  system.runTimeout(() => {
    if (!canAct(player)) return;
    const origin = player.location;
    const dimension = player.dimension;
    const duration = ticks(cfg.duration);

    // Biến hình trước để sát thương sóng xung kích được cộng hệ số
    state.ultUntil = now() + duration;
    try {
      player.addEffect("speed", duration, { amplifier: cfg.speedAmplifier, showParticles: false });
      player.addEffect("strength", duration, { amplifier: cfg.strengthAmplifier, showParticles: false });
    } catch {
      // bỏ qua
    }
    if (!isPassiveReady(state)) {
      const remaining = state.passiveReadyAt - now();
      state.passiveReadyAt = now() + Math.floor(remaining * cfg.passiveCooldownMultiplier);
    }

    // Sóng xung kích lan ra
    particle(dimension, P.bigBoom, add(origin, { x: 0, y: 0.5, z: 0 }));
    for (let i = 1; i <= 3; i++) {
      system.runTimeout(() => particleRing(dimension, P.flame, add(origin, { x: 0, y: 0.2, z: 0 }), (cfg.radius * i) / 3), i * 2);
    }
    sound(dimension, "random.explode", origin, 0.6);

    for (const target of getTargetsNear(player, origin, cfg.radius)) {
      const away = flatUnit({ x: target.location.x - origin.x, z: target.location.z - origin.z }) ?? aimDirection(player);
      knockback(target, away, cfg.knockback, 0.5);
      try {
        target.addEffect("slowness", ticks(cfg.fearDuration), { amplifier: cfg.fearSlowAmplifier });
      } catch {
        // bỏ qua
      }
      dealDamage(player, target, cfg.castDamage);
    }
  }, castTicks);
}

// ---------------------------------------------------------------------------
// Nhận thao tác
// ---------------------------------------------------------------------------

world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
  if (itemStack?.typeId !== ITEM_ID || !canAct(player) || isStunned(player)) return;
  const state = getState(player);
  // Chặn một lần bấm bị tính 2 lần
  if (now() - state.lastUse < 3) return;
  state.lastUse = now();

  const direction = aimDirection(player);
  if (player.getRotation().x <= CONFIG.lookUpPitch) castR(player, state);
  else if (player.isSneaking) castE(player, state, direction);
  else if (!player.isOnGround) castW(player, state, direction);
  else castQ(player, state, direction);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  states.delete(playerId);
  greeted.delete(playerId);
});

// ---------------------------------------------------------------------------
// Thanh hồi chiêu (action bar) + hào quang khi biến hình
// ---------------------------------------------------------------------------

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
      player.sendMessage(
        "§4[Quỷ Kiếm Darkin]§r Chuột phải: §cQ§r | Ngồi + chuột phải: §cE§r | Nhảy + chuột phải: §cW§r | Nhìn lên + chuột phải: §cR"
      );
    }

    const parts = [`§4Nội tại ${formatCooldown(state.passiveReadyAt - t)}`];
    for (const skill of SKILLS) {
      if (skill === "Q" && state.qStage > 1 && t < state.qWindowEnd) {
        parts.push(`§6Q ${state.qStage}/${CONFIG.Q.casts.length}`);
      } else {
        parts.push(`§c${skill} ${formatCooldown(state.cd[skill] - t)}`);
      }
    }
    if (isUltActive(state)) {
      parts.push(`§6§lDIỆT THẾ ${Math.ceil((state.ultUntil - t) / TPS)}s`);
      particleRing(player.dimension, P.flame, add(player.location, { x: 0, y: 0.3, z: 0 }), 0.9, 6);
    }
    player.onScreenDisplay.setActionBar(parts.join("§r  "));
  }

  for (const [id, until] of stunnedUntil) {
    if (until <= t) stunnedUntil.delete(id);
  }
}, 5);
