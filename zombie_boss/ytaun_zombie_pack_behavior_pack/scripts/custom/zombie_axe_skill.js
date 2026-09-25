// ============================================
// ZOMBIE AXE (búa zombie) — skill vũ khí người chơi
// Chuột phải        : Đập Đất — nhảy lên rồi nện xuống, sóng xung kích + gai đá (hồi 8s)
// Ngồi + chuột phải : Hút Hồn — rút máu mọi kẻ địch quanh 7 block để hồi máu (hồi 15s)
// Nội tại khi chém  : 25% gây Nhiễm Độc; mỗi đòn thứ 4 là Đòn Nặng (+sát thương, hất văng)
// ============================================
import { world, system, EntityDamageCause } from "@minecraft/server";
import { particle, sound, shake, onGround, later, flatDir } from "./giant_zombie_skill";

const COMPONENT = "ytaun:zombieaxe_skill";
const SMASH_CD = 160;
const DRAIN_CD = 300;
const IGNORE = new Set(["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand", "minecraft:player"]);

const cooldowns = new Map(); // playerId -> { smash, drain, hits }

function state(p) {
  let s = cooldowns.get(p.id);
  if (!s) cooldowns.set(p.id, (s = { smash: -9999, drain: -9999, hits: 0 }));
  return s;
}

function enemies(player, center, radius) {
  return player.dimension.getEntities({ location: center, maxDistance: radius }).filter((e) => {
    if (e.id === player.id || IGNORE.has(e.typeId)) return false;
    try {
      const fam = e.getComponent("minecraft:type_family");
      if (fam && fam.hasTypeFamily("inanimate")) return false;
      return !!e.getComponent("minecraft:health");
    } catch { return false; }
  });
}

function cdLeft(s, key, cd) {
  return Math.max(0, s[key] + cd - system.currentTick);
}

function earthSmash(player) {
  const dim = player.dimension;
  try { player.applyKnockback({ x: 0, z: 0 }, 0.75); } catch { }
  sound(dim, "mob.irongolem.throw", player.location, 1, 0.8);
  particle(dim, "ytaun:dust_burst", player.location);
  later(12, () => {
    if (!player.isValid) return;
    const c = onGround(dim, player.location);
    particle(dim, "ytaun:shockwave", c, 4.5);
    particle(dim, "ytaun:rock_debris", c);
    sound(dim, "random.explode", c, 0.8, 0.9);
    sound(dim, "mob.irongolem.hit", c, 1, 0.6);
    shake(dim, c, 12, 0.35, 0.4);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = onGround(dim, { x: c.x + Math.cos(a) * 3, y: c.y, z: c.z + Math.sin(a) * 3 });
      later(3 + (i % 2) * 2, () => { particle(dim, "ytaun:spike", p); particle(dim, "ytaun:rock_debris", p); });
    }
    for (const e of enemies(player, c, 4.5)) {
      try {
        e.applyDamage(10, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
        const d = flatDir(c, e.location);
        e.applyKnockback({ x: d.x * 1.2, z: d.z * 1.2 }, 0.7);
        e.addEffect("slowness", 60, { amplifier: 1 });
      } catch { }
    }
  });
}

function soulDrain(player) {
  const dim = player.dimension;
  const loc = player.location;
  sound(dim, "mob.zombie.unfect", loc, 1, 0.7);
  particle(dim, "ytaun:summon_rune", onGround(dim, loc));
  let healed = 0;
  for (const e of enemies(player, loc, 7)) {
    try {
      e.applyDamage(5, { cause: EntityDamageCause.magic, damagingEntity: player });
      e.addEffect("poison", 60, { amplifier: 0 });
      e.addEffect("weakness", 100, { amplifier: 0 });
      particle(dim, "ytaun:poison_bubble", e.location);
      // vệt hồn bay từ mục tiêu về người chơi
      const from = { ...e.location };
      for (let i = 1; i <= 4; i++) {
        later(i * 2, () => {
          const k = i / 5, to = player.location;
          particle(dim, "ytaun:rune_sparks", { x: from.x + (to.x - from.x) * k, y: from.y + 1 + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k });
        });
      }
      healed += 2;
    } catch { }
  }
  healed = Math.min(healed, 10);
  if (healed > 0) {
    later(10, () => {
      try {
        const h = player.getComponent("minecraft:health");
        h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + healed));
        particle(dim, "ytaun:heal_spiral", player.location);
        sound(dim, "random.orb", player.location, 1, 0.8);
      } catch { }
    });
  }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent(COMPONENT, {
    onUse({ source: player }) {
      if (!player || player.typeId !== "minecraft:player") return;
      const s = state(player);
      const sneaking = player.isSneaking;
      const key = sneaking ? "drain" : "smash";
      const cd = sneaking ? DRAIN_CD : SMASH_CD;
      const left = cdLeft(s, key, cd);
      if (left > 0) {
        player.onScreenDisplay.setActionBar(`§c${sneaking ? "Hút Hồn" : "Đập Đất"}: ${(left / 20).toFixed(1)}s`);
        return;
      }
      s[key] = system.currentTick;
      system.run(() => (sneaking ? soulDrain(player) : earthSmash(player)));
      player.onScreenDisplay.setActionBar(`§a${sneaking ? "Hút Hồn!" : "Đập Đất!"}`);
    },
    onHitEntity({ attackingEntity: player, hitEntity: target }) {
      if (!player || player.typeId !== "minecraft:player" || !target?.isValid) return;
      const s = state(player);
      s.hits++;
      const dim = target.dimension;
      if (Math.random() < 0.25) {
        try {
          target.addEffect("poison", 60, { amplifier: 1 });
          target.addEffect("wither", 40, { amplifier: 0 });
        } catch { }
        particle(dim, "ytaun:poison_bubble", target.location);
      }
      if (s.hits % 4 === 0) {
        system.run(() => {
          try {
            target.applyDamage(6, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
            const d = flatDir(player.location, target.location);
            target.applyKnockback({ x: d.x * 1.6, z: d.z * 1.6 }, 0.45);
          } catch { }
          particle(dim, "ytaun:flash", target.location, 1.5);
          particle(dim, "ytaun:sparks", target.location);
          particle(dim, "ytaun:ground_ring", onGround(dim, target.location), 2);
          sound(dim, "mob.irongolem.hit", target.location, 1, 0.8);
        });
      }
    },
  });
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => cooldowns.delete(playerId));
