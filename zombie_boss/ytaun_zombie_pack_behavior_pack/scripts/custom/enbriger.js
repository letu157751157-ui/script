/**
 * ENDBRINGER Skills System v1.5.1
 * Author: YTAUN | Zalo: +84394798144 | letu157751157@gmail.com
 *
 * ═══════════════════════════════════════════════════════
 *  PASSIVE (on every hit)
 *   P1 — Soul Drain    : Wither II 3s on target
 *   P2 — Void Slash    : 30% chance lightning strike
 *   P3 — Ender Pulse   : Kill → restore 1.5 hearts
 *
 *  SNEAK SKILLS
 *   S1 — Void Collapse : Hold Shift 3s → AoE particle burst (blue/white/purple)
 *                        around player, AoE 10 magic damage + Blindness + Slowness
 *                        in 8 block radius. (CD 10s)
 *   S1b— Void Blink    : Hold Shift 3s + Jump → Dash up to 15 blocks in look
 *                        direction (blocked by terrain, lands at last safe spot).
 *                        AoE 10 magic damage + Blindness at destination. (CD 10s)
 *   S2 — Void Dash     : Hold Shift 2s, then Jump → dash 8 blocks
 *                        forward, AoE 10 magic damage at landing
 *                        + Speed IV 2s (CD 12s)
 *
 *  RIGHT-CLICK SKILL
 *   R  — Void Burst    : Right-click → AoE particle sphere (blue/white/purple)
 *                        around player, AoE 8 magic damage radius 5 blocks
 *                        (CD 8s)
 *
 *  HOLD SKILLS (hold sword 20s continuously)
 *   H0 — Awakening     : Auto after 20s → AoE 8 damage radius 6 blocks,
 *                        Speed III + Strength II + Resistance I + NightVision 15s,
 *                        particle burst 3 expanding rings + lightning, opens 7s window
 *   H1 — Ender Cataclysm : Window + Jump → 20 random lightning bolts + AoE 15 damage
 *                           + Wither III 5s for all mobs within 15 blocks
 *                           + heavy lightning particle rain
 *   H2 — Phantom Shroud  : Window + Shift → Invisibility + Speed IV + Strength II
 *                           + continuous phantom particles (blue/purple)
 *                           + gradual health regen + crit multiplier 6s (CD 35s)
 * ═══════════════════════════════════════════════════════
 */

import {
    world,
    system,
    EntityComponentTypes,
    EquipmentSlot,
    EntityQueryOptions
} from '@minecraft/server';

const SWORD_ID = 'ytaun:endbringer_sword';

const CD_VOID_COLLAPSE   = 10;
const CD_VOID_DASH       = 12;
const CD_VOID_BURST      = 8;
const CD_ENDER_CATACLYSM = 25;
const CD_PHANTOM_SHROUD  = 35;

const playerState = new Map();

function getState(player) {
    const id = player.id;
    if (!playerState.has(id)) {
        playerState.set(id, {
            sneakTicks:       0,
            dashPending:      false,
            holdTicks:        0,
            awakeningUsed:    false,
            windowActive:     false,
            windowTicks:      0,
            cdVoidCollapse:   0,
            cdVoidDash:       0,
            cdVoidBurst:      0,
            cdEnderCataclysm: 0,
            cdPhantomShroud:  0,
            phantomActive:    false,
            phantomTicks:     0,
        });
    }
    return playerState.get(id);
}

function isHoldingEndbringer(player) {
    const equip = player.getComponent(EntityComponentTypes.Equippable);
    if (!equip) return false;
    return equip.getEquipment(EquipmentSlot.Mainhand)?.typeId === SWORD_ID;
}

function getMobsNear(player, radius) {
    try {
        const opts = new EntityQueryOptions();
        opts.maxDistance = radius;
        opts.location = player.location;
        return [...player.dimension.getEntities(opts)]
            .filter(e => e.typeId !== 'minecraft:player');
    } catch (_) { return []; }
}

function getMobsAt(dimension, loc, radius) {
    try {
        const opts = new EntityQueryOptions();
        opts.maxDistance = radius;
        opts.location = loc;
        return [...dimension.getEntities(opts)]
            .filter(e => e.typeId !== 'minecraft:player');
    } catch (_) { return []; }
}

