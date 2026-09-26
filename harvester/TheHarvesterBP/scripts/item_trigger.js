import { system, world, ItemStack } from '@minecraft/server';
import { decrementStack, getOppositeDirection, DirectionType, cardinalSides, randomFunction } from './utils/helper';
import { directionToVector3 } from './utils/math';

world.beforeEvents.worldInitialize.subscribe(initEvent => { initEvent.itemComponentRegistry.registerCustomComponent('pa_beetroot_cake:trigger', {
  onConsume: e => {
  e.source.removeEffect("minecraft:slowness");
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_cooked_yeti_meat:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:night_vision", 1000, {amplifier: 1});
e.source.addEffect("minecraft:regeneration", 1800, {amplifier: 1});
e.source.addEffect("minecraft:slowness", 1200, {amplifier: 2});
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_dark_night_apple:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:fire_resistance", 12000, {amplifier: 1});
e.source.addEffect("minecraft:health_boost", 12000, {amplifier: 4});
e.source.addEffect("minecraft:night_vision", 18000, {amplifier: 1});
e.source.addEffect("minecraft:regeneration", 400, {amplifier: 3});
e.source.addEffect("minecraft:resistance", 12000, {amplifier: 1});
e.source.addEffect("minecraft:saturation", 6000, {amplifier: 2});
e.source.addEffect("minecraft:slow_falling", 12000, {amplifier: 0});
e.source.addEffect("minecraft:speed", 12000, {amplifier: 1});
e.source.removeEffect("minecraft:wither");
e.source.removeEffect("minecraft:weakness");
e.source.removeEffect("minecraft:slowness");
e.source.removeEffect("minecraft:poison");
e.source.removeEffect("minecraft:nausea");
e.source.removeEffect("minecraft:mining_fatigue");
e.source.removeEffect("minecraft:levitation");
e.source.removeEffect("minecraft:hunger");
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_dark_soul_apple:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:fire_resistance", 12000, {amplifier: 1});
e.source.addEffect("minecraft:health_boost", 12000, {amplifier: 3});
e.source.addEffect("minecraft:night_vision", 18000, {amplifier: 1});
e.source.addEffect("minecraft:regeneration", 400, {amplifier: 3});
e.source.addEffect("minecraft:resistance", 12000, {amplifier: 1});
e.source.addEffect("minecraft:saturation", 6000, {amplifier: 2});
e.source.addEffect("minecraft:slow_falling", 12000, {amplifier: 0});
e.source.addEffect("minecraft:speed", 12000, {amplifier: 1});
e.source.removeEffect("minecraft:wither");
e.source.removeEffect("minecraft:weakness");
e.source.removeEffect("minecraft:slowness");
e.source.removeEffect("minecraft:poison");
e.source.removeEffect("minecraft:nausea");
e.source.removeEffect("minecraft:mining_fatigue");
e.source.removeEffect("minecraft:levitation");
e.source.removeEffect("minecraft:hunger");
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_emerald_apple:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:fire_resistance", 3600, {amplifier: 1});
e.source.addEffect("minecraft:jump_boost", 3000, {amplifier: 1});
e.source.addEffect("minecraft:night_vision", 6000, {amplifier: 1});
e.source.addEffect("minecraft:regeneration", 100, {amplifier: 2});
e.source.addEffect("minecraft:speed", 4000, {amplifier: 1});
e.source.removeEffect("minecraft:poison");
e.source.removeEffect("minecraft:wither");
e.source.removeEffect("minecraft:weakness");
e.source.removeEffect("minecraft:nausea");
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_emerald_sword:trigger', {
  
  
  onHitEntity: e => { e.hitEntity.runCommand("function poison_skill"); },
  onMineBlock: e => { e.source.runCommand("function poison_skill"); },
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_frizenscythe:trigger', {
  onUse: e => { e.source.runCommand("function 3");
e.source.runCommand("function Frizend_scythe_particle");
e.source.runCommand("function Frizen_scythe_buff"); },
  
  
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_frizen_sword:trigger', {
  onUse: e => { e.source.runCommand("function 3");
e.source.runCommand("function Frizen_scythe_buff");
e.source.runCommand("function Frizend_sword_particle"); },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frizen_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_frozen_sword:trigger', {
  onUse: e => { e.source.runCommand("function speed5"); },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frozen_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_frozendsword:trigger', {
  onUse: e => { e.source.runCommand("function Frozendd_scythe_paticle");
e.source.runCommand("function Frozendd_sword_buff"); },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frozend_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_frozenscythe:trigger', {
  onUse: e => { e.source.runCommand("function Frozen_scythe_buff");
e.source.runCommand("function yeti_paticle_frozen_scythe"); },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frozen_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_frozendscythe:trigger', {
  onUse: e => { 
const functions = ["icend", "Frozendd_scythe_paticle", "Frozendd_scythe_buff"];
          e.source.runCommand(`function ${randomFunction(functions)}`);
           },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frozend_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_guitar:trigger', {
  onUse: e => { e.source.runCommand("function Guitar"); },
  
  
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_ice_bar:trigger', {
  onUse: e => { e.source.runCommand("function Frozendd_scythe_paticle");
e.source.runCommand("function Frozendd_scythe_buff"); },
  
  
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_longobsidian_sword_upgrage:trigger', {
  
  
  onHitEntity: e => { e.hitEntity.runCommand("function lightning_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_obsidian_battle_axe:trigger', {
  onUse: e => { e.source.runCommand("function obsword"); },
  onUseOn: e => { e.source.runCommand("function obsword"); },
  
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_obsidian_battle_axebig:trigger', {
  onUse: e => { e.source.runCommand("function obsword"); },
  onUseOn: e => { e.source.runCommand("function obsword"); },
  
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_obsidiancarrot:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:nausea", 24000, {amplifier: 3});
e.source.addEffect("minecraft:poison", 12000, {amplifier: 5});
e.source.addEffect("minecraft:slowness", 6000, {amplifier: 1});
e.source.addEffect("minecraft:weakness", 6000, {amplifier: 4});
e.source.addEffect("minecraft:wither", 200, {amplifier: 2});
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_update_diamon_spear:trigger', {
  
  
  onHitEntity: e => { e.hitEntity.runCommand("function wither_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('pa_yeti_meat:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:nausea", 600, {amplifier: 2});
e.source.addEffect("minecraft:slowness", 700, {amplifier: 4});
e.source.addEffect("minecraft:weakness", 1600, {amplifier: 2});
  
},

  
});
 });
world.afterEvents.itemReleaseUse.subscribe(ev => {
  for (const player of world.getPlayers()) {
    if (ev.itemStack.typeId === "pa:thrownhdbrbr_projectile") {
      var newItem = new ItemStack("pa:thrownhdbrbr_projectile");
      player.removeTag("pa_spear");
      
      let e = system.runInterval(() => {
        if (player.hasTag("pa_spear") && ev.itemStack?.typeId === "pa:thrownhdbrbr_projectile" && ev.itemStack?.getComponent("minecraft:durability").damage <= 125) {
          player.removeTag("pa_spear");
  
          newItem.getComponent("minecraft:durability").damage = ev.itemStack.getComponent("minecraft:durability").damage + 1;
          player.getComponent('minecraft:inventory').container.setItem(player.selectedSlotIndex, newItem);
  
          if (!player.hasTag("pa_spear")) {
            system.clearRun(e);
          }
        }
      }, 20);
    }
  }
})


