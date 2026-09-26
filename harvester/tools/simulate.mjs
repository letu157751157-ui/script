// Headless smoke test for the Harvester scripts.
//
//   node harvester/tools/simulate.mjs
//
// Loads the whole behavior pack script graph (scripts/main.js) against a mock of
// @minecraft/server that only offers the events of the API version declared in manifest.json,
// plays a full boss fight (spawn -> phase 2 -> phase 3 -> enrage -> death) and reports:
//   * scripts that fail to load (e.g. subscribing to an event the declared API version lacks),
//   * uncaught errors in timers/events, and exceptions swallowed by the Harvester try/catch blocks,
//   * particles spawned that don't exist or miss Molang variables they read,
//   * animations played that aren't defined in the resource pack.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const BP = process.env.HARVESTER_BP || path.join(ROOT, "TheHarvesterBP");
const RP = path.join(ROOT, "TheHarvesterRP");

// ---------------------------------------------------------------- resource pack facts
const BUILTIN = new Set(["particle_age", "particle_lifetime", "particle_random_1", "particle_random_2",
    "particle_random_3", "particle_random_4", "emitter_age", "emitter_lifetime", "emitter_random_1",
    "emitter_random_2", "emitter_random_3", "emitter_random_4"]);
const particles = {};
for (const file of fs.readdirSync(path.join(RP, "particles"))) {
    const text = fs.readFileSync(path.join(RP, "particles", file), "utf8");
    const data = JSON.parse(text);
    const id = data.particle_effect.description.identifier;
    const vars = new Set([...text.matchAll(/\b(?:v|variable)\.([a-z_0-9]+)/g)].map((m) => m[1]).filter((v) => !BUILTIN.has(v)));
    particles[id] = vars;
}
const animations = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(RP, "animations/pa_harvester.animation.json"), "utf8")).animations));
for (const file of fs.readdirSync(path.join(RP, "animations"))) {
    for (const id of Object.keys(JSON.parse(fs.readFileSync(path.join(RP, "animations", file), "utf8")).animations)) animations.add(id);
}

