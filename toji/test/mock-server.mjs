// Minimal mock of the @minecraft/server API surface used by TojiBP/scripts/main.js.
// It runs the real script in Node so skill flows can be exercised without the game (see sim.mjs).
// Physics are not simulated: knockback, particles, sounds and animations are recorded for assertions.

export const log = { particles: [], sounds: [], anims: [], knockbacks: [], damage: [], titles: [], actionBars: [], messages: [], teleports: [] };

const handlers = {};
function signal(name) {
  handlers[name] = [];
  return { subscribe: (fn) => (handlers[name].push(fn), fn), unsubscribe: () => {} };
}
export function fire(name, event) {
  for (const fn of handlers[name] ?? []) fn(event);
}

// ---------------------------------------------------------------- system
const jobs = new Map(); // id -> { at, fn, interval }
let nextJob = 1;
export const system = {
  currentTick: 0,
  run(fn) {
    return system.runTimeout(fn, 0);
  },
  runTimeout(fn, delay = 1) {
    const id = nextJob++;
    jobs.set(id, { at: system.currentTick + Math.max(0, delay), fn });
    return id;
  },
  runInterval(fn, interval = 1) {
    const id = nextJob++;
    jobs.set(id, { at: system.currentTick + interval, fn, interval });
    return id;
  },
  clearRun(id) {
    jobs.delete(id);
  },
  afterEvents: { scriptEventReceive: signal("scriptEventReceive") },
};

export function tick(count = 1) {
  for (let i = 0; i < count; i++) {
    system.currentTick++;
    for (const [id, job] of [...jobs].sort((a, b) => a[0] - b[0])) {
      if (!jobs.has(id) || job.at > system.currentTick) continue;
      if (job.interval) job.at += job.interval;
      else jobs.delete(id);
      job.fn();
    }
  }
}

// ---------------------------------------------------------------- enums / classes
export const EquipmentSlot = { Mainhand: "Mainhand" };
export const InputButton = { Jump: "Jump", Sneak: "Sneak" };
export const ButtonState = { Pressed: "Pressed", Released: "Released" };
export const EntityDamageCause = { entityAttack: "entityAttack" };

export class MolangVariableMap {
  constructor() {
    this.values = {};
  }
  setFloat(name, value) {
    this.values[name] = value;
  }
}

export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId;
    this.amount = amount;
    this.nameTag = undefined;
    this.lore = [];
    this.durability = { damage: 0 };
    this.enchantable = { list: [], getEnchantments: () => this.enchantable.list, addEnchantments: (l) => this.enchantable.list.push(...l) };
  }
  getLore() {
    return [...this.lore];
  }
  setLore(lore) {
    this.lore = [...(lore ?? [])];
  }
  getComponent(id) {
    if (id === "minecraft:durability") return this.durability;
    if (id === "minecraft:enchantable") return this.enchantable;
    return undefined;
  }
}

// ---------------------------------------------------------------- world, dimension, entities
export const dimension = {
  entities: [],
  solid: new Set(), // "x,y,z" of solid blocks
  spawnParticle(id, location, molang) {
    log.particles.push({ id, location, molang: molang?.values });
  },
  playSound(id, location, options) {
    log.sounds.push({ id, location, ...options });
  },
  getBlock(l) {
    const key = `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;
    return { isAir: !this.solid.has(key), isLiquid: false, typeId: this.solid.has(key) ? "minecraft:stone" : "minecraft:air" };
  },
  getEntities({ location, maxDistance, excludeTypes = [] }) {
    return this.entities.filter((e) => {
      if (!e.isValid || excludeTypes.includes(e.typeId)) return false;
      const d = Math.hypot(e.location.x - location.x, e.location.y - location.y, e.location.z - location.z);
      return d <= maxDistance;
    });
  },
};

let nextEntity = 1;
export class Entity {
  constructor(typeId, location, health = 20) {
    this.id = String(nextEntity++);
    this.typeId = typeId;
    this.location = { ...location };
    this.isValid = true;
    this.health = { currentValue: health, effectiveMax: health, setCurrentValue: (v) => (this.health.currentValue = v) };
    this.effects = new Map();
    this.invulnerableUntil = -1;
    this.dimension = dimension;
    dimension.entities.push(this);
  }
  getComponent(id) {
    if (id === "minecraft:health") return this.health;
    return undefined;
  }
  applyDamage(amount, options) {
    // Mobs ignore damage for 10 ticks after being hurt, like the game
    if (system.currentTick < this.invulnerableUntil) return false;
    this.invulnerableUntil = system.currentTick + 10;
    this.health.currentValue -= amount;
    log.damage.push({ target: this.id, amount, by: options?.damagingEntity?.id, tick: system.currentTick });
    return true;
  }
  applyKnockback(horizontal, vertical) {
    log.knockbacks.push({ entity: this.id, horizontal, vertical, tick: system.currentTick });
  }
  addEffect(id, duration, options) {
    this.effects.set(id, { duration, amplifier: options?.amplifier ?? 0 });
  }
  getEffect(id) {
    return this.effects.get(id);
  }
  removeEffect(id) {
    return this.effects.delete(id);
  }
  setOnFire() {}
  teleport(location, options) {
    this.location = { ...location };
    log.teleports.push({ entity: this.id, location: { ...location }, facing: options?.facingLocation });
  }
}

export class Player extends Entity {
  constructor(location) {
    super("minecraft:player", location);
    this.isSneaking = false;
    this.isSprinting = false;
    this.isOnGround = true;
    this.selectedSlotIndex = 0;
    this.view = { x: 0, y: 0, z: 1 };
    this.slots = new Array(36).fill(undefined);
    const player = this;
    this.container = {
      size: 36,
      getItem: (i) => player.slots[i],
      setItem: (i, item) => (player.slots[i] = item),
    };
    this.equippable = {
      getEquipment: () => player.slots[player.selectedSlotIndex],
      setEquipment: (_, item) => (player.slots[player.selectedSlotIndex] = item),
    };
    this.onScreenDisplay = {
      setActionBar: (text) => log.actionBars.push({ player: player.id, text }),
      setTitle: (title, options) => log.titles.push({ title, options }),
    };
    this.camera = { fade: () => {} };
    this.gameMode = "Survival";
  }
  getGameMode() {
    return this.gameMode;
  }
  applyDamage(amount, options) {
    // The world's PvP setting blocks damage between players
    if (options?.damagingEntity?.typeId === "minecraft:player" && !world.pvp) return false;
    return super.applyDamage(amount, options);
  }
  getComponent(id) {
    if (id === "minecraft:equippable") return this.equippable;
    if (id === "minecraft:inventory") return { container: this.container };
    return super.getComponent(id);
  }
  getViewDirection() {
    return { ...this.view };
  }
  getHeadLocation() {
    return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z };
  }
  getEntitiesFromViewDirection() {
    return [];
  }
  playAnimation(name) {
    log.anims.push({ player: this.id, name, tick: system.currentTick });
  }
  playSound() {}
  sendMessage(message) {
    log.messages.push(message);
  }
  runCommand() {}
}

export const world = {
  pvp: true,
  players: [],
  getAllPlayers: () => world.players.filter((p) => p.isValid),
  afterEvents: {
    entityHitEntity: signal("entityHitEntity"),
    entityHitBlock: signal("entityHitBlock"),
    itemUse: signal("itemUse"),
    playerButtonInput: signal("playerButtonInput"),
    playerLeave: signal("playerLeave"),
  },
  beforeEvents: {
    playerInteractWithBlock: signal("playerInteractWithBlock"),
    playerInteractWithEntity: signal("playerInteractWithEntity"),
  },
};
