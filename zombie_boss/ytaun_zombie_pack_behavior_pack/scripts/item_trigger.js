import { system, world } from '@minecraft/server';
import { decrementStack, getOppositeDirection, DirectionType, cardinalSides, randomFunction } from './utils/helper';
import { directionToVector3 } from './utils/math';

system.beforeEvents.startup.subscribe(initEvent => { initEvent.itemComponentRegistry.registerCustomComponent('ytaun_cooked_yeti_meat:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:fire_resistance", 6000, {amplifier: 1});
e.source.addEffect("minecraft:resistance", 6000, {amplifier: 0});
e.source.addEffect("minecraft:strength", 6000, {amplifier: 0});
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_cooked_giant_frog_leg:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:jump_boost", 6000, {amplifier: 1});
e.source.addEffect("minecraft:night_vision", 6000, {amplifier: 1});
e.source.addEffect("minecraft:regeneration", 6000, {amplifier: 0});
e.source.addEffect("minecraft:speed", 6000, {amplifier: 1});
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_dark_night_apple:trigger', {
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

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_emerald_apple:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:jump_boost", 6000, {amplifier: 1});
e.source.addEffect("minecraft:night_vision", 12000, {amplifier: 1});
e.source.addEffect("minecraft:regeneration", 2400, {amplifier: 1});
e.source.addEffect("minecraft:resistance", 1800, {amplifier: 1});
e.source.addEffect("minecraft:saturation", 20, {amplifier: 1});
e.source.addEffect("minecraft:speed", 6000, {amplifier: 1});
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_dark_soul_apple:trigger', {
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

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_emerald_sword:trigger', {
  
  
  onHitEntity: e => { e.hitEntity.runCommand("function poison_skill"); },
  onMineBlock: e => { e.source.runCommand("function poison_skill"); },
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_frizen_sword:trigger', {
  onUse: e => { e.source.runCommand("function 3");
e.source.runCommand("function Frizen_scythe_buff");
e.source.runCommand("function Frizend_sword_particle"); },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frizen_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_frizenscythe:trigger', {
  onUse: e => { e.source.runCommand("function 3");
e.source.runCommand("function Frizend_scythe_particle");
e.source.runCommand("function Frizen_scythe_buff"); },
  
  
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_frozen_sword:trigger', {
  onUse: e => { e.source.runCommand("function speed5"); },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frozen_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_giant_frog_leg:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:nausea", 2400, {amplifier: 1});
e.source.addEffect("minecraft:slowness", 3340, {amplifier: 1});
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_frozendsword:trigger', {
  onUse: e => { e.source.runCommand("function Frozendd_scythe_paticle");
e.source.runCommand("function Frozendd_sword_buff"); },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frozend_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_frozendscythe:trigger', {
  onUse: e => { 
const functions = ["icend", "Frozendd_scythe_paticle", "Frozendd_scythe_buff"];
          e.source.runCommand(`function ${randomFunction(functions)}`);
           },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frozend_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_frozenscythe:trigger', {
  onUse: e => { e.source.runCommand("function Frozen_scythe_buff");
e.source.runCommand("function yeti_paticle_frozen_scythe"); },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frozen_scythe_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_ice_bar:trigger', {
  onUse: e => { e.source.runCommand("function Frozendd_scythe_paticle");
e.source.runCommand("function Frozendd_scythe_buff"); },
  
  
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_longobsidian_sword_upgrage:trigger', {
  
  
  onHitEntity: e => { e.hitEntity.runCommand("function lightning_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_obsidian_battle_axe:trigger', {
  onUse: e => { e.source.runCommand("function obsword"); },
  onUseOn: e => { e.source.runCommand("function obsword"); },
  
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_obsidian_battle_axebig:trigger', {
  onUse: e => { e.source.runCommand("function obsword"); },
  onUseOn: e => { e.source.runCommand("function obsword"); },
  
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_update_diamon_spear:trigger', {
  
  
  onHitEntity: e => { e.hitEntity.runCommand("function wither_skill"); },
  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_yeti_meat:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:fire_resistance", 1200, {amplifier: 1});
e.source.addEffect("minecraft:hunger", 2400, {amplifier: 2});
e.source.addEffect("minecraft:nausea", 1200, {amplifier: 1});
  
},

  
});
 });

