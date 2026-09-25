// ============================================
// GIANT ZOMBIE BOSS — HỆ THỐNG SKILL v2
// - Bộ chọn chiêu theo khoảng cách + hồi chiêu, mỗi lúc chỉ tung 1 chiêu
// - Mọi chiêu đều có vòng cảnh báo đỏ trước khi gây sát thương (né được)
// - 3 giai đoạn: Thường (>50% máu) → Cuồng Nộ (≤50%) → Final Fury (≤20%)
// - Particle tùy chỉnh ytaun:* (resource pack /particles) + animation riêng từng chiêu
// - Tự nhận lại boss sau khi thoát/vào lại thế giới (không phụ thuộc entitySpawn)
// ============================================
import { world, system, EntityDamageCause, MolangVariableMap, GameMode, ItemStack } from "@minecraft/server";

const BOSS_TYPE_ID = "ytaun:giant_zombie";
const MINION_TAG = "ytaun_gz_minion";
const ANIM = "animation.ytaun_giant_zombie.";

// Bật khi cần test: in lỗi + tên chiêu ra chat
const DEBUG = false;
function debugMsg(text) { if (DEBUG) world.sendMessage(text); }
function logError(where, err) {
  console.warn(`[GiantZombie] ${where}: ${err}`);
  debugMsg(`§c[Error] ${where}: ${err}`);
}

const CREATIVE = GameMode.Creative ?? GameMode.creative;
const SPECTATOR = GameMode.Spectator ?? GameMode.spectator;

// Loại trừ khi tìm mục tiêu: đồng minh zombie, vật vô tri, item, đạn...
const IGNORE_TYPES = new Set([
  "minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:snowball",
  "minecraft:lightning_bolt", "minecraft:area_effect_cloud", "minecraft:falling_block",
  "minecraft:tnt", "minecraft:fireball", "minecraft:small_fireball", "minecraft:thrown_trident",
  "minecraft:armor_stand", BOSS_TYPE_ID,
]);

// ====== CẤU HÌNH GIAI ĐOẠN ======
const PHASES = [
  { name: "normal", cdMult: 1.0, dmgMult: 1.0, gap: 50 },
  { name: "rage", cdMult: 0.9, dmgMult: 1.1, gap: 45, hp: 0.5 },
  { name: "fury", cdMult: 0.8, dmgMult: 1.2, gap: 38, hp: 0.2 },
];

/** @type {Map<string, any>} */
const bossData = new Map();

// ============================================
// ====== TIỆN ÍCH ======
// ============================================
export function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function dist2D(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
function lerp(a, b, t) { return a + (b - a) * t; }

export function later(ticks, fn) {
  system.runTimeout(() => {
    try { fn(); } catch (e) { logError("timer", e); }
  }, Math.max(1, Math.round(ticks)));
}

/** Tìm mặt đất gần y đã cho (trả về y đứng được), chunk chưa load thì trả về y gốc */
function groundY(dim, x, y, z) {
  try {
    const bx = Math.floor(x), bz = Math.floor(z);
    for (let yy = Math.floor(y) + 3; yy >= Math.floor(y) - 10; yy--) {
      const b = dim.getBlock({ x: bx, y: yy, z: bz });
      if (!b) return y;
      if (!b.isAir && !b.isLiquid) {
        const above = dim.getBlock({ x: bx, y: yy + 1, z: bz });
        if (above && (above.isAir || above.isLiquid)) return yy + 1;
      }
    }
  } catch { }
  return y;
}
export function onGround(dim, pos) {
  return { x: pos.x, y: groundY(dim, pos.x, pos.y, pos.z), z: pos.z };
}

// Hiệu ứng ghép nhiều lớp: gọi 1 particle chính sẽ tự bắn thêm các lớp phụ
// [id phụ, hệ số bán kính (null = không truyền bán kính)]
const FX_LAYERS = {
  "ytaun:shockwave": [["ytaun:ground_ring", 1.1], ["ytaun:flash", 0.5], ["ytaun:sparks", null], ["ytaun:crack_decal", 0.6]],
  "ytaun:spike": [["ytaun:crack_decal", 0.35]],
  "ytaun:summon_rune": [["ytaun:rune_sparks", null]],
  "ytaun:rage_burst": [["ytaun:flash", 1.5], ["ytaun:ember", null], ["ytaun:sparks", null]],
  "ytaun:death_burst": [["ytaun:flash", 2], ["ytaun:sparks", null], ["ytaun:ember", null]],
  "ytaun:roar_wave": [["ytaun:shockwave", 4]],
};

export function particle(dim, id, pos, radius) {
  spawnOne(dim, id, pos, radius);
  for (const [extra, k] of FX_LAYERS[id] ?? []) {
    if (extra === "ytaun:shockwave") spawnOne(dim, extra, { x: pos.x, y: pos.y - 0.2, z: pos.z }, k);
    else spawnOne(dim, extra, pos, k === null ? undefined : (radius ?? 4) * k);
  }
}

function spawnOne(dim, id, pos, radius) {
  try {
    if (radius === undefined) {
      dim.spawnParticle(id, pos);
    } else {
      const vars = new MolangVariableMap();
      vars.setFloat("variable.radius", radius);
      dim.spawnParticle(id, pos, vars);
    }
  } catch { }
}

export function sound(dim, id, pos, volume = 1, pitch = 1) {
  try { dim.playSound(id, pos, { volume, pitch }); } catch { }
}

/** Rung màn hình cho người chơi trong bán kính */
export function shake(dim, center, radius, intensity, seconds) {
  try {
    for (const p of dim.getPlayers({ location: center, maxDistance: radius })) {
      const falloff = 1 - Math.min(dist(p.location, center) / radius, 1) * 0.7;
      const i = Math.max(0.05, Math.min(intensity * falloff, 1)).toFixed(2);
      p.runCommand(`camerashake add @s ${i} ${seconds} positional`);
    }
  } catch { }
}

/** Vòng cảnh báo trên mặt đất trong `ticks` tick */
export function telegraph(dim, center, radius, ticks) {
  const pos = onGround(dim, center);
  for (let t = 0; t < ticks; t += 5) {
    later(t, () => {
      particle(dim, "ytaun:telegraph", pos, radius);
      particle(dim, "ytaun:telegraph_fill", pos, radius);
    });
  }
  return pos;
}

function isValidEnemy(e) {
  if (!e || !e.isValid) return false;
  if (e.typeId === "minecraft:player") {
    try {
      const gm = e.getGameMode();
      if (gm === CREATIVE || gm === SPECTATOR) return false;
    } catch { }
  }
  return true;
}

export function enemiesNear(boss, center, radius) {
  let list = [];
  try {
    list = boss.dimension.getEntities({ location: center, maxDistance: radius });
  } catch { }
  return list.filter((e) => {
    if (e.id === boss.id || IGNORE_TYPES.has(e.typeId) || !isValidEnemy(e)) return false;
    try {
      if (e.hasTag(MINION_TAG)) return false;
      const fam = e.getComponent("minecraft:type_family");
      if (fam && (fam.hasTypeFamily("zombie") || fam.hasTypeFamily("inanimate"))) return false;
      return !!e.getComponent("minecraft:health");
    } catch { return false; }
  });
}

/**
 * Gây sát thương vùng tròn quanh `center`.
 * opts: { knock, up, cause, effects: [[id, ticks, amp]], exclude:Set }
 */
function hitArea(boss, data, center, radius, damage, opts = {}) {
  const mult = PHASES[data.phase].dmgMult;
  const hits = [];
  for (const e of enemiesNear(boss, center, radius)) {
    if (opts.exclude && opts.exclude.has(e.id)) continue;
    try {
      e.applyDamage(damage * mult, {
        cause: opts.cause ?? EntityDamageCause.entityAttack,
        damagingEntity: boss,
      });
    } catch { }
    if (opts.knock || opts.up) {
      try {
        let dx = e.location.x - center.x, dz = e.location.z - center.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= len; dz /= len;
        const k = opts.knock ?? 0;
        e.applyKnockback({ x: dx * k, z: dz * k }, opts.up ?? 0);
      } catch { }
    }
    for (const [id, ticks, amp] of opts.effects ?? []) {
      try { e.addEffect(id, ticks, { amplifier: amp ?? 0 }); } catch { }
    }
    if (opts.exclude) opts.exclude.add(e.id);
    hits.push(e);
  }
  return hits;
}

/** Giữ boss đứng yên trong lúc ra chiêu và xoay mặt về mục tiêu */
function rootBoss(boss, ticks, faceTarget) {
  try { boss.addEffect("slowness", ticks, { amplifier: 10, showParticles: false }); } catch { }
  if (faceTarget && faceTarget.isValid) {
    try { boss.teleport(boss.location, { facingLocation: faceTarget.location }); } catch { }
  }
}

function playAnim(boss, name, blendOut = 0.2) {
  try { boss.playAnimation(ANIM + name, { blendOutTime: blendOut }); } catch { }
}

export function flatDir(from, to) {
  let dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  return { x: dx / len, z: dz / len };
}

function rotateXZ(v, deg) {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: v.x * c - v.z * s, z: v.x * s + v.z * c };
}

