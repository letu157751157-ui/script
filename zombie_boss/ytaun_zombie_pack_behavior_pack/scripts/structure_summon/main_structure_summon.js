import { StructureSpawner } from "./structure_summon";

const structureManager = new StructureSpawner();
structureManager.registerStructure({
    pattern: [["","minecraft:carved_pumpkin",""],["minecraft:diamond_block","minecraft:diamond_block","minecraft:diamond_block"],["minecraft:diamond_block","minecraft:diamond_block","minecraft:diamond_block"]],
    anchor: { row: 0, col: 1 },
    spawnWeight: [{"id":"ytaun:diamond_golem","weight":1}],
    flat: false,
});

