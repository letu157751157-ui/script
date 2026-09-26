import { world, system } from "@minecraft/server";

// Danh sách giáp có kháng
const RESISTANCE_ARMORS = [
  "pa:dark_night_helmet",
  "pa:dark_night_chestplate",
  "pa:dark_night_legging",
  "pa:dark_night_boot",
  "pa:frozen_helmet",
  "pa:frozen_chestplate",
  "pa:frozen_legging",
  "pa:frozen_boot",
  "pa:frozen_hat",
  "pa:frozemeral_chestplate",
  "pa:frozether_legging",
  "pa:frozpeed_boot",
  "pa:crab_helmet",
  "pa:crabl_chestplate",
  "pa:crab_legging",
  "pa:crab_boot"
];

// Lưu số món giáp của mỗi player
const playerArmorCount = new Map();

// Check giáp định kỳ (ít lag)
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      const equip = player.getComponent("equippable");
      let count = 0;
      
      // Đếm giáp
      const items = [
        equip.getEquipment("Head"),
        equip.getEquipment("Chest"),
        equip.getEquipment("Legs"),
        equip.getEquipment("Feet")
      ];
      
      for (const item of items) {
        if (item && RESISTANCE_ARMORS.includes(item.typeId)) count++;
      }
      
      // Lưu số món giáp
      playerArmorCount.set(player.id, count);
      
    } catch {}
  }
}, 20); // Check mỗi giây

// Khi bị đánh - xử lý knockback NGAY
world.afterEvents.entityHurt.subscribe((event) => {
  const entity = event.hurtEntity;
  
  if (entity.typeId !== "minecraft:player") return;
  
  try {
    const player = entity;
    const armorCount = playerArmorCount.get(player.id) || 0;
    
    if (armorCount === 0) return;
    
    // Tính % kháng (20% mỗi món)
    const resistance = armorCount * 0.2;
    
    // Chờ 1 tick để velocity update
    system.runTimeout(() => {
      try {
        const vel = player.getVelocity();
        
        // CHỈ giảm velocity, KHÔNG teleport
        player.applyKnockback(
          0, 0,
          vel.x * (1 - resistance),
          vel.z * (1 - resistance)
        );
        
      } catch {}
    }, 1);
    
  } catch {}
});

// Dọn dẹp khi player rời
world.afterEvents.playerLeave.subscribe((e) => {
  playerArmorCount.delete(e.playerId);
});