function titleNear(dim, center, title, subtitle) {
  try {
    for (const p of dim.getPlayers({ location: center, maxDistance: 48 })) {
      p.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 15 });
    }
  } catch { }
}

// ============================================
// ====== SKILL: GRAB & SLAM ======
// ============================================
// FK hand offset theo từng tick (tính từ animation.ytaun_giant_zombie.pickup)
const grabHandOffsets = [
  [-1.377, 2.176, -0.171], [-1.394, 2.128, -0.184], [-1.409, 2.078, -0.192],
  [-1.421, 2.027, -0.195], [-1.431, 1.978, -0.194], [-1.439, 1.930, -0.188],
  [-1.444, 1.886, -0.179], [-1.448, 1.846, -0.167], [-1.451, 1.811, -0.151],
  [-1.453, 1.782, -0.132], [-1.454, 1.759, -0.110], [-1.367, 2.003, -0.293],
  [-1.228, 2.233, -0.435], [-1.056, 2.440, -0.521], [-0.875, 2.619, -0.548],
  [-0.709, 2.764, -0.519], // tick 15 = 0.75s, tay chạm/nắm player
  [-0.709, 2.764, -0.519], [-0.709, 2.764, -0.519], [-0.728, 2.737, -0.538],
  [-0.765, 2.680, -0.574], [-0.800, 2.617, -0.608], [-0.834, 2.549, -0.640],
  [-0.864, 2.398, -0.692], [-0.892, 2.398, -0.692], [-0.916, 2.317, -0.713],
  [-0.935, 2.232, -0.730], [-0.948, 2.144, -0.742], [-0.956, 2.054, -0.751],
  [-0.957, 1.963, -0.756], [-0.951, 1.871, -0.756], [-0.937, 1.780, -0.753],
  [-0.916, 1.691, -0.746], [-0.888, 1.605, -0.737], [-0.851, 1.523, -0.724],
  [-0.807, 1.445, -0.709], [-0.756, 1.374, -0.692], [-0.698, 1.310, -0.674],
  [-0.634, 1.254, -0.655], [-0.564, 1.206, -0.635], [-0.490, 1.168, -0.616],
  [-0.413, 1.140, -0.597], [-0.333, 1.123, -0.579], [-0.253, 1.116, -0.562],
  [-0.172, 1.120, -0.546], [-0.093, 1.134, -0.531], [-0.017, 1.159, -0.519],
  [0.055, 1.194, -0.507], [0.123, 1.238, -0.497], [0.184, 1.291, -0.488],
  [0.239, 1.351, -0.480], [0.285, 1.417, -0.472], [0.324, 1.490, -0.464],
  [0.354, 1.566, -0.456], [0.375, 1.645, -0.447], [0.387, 1.726, -0.436],
  [0.391, 1.808, -0.424], // tick 55 = 2.75s
  [0.191, 1.217, -0.387], [-0.361, 1.002, -0.492], [-0.853, 1.334, -0.755],
  [-0.970, 2.016, -0.900],
  [-0.749, 2.647, -0.702], // tick 60 = 3.0s
  [-0.749, 2.647, -0.702], [-0.749, 2.647, -0.702], [-0.749, 2.647, -0.702],
  [-0.749, 2.647, -0.702],
];
const GRAB_TICK = 15;
const GRAB_IMPACT_TICK = 60;
const GRAB_RELEASE_TICK = grabHandOffsets.length - 1;

function localToWorld(boss, local) {
  const yaw = boss.getRotation().y * (Math.PI / 180);
  const [lx, ly, lz] = local;
  return {
    x: boss.location.x + (lx * Math.cos(yaw) - lz * Math.sin(yaw)),
    y: boss.location.y + ly,
    z: boss.location.z + (lx * Math.sin(yaw) + lz * Math.cos(yaw)),
  };
}

function grabSlamSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, GRAB_RELEASE_TICK + 5, target);
  playAnim(boss, "pickup", 0.1);
  sound(dim, "mob.irongolem.throw", boss.location, 1, 0.6);
  particle(dim, "ytaun:telegraph", onGround(dim, target.location), 1.5);

  let ticks = 0;
  let grabbed = false;
  const finish = () => {
    system.clearRun(interval);
    try { if (boss.isValid) boss.triggerEvent("ytaun:grab_end"); } catch { }
  };

  const interval = system.runInterval(() => {
    try {
      if (!boss.isValid || !target.isValid) return finish();

      // Chỉ nắm nếu lúc tay khép lại player vẫn còn trong tầm (có thể né!)
      if (ticks === GRAB_TICK) {
        if (dist(boss.location, target.location) > 5.5) {
          sound(dim, "mob.irongolem.hit", boss.location, 1, 0.5);
          return finish();
        }
        grabbed = true;
        const hold = GRAB_RELEASE_TICK - GRAB_TICK + 10;
        try {
          target.addEffect("slow_falling", hold, { showParticles: false });
          target.addEffect("weakness", hold, { amplifier: 4, showParticles: false });
        } catch { }
        sound(dim, "mob.zombie.woodbreak", target.location, 0.8, 0.6);
      }

      if (grabbed && ticks >= GRAB_TICK && ticks < GRAB_IMPACT_TICK) {
        const pos = localToWorld(boss, grabHandOffsets[Math.min(ticks, grabHandOffsets.length - 1)]);
        target.teleport(pos, { dimension: dim });
        if (ticks % 3 === 0) particle(dim, "ytaun:rock_trail", pos);
      }

      if (grabbed && ticks === GRAB_IMPACT_TICK) {
        const view = boss.getViewDirection();
        const ground = onGround(dim, {
          x: boss.location.x + view.x * 2.5, y: boss.location.y, z: boss.location.z + view.z * 2.5,
        });
        target.teleport(ground, { dimension: dim });
        try {
          target.applyDamage(14 * PHASES[data.phase].dmgMult, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
          const len = Math.sqrt(view.x * view.x + view.z * view.z) || 1;
          target.applyKnockback({ x: (view.x / len) * 1.4, z: (view.z / len) * 1.4 }, 0.5);
        } catch { }
        // Sóng xung kích quanh chỗ đập, trúng thêm người đứng gần
        hitArea(boss, data, ground, 4, 6, { knock: 1.2, up: 0.4, exclude: new Set([target.id]) });
        particle(dim, "ytaun:shockwave", ground, 5);
        particle(dim, "ytaun:dust_burst", ground);
        particle(dim, "ytaun:rock_debris", ground);
        particle(dim, "minecraft:huge_explosion_emitter", ground);
        sound(dim, "random.explode", ground, 0.9, 0.7);
        sound(dim, "mob.irongolem.hit", ground, 1, 0.5);
        shake(dim, ground, 20, 0.7, 0.6);
      }

      if (ticks >= GRAB_RELEASE_TICK) return finish();
      ticks++;
    } catch (err) {
      logError("grab", err);
      finish();
    }
  }, 1);

  return GRAB_RELEASE_TICK + 5;
}

// ============================================
// ====== SKILL: GROUND SLAM ======
// Hai tay đập đất → sóng xung kích 2 lớp
// ============================================
const SLAM_IMPACT = 17;
function groundSlamSkill(boss, data, target) {
  const dim = boss.dimension;
  const radius = data.phase >= 2 ? 7.5 : 6;
  rootBoss(boss, 34, target);
  playAnim(boss, "slam");
  sound(dim, "ytaun.boss_roar", boss.location, 1.2, 1.2);
  const center = telegraph(dim, boss.location, radius, SLAM_IMPACT);

  later(SLAM_IMPACT, () => {
    if (!boss.isValid) return;
    const exclude = new Set();
    particle(dim, "ytaun:shockwave", center, radius);
    particle(dim, "ytaun:dust_burst", center);
    particle(dim, "ytaun:rock_debris", center);
    particle(dim, "ytaun:bone_shards", center);
    sound(dim, "ytaun.boss_slam", center, 2, 1);
    particle(dim, "minecraft:huge_explosion_emitter", center);
    sound(dim, "random.explode", center, 1, 0.6);
    sound(dim, "mob.irongolem.hit", center, 1, 0.4);
    shake(dim, center, 24, 0.8, 0.7);
    hitArea(boss, data, center, radius, 10, {
      knock: 1.6, up: 0.6, exclude, effects: [["slowness", 60, 1]],
    });

    // Lớp sóng thứ 2 (từ giai đoạn Cuồng Nộ) — rộng hơn, yếu hơn, né bằng cách nhảy ra xa
    if (data.phase >= 1) {
      later(8, () => {
        if (!boss.isValid) return;
        particle(dim, "ytaun:shockwave", center, radius + 3.5);
        sound(dim, "dig.stone", center, 1, 0.5);
        shake(dim, center, 20, 0.35, 0.4);
        hitArea(boss, data, center, radius + 3.5, 5, { knock: 1.0, up: 0.3, exclude });
      });
    }
    // Final Fury: gai đá trồi thành vòng quanh boss
    if (data.phase >= 2) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const p = { x: center.x + Math.cos(a) * (radius + 1.5), y: center.y, z: center.z + Math.sin(a) * (radius + 1.5) };
        spikeAt(boss, data, p, 14 + (i % 2) * 3, 6);
      }
    }
  });
  return 34;
}

// ============================================
// ====== SKILL: GROUND SPIKES ======
// Giậm chân → hàng gai đá lan về phía mục tiêu (quạt 3 hàng ở Cuồng Nộ)
// ============================================
function spikeAt(boss, data, pos, warnTicks, damage) {
  const dim = boss.dimension;
  const g = telegraph(dim, pos, 1.1, warnTicks);
  later(warnTicks, () => {
    if (!boss.isValid) return;
    particle(dim, "ytaun:spike", g);
    particle(dim, "ytaun:rock_debris", g);
    particle(dim, "ytaun:ground_crack", g);
    sound(dim, "ytaun.rock_crumble", g, 0.9, 0.8 + Math.random() * 0.4);
    hitArea(boss, data, { x: g.x, y: g.y + 0.5, z: g.z }, 1.5, damage, {
      knock: 0.2, up: 0.9, effects: [["slowness", 40, 2]],
    });
  });
}

