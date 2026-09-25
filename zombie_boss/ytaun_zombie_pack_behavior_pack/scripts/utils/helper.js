import { system, ItemStack, Direction, GameMode } from '@minecraft/server';

export function randomFunction(funcList) {
    const index = Math.floor(Math.random() * funcList.length);
    return funcList[index];
}

export function randomFromRange([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function decrementStack(player) {
    if (player.getGameMode() == 'creative') return;
    let item = player.getComponent('inventory').container.getItem(player.selectedSlotIndex);
    let inventory = player.getComponent('inventory').container;
    if (item.amount == 1)
        inventory.setItem(player.selectedSlotIndex, undefined);
    else
        inventory.setItem(player.selectedSlotIndex, new ItemStack(item.typeId, item.amount - 1));
}

export function updateLiquidBlock(dimension, location) {
    dimension.setBlockType(location, 'minecraft:bedrock');
    dimension.setBlockType(location, 'minecraft:air');
}

export function updateIfAir(dimension, block, blockLocation) {
    if (block.typeId == 'minecraft:air') updateLiquidBlock(dimension, blockLocation);
}

export const DirectionType = {
    HORIZONTAL: [
        Direction.North,
        Direction.South,
        Direction.West,
        Direction.East
    ]
};

export function getOppositeDirection(direction) {
    switch (direction) {
        case Direction.Up:
            return Direction.Down;
        case Direction.Down:
            return Direction.Up;
        case Direction.North:
            return Direction.South;
        case Direction.East:
            return Direction.West;
        case Direction.South:
            return Direction.North;
        case Direction.West:
            return Direction.East;
        default:
            break;
    }
}

export function doesBlockBlockMovement(block) {
    return (block.typeId != 'minecraft:cobweb' &&
        block.typeId != 'minecraft:bamboo_sapling' &&
        !block.isLiquid &&
        !block.isAir);
}

export const cardinalSides = Object.freeze({
    north: { left: 'east', right: 'west', },
    south: { left: 'west', right: 'east', },
    west: { left: 'north', right: 'south', },
    east: { left: 'south', right: 'north', }
});

export function shouldConnect(block) {
    if (!block || block.isAir || block.isLiquid) return false;

    const id = block.typeId;

    const nonSolidKeywords = [
        "grass",
        "flower",
        "plant",
        "sapling",
        "bamboo",
        "leaves",
        "torch",
        "button",
        "lever",
        "rail",
        "tripwire",
        "carpet",
        "vine",
        "ladder",
        "deadbush",
        "kelp",
        "seagrass",
        "coral",
        "root"
    ];

    if (id.includes("grass") && !id.includes("grass_block")) return false;

    for (const keyword of nonSolidKeywords) {
        if (keyword !== "grass" && id.includes(keyword)) return false;
    }

    if (id.includes("fence") ||
        id.includes("wall") ||
        id.includes("gate") ||
        id.includes("pane") ||
        id.includes("iron_bars")) {
        return true;
    }

    return true;
}

export function safeUpdateStairShape(targetBlock, newShapeState) {
  system.run(() => {
    const currentPerm = targetBlock.permutation;

    if (currentPerm.getState('pa:shape') !== undefined) {
      targetBlock.setPermutation(currentPerm.withState('pa:shape', newShapeState));
    }
  });
}

export function setupCustomBlockDrop(event, isOre = false, allowedTools, lootTablePath, xpRange, hasDropItem = false) {
  if (!hasDropItem) return;

  const player = event.entitySource;
  if (!player || player.typeId !== "minecraft:player") return;

  if (player.getGameMode() === GameMode.Creative) return;

  const { x, y, z } = event.block.location;
  const equippable = player.getComponent("minecraft:equippable");
  if (!equippable) return;

  const mainhandSlot = equippable.getEquipmentSlot("Mainhand");
  const item = mainhandSlot.hasItem() ? mainhandSlot.getItem() : undefined;

  if (!item && !isOre) {
    event.dimension.runCommand(`execute positioned ${x} ${y} ${z} run loot spawn ~~~ loot "${lootTablePath}"`);
    return;
  }

  if (isOre) {
    const itemTags = item ? item.getTags() : [];
    let hasValidTool = false;
    if (allowedTools.length > 0) hasValidTool = allowedTools.some(toolTag => itemTags.includes(toolTag));
    if (!hasValidTool) return;
  }

  const enchantable = item.getComponent("minecraft:enchantable");
  const hasSilkTouch = enchantable?.getEnchantment("silk_touch") !== undefined;
  const fortuneEnch = enchantable?.getEnchantment("fortune");
  const fortuneLevel = fortuneEnch ? fortuneEnch.level : 0;

  if (hasSilkTouch) return;

  let dropMultiplier = 1;
  if (fortuneLevel > 0) {
    const roll = Math.random();
    if (fortuneLevel === 1 && roll < 0.33) {
      dropMultiplier = 2;
    } else if (fortuneLevel === 2) {
      if (roll < 0.25) dropMultiplier = 2;
      else if (roll < 0.50) dropMultiplier = 3;
    } else if (fortuneLevel >= 3) {
      if (roll < 0.20) dropMultiplier = 2;
      else if (roll < 0.40) dropMultiplier = 3;
      else if (roll < 0.60) dropMultiplier = 4;
    }
  }

  for (let i = 0; i < dropMultiplier; i++) {
    event.dimension.runCommand(`execute positioned ${x} ${y} ${z} run loot spawn ~~~ loot "${lootTablePath}"`);
  }

  if (xpRange.length === 0) return;
  const xpAmount = Math.floor(Math.random() * (xpRange[1] - xpRange[0] + 1)) + xpRange[0];
  for (let i = 0; i < xpAmount; i++) {
    event.dimension.runCommand(`summon xp_orb ${x + 0.5} ${y + 0.3} ${z + 0.5}`);
  }
}