// ---------------------------------------------------------------- API surface per version
// Event signals that exist in each @minecraft/server version (from its index.d.ts).
const EVENTS = {"1.14.0": {"WorldAfterEvents": ["blockExplode", "buttonPush", "dataDrivenEntityTrigger", "effectAdd", "entityDie", "entityHealthChanged", "entityHitBlock", "entityHitEntity", "entityHurt", "entityLoad", "entityRemove", "entitySpawn", "explosion", "gameRuleChange", "itemCompleteUse", "itemReleaseUse", "itemStartUse", "itemStartUseOn", "itemStopUse", "itemStopUseOn", "itemUse", "itemUseOn", "leverAction", "pistonActivate", "playerBreakBlock", "playerDimensionChange", "playerEmote", "playerGameModeChange", "playerInputPermissionCategoryChange", "playerJoin", "playerLeave", "playerPlaceBlock", "playerSpawn", "pressurePlatePop", "pressurePlatePush", "projectileHitBlock", "projectileHitEntity", "targetBlockHit", "tripWireTrip", "weatherChange", "worldInitialize"], "WorldBeforeEvents": ["effectAdd", "entityRemove", "explosion", "itemUse", "itemUseOn", "playerBreakBlock", "playerGameModeChange", "playerLeave", "weatherChange", "worldInitialize"], "SystemAfterEvents": ["scriptEventReceive"], "SystemBeforeEvents": []}, "1.15.0": {"WorldAfterEvents": ["blockExplode", "buttonPush", "dataDrivenEntityTrigger", "effectAdd", "entityDie", "entityHealthChanged", "entityHitBlock", "entityHitEntity", "entityHurt", "entityLoad", "entityRemove", "entitySpawn", "explosion", "gameRuleChange", "itemCompleteUse", "itemReleaseUse", "itemStartUse", "itemStartUseOn", "itemStopUse", "itemStopUseOn", "itemUse", "itemUseOn", "leverAction", "pistonActivate", "playerBreakBlock", "playerDimensionChange", "playerEmote", "playerGameModeChange", "playerInputPermissionCategoryChange", "playerInteractWithBlock", "playerInteractWithEntity", "playerJoin", "playerLeave", "playerPlaceBlock", "playerSpawn", "pressurePlatePop", "pressurePlatePush", "projectileHitBlock", "projectileHitEntity", "targetBlockHit", "tripWireTrip", "weatherChange", "worldInitialize"], "WorldBeforeEvents": ["effectAdd", "entityRemove", "explosion", "itemUse", "itemUseOn", "playerBreakBlock", "playerGameModeChange", "playerInteractWithBlock", "playerInteractWithEntity", "playerLeave", "weatherChange", "worldInitialize"], "SystemAfterEvents": ["scriptEventReceive"], "SystemBeforeEvents": []}};
// Runtime exports of each version (classes, enums, constants); anything a script imports that is
// not listed here fails to link, exactly like in game.
const EXPORTS = {"1.14.0": ["Block", "BlockComponent", "BlockComponentEntityFallOnEvent", "BlockComponentOnPlaceEvent", "BlockComponentPlayerDestroyEvent", "BlockComponentPlayerInteractEvent", "BlockComponentPlayerPlaceBeforeEvent", "BlockComponentRandomTickEvent", "BlockComponentRegistry", "BlockComponentStepOffEvent", "BlockComponentStepOnEvent", "BlockComponentTickEvent", "BlockComponentTypes", "BlockCustomComponentAlreadyRegisteredError", "BlockCustomComponentReloadNewComponentError", "BlockCustomComponentReloadNewEventError", "BlockCustomComponentReloadVersionError", "BlockEvent", "BlockExplodeAfterEvent", "BlockExplodeAfterEventSignal", "BlockInventoryComponent", "BlockPermutation", "BlockPistonComponent", "BlockPistonState", "BlockRecordPlayerComponent", "BlockSignComponent", "BlockStateType", "BlockStates", "BlockType", "BlockTypes", "BlockVolumeBase", "ButtonPushAfterEvent", "ButtonPushAfterEventSignal", "Camera", "CommandError", "CommandResult", "Component", "Container", "ContainerSlot", "CustomComponentInvalidRegistryError", "CustomComponentNameError", "CustomComponentNameErrorReason", "DataDrivenEntityTriggerAfterEvent", "DataDrivenEntityTriggerAfterEventSignal", "Dimension", "DimensionType", "DimensionTypes", "Direction", "DisplaySlotId", "DyeColor", "EasingType", "Effect", "EffectAddAfterEvent", "EffectAddAfterEventSignal", "EffectAddBeforeEvent", "EffectAddBeforeEventSignal", "EffectType", "EffectTypes", "EnchantmentLevelOutOfBoundsError", "EnchantmentSlot", "EnchantmentType", "EnchantmentTypeNotCompatibleError", "EnchantmentTypeUnknownIdError", "EnchantmentTypes", "Entity", "EntityAddRiderComponent", "EntityAgeableComponent", "EntityAttributeComponent", "EntityBaseMovementComponent", "EntityCanClimbComponent", "EntityCanFlyComponent", "EntityCanPowerJumpComponent", "EntityColor2Component", "EntityColorComponent", "EntityComponent", "EntityComponentTypes", "EntityDamageCause", "EntityDefinitionFeedItem", "EntityDieAfterEvent", "EntityDieAfterEventSignal", "EntityEquippableComponent", "EntityFireImmuneComponent", "EntityFloatsInLiquidComponent", "EntityFlyingSpeedComponent", "EntityFrictionModifierComponent", "EntityGroundOffsetComponent", "EntityHealableComponent", "EntityHealthChangedAfterEvent", "EntityHealthChangedAfterEventSignal", "EntityHealthComponent", "EntityHitBlockAfterEvent", "EntityHitBlockAfterEventSignal", "EntityHitEntityAfterEvent", "EntityHitEntityAfterEventSignal", "EntityHurtAfterEvent", "EntityHurtAfterEventSignal", "EntityInitializationCause", "EntityInventoryComponent", "EntityIsBabyComponent", "EntityIsChargedComponent", "EntityIsChestedComponent", "EntityIsDyeableComponent", "EntityIsHiddenWhenInvisibleComponent", "EntityIsIgnitedComponent", "EntityIsIllagerCaptainComponent", "EntityIsSaddledComponent", "EntityIsShakingComponent", "EntityIsShearedComponent", "EntityIsStackableComponent", "EntityIsStunnedComponent", "EntityIsTamedComponent", "EntityItemComponent", "EntityLavaMovementComponent", "EntityLeashableComponent", "EntityLoadAfterEvent", "EntityLoadAfterEventSignal", "EntityMarkVariantComponent", "EntityMovementAmphibiousComponent", "EntityMovementBasicComponent", "EntityMovementComponent", "EntityMovementFlyComponent", "EntityMovementGenericComponent", "EntityMovementGlideComponent", "EntityMovementHoverComponent", "EntityMovementJumpComponent", "EntityMovementSkipComponent", "EntityMovementSwayComponent", "EntityNavigationClimbComponent", "EntityNavigationComponent", "EntityNavigationFloatComponent", "EntityNavigationFlyComponent", "EntityNavigationGenericComponent", "EntityNavigationHoverComponent", "EntityNavigationWalkComponent", "EntityOnFireComponent", "EntityProjectileComponent", "EntityPushThroughComponent", "EntityRemoveAfterEvent", "EntityRemoveAfterEventSignal", "EntityRemoveBeforeEvent", "EntityRemoveBeforeEventSignal", "EntityRideableComponent", "EntityRidingComponent", "EntityScaleComponent", "EntitySkinIdComponent", "EntitySpawnAfterEvent", "EntitySpawnAfterEventSignal", "EntityStrengthComponent", "EntityTameMountComponent", "EntityTameableComponent", "EntityType", "EntityTypeFamilyComponent", "EntityTypes", "EntityUnderwaterMovementComponent", "EntityVariantComponent", "EntityWantsJockeyComponent", "EquipmentSlot", "ExplosionAfterEvent", "ExplosionAfterEventSignal", "ExplosionBeforeEvent", "ExplosionBeforeEventSignal", "FeedItem", "FeedItemEffect", "FluidType", "GameMode", "GameRule", "GameRuleChangeAfterEvent", "GameRuleChangeAfterEventSignal", "GameRules", "HudElement", "HudElementsCount", "HudVisibility", "HudVisibilityCount", "IButtonPushAfterEventSignal", "ILeverActionAfterEventSignal", "IPlayerJoinAfterEventSignal", "IPlayerLeaveAfterEventSignal", "IPlayerSpawnAfterEventSignal", "InputPermissionCategory", "InvalidContainerSlotError", "InvalidStructureError", "ItemCompleteUseAfterEvent", "ItemCompleteUseAfterEventSignal", "ItemCompleteUseEvent", "ItemComponent", "ItemComponentBeforeDurabilityDamageEvent", "ItemComponentCompleteUseEvent", "ItemComponentConsumeEvent", "ItemComponentHitEntityEvent", "ItemComponentMineBlockEvent", "ItemComponentRegistry", "ItemComponentTypes", "ItemComponentUseEvent", "ItemComponentUseOnEvent", "ItemCooldownComponent", "ItemCustomComponentAlreadyRegisteredError", "ItemCustomComponentReloadNewComponentError", "ItemCustomComponentReloadNewEventError", "ItemCustomComponentReloadVersionError", "ItemDurabilityComponent", "ItemEnchantableComponent", "ItemFoodComponent", "ItemLockMode", "ItemReleaseUseAfterEvent", "ItemReleaseUseAfterEventSignal", "ItemStack", "ItemStartUseAfterEvent", "ItemStartUseAfterEventSignal", "ItemStartUseOnAfterEvent", "ItemStartUseOnAfterEventSignal", "ItemStopUseAfterEvent", "ItemStopUseAfterEventSignal", "ItemStopUseOnAfterEvent", "ItemStopUseOnAfterEventSignal", "ItemType", "ItemTypes", "ItemUseAfterEvent", "ItemUseAfterEventSignal", "ItemUseBeforeEvent", "ItemUseBeforeEventSignal", "ItemUseOnAfterEvent", "ItemUseOnAfterEventSignal", "ItemUseOnBeforeEvent", "ItemUseOnBeforeEventSignal", "ItemUseOnEvent", "LeverActionAfterEvent", "LeverActionAfterEventSignal", "ListBlockVolume", "LocationInUnloadedChunkError", "LocationOutOfWorldBoundariesError", "MinecraftDimensionTypes", "MolangVariableMap", "MoonPhase", "MoonPhaseCount", "ObjectiveSortOrder", "PaletteColor", "PistonActivateAfterEvent", "PistonActivateAfterEventSignal", "Player", "PlayerBreakBlockAfterEvent", "PlayerBreakBlockAfterEventSignal", "PlayerBreakBlockBeforeEvent", "PlayerBreakBlockBeforeEventSignal", "PlayerCursorInventoryComponent", "PlayerDimensionChangeAfterEvent", "PlayerDimensionChangeAfterEventSignal", "PlayerEmoteAfterEvent", "PlayerEmoteAfterEventSignal", "PlayerGameModeChangeAfterEvent", "PlayerGameModeChangeAfterEventSignal", "PlayerGameModeChangeBeforeEvent", "PlayerGameModeChangeBeforeEventSignal", "PlayerInputPermissionCategoryChangeAfterEvent", "PlayerInputPermissionCategoryChangeAfterEventSignal", "PlayerInputPermissions", "PlayerInteractWithBlockAfterEvent", "PlayerInteractWithBlockAfterEventSignal", "PlayerInteractWithBlockBeforeEvent", "PlayerInteractWithBlockBeforeEventSignal", "PlayerInteractWithEntityAfterEvent", "PlayerInteractWithEntityAfterEventSignal", "PlayerInteractWithEntityBeforeEvent", "PlayerInteractWithEntityBeforeEventSignal", "PlayerJoinAfterEvent", "PlayerJoinAfterEventSignal", "PlayerLeaveAfterEvent", "PlayerLeaveAfterEventSignal", "PlayerLeaveBeforeEvent", "PlayerLeaveBeforeEventSignal", "PlayerPlaceBlockAfterEvent", "PlayerPlaceBlockAfterEventSignal", "PlayerSpawnAfterEvent", "PlayerSpawnAfterEventSignal", "PressurePlatePopAfterEvent", "PressurePlatePopAfterEventSignal", "PressurePlatePushAfterEvent", "PressurePlatePushAfterEventSignal", "ProjectileHitBlockAfterEvent", "ProjectileHitBlockAfterEventSignal", "ProjectileHitEntityAfterEvent", "ProjectileHitEntityAfterEventSignal", "Scoreboard", "ScoreboardIdentity", "ScoreboardIdentityType", "ScoreboardObjective", "ScoreboardScoreInfo", "ScreenDisplay", "ScriptEventCommandMessageAfterEvent", "ScriptEventCommandMessageAfterEventSignal", "ScriptEventSource", "Seat", "SignSide", "Structure", "StructureAnimationMode", "StructureManager", "StructureMirrorAxis", "StructureRotation", "StructureSaveMode", "System", "SystemAfterEvents", "TargetBlockHitAfterEvent", "TargetBlockHitAfterEventSignal", "TicksPerSecond", "TimeOfDay", "Trigger", "TripWireTripAfterEvent", "TripWireTripAfterEventSignal", "WeatherChangeAfterEvent", "WeatherChangeAfterEventSignal", "WeatherChangeBeforeEvent", "WeatherChangeBeforeEventSignal", "WeatherType", "World", "WorldAfterEvents", "WorldBeforeEvents", "WorldInitializeAfterEvent", "WorldInitializeAfterEventSignal", "WorldInitializeBeforeEvent", "WorldInitializeBeforeEventSignal", "system", "world"], "1.15.0": ["Block", "BlockComponent", "BlockComponentEntityFallOnEvent", "BlockComponentOnPlaceEvent", "BlockComponentPlayerDestroyEvent", "BlockComponentPlayerInteractEvent", "BlockComponentPlayerPlaceBeforeEvent", "BlockComponentRandomTickEvent", "BlockComponentRegistry", "BlockComponentStepOffEvent", "BlockComponentStepOnEvent", "BlockComponentTickEvent", "BlockComponentTypes", "BlockCustomComponentAlreadyRegisteredError", "BlockCustomComponentReloadNewComponentError", "BlockCustomComponentReloadNewEventError", "BlockCustomComponentReloadVersionError", "BlockEvent", "BlockExplodeAfterEvent", "BlockExplodeAfterEventSignal", "BlockInventoryComponent", "BlockLocationIterator", "BlockPermutation", "BlockPistonComponent", "BlockPistonState", "BlockRecordPlayerComponent", "BlockSignComponent", "BlockStateType", "BlockStates", "BlockType", "BlockTypes", "BlockVolume", "BlockVolumeBase", "BlockVolumeIntersection", "ButtonPushAfterEvent", "ButtonPushAfterEventSignal", "Camera", "CommandError", "CommandResult", "Component", "Container", "ContainerSlot", "CustomComponentInvalidRegistryError", "CustomComponentNameError", "CustomComponentNameErrorReason", "DataDrivenEntityTriggerAfterEvent", "DataDrivenEntityTriggerAfterEventSignal", "Dimension", "DimensionType", "DimensionTypes", "Direction", "DisplaySlotId", "DyeColor", "EasingType", "Effect", "EffectAddAfterEvent", "EffectAddAfterEventSignal", "EffectAddBeforeEvent", "EffectAddBeforeEventSignal", "EffectType", "EffectTypes", "EnchantmentLevelOutOfBoundsError", "EnchantmentSlot", "EnchantmentType", "EnchantmentTypeNotCompatibleError", "EnchantmentTypeUnknownIdError", "EnchantmentTypes", "Entity", "EntityAddRiderComponent", "EntityAgeableComponent", "EntityAttributeComponent", "EntityBaseMovementComponent", "EntityBreathableComponent", "EntityCanClimbComponent", "EntityCanFlyComponent", "EntityCanPowerJumpComponent", "EntityColor2Component", "EntityColorComponent", "EntityComponent", "EntityComponentTypes", "EntityDamageCause", "EntityDefinitionFeedItem", "EntityDieAfterEvent", "EntityDieAfterEventSignal", "EntityEquippableComponent", "EntityFireImmuneComponent", "EntityFloatsInLiquidComponent", "EntityFlyingSpeedComponent", "EntityFrictionModifierComponent", "EntityGroundOffsetComponent", "EntityHealableComponent", "EntityHealthChangedAfterEvent", "EntityHealthChangedAfterEventSignal", "EntityHealthComponent", "EntityHitBlockAfterEvent", "EntityHitBlockAfterEventSignal", "EntityHitEntityAfterEvent", "EntityHitEntityAfterEventSignal", "EntityHurtAfterEvent", "EntityHurtAfterEventSignal", "EntityInitializationCause", "EntityInventoryComponent", "EntityIsBabyComponent", "EntityIsChargedComponent", "EntityIsChestedComponent", "EntityIsDyeableComponent", "EntityIsHiddenWhenInvisibleComponent", "EntityIsIgnitedComponent", "EntityIsIllagerCaptainComponent", "EntityIsSaddledComponent", "EntityIsShakingComponent", "EntityIsShearedComponent", "EntityIsStackableComponent", "EntityIsStunnedComponent", "EntityIsTamedComponent", "EntityItemComponent", "EntityLavaMovementComponent", "EntityLeashableComponent", "EntityLoadAfterEvent", "EntityLoadAfterEventSignal", "EntityMarkVariantComponent", "EntityMovementAmphibiousComponent", "EntityMovementBasicComponent", "EntityMovementComponent", "EntityMovementFlyComponent", "EntityMovementGenericComponent", "EntityMovementGlideComponent", "EntityMovementHoverComponent", "EntityMovementJumpComponent", "EntityMovementSkipComponent", "EntityMovementSwayComponent", "EntityNavigationClimbComponent", "EntityNavigationComponent", "EntityNavigationFloatComponent", "EntityNavigationFlyComponent", "EntityNavigationGenericComponent", "EntityNavigationHoverComponent", "EntityNavigationWalkComponent", "EntityOnFireComponent", "EntityProjectileComponent", "EntityPushThroughComponent", "EntityRemoveAfterEvent", "EntityRemoveAfterEventSignal", "EntityRemoveBeforeEvent", "EntityRemoveBeforeEventSignal", "EntityRideableComponent", "EntityRidingComponent", "EntityScaleComponent", "EntitySkinIdComponent", "EntitySpawnAfterEvent", "EntitySpawnAfterEventSignal", "EntityStrengthComponent", "EntityTameMountComponent", "EntityTameableComponent", "EntityType", "EntityTypeFamilyComponent", "EntityTypes", "EntityUnderwaterMovementComponent", "EntityVariantComponent", "EntityWantsJockeyComponent", "EquipmentSlot", "ExplosionAfterEvent", "ExplosionAfterEventSignal", "ExplosionBeforeEvent", "ExplosionBeforeEventSignal", "FeedItem", "FeedItemEffect", "FluidType", "GameMode", "GameRule", "GameRuleChangeAfterEvent", "GameRuleChangeAfterEventSignal", "GameRules", "HudElement", "HudElementsCount", "HudVisibility", "HudVisibilityCount", "IButtonPushAfterEventSignal", "ILeverActionAfterEventSignal", "IPlayerJoinAfterEventSignal", "IPlayerLeaveAfterEventSignal", "IPlayerSpawnAfterEventSignal", "InputPermissionCategory", "InvalidContainerSlotError", "InvalidIteratorError", "InvalidStructureError", "ItemCompleteUseAfterEvent", "ItemCompleteUseAfterEventSignal", "ItemCompleteUseEvent", "ItemComponent", "ItemComponentBeforeDurabilityDamageEvent", "ItemComponentCompleteUseEvent", "ItemComponentConsumeEvent", "ItemComponentHitEntityEvent", "ItemComponentMineBlockEvent", "ItemComponentRegistry", "ItemComponentTypes", "ItemComponentUseEvent", "ItemComponentUseOnEvent", "ItemCooldownComponent", "ItemCustomComponentAlreadyRegisteredError", "ItemCustomComponentReloadNewComponentError", "ItemCustomComponentReloadNewEventError", "ItemCustomComponentReloadVersionError", "ItemDurabilityComponent", "ItemEnchantableComponent", "ItemFoodComponent", "ItemLockMode", "ItemReleaseUseAfterEvent", "ItemReleaseUseAfterEventSignal", "ItemStack", "ItemStartUseAfterEvent", "ItemStartUseAfterEventSignal", "ItemStartUseOnAfterEvent", "ItemStartUseOnAfterEventSignal", "ItemStopUseAfterEvent", "ItemStopUseAfterEventSignal", "ItemStopUseOnAfterEvent", "ItemStopUseOnAfterEventSignal", "ItemType", "ItemTypes", "ItemUseAfterEvent", "ItemUseAfterEventSignal", "ItemUseBeforeEvent", "ItemUseBeforeEventSignal", "ItemUseOnAfterEvent", "ItemUseOnAfterEventSignal", "ItemUseOnBeforeEvent", "ItemUseOnBeforeEventSignal", "ItemUseOnEvent", "LeverActionAfterEvent", "LeverActionAfterEventSignal", "ListBlockVolume", "LocationInUnloadedChunkError", "LocationOutOfWorldBoundariesError", "MinecraftDimensionTypes", "MolangVariableMap", "MoonPhase", "MoonPhaseCount", "ObjectiveSortOrder", "PaletteColor", "PistonActivateAfterEvent", "PistonActivateAfterEventSignal", "Player", "PlayerBreakBlockAfterEvent", "PlayerBreakBlockAfterEventSignal", "PlayerBreakBlockBeforeEvent", "PlayerBreakBlockBeforeEventSignal", "PlayerCursorInventoryComponent", "PlayerDimensionChangeAfterEvent", "PlayerDimensionChangeAfterEventSignal", "PlayerEmoteAfterEvent", "PlayerEmoteAfterEventSignal", "PlayerGameModeChangeAfterEvent", "PlayerGameModeChangeAfterEventSignal", "PlayerGameModeChangeBeforeEvent", "PlayerGameModeChangeBeforeEventSignal", "PlayerInputPermissionCategoryChangeAfterEvent", "PlayerInputPermissionCategoryChangeAfterEventSignal", "PlayerInputPermissions", "PlayerInteractWithBlockAfterEvent", "PlayerInteractWithBlockAfterEventSignal", "PlayerInteractWithBlockBeforeEvent", "PlayerInteractWithBlockBeforeEventSignal", "PlayerInteractWithEntityAfterEvent", "PlayerInteractWithEntityAfterEventSignal", "PlayerInteractWithEntityBeforeEvent", "PlayerInteractWithEntityBeforeEventSignal", "PlayerJoinAfterEvent", "PlayerJoinAfterEventSignal", "PlayerLeaveAfterEvent", "PlayerLeaveAfterEventSignal", "PlayerLeaveBeforeEvent", "PlayerLeaveBeforeEventSignal", "PlayerPlaceBlockAfterEvent", "PlayerPlaceBlockAfterEventSignal", "PlayerSpawnAfterEvent", "PlayerSpawnAfterEventSignal", "PressurePlatePopAfterEvent", "PressurePlatePopAfterEventSignal", "PressurePlatePushAfterEvent", "PressurePlatePushAfterEventSignal", "ProjectileHitBlockAfterEvent", "ProjectileHitBlockAfterEventSignal", "ProjectileHitEntityAfterEvent", "ProjectileHitEntityAfterEventSignal", "Scoreboard", "ScoreboardIdentity", "ScoreboardIdentityType", "ScoreboardObjective", "ScoreboardScoreInfo", "ScreenDisplay", "ScriptEventCommandMessageAfterEvent", "ScriptEventCommandMessageAfterEventSignal", "ScriptEventSource", "Seat", "SignSide", "Structure", "StructureAnimationMode", "StructureManager", "StructureMirrorAxis", "StructureRotation", "StructureSaveMode", "System", "SystemAfterEvents", "TargetBlockHitAfterEvent", "TargetBlockHitAfterEventSignal", "TicksPerSecond", "TimeOfDay", "Trigger", "TripWireTripAfterEvent", "TripWireTripAfterEventSignal", "WeatherChangeAfterEvent", "WeatherChangeAfterEventSignal", "WeatherChangeBeforeEvent", "WeatherChangeBeforeEventSignal", "WeatherType", "World", "WorldAfterEvents", "WorldBeforeEvents", "WorldInitializeAfterEvent", "WorldInitializeAfterEventSignal", "WorldInitializeBeforeEvent", "WorldInitializeBeforeEventSignal", "system", "world"]};
const manifest = JSON.parse(fs.readFileSync(path.join(BP, "manifest.json"), "utf8"));
const API = manifest.dependencies.find((d) => d.module_name === "@minecraft/server")?.version;

