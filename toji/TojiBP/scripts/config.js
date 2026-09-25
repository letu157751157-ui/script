// Inverted Spear of Heaven tuning. Edit here to rebalance the skills.
// Units: health (20 = 10 hearts), blocks, seconds.

export const CONFIG = {
  // Whether skills hit other players (false = mobs only). When on, skills hurt players even if the world's
  // PvP setting is off (their health is lowered directly); players in Creative/Spectator are never hurt.
  pvp: true,

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

  // Right-click — Pierce Infinity (the stab through Gojo's Infinity): blink forward and stab;
  // an Infinity barrier appears on each target and shatters, the target is pierced (short stun)
  thrust: {
    cooldown: 5,
    windup: 0.3, // matches the strike keyframe of the "thrust" animation
    lunge: 2.0,
    length: 6,
    width: 1.8,
    damage: 11,
    stun: 0.5,
    knockback: 0.9,
  },

  // Sneak + right-click — Thousand-Mile Chain whirl: swing the spear on its chain in circles around you
  // (hits everything in the ring on each lap), then hurl it forward.
  // The hurled spear: hits an enemy = drag it all the way back to you; sticks in a wall/ground = swing yourself there.
  chain: {
    cooldown: 10,
    spinTime: 0.9, // seconds of whirling, the release matches the "whirl" animation (1.05 s)
    release: 1.05,
    spinRadius: 4.5,
    laps: 2,
    spinDamage: 5,
    spinKnockback: 1.1,
    range: 24,
    speed: 2, // blocks per tick
    hitRadius: 1.5,
    damage: 8,
    stun: 1,
    reelTime: 0.5, // seconds to drag a hooked enemy all the way to you
    swingTime: 0.7, // seconds to swing yourself to where the spear stuck
  },

  // Sprint + attack (or sprint + right-click) — Heavenly Ambush: Toji has no cursed energy, nobody senses him.
  // He vanishes, reappears behind the target you look at and cuts an X into its back
  rush: {
    cooldown: 7,
    range: 14, // how far away the target can be
    behind: 1.6, // blocks behind the target
    cuts: [0.15, 0.35], // seconds after reappearing, match the "ambush" animation
    damage: 7, // per cut (the 2 cuts land as one hit, see main.js)
    stun: 0.8,
    // no target in sight: a plain vanishing dash instead
    strength: 2.6,
    vertical: 0.12,
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
    // While awakened every other skill is upgraded:
    empowered: {
      thrustRange: 1.7, // Pierce reaches 70% further...
      thrustDamage: 1.6, // ...hits harder, and stabs 3 times (triple streak)
      chainLaps: 3, // Chain whirls 3 laps...
      chainRadius: 1.35, // ...in a wider circle
      chainExtraHooks: 2, // the hurled spear also hooks up to 2 more enemies near the first one
      chainHookRadius: 6,
      ambushChain: 3, // Ambush jumps from back to back through up to 3 enemies
      ambushHop: 10, // max distance to the next enemy
      jumpRadius: 2, // Sky Splitter shockwave twice as wide, full damage to everyone in it
      sweepArc: 360, // Low Sweep turns into a full circle...
      sweepRadius: 1.3,
      sweepLaunch: 1.5, // ...and launches 50% higher
      comboHits: 3, // the finisher comes on the 3rd hit instead of the 4th...
      finisherArc: 360, // ...and is a full spin
      finisherDamage: 1.5,
    },
  },

  // Hold 20 s + jump (while awakened) — Sorcerer Killer: Heaven's Execution.
  // Chains burst out of the Inventory Curse and hook every mob around you, drag them into the sky and
  // hold them in a ring; Toji flies up and pierces through each of them over and over, then slams them all
  // into the ground at once.
  plunge: {
    radius: 12, // mobs this close are hooked
    maxTargets: 12,
    ringRadius: 4,
    ringHeight: 5, // blocks above you
    liftTime: 1.0, // seconds to drag them up
    pierceRounds: 3, // Toji goes around the ring this many times
    pierceInterval: 3, // ticks between two pierces
    damagePerPierce: 8, // a mob's pierces land as one hit at the end (mobs ignore hits for 0.5 s after each one)
    slamDamage: 20,
    stun: 1.5,
  },

  // Jump + attack (hit a mob while in the air) — Sky Splitter: smash the target down into the ground
  jumpAttack: {
    cooldown: 3,
    damage: 7,
    radius: 2.5, // splash around the target
    splashDamage: 3,
    dive: 1.6, // downward push on you
  },

  // Crouch + attack (hit a mob while sneaking) — Low Sweep: sweep the legs in an arc, then launch them up
  crouchAttack: {
    cooldown: 3,
    radius: 3.5,
    arc: 160,
    damage: 6,
    launch: 0.9, // knock-up
    stun: 0.6,
  },
};