function progressBar(current, max, length) {
    length = length || 10;
    const filled = Math.round((current / max) * length);
    return '\u00a79' + '\u2588'.repeat(Math.max(0, filled))
         + '\u00a78' + '\u2591'.repeat(Math.max(0, length - filled));
}

function ab(player, msg) {
    try { player.onScreenDisplay.setActionBar(msg); } catch (_) {}
}

function sound(player, s, pitch, vol) {
    try { player.dimension.playSound(s, player.location, { pitch: pitch || 1, volume: vol || 1 }); } catch (_) {}
}

function soundAt(dim, s, loc, pitch, vol) {
    try { dim.playSound(s, loc, { pitch: pitch || 1, volume: vol || 1 }); } catch (_) {}
}

function particle(dim, p, loc) {
    try { dim.spawnParticle(p, loc); } catch (_) {}
}

function particleRing(dim, loc, radius, count, pType, yOffset) {
    yOffset = yOffset || 1;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        particle(dim, pType, {
            x: loc.x + Math.cos(angle) * radius,
            y: loc.y + yOffset,
            z: loc.z + Math.sin(angle) * radius,
        });
    }
}

function particleBurst(dim, loc, radius, count, pType) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        particle(dim, pType, {
            x: loc.x + Math.cos(angle) * r,
            y: loc.y + Math.random() * 2,
            z: loc.z + Math.sin(angle) * r,
        });
    }
}

// Nổ particle xanh lam/trắng/tím theo hình cầu 3D xung quanh người chơi
function particleSphere(dim, loc, radius, count) {
    const types = [
        'minecraft:endrod',           // trắng/vàng nhạt — đại diện trắng
        'minecraft:wax_particle',     // tím nhạt
        'minecraft:dripping_water_cauldron', // xanh lam
    ];
    for (let i = 0; i < count; i++) {
        // Phân bố đều trên mặt cầu (Fibonacci sphere)
        const theta = Math.acos(1 - 2 * (i + 0.5) / count);
        const phi   = Math.PI * (1 + Math.sqrt(5)) * i;
        const x = loc.x + radius * Math.sin(theta) * Math.cos(phi);
        const y = loc.y + 1 + radius * Math.cos(theta);
        const z = loc.z + radius * Math.sin(theta) * Math.sin(phi);
        const pType = types[i % types.length];
        particle(dim, pType, { x, y, z });
    }
}

// Nổ burst 3 loại particle xen kẽ tone xanh lam / trắng / tím
function burstBWT(dim, loc, radius, count) {
    const types = ['minecraft:endrod', 'minecraft:wax_particle', 'minecraft:dripping_water_cauldron'];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const ry = Math.random() * 2.5;
        particle(dim, types[i % types.length], {
            x: loc.x + Math.cos(angle) * r,
            y: loc.y + ry,
            z: loc.z + Math.sin(angle) * r,
        });
    }
}

// Vòng tròn 3 loại particle xen kẽ tone xanh lam / trắng / tím
function ringBWT(dim, loc, radius, count, yOffset) {
    yOffset = yOffset || 1;
    const types = ['minecraft:endrod', 'minecraft:wax_particle', 'minecraft:dripping_water_cauldron'];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        particle(dim, types[i % types.length], {
            x: loc.x + Math.cos(angle) * radius,
            y: loc.y + yOffset,
            z: loc.z + Math.sin(angle) * radius,
        });
    }
}

function ticksToSec(t) { return t / 20; }

// ─── PASSIVE ─────────────────────────────────────────────────────────────────

world.afterEvents.entityHitEntity.subscribe(ev => {
    const { damagingEntity: atk, hitEntity: tgt } = ev;
    if (atk?.typeId !== 'minecraft:player' || !isHoldingEndbringer(atk)) return;
    const dim = atk.dimension;

    // P1 — Soul Drain
    try { tgt.addEffect('wither', 60, { amplifier: 1, showParticles: true }); } catch (_) {}
    particle(dim, 'minecraft:endrod', tgt.location);

    // P2 — Void Slash (30% lightning)
    if (Math.random() < 0.30) {
        try {
            dim.spawnEntity('minecraft:lightning_bolt', tgt.location);
            particleRing(dim, tgt.location, 1.5, 6, 'minecraft:endrod', 0);
        } catch (_) {}
    }
});

