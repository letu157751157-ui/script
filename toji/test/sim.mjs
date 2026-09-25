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

// --- Sneak + right-click: Chain of a Thousand Miles — whirl, then hurl into a mob
tick(10);
clear();
away(zombie);
const spun = new Entity("minecraft:zombie", { x: 5.0, y: 64, z: 0.5 }, 40);
const target = new Entity("minecraft:skeleton", { x: 0.5, y: 64, z: 10.5 }, 40);
player.isSneaking = true;
useItem(player);
tick(2);
check("whirl animation", anims().includes("animation.toji.whirl"));
check("spear leaves the hand at once (chain-only variant)", held(player) === "toji:inverted_spear_thrown", held(player));
tick(CONFIG.chain.release * 20 - 2);
check("whirling spear orbits (spear particles all around)", new Set(log.particles.filter((p) => p.id === "toji:spear").map((p) => Math.sign(Math.round(p.location.x - 0.5)) + "," + Math.sign(Math.round(p.location.z - 0.5)))).size >= 4);
check("whirl hits enemies in the ring", near(damageTo(spun), CONFIG.chain.spinDamage), `${damageTo(spun)}`);
check("whirl knocks them outward", knockbacksOf(spun).some((k) => k.horizontal.x > 0));
check("the far target is not hit by the whirl", damageTo(target) === 0);
tick(8);
check("hurled spear hits the target", near(damageTo(target), CONFIG.chain.damage), `${damageTo(target)}`);
check("target stunned", target.getEffect("slowness")?.amplifier === 255);
check("target yanked toward the player", knockbacksOf(target).some((k) => k.horizontal.z < 0));
check("skills blocked while the spear is out", (useItem(player), !anims().includes("animation.toji.thrust")));
tick(15);
check("spear comes back to the hand", held(player) === "toji:inverted_spear", held(player));
away(spun);

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

// --- Sprint + attack: Heavenly Ambush
clear();
const runner = new Entity("minecraft:zombie", { x: 0.5, y: 64, z: 6.5 }, 60);
player.isSprinting = true;
fire("entityHitBlock", { damagingEntity: player });
tick(2);
check("ambush vanish smoke", log.particles.some((p) => p.id === "toji:vanish"));
check("reappears behind the target", log.teleports.some((t) => t.entity === player.id && near(t.location.z, 6.5 + CONFIG.rush.behind)), JSON.stringify(log.teleports));
check("faces the target", log.teleports.at(-1)?.facing?.z === 6.5);
check("ambush animation", anims().includes("animation.toji.ambush"));
tick(10);
check("X cut damage", near(damageTo(runner), CONFIG.rush.damage * CONFIG.rush.cuts.length), `${damageTo(runner)}`);
check("X cut particle", log.particles.some((p) => p.id === "toji:x_slash"));
check("knocked away from Toji", knockbacksOf(runner).some((k) => k.horizontal.z > 0));
// no target in sight: vanishing dash
player.location = { x: 0.5, y: 64, z: 0.5 };
away(runner);
tick(CONFIG.rush.cooldown * 20);
clear();
fire("entityHitBlock", { damagingEntity: player });
tick(3);
check("no target: vanishing dash", knockbacksOf(player).some((k) => k.horizontal.z >= CONFIG.rush.strength - 1e-6) && log.teleports.length === 0);
player.isSprinting = false;

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

// --- Hold 20 s + jump: Heavenly Rampage (40 cuts across a 20x20 area, then back to the start)
tick(5); // wait for the thrust to finish
clear();
const cfgR = CONFIG.plunge;
const start = { ...player.location };
const crowd = [[6, 6], [-8, 3], [2, -9], [9, -9]].map(([dx, dz]) => new Entity("minecraft:zombie", { x: start.x + dx, y: 64, z: start.z + dz }, 200));
const outside = new Entity("minecraft:zombie", { x: start.x + 14, y: 64, z: start.z }, 200);
fire("playerButtonInput", { player, button: "Jump", newButtonState: "Pressed" });
check("rampage immunity", player.getEffect("resistance")?.amplifier === 4);
check("mobs in the area are pinned", crowd.every((z) => z.getEffect("slowness")?.amplifier === 255));
tick(cfgR.cuts * cfgR.cutInterval + 2);
const hops = log.teleports.filter((t) => t.entity === player.id);
check("runs to every mob", crowd.every((z) => hops.some((t) => Math.hypot(t.location.x - z.location.x, t.location.z - z.location.z) < 2)));
check("40 cuts", hops.length >= cfgR.cuts, `${hops.length}`);
check("jumping cuts from above", hops.some((t) => t.location.y > 65));
check("running + jumping animations", ["cut_a", "cut_b", "leap_cut"].every((n) => anims().includes(`animation.toji.${n}`)));
check("mob outside the 20x20 area untouched", !hops.some((t) => Math.abs(t.location.x - outside.location.x) < 2));
check("back to the starting spot", near(hops.at(-1).location.x, start.x) && near(hops.at(-1).location.z, start.z));
check("landing animation", anims().includes("animation.toji.rampage_end"));
check("no damage before the finale", crowd.every((z) => damageTo(z) === 0));
tick(14);
const perMob = (cfgR.cuts / crowd.length) * cfgR.damagePerCut * CONFIG.awaken.damageMultiplier;
check("every cut lands at once", crowd.every((z) => near(damageTo(z), perMob)), crowd.map(damageTo).join());
check("outside mob not damaged", damageTo(outside) === 0);
tick(12);
check("immunity removed, awakening resistance kept", player.getEffect("resistance")?.amplifier === CONFIG.awaken.resistanceAmplifier);
clear();
fire("playerButtonInput", { player, button: "Jump", newButtonState: "Pressed" });
tick(4);
check("rampage only once per awakening", !anims().includes("animation.toji.cut_a"));
[...crowd, outside].forEach(away);

// --- Letting go of the spear ends the awakening
player.selectedSlotIndex = 3;
tick(5);
check("awakening buffs removed when switching slot", !player.getEffect("speed") && !player.getEffect("strength"));
check("spear in the other slot reverted", player.slots[0].typeId === "toji:inverted_spear", player.slots[0].typeId);
check("lore/durability kept through swaps", player.slots[0].getLore().length === 7);

// --- Letting go mid-rampage: buffs are cleared once it ends (immunity kept meanwhile)
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
check("immunity kept mid-rampage after letting go", player.getEffect("resistance")?.amplifier === 4);
tick(CONFIG.plunge.cuts * CONFIG.plunge.cutInterval + 30);
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
tick(CONFIG.chain.release * 20 + 8);
clear();
useItem(player);
tick(8);
check("stunned player cannot cast", !anims().includes("animation.toji.thrust"));

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