const STOMP_IMPACT = 11;
function groundSpikesSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, 26, target);
  playAnim(boss, "stomp");
  const origin = { ...boss.location };
  const dir = flatDir(origin, target.location);
  const angles = data.phase >= 1 ? [-25, 0, 25] : [0];
  const count = data.phase >= 2 ? 12 : 10;

  later(STOMP_IMPACT, () => {
    if (!boss.isValid) return;
    particle(dim, "ytaun:dust_burst", origin);
    particle(dim, "ytaun:shockwave", onGround(dim, origin), 2.5);
    sound(dim, "mob.irongolem.hit", origin, 1, 0.5);
    shake(dim, origin, 16, 0.4, 0.4);

    for (const ang of angles) {
      const d = rotateXZ(dir, ang);
      for (let i = 0; i < count; i++) {
        const step = 2 + i * 1.6;
        const p = { x: origin.x + d.x * step, y: origin.y, z: origin.z + d.z * step };
        // cảnh báo 10 tick, mỗi gai nổ trễ hơn gai trước 2 tick → cảm giác "lan" ra
        later(i * 2, () => spikeAt(boss, data, p, 10, 7));
      }
    }
    // Final Fury: thêm vòng gai tại chỗ mục tiêu đang đứng
    if (data.phase >= 2 && target.isValid) {
      const tp = { ...target.location };
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spikeAt(boss, data, { x: tp.x + Math.cos(a) * 2.5, y: tp.y, z: tp.z + Math.sin(a) * 2.5 }, 16, 6);
      }
      spikeAt(boss, data, tp, 20, 8);
    }
  });
  return 28;
}

// ============================================
// ====== SKILL: LEAP ATTACK ======
// Nhún người → nhảy vòng cung tới chỗ mục tiêu → tiếp đất nổ
// ============================================
const LEAP_PREP = 12;
const LEAP_FLIGHT = 20;
function leapAttackSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, LEAP_PREP + LEAP_FLIGHT + 14, target);
  playAnim(boss, "earthwake");
  sound(dim, "mob.ravager.roar", boss.location, 1, 0.8);
  particle(dim, "ytaun:dust_burst", boss.location);

  const start = { ...boss.location };
  const land = onGround(dim, target.location);
  const radius = data.phase >= 2 ? 6 : 5;
  telegraph(dim, land, radius, LEAP_PREP + LEAP_FLIGHT);

  later(LEAP_PREP, () => {
    if (!boss.isValid) return;
    particle(dim, "ytaun:shockwave", onGround(dim, start), 3);
    sound(dim, "mob.irongolem.throw", start, 1, 0.5);
    const peak = 7 + dist2D(start, land) * 0.25;
    let t = 0;
    const run = system.runInterval(() => {
      try {
        if (!boss.isValid) { system.clearRun(run); return; }
        t++;
        const k = t / LEAP_FLIGHT;
        const pos = {
          x: lerp(start.x, land.x, k),
          y: lerp(start.y, land.y, k) + 4 * peak * k * (1 - k),
          z: lerp(start.z, land.z, k),
        };
        boss.teleport(pos, { dimension: dim, facingLocation: { x: land.x, y: pos.y, z: land.z } });
        particle(dim, "ytaun:rock_trail", { x: pos.x, y: pos.y + 1.5, z: pos.z });
        if (data.phase >= 1) particle(dim, "ytaun:rage_aura", pos);
        if (t >= LEAP_FLIGHT) {
          system.clearRun(run);
          leapLand(boss, data, land, radius);
        }
      } catch (e) {
        system.clearRun(run);
        logError("leap", e);
      }
    }, 1);
  });
  return LEAP_PREP + LEAP_FLIGHT + 14;
}

function leapLand(boss, data, land, radius) {
  const dim = boss.dimension;
  particle(dim, "ytaun:shockwave", land, radius + 1);
  particle(dim, "ytaun:dust_burst", land);
  particle(dim, "ytaun:rock_debris", land);
  particle(dim, "ytaun:ground_crack", land);
  particle(dim, "minecraft:huge_explosion_emitter", land);
  sound(dim, "random.explode", land, 1, 0.5);
  sound(dim, "ytaun.boss_slam", land, 2, 0.8);
  particle(dim, "ytaun:bone_shards", land);
  sound(dim, "mob.irongolem.hit", land, 1, 0.4);
  shake(dim, land, 28, 0.9, 0.8);
  hitArea(boss, data, land, radius, 12, {
    knock: 1.8, up: 0.7, effects: [["slowness", 80, 2]],
  });
}

// ============================================
// ====== SKILL: THROW ROCK ======
// Ném tảng đá bay vòng cung (1 / 3 / 5 tảng theo giai đoạn)
// ============================================
const THROW_RELEASE = 16;
const ROCK_FLIGHT = 22;
function throwRockSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, 28, target);
  playAnim(boss, "throw");
  sound(dim, "dig.stone", boss.location, 1, 0.5);

  later(THROW_RELEASE, () => {
    if (!boss.isValid || !target.isValid) return;
    const view = boss.getViewDirection();
    const hand = { x: boss.location.x + view.x * 1.5, y: boss.location.y + 5.5, z: boss.location.z + view.z * 1.5 };
    sound(dim, "mob.irongolem.throw", hand, 1, 0.6);

    const n = data.phase >= 2 ? 5 : data.phase >= 1 ? 3 : 1;
    const base = onGround(dim, target.location);
    for (let i = 0; i < n; i++) {
      let aim = base;
      if (i > 0) {
        const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 3;
        aim = onGround(dim, { x: base.x + Math.cos(a) * r, y: base.y, z: base.z + Math.sin(a) * r });
      }
      later(i * 3, () => launchRock(boss, data, hand, aim));
    }
  });
  return 30;
}

function launchRock(boss, data, from, to) {
  const dim = boss.dimension;
  telegraph(dim, to, 3, ROCK_FLIGHT);
  const peak = 5 + dist2D(from, to) * 0.2;
  let t = 0;
  const run = system.runInterval(() => {
    try {
      t++;
      const k = t / ROCK_FLIGHT;
      const pos = {
        x: lerp(from.x, to.x, k),
        y: lerp(from.y, to.y + 0.5, k) + 4 * peak * k * (1 - k),
        z: lerp(from.z, to.z, k),
      };
      particle(dim, "ytaun:rock_core", pos);
      if (t % 2 === 0) particle(dim, "ytaun:rock_trail", pos);
      if (t >= ROCK_FLIGHT) {
        system.clearRun(run);
        particle(dim, "ytaun:shockwave", to, 3.5);
        particle(dim, "ytaun:dust_burst", to);
        particle(dim, "ytaun:rock_debris", to);
        particle(dim, "minecraft:explosion_particle", to);
        sound(dim, "random.explode", to, 0.7, 0.8);
        sound(dim, "dig.stone", to, 1, 0.5);
        shake(dim, to, 12, 0.4, 0.35);
        if (boss.isValid) hitArea(boss, data, to, 3, 9, { knock: 1.0, up: 0.45 });
      }
    } catch (e) {
      system.clearRun(run);
      logError("rock", e);
    }
  }, 1);
}