// P3 — Ender Pulse (heal on kill)
world.afterEvents.entityDie.subscribe(ev => {
    const killer = ev.damageSource?.damagingEntity;
    if (killer?.typeId !== 'minecraft:player' || !isHoldingEndbringer(killer)) return;
    const hp = killer.getComponent(EntityComponentTypes.Health);
    if (hp) hp.setCurrentValue(Math.min(hp.currentValue + 3, hp.effectiveMax));
    const dim = killer.dimension;
    particleRing(dim, killer.location, 1.0, 8, 'minecraft:endrod', 0);
    particle(dim, 'minecraft:endrod', { x: killer.location.x, y: killer.location.y + 2, z: killer.location.z });
    try { dim.playSound('mob.endermen.portal', ev.deadEntity.location, { volume: 1, pitch: 0.85 }); } catch (_) {}
});

// ─── R — Void Burst (Right-click) ────────────────────────────────────────────
// Nổ particle hình cầu xanh lam/trắng/tím quanh người chơi + AoE 8 damage bán kính 5

world.afterEvents.itemUse.subscribe(ev => {
    const player = ev.source;
    if (player?.typeId !== 'minecraft:player') return;
    if (!isHoldingEndbringer(player)) return;
    const state = getState(player);
    activateVoidBurst(player, state);
});

function activateVoidBurst(player, state) {
    if (state.cdVoidBurst > 0) return; // cooldown display removed — JavaPvP handles action bar
    const dim = player.dimension;
    const loc = player.location;

    // Âm thanh
    sound(player, 'mob.endermen.portal', 1.6, 1.0);
    sound(player, 'random.explode', 0.8, 0.6);

    // Nổ particle 3 lớp cầu xanh lam / trắng / tím liên tục
    particleSphere(dim, loc, 1.0, 18);
    system.runTimeout(() => { particleSphere(dim, loc, 2.2, 26); }, 3);
    system.runTimeout(() => { particleSphere(dim, loc, 3.5, 34); }, 6);
    system.runTimeout(() => {
        ringBWT(dim, loc, 4.5, 20, 0);
        ringBWT(dim, loc, 4.5, 20, 2.0);
        burstBWT(dim, loc, 4.0, 20);
    }, 10);
    system.runTimeout(() => {
        particleSphere(dim, loc, 5.0, 20);
        particle(dim, 'minecraft:large_explosion', loc);
    }, 14);

    // AoE 8 magic damage bán kính 5 block
    const mobs = getMobsNear(player, 5);
    let count = 0;
    for (const mob of mobs) {
        try {
            mob.applyDamage(8, { cause: 'magic', damagingEntity: player });
            ringBWT(dim, mob.location, 0.8, 6, 0.5);
            count++;
        } catch (_) {}
    }

    if (count === 0) {
        ab(player, '\u00a7b\u00a7l\u2605 \u00a7fVoid Burst! \u00a77No mobs in range');
    } else {
        ab(player, '\u00a7b\u00a7l\u2605 \u00a7fVoid Burst! \u00a77Hit \u00a7e' + count + '\u00a77 mob(s) \u2014 \u00a7b8 \u00a77magic damage');
    }

    state.cdVoidBurst = CD_VOID_BURST * 20;
}

// ─── S1 — Void Collapse ─────────────────────────────────────────────────────────
// Auto-activates after holding Shift 3s (no jump)
// AoE particle burst (blue/white/purple) + AoE 10 damage + Blindness + Slowness