// ---------------------------------------------------------------- mock @minecraft/server
const problems = new Map();
function problem(kind, detail) {
    const key = kind + ": " + detail;
    problems.set(key, (problems.get(key) ?? 0) + 1);
}
const stats = { particles: {}, animations: {}, sounds: 0, damage: 0, casts: {} };

const mock = `
export const __hooks = globalThis.__harvesterMock;
const H = __hooks;
export class MolangVariableMap {
  constructor() { this.vars = {}; }
  setFloat(name, value) { if (!Number.isFinite(value)) H.problem("molang", name + " = " + value); this.vars[name.replace(/^variable\\./, "")] = value; }
  setColorRGB(name, c) { for (const k of ["r","g","b"]) this.vars[name.replace(/^variable\\./, "") + "." + k] = c[k === "r" ? "red" : k === "g" ? "green" : "blue"]; }
  setSpeedAndDirection(name, speed, d) { const n = name.replace(/^variable\\./, ""); this.vars[n + ".speed"] = speed; }
}
export const system = H.system;
export const world = H.world;
export const EquipmentSlot = { Mainhand: "Mainhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet", Offhand: "Offhand" };
export const GameMode = { creative: "creative", spectator: "spectator", survival: "survival", adventure: "adventure" };
const names = (list) => Object.fromEntries(list.map((n) => [n, n]));
export const EntityDamageCause = names(["anvil","blockExplosion","campfire","charging","contact","drowning","entityAttack","entityExplosion","fall","fallingBlock","fire","fireTick","fireworks","flyIntoWall","freezing","lava","lightning","magic","magma","none","override","piston","projectile","ramAttack","selfDestruct","sonicBoom","soulCampfire","stalactite","stalagmite","starve","suffocation","suicide","temperature","thorns","void","wither"]);
export const ItemComponentTypes = { Durability: "minecraft:durability", Enchantable: "minecraft:enchantable", Cooldown: "minecraft:cooldown", Food: "minecraft:food" };
export const EntityComponentTypes = { Equippable: "minecraft:equippable", Health: "minecraft:health", Inventory: "minecraft:inventory" };
export const Direction = { Down: "Down", East: "East", North: "North", South: "South", Up: "Up", West: "West" };
export class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; } getComponent() { return undefined; } hasComponent() { return false; } getTags() { return []; } hasTag() { return false; } }
`;

