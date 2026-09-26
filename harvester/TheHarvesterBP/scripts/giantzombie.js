// ============================================
// GIANT ZOMBIE BOSS SKILLS SYSTEM
// Copy toàn bộ code này vào main.js
// ============================================
import "./item_trigger";
import { world, system } from "@minecraft/server";

// Biến lưu trạng thái boss
const bossData = new Map();

// Hàm tính khoảng cách
function getDistance(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

// ====== SKILL 1: Ground Slam ======
function groundSlamSkill(boss) {
  try {
    const loc = boss.location;
    const dim = boss.dimension;
    
    // Particle đẹp hơn
    dim.spawnParticle("minecraft:lava_particle", loc);
    dim.spawnParticle("minecraft:huge_explosion_emitter", loc);
    dim.spawnParticle("minecraft:critical_hit_emitter", loc);
    
    // Tạo vòng tròn particle
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const particleLoc = {
        x: loc.x + Math.cos(angle) * 4,
        y: loc.y,
        z: loc.z + Math.sin(angle) * 4
      };
      dim.spawnParticle("minecraft:lava_particle", particleLoc);
    }
    
    dim.playSound("random.explode", loc, { volume: 0.5 });
    
    dim.runCommand(`execute positioned ${loc.x} ${loc.y} ${loc.z} run summon lightning_bolt ~3~~`);
    dim.runCommand(`execute positioned ${loc.x} ${loc.y} ${loc.z} run summon lightning_bolt ~-3~~`);
    
    const entities = dim.getEntities({ location: loc, maxDistance: 6 });
    for (const entity of entities) {
      if (entity.id !== boss.id && entity.typeId !== "minecraft:zombie" && entity.typeId !== "minecraft:husk") {
        entity.addEffect("instant_damage", 20, { amplifier: 0 });
        entity.addEffect("slowness", 60, { amplifier: 1 });
      }
    }
  } catch (e) {}
}

// ====== SKILL 2: Summon Horde ======
function summonHordeSkill(boss) {
  try {
    const loc = boss.location;
    const dim = boss.dimension;
    
    // Triệu hồi 3 zombie + 3 husk
    const positions = [
      {x: 4, z: 0, type: "minecraft:zombie"},
      {x: -4, z: 0, type: "minecraft:husk"},
      {x: 0, z: 4, type: "minecraft:zombie"},
      {x: 0, z: -4, type: "minecraft:husk"},
      {x: 3, z: 3, type: "minecraft:zombie"},
      {x: -3, z: -3, type: "minecraft:husk"}
    ];
    
    for (const pos of positions) {
      // Particle trước khi spawn
      const spawnLoc = {
        x: loc.x + pos.x,
        y: loc.y,
        z: loc.z + pos.z
      };
      
      dim.spawnParticle("minecraft:villager_angry", spawnLoc);
      dim.spawnParticle("minecraft:lava_particle", spawnLoc);
      
      const minion = dim.spawnEntity(pos.type, spawnLoc);
      
      // Buff minion
      minion.addEffect("speed", 999999, { amplifier: 1, showParticles: false });
      minion.addEffect("strength", 999999, { amplifier: 0, showParticles: false });
      
      // Particle khi spawn xong
      dim.spawnParticle("minecraft:huge_explosion_emitter", spawnLoc);
    }
    
    // Particle và âm thanh boss
    dim.spawnParticle("minecraft:villager_angry", loc);
    dim.spawnParticle("minecraft:critical_hit_emitter", loc);
    dim.playSound("mob.zombie.remedy", loc);
    dim.playSound("mob.husk.ambient", loc);
    
    world.sendMessage("§c[Boss] Triệu hồi đàn zombie & husk!");
  } catch (e) {}
}