function activateVoidCollapse(player, state) {
    if (state.cdVoidCollapse > 0) return; // cooldown display removed — JavaPvP handles action bar
    const dim  = player.dimension;
    const loc  = player.location;
    const mobs = getMobsNear(player, 8);

    // Particle nổ mở rộng theo sóng — tone xanh lam/trắng/tím
    ringBWT(dim, loc, 1.0, 12, 0.5);
    system.runTimeout(() => { ringBWT(dim, loc, 2.5, 16, 0.5); burstBWT(dim, loc, 2.0, 14); }, 3);
    system.runTimeout(() => { ringBWT(dim, loc, 4.0, 20, 0.5); particleSphere(dim, loc, 2.5, 20); }, 6);
    system.runTimeout(() => { ringBWT(dim, loc, 5.5, 24, 0.5); burstBWT(dim, loc, 4.5, 18); }, 10);
    system.runTimeout(() => { ringBWT(dim, loc, 7.0, 28, 0.5); }, 14);

    particle(dim, 'minecraft:large_explosion', loc);
    sound(player, 'mob.endermen.stare', 0.6, 0.5);
    sound(player, 'random.explode', 1.0, 0.8);

    let count = 0;
    for (const mob of mobs) {
        try {
            const dx  = mob.location.x - loc.x;
            const dz  = mob.location.z - loc.z;
            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            mob.applyDamage(10, { cause: 'magic', damagingEntity: player });
            mob.applyKnockback(dx / len, dz / len, 2.5, 0.3);
            mob.addEffect('blindness', 60, { amplifier: 0, showParticles: true });
            mob.addEffect('slowness',  80, { amplifier: 2, showParticles: true });
            mob.addEffect('weakness',  60, { amplifier: 1, showParticles: true });
            ringBWT(dim, mob.location, 0.7, 6, 0.3);
            count++;
        } catch (_) {}
    }

    if (count === 0) {
        ab(player, '\u00a7b\u00a7l\u2bca \u00a7fVoid Collapse! \u00a77No mobs in 8 blocks');
    } else {
        ab(player, '\u00a7b\u00a7l\u2bca \u00a7fVoid Collapse! \u00a77Hit \u00a7e' + count + '\u00a77 mob(s) \u2014 \u00a7b10 magic dmg\u00a77 + Blind + Slow');
    }
    state.cdVoidCollapse = CD_VOID_COLLAPSE * 20;
}

// ─── S2 — Void Dash ──────────────────────────────────────────────────────────
// Hold Shift 2s, then Jump → dash 8 blocks forward

function activateVoidDash(player, state) {
    if (state.cdVoidDash > 0) return; // cooldown display removed — JavaPvP handles action bar
    const dim = player.dimension;
    const loc = player.location;

    let rot;
    try { rot = player.getRotation(); } catch (_) { rot = { y: 0 }; }
    const yaw  = (rot.y * Math.PI) / 180;
    const dist = 8;
    const dx   = -Math.sin(yaw) * dist;
    const dz   =  Math.cos(yaw) * dist;
    const destLoc = { x: loc.x + dx, y: loc.y, z: loc.z + dz };

    // Particle trail
    for (let i = 1; i <= 8; i++) {
        system.runTimeout(() => {
            const t  = i / 8;
            const px = loc.x + dx * t;
            const pz = loc.z + dz * t;
            particle(dim, 'minecraft:endrod', { x: px, y: loc.y + 0.8, z: pz });
            particle(dim, 'minecraft:endrod', { x: px, y: loc.y + 1.6, z: pz });
        }, i * 2);
    }

    particle(dim, 'minecraft:large_explosion', loc);
    particleRing(dim, loc, 1.5, 8, 'minecraft:endrod', 0);
    sound(player, 'mob.endermen.portal', 1.5, 1.2);

    system.runTimeout(() => {
        try { player.teleport(destLoc, { dimension: dim }); } catch (_) {}

        particle(dim, 'minecraft:large_explosion', destLoc);
        particleRing(dim, destLoc, 2.0, 10, 'minecraft:endrod', 0.5);
        particleRing(dim, destLoc, 3.5, 14, 'minecraft:endrod', 1.0);
        sound(player, 'mob.endermen.scream', 1.0, 1.1);

        const nearMobs = getMobsNear(player, 3);
        for (const mob of nearMobs) {
            try {
                mob.applyDamage(10, { cause: 'magic', damagingEntity: player });
                particle(dim, 'minecraft:endrod', mob.location);
            } catch (_) {}
        }

        try { player.addEffect('speed', 40, { amplifier: 3, showParticles: true }); } catch (_) {}
        ab(player, '\u00a79\u26a1 \u00a7fVoid Dash! \u00a77Lunged 8 blocks + \u00a7e10 damage\u00a77 AoE + Speed IV');
    }, 16);

    state.cdVoidDash  = CD_VOID_DASH * 20;
    state.dashPending = false;
}


// ─── S1b — Void Blink (Void Collapse + Jump) ─────────────────────────────────
// Hold Shift 3s + Jump → teleport up to 15 blocks in look direction
// Collision-aware: steps along the look vector, stops before solid blocks
// AoE 10 magic damage + Blindness at destination

