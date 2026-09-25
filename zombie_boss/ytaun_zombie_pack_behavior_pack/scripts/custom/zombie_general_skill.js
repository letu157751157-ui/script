// ============================================
// ZOMBIE GENERAL — bộ skill tướng zombie (mini-boss)
// Chém Quét (cận chiến) · Xung Phong (lao tới) · Hiệu Triệu (buff đồng minh) · Gọi Quân (triệu hồi)
// ============================================
import { world, system, EntityDamageCause } from "@minecraft/server";
import { particle, sound, shake, telegraph, onGround, later, enemiesNear, flatDir, dist } from "./giant_zombie_skill";

const GENERAL_ID = "ytaun:zombie_geneal";
const SOLDIER_TAG = "ytaun_general_soldier";
const ANIM_MAD = "animation.ytaun_zombie_geneal.mad";

/** @type {Map<string, any>} */
const generals = new Map();

function hit(general, center, radius, damage, knock, up, effects = []) {
  for (const e of enemiesNear(general, center, radius)) {
    try {
      e.applyDamage(damage, { cause: EntityDamageCause.entityAttack, damagingEntity: general });
      const d = flatDir(center, e.location);
      e.applyKnockback({ x: d.x * knock, z: d.z * knock }, up);
      for (const [id, t, a] of effects) e.addEffect(id, t, { amplifier: a });
    } catch { }
  }
}

function freeze(general, ticks, target) {
  try {
    general.addEffect("slowness", ticks, { amplifier: 10, showParticles: false });
    if (target) general.teleport(general.location, { facingLocation: target.location });
    general.playAnimation(ANIM_MAD, { blendOutTime: 0.2 });
  } catch { }
}

// Chém quét hình quạt phía trước (tầm 3.5)
function cleave(g, target) {
  const dim = g.dimension;
  freeze(g, 18, target);
  const dir = flatDir(g.location, target.location);
  const center = { x: g.location.x + dir.x * 2, y: g.location.y, z: g.location.z + dir.z * 2 };
  telegraph(dim, center, 2.2, 10);
  sound(dim, "ytaun.general_shout", g.location, 1, 1.2);
  later(10, () => {
    if (!g.isValid) return;
    for (let i = -2; i <= 2; i++) {
      const a = Math.atan2(dir.z, dir.x) + i * 0.35;
      particle(dim, "ytaun:sparks", { x: g.location.x + Math.cos(a) * 2.2, y: g.location.y + 0.6, z: g.location.z + Math.sin(a) * 2.2 });
    }
    particle(dim, "ytaun:ground_ring", onGround(dim, center), 2.5);
    sound(dim, "mob.irongolem.hit", center, 1, 1.3);
    hit(g, center, 2.4, 7, 0.9, 0.35, [["slowness", 40, 1]]);
    particle(dim, "ytaun:flesh_chunks", center);
  });
  return 20;
}

// Lao thẳng tới mục tiêu, đâm trúng ai trên đường
function charge(g, target) {
  const dim = g.dimension;
  freeze(g, 36, target);
  const start = { ...g.location };
  const dir = flatDir(start, target.location);
  const len = Math.min(dist(start, target.location) + 2, 12);
  for (let s = 1; s <= len; s += 1.5) {
    particle(dim, "ytaun:telegraph", onGround(dim, { x: start.x + dir.x * s, y: start.y, z: start.z + dir.z * s }), 0.9);
  }
  sound(dim, "ytaun.general_shout", start, 1.5, 0.9);
  const hitIds = new Set();
  later(14, () => {
    let t = 0;
    const run = system.runInterval(() => {
      try {
        if (!g.isValid || t >= 8) { system.clearRun(run); return; }
        t++;
        const s = (len * t) / 8;
        const pos = onGround(dim, { x: start.x + dir.x * s, y: g.location.y, z: start.z + dir.z * s });
        g.teleport(pos, { facingLocation: { x: pos.x + dir.x, y: pos.y, z: pos.z + dir.z } });
        particle(dim, "ytaun:dust_burst", pos);
        for (const e of enemiesNear(g, pos, 1.8)) {
          if (hitIds.has(e.id)) continue;
          hitIds.add(e.id);
          try {
            e.applyDamage(8, { cause: EntityDamageCause.entityAttack, damagingEntity: g });
            e.applyKnockback({ x: dir.x * 1.8, z: dir.z * 1.8 }, 0.55);
          } catch { }
          particle(dim, "ytaun:flash", e.location, 1.5);
          particle(dim, "ytaun:bone_shards", e.location);
          sound(dim, "mob.irongolem.hit", e.location, 1, 1.2);
        }
        if (t === 8) {
          particle(dim, "ytaun:shockwave", pos, 2.5);
          shake(dim, pos, 10, 0.3, 0.3);
        }
      } catch { system.clearRun(run); }
    }, 1);
  });
  return 36;
}