// ====== SKILL 3: Leap Attack ======
function leapAttackSkill(boss) {
  try {
    const loc = boss.location;
    const dim = boss.dimension;
    
    const entities = dim.getEntities({ location: loc, maxDistance: 12 });
    let nearestTarget = null;
    let minDistance = 12;
    
    for (const entity of entities) {
      if (entity.id !== boss.id && entity.typeId !== "minecraft:zombie" && entity.typeId !== "minecraft:husk") {
        const distance = getDistance(entity.location, loc);
        if (distance < minDistance && distance > 3) {
          nearestTarget = entity;
          minDistance = distance;
        }
      }
    }
    
    if (nearestTarget) {
      // Particle khi nhảy lên
      dim.spawnParticle("minecraft:explosion_particle", loc);
      dim.spawnParticle("minecraft:critical_hit_emitter", loc);
      
      boss.addEffect("levitation", 15, { amplifier: 15 });
      dim.spawnParticle("minecraft:sonic_explosion", nearestTarget.location);
      dim.playSound("mob.irongolem.throw", loc);
      boss.playAnimation("animation.giant_zombie.earthwake");
      // Particle trong lúc bay
      let particleTimer = 0;
      const particleInterval = system.runInterval(() => {
        if (boss && boss.isValid()) {
          dim.spawnParticle("minecraft:villager_angry", boss.location);
          particleTimer++;
          if (particleTimer >= 15) {
            system.clearRun(particleInterval);
          }
        } else {
          system.clearRun(particleInterval);
        }
      }, 1);
      
      // Khi rớt xuống
      system.runTimeout(() => {
        if (boss && boss.isValid()) {
          const landLoc = boss.location;
          
          // Particle mạnh khi hạ cánh
          dim.spawnParticle("minecraft:huge_explosion_emitter", landLoc);
          dim.spawnParticle("minecraft:lava_particle", landLoc);
          dim.spawnParticle("minecraft:critical_hit_emitter", landLoc);
          
          // Tạo vòng tròn particle
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const particleLoc = {
              x: landLoc.x + Math.cos(angle) * 3,
              y: landLoc.y,
              z: landLoc.z + Math.sin(angle) * 3
            };
            dim.spawnParticle("minecraft:lava_particle", particleLoc);
          }
          
          dim.playSound("random.explode", landLoc, { volume: 0.8 });
          
          // Gây sát thương mạnh
          const nearEntities = dim.getEntities({ location: landLoc, maxDistance: 5 });
          for (const e of nearEntities) {
            if (e.id !== boss.id && e.typeId !== "minecraft:zombie" && e.typeId !== "minecraft:husk") {
              e.addEffect("instant_damage", 20, { amplifier: 2 });
              e.addEffect("slowness", 100, { amplifier: 2 });
            }
          }
        }
      }, 15);
    }
  } catch (e) {}
}

// ====== SKILL 4: Poison Aura ======
function poisonAuraSkill(boss) {
  try {
    const loc = boss.location;
    const dim = boss.dimension;
    
    // Particle độc đẹp
    dim.spawnParticle("minecraft:bleach", loc);
    dim.spawnParticle("minecraft:villager_angry", loc);
    
    // Vòng tròn particle độc
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const particleLoc = {
        x: loc.x + Math.cos(angle) * 5,
        y: loc.y + 1,
        z: loc.z + Math.sin(angle) * 5
      };
      dim.spawnParticle("minecraft:bleach", particleLoc);
    }
    
    const entities = dim.getEntities({ location: loc, maxDistance: 10 });
    for (const entity of entities) {
      if (entity.id !== boss.id && entity.typeId !== "minecraft:zombie" && entity.typeId !== "minecraft:husk") {
        entity.addEffect("poison", 80, { amplifier: 0 });
        entity.addEffect("wither", 60, { amplifier: 0 });
      }
    }
  } catch (e) {}
}

// ====== SKILL 5: War Roar ======
function warRoarSkill(boss) {
  try {
    const loc = boss.location;
    const dim = boss.dimension;
    boss.playAnimation("animation.giant_zombie.roar");
    
    // Particle gầm mạnh mẽ
    dim.spawnParticle("minecraft:critical_hit_emitter", loc);
    dim.spawnParticle("minecraft:lava_particle", loc);
    
    // Sóng xung kích particle
    for (let radius = 2; radius <= 8; radius += 2) {
      system.runTimeout(() => {
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          const particleLoc = {
            x: loc.x + Math.cos(angle) * radius,
            y: loc.y + 1,
            z: loc.z + Math.sin(angle) * radius
          };
          dim.spawnParticle("minecraft:critical_hit_emitter", particleLoc);
        }
      }, (radius / 2) * 2);
    }
    
    boss.addEffect("speed", 200, { amplifier: 1 });
    boss.addEffect("strength", 200, { amplifier: 0 });
    
    const entities = dim.getEntities({ location: loc, maxDistance: 15 });
    for (const entity of entities) {
      if (entity.typeId === "minecraft:zombie" || entity.typeId === "minecraft:husk") {
        entity.addEffect("speed", 200, { amplifier: 1 });
        entity.addEffect("strength", 200, { amplifier: 1 });
      }
    }
    
    const nearEntities = dim.getEntities({ location: loc, maxDistance: 8 });
    for (const entity of nearEntities) {
      if (entity.id !== boss.id && entity.typeId !== "minecraft:zombie" && entity.typeId !== "minecraft:husk") {
        entity.addEffect("slowness", 60, { amplifier: 2 });
        entity.addEffect("weakness", 60, { amplifier: 0 });
      }
    }
    
    dim.playSound("mob.enderdragon.growl", loc, { volume: 0.7 });
    world.sendMessage("§c[Boss] Giant Zombie gầm lên!");
  } catch (e) {}
}