function getLookVector(player) {
    let rot;
    try { rot = player.getRotation(); } catch (_) { return { x: 0, y: 0, z: -1 }; }
    // Minecraft: yaw=0 → south (+Z), yaw=90 → west (-X), pitch positive → down
    const yawRad   = (rot.y * Math.PI) / 180;
    const pitchRad = (rot.x * Math.PI) / 180;
    return {
        x: -Math.sin(yawRad) * Math.cos(pitchRad),
        y: -Math.sin(pitchRad),
        z:  Math.cos(yawRad) * Math.cos(pitchRad),
    };
}

function findBlinkDestination(player, maxBlocks) {
    const loc  = player.location;
    const dim  = player.dimension;
    const dir  = getLookVector(player);
    const len  = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
    const nx   = dir.x / len;
    const ny   = dir.y / len;
    const nz   = dir.z / len;

    let lastSafe = { x: loc.x, y: loc.y, z: loc.z };

    for (let step = 1; step <= maxBlocks * 4; step++) {
        // Step in 0.25-block increments for accuracy
        const t  = step * 0.25;
        const px = loc.x + nx * t;
        const py = loc.y + ny * t;
        const pz = loc.z + nz * t;

        // Check if the block at player feet and head position is solid
        let blocked = false;
        try {
            const blockFeet = dim.getBlock({ x: Math.floor(px), y: Math.floor(py),     z: Math.floor(pz) });
            const blockHead = dim.getBlock({ x: Math.floor(px), y: Math.floor(py) + 1, z: Math.floor(pz) });
            if (!blockFeet || !blockFeet.isAir || !blockHead || !blockHead.isAir) {
                blocked = true;
            }
        } catch (_) {
            blocked = true;
        }

        if (blocked) break;
        lastSafe = { x: px, y: py, z: pz };
        if (t >= maxBlocks) break;
    }

    return lastSafe;
}

function activateVoidBlink(player, state) {
    if (state.cdVoidCollapse > 0) return; // cooldown display removed — JavaPvP handles action bar
    const dim  = player.dimension;
    const loc  = player.location;
    const dest = findBlinkDestination(player, 15);

    const dx = dest.x - loc.x;
    const dy = dest.y - loc.y;
    const dz = dest.z - loc.z;
    const actualDist = Math.round(Math.sqrt(dx*dx + dy*dy + dz*dz) * 10) / 10;

    // Origin burst
    particle(dim, 'minecraft:large_explosion', loc);
    particleSphere(dim, loc, 1.2, 18);
    ringBWT(dim, loc, 1.5, 10, 0);
    sound(player, 'mob.endermen.portal', 1.7, 1.0);
    sound(player, 'random.explode', 0.9, 0.7);

    // Particle trail along the path
    const steps = Math.max(1, Math.floor(actualDist * 2));
    for (let i = 0; i <= steps; i++) {
        const t  = i / steps;
        const tx = loc.x + (dest.x - loc.x) * t;
        const ty = loc.y + (dest.y - loc.y) * t;
        const tz = loc.z + (dest.z - loc.z) * t;
        system.runTimeout(() => {
            particle(dim, 'minecraft:endrod',          { x: tx, y: ty + 0.8, z: tz });
            particle(dim, 'minecraft:wax_particle',    { x: tx, y: ty + 1.4, z: tz });
        }, Math.floor(i * 0.6));
    }

    system.runTimeout(() => {
        try { player.teleport(dest, { dimension: dim }); } catch (_) {}

        // Landing burst
        particle(dim, 'minecraft:large_explosion', dest);
        particleSphere(dim, dest, 1.5, 22);
        ringBWT(dim, dest, 2.5, 14, 0.5);
        ringBWT(dim, dest, 4.0, 18, 1.0);
        burstBWT(dim, dest, 3.5, 20);
        sound(player, 'mob.endermen.scream', 1.1, 0.9);
        sound(player, 'random.explode',      1.0, 0.7);

        // AoE 10 damage + Blindness + Slowness at destination
        const mobs = getMobsNear(player, 8);
        let count = 0;
        for (const mob of mobs) {
            try {
                const mdx  = mob.location.x - dest.x;
                const mdz  = mob.location.z - dest.z;
                const mlen = Math.sqrt(mdx*mdx + mdz*mdz) || 1;
                mob.applyDamage(10, { cause: 'magic', damagingEntity: player });
                mob.applyKnockback(mdx / mlen, mdz / mlen, 2.5, 0.3);
                mob.addEffect('blindness', 60, { amplifier: 0, showParticles: true });
                mob.addEffect('slowness',  80, { amplifier: 2, showParticles: true });
                ringBWT(dim, mob.location, 0.7, 6, 0.3);
                count++;
            } catch (_) {}
        }

        ab(player,
            '\u00a7b\u00a7l\u26a1 \u00a7fVoid Blink! \u00a77Teleported \u00a7e' + actualDist
          + '\u00a77 blocks \u2014 Hit \u00a7e' + count + '\u00a77 mob(s) \u2014 \u00a7b10dmg\u00a77 + Blind + Slow'
        );
    }, 12);

    state.cdVoidCollapse = CD_VOID_COLLAPSE * 20;
    state.sneakTicks  = 0;
    state.dashPending = false;
}