class Signal {
    constructor() { this.subs = []; }
    subscribe(fn) { this.subs.push(fn); return fn; }
    unsubscribe(fn) { this.subs = this.subs.filter((s) => s !== fn); }
    fire(e) {
        for (const fn of this.subs) {
            try { fn(e); } catch (err) { problem("uncaught", String(err && err.stack ? err.stack.split("\n").slice(0, 2).join(" | ") : err)); }
        }
    }
}

let tick = 0;
const timers = [];
const system = {
    get currentTick() { return tick; },
    runTimeout(fn, ticks = 1) { timers.push({ at: tick + Math.max(1, ticks | 0), fn }); return timers.length; },
    runInterval(fn, ticks = 1) { const t = { every: Math.max(1, ticks | 0), at: tick + Math.max(1, ticks | 0), fn }; timers.push(t); return timers.length; },
    run(fn) { timers.push({ at: tick + 1, fn }); },
    clearRun() {},
    afterEvents: null,
    beforeEvents: {},
};

if (!EVENTS[API]) { console.log("Unknown @minecraft/server version in manifest:", API); process.exit(1); }
const after = {};
for (const n of EVENTS[API].WorldAfterEvents) after[n] = new Signal();
const before = {};
for (const n of EVENTS[API].WorldBeforeEvents) before[n] = new Signal();
const systemAfter = {};
for (const n of EVENTS[API].SystemAfterEvents) systemAfter[n] = new Signal();
let readOnly = false; // before-event callbacks run in read-only mode
function fireBefore(signal, e) { readOnly = true; try { signal.fire(e); } finally { readOnly = false; } }
function writable(what) { if (readOnly) throw new Error(what + " can't be called in read-only mode"); }

