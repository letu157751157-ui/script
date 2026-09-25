// Inverted Spear of Heaven tuning. Edit here to rebalance the skills.
// Units: health (20 = 10 hearts), blocks, seconds.

export const CONFIG = {
  // Whether skills can hit other players (false = mobs only)
  pvp: true,
  // Language of the spear's tooltip (item lore): "vi" or "en".
  // Chat, titles and the bar above the hotbar follow each player's game language automatically.
  loreLanguage: "vi",

  // Passive — Nullification: every hit with the spear strips the target's positive effects
  // (the Inverted Spear of Heaven cancels cursed techniques)
  passive: {
    nullifyOnHit: true,
  },

  // Normal attacks — 4-hit combo like JJS M1s: the 4th hit is a spinning finisher that knocks back
  combo: {
    window: 1.2, // seconds allowed between two hits of the combo
    finisherDelay: 0.2, // matches the sweep keyframe of the "finisher" animation
    radius: 3.5,
    arc: 150, // degrees in front of you
    damage: 6,
    knockback: 1.6,
    vertical: 0.45,
  },

  // Right-click — Nullifying Thrust: short lunge + straight stab that pierces every target in a line
  thrust: {
    cooldown: 5,
    windup: 0.3, // matches the strike keyframe of the "thrust" animation
    lunge: 1.4,
    length: 5.5,
    width: 1.8,
    damage: 10,
    knockback: 0.9,
  },

  // Sneak + right-click — Thousand-Mile Chain: throw the spear on its chain.
  // Hits a target: damage, stun and yank it back to you. Hits a wall/ground: grapple yourself there.
  chain: {
    cooldown: 10,
    release: 0.3, // matches the release keyframe of the "throw" animation
    range: 22,
    speed: 1.8, // blocks per tick
    hitRadius: 1.5,
    damage: 7,
    stun: 1,
    pullPerBlock: 0.32,
    maxPull: 3.2,
    grapplePerBlock: 0.3,
    maxGrapple: 3.5,
  },

  // Sprint + attack (or sprint + right-click) — Heavenly Rush: dash through enemies with 3 quick slashes
  rush: {
    cooldown: 6,
    strength: 2.6,
    vertical: 0.12,
    hitRadius: 1.8,
    slashes: 3,
    slashInterval: 4, // ticks between slashes on a caught target
    damage: 3.5,
  },

  // Hold the spear 20 s — Heavenly Restriction: Awakened (triggers by itself)
  awaken: {
    holdTime: 20,
    duration: 15,
    speedAmplifier: 1,
    strengthAmplifier: 1,
    jumpAmplifier: 1,
    resistanceAmplifier: 0,
    damageMultiplier: 1.3, // skill damage
    cooldownMultiplier: 0.5, // skill cooldowns while awakened
  },

  // Hold 20 s + jump (while awakened) — Heaven-Splitting Plunge: leap, then drive the spear into the ground
  plunge: {
    leap: 1.3, // upward launch
    forward: 0.8,
    diveAt: 0.7, // seconds after the leap, matches the "plunge" animation
    diveSpeed: 3.2,
    maxFall: 2.5, // impact at the latest after this many seconds
    radius: 6,
    damage: 18,
    knockup: 0.9,
    stun: 1.5,
  },
};