// ─── H0 — Awakening (UPGRADED) ───────────────────────────────────────────────

function activateAwakening(player, state) {
    const dim = player.dimension;
    const loc = player.location;

    // AoE 8 damage bán kính 6 block
    const nearMobs = getMobsNear(player, 6);
    for (const mob of nearMobs) {
        try {
            mob.applyDamage(8, { cause: 'entityExplosion', damagingEntity: player });
            mob.addEffect('weakness', 100, { amplifier: 1, showParticles: true });
        } catch (_) {}
    }

    // Buff mạnh hơn: Speed III + Strength II + Resistance I + NightVision 15s
    try {
        player.addEffect('speed',        300, { amplifier: 2, showParticles: true  });
        player.addEffect('strength',     300, { amplifier: 1, showParticles: true  });
        player.addEffect('resistance',   300, { amplifier: 0, showParticles: true  });
        player.addEffect('night_vision', 300, { amplifier: 0, showParticles: false });
    } catch (_) {}

    // Hiệu ứng particle hoành tráng: 4 vòng mở rộng + 2 tia sét + burst
    particle(dim, 'minecraft:large_explosion', loc);
    ringBWT(dim, loc, 1.5, 12, 0);
    system.runTimeout(() => { ringBWT(dim, loc, 3.0, 18, 0.5); burstBWT(dim, loc, 2.5, 16); }, 4);
    system.runTimeout(() => { ringBWT(dim, loc, 4.5, 22, 1.0); }, 8);
    system.runTimeout(() => { ringBWT(dim, loc, 6.0, 26, 0.5); burstBWT(dim, loc, 5.0, 20); }, 12);
    system.runTimeout(() => {
        // 2 tia sét trang trí (không gây sát thương cho player)
        try {
            const a1 = Math.random() * Math.PI * 2;
            const a2 = a1 + Math.PI;
            dim.spawnEntity('minecraft:lightning_bolt', { x: loc.x + Math.cos(a1) * 5, y: loc.y, z: loc.z + Math.sin(a1) * 5 });
            dim.spawnEntity('minecraft:lightning_bolt', { x: loc.x + Math.cos(a2) * 5, y: loc.y, z: loc.z + Math.sin(a2) * 5 });
        } catch (_) {}
        particleSphere(dim, loc, 3.0, 30);
    }, 16);

    sound(player, 'mob.endermen.stare', 0.5, 0.5);
    sound(player, 'random.explode',     1.0, 0.6);
    system.runTimeout(() => { sound(player, 'mob.endermen.portal', 1.0, 0.8); }, 10);

    ab(player,
        '\u00a7d\u00a7l\u2736 AWAKENING! \u00a77AoE 8 dmg + Speed III + Strength II + Resist \u00a78(15s)\n'
      + '\u00a79[Jump] \u00a7d\u26a1 Ender Cataclysm   \u00a79[Shift] \u00a75\ud83d\udc7b Phantom Shroud'
    );

    state.awakeningUsed = true;
    state.windowActive  = true;
    state.windowTicks   = 140; // 7 giây
}

// ─── H1 — Ender Cataclysm (UPGRADED từ Ender Storm) ─────────────────────────
// 20 sét + AoE 15 damage + Wither III cho mọi mob 15 block

