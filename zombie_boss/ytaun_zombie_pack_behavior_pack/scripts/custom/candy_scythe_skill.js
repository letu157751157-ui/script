import {
    world,
    system,
    EntityDamageCause,
    EquipmentSlot,
    EntityComponentTypes,
    ItemTypes
} from '@minecraft/server';

const SCYTHE_ID = 'ytaun:candy_scythe';

// ─────────────────────────────────────────
//  Beyond Java PvP Compatibility Detection
// ─────────────────────────────────────────
let _bjcDetected = null;
function isBJCInstalled() {
    if (_bjcDetected === null) {
        try {
            _bjcDetected = ItemTypes.get('bey:iron_sword') != null;
        } catch (_) {
            _bjcDetected = false;
        }
    }
    return _bjcDetected;
}

const actionbarOverride = new Map();

function setActionBar(player, text, holdTicks = 40) {
    player.onScreenDisplay.setActionBar(text);
    if (isBJCInstalled()) {
        actionbarOverride.set(player.id, holdTicks);
    }
}

// ─────────────────────────────────────────
//  Skill constants
// ─────────────────────────────────────────
const SKILL1_INTERVAL      = 600;
const SKILL1_RADIUS        = 4;
const SKILL1_DAMAGE        = 4;
const SKILL1_BUFF_TICKS    = 120;
const SKILL1_READY_WINDOW  = 100;

const SKILL1UP_RADIUS      = 6;
const SKILL1UP_DAMAGE      = 7;
const SKILL1UP_BUFF_TICKS  = 200;

const SKILL2_BUFF_TICKS    = 80;
const SKILL2_CROUCH_REQ    = 60;

const SKILL3_RADIUS        = 3.5;
const SKILL3_DAMAGE        = 7;
const SKILL3_LAUNCH_Y      = 0.55;
const SKILL3_KB            = 0.8;
const SKILL3_WINDOW        = 120;

const SKILL4_RADIUS        = 3;
const SKILL4_DRAIN         = 3;
const SKILL4_HEAL          = 1;
const SKILL4_CD            = 300;

// ─────────────────────────────────────────
//  Particle helpers
// ─────────────────────────────────────────
function spawnP(dimension, loc, name, dy = 0) {
    try {
        dimension.spawnParticle(name, { x: loc.x, y: loc.y + dy, z: loc.z });
    } catch (_) {}
}

function spawnRing(dimension, center, radius, count, name, dy = 0) {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        try {
            dimension.spawnParticle(name, {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + dy,
                z: center.z + Math.sin(angle) * radius
            });
        } catch (_) {}
    }
}

function spawnDoubleRing(dimension, center, radius, count, name) {
    spawnRing(dimension, center, radius,       count, name, 0.2);
    spawnRing(dimension, center, radius * 0.5, count, name, 1.0);
}

// ─────────────────────────────────────────
//  Per-player state
// ─────────────────────────────────────────
const pState = new Map();

function getState(id) {
    if (!pState.has(id)) {
        pState.set(id, {
            holdTicks: 0, crouchTicks: 0, skill3Window: 0,
            skill1Cooldown: 0, skill4Cooldown: 0,
            skill2Done: false, skill1Ready: false, prevVelY: 0,
        });
    }
    return pState.get(id);
}

function isHoldingScythe(player) {
    const equip = player.getComponent(EntityComponentTypes.Equippable);
    return equip?.getEquipment(EquipmentSlot.Mainhand)?.typeId === SCYTHE_ID;
}

function getNearbyMobs(dimension, location, radius) {
    return dimension.getEntities({
        location, maxDistance: radius,
        excludeFamilies: ['player'],
        excludeTypes: ['minecraft:item', 'minecraft:xp_orb', 'minecraft:arrow']
    });
}

function isJumping(vel, prevVelY) {
    return vel.y > 0.1 && vel.y > prevVelY + 0.05;
}