// ============================================
// ====== SKILL: POISON BREATH ======
// Phun mây độc lan ra 6 block, tồn tại 4 giây, gây độc theo nhịp
// ============================================
const BREATH_START = 16;
function poisonBreathSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, 40, target);
  playAnim(boss, "breath");
  sound(dim, "mob.zombie.say", boss.location, 1, 0.5);

  later(BREATH_START, () => {
    if (!boss.isValid) return;
    const center = onGround(dim, boss.location);
    particle(dim, "ytaun:poison_cloud", center);
    particle(dim, "ytaun:flies", center);
    sound(dim, "ytaun.bile_vomit", center, 1.5, 0.8);
    sound(dim, "random.fizz", center, 1, 0.5);
    const amp = data.phase >= 2 ? 1 : 0;
    for (let tick = 0; tick <= 80; tick += 20) {
      later(tick, () => {
        if (!boss.isValid) return;
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 5.5;
          particle(dim, "ytaun:poison_bubble", { x: center.x + Math.cos(a) * r, y: center.y + 0.3, z: center.z + Math.sin(a) * r });
        }
        hitArea(boss, data, center, 6.5, 2, {
          cause: EntityDamageCause.magic,
          effects: [["poison", 60, amp], ["nausea", 100, 0], ["hunger", 100, 1]],
        });
      });
    }
  });
  return 40;
}

// ============================================
// ====== SKILL: WAR ROAR ======
// Gầm → 3 sóng âm đẩy lùi, buff boss & lính
// ============================================
function warRoarSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, 36, target);
  playAnim(boss, "roar");

  later(15, () => {
    if (!boss.isValid) return;
    const loc = boss.location;
    sound(dim, "ytaun.boss_roar", loc, 2, 1);
    particle(dim, "ytaun:skull_rise", loc);
    sound(dim, "mob.enderdragon.growl", loc, 0.8, 0.7);
    shake(dim, loc, 30, 0.5, 1.2);
    for (let i = 0; i < 3; i++) later(i * 4, () => boss.isValid && particle(dim, "ytaun:roar_wave", boss.location));

    hitArea(boss, data, loc, 10, 3, {
      knock: 2.2, up: 0.5, effects: [["slowness", 80, 2], ["weakness", 80, 0], ["mining_fatigue", 100, 1]],
    });
    try {
      boss.addEffect("speed", 100, { amplifier: 0 });
    } catch { }
    for (const m of dim.getEntities({ location: loc, maxDistance: 16, tags: [MINION_TAG] })) {
      if (m.id === boss.id) continue;
      try {
        m.addEffect("speed", 100, { amplifier: 0 });
        particle(dim, "ytaun:rage_aura", m.location);
      } catch { }
    }
  });
  return 36;
}

// ============================================
// ====== SKILL: SUMMON HORDE ======
// Trận pháp xanh dưới đất → đập đất → zombie/husk chui lên
// ============================================
const SUMMON_IMPACT = 32;
const MINION_CAP = 10;
function countMinions(boss) {
  try {
    return boss.dimension.getEntities({ location: boss.location, maxDistance: 40, tags: [MINION_TAG] }).length;
  } catch { return 0; }
}

function countGenerals(boss) {
  try {
    return boss.dimension.getEntities({ location: boss.location, maxDistance: 40, type: "ytaun:zombie_geneal", tags: [MINION_TAG] }).length;
  } catch { return 0; }
}

function summonHordeSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, 44, target);
  playAnim(boss, "summon");
  sound(dim, "mob.evocation_illager.prepare_summon", boss.location, 1, 0.6);

  const n = Math.min([4, 5, 6][data.phase], MINION_CAP - countMinions(boss));
  const loc = { ...boss.location };
  const spots = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const r = 4 + Math.random() * 1.5;
    const p = onGround(dim, { x: loc.x + Math.cos(a) * r, y: loc.y, z: loc.z + Math.sin(a) * r });
    spots.push(p);
    particle(dim, "ytaun:summon_rune", p);
    particle(dim, "ytaun:zombie_hands", p, 1.5);
    later(20, () => particle(dim, "ytaun:summon_rune", p));
  }

  later(SUMMON_IMPACT, () => {
    if (!boss.isValid) return;
    particle(dim, "ytaun:shockwave", onGround(dim, loc), 4);
    sound(dim, "ytaun.horde_moan", loc, 2, 1);
    shake(dim, loc, 18, 0.4, 0.5);
    spots.forEach((p, i) => later(i * 2, () => {
      particle(dim, "ytaun:ground_crack", p);
      particle(dim, "ytaun:dust_burst", p);
      particle(dim, "ytaun:zombie_hands", p, 1.2);
      particle(dim, "ytaun:skull_rise", p);
      sound(dim, "dig.gravel", p, 1, 0.6);
      // Mỗi đợt triệu hồi có 1 Zombie General (tướng) dẫn quân, tối đa 2 tướng cùng lúc
      const leader = i === 0 && countGenerals(boss) < 2;
      const type = leader ? "ytaun:zombie_geneal" : i % 2 === 0 ? "minecraft:zombie" : "minecraft:husk";
      if (leader) {
        particle(dim, "ytaun:evil_eye", { x: p.x, y: p.y - 3, z: p.z });
        sound(dim, "ytaun.general_shout", p, 2, 1);
      }
      const m = dim.spawnEntity(type, p);
      m.addTag(MINION_TAG);
      if (!leader) {
        // lính thường: không buff vĩnh viễn
      }
      m.addEffect("fire_resistance", 20000000, { showParticles: false });
    }));
  });
  if (n > 0) debugMsg("§c[Boss] Summoning a horde of zombies & husks!");
  return 44;
}

