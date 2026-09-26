import { system, world } from '@minecraft/server';
import { decrementStack, getOppositeDirection, DirectionType, cardinalSides } from './utils/helper';
import { directionToVector3 } from './utils/math';

system.beforeEvents.startup.subscribe(initEvent => { initEvent.itemComponentRegistry.registerCustomComponent('ytaun_cooked_yeti_meat:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:fire_resistance", 6000, {amplifier: 1});
e.source.addEffect("minecraft:resistance", 6000, {amplifier: 0});
e.source.addEffect("minecraft:strength", 6000, {amplifier: 0});
  
},

  
});

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_frozen_sword:trigger', {
  onUse: e => { e.source.runCommand("function speed5"); },
  
  onHitEntity: e => { e.hitEntity.runCommand("function frozen_scythe_skill"); },
  
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

initEvent.itemComponentRegistry.registerCustomComponent('ytaun_yeti_meat:trigger', {
  onConsume: e => {
  e.source.addEffect("minecraft:fire_resistance", 1200, {amplifier: 1});
e.source.addEffect("minecraft:hunger", 2400, {amplifier: 2});
e.source.addEffect("minecraft:nausea", 1200, {amplifier: 1});
  
},

  
});
 });