// ====== SKILL 6: Throw Rock ======
function throwRockSkill(boss) {
  try {
    const loc = boss.location;
    const dim = boss.dimension;
    
    const entities = dim.getEntities({ location: loc, maxDistance: 20 });
    let targets = [];
    
    for (const entity of entities) {
      if (entity.id !== boss.id && entity.typeId !== "minecraft:zombie") {
        const distance = getDistance(entity.location, loc);
        if (distance > 5 && distance < 20) {
          targets.push(entity);
        }
      }
    }
    
    if (targets.length > 0) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      
      dim.spawnEntity("minecraft:snowball", {
        x: loc.x,
        y: loc.y + 3,
        z: loc.z
      });
      
      dim.playSound("random.bow", loc);
      
      system.runTimeout(() => {
        const tLoc = target.location;
        const nearTargets = dim.getEntities({ location: tLoc, maxDistance: 3 });
        for (const e of nearTargets) {
          if (e.id !== boss.id && e.typeId !== "minecraft:zombie") {
            e.addEffect("instant_damage", 20, { amplifier: 1 });
          }
        }
        dim.spawnParticle("minecraft:lava_particle", tLoc);
      }, 20);
    }
  } catch (e) {}
}

// ====== SKILL 7: Ground Spikes ======
function groundSpikesSkill(boss) {
  try {
    const loc = boss.location;
    const dim = boss.dimension;
    
    dim.playSound("dig.stone", loc);
    dim.spawnParticle("minecraft:lava_particle", loc);
    
    const spikePositions = [
      {x: 3, z: 0}, {x: -3, z: 0},
      {x: 0, z: 3}, {x: 0, z: -3},
      {x: 2, z: 2}, {x: -2, z: -2},
      {x: 2, z: -2}, {x: -2, z: 2}
    ];
    
    for (let i = 0; i < spikePositions.length; i++) {
      const pos = spikePositions[i];
      
      system.runTimeout(() => {
        const spikeLoc = {
          x: loc.x + pos.x,
          y: loc.y,
          z: loc.z + pos.z
        };
        
        // Particle gai đất
        dim.spawnParticle("minecraft:lava_particle", spikeLoc);
        dim.spawnParticle("minecraft:critical_hit_emitter", spikeLoc);
        dim.spawnParticle("minecraft:lava_particle", {x: spikeLoc.x, y: spikeLoc.y + 1, z: spikeLoc.z});
        dim.spawnParticle("minecraft:lava_particle", {x: spikeLoc.x, y: spikeLoc.y + 2, z: spikeLoc.z});
        
        const nearEntities = dim.getEntities({ location: spikeLoc, maxDistance: 2 });
        for (const e of nearEntities) {
          if (e.id !== boss.id && e.typeId !== "minecraft:zombie" && e.typeId !== "minecraft:husk") {
            e.addEffect("instant_damage", 20, { amplifier: 0 });
          }
        }
      }, i * 5);
    }
  } catch (e) {}
}

// ====== SKILL 8: Rage Mode ======
function rageModeSkill(boss) {
  try {
    const loc = boss.location;
    const dim = boss.dimension;
    
    boss.addEffect("speed", 999999, { amplifier: 2, showParticles: false });
    boss.addEffect("resistance", 999999, { amplifier: 1, showParticles: false });
    boss.addEffect("strength", 999999, { amplifier: 0, showParticles: false });
    
    // Particle mạnh mẽ
    dim.spawnParticle("minecraft:lava_particle", loc);
    dim.spawnParticle("minecraft:huge_explosion_emitter", loc);
    dim.spawnParticle("minecraft:critical_hit_emitter", loc);
    
    // Vòng tròn particle bùng nổ
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const particleLoc = {
        x: loc.x + Math.cos(angle) * 6,
        y: loc.y + 1,
        z: loc.z + Math.sin(angle) * 6
      };
      dim.spawnParticle("minecraft:lava_particle", particleLoc);
    }
    
    dim.playSound("mob.enderdragon.growl", loc);
    
    world.sendMessage("§c§l⚠ GIANT ZOMBIE ĐANG BẠO TẤU! ⚠");
  } catch (e) {}
}