// ============================================
// ====== CHUYỂN GIAI ĐOẠN / HỒI MÁU ======
// ============================================
const ENRAGE_BURST = 24;
function enterPhase(boss, data, phase) {
  const dim = boss.dimension;
  data.phase = phase;
  try { boss.setDynamicProperty("ytaun:phase", phase); } catch { }
  rootBoss(boss, 48);
  playAnim(boss, "enrage");
  sound(dim, "ytaun.transform", boss.location, 2, 1);
  sound(dim, "mob.ravager.stun", boss.location, 1, 0.6);
  particle(dim, "ytaun:evil_eye", boss.location);
  particle(dim, "ytaun:skull_rise", boss.location);

  if (phase === 1) titleNear(dim, boss.location, "§c§lENRAGED", "§6Bigger & tougher: 500 HP, -10% damage taken");
  else titleNear(dim, boss.location, "§4§l☠ FINAL FURY ☠", "§c550 HP, -20% damage taken, stronger punches!");

  later(ENRAGE_BURST, () => {
    if (!boss.isValid) return;
    const loc = boss.location;
    particle(dim, "ytaun:rage_burst", loc);
    particle(dim, "ytaun:skull_rise", loc);
    particle(dim, "ytaun:flesh_chunks", loc);
    particle(dim, "ytaun:goo_splash", loc);
    sound(dim, "ytaun.boss_roar", loc, 2, phase === 1 ? 0.9 : 0.75);
    // LÊN FORM: to hơn, nhiều máu hơn, giảm sát thương nhận vào, đánh thường mạnh hơn (component group)
    try {
      boss.triggerEvent(phase === 1 ? "ytaun:form_rage" : "ytaun:form_fury");
      system.run(() => {
        try {
          const h = boss.getComponent("minecraft:health");
          // chỉ hồi thêm chút ít (không "hồi đầy" giữa trận)
          h.setCurrentValue(h.effectiveMax * (phase === 1 ? 0.45 : 0.22));
        } catch { }
      });
    } catch { }
    particle(dim, "ytaun:roar_wave", loc);
    particle(dim, "ytaun:shockwave", onGround(dim, loc), 8);
    particle(dim, "minecraft:huge_explosion_emitter", loc);
    sound(dim, "mob.enderdragon.growl", loc, 1.5, phase === 1 ? 0.8 : 0.6);
    sound(dim, "random.explode", loc, 1, 0.5);
    shake(dim, loc, 32, 0.9, 1.2);
    hitArea(boss, data, loc, 8, 4, { knock: 3.0, up: 0.8 });
    try {
      if (phase >= 2) boss.addEffect("speed", 20000000, { amplifier: 0, showParticles: false });
    } catch { }
  });
  world.sendMessage(phase === 1 ? "§c§l⚠ GIANT ZOMBIE IS ENRAGED! ⚠" : "§4§l☠ GIANT ZOMBIE ENTERS FINAL FURY! ☠");
  return 48;
}

function healSkill(boss, data) {
  const dim = boss.dimension;
  try { boss.addEffect("regeneration", 60, { amplifier: 1 }); } catch { }
  particle(dim, "ytaun:heal_spiral", boss.location);
  sound(dim, "random.levelup", boss.location, 0.6, 0.5);
}


// ============================================
// ====== SKILL MỚI THEO CÁC TRÙM ZOMBIE KHÁC ======
// ============================================
function dirVars(dir) {
  const v = new MolangVariableMap();
  v.setFloat("variable.dir_x", dir.x);
  v.setFloat("variable.dir_z", dir.z);
  return v;
}

// Boomer (Left 4 Dead): nôn mật hình nón — mù, buồn nôn; nạn nhân bị "đánh dấu" và zombie kéo tới
function bileVomitSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, 40, target);
  playAnim(boss, "breath");
  const dir = flatDir(boss.location, target.location);
  for (let s = 2; s <= 8; s += 2) telegraph(dim, { x: boss.location.x + dir.x * s, y: boss.location.y, z: boss.location.z + dir.z * s }, 0.6 + s * 0.2, 14);
  later(14, () => {
    if (!boss.isValid) return;
    const o = boss.location;
    sound(dim, "ytaun.bile_vomit", o, 2, 1);
    try { dim.spawnParticle("ytaun:bile_spray", o, dirVars(dir)); } catch { }
    const marked = new Set();
    for (let k = 0; k < 4; k++) {
      later(k * 5, () => {
        if (!boss.isValid) return;
        for (const e of enemiesNear(boss, boss.location, 9)) {
          const d = flatDir(boss.location, e.location);
          if (d.x * dir.x + d.z * dir.z < 0.6 || marked.has(e.id)) continue; // ngoài hình nón ~50°
          marked.add(e.id);
          try {
            e.applyDamage(4 * PHASES[data.phase].dmgMult, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
            e.addEffect("blindness", 100, { amplifier: 0 });
            e.addEffect("nausea", 160, { amplifier: 0 });
            e.addEffect("slowness", 80, { amplifier: 1 });
          } catch { }
          particle(dim, "ytaun:goo_splash", e.location);
          particle(dim, "ytaun:flies", e.location);
          // Đánh dấu: 2 zombie chui lên cạnh nạn nhân
          if (countMinions(boss) < MINION_CAP) {
            for (let i = 0; i < 2; i++) {
              const a = Math.random() * Math.PI * 2;
              const p = onGround(dim, { x: e.location.x + Math.cos(a) * 3, y: e.location.y, z: e.location.z + Math.sin(a) * 3 });
              particle(dim, "ytaun:zombie_hands", p, 1);
              later(20, () => {
                particle(dim, "ytaun:ground_crack", p);
                const m = dim.spawnEntity("minecraft:zombie", p);
                m.addTag(MINION_TAG);
              });
            }
          }
        }
      });
    }
  });
  return 40;
}

// Spitter (Left 4 Dead): nhổ cục axit bay vòng cung → vũng axit 5 giây
function acidSpitSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, 26, target);
  playAnim(boss, "throw");
  later(14, () => {
    if (!boss.isValid || !target.isValid) return;
    const view = boss.getViewDirection();
    const from = { x: boss.location.x + view.x, y: boss.location.y + 4.5, z: boss.location.z + view.z };
    const pools = data.phase >= 1 ? 2 : 1;
    sound(dim, "ytaun.spit", from, 1.5, 0.9);
    for (let i = 0; i < pools; i++) {
      const to = onGround(dim, i === 0 ? target.location : {
        x: target.location.x + (Math.random() - 0.5) * 6, y: target.location.y, z: target.location.z + (Math.random() - 0.5) * 6,
      });
      telegraph(dim, to, 3, 18);
      let t = 0;
      const run = system.runInterval(() => {
        t++;
        const k = t / 18;
        const pos = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) + 4 * 4 * k * (1 - k), z: lerp(from.z, to.z, k) };
        particle(dim, "ytaun:acid_glob", pos);
        if (t % 3 === 0) particle(dim, "ytaun:goo_drip", { x: pos.x, y: pos.y - 2.5, z: pos.z });
        if (t >= 18) {
          system.clearRun(run);
          acidPool(boss, data, to);
        }
      }, 1);
    }
  });
  return 28;
}

function acidPool(boss, data, at) {
  const dim = boss.dimension;
  particle(dim, "ytaun:acid_pool", at, 3.2);
  particle(dim, "ytaun:acid_bubbles", at, 3);
  particle(dim, "ytaun:goo_splash", at);
  sound(dim, "ytaun.acid_sizzle", at, 1.5, 1);
  for (let k = 0; k <= 100; k += 10) {
    later(k, () => {
      if (!boss.isValid) return;
      if (k % 40 === 0) sound(dim, "ytaun.acid_sizzle", at, 0.8, 1.1);
      hitArea(boss, data, at, 3, 1.5, { cause: EntityDamageCause.magic, effects: [["poison", 40, 1]] });
    });
  }
}