// ─────────────────────────────────────────
//  SKILL 1 — Candy Aura (normal)
// ─────────────────────────────────────────
function skill1_CandyAura(player) {
    const loc  = player.location;
    const dim  = player.dimension;
    spawnP(dim, loc, 'minecraft:totem_particle', 0.5);
    spawnP(dim, loc, 'minecraft:hearts_particle', 1.0);
    spawnRing(dim, loc, SKILL1_RADIUS, 8, 'minecraft:totem_particle', 0.1);

    const mobs = getNearbyMobs(dim, loc, SKILL1_RADIUS);
    let hit = 0;

    // FIX: stagger damage để tránh invincibility frame
    mobs.forEach((mob, index) => {
        if (!mob.isValid) return; // FIX v2: isValid la property, khong phai method (v2 API)
        system.runTimeout(() => {
            try {
                mob.applyDamage(SKILL1_DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
                mob.addEffect('slowness', 40, { amplifier: 0, showParticles: true });
                spawnP(dim, mob.location, 'minecraft:hearts_particle', 1.0);
                hit++;
            } catch (_) {}
        }, index * 2);
    });

    player.addEffect('strength', SKILL1_BUFF_TICKS, { amplifier: 0, showParticles: true });

    system.runTimeout(() => {
        setActionBar(player, `§d✦ Candy Aura! §fHit §e${hit}§f mob${hit !== 1 ? 's' : ''}`, 60);
    }, mobs.length * 2 + 2);

    dim.playSound('beacon.activate', loc, { volume: 0.6, pitch: 1.4 });
}

// ─────────────────────────────────────────
//  SKILL 1 UPGRADED — Candy Aura+
// ─────────────────────────────────────────
function skill1_CandyAuraUpgraded(player) {
    const loc  = player.location;
    const dim  = player.dimension;
    spawnP(dim, loc, 'minecraft:knockback_roar_particle', 0);
    spawnP(dim, loc, 'minecraft:totem_particle', 0.5);
    spawnP(dim, loc, 'minecraft:totem_particle', 1.2);
    spawnP(dim, loc, 'minecraft:hearts_particle', 1.5);
    spawnDoubleRing(dim, loc, SKILL1UP_RADIUS, 12, 'minecraft:totem_particle');
    spawnRing(dim, loc, SKILL1UP_RADIUS * 0.7, 8, 'minecraft:hearts_particle', 0.5);
    spawnRing(dim, loc, SKILL1UP_RADIUS, 6, 'minecraft:knockback_roar_particle', 0.2);

    const mobs = getNearbyMobs(dim, loc, SKILL1UP_RADIUS);
    let hit = 0;

    // FIX: stagger damage
    mobs.forEach((mob, index) => {
        if (!mob.isValid) return; // FIX v2: isValid la property, khong phai method (v2 API)
        system.runTimeout(() => {
            try {
                mob.applyDamage(SKILL1UP_DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
                mob.addEffect('slowness', 60, { amplifier: 1, showParticles: true });
                mob.addEffect('weakness', 60, { amplifier: 0, showParticles: true });
                spawnP(dim, mob.location, 'minecraft:totem_particle', 1.0);
                spawnP(dim, mob.location, 'minecraft:hearts_particle', 1.2);
                spawnP(dim, mob.location, 'minecraft:knockback_roar_particle', 0);
                hit++;
            } catch (_) {}
        }, index * 2);
    });

    player.addEffect('strength',     SKILL1UP_BUFF_TICKS, { amplifier: 1, showParticles: true });
    player.addEffect('speed',        SKILL1UP_BUFF_TICKS, { amplifier: 0, showParticles: true });
    player.addEffect('damage_boost', 60,                  { amplifier: 0, showParticles: true });

    system.runTimeout(() => {
        setActionBar(player,
            `§6§l✦ CANDY AURA+ §r§fHit §e${hit}§f mob${hit !== 1 ? 's' : ''} §7[§aUPGRADED§7]`,
            80
        );
    }, mobs.length * 2 + 2);

    dim.playSound('beacon.activate', loc, { volume: 1.0, pitch: 1.6 });
    dim.playSound('random.levelup',  loc, { volume: 0.5, pitch: 1.2 });
}

// ─────────────────────────────────────────
//  SKILL 2 — Reaper's Stance
// ─────────────────────────────────────────
function skill2_ReaperStance(player) {
    const loc  = player.location;
    const dim  = player.dimension;
    player.addEffect('resistance', SKILL2_BUFF_TICKS, { amplifier: 0, showParticles: true });
    player.addEffect('strength',   SKILL2_BUFF_TICKS, { amplifier: 0, showParticles: true });
    player.addEffect('slowness',   SKILL2_BUFF_TICKS, { amplifier: 0, showParticles: false });
    spawnP(dim, loc, 'minecraft:knockback_roar_particle', 0);
    spawnP(dim, loc, 'minecraft:basic_smoke_particle', 1.0);
    spawnRing(dim, loc, 1.5, 6, 'minecraft:basic_smoke_particle', 0.3);
    spawnRing(dim, loc, 1.0, 4, 'minecraft:knockback_roar_particle', 0.5);
    setActionBar(player, `§c⚔ Reaper's Stance! §7Press §fJump §7within §e6s §7for Skill 3`, 80);
    dim.playSound('mob.wither.spawn', loc, { volume: 0.4, pitch: 1.6 });
}

// ─────────────────────────────────────────
//  SKILL 3 — Candy Storm
// ─────────────────────────────────────────
function skill3_CandyStorm(player) {
    const loc  = player.location;
    const dim  = player.dimension;
    spawnP(dim, loc, 'minecraft:knockback_roar_particle', 0);
    spawnRing(dim, loc, SKILL3_RADIUS, 10, 'minecraft:totem_particle', 0.3);
    spawnRing(dim, loc, SKILL3_RADIUS * 0.6, 6, 'minecraft:basic_flame_particle', 0.8);
    spawnP(dim, loc, 'minecraft:totem_particle', 1.5);

    const mobs = getNearbyMobs(dim, loc, SKILL3_RADIUS);
    let hit = 0;

    // FIX: stagger damage
    mobs.forEach((mob, index) => {
        if (!mob.isValid) return; // FIX v2: isValid la property, khong phai method (v2 API)
        system.runTimeout(() => {
            try {
                mob.applyDamage(SKILL3_DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
                mob.addEffect('slowness', 60, { amplifier: 1, showParticles: true });
                const dx  = mob.location.x - loc.x;
                const dz  = mob.location.z - loc.z;
                const len = Math.sqrt(dx * dx + dz * dz) || 1;
                mob.applyImpulse({ x: (dx / len) * SKILL3_KB, y: 0.3, z: (dz / len) * SKILL3_KB });
                spawnP(dim, mob.location, 'minecraft:basic_flame_particle', 1.0);
                spawnP(dim, mob.location, 'minecraft:basic_smoke_particle', 0.5);
                hit++;
            } catch (_) {}
        }, index * 2);
    });

    try { player.applyImpulse({ x: 0, y: SKILL3_LAUNCH_Y, z: 0 }); } catch (_) {}
    player.addEffect('slow_falling', 40, { amplifier: 0, showParticles: false });

    system.runTimeout(() => {
        setActionBar(player, `§e⚡ Candy Storm! §fHit §e${hit}§f mob${hit !== 1 ? 's' : ''}`, 60);
    }, mobs.length * 2 + 2);

    dim.playSound('random.explode', loc, { volume: 0.7, pitch: 1.3 });
}

// ─────────────────────────────────────────
//  SKILL 4 — Sweet Drain
// ─────────────────────────────────────────
function skill4_SweetDrain(player) {
    const loc  = player.location;
    const dim  = player.dimension;
    const mobs = getNearbyMobs(dim, loc, SKILL4_RADIUS);
    let totalHeal = 0;

    // FIX: stagger damage
    mobs.forEach((mob, index) => {
        if (!mob.isValid) return; // FIX v2: isValid la property, khong phai method (v2 API)
        system.runTimeout(() => {
            try {
                mob.applyDamage(SKILL4_DRAIN, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
                spawnP(dim, mob.location, 'minecraft:basic_smoke_particle', 0.5);
                spawnP(dim, mob.location, 'minecraft:hearts_particle', 1.0);
                totalHeal += SKILL4_HEAL;
            } catch (_) {}
        }, index * 2);
    });

    system.runTimeout(() => {
        if (totalHeal > 0) {
            const hp = player.getComponent(EntityComponentTypes.Health);
            if (hp) hp.setCurrentValue(Math.min(hp.currentValue + totalHeal, hp.effectiveMax));
            spawnP(dim, loc, 'minecraft:hearts_particle', 0.5);
            spawnP(dim, loc, 'minecraft:hearts_particle', 1.2);
            spawnRing(dim, loc, 1.0, 5, 'minecraft:hearts_particle', 0.8);
        }
        player.addEffect('regeneration', 60, { amplifier: 0, showParticles: true });
        setActionBar(player,
            `§a♥ Sweet Drain! §f+§c${totalHeal}§f HP from §e${mobs.length}§f mob${mobs.length !== 1 ? 's' : ''}`,
            60
        );
    }, mobs.length * 2 + 5);

    dim.playSound('random.drink', loc, { volume: 1.0, pitch: 0.9 });
}

// ─────────────────────────────────────────
//  MAIN TICK
// ─────────────────────────────────────────
system.runInterval(() => {
    const bjc = isBJCInstalled();

    for (const player of world.getAllPlayers()) {
        const s = getState(player.id);

        if (s.skill1Cooldown > 0) s.skill1Cooldown--;
        if (s.skill4Cooldown > 0) s.skill4Cooldown--;
        if (s.skill3Window   > 0) s.skill3Window--;

        if (bjc) {
            const rem = actionbarOverride.get(player.id) ?? 0;
            if (rem > 0) actionbarOverride.set(player.id, rem - 1);
        }

        if (!isHoldingScythe(player)) {
            s.holdTicks    = 0;
            s.crouchTicks  = 0;
            s.skill3Window = 0;
            s.skill2Done   = false;
            s.skill1Ready  = false;
            s.prevVelY     = 0;
            continue;
        }

        const sneaking = player.isSneaking;
        const vel      = player.getVelocity();
        const jumped   = isJumping(vel, s.prevVelY);

        // ── Skill 1 ──────────────────────────────
        s.holdTicks++;
        const left = SKILL1_INTERVAL - s.holdTicks;

        if (s.skill1Cooldown <= 0 && left >= 0 && left <= SKILL1_READY_WINDOW) {
            s.skill1Ready = true;
        }

        if (s.holdTicks >= SKILL1_INTERVAL && s.skill1Cooldown <= 0) {
            skill1_CandyAura(player);
            s.holdTicks      = 0;
            s.skill1Cooldown = SKILL1_INTERVAL;
            s.skill1Ready    = false;

        } else if (s.skill1Ready && jumped && !(s.skill2Done && s.skill3Window > 0)) {
            skill1_CandyAuraUpgraded(player);
            s.holdTicks      = 0;
            s.skill1Cooldown = SKILL1_INTERVAL;
            s.skill1Ready    = false;
            s.prevVelY       = vel.y;
            continue;
        }

        // ── HUD Skill 1 ──────────────────────────
        if (s.skill1Cooldown <= 0) {
            const overrideLeft = bjc ? (actionbarOverride.get(player.id) ?? 0) : 0;
            if (overrideLeft <= 0) {
                if (s.skill1Ready) {
                    const flash = (system.currentTick % 20 < 10) ? '§6§l' : '§e§l';
                    player.onScreenDisplay.setActionBar(`${flash}✦ JUMP → UPGRADE Candy Aura+!`);
                } else if (!bjc && left > 0) {
                    player.onScreenDisplay.setActionBar(`§d✦ Candy Aura in §e${Math.ceil(left / 20)}s`);
                }
            }
        }

        // ── Skill 3 ──────────────────────────────
        if (s.skill2Done && s.skill3Window > 0 && jumped) {
            skill3_CandyStorm(player);
            s.skill2Done   = false;
            s.skill3Window = 0;
            s.crouchTicks  = 0;
            s.prevVelY     = vel.y;
            continue;
        }

        // ── Skill 2 — Crouch 3s ──────────────────
        if (sneaking) {
            s.crouchTicks++;
            if (s.crouchTicks === SKILL2_CROUCH_REQ && !s.skill2Done) {
                skill2_ReaperStance(player);
                s.skill2Done   = true;
                s.skill3Window = SKILL3_WINDOW;
            }
            if (!s.skill2Done && s.crouchTicks < SKILL2_CROUCH_REQ) {
                const overrideLeft = bjc ? (actionbarOverride.get(player.id) ?? 0) : 0;
                if (overrideLeft <= 0) {
                    const pct = Math.floor((s.crouchTicks / SKILL2_CROUCH_REQ) * 10);
                    const bar = '§c' + '|'.repeat(pct) + '§7' + '|'.repeat(10 - pct);
                    player.onScreenDisplay.setActionBar(`§c⚔ Reaper's Stance ${bar}`);
                }
            }
        } else {
            if (!s.skill2Done) s.crouchTicks = 0;
            if (s.skill3Window <= 0 && s.skill2Done) {
                s.skill2Done  = false;
                s.crouchTicks = 0;
            }
        }

        s.prevVelY = vel.y;
    }
}, 1);

// ── Skill 4 — Right click ────────────────
system.run(() => {
    world.afterEvents.itemUse.subscribe((event) => {
        const { source: player, itemStack } = event;
        if (itemStack?.typeId !== SCYTHE_ID) return;
        const s = getState(player.id);
        if (s.skill4Cooldown > 0) {
            setActionBar(player, `§cSkill 4 cooldown: §f${Math.ceil(s.skill4Cooldown / 20)}s`, 40);
            return;
        }
        skill4_SweetDrain(player);
        s.skill4Cooldown = SKILL4_CD;
    });
});

console.warn('[Candy Scythe] Skills loaded! BJC compat: ' + (isBJCInstalled() ? 'ACTIVE' : 'standalone'));