// Hiệu triệu: buff mọi zombie quanh 14 block
function rally(g) {
  const dim = g.dimension;
  freeze(g, 24);
  sound(dim, "ytaun.general_shout", g.location, 2, 1);
  sound(dim, "ytaun.horde_moan", g.location, 1.5, 1.2);
  particle(dim, "ytaun:skull_rise", g.location);
  sound(dim, "raid.horn", g.location, 0.6, 1.2);
  particle(dim, "ytaun:roar_wave", g.location);
  particle(dim, "ytaun:ember", g.location);
  for (const z of dim.getEntities({ location: g.location, maxDistance: 14, families: ["zombie"] })) {
    try {
      z.addEffect("speed", 200, { amplifier: 1 });
      z.addEffect("strength", 200, { amplifier: 1 });
      z.addEffect("resistance", 200, { amplifier: 0 });
      particle(dim, "ytaun:rage_aura", z.location);
    } catch { }
  }
  return 26;
}

// Gọi quân: 2 lính zombie chui lên (tối đa 4 lính/tướng)
function callSoldiers(g) {
  const dim = g.dimension;
  let alive = 0;
  try { alive = dim.getEntities({ location: g.location, maxDistance: 32, tags: [SOLDIER_TAG] }).length; } catch { }
  const n = Math.min(2, 4 - alive);
  if (n <= 0) return 0;
  freeze(g, 30);
  sound(dim, "mob.evocation_illager.prepare_summon", g.location, 1, 1.1);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const p = onGround(dim, { x: g.location.x + Math.cos(a) * 2.5, y: g.location.y, z: g.location.z + Math.sin(a) * 2.5 });
    particle(dim, "ytaun:summon_rune", p);
    particle(dim, "ytaun:zombie_hands", p, 1);
    later(24, () => {
      particle(dim, "ytaun:ground_crack", p);
      particle(dim, "ytaun:rock_debris", p);
      const z = dim.spawnEntity("minecraft:zombie", p);
      z.addTag(SOLDIER_TAG);
      z.addEffect("speed", 20000000, { amplifier: 0, showParticles: false });
    });
  }
  return 30;
}

const SKILLS = [
  { name: "cleave", cd: 80, range: [0, 3.5], run: cleave },
  { name: "charge", cd: 200, range: [4, 12], run: charge },
  { name: "rally", cd: 400, range: [0, 16], run: rally },
  { name: "call", cd: 500, range: [0, 16], run: callSoldiers },
];

function pickTarget(g) {
  let best = null, bd = 16;
  for (const e of enemiesNear(g, g.location, 16)) {
    const d = dist(g.location, e.location) - (e.typeId === "minecraft:player" ? 4 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

system.runInterval(() => {
  const now = system.currentTick;
  for (const [id, s] of generals) {
    const g = s.entity;
    if (!g.isValid) { generals.delete(id); continue; }
    if (now % 60 === 0) particle(g.dimension, "ytaun:flies", g.location);
    if (now < s.busyUntil || now % 5 !== 0) continue;
    try {
      const target = pickTarget(g);
      if (!target) continue;
      const d = dist(g.location, target.location);
      const ready = SKILLS.filter((k) => now - (s.last[k.name] ?? -9999) >= k.cd && d >= k.range[0] && d <= k.range[1]);
      if (!ready.length) continue;
      const k = ready[Math.floor(Math.random() * ready.length)];
      s.last[k.name] = now;
      const dur = k.run(g, target);
      s.busyUntil = now + (dur || 0) + 30;
    } catch (e) { console.warn(`[ZombieGeneral] ${e}`); }
  }
}, 1);

// Nhận tướng mới / sau khi load lại thế giới
system.runInterval(() => {
  for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    try {
      for (const g of world.getDimension(dimId).getEntities({ type: GENERAL_ID })) {
        if (!generals.has(g.id)) generals.set(g.id, { entity: g, busyUntil: system.currentTick + 40, last: {} });
      }
    } catch { }
  }
}, 20);

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity.typeId !== GENERAL_ID) return;
  try {
    const dim = deadEntity.dimension, loc = { ...deadEntity.location };
    particle(dim, "ytaun:death_burst", loc);
    for (const z of dim.getEntities({ location: loc, maxDistance: 32, tags: [SOLDIER_TAG] })) {
      particle(dim, "ytaun:ground_crack", z.location);
      z.remove();
    }
  } catch { }
});
