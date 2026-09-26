// File: scripts/item_trigger.js
// Custom component của các món đồ Yeti. v2.0: kỹ năng vũ khí dùng hiệu ứng băng mới (yeti:*).
//
// - Frozen Sword  (chuột phải) Bước Băng: Speed VIII 6 giây như cũ + lướt tới, để lại vệt tuyết.
//                 (đánh trúng) Tê Cóng: làm chậm như cũ; trúng cùng mục tiêu 3 lần trong 4 giây -> băng vỡ tung.
// - Frozen Scythe (chuột phải) Vệ Binh Băng: Resistance II 3 giây như cũ + gọi tối đa 3 Yeti con đồng minh
//                 (tồn tại 60 giây, tối đa 5 con) + sóng băng làm chậm quái xung quanh.
// - Ice Bar       (chuột phải) Pháo Đài Băng: Resistance II 5 giây như cũ + vòng gai băng (particle) 6 giây đẩy lùi quái.
// FIX: bản cũ gọi summon "pa:yeti_pet" / "pa:enderpet" (không tồn tại trong addon nên không ra gì),
//      và dùng @p (người chơi GẦN NHẤT, có thể là người khác) thay vì chính người dùng.

import { system, world, EntityDamageCause } from '@minecraft/server';
import * as fx from './yeti/fx';

const ALLY_TAG = 'yeti_ally';
const frostbite = new Map(); // hitEntity.id -> { count, tick }

function monstersNear(dimension, loc, radius) {
  try {
    return dimension.getEntities({ location: loc, maxDistance: radius, families: ['monster'] });
  } catch (_) {
    return [];
  }
}

function effect(entity, id, ticks, amplifier) {
  try { entity.addEffect(id, ticks, { amplifier, showParticles: true }); } catch (_) {}
}

// ---------------------------------------------------------------- Frozen Sword

function frostStep(player) {
  const dim = player.dimension;
  const loc = player.location;
  effect(player, 'speed', 120, 7);
  const view = player.getViewDirection();
  const dir = fx.normalize({ x: view.x, y: 0, z: view.z });
  try { player.applyKnockback({ x: dir.x * 2.2, z: dir.z * 2.2 }, 0.25); } catch (_) {}
  fx.emit(dim, 'yeti:ice_burst', fx.add(loc, { x: 0, y: 1, z: 0 }));
  fx.emit(dim, 'yeti:frost_ring', fx.add(loc, { x: 0, y: 0.1, z: 0 }), { radius: 3 });
  fx.emit(dim, 'yeti:snow_dust', loc);
  fx.sound(dim, 'random.glass', loc, 1, 1.6);
  fx.sound(dim, 'random.bow', loc, 1, 0.6);
  try { player.onScreenDisplay.setActionBar('§b❄ Bước Băng!'); } catch (_) {}
  fx.repeat(40, 3, (i) => {
    if (!player.isValid) return;
    const l = player.location;
    fx.emit(player.dimension, 'yeti:snow_dust', l);
    if (i % 3 === 0) fx.emit(player.dimension, 'yeti:frost_mist', fx.add(l, { x: 0, y: 0.4, z: 0 }));
  });
}

function frostbiteHit(attacker, target) {
  effect(target, 'slowness', 60, 2); // như function frozen_scythe_skill cũ
  const dim = target.dimension;
  fx.hitFx(dim, target.location);
  fx.emit(dim, 'yeti:snowflake', fx.add(target.location, { x: 0, y: 1, z: 0 }));

  const now = system.currentTick;
  const stack = frostbite.get(target.id);
  const count = stack && now - stack.tick <= 80 ? stack.count + 1 : 1;
  frostbite.set(target.id, { count, tick: now });
  if (attacker?.typeId === 'minecraft:player') {
    try { attacker.onScreenDisplay.setActionBar(`§b❄ Tê Cóng §f${count}/3`); } catch (_) {}
  }
  if (count < 3) return;
  frostbite.delete(target.id);
  effect(target, 'slowness', 30, 4);
  fx.emit(dim, 'yeti:frozen_mark', fx.add(target.location, { x: 0, y: 2.3, z: 0 }));
  fx.emit(dim, 'yeti:frost_mist', fx.add(target.location, { x: 0, y: 1, z: 0 }));
  // chờ hết khung bất tử của đòn đánh vừa rồi rồi mới cho băng vỡ
  system.runTimeout(() => {
    if (!target.isValid) return;
    const l = fx.add(target.location, { x: 0, y: 1, z: 0 });
    try {
      if (attacker?.isValid) target.applyDamage(5, { cause: EntityDamageCause.freezing, damagingEntity: attacker });
      else target.applyDamage(5, { cause: EntityDamageCause.freezing });
    } catch (_) {}
    fx.emit(target.dimension, 'yeti:ice_burst', l);
    fx.emit(target.dimension, 'yeti:ice_shard', l);
    fx.sound(target.dimension, 'random.glass', l, 1.2, 1.2);
    if (attacker?.typeId === 'minecraft:player') {
      try { attacker.onScreenDisplay.setActionBar('§b§l❄ Băng vỡ!'); } catch (_) {}
    }
  }, 10);
}

// ---------------------------------------------------------------- Frozen Scythe