function activateEnderCataclysm(player, state) {
    if (state.cdEnderCataclysm > 0) return; // cooldown display removed — JavaPvP handles action bar
    const dim = player.dimension;
    const loc = player.location;

    ab(player, '\u00a7d\u00a7l\u26a1 ENDER CATACLYSM! \u00a77Raining 20 lightning bolts...');
    sound(player, 'mob.endermen.portal', 1.2, 1.0);
    sound(player, 'random.explode', 1.0, 0.8);

    // Vòng particle báo hiệu
    ringBWT(dim, loc, 10, 24, 6.0);
    burstBWT(dim, loc, 8, 24);
    system.runTimeout(() => { particleSphere(dim, loc, 4.0, 30); }, 5);

    // 20 sét ngẫu nhiên bán kính 12 block
    for (let i = 0; i < 20; i++) {
        system.runTimeout(() => {
            try {
                const angle = Math.random() * Math.PI * 2;
                const r     = 1 + Math.random() * 12;
                const sLoc  = { x: loc.x + Math.cos(angle) * r, y: loc.y, z: loc.z + Math.sin(angle) * r };
                dim.spawnEntity('minecraft:lightning_bolt', sLoc);
                ringBWT(dim, sLoc, 1.0, 6, 0);
            } catch (_) {}
        }, i * 6);
    }

    // AoE 15 damage + Wither III 5s cho mọi mob bán kính 15 block
    system.runTimeout(() => {
        const mobs = getMobsNear(player, 15);
        for (const mob of mobs) {
            try {
                mob.applyDamage(15, { cause: 'magic', damagingEntity: player });
                mob.addEffect('wither',   100, { amplifier: 2, showParticles: true });
                mob.addEffect('slowness', 100, { amplifier: 3, showParticles: true });
                burstBWT(dim, mob.location, 1.5, 8);
            } catch (_) {}
        }
        particle(dim, 'minecraft:large_explosion', loc);
        ab(player, '\u00a7d\u00a7l\u26a1 ENDER CATACLYSM! \u00a77Hit \u00a7e' + mobs.length + '\u00a77 mobs \u2014 \u00a7c15dmg\u00a77 + Wither III');
        sound(player, 'mob.endermen.scream', 0.8, 0.7);
    }, 20 * 6 + 5);

    state.cdEnderCataclysm = CD_ENDER_CATACLYSM * 20;
    state.windowActive = false;
    state.windowTicks  = 0;
}

// ─── H2 — Phantom Shroud (UPGRADED từ Shadow Veil) ───────────────────────────
// Tàng hình + Speed IV + Strength II + particle phantom liên tục + hồi máu dần

function activatePhantomShroud(player, state) {
    if (state.cdPhantomShroud > 0) return; // cooldown display removed — JavaPvP handles action bar

    // Buff: Tàng hình + Speed IV + Strength II + Regeneration II
    try {
        player.addEffect('invisibility',  140, { amplifier: 0, showParticles: false });
        player.addEffect('speed',         140, { amplifier: 3, showParticles: false }); // Speed IV
        player.addEffect('strength',      140, { amplifier: 1, showParticles: false }); // Strength II
        player.addEffect('regeneration',  140, { amplifier: 1, showParticles: false }); // Hồi máu dần
        player.addEffect('jump_boost',    140, { amplifier: 2, showParticles: false }); // Nhảy cao hơn
    } catch (_) {}

    const dim = player.dimension;
    const loc = player.location;

    // Nổ particle phantom lúc kích hoạt — xanh lam/tím
    particleSphere(dim, loc, 1.2, 20);
    system.runTimeout(() => { particleSphere(dim, loc, 2.5, 28); ringBWT(dim, loc, 2.5, 16, 0.5); }, 4);
    system.runTimeout(() => { particleSphere(dim, loc, 3.8, 32); burstBWT(dim, loc, 3.5, 20); }, 8);
    system.runTimeout(() => { ringBWT(dim, loc, 1.5, 12, 2.5); }, 12);

    sound(player, 'mob.endermen.portal', 0.7, 0.85);
    sound(player, 'mob.endermen.stare',  1.0, 0.6);

    ab(player, '\u00a75\u00a7l\ud83d\udc7b PHANTOM SHROUD! \u00a77Invisible + Speed IV + Strength II + Regen \u00a78(7s)');

    // Đánh dấu phantom active để tick loop phun particle liên tục
    state.phantomActive = true;
    state.phantomTicks  = 140;

    state.cdPhantomShroud = CD_PHANTOM_SHROUD * 20;
    state.windowActive = false;
    state.windowTicks  = 0;
}

