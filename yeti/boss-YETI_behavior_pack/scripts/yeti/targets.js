// File: scripts/yeti/targets.js
// Ai là "kẻ địch" của Yeti và lũ đệ băng.
//
// v2.1: chiêu không còn chỉ đánh người chơi. Mọi sinh vật sống đều dính chiêu (người chơi, dân làng,
// golem sắt, sói, pet của người chơi, cả quái khác...), TRỪ phe Yeti: các pha Yeti, pet boss
// và đệ băng (Sói Băng, Hồn Băng, Golem Băng, lính được triệu hồi).
// (v2.2: gai băng giờ thuần particle, không còn là mob.)

import { GameMode } from "@minecraft/server";

export const MINION_TAG = "yeti_minion";

/** Phe Yeti - không bao giờ bị chiêu của Yeti / đệ băng gây sát thương. */
export const KIN_TYPES = new Set([
    "ytaun:yeti_1", "ytaun:yeti_2", "ytaun:yeti_3", "ytaun:yeti_death",
    "ytaun:yeti_boss_pet", "ytaun:yeti_boss_pet_riu",
    "ytaun:frost_wolf", "ytaun:frost_wraith", "ytaun:frost_golem",
]);

/** Thực thể không phải sinh vật (vật phẩm, đạn, xe...). */
const NON_LIVING = [
    "minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:snowball", "minecraft:egg",
    "minecraft:ender_pearl", "minecraft:fireball", "minecraft:small_fireball", "minecraft:trident",
    "minecraft:thrown_trident", "minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:area_effect_cloud",
    "minecraft:armor_stand", "minecraft:painting", "minecraft:boat", "minecraft:chest_boat", "minecraft:minecart",
    "minecraft:falling_block", "minecraft:tnt", "minecraft:lightning_bolt", "minecraft:fishing_hook",
    "minecraft:leash_knot", "minecraft:wind_charge_projectile", "minecraft:breeze_wind_charge_projectile",
];

/** Những sinh vật Yeti chủ động săn (giống danh sách mục tiêu AI của nó) + pet của người chơi. */
const PREY_FAMILIES = ["villager", "wandering_trader", "irongolem", "snowgolem", "wolf", "cat", "fox",
    "hoglin", "zoglin", "brown_dog", "white_dog"];
const PREY_TYPES = new Set(["ytaun:yeti_pet"]);

export function isEnemy(entity) {
    try {
        if (!entity?.isValid || KIN_TYPES.has(entity.typeId)) return false;
        if (entity.typeId === "minecraft:player") return entity.getGameMode() !== GameMode.Spectator;
        if (entity.hasTag(MINION_TAG)) return false;
        return entity.hasComponent("minecraft:health");
    } catch (_) {
        return false;
    }
}

/** Mục tiêu Yeti tự đi tìm khi chưa có ai gây sự (người chơi và các con mồi quen thuộc). */
export function isPrey(entity) {
    if (!isEnemy(entity)) return false;
    if (entity.typeId === "minecraft:player" || PREY_TYPES.has(entity.typeId)) return true;
    try {
        const family = entity.getComponent("minecraft:type_family");
        return !!family && PREY_FAMILIES.some(f => family.hasTypeFamily(f));
    } catch (_) {
        return false;
    }
}

/** Mọi kẻ địch còn sống trong bán kính. */
export function victims(dimension, loc, radius) {
    let list = [];
    try {
        list = dimension.getEntities({ location: loc, maxDistance: radius, excludeFamilies: ["inanimate", "ice"], excludeTypes: NON_LIVING });
    } catch (_) {}
    return list.filter(isEnemy);
}

export function nearest(list, loc) {
    let best, bestD = Infinity;
    for (const e of list) {
        const d = Math.hypot(e.location.x - loc.x, e.location.z - loc.z);
        if (d < bestD) { bestD = d; best = e; }
    }
    return best;
}