function frostGuardians(player) {
  const dim = player.dimension;
  const loc = player.location;
  effect(player, 'resistance', 60, 1);
  try { player.runCommand('function yeti_paticle_frozen_scythe'); } catch (_) {}
  fx.emit(dim, 'yeti:frost_ring', fx.add(loc, { x: 0, y: 0.1, z: 0 }), { radius: 5 });
  fx.emit(dim, 'yeti:ice_burst', fx.add(loc, { x: 0, y: 1, z: 0 }));
  fx.sound(dim, 'mob.evocation_illager.cast_spell', loc, 1.2, 1.2);
  fx.sound(dim, 'random.glass', loc, 1, 1.4);
  for (const m of monstersNear(dim, loc, 5)) {
    effect(m, 'slowness', 60, 2);
    fx.emit(dim, 'yeti:snowflake', fx.add(m.location, { x: 0, y: 1, z: 0 }));
  }

  let allies = 0;
  try { allies = dim.getEntities({ location: loc, maxDistance: 32, tags: [ALLY_TAG] }).length; } catch (_) {}
  const count = Math.min(3, 5 - allies);
  for (let i = 0; i < count; i++) {
    const a = (i / Math.max(1, count)) * Math.PI * 2 + Math.random();
    const spot = fx.groundAt(dim, { x: loc.x + Math.cos(a) * 2.5, y: loc.y, z: loc.z + Math.sin(a) * 2.5 });
    fx.emit(dim, 'yeti:rune_circle', fx.add(spot, { x: 0, y: 0.06, z: 0 }), { radius: 1.1, life: 1 });
    system.runTimeout(() => {
      fx.emit(dim, 'yeti:ice_pillar', spot);
      fx.emit(dim, 'yeti:frost_mist', fx.add(spot, { x: 0, y: 0.5, z: 0 }));
      try {
        const pet = dim.spawnEntity('ytaun:yeti_pet', spot);
        pet.addTag(ALLY_TAG);
        system.runTimeout(() => {
          if (!pet.isValid) return;
          fx.emit(pet.dimension, 'yeti:ice_shard', fx.add(pet.location, { x: 0, y: 1, z: 0 }));
          fx.emit(pet.dimension, 'yeti:frost_mist', fx.add(pet.location, { x: 0, y: 1, z: 0 }));
          pet.remove();
        }, 1200);
      } catch (_) {}
    }, 20 + i * 4);
  }
  try { player.onScreenDisplay.setActionBar('§b❄ Vệ Binh Băng!'); } catch (_) {}
}

function scytheHit(target) {
  effect(target, 'slowness', 60, 2); // như function frozen_scythe_skill cũ
  const dim = target.dimension;
  fx.hitFx(dim, target.location);
  fx.emit(dim, 'yeti:frost_ring', fx.add(target.location, { x: 0, y: 0.1, z: 0 }), { radius: 1.6 });
}

// ---------------------------------------------------------------- Ice Bar

function iceBastion(player) {
  const dim = player.dimension;
  const center = fx.groundAt(dim, player.location);
  const radius = 4;
  effect(player, 'resistance', 100, 1);
  try { player.runCommand('particle frozendd_scythe ~ ~ ~'); } catch (_) {}
  fx.sound(dim, 'beacon.activate', center, 1.2, 1.4);
  fx.sound(dim, 'random.glass', center, 1, 0.8);
  fx.emit(dim, 'yeti:frost_ring', fx.add(center, { x: 0, y: 0.1, z: 0 }), { radius: radius + 1 });
  for (const wave of [0, 60]) {
    system.runTimeout(() => {
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        const spot = fx.groundAt(dim, { x: center.x + Math.cos(a) * radius, y: center.y, z: center.z + Math.sin(a) * radius });
        fx.spike(dim, spot, 1.8, 60);
        fx.emit(dim, 'yeti:ice_pillar', spot);
      }
    }, wave);
  }
  fx.repeat(24, 5, (i) => {
    if (i % 2 === 0) fx.emit(dim, 'yeti:dome_edge', center, { radius });
    for (const m of monstersNear(dim, center, radius + 0.5)) {
      const dir = fx.dirXZ(center, m.location);
      try { m.applyKnockback({ x: dir.x * 0.8, z: dir.z * 0.8 }, 0.2); } catch (_) {}
      effect(m, 'slowness', 40, 2);
      fx.emit(dim, 'yeti:snowflake', fx.add(m.location, { x: 0, y: 1, z: 0 }));
    }
  });
  try { player.onScreenDisplay.setActionBar('§b❄ Pháo Đài Băng!'); } catch (_) {}
}

// ---------------------------------------------------------------- đăng ký component

system.beforeEvents.startup.subscribe(initEvent => {
  const registry = initEvent.itemComponentRegistry;

  registry.registerCustomComponent('ytaun_cooked_yeti_meat:trigger', {
    onConsume: e => {
      e.source.addEffect("minecraft:fire_resistance", 6000, { amplifier: 1 });
      e.source.addEffect("minecraft:resistance", 6000, { amplifier: 0 });
      e.source.addEffect("minecraft:strength", 6000, { amplifier: 0 });
    },
  });

  registry.registerCustomComponent('ytaun_frozen_sword:trigger', {
    onUse: e => frostStep(e.source),
    onHitEntity: e => frostbiteHit(e.attackingEntity, e.hitEntity),
  });

  registry.registerCustomComponent('ytaun_frozenscythe:trigger', {
    onUse: e => frostGuardians(e.source),
    onHitEntity: e => scytheHit(e.hitEntity),
  });

  registry.registerCustomComponent('ytaun_ice_bar:trigger', {
    onUse: e => iceBastion(e.source),
  });

  registry.registerCustomComponent('ytaun_yeti_meat:trigger', {
    onConsume: e => {
      e.source.addEffect("minecraft:fire_resistance", 1200, { amplifier: 1 });
      e.source.addEffect("minecraft:hunger", 2400, { amplifier: 2 });
      e.source.addEffect("minecraft:nausea", 1200, { amplifier: 1 });
    },
  });
});

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => frostbite.delete(removedEntityId));