let nextId = 1;
const entities = new Map();

function mockItem(typeId) {
    return { typeId, amount: 1, hasComponent: () => false, getComponent: () => undefined, getTags: () => [], hasTag: () => false };
}

class MockEntity {
    constructor(typeId, dim, loc, hp = 20) {
        this.id = String(nextId++);
        this.typeId = typeId;
        this.dimension = dim;
        this.location = { ...loc };
        this.hp = hp; this.maxHp = hp;
        this.tags = new Set();
        this.effects = {};
        this.valid = true;
        this.nameTag = "";
        this.velocity = { x: 0, y: 0, z: 0 };
        this.isOnGround = true;
        entities.set(this.id, this);
    }
    isValid() { return this.valid; }
    getComponent(id) {
        if (id === "minecraft:health") {
            const self = this;
            return {
                get currentValue() { return self.hp; }, get effectiveMax() { return self.maxHp; },
                setCurrentValue(v) { writable("setCurrentValue"); if (!Number.isFinite(v)) problem("health", "setCurrentValue " + v); self.hp = Math.min(v, self.maxHp); return true; },
                resetToMaxValue() { self.hp = self.maxHp; },
            };
        }
        if (id === "minecraft:inventory") {
            const self = this;
            return { container: { getItem(slot) { return self.held && slot === self.selectedSlotIndex ? mockItem(self.held) : undefined; } } };
        }
        if (id === "minecraft:equippable") {
            const self = this;
            return { getEquipment(slot) { return self.held && (slot === "Mainhand" || slot === undefined) ? mockItem(self.held) : undefined; }, setEquipment() { return true; } };
        }
        return undefined;
    }
    addEffect(id, ticks, opts) {
        writable("addEffect");
        if (ticks < 1 || ticks > 20000000) problem("effect", `${id} duration ${ticks}`);
        if (opts && (opts.amplifier < 0 || opts.amplifier > 255)) problem("effect", `${id} amplifier ${opts.amplifier}`);
        this.effects[id] = { until: tick + ticks, amp: opts?.amplifier ?? 0 };
    }
    removeEffect(id) { delete this.effects[id]; return true; }
    getEffect(id) { return this.effects[id]; }
    applyDamage(amount, opts) {
        writable("applyDamage");
        if (!this.valid) throw new Error("InvalidEntity");
        if (!Number.isFinite(amount)) problem("damage", "non-finite " + amount);
        if (this.gameMode === "creative" || this.gameMode === "spectator") return false; // invulnerable, like in game
        if (this.typeId === "minecraft:player") stats.damage += amount;
        const mitigated = (this.effects.resistance?.until > tick && this.effects.resistance.amp >= 4) ? 0 : amount;
        this.hp -= mitigated;
        world._afterQueue.push(() => after.entityHurt.fire({ hurtEntity: this, damage: amount, damageSource: { cause: opts?.cause ?? "none", damagingEntity: opts?.damagingEntity } }));
        if (this.hp <= 0 && this.valid) this.die(opts?.damagingEntity);
        return true;
    }
    die(killer) {
        this.hp = 0;
        const self = this;
        world._afterQueue.push(() => after.entityDie.fire({ deadEntity: self, damageSource: { cause: "entityAttack", damagingEntity: killer } }));
        world._afterQueue.push(() => {
            if (self.typeId === "minecraft:player") { self.hp = self.maxHp; self.location = { x: 0, y: 64, z: 0 }; return; }
            self.valid = false; entities.delete(self.id);
            after.entityRemove.fire({ removedEntityId: self.id, typeId: self.typeId });
        });
    }
    kill() { this.die(); return true; }
    remove() { this.valid = false; entities.delete(this.id); }
    applyKnockback(x, z, h, v) { if (arguments.length !== 4) problem("api", "applyKnockback expects 4 args in 1.14"); [x, z, h, v].forEach((n) => { if (!Number.isFinite(n)) problem("knockback", "NaN"); }); }
    applyImpulse() {}
    clearVelocity() {}
    getVelocity() { return { ...this.velocity }; }
    getViewDirection() { return { x: Math.sin(this.yaw ?? 0), y: 0, z: Math.cos(this.yaw ?? 0) }; }
    getHeadLocation() { return { x: this.location.x, y: this.location.y + 1.6, z: this.location.z }; }
    getRotation() { return { x: 0, y: 0 }; }
    teleport(loc, opts) {
        if (!this.valid) throw new Error("InvalidEntity");
        for (const k of ["x", "y", "z"]) if (!Number.isFinite(loc[k])) problem("teleport", "NaN location");
        if (opts?.facingLocation) for (const k of ["x", "y", "z"]) if (!Number.isFinite(opts.facingLocation[k])) problem("teleport", "NaN facing");
        this.location = { ...loc };
    }
    tryTeleport(loc, opts) { this.teleport(loc, opts); return Math.random() > 0.3; }
    playAnimation(name, opts) {
        if (!animations.has(name)) problem("animation", "missing " + name);
        stats.animations[name] = (stats.animations[name] ?? 0) + 1;
        const short = name.replace("animation.pa_harvester.", "");
        if (short.startsWith("skill_")) stats.casts[short] = (stats.casts[short] ?? 0) + 1;
    }
    addTag(t) { this.tags.add(t); return true; }
    removeTag(t) { return this.tags.delete(t); }
    hasTag(t) { return this.tags.has(t); }
    getTags() { return [...this.tags]; }
    triggerEvent() {}
    runCommand() { return { successCount: 1 }; }
    getDynamicProperty() { return undefined; }
    setDynamicProperty() {}
    getProperty() { return undefined; }
    setProperty() {}
}

