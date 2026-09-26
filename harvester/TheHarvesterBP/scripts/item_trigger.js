import { world } from '@minecraft/server';

// Custom item components used by the items of this pack.
// Every component named in an item's "minecraft:custom_components" must be registered,
// otherwise the game logs an error for that item.

const CLEANSED = [
  "minecraft:wither", "minecraft:weakness", "minecraft:slowness", "minecraft:poison",
  "minecraft:nausea", "minecraft:mining_fatigue", "minecraft:levitation", "minecraft:hunger"
];

function darkApple(healthBoost) {
  return {
    onConsume: e => {
      e.source.addEffect("minecraft:fire_resistance", 12000, { amplifier: 1 });
      e.source.addEffect("minecraft:health_boost", 12000, { amplifier: healthBoost });
      e.source.addEffect("minecraft:night_vision", 18000, { amplifier: 1 });
      e.source.addEffect("minecraft:regeneration", 400, { amplifier: 3 });
      e.source.addEffect("minecraft:resistance", 12000, { amplifier: 1 });
      e.source.addEffect("minecraft:saturation", 6000, { amplifier: 2 });
      e.source.addEffect("minecraft:slow_falling", 12000, { amplifier: 0 });
      e.source.addEffect("minecraft:speed", 12000, { amplifier: 1 });
      for (const id of CLEANSED) e.source.removeEffect(id);
    }
  };
}

// Materials: the component is only a marker, they have no special behaviour
const MARKERS = [
  'pa_steel_ingot:trigger', 'pa_raw_rast_iron:trigger', 'pa_raw_steel:trigger', 'pa_steel_stick:trigger',
  'pa_super_smithing_update:trigger', 'pa_tast_iron_ingot:trigger'
];

world.beforeEvents.worldInitialize.subscribe(initEvent => {
  const registry = initEvent.itemComponentRegistry;
  registry.registerCustomComponent('pa_dark_night_apple:trigger', darkApple(4));
  registry.registerCustomComponent('pa_dark_soul_apple:trigger', darkApple(3));
  for (const id of MARKERS) registry.registerCustomComponent(id, {});
});
