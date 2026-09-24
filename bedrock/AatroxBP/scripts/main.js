// Quỷ Kiếm Darkin — bộ chiêu Aatrox cho Minecraft Bedrock (Script API @minecraft/server 2.x)
//
// Cầm kiếm rồi:
//   Đánh thường          Nội tại Tư Thế Tử Thần (khi sẵn sàng)
//   Chuột phải           Q  Quỷ Kiếm Darkin (3 lần chém)
//   Ngồi + chuột phải    E  Bước Nhảy Hắc Ám
//   Nhảy + chuột phải    W  Xiềng Xích Địa Ngục
//   Nhìn lên + chuột phải R Kẻ Diệt Thế

import { world, system, EquipmentSlot, EntityDamageCause, MolangVariableMap } from "@minecraft/server";
import { CONFIG } from "./config.js";

const ITEM_ID = "aatrox:darkin_blade";
const TPS = 20;
const SKILLS = ["Q", "E", "W", "R"];

// Particle riêng nằm trong resource pack (AatroxRP/particles)
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

function particle(dimension, id, location, molang) {
  try {
    dimension.spawnParticle(id, location, molang);
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

// Vòng sóng xung kích phẳng trên mặt đất, lan tới bán kính `radius`
function shockRing(dimension, center, radius) {
  const molang = new MolangVariableMap();
  molang.setFloat("variable.radius", radius);
  particle(dimension, P.ring, add(center, { x: 0, y: 0.15, z: 0 }), molang);
}

// Nổ máu: chớp sáng + máu văng
function bloodBurst(dimension, location) {
  particle(dimension, P.flash, location);
  particle(dimension, P.blood, location);
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
    // bỏ qua
  }
  particleRing(entity.dimension, P.stun, add(entity.location, { x: 0, y: 2.2, z: 0 }), 0.5, 4);
}

// Animation người chơi khi ra chiêu (AatroxRP/animations/aatrox_player.animation.json)
function playAnim(player, name) {
  try {
    player.playAnimation(`animation.aatrox.${name}`, { blendOutTime: 0.12 });
  } catch {
    // bỏ qua
  }
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
  particle(target.dimension, P.ember, add(target.location, { x: 0, y: 1, z: 0 }));

  // Nổ sau khi hết thời gian bất tử của đòn đánh thường
  system.runTimeout(() => {
    if (!player.isValid || !target.isValid) return;
    dealDamage(player, target, bonus);
    heal(player, bonus * cfg.healRatio);
    bloodBurst(target.dimension, add(target.location, { x: 0, y: 1, z: 0 }));
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
    // Đĩa tròn: vành ngoài là điểm ngọt
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
  playAnim(player, `q${stage}`);
  drawQTelegraph(player, cast, direction);
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
  } else {
    targets = getTargetsInBox(player, origin, direction, cast.length, cast.width);
    isSweetSpot = (entity) => {
      const along = (entity.location.x - origin.x) * direction.x + (entity.location.z - origin.z) * direction.z;
      return along >= cast.length - cast.sweet;
    };
    for (let along = 1.5; along <= cast.length; along += 1.5) {
      particle(dimension, P.slash, add(add(origin, direction, along), { x: 0, y: 1, z: 0 }));
    }
    particle(dimension, P.flash, add(add(origin, direction, cast.length - cast.sweet / 2), { x: 0, y: 0.5, z: 0 }));
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
    }
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
  playAnim(player, "e");
  knockback(player, direction, cfg.strength, cfg.vertical);
  sound(player.dimension, "item.trident.riptide_1", player.location, 1.2);

  let count = 0;
  const trail = system.runInterval(() => {
    if (!player.isValid || ++count > 6) return system.clearRun(trail);
    particle(player.dimension, P.smoke, add(player.location, { x: 0, y: 0.8, z: 0 }));
    particle(player.dimension, P.ember, add(player.location, { x: 0, y: 1.1, z: 0 }));
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
  const t = now();
  if (t < state.busyUntil || t < state.cd.W) return;
  startCooldown(state, "W");
  state.busyUntil = t + 8;
  playAnim(player, "w");
  // Xích bay ra đúng lúc tay trái vung tới trong animation (0.25 giây)
  system.runTimeout(() => launchChain(player, direction), 5);
}

function launchChain(player, direction) {
  if (!canAct(player)) return;
  const cfg = CONFIG.W;
  const dimension = player.dimension;
  sound(dimension, "mob.blaze.shoot", player.location, 0.7);
  const left = { x: direction.z, y: 0, z: -direction.x };
  let head = add(add(player.location, { x: 0, y: 1.3, z: 0 }), left, 0.35);
  let travelled = 0;

  const flight = system.runInterval(() => {
    if (!player.isValid) return system.clearRun(flight);
    // Chia nhỏ bước để không xuyên qua mục tiêu / tường
    for (let step = 0; step < 3; step++) {
      head = add(head, direction, cfg.speed / 3);
      travelled += cfg.speed / 3;
      particle(dimension, P.chain, head);
      if (step === 0) particle(dimension, P.ember, head);

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
  playAnim(player, "r");
  const castTicks = ticks(cfg.castTime);
  state.busyUntil = t + castTicks;

  try {
    player.addEffect("slowness", castTicks, { amplifier: 3, showParticles: false });
  } catch {
    // bỏ qua
  }
  sound(player.dimension, "mob.wither.spawn", player.location, 1.3);
  particle(player.dimension, P.aura, player.location);
  shockRing(player.dimension, player.location, 1.5);

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
        // bỏ qua
      }
      dealDamage(player, target, cfg.castDamage);
    }
  }, castTicks);
}

// ---------------------------------------------------------------------------
// Nhận thao tác
// ---------------------------------------------------------------------------

const SKILL_NAMES = { Q: "Quỷ Kiếm Darkin", E: "Bước Nhảy Hắc Ám", W: "Xiềng Xích Địa Ngục", R: "Kẻ Diệt Thế" };
const STANCE_HINT = { Q: "", E: " (đang ngồi)", W: " (đang nhảy)", R: " (nhìn lên)" };
// Hiện trong mô tả của kiếm (giữ chuột lên kiếm trong túi đồ)
const LORE = [
  "§7Chuột phải/chạm: §cQ §7Quỷ Kiếm",
  "§7Ngồi + chuột phải: §cE §7Lướt",
  "§7Nhảy + chuột phải: §cW §7Xiềng Xích",
  "§7Nhìn lên + chuột phải: §cR §7Diệt Thế",
  "§7Đánh thường: §cNội tại",
];
// Bấm vào những block/mob có thao tác riêng thì dùng chúng như thường, không ra chiêu
const INTERACTIVE_BLOCK =
  /door|gate|button|lever|chest|barrel|shulker|furnace|smoker|crafting|crafter|anvil|table|:bed$|bell|hopper|dispenser|dropper|loom|grindstone|stonecutter|beacon|lectern|repeater|comparator|noteblock|jukebox|cake|campfire|anchor|lodestone|composter|cauldron|brewing|sign|frame|vault|chiseled_bookshelf|decorated_pot/;
const INTERACTIVE_ENTITY = new Set(["minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader", "minecraft:armor_stand"]);

function chooseSkill(player) {
  if (player.getRotation().x <= CONFIG.lookUpPitch) return "R";
  if (player.isSneaking) return "E";
  if (!player.isOnGround) return "W";
  return "Q";
}

function notify(state, text, seconds = 1.2) {
  state.notice = text;
  state.noticeUntil = now() + ticks(seconds);
}

function cooldownLeft(state, skill) {
  if (skill === "Q" && state.qStage > 1) return 0; // đang trong thời gian chém tiếp
  return state.cd[skill] - now();
}

function trySkill(player) {
  if (!canAct(player)) return;
  const state = getState(player);
  // Một lần bấm có thể bắn nhiều sự kiện (dùng vật phẩm + chạm block)
  if (now() - state.lastUse < 4) return;
  state.lastUse = now();
  if (isStunned(player)) return notify(state, "§cĐang bị choáng, không dùng được chiêu!");
  if (now() < state.busyUntil) return;

  const skill = chooseSkill(player);
  const left = cooldownLeft(state, skill);
  if (left > 0) {
    try {
      player.playSound("note.bass", { pitch: 0.6, volume: 0.7 });
    } catch {
      // bỏ qua
    }
    return notify(state, `§c${skill} đang hồi chiêu: ${(left / TPS).toFixed(1)}s`);
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

// Chuột phải / chạm vào khoảng không
world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (itemStack?.typeId === ITEM_ID) trySkill(source);
});

// Chuột phải / chạm khi tâm ngắm đang chỉ vào block (mặt đất, tường...)
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (event.itemStack?.typeId !== ITEM_ID || event.isFirstEvent === false) return;
  if (INTERACTIVE_BLOCK.test(event.block.typeId)) return;
  const player = event.player;
  system.run(() => trySkill(player));
});

// Chuột phải / chạm giữ vào mob
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  if (event.itemStack?.typeId !== ITEM_ID) return;
  const target = event.target;
  if (INTERACTIVE_ENTITY.has(target.typeId)) return;
  try {
    if (target.getComponent("minecraft:rideable")) return; // ngựa, thuyền... để cưỡi như thường
  } catch {
    // bỏ qua
  }
  const player = event.player;
  system.run(() => trySkill(player));
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  states.delete(playerId);
  greeted.delete(playerId);
});