// Smoker (Left 4 Dead): phóng lưỡi kéo mục tiêu về phía boss
function tongueSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, 34, target);
  playAnim(boss, "roar");
  sound(dim, "ytaun.tongue_whip", boss.location, 1.5, 0.9);
  const mouth = () => ({ x: boss.location.x, y: boss.location.y + 4.2, z: boss.location.z });
  let t = 0;
  const run = system.runInterval(() => {
    try {
      if (!boss.isValid || !target.isValid || t > 24) { system.clearRun(run); return; }
      t++;
      const m = mouth(), p = target.location;
      const reach = Math.min(t / 6, 1);
      for (let i = 1; i <= 10; i++) {
        const k = (i / 10) * reach;
        particle(dim, "ytaun:tongue", { x: lerp(m.x, p.x, k), y: lerp(m.y, p.y + 1, k) - Math.sin(k * Math.PI) * 0.6, z: lerp(m.z, p.z, k) });
      }
      if (t === 6) {
        if (dist(boss.location, target.location) > 18) { system.clearRun(run); return; }
        sound(dim, "ytaun.tongue_whip", p, 1.5, 1.2);
        particle(dim, "ytaun:goo_splash", p);
        try {
          target.applyDamage(4 * PHASES[data.phase].dmgMult, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
          target.addEffect("slowness", 60, { amplifier: 3 });
        } catch { }
      }
      if (t > 6 && t % 3 === 0) {
        const d = flatDir(target.location, boss.location);
        try { target.applyKnockback({ x: d.x * 1.1, z: d.z * 1.1 }, 0.15); } catch { }
      }
    } catch { system.clearRun(run); }
  }, 1);
  return 34;
}

// Gargantuar (Plants vs Zombies): ném Imp — zombie con bay tới đáp xuống cạnh mục tiêu
function impThrowSkill(boss, data, target) {
  const dim = boss.dimension;
  rootBoss(boss, 30, target);
  playAnim(boss, "throw");
  sound(dim, "ytaun.imp_scream", boss.location, 1, 1);
  later(16, () => {
    if (!boss.isValid || !target.isValid) return;
    const n = data.phase >= 2 ? 3 : data.phase >= 1 ? 2 : 1;
    const view = boss.getViewDirection();
    const from = { x: boss.location.x + view.x * 1.5, y: boss.location.y + 5.5, z: boss.location.z + view.z * 1.5 };
    sound(dim, "mob.irongolem.throw", from, 1, 0.8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = i === 0 ? 1.2 : 2.5;
      const to = onGround(dim, { x: target.location.x + Math.cos(a) * r, y: target.location.y, z: target.location.z + Math.sin(a) * r });
      telegraph(dim, to, 1.5, 20);
      let t = 0;
      const run = system.runInterval(() => {
        t++;
        const k = t / 20;
        const pos = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) + 4 * 5 * k * (1 - k), z: lerp(from.z, to.z, k) };
        particle(dim, "ytaun:skull_rise", pos);
        particle(dim, "ytaun:rock_trail", pos);
        if (t >= 20) {
          system.clearRun(run);
          particle(dim, "ytaun:shockwave", to, 2);
          particle(dim, "ytaun:flesh_chunks", to);
          sound(dim, "ytaun.imp_scream", to, 1, 1.3);
          if (boss.isValid) hitArea(boss, data, to, 2, 5, { knock: 0.6, up: 0.3 });
          try {
            const imp = dim.spawnEntity("minecraft:zombie", to);
            imp.triggerEvent("minecraft:as_baby");
            imp.addTag(MINION_TAG);
          } catch { }
        }
      }, 1);
    }
  });
  return 32;
}

// ============================================
// ====== BỘ CHỌN CHIÊU ======
// cd: hồi chiêu (tick), range: [min, max] khoảng cách tới mục tiêu
// ============================================
const SKILLS = {
  slam: { cd: 260, range: [0, 7], weight: 3, run: groundSlamSkill },
  spikes: { cd: 300, range: [3, 16], weight: 3, run: groundSpikesSkill },
  leap: { cd: 360, range: [7, 20], weight: 2, run: leapAttackSkill },
  throw: { cd: 200, range: [7, 28], weight: 3, run: throwRockSkill },
  poison: { cd: 520, range: [0, 8], weight: 2, run: poisonBreathSkill },
  roar: { cd: 700, range: [0, 12], weight: 1, run: warRoarSkill },
  summon: { cd: 900, range: [0, 24], weight: 1, run: summonHordeSkill, cond: (b) => countMinions(b) < MINION_CAP - 2 },
  bile: { cd: 560, range: [0, 8], weight: 2, run: bileVomitSkill },
  acid: { cd: 280, range: [6, 24], weight: 2, run: acidSpitSkill },
  tongue: { cd: 420, range: [8, 18], weight: 2, run: tongueSkill },
  imp: { cd: 480, range: [6, 24], weight: 2, run: impThrowSkill, cond: (b) => countMinions(b) < MINION_CAP },
  grab: {
    cd: 600, range: [0, 4.5], weight: 4, run: grabSlamSkill,
    cond: (b, t) => t.typeId === "minecraft:player",
  },
};

function pickTarget(boss) {
  let best = null, bestScore = Infinity;
  for (const e of enemiesNear(boss, boss.location, 28)) {
    // Ưu tiên người chơi: coi như gần hơn 8 block
    const score = dist(boss.location, e.location) - (e.typeId === "minecraft:player" ? 8 : 0);
    if (score < bestScore) { best = e; bestScore = score; }
  }
  return best;
}

function chooseSkill(boss, data, target, now) {
  const d = dist(boss.location, target.location);
  const cdMult = PHASES[data.phase].cdMult;
  const ready = [];
  let total = 0;
  for (const [name, s] of Object.entries(SKILLS)) {
    if (now - (data.lastCast[name] ?? -99999) < s.cd * cdMult) continue;
    if (d < s.range[0] || d > s.range[1]) continue;
    if (s.cond && !s.cond(boss, target)) continue;
    if (name === data.lastSkill) continue; // không lặp chiêu liên tiếp
    ready.push([name, s]);
    total += s.weight;
  }
  if (!ready.length) return null;
  let r = Math.random() * total;
  for (const entry of ready) {
    r -= entry[1].weight;
    if (r <= 0) return entry;
  }
  return ready[ready.length - 1];
}