// ====== SKILL 9: Heal ======
function healSkill(boss) {
  try {
    boss.addEffect("regeneration", 60, { amplifier: 2 });
    boss.dimension.spawnParticle("minecraft:heart_particle", boss.location);
  } catch (e) {}
}

// ====== HỆ THỐNG CHẠY SKILLS ======
function runBossSkills(boss) {
  const runId = system.runInterval(() => {
    try {
      if (!boss || !boss.isValid()) {
        system.clearRun(runId);
        bossData.delete(boss.id);
        return;
      }
      
      const data = bossData.get(boss.id);
      if (!data) return;
      
      const currentTick = system.currentTick;
      const healthComp = boss.getComponent("health");
      if (!healthComp) return;
      
      const health = healthComp.currentValue;
      const healthPercent = (health / data.maxHealth) * 100;
      
      // Chạy các skill theo thời gian
      if (currentTick - data.lastGroundSlam > 200) {
        groundSlamSkill(boss);
        data.lastGroundSlam = currentTick;
      }
      
      if (currentTick - data.lastSummon > 400) {
        summonHordeSkill(boss);
        data.lastSummon = currentTick;
      }
      
      if (currentTick - data.lastLeap > 160) {
        leapAttackSkill(boss);
        data.lastLeap = currentTick;
      }
      
      if (currentTick - data.lastPoison > 100) {
        poisonAuraSkill(boss);
        data.lastPoison = currentTick;
      }
      
      if (currentTick - data.lastRoar > 240) {
        warRoarSkill(boss);
        data.lastRoar = currentTick;
      }
      
      if (currentTick - data.lastThrow > 120) {
        throwRockSkill(boss);
        data.lastThrow = currentTick;
      }
      
      if (currentTick - data.lastSpikes > 300) {
        groundSpikesSkill(boss);
        data.lastSpikes = currentTick;
      }
      
      if (healthPercent <= 40 && !data.isRage) {
        rageModeSkill(boss);
        data.isRage = true;
      }
      
      if (data.isRage && currentTick - data.lastHeal > 100) {
        healSkill(boss);
        data.lastHeal = currentTick;
      }
      
    } catch (error) {
      world.sendMessage("§c[Error] Boss skill: " + error);
    }
  }, 1);
}

// ====== SỰ KIỆN SPAWN BOSS ======
world.afterEvents.entitySpawn.subscribe((event) => {
  const entity = event.entity;
  
  if (entity.typeId === "pa:giant_zombie_phase2") {
    entity.nameTag = "§c§l⚡ GIANT ZOMBIE BOSS ⚡";
    
    bossData.set(entity.id, {
      maxHealth: entity.getComponent("health").currentValue,
      isRage: false,
      lastGroundSlam: 0,
      lastSummon: 0,
      lastLeap: 0,
      lastPoison: 0,
      lastHeal: 0,
      lastRoar: 0,
      lastThrow: 0,
      lastSpikes: 0
    });
    
    world.sendMessage("§c§l[BOSS] §rGiant Zombie Boss đã xuất hiện!");
    runBossSkills(entity);
  }
});

// ====== SỰ KIỆN BOSS CHẾT ======
world.afterEvents.entityDie.subscribe((event) => {
  const entity = event.deadEntity;
  
  if (entity.typeId === "pa:giant_zombie_phase2") {
    try {
      const loc = entity.location;
      const dim = entity.dimension;
      
      dim.spawnParticle("minecraft:lava_particle", loc);
      dim.playSound("random.explode", loc);
      
      dim.runCommand(`execute positioned ${loc.x} ${loc.y} ${loc.z} run summon xp_orb ~~1~ 0 150`);
      
      world.sendMessage("§6§l★ GIANT ZOMBIE BOSS ĐÃ BỊ ĐÁNH BẠI! ★");
      
      bossData.delete(entity.id);
    } catch (e) {}
  }
});