// ---------------------------------------------------------------------------
// Hướng dẫn: tiêu đề + chat khi cầm kiếm lần đầu, mô tả trên kiếm, /scriptevent aatrox:help
// ---------------------------------------------------------------------------

function sendGuide(player) {
  player.sendMessage("§4━━━━━━━━ Quỷ Kiếm Darkin ━━━━━━━━");
  player.sendMessage("§7Cầm kiếm rồi §fbấm chuột phải §7(điện thoại: §fchạm màn hình§7 hoặc nút §fDùng§7).");
  player.sendMessage("§7Chiêu được chọn theo tư thế lúc bấm:");
  player.sendMessage("§c Q §f— đứng yên hoặc chạy: §7chém 3 lần, mép lửa cam là điểm ngọt");
  player.sendMessage("§c E §f— đang ngồi (Shift / nút ngồi): §7lướt theo hướng nhìn");
  player.sendMessage("§c W §f— đang nhảy (bấm nhảy rồi bấm dùng khi còn trên không): §7phóng xích lửa");
  player.sendMessage("§c R §f— ngước nhìn lên trời: §7biến hình Kẻ Diệt Thế");
  player.sendMessage("§c Nội tại §f— đánh thường: §7vết chém phát nổ, hồi máu");
  player.sendMessage("§7Thanh trên hotbar hiện chiêu sắp dùng và thời gian hồi chiêu. Gõ §f/scriptevent aatrox:help §7để xem lại.");
}