class MockPlayer extends MockEntity {
    constructor(name, dim, loc) {
        super("minecraft:player", dim, loc, 20);
        this.name = name;
        this.selectedSlotIndex = 0;
        this.gameMode = "survival";
        this.onScreenDisplay = {
            setTitle(t, o) { if (o && (o.fadeInDuration === undefined || o.stayDuration === undefined || o.fadeOutDuration === undefined)) problem("api", "setTitle options need fadeIn/stay/fadeOut in 1.14"); },
            updateSubtitle() {}, setActionBar() {},
        };
    }
    sendMessage() {}
    playSound() { stats.sounds++; }
    getGameMode() { return this.gameMode; }
}

function matches(e, o, dim) {
    if (e.dimension !== dim || !e.valid) return false;
    if (o.type && e.typeId !== o.type) return false;
    if (o.excludeTypes && o.excludeTypes.includes(e.typeId)) return false;
    if (o.tags && !o.tags.every((t) => e.tags.has(t))) return false;
    if (o.excludeGameModes && e.gameMode && o.excludeGameModes.includes(e.gameMode)) return false;
    if (o.location && o.maxDistance !== undefined) {
        const d = Math.hypot(e.location.x - o.location.x, e.location.y - o.location.y, e.location.z - o.location.z);
        if (d > o.maxDistance) return false;
    }
    return true;
}