// ============================================
// ====== VÒNG LẶP CHÍNH ======
// ============================================
function announceBoss(boss) {
  world.sendMessage("§c§l[BOSS] §rGiant Zombie Boss has appeared!");
  particle(boss.dimension, "ytaun:ground_crack", boss.location);
  particle(boss.dimension, "ytaun:shockwave", onGround(boss.dimension, boss.location), 6);
  sound(boss.dimension, "mob.ravager.roar", boss.location, 1.5, 0.5);
}

function trackBoss(boss) {
  if (bossData.has(boss.id)) return;
  const health = boss.getComponent("minecraft:health");
  if (!health) return;
  if (!boss.nameTag) boss.nameTag = "§c§l⚡ GIANT ZOMBIE BOSS ⚡";
  const now = system.currentTick;
  const ratio = health.currentValue / health.effectiveMax;
  bossData.set(boss.id, {
    boss,
    phase: typeof boss.getDynamicProperty("ytaun:phase") === "number"
      ? boss.getDynamicProperty("ytaun:phase")
      : ratio <= PHASES[2].hp ? 2 : ratio <= PHASES[1].hp ? 1 : 0,
    castUntil: now + 40, // nghỉ 2 giây sau khi xuất hiện
    lastCast: { summon: now - 400, roar: now - 300 },
    lastSkill: null,
    lastHeal: now,
  });
}

function tickBoss(data, now) {
  const boss = data.boss;
  const dim = boss.dimension;
  const health = boss.getComponent("minecraft:health");
  if (!health) return;
  const ratio = health.currentValue / health.effectiveMax;

  // Hiệu ứng thường trực theo giai đoạn
  if (data.phase >= 1 && now % (data.phase >= 2 ? 5 : 10) === 0) particle(dim, "ytaun:rage_aura", boss.location);
  if (data.phase >= 2 && now % 12 === 0) particle(dim, "ytaun:ember", boss.location);
  if (data.phase >= 1 && now % 10 === 0) particle(dim, "ytaun:goo_drip", boss.location);
  if (now % 40 === 0) particle(dim, "ytaun:flies", boss.location);
  if (now % 100 === 0) sound(dim, "ytaun.flies", boss.location, 0.5, 1);
  if (now % 16 === 0) {
    try {
      const v = boss.getVelocity();
      if (v.x * v.x + v.z * v.z > 0.004) {
        particle(dim, "ytaun:ground_crack", boss.location);
        if (now % 32 === 0) shake(dim, boss.location, 10, 0.12, 0.2);
      }
    } catch { }
  }

  if (now < data.castUntil) return;

  // Chuyển giai đoạn luôn ưu tiên hơn chiêu thường
  const nextPhase = ratio <= PHASES[2].hp ? 2 : ratio <= PHASES[1].hp ? 1 : 0;
  if (nextPhase > data.phase) {
    data.castUntil = now + enterPhase(boss, data, nextPhase) + PHASES[nextPhase].gap;
    return;
  }

  if (data.phase >= 1 && now - data.lastHeal > (data.phase >= 2 ? 600 : 900)) {
    data.lastHeal = now;
    healSkill(boss, data);
  }

  if (now % 5 !== 0) return; // chọn chiêu 4 lần/giây là đủ
  const target = pickTarget(boss);
  if (!target) return;
  const pick = chooseSkill(boss, data, target, now);
  if (!pick) return;
  const [name, skill] = pick;
  debugMsg(`§e[Boss] cast ${name}`);
  data.lastCast[name] = now;
  data.lastSkill = name;
  const duration = skill.run(boss, data, target) ?? 20;
  data.castUntil = now + duration + PHASES[data.phase].gap;
}

system.runInterval(() => {
  const now = system.currentTick;
  for (const [id, data] of bossData) {
    if (!data.boss.isValid) { bossData.delete(id); continue; }
    try { tickBoss(data, now); } catch (e) { logError("tick", e); }
  }
}, 1);

// Quét lại boss mỗi giây: nhận boss sau khi load lại thế giới / chunk
system.runInterval(() => {
  for (const id of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    try {
      for (const b of world.getDimension(id).getEntities({ type: BOSS_TYPE_ID })) trackBoss(b);
    } catch { }
  }
}, 20);

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  try {
    if (entity.typeId !== BOSS_TYPE_ID) return;
    trackBoss(entity);
    announceBoss(entity);
  } catch (e) { logError("spawn", e); }
});

// ====== BOSS CHẾT ======
// Đồ rơi của boss (rơi bằng script cho chắc chắn; loot table để trống để không rơi đôi)
// Tay Giant Zombie 100% · Tim Zombie 33% · thịt thối 4–10 · mắt nhện 1–3
function dropBossLoot(dim, loc) {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const drops = [["ytaun:handgiantzombie", 1], ["minecraft:rotten_flesh", rnd(4, 10)], ["minecraft:spider_eye", rnd(1, 3)]];
  if (Math.random() < 0.33) drops.push(["ytaun:zombie_heart", 1]);
  const at = { x: loc.x, y: loc.y + 1, z: loc.z };
  for (const [id, n] of drops) {
    try { dim.spawnItem(new ItemStack(id, n), at); } catch (e) { logError("drop " + id, e); }
  }
}

world.afterEvents.entityDie.subscribe(({ deadEntity: entity }) => {
  if (entity.typeId !== BOSS_TYPE_ID) return;
  try { dropBossLoot(entity.dimension, { ...entity.location }); } catch (e) { logError("loot", e); }
  bossData.delete(entity.id);
  try {
    const loc = { ...entity.location };
    const dim = entity.dimension;
    particle(dim, "ytaun:death_burst", loc);
    particle(dim, "ytaun:skull_rise", loc);
    particle(dim, "ytaun:flesh_chunks", loc);
    particle(dim, "ytaun:bone_shards", loc);
    sound(dim, "ytaun.boss_roar", loc, 2, 0.6);
    particle(dim, "ytaun:shockwave", onGround(dim, loc), 9);
    particle(dim, "minecraft:huge_explosion_emitter", loc);
    sound(dim, "mob.enderdragon.death", loc, 0.8, 1.2);
    shake(dim, loc, 32, 0.6, 1.5);

    for (let i = 0; i < 12; i++) {
      later(i * 3, () => dim.spawnEntity("minecraft:xp_orb", { x: loc.x, y: loc.y + 1, z: loc.z }));
    }
    // Lính triệu hồi tan biến theo boss
    for (const m of dim.getEntities({ location: loc, maxDistance: 48, tags: [MINION_TAG] })) {
      particle(dim, "ytaun:ground_crack", m.location);
      particle(dim, "ytaun:death_burst", m.location);
      m.remove();
    }
  } catch (e) { logError("death", e); }
});