// ─── MAIN TICK ───────────────────────────────────────────────────────────────

system.runInterval(() => {

    for (const player of world.getAllPlayers()) {
        const state    = getState(player);
        const holding  = isHoldingEndbringer(player);
        const sneaking = player.isSneaking;
        const jumping  = player.isJumping;
        const dim      = player.dimension;
        const loc      = player.location;

        // Tick down cooldowns
        if (state.cdVoidCollapse   > 0) state.cdVoidCollapse--;
        if (state.cdVoidDash       > 0) state.cdVoidDash--;
        if (state.cdVoidBurst      > 0) state.cdVoidBurst--;
        if (state.cdEnderCataclysm > 0) state.cdEnderCataclysm--;
        if (state.cdPhantomShroud  > 0) state.cdPhantomShroud--;

        // Phantom Shroud: phun particle mỗi 8 tick khi tàng hình
        if (state.phantomActive) {
            state.phantomTicks--;
            if (state.phantomTicks <= 0) {
                state.phantomActive = false;
            } else if (state.phantomTicks % 8 === 0) {
                // Vòng particle xanh lam/tím nhỏ xung quanh người chơi liên tục
                ringBWT(dim, loc, 1.0, 6, 0.3);
                ringBWT(dim, loc, 0.6, 4, 1.2);
                particle(dim, 'minecraft:wax_particle', { x: loc.x, y: loc.y + 2.0, z: loc.z });
            }
        }

        if (!holding) {
            state.sneakTicks    = 0;
            state.dashPending   = false;
            state.holdTicks     = 0;
            state.awakeningUsed = false;
            state.windowActive  = false;
            state.windowTicks   = 0;
            continue;
        }

        // ══ HOLD SYSTEM ═════════════════════════════════════════════════════
        state.holdTicks++;

        if (state.windowActive) {
            state.windowTicks--;
            // Window hint display removed — JavaPvP handles action bar
            if (jumping && !sneaking) { activateEnderCataclysm(player, state); continue; }
            if (sneaking && !jumping) { activatePhantomShroud(player, state);  continue; }
            if (state.windowTicks <= 0) {
                state.windowActive  = false;
                state.awakeningUsed = false;
                state.holdTicks     = 0;
                ab(player, '\u00a78\u2736 Awakening window expired');
            }
            continue;
        }

        if (state.holdTicks >= 400 && !state.awakeningUsed) {
            activateAwakening(player, state);
        }

        // Awakening progress display removed — JavaPvP handles action bar

        // ══ SNEAK SYSTEM ════════════════════════════════════════════════════
        if (sneaking) {
            state.sneakTicks++;

            // Charge progress display removed — JavaPvP handles action bar

            if (state.sneakTicks >= 40 && state.sneakTicks < 60) {
                if (!state.dashPending) {
                    state.dashPending = true;
                    sound(player, 'mob.endermen.stare', 1.4, 0.8);
                }

                if (state.sneakTicks % 5 === 0) {
                    ringBWT(dim, loc, 1.2, 6, 0);
                    ringBWT(dim, loc, 0.6, 4, 1.0);
                }

                // Void Dash flash prompt removed — JavaPvP handles action bar
            }

            if (state.dashPending && jumping && state.sneakTicks < 60) {
                activateVoidDash(player, state);
                state.sneakTicks = 0;
                continue;
            }

            if (state.sneakTicks >= 60) {
                if (jumping) {
                    // Void Blink: 3s sneak + Jump → teleport up to 15 blocks in look direction
                    activateVoidBlink(player, state);
                } else {
                    // Void Collapse: 3s sneak → AoE burst
                    activateVoidCollapse(player, state);
                }
                state.sneakTicks  = 0;
                state.dashPending = false;
                continue;
            }

        } else {
            state.sneakTicks  = 0;
            state.dashPending = false;
        }
    }
}, 1);