function makeDim(id) {
    const dim = {
        id: "minecraft:" + id,
        getEntities(o = {}) {
            for (const k of ["x", "y", "z"]) if (o.location && !Number.isFinite(o.location[k])) problem("query", "NaN location");
            return [...entities.values()].filter((e) => matches(e, o, dim));
        },
        getPlayers(o = {}) { return dim.getEntities({ ...o, type: "minecraft:player" }); },
        spawnParticle(pid, loc, map) {
            stats.particles[pid] = (stats.particles[pid] ?? 0) + 1;
            if (!particles[pid]) { if (pid.startsWith("harvester:")) problem("particle", "missing " + pid); return; }
            for (const k of ["x", "y", "z"]) if (!Number.isFinite(loc[k])) problem("particle", pid + " at NaN");
            const given = map ? Object.keys(map.vars) : [];
            for (const v of particles[pid]) if (!given.includes(v)) problem("particle", `${pid} reads v.${v} but the script did not set it`);
        },
        playSound(sid, loc, opts) { stats.sounds++; for (const k of ["x", "y", "z"]) if (!Number.isFinite(loc[k])) problem("sound", "NaN"); },
        spawnEntity(type, loc) { const e = new MockEntity(type, dim, loc, 20); world._afterQueue.push(() => after.entitySpawn.fire({ entity: e, cause: "Spawned" })); return e; },
        getBlock() { return { isAir: true, isLiquid: false, typeId: "minecraft:air" }; },
        getTopmostBlock() { return undefined; },
        runCommand() { return { successCount: 1 }; },
    };
    return dim;
}

const dims = { overworld: makeDim("overworld"), nether: makeDim("nether"), the_end: makeDim("the_end") };
const world = {
    _afterQueue: [],
    afterEvents: after,
    beforeEvents: before,
    getDimension(id) { return dims[id.replace("minecraft:", "")]; },
    getAllPlayers() { return [...entities.values()].filter((e) => e.typeId === "minecraft:player"); },
    getPlayers() { return world.getAllPlayers(); },
    getEntity(id) { return entities.get(id); },
    sendMessage() {},
    getDynamicProperty() { return undefined; },
    setDynamicProperty() {},
};

globalThis.__harvesterMock = { system, world, problem };

// ---------------------------------------------------------------- load the scripts (instrumented copy)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "harvester-sim-"));
fs.writeFileSync(path.join(tmp, "package.json"), '{"type":"module"}');
fs.mkdirSync(path.join(tmp, "node_modules/@minecraft/server"), { recursive: true });
fs.writeFileSync(path.join(tmp, "node_modules/@minecraft/server/package.json"), '{"name":"@minecraft/server","type":"module","main":"index.js"}');
const explicit = new Set([...mock.matchAll(/export (?:const|class) (\w+)/g)].map((m) => m[1]));
const stubs = EXPORTS[API].filter((n) => !explicit.has(n))
    .map((n) => `export const ${n} = new Proxy(function () {}, { get: (t, k) => (typeof k === "string" ? k : undefined) });`).join("\n");
