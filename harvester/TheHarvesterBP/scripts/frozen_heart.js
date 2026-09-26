import { world, system } from "@minecraft/server";

const CONFIG = {
    itemId: "pa:frozen_heart"
};

function hasFrozenHeartInOffhand(player) {
    try {
        const inv = player.getComponent("minecraft:inventory").container;
        // Slot 40 is offhand in Bedrock
        const offhand = inv.getItem(40);
        return offhand && offhand.typeId === CONFIG.itemId;
    } catch {
        return false;
    }
}

// Main loop to check and remove slowness effects
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        // Check if player has frozen heart in offhand
        if (hasFrozenHeartInOffhand(player)) {
            try {
                // Remove slowness effect
                const effect = player.getEffect("slowness");
                if (effect) {
                    player.removeEffect("slowness");
                }
                
                // Remove mining fatigue
                const miningFatigue = player.getEffect("mining_fatigue");
                if (miningFatigue) {
                    player.removeEffect("mining_fatigue");
                }
                
                // Visual effect every 20 ticks (1 second)
                if (system.currentTick % 20 === 0) {
                    // Ice particles around player
                    for (let i = 0; i < 3; i++) {
                        const angle = (Date.now() / 500 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
                        const radius = 0.6;
                        
                        player.dimension.spawnParticle("minecraft:blue_flame_particle", {
                            x: player.location.x + Math.cos(angle) * radius,
                            y: player.location.y + 1,
                            z: player.location.z + Math.sin(angle) * radius
                        });
                    }
                }
                
            } catch (error) {
                // Silent fail
            }
        }
    }
}, 1);

// Visual feedback when player gets slowness while having frozen heart
world.afterEvents.effectAdd.subscribe((event) => {
    const { entity, effect } = event;
    
    if (entity.typeId !== "minecraft:player") return;
    
    const player = entity;
    
    if ((effect.typeId === "slowness" || effect.typeId === "mining_fatigue") && hasFrozenHeartInOffhand(player)) {
        try {
            // Ice shatter effect
            for (let i = 0; i < 10; i++) {
                player.dimension.spawnParticle("minecraft:ice_evaporation_particle", {
                    x: player.location.x + (Math.random() - 0.5) * 1.5,
                    y: player.location.y + 1 + Math.random() * 1.5,
                    z: player.location.z + (Math.random() - 0.5) * 1.5
                });
            }
            
            player.playSound("block.glass.break", { volume: 0.5 });
            
        } catch {}
    }
});

world.afterEvents.worldInitialize.subscribe(() => {
    console.warn("§b[Frozen Heart] §fLoaded!");
    console.warn("§7Hold in offhand (slot 40) for 100% Slowness & Mining Fatigue immunity");
});