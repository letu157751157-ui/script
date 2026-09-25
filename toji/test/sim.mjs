// Runs TojiBP/scripts/main.js against a mocked @minecraft/server and walks through every skill.
// Run: node test/sim.mjs   (from the toji folder)
import { register } from "node:module";

register("./loader.mjs", import.meta.url);

const mc = await import("./mock-server.mjs");
const { CONFIG } = await import("../TojiBP/scripts/config.js");
const { log, tick, fire, system, world, dimension, Player, Entity, ItemStack } = mc;

// Keep the 20 s awakening out of the way until its own test
const HOLD_TIME = CONFIG.awaken.holdTime;
CONFIG.awaken.holdTime = 9999;

await import("../TojiBP/scripts/main.js");

let failures = 0;
function check(name, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : "  " + detail}`);
  if (!condition) failures++;
}
const clear = () => Object.values(log).forEach((list) => (list.length = 0));
const anims = () => log.anims.map((a) => a.name);
const damageTo = (e) => log.damage.filter((d) => d.target === e.id).reduce((s, d) => s + d.amount, 0);
const knockbacksOf = (e) => log.knockbacks.filter((k) => k.entity === e.id);
const held = (p) => p.slots[p.selectedSlotIndex]?.typeId;
const useItem = (p) => fire("itemUse", { source: p, itemStack: p.slots[p.selectedSlotIndex] });
const near = (a, b) => Math.abs(a - b) < 1e-6;
const away = (e) => (e.location = { x: 50 + Number(e.id), y: 64, z: 50 });

const player = new Player({ x: 0.5, y: 64, z: 0.5 });
world.players.push(player);
player.slots[0] = new ItemStack("toji:inverted_spear");

// --- First hold: guide, title, lore
tick(5);
check("guide sent on first hold", log.messages.length === 9, `${log.messages.length} messages`);
check("title shown on first hold", log.titles.length === 1);
check("lore written to the spear", player.slots[0].getLore().length === 7);
check("action bar uses translation keys", JSON.stringify(log.actionBars.at(-1)).includes("toji.bar.hold"));

// --- Right-click: Nullifying Thrust
clear();
const zombie = new Entity("minecraft:zombie", { x: 0.5, y: 64, z: 3.5 }, 40);
zombie.addEffect("resistance", 200, { amplifier: 1 });
zombie.addEffect("regeneration", 200);
useItem(player);
tick(CONFIG.thrust.windup * 20 + 1);
check("thrust animation", anims().includes("animation.toji.thrust"));
check("thrust damage", near(damageTo(zombie), CONFIG.thrust.damage), `${damageTo(zombie)}`);
check("thrust nullifies buffs", !zombie.getEffect("resistance") && !zombie.getEffect("regeneration"));
check("thrust lunges the player forward", knockbacksOf(player).some((k) => k.horizontal.z > 0));
check("thrust particles", log.particles.some((p) => p.id === "toji:thrust" && p.molang?.["variable.dir_z"] > 0.9));
tick(5); // wait for the cast to finish
clear();
useItem(player);
tick(5);
check("thrust on cooldown: no second cast", !anims().includes("animation.toji.thrust"));
check("cooldown notice on the bar", JSON.stringify(log.actionBars.at(-1)).includes("toji.notice.cooldown"));

// --- Sneak + right-click: Thousand-Mile Chain hitting a mob
tick(10);
clear();
away(zombie);
const target = new Entity("minecraft:skeleton", { x: 0.5, y: 64, z: 10.5 }, 40);
player.isSneaking = true;
useItem(player);
tick(CONFIG.chain.release * 20);
check("throw animation", anims().includes("animation.toji.throw"));
check("spear leaves the hand (chain-only variant)", held(player) === "toji:inverted_spear_thrown", held(player));
tick(8);
check("chain hits the target", near(damageTo(target), CONFIG.chain.damage), `${damageTo(target)}`);
check("target stunned", target.getEffect("slowness")?.amplifier === 255);
check("target yanked toward the player", knockbacksOf(target).some((k) => k.horizontal.z < 0));
check("skills blocked while the spear is out", (useItem(player), !anims().includes("animation.toji.thrust")));
tick(15);
check("spear comes back to the hand", held(player) === "toji:inverted_spear", held(player));

// --- Chain into a wall: grapple
tick(CONFIG.chain.cooldown * 20);
clear();
away(target);
dimension.solid.add("0,65,6");
useItem(player);
tick(CONFIG.chain.release * 20 + 8);
check("chain grapples to the wall", knockbacksOf(player).some((k) => k.horizontal.z > 0 && k.vertical >= 0.35));
tick(12);
check("spear back after grapple", held(player) === "toji:inverted_spear", held(player));
dimension.solid.clear();
player.isSneaking = false;

// --- Sprint + attack: Heavenly Rush
clear();
const runner = new Entity("minecraft:zombie", { x: 0.5, y: 64, z: 2.5 }, 60);
player.isSprinting = true;
fire("entityHitEntity", { damagingEntity: player, hitEntity: runner });
tick(12);
check("rush animation", anims().includes("animation.toji.rush"));
check("rush dashes forward", knockbacksOf(player).some((k) => k.horizontal.z >= CONFIG.rush.strength - 1e-6));
check("rush 3 slashes land", near(damageTo(runner), CONFIG.rush.damage * CONFIG.rush.slashes), `${damageTo(runner)}`);
check("rush slash particles", log.particles.filter((p) => p.id === "toji:slash").length >= CONFIG.rush.slashes);
player.isSprinting = false;
away(runner);

// --- 4 normal hits: combo finisher
clear();
const dummy = new Entity("minecraft:zombie", { x: 0.5, y: 64, z: 2.5 }, 100);
for (let i = 0; i < 4; i++) {
  fire("entityHitEntity", { damagingEntity: player, hitEntity: dummy });
  tick(6);
}
tick(CONFIG.combo.finisherDelay * 20);
check("combo finisher on the 4th hit", anims().filter((a) => a === "animation.toji.finisher").length === 1, anims().join());
check("finisher damage + knockback", near(damageTo(dummy), CONFIG.combo.damage) && knockbacksOf(dummy).length > 0, `${damageTo(dummy)}`);
away(dummy);

// --- Hold 20 s: awakening (restart the timer by switching slot, then count exactly)
player.selectedSlotIndex = 1;
tick(5);
player.selectedSlotIndex = 0;
CONFIG.awaken.holdTime = HOLD_TIME;
clear();
tick(HOLD_TIME * 20 - 10);
check("not awakened before 20 s", !anims().includes("animation.toji.awaken"));
tick(15);
check("awakened after holding 20 s", anims().includes("animation.toji.awaken"));
check("awakened spear variant", held(player) === "toji:inverted_spear_awakened", held(player));
check("awakening buffs", ["speed", "strength", "jump_boost", "resistance"].every((id) => player.getEffect(id)));
check("awakening title", JSON.stringify(log.titles).includes("toji.title.awaken"));

// Awakened thrust: x1.3 damage, half cooldown
clear();
const victim = new Entity("minecraft:zombie", { x: 0.5, y: 64, z: 3.5 }, 80);
useItem(player);
tick(CONFIG.thrust.windup * 20 + 1);
check("awakened thrust deals x1.3", near(damageTo(victim), CONFIG.thrust.damage * CONFIG.awaken.damageMultiplier), `${damageTo(victim)}`);
away(victim);

// --- Hold 20 s + jump: Heaven-Splitting Plunge
tick(5); // wait for the thrust to finish
clear();
const crowd = [0, 1, 2].map((i) => new Entity("minecraft:zombie", { x: 2 + i, y: 64, z: 1 }, 80));
fire("playerButtonInput", { player, button: "Jump", newButtonState: "Pressed" });
check("plunge animation", anims().includes("animation.toji.plunge"));
check("plunge immunity", player.getEffect("resistance")?.amplifier === 4);
tick(3);
player.isOnGround = false;
check("plunge leap", knockbacksOf(player).some((k) => k.vertical === CONFIG.plunge.leap));
tick(CONFIG.plunge.diveAt * 20);
check("plunge dives down", knockbacksOf(player).some((k) => k.vertical === -CONFIG.plunge.diveSpeed));
check("no damage before landing", crowd.every((z) => damageTo(z) === 0));
player.isOnGround = true;
tick(2);
const plungeDamage = CONFIG.plunge.damage * CONFIG.awaken.damageMultiplier;
check("plunge hits everyone in range", crowd.every((z) => near(damageTo(z), plungeDamage)), crowd.map(damageTo).join());
check("plunge crater + rings", ["toji:crack", "toji:shock_ring", "toji:null_ground"].every((id) => log.particles.some((p) => p.id === id)));
tick(12);
check("plunge immunity removed, awakening resistance kept", player.getEffect("resistance")?.amplifier === CONFIG.awaken.resistanceAmplifier);
clear();
fire("playerButtonInput", { player, button: "Jump", newButtonState: "Pressed" });
check("plunge only once per awakening", !anims().includes("animation.toji.plunge"));
crowd.forEach(away);

// --- Letting go of the spear ends the awakening
player.selectedSlotIndex = 3;
tick(5);
check("awakening buffs removed when switching slot", !player.getEffect("speed") && !player.getEffect("strength"));
check("spear in the other slot reverted", player.slots[0].typeId === "toji:inverted_spear", player.slots[0].typeId);
check("lore/durability kept through swaps", player.slots[0].getLore().length === 7);

// --- Letting go mid-plunge: buffs are cleared once landed (immunity kept while falling)
player.selectedSlotIndex = 0;
CONFIG.awaken.holdTime = 1;
tick(25);
CONFIG.awaken.holdTime = HOLD_TIME;
check("awakened again", held(player) === "toji:inverted_spear_awakened", held(player));
tick(40);
fire("playerButtonInput", { player, button: "Jump", newButtonState: "Pressed" });
player.isOnGround = false;
tick(4);
player.selectedSlotIndex = 3;
tick(5);
check("immunity kept while falling after letting go", player.getEffect("resistance")?.amplifier === 4);
tick(CONFIG.plunge.diveAt * 20);
player.isOnGround = true;
tick(15);
check("buffs cleared after landing", !player.getEffect("speed") && !player.getEffect("resistance"));

// --- Stunned players cannot cast
player.selectedSlotIndex = 0;
tick(CONFIG.thrust.cooldown * 20);
clear();
const other = new Player({ x: 5, y: 64, z: 5 });
world.players.push(other);
other.slots[0] = new ItemStack("toji:inverted_spear");
other.view = { x: -1, y: 0, z: 0 };
tick(5);
// the other Toji throws his chain into us and stuns us
player.location = { x: 0.5, y: 64, z: 5.5 };
other.location = { x: 8.5, y: 64, z: 5.5 };
other.isSneaking = true;
useItem(other);
tick(12);
clear();
useItem(player);
tick(8);
check("stunned player cannot cast", !anims().includes("animation.toji.thrust"));

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