function ensureLore(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    const item = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (item?.typeId !== ITEM_ID || item.getLore().length > 0) return;
    item.setLore(LORE);
    equippable.setEquipment(EquipmentSlot.Mainhand, item);
  } catch {
    // bỏ qua
  }
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id === "aatrox:help" && sourceEntity?.typeId === "minecraft:player") sendGuide(sourceEntity);
});

// ---------------------------------------------------------------------------
// Thanh hồi chiêu (action bar) + hào quang khi biến hình
// ---------------------------------------------------------------------------

// Vị trí gần đúng của lưỡi kiếm: kiếm cầm tay phải, lưỡi chếch lên phía trước
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
        player.onScreenDisplay.setTitle("§4Quỷ Kiếm Darkin", {
          subtitle: "§7Bấm chuột phải / chạm màn hình để dùng chiêu §cQ",
          fadeInDuration: 10,
          stayDuration: 60,
          fadeOutDuration: 20,
        });
      } catch {
        // bỏ qua
      }
      particle(player.dimension, P.aura, player.location);
      sound(player.dimension, "mob.wither.ambient", player.location, 1.4);
    }
    ensureLore(player);

    const parts = [`§4Nội tại ${formatCooldown(state.passiveReadyAt - t)}`];
    if (t < (state.noticeUntil ?? 0)) {
      parts.push(state.notice);
    } else {
      const next = chooseSkill(player);
      parts.push(`§fBấm: §e${next}${STANCE_HINT[next]}`);
    }
    for (const skill of SKILLS) {
      if (skill === "Q" && state.qStage > 1 && t < state.qWindowEnd) {
        parts.push(`§6Q ${state.qStage}/${CONFIG.Q.casts.length}`);
      } else {
        parts.push(`§c${skill} ${formatCooldown(state.cd[skill] - t)}`);
      }
    }
    if (isUltActive(state)) {
      parts.push(`§6§lDIỆT THẾ ${Math.ceil((state.ultUntil - t) / TPS)}s`);
      particle(player.dimension, P.aura, player.location);
    } else if (t % 10 === 0) {
      // Tàn lửa bốc lên từ lưỡi kiếm đang cầm
      particle(player.dimension, P.ember, bladeLocation(player));
    }
    player.onScreenDisplay.setActionBar(parts.join("§r  "));
  }

  for (const [id, until] of stunnedUntil) {
    if (until <= t) stunnedUntil.delete(id);
  }
}, 5);
