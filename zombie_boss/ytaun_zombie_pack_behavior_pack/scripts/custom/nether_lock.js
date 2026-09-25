import { world, system } from "@minecraft/server";

// ====== KHOÁ ĐỊA NGỤC CHO TỚI KHI GIẾT GIANT ZOMBIE ======
const BOSS_TYPE_ID = "ytaun:giant_zombie";
const NETHER_UNLOCK_KEY = "ytaun:nether_unlocked";
const NETHER_DIMENSION_ID = "minecraft:nether";

// Khi Giant Zombie chết -> mở khoá Địa Ngục vĩnh viễn (lưu vào world, không mất khi tắt game)
world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (!dead || dead.typeId !== BOSS_TYPE_ID) return;

    const alreadyUnlocked = world.getDynamicProperty(NETHER_UNLOCK_KEY) === true;
    if (alreadyUnlocked) return;

    world.setDynamicProperty(NETHER_UNLOCK_KEY, true);
    world.sendMessage("§a§l⚡ GIANT ZOMBIE HAS BEEN DEFEATED! THE NETHER PORTAL IS NOW UNLOCKED! ⚡");
  } catch (e) {
    world.sendMessage("§c[Error] Nether lock (entityDie): " + e);
  }
});

// Chặn player đi vào Nether nếu chưa mở khoá -> teleport ngược lại ngay lập tức
world.afterEvents.playerDimensionChange.subscribe((event) => {
  try {
    const { player, toDimension, fromDimension, fromLocation } = event;
    if (toDimension.id !== NETHER_DIMENSION_ID) return;

    const unlocked = world.getDynamicProperty(NETHER_UNLOCK_KEY) === true;
    if (unlocked) return;

    // Đợi 1 tick để việc chuyển dimension hoàn tất hẳn rồi mới teleport ngược lại,
    // tránh xung đột với chính quá trình chuyển dimension đang diễn ra.
    system.run(() => {
      try {
        if (!player.isValid) return;
        player.teleport(fromLocation, { dimension: fromDimension });
        player.sendMessage("§c§lYou must defeat the Giant Zombie before you can enter the Nether!");
        player.playSound("mob.enderdragon.growl", { volume: 0.8 });
      } catch (e) {
        world.sendMessage("§c[Error] Nether lock (teleport back): " + e);
      }
    });
  } catch (e) {
    world.sendMessage("§c[Error] Nether lock (dimensionChange): " + e);
  }
});
