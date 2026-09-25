// The Darkin Blade tuning. Edit here to rebalance the skills.
// Units: health (20 = 10 hearts), blocks, seconds.

export const CONFIG = {
  // Whether skills can hit other players (false = mobs only)
  pvp: true,
  // Lifesteal: heal this fraction of damage dealt (normal attacks and skills)
  lifesteal: 0.15,

  // Passive — Deathbringer Stance: the next normal attack explodes for % of the target's max health and heals
  passive: {
    cooldown: 8,
    maxHealthPct: 0.08,
    minBonus: 3,
    maxBonus: 12,
    healRatio: 1,
    sweetSpotReduction: 2, // Q sweet-spot hit reduces the passive cooldown (seconds)
    delay: 0.5, // the wound explodes after this delay (avoids the post-hit invulnerability)
  },

  // Q — The Darkin Blade: 3 slashes; the sweet spot (Q1/Q2 blade tip, Q3 center) deals x1.6 damage + knock-up + stun
  Q: {
    cooldown: 7,
    recastWindow: 4,
    windup: 0.45,
    sweetMultiplier: 1.6,
    knockup: 0.8,
    stun: 0.6,
    casts: [
      { shape: "box", length: 6.5, width: 3.5, sweet: 1.8, damage: 8 }, // long slash
      { shape: "box", length: 5.5, width: 5.5, sweet: 1.8, damage: 9 }, // wide slash
      { shape: "circle", offset: 3, radius: 3.5, sweet: 1.5, damage: 12 }, // ground slam
    ],
  },

  // E — Umbral Dash: dash where you look
  E: {
    cooldown: 4,
    strength: 2.2,
    vertical: 0.15,
  },

  // W — Infernal Chains: bind a target; if it doesn't leave the circle in time it is pulled back + stunned
  W: {
    cooldown: 12,
    range: 14,
    speed: 1.5, // blocks per tick
    hitRadius: 1.2,
    damage: 4,
    slowAmplifier: 1,
    pullDelay: 1.5,
    escapeRadius: 3.5,
    pullPerBlock: 0.35,
    maxPull: 3,
    pullDamage: 5,
    stun: 0.75,
  },

  // R — World Ender: transform, knock back + slow nearby enemies, bonus damage/healing/speed
  R: {
    cooldown: 60,
    duration: 10,
    castTime: 0.5,
    radius: 6,
    castDamage: 4,
    knockback: 1.6,
    fearSlowAmplifier: 2,
    fearDuration: 2,
    damageMultiplier: 1.3, // applies to skill damage
    healMultiplier: 1.5,
    speedAmplifier: 1,
    strengthAmplifier: 0, // boosts normal attack damage via the Strength effect
    passiveCooldownMultiplier: 0.5,
    // World Ender zone that follows you while transformed: enemies inside lose health every second and are slowed
    zoneRadius: 6,
    zoneDamage: 1.5,
    // Skills are empowered while transformed
    empowered: {
      qScale: 1.3, // Q: bigger slash area, fire pillars along the slash
      eStrength: 1.4, // E: longer dash
      eCooldown: 0.5, // E: half cooldown
      eTrailDamage: 3, // E: fire trail damages enemies it passes
      wChains: 3, // W: fire 3 chains in a fan
      wSpread: 20, // W: angle between chains (degrees)
      wCooldown: 0.6,
    },
  },
};