const extraMocked = [...explicit].filter((n) => !EXPORTS[API].includes(n) && !n.startsWith("__"));
if (extraMocked.length) problem("mock", "mock exports names the real API lacks: " + extraMocked.join(", "));
fs.writeFileSync(path.join(tmp, "node_modules/@minecraft/server/index.js"), mock + "\n" + stubs + "\n");
system.afterEvents = systemAfter;
const scriptsDir = path.join(BP, "scripts");
for (const file of fs.readdirSync(scriptsDir, { recursive: true })) {
    if (!file.endsWith(".js")) continue;
    let src = fs.readFileSync(path.join(scriptsDir, file), "utf8");
    // Bedrock resolves extensionless specifiers, node needs the extension
    src = src.replace(/(from\s+|import\s+)(["'])(\.{1,2}\/[^"']+?)(?<!\.js)\2/g, "$1$2$3.js$2");
    if (file.startsWith("harvester")) {
        // report everything the Harvester catch blocks would swallow
        src = src.replace(/catch\s*\{/g, "catch (__e) { globalThis.__harvesterMock.problem('swallowed', '" + file + ": ' + (__e && __e.stack ? __e.stack.split('\\n').slice(0, 2).join(' | ') : __e));");
    }
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(path.join(tmp, file), src);
}
try {
    await import(pathToFileURL(path.join(tmp, "main.js")));
} catch (e) {
    problem("load", "scripts/main.js failed to load: " + String(e && e.stack ? e.stack.split("\n").slice(0, 2).join(" | ") : e));
}

function flush() {
    while (world._afterQueue.length) world._afterQueue.shift()();
}

function step() {
    tick++;
    const due = timers.filter((t) => t.at <= tick);
    for (const t of due) {
        try { t.fn(); } catch (e) { problem("uncaught", String(e && e.stack ? e.stack.split("\n").slice(0, 2).join(" | ") : e)); }
        if (t.every) t.at = tick + t.every; else timers.splice(timers.indexOf(t), 1);
    }
    flush();
}

// ---------------------------------------------------------------- scenario
const registered = new Set();
before.worldInitialize?.fire({ itemComponentRegistry: { registerCustomComponent(id) { registered.add(id); } }, blockComponentRegistry: { registerCustomComponent() {} } });
after.worldInitialize?.fire({});
for (const file of fs.readdirSync(path.join(BP, "items"))) {
    const item = JSON.parse(fs.readFileSync(path.join(BP, "items", file), "utf8"))["minecraft:item"];
    for (const id of item.components["minecraft:custom_components"] ?? []) {
        if (!registered.has(id)) problem("item", `${item.description.identifier} uses custom component ${id} that no script registers`);
    }
}
const ow = dims.overworld;
const boss = new MockEntity("pa:harvester", ow, { x: 0, y: 64, z: 0 }, 600);
after.entitySpawn.fire({ entity: boss, cause: "Spawned" });
const heroes = [
    new MockPlayer("Near", ow, { x: 3, y: 64, z: 2 }),
    new MockPlayer("Mid", ow, { x: -8, y: 64, z: 5 }),
    new MockPlayer("Far", ow, { x: 14, y: 64, z: -10 }),
];
heroes[0].held = "pa:harvester_scythe";
const creative = new MockPlayer("Builder", ow, { x: 2, y: 64, z: 0 });
creative.gameMode = "creative";

const TOTAL = 20 * 60 * 10;
for (let i = 0; i < TOTAL && boss.valid; i++) {
    // players wander around the boss, sometimes jumping
    for (const [k, p] of heroes.entries()) {
        const a = tick / (40 + k * 17) + k * 2;
        const r = [3, 8, 14][k];
        p.location = { x: boss.location.x + Math.cos(a) * r, y: 64 + (tick % 23 < 6 ? 0.8 : 0), z: boss.location.z + Math.sin(a) * r };
        p.isOnGround = tick % 23 >= 6;
        p.velocity = { x: -Math.sin(a) * 0.2, y: 0, z: Math.cos(a) * 0.2 };
        p.yaw = a;
        if (p.hp <= 0) p.hp = p.maxHp;
        if (p.hp < 8) p.hp = 20; // potion
    }
    // players chip at the boss: phase 2 around 2.5 min, phase 3 around 4 min, enrage at 5 min
    if (tick % 20 === 0 && tick > 100) {
        const dmg = tick < 20 * 330 ? 1.9 : 12;
        boss.applyDamage(dmg, { cause: "entityAttack", damagingEntity: heroes[tick % 3] });
    }
    // the boss hits someone in melee now and then
    if (tick % 57 === 0) heroes[0].applyDamage(3, { cause: "entityAttack", damagingEntity: boss });
    // scythe skills
    if (tick % 300 === 10) after.itemUse.fire({ source: heroes[0], itemStack: { typeId: "pa:harvester_scythe" } });
    if (tick % 400 === 20) {
        const ev = { player: heroes[0], target: boss, cancel: false, itemStack: { typeId: "pa:harvester_scythe" } };
        if (before.playerInteractWithEntity) fireBefore(before.playerInteractWithEntity, ev);
    }
    if (process.env.SIM_DEBUG && tick % 600 === 0) console.log("t", tick / 20, "boss hp", boss.hp.toFixed(1), "name", boss.nameTag, "effects", Object.keys(boss.effects).filter((k) => boss.effects[k].until > tick).join(","));
    if (tick === 20 * 100) after.itemCompleteUse.fire({ source: heroes[1], itemStack: { typeId: "minecraft:milk_bucket" }, useDuration: 32 });
    step();
}
for (let i = 0; i < 200; i++) step(); // let death effects play out
const firstDefeated = !boss.valid;

// scenario 2: a boss already in phase 3 (exercises Death Sentence / Black Death / Final Harvest)
const boss2 = new MockEntity("pa:harvester", ow, { x: 100, y: 64, z: 100 }, 600);
boss2.hp = 150;
after.entitySpawn.fire({ entity: boss2, cause: "Loaded" });
for (let i = 0; i < 20 * 150; i++) {
    for (const [k, p] of heroes.entries()) {
        const a = tick / (30 + k * 11) + k;
        const r = [2, 7, 13][k];
        p.location = { x: boss2.location.x + Math.cos(a) * r, y: 64, z: boss2.location.z + Math.sin(a) * r };
        p.isOnGround = true;
        if (p.hp < 8) p.hp = 20;
    }
    step();
}
boss2.applyDamage(1000, { cause: "entityAttack", damagingEntity: heroes[0] });
const lonely = new MockEntity("pa:harvester", ow, { x: -400, y: 64, z: -400 }, 600);
for (let i = 0; i < 20 * 60 * 6; i++) step();
if (lonely.nameTag.includes("ENRAGED")) problem("scenario", "idle boss enraged before anyone fought it");
for (const p of heroes) p.location = { x: -398, y: 64, z: -398 };
for (let i = 0; i < 40; i++) step();
if (lonely.nameTag.includes("ENRAGED")) problem("scenario", "boss enraged immediately when players arrived");
lonely.remove();

// scenario 4: only a creative player nearby -> the boss still fights (that's how people test it);
// only a spectator nearby -> it ignores them
for (const p of heroes) p.location = { x: 5000, y: 64, z: 5000 };
creative.location = { x: 802, y: 64, z: 800 };
const tester = new MockEntity("pa:harvester", ow, { x: 800, y: 64, z: 800 }, 600);
const castsBefore = Object.values(stats.casts).reduce((a, b) => a + b, 0);
for (let i = 0; i < 20 * 20; i++) step();
if (Object.values(stats.casts).reduce((a, b) => a + b, 0) === castsBefore) problem("scenario", "boss cast nothing with a creative player next to it");
tester.remove();
creative.gameMode = "spectator";
const watcher = new MockEntity("pa:harvester", ow, { x: 800, y: 64, z: 800 }, 600);
const castsSpectator = Object.values(stats.casts).reduce((a, b) => a + b, 0);
for (let i = 0; i < 20 * 20; i++) step();
if (Object.values(stats.casts).reduce((a, b) => a + b, 0) !== castsSpectator) problem("scenario", "boss attacked a spectator");
watcher.remove();
for (let i = 0; i < 100; i++) step();
if (boss2.valid) problem("scenario", "second boss did not die");
after.playerLeave.fire({ playerId: heroes[2].id, playerName: "Far" });
step();

// ---------------------------------------------------------------- report
console.log(`@minecraft/server ${API}: scripts loaded through main.js.`);
console.log(`Simulated ${tick} ticks (${(tick / 1200).toFixed(1)} min). First boss ${firstDefeated ? "defeated" : "ALIVE hp=" + boss.hp.toFixed(0)}.`);
if (!firstDefeated) problem("scenario", "first boss survived the scripted damage");
console.log("Skill casts:", JSON.stringify(stats.casts));
console.log("Animations:", Object.keys(stats.animations).length, "distinct;", "particles:", Object.keys(stats.particles).filter((p) => p.startsWith("harvester:")).length, "distinct harvester ids;", "damage dealt to players:", stats.damage.toFixed(0));
const unused = Object.keys(particles).filter((p) => p.startsWith("harvester:") && !stats.particles[p]);
console.log("Particles never spawned by script (animation-only or unused):", unused.join(", ") || "none");

if (problems.size === 0) {
    console.log("OK: no problems found.");
} else {
    console.log("PROBLEMS:");
    for (const [k, n] of problems) console.log(`  x${n}  ${k}`);
    process.exitCode = 1;
}
fs.rmSync(tmp, { recursive: true, force: true });
