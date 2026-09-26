import { world, system } from '@minecraft/server';

// === FROZEN SWORD - PASSIVE SKILLS ===
// Cầm 20s → Ice Aura
// Khụy + cầm 4s → Ice Burst

const FROZEN_SWORD_ID = "ytaun:frozen_sword";
const HOLD_MS   = 20000; // 20 giây
const CROUCH_MS = 4000;  // 4 giây

const holdStart   = new Map(); // player.id → timestamp bắt đầu cầm
const crouchStart = new Map(); // player.id → timestamp bắt đầu khụy

function hasFrozenSword(player) {
    try {
        const inv  = player.getComponent('minecraft:inventory'); // FIX: thêm namespace
        const item = inv.container.getItem(player.selectedSlotIndex);
        return item?.typeId === FROZEN_SWORD_ID;
    } catch (_) { return false; }
}

function spawnIceCircle(player, radius, count, particleId) {
    const loc = player.location;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        try {
            player.dimension.spawnParticle(particleId, {
                x: loc.x + Math.cos(angle) * radius,
                y: loc.y + 1,
                z: loc.z + Math.sin(angle) * radius
            });
        } catch (_) {}
    }
}

// === Skill 1: Hold Aura (20s) ===
function executeHoldAura(player) {
    try {
        spawnIceCircle(player, 1.5, 12, 'minecraft:snowflake_particle');
        spawnIceCircle(player, 1.0, 8,  'minecraft:ice_evaporation_particle');
        spawnIceCircle(player, 0.5, 6,  'minecraft:blue_flame_particle');

        player.addEffect('resistance',   500, { amplifier: 0, showParticles: false });
        player.addEffect('slow_falling', 200, { amplifier: 0, showParticles: false });

        player.dimension.playSound('block.glass.place', player.location, { pitch: 1.5, volume: 0.8 });
        player.onScreenDisplay.setActionBar('§b❄ Ice Aura Active');
    } catch (e) {
        console.warn('[FrozenSword Hold] Error:', e);
    }
}

// === Skill 2: Ice Burst (khụy 4s) ===
function executeIceBurst(player) {
    try {
        spawnIceCircle(player, 2.5, 20, 'minecraft:snowflake_particle');
        spawnIceCircle(player, 1.5, 12, 'minecraft:bleach');
        spawnIceCircle(player, 3.5, 16, 'minecraft:ice_evaporation_particle');

        player.addEffect('speed',    100, { amplifier: 1, showParticles: true });
        player.addEffect('strength', 100, { amplifier: 0, showParticles: true });

        const nearby = player.dimension.getEntities({
            location: player.location,
            maxDistance: 4,
            excludeTypes: ['minecraft:player']
        });

        // FIX: stagger debuff để tránh invincibility frame
        nearby.forEach((entity, index) => {
            system.runTimeout(() => {
                try {
                    entity.addEffect('slowness',      80, { amplifier: 2, showParticles: true });
                    entity.addEffect('weakness',      80, { amplifier: 0, showParticles: true });
                    entity.addEffect('mining_fatigue', 60, { amplifier: 1, showParticles: false });
                } catch (_) {}
            }, index * 2);
        });

        player.dimension.playSound('ambient.weather.thunder', player.location, { pitch: 1.8, volume: 1.0 });
        player.onScreenDisplay.setActionBar(`§b§l❄ Ice Burst! §7(${nearby.length} enemies slowed)`);
    } catch (e) {
        console.warn('[FrozenSword Burst] Error:', e);
    }
}

// === Main loop ===
system.runInterval(() => {
    const now = Date.now();

    for (const player of world.getAllPlayers()) {
        if (!hasFrozenSword(player)) {
            holdStart.delete(player.id);
            crouchStart.delete(player.id);
            continue;
        }

        // --- Skill 1: Cầm liên tục 20s ---
        if (!holdStart.has(player.id)) {
            holdStart.set(player.id, now);
        } else if (now - holdStart.get(player.id) >= HOLD_MS) {
            holdStart.set(player.id, now);
            executeHoldAura(player);
        }

        // --- Skill 2: Khụy liên tục 4s ---
        if (player.isSneaking) {
            if (!crouchStart.has(player.id)) {
                crouchStart.set(player.id, now);
            } else if (now - crouchStart.get(player.id) >= CROUCH_MS) {
                crouchStart.set(player.id, now);
                executeIceBurst(player);
            }
        } else {
            crouchStart.delete(player.id);
        }
    }
}, 5);

console.warn('[Frozen Sword] Skills loaded!');
