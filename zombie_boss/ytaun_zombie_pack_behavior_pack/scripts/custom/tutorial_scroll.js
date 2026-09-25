import { world, system } from '@minecraft/server';
import { ActionFormData, MessageFormData } from '@minecraft/server-ui';

// ─────────────────────────────────────────────
//  GUIDE BOOK — Chaotic World v1.2.1
// ─────────────────────────────────────────────

system.beforeEvents.startup.subscribe(initEvent => {
    initEvent.itemComponentRegistry.registerCustomComponent('ytaun_tutorial_scroll:trigger', {
        onUse: ({ source }) => {
            if (source?.typeId !== 'minecraft:player') return;
            system.run(() => openMainMenu(source));
        }
    });
});

// ═══════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════
function showDetail(player, title, body, backFn) {
    new MessageFormData()
        .title(title)
        .body(body)
        .button1('§7Back')
        .button2('§8Close')
        .show(player)
        .then(res => { if (res.selection === 0) backFn(player); })
        .catch(() => {});
}

// ═══════════════════════════════════════════
//  MAIN MENU
// ═══════════════════════════════════════════
function openMainMenu(player) {
    new ActionFormData()
        .title('§l§6Chaotic World Guide')
        .body('§7Select a category:')
        .button('§cBosses')
        .button('§bOres and Materials')
        .button('§fArmor Sets')
        .button('§aMobs and Enemies')
        .button('§eWeapons')
        .button('§dItems and Consumables')
        .button('§6Progression Guide')
        .button('§8Close')
        .show(player)
        .then(res => {
            if (res.canceled || res.selection == null || res.selection === 7) return;
            const menus = [openBossMenu, openOreMenu, openArmorMenu, openMobMenu, openWeaponMenu, openItemMenu, openProgressionMenu];
            menus[res.selection](player);
        }).catch(() => {});
}

// ═══════════════════════════════════════════
//  BOSS MENU
// ═══════════════════════════════════════════
function openBossMenu(player) {
    new ActionFormData()
        .title('§l§cBosses')
        .body('§7Select a boss:')
        .button('§eGiant Zombie')
        .button('§bYeti Boss')
        .button('§aDiamond Golem')
        .button('§cRobot Crab')
        .button('§3Iceron Golem V1')
        .button('§bIceron Golem V2')
        .button('§7Back')
        .show(player)
        .then(res => {
            if (res.canceled || res.selection == null) return;
            if (res.selection === 6) { openMainMenu(player); return; }
            const titles = ['§l§eGiant Zombie', '§l§bYeti Boss', '§l§aDiamond Golem', '§l§cRobot Crab', '§l§3Iceron Golem V1', '§l§bIceron Golem V2'];
            const details = [bossGiantZombie, bossYeti, bossDiamondGolem, bossRobotCrab, bossIceronV1, bossIceronV2];
            showDetail(player, titles[res.selection], details[res.selection], openBossMenu);
        }).catch(() => {});
}

const bossGiantZombie =
`§e── STATS ──
§7Phase 1 — ID: §fpa:giant_zombie
§7HP: §f150 | ATK: §f6
§7Phase 2 — ID: §fpa:giant_zombie_phase2
§7HP: §f400 | ATK: §f6
§7Spawn: §fDoes not spawn naturally.
§7Must be summoned via Spawn Egg.

§e── HOW TO SUMMON ──
§71. Farm §eZombie General §8(pa:zombie_geneal)§7:
§7   Overworld — night only
§7   HP: 35 | ATK: 6
§7   zombie_heart — 10% drop
§7   thitthoiran   — 10% drop
§7   Also drops iron, gold, diamond (each 10%)
§72. Craft §eGiant Zombie Spawn Egg§7:
§7   zombie_heart + thitthoiran
§7   + iron_block + iron_ingot
§7   + zombie_head
§73. Place the Egg on the ground.

§e── PHASE 2 DROPS ──
§7Pool A (1 roll): §fhandgiantzombie §850%
§7                §fzombie_head §850%
§7Pool B (1 roll): §fPick 1 from the following:
§7   diamond_block — 8.3%
§7   diamond       — 8.3%
§7   iron_block    — 8.3%
§7   iron_ingot    — 8.3%
§7   gold_ingot    — 8.3%
§7   rotten_flesh, wheat, carrot (junk) — 25%
§7Pool C: ~15 rotten_flesh / spider_eye

§e── HOW TO USE DROPS ──
§7handgiantzombie — crafting material for
§7                  the Zombie Axe (9 DMG)
§c Tip: Fastest early-game source of
§7     diamond and diamond_block.`;

const bossYeti =
`§e── STATS ──
§7Phase 1 — ID: §fpa:yeti
§7HP: §b700 | ATK: §f8
§7Phase 2 — ID: §fpa:yeti_phase_2
§7HP: §b500 | ATK: §c14
§7Phase 3 — ID: §fpa:yeti_phase3
§7HP: §b500 | ATK: §c10
§7Death Phase — ID: §fpa:yeti_phase_death
§7HP: §750 §7(finishing phase, drops loot)
§7Spawn: §fDoes not spawn naturally.

§e── HOW TO SUMMON ──
§71. Get §bfrozen_heart_piece§7:
§7   • Farm §bYeti Boss Pet Riu §8(pa:yeti_boss_pet_riu)§7
§7     — 8.3% drop per kill
§7   • OR buy from §bIce Villager Tier 5§7:
§7     netherite_ingot x1 + blue_ice x18
§72. Craft §eyeti_core§7:
§7   soul + big_yeti_fur + blue_ice + core
§7   (big_yeti_fur = white_wool + yeti_fur)
§73. Craft §efrozen_heart§7:
§7   frozen_heart_piece + yeti_core
§74. Craft §eYeti Boss Spawn Egg§7:
§7   powder_snow_bucket + diamond_block
§7   + big_yeti_fur + frozen_heart + netherite

§e── DROPS (death phase) ──
§7Pool A (8 rolls, 1 entry):
§7   iceore x8 — §a100% guaranteed
§7Pool B (15 rolls, 4 entries):
§7   ice / blue_ice / packed_ice / frosted_ice
§7   25% each per roll — avg 3-4 of each
§7Pool C (10 rolls, 3 entries):
§7   yeti_fur  — ~33% per roll (avg ~3)
§7   yeti_meat — ~33% per roll (avg ~3)
§7   leather   — ~33% per roll (avg ~3)

§c Tip: iceore is the key material for
§7     the entire Frozen gear chain.`;

const bossDiamondGolem =
`§e── STATS ──
§7ID:  §fytaun:diamond_golem
§7HP:  §a300 | ATK: §c13
§7Spawn: §fDoes not spawn naturally.

§e── HOW TO SUMMON ──
§7Craft §aDiamond Golem Spawn Egg§7:
§7   carved_pumpkin + diamond_block
§7Place the Egg on the ground to summon.

§e── DROPS ──
§7Pool A (6 rolls, 1 entry):
§7   diamond x6 — §a100% guaranteed
§7Pool B (1 roll, 1 entry):
§7   sunflower x1 — §a100% guaranteed

§e── USAGE ──
§7By far the most efficient source of
§7diamonds in the mid-game.
§7Craft many Eggs back-to-back to mass-farm.
§7carved_pumpkin + diamond_block is cheap
§7once you have an initial diamond supply.

§c Note: ATK 13 is very high.
§7Wear at least iron or emerald armor.`;

const bossRobotCrab =
`§e── STATS ──
§7ID:  §fytaun:robot_crab
§7HP:  §c350 | ATK: §c10
§7Spawn: §fDoes not spawn naturally.

§e── HOW TO SUMMON ──
§71. Farm §eMini Crab §8(pa:mini_crab_2)§7:
§7   Overworld — HP: 22 | ATK: 2
§7   Drop rates per kill:
§7   crab_lower_body — 16.7%
§7   crab_leg        — 16.7%
§7   iron_ingot      — 16.7%
§7   redstone        — 16.7%
§7   core            — 7.1% (second pool)
§72. Also need: §fcrab_upper_body, crab_hand
§7   §8(craft or obtain crab_upper_body
§7   and crab_hand separately)
§73. Craft §cRobot Crab Spawn Egg§7:
§7   crab_leg + crab_upper_body + crab_hand
§7   + crab_core + crab_lower_body

§e── DROPS ──
§7Pool A (6 rolls, 1 entry):
§7   red_ore_piece x6 — §a100% guaranteed
§7Pool B (5 rolls, 4 entries — 25% each):
§7   iron_block    — avg 1-2 per kill
§7   iron_ingot    — avg 1-2 per kill
§7   redstone      — avg 1-2 per kill
§7   redstone_block — avg 1-2 per kill

§e── RED ORE CHAIN ──
§7red_ore_piece + steel_ingot
§7   Craft => red_ore
§7   Smelt  => §cred_steel
§7red_steel => Crab Armor Set (highest tier)
§7           => Crab Sword (8 DMG)
§7           §8(requires Super Smithing Update)`;

const bossIceronV1 =
`§e── STATS ──
§7ID:  §fpa:iceron_golem
§7HP:  §3450 | ATK: §f8
§7Spawn: §fSpecial event / manual summon.

§e── HOW TO SUMMON ──
§7No Spawn Egg available for crafting.
§7Use the command:
§7   §a/summon pa:iceron_golem

§e── DROPS ──
§7   ice, string, turtle_shell_piece

§e── RECOMMENDED GEAR ──
§7ATK 8 is manageable with full iron or
§7an Obsidian Set.
§7Frozen Set is ideal for comfort.`;

const bossIceronV2 =
`§e── STATS ──
§7ID:  §fpa:iceron_golem_v2
§7HP:  §b600 | ATK: §c18 §l(HIGHEST IN GAME!)
§7Spawn: §fSpecial event / manual summon.

§e── HOW TO SUMMON ──
§7No Spawn Egg available for crafting.
§7Use the command:
§7   §a/summon pa:iceron_golem_v2

§e── DROPS ──
§7   ice, string, turtle_shell_piece

§e── WARNING ──
§cATK 18 is extremely dangerous.
§7You will be near-instakilled without
§7strong armor. Minimum requirement:
§7   Full §bFrozen Set§7 (all 4 pieces).
§7Recommended:
§7   §cCrab Set §7or higher.
§7Do not attempt without full preparation.`;

// ═══════════════════════════════════════════
//  ORE & MATERIALS MENU
// ═══════════════════════════════════════════
function openOreMenu(player) {
    new ActionFormData()
        .title('§l§bOres and Materials')
        .body('§7Select a material:')
        .button('§bIce Ore')
        .button('§cRed Ore')
        .button('§fSteel Ingot and Tast Iron')
        .button('§bFrozen Steel (full chain)')
        .button('§cFire Dust and Fire Jade')
        .button('§5Ender Dust and Ender Jade')
        .button('§eCrafting Templates')
        .button('§7Back')
        .show(player)
        .then(res => {
            if (res.canceled || res.selection == null) return;
            if (res.selection === 7) { openMainMenu(player); return; }
            const titles = ['§l§bIce Ore', '§l§cRed Ore', '§l§fSteel and Tast Iron', '§l§bFrozen Steel Chain', '§l§cFire Dust and Fire Jade', '§l§5Ender Dust and Ender Jade', '§l§eCrafting Templates'];
            const details = [oreIce, oreRed, oreSteel, oreFrozen, oreFire, oreEnder, oreTemplates];
            showDetail(player, titles[res.selection], details[res.selection], openOreMenu);
        }).catch(() => {});
}

const oreIce =
`§e── HOW TO OBTAIN ──
§7Method 1: Kill §bYeti Boss§7 (final death phase)
§7   iceore x8 — guaranteed every kill
§7Method 2: Kill §bYeti §8(pa:yeti, common variant)
§7   iceore — part of loot pool (~5%)
§7Method 3: §bIce Villager§7 trade Tier 6:
§7   Sell: iceore x1 => buy: blue_ice x10

§e── SMELTING CHAIN ──
§7Step 1 — Craft raw ice steel:
§7   steel_ingot + iceore + yeti_fur
§7   Craft table => §frawicesteel
§7Step 2 — Smelt:
§7   rawicesteel in Furnace => §bicesteel

§e── WHAT YOU CAN MAKE ──
§7From icesteel:
§7   rawfrozensteel (see Frozen Steel entry)
§7   => frozensteel after smelting

§7From frozensteel:
§7   Frozen Armor Set §8(4 pieces)
§7   Frozenscythe §8(9 DMG)
§7   Frizenscythe §8(12 DMG — with fire_jade)
§7   Frozendscythe §8(12 DMG — with ender_jade)`;

const oreRed =
`§e── HOW TO OBTAIN ──
§7Kill §cRobot Crab Boss§7:
§7   red_ore_piece x6 — §a100% guaranteed
§7   Robot Crab is summoned via Spawn Egg
§7   crafted from Mini Crab (pa:mini_crab_2)
§7   parts (see Bosses > Robot Crab)

§e── SMELTING CHAIN ──
§7Step 1 — Combine materials:
§7   red_ore_piece + steel_ingot
§7   Craft table => §fred_ore
§7Step 2 — Smelt:
§7   red_ore in Furnace => §cred_steel

§e── WHAT YOU CAN MAKE ──
§7All require §eSuper Smithing Update template§7:
§7   Crab Helmet  §8(iron base)
§7   Crab Chestplate §8(iron base + crab_leg)
§7   Crab Leggings §8(netherite base)
§7   Crab Boots   §8(iron base)
§7   Crab Sword   §8(8 DMG)

§c Crab Set is the highest craftable tier.`;

const oreSteel =
`§e── STEEL INGOT ──
§7Craft in any table:
§7   iron_ingot + coal => §fraw_steel
§7Smelt raw_steel => §fsteel_ingot

§e── TAST IRON INGOT ──
§7A special variant of iron ingot.
§7Crafted similarly to raw_steel but with
§7a different combination (check recipe book).
§7Used alongside steel_ingot in weapons.

§e── STEEL STICK ──
§7   steel_ingot + tast_iron_ingot
§7   => §fsteel_stick
§7Acts as the handle for high-tier weapons.
§7Required for: Frozenscythe, Frizenscythe,
§7             Frozendscythe, Steel Sword

§e── DARK INGOTS (from Steel) ──
§7   soul + steel_ingot
§7   => §5dark_soul_ingot
§7   soul + tast_iron_ingot
§7   => §5dark_night_ingot
§7Both used in Dark Night Set and
§7Harvester Scythe crafting.

§e── WHAT STEEL MAKES ──
§7   Steel Sword §8(7 DMG)
§7   Steel Stick §8(weapon handle)
§7   Raw Ice Steel §8(=> icesteel => frozensteel)
§7   Red Ore §8(+ red_ore_piece)`;

const oreFrozen =
`§e── FULL FROZEN STEEL CHAIN ──

§7[1] §fsteel_ingot
§7    iron_ingot + coal => raw_steel => smelt

§7[2] §bicesteel
§7    steel_ingot + iceore + yeti_fur
§7    => rawicesteel => §aSmelt

§7[3] §b§lfrozensteel §8(final tier)
§7    icesteel + diamond + netherite_scrap
§7    => rawfrozensteel => §aSmelt

§e── SOURCES FOR iceore ──
§7   Yeti Boss death phase — guaranteed x8
§7   Yeti (normal) — ~5% drop

§e── SOURCES FOR yeti_fur ──
§7   Yeti Boss death phase — ~33% per 10 rolls
§7   Yeti Boss Pet Riu — 20% drop

§e── WHAT frozensteel MAKES ──
§7All require §eUtrasmithing template§7
§7and §fbig_yeti_fur §8(= white_wool + yeti_fur)§7:
§7   Frozen Helmet / Chestplate / Leggings / Boots
§7   (each uses netherite armor as base)

§7Weapons from frozensteel chain:
§7   Frozenscythe §8(9 DMG)
§7   Frizenscythe §8(12 DMG, needs fire_jade)
§7   Frozendscythe §8(12 DMG, needs ender_jade)`;

const oreFire =
`§e── HOW TO GET firefeather ──
§7Kill §cPhoenixx §8(pa:phoenixx)§7:
§7   Nether — HP: 22 | ATK: 2
§7   firefeather — drops on kill (rate unknown,
§7                 farm until you have enough)
§7   Also drops: nether_wart, nether_wart_block

§e── CRAFT CHAIN ──
§7Step 1 — Craft compressedfire:
§7   magma_cream + coal_block
§7   => §ccompressedfire

§7Step 2 — Craft fire_dust:
§7   firefeather + blaze_rod + compressedfire
§7   => §cfire_dust

§7Step 3 — Craft fire_jade §8(rare material):
§7   fire_dust + diamond + netherite_ingot
§7   + nether_star
§7   => §c§lfire_jade

§e── WHAT fire_jade IS FOR ──
§7   fire_dust + netherite_ingot
§7   + frozenscythe + steel_stick + fire_jade
§7   => §c§lFrizenscythe §8(12 DMG — endgame weapon)

§7Also used in:
§7   Blessing from the Hell §8(see Items menu)`;

const oreEnder =
`§e── HOW TO GET ENDER MATERIALS ──
§7Kill §dHarvester §8(pa:the_harvester)§7:
§7   The End — HP: 500 | ATK: 11
§7   §cRequires at least full Frozen Set!
§7   Pool A (1 roll, 3 entries):
§7      reaper_skull — 33.3%
§7      ender_dust   — 33.3%
§7      end_stone    — 33.3%
§7   Pool B (8 rolls, 1 entry):
§7      soul — §a100% guaranteed x8

§e── CRAFT ender_dust (alternate) ──
§7   ender_eye + soul + shulker_shell
§7   => §5ender_dust

§e── CRAFT ender_jade §8(rare material) ──
§7   ender_dust + amethyst_shard
§7   + netherite_ingot + nether_star
§7   => §5§lender_jade

§e── WHAT ender_jade IS FOR ──
§7   ender_dust + netherite_ingot
§7   + frozenscythe + ender_jade + steel_stick
§7   => §5§lFrozendscythe §8(12 DMG — endgame weapon)

§e── WHAT soul IS FOR ──
§7   soul + steel_ingot    => dark_soul_ingot
§7   soul + tast_iron_ingot => dark_night_ingot
§7   => Dark Armor Set, Harvester Scythe
§7   Also used in yeti_core (Yeti Egg craft)`;

const oreTemplates =
`§e── CRAFTING TEMPLATES ──

§fChange Mithing Template §8(pa:change_mithing)
§7Used for: Obsidian Armor Set,
§7          Long Obsidian Sword

§fUtrasmithing Template §8(pa:utrasmithing)
§7Used for: Frozen Armor Set (all 4 pieces),
§7          Frozenscythe

§fUtra Change Smithing §8(pa:utra_change_smithing)
§7Used for: Frozen Hat,
§7          Frozemeral Chestplate

§fSuper Smithing Update §8(pa:super_smithing_update)
§7Used for: Crab Armor Set (all 4 pieces),
§7          Dark Night Set (all 4 pieces),
§7          Candy Scythe, Harvester Scythe

§e── HOW TO OBTAIN ──
§7Most templates are craftable items.
§7Check the recipe book in-game for the
§7exact ingredient layout.
§7Some may require specific boss drops
§7or endgame materials.`;

// ═══════════════════════════════════════════
//  ARMOR MENU
// ═══════════════════════════════════════════
function openArmorMenu(player) {
    new ActionFormData()
        .title('§l§fArmor Sets')
        .body('§7Select an armor set:')
        .button('§aEmerald Set')
        .button('§8Obsidian Set')
        .button('§bFrozen Set')
        .button('§5Dark Night Set')
        .button('§cCrab Set')
        .button('§eSpecial Helmets and Hybrid')
        .button('§7Back')
        .show(player)
        .then(res => {
            if (res.canceled || res.selection == null) return;
            if (res.selection === 6) { openMainMenu(player); return; }
            const titles = ['§l§aEmerald Set', '§l§8Obsidian Set', '§l§bFrozen Set', '§l§5Dark Night Set', '§l§cCrab Set', '§l§eSpecial Helmets and Hybrid'];
            const details = [armorEmerald, armorObsidian, armorFrozen, armorDark, armorCrab, armorSpecial];
            showDetail(player, titles[res.selection], details[res.selection], openArmorMenu);
        }).catch(() => {});
}

const armorEmerald =
`§e── TIER OVERVIEW ──
§7Difficulty: §aEasy §7| Tier: §aEarly game
§7A straightforward starter set.
§7Good to bridge between iron and Obsidian.

§e── BASE CRAFT ──
§7Each piece is crafted from §aeralds §7using
§7the standard armor shape.
§7Helmet / Chestplate / Leggings / Boots

§e── UPGRADES ──
§7Ugage Emerald Helmet:
§7   Upgrade the base helmet at smithing table

§7Ultimate Emerald Helmet:
§7   Utrasmithing template + frozensteel
§7   + iceore + ugage_emeral_helmet
§7   (requires farming Yeti Boss for frozensteel)

§e── NOTES ──
§7This set is the easiest to obtain early on.
§7Not strong enough for Yeti Boss.
§7Replace with Obsidian Set as soon as possible.`;

const armorObsidian =
`§e── TIER OVERVIEW ──
§7Difficulty: §eModerate §7| Tier: §eMid-game
§7Mid-tier armor. Good against most Overworld
§7and early Nether content.

§e── REQUIRED MATERIALS ──
§7   obsidian_sharp
§7   §8(craft: 4 obsidian => obsidian_sharp)
§7   bigobsidian_shard
§7   §8(craft: multiple obsidian_sharp)
§7   Change Mithing Template §8(pa:change_mithing)
§7   blaze_rod §8(vanilla)

§e── CRAFT EACH PIECE ──
§7Helmet:
§7   obsidian_sharp + bigobsidian_shard
§7Chestplate:
§7   obsidian_sharp + bigobsidian_shard
§7   + Change Mithing template
§7Leggings and Boots: similar pattern.

§e── HOW TO GET obsidian_sharp ──
§7Method 1: Craft from 4 obsidian (any crafting)
§7Method 2: Farm §fBlack Death §8(pa:blackdeath2)§7:
§7   Overworld — night only
§7   HP: 45 | ATK: 7
§7   obsidian_sharp — drops ~50% per roll
§7   (5 rolls per kill = avg 2-3 per kill)`;

const armorFrozen =
`§e── TIER OVERVIEW ──
§7Difficulty: §cHard §7| Tier: §cHigh
§7Required before entering The End.
§7Minimum gear vs Iceron V2 and Harvester.

§e── REQUIRED MATERIALS ──
§7   frozensteel §8(see Ores > Frozen Steel chain)
§7   Utrasmithing template §8(pa:utrasmithing)
§7   big_yeti_fur §8(white_wool + yeti_fur)
§7   A netherite armor piece §8(as base for each)

§e── CRAFT EACH PIECE ──
§7Helmet:
§7   Utrasmithing + frozensteel
§7   + netherite_helmet + big_yeti_fur
§7Chestplate:
§7   Utrasmithing + frozensteel
§7   + netherite_chestplate + big_yeti_fur
§7Leggings: same pattern with netherite_leggings
§7Boots:    same pattern with netherite_boots

§e── MATERIAL SOURCES ──
§7frozensteel: steel => icesteel => frozensteel
§7             (full chain in Ores menu)
§7yeti_fur:    Yeti Boss death phase ~33%/10 rolls
§7             Yeti Boss Pet Riu — 20%

§c You need to kill Yeti Boss many times.`;

const armorDark =
`§e── TIER OVERVIEW ──
§7Difficulty: §cHard §7| Tier: §cHigh (parallel to Frozen)
§7End-game tier requiring Harvester farming.

§e── REQUIRED MATERIALS ──
§7   dark_night_ingot §8(soul + tast_iron_ingot)
§7   dark_soul_ingot  §8(soul + steel_ingot)
§7   Super Smithing Update template
§7   netherite armor §8(as base for each piece)

§e── HOW TO GET soul ──
§7Farm §dHarvester §8(pa:the_harvester)§7:
§7   The End — HP: 500 | ATK: 11
§7   soul x8 — §a100% guaranteed every kill
§7   §cRequires full Frozen Set minimum!

§e── CRAFT EACH PIECE ──
§7Each piece uses:
§7   Super Smithing Update + dark_night_ingot
§7   + dark_soul_ingot + netherite base piece

§e── HOW TO GET dark ingots ──
§7   soul + steel_ingot    => dark_soul_ingot
§7   soul + tast_iron_ingot => dark_night_ingot

§e── DARK NIGHT APPLE ──
§7Craftable food from this set's materials.
§7Effects on eat: Fire Resistance II (10 min),
§7   Health Boost V, Night Vision, Regen IV,
§7   Resistance II, Saturation III, Slow Falling,
§7   Speed II. Removes all negative effects.
§7   (see Items menu for craft)`;

const armorCrab =
`§e── TIER OVERVIEW ──
§7Difficulty: §4Very Hard §7| Tier: §4Highest craftable
§7Best craftable armor in the addon.

§e── REQUIRED MATERIALS ──
§7   red_steel §8(from Robot Crab Boss drops)
§7   Super Smithing Update template
§7   crab_leg §8(from Mini Crab, 16.7% drop)
§7   iron / netherite armor §8(base per piece)

§e── CRAFT EACH PIECE ──
§7Helmet:
§7   red_steel + Super Smithing Update
§7   + iron_helmet
§7Chestplate:
§7   red_steel + Super Smithing Update
§7   + crab_leg + iron_chestplate
§7Leggings:
§7   red_steel + Super Smithing Update
§7   + netherite_leggings
§7Boots:
§7   red_steel + Super Smithing Update
§7   + iron_boots

§e── MATERIAL CHAIN ──
§7Mini Crab (16.7%) => crab_lower_body, crab_leg
§7Craft Robot Crab Egg => fight boss
§7Boss drops red_ore_piece x6 guaranteed
§7red_ore_piece + steel => red_ore => smelt => red_steel`;

const armorSpecial =
`§e── SPECIAL HELMETS ──

§fNight Vision Helmet
§7   leather_helmet + golden_carrot + redstone
§7   Effect: Night Vision while worn

§bFrozen Hat
§7   Utra Change Smithing template + diamond
§7   + frozen_helmet + pufferfish
§7   Special variant of the frozen helmet.

§aUltimate Emerald Helmet
§7   Utrasmithing + frozensteel + iceore
§7   + ugage_emeral_helmet
§7   Upgraded emerald helmet with frozen perks.

§e── HYBRID ARMOR PIECE ──

§bFrozemeral Chestplate
§7   Utra Change Smithing template
§7   + emerald_block + frozen_chestplate
§7   Combines emerald and frozen materials.
§7   A mid-high tier hybrid chest piece.

§e── SPECIAL LEGGINGS AND BOOTS ──

§bFrozether Leggings
§7   Variant frozen leggings with different stats.

§bFrozpeed Boots
§7   Frozen boots variant — likely has Speed bonus.
§7   Craft details in recipe book.`;

// ═══════════════════════════════════════════
//  MOB MENU
// ═══════════════════════════════════════════
function openMobMenu(player) {
    new ActionFormData()
        .title('§l§aMobs and Enemies')
        .body('§7Select a mob:')
        .button('§fBlack Death')
        .button('§bIce Villager')
        .button('§eMini Crab')
        .button('§eZombie General')
        .button('§cPhoenixx')
        .button('§dEnder Skeleton')
        .button('§dHarvester')
        .button('§7Back')
        .show(player)
        .then(res => {
            if (res.canceled || res.selection == null) return;
            if (res.selection === 7) { openMainMenu(player); return; }
            const titles = ['§l§fBlack Death', '§l§bIce Villager', '§l§eMini Crab', '§l§eZombie General', '§l§cPhoenixx', '§l§dEnder Skeleton', '§l§dHarvester'];
            const details = [mobBlackDeath, mobIceVillager, mobMiniCrab, mobZombieGeneral, mobPhoenixx, mobEnderSkel, mobHarvester];
            showDetail(player, titles[res.selection], details[res.selection], openMobMenu);
        }).catch(() => {});
}

const mobBlackDeath =
`§e── STATS ──
§7ID:    §fpa:blackdeath2
§7HP:    §f45 | ATK: §f7
§7Spawn: §fOverworld — night only (natural)

§e── DROPS (1 loot pool, 5 rolls, 2 entries) ──
§7Each roll picks 1 of 2 equal items:
§7   obsidian_sharp — 50% per roll
§7   leather        — 50% per roll
§7Average per kill: ~2-3 obsidian_sharp
§7                  ~2-3 leather

§e── WHY FARM IT ──
§7obsidian_sharp is needed for:
§7   Obsidian Sword, Big Obsidian Sword,
§7   Obsidian Battle Axe, Obsidian Armor Set
§7   (all obsidian-tier gear)

§e── STRATEGY ──
§7Spawns at night like normal zombies.
§7Set up a dark area and wait for them.
§7HP 45 is manageable with iron gear.
§7Best to farm before attempting Yeti Boss.`;

const mobIceVillager =
`§e── STATS ──
§7ID:    §fpa:ice_villager
§7HP:    §f35 | ATK: §f3
§7Spawn: §bOverworld — natural spawn

§e── TRADES ──
§7Tier 1: emerald x1 + ice x4 => gold x1
§7Tier 2: emerald x1 => ice x2
§7Tier 3: emerald x2 => ice x6
§7         emerald x1 => packed_ice x1
§7Tier 4: gold_block  => blue_ice x1-3
§7Tier 5: netherite_ingot x1 + blue_ice x18
§7         => §bfrozen_heart_piece §8(key item!)
§7         diamond_block x32 + netherite_block x1
§7         => §biceron_pear §8(special item)
§7Tier 6: iceore x1 => blue_ice x10

§e── WHY IT MATTERS ──
§7Tier 5 is the §asafest and easiest§7 way to
§7obtain frozen_heart_piece without farming
§7the dangerous Yeti Boss Pet Riu (8.3% drop).
§7Unlock Tier 5 by trading through all prior
§7tiers to level up the villager.

§c Protect this villager — do not let it die!`;

const mobMiniCrab =
`§e── STATS ──
§7ID:    §fpa:mini_crab_2
§7HP:    §f22 | ATK: §f2
§7Spawn: §eOverworld (natural)

§e── DROPS (2 loot pools) ──
§7Pool 1 (1 roll, 6 entries — equal weight):
§7   crab_lower_body — 16.7%
§7   crab_leg        — 16.7%
§7   iron_ingot      — 16.7%
§7   iron_nugget     — 16.7%
§7   redstone        — 16.7%
§7   (button — 16.7%, ignore)
§7Pool 2 (1 roll, 14 entries):
§7   core — 7.1%
§7   (various junk — 92.9%)

§e── WHY FARM IT ──
§7crab_lower_body + crab_leg are required
§7to craft the §cRobot Crab Spawn Egg§7.
§7Robot Crab => red_ore_piece => red_steel
§7           => Crab Armor Set (highest tier)

§e── STRATEGY ──
§7Very easy to kill (HP 22, ATK 2).
§7Kill many to stockpile crab parts.
§7You also need crab_upper_body and crab_hand.`;

const mobZombieGeneral =
`§e── STATS ──
§7ID:    §fpa:zombie_geneal
§7HP:    §f35 | ATK: §f6
§7Spawn: §eOverworld — night only (natural)

§e── DROPS (2 loot pools) ──
§7Pool 1 (1 roll, 10 entries — equal weight):
§7   zombie_heart  — 10%
§7   thitthoiran   — 10%
§7   diamond       — 10%
§7   gold_ingot    — 10%
§7   iron_ingot    — 10%
§7   (copper, dirt, rotten_flesh, etc. — 50%)
§7Pool 2 (5 rolls — rotten_flesh only):
§7   rotten_flesh x5 — guaranteed

§e── WHY FARM IT ──
§7zombie_heart and thitthoiran are both
§7needed to craft the §eGiant Zombie Spawn Egg§7.
§7Giant Zombie Phase 2 drops diamond_block,
§7making it a strong early diamond source.

§e── STRATEGY ──
§7Farm at night, outdoors. HP 35 is easy.
§7Average: need ~10 kills per material.
§7Expect some diamond drops along the way.
§7Start farming on night 1 of a new world.`;

const mobPhoenixx =
`§e── STATS ──
§7ID:    §fpa:phoenixx
§7HP:    §f22 | ATK: §f2
§7Spawn: §cNether (natural spawn)

§e── DROPS ──
§7   firefeather — drops on kill
§7   §8(exact rate not defined in loot table;
§7   §8expect to farm many for consistent supply)
§7   nether_wart, nether_wart_block — common

§e── WHY FARM IT ──
§7firefeather is the start of the Fire chain:
§7   firefeather => fire_dust => fire_jade
§7   fire_jade is required to craft:
§7   => §c§lFrizenscythe §8(12 DMG — max weapon)

§e── STRATEGY ──
§7Very easy to kill (HP 22, ATK 2).
§7Wear fire resistance before entering Nether.
§7Farm many firefeather before crafting
§7fire_jade (it also needs nether_star).
§7Best done after you have netherite ingots.`;

const mobEnderSkel =
`§e── STATS ──
§7ID:    §fpa:enderskel
§7HP:    §f45 | ATK: §f5
§7Spawn: §5The End (natural spawn)

§e── DROPS (1 pool, 1 roll) ──
§7   ender_pearl — 100% guaranteed

§e── NOTES ──
§7A relatively straightforward End mob.
§7ATK 5 is low, manageable with any decent armor.
§7Ender pearls are always useful for mobility.
§7Not a priority farm target unless you need
§7a large supply of ender pearls quickly.
§7Ignore until you are in The End for Harvester.`;

const mobHarvester =
`§e── STATS ──
§7ID:    §fpa:the_harvester
§7HP:    §c500 | ATK: §c11
§7Spawn: §5The End (natural spawn)

§e── DROPS (2 loot pools) ──
§7Pool 1 (1 roll, 3 entries — equal weight):
§7   reaper_skull — 33.3%
§7   ender_dust   — 33.3%
§7   end_stone    — 33.3%
§7Pool 2 (8 rolls, 1 entry):
§7   soul x8 — §a100% guaranteed every kill

§e── WHY FARM IT ──
§7reaper_skull => Harvester Scythe (10 DMG)
§7ender_dust   => ender_jade => Frozendscythe (12 DMG)
§7soul x8      => dark_soul_ingot, dark_night_ingot
§7              => Dark Armor Set (entire set)

§e── WARNING ──
§cATK 11 is extremely dangerous.
§7§cMinimum: Full Frozen Set (all 4 pieces).
§7Without full Frozen, you will die quickly.

§e── STRATEGY ──
§7Keep distance. Use ranged attacks or
§7a high-DMG weapon like Frozenscythe.
§7Kill multiple per session — soul x8 each.`;

// ═══════════════════════════════════════════
//  WEAPON MENU
// ═══════════════════════════════════════════
function openWeaponMenu(player) {
    new ActionFormData()
        .title('§l§eWeapons')
        .body('§7Select a weapon:')
        .button('§7Steel Sword §8(7 DMG)')
        .button('§8Obsidian Line §8(7-10 DMG)')
        .button('§cZombie Axe §8(9 DMG)')
        .button('§bFrozenscythe §8(9 DMG)')
        .button('§fCandy Scythe §8(10 DMG)')
        .button('§dHarvester Scythe §8(10 DMG)')
        .button('§cFrizenscythe §8(12 DMG)')
        .button('§5Frozendscythe §8(12 DMG)')
        .button('§7Back')
        .show(player)
        .then(res => {
            if (res.canceled || res.selection == null) return;
            if (res.selection === 8) { openMainMenu(player); return; }
            const titles = ['§l§7Steel Sword', '§l§8Obsidian Weapon Line', '§l§cZombie Axe', '§l§bFrozenscythe', '§l§fCandy Scythe', '§l§dHarvester Scythe', '§l§cFrizenscythe', '§l§5Frozendscythe'];
            const details = [wpSteel, wpObsidian, wpZombieAxe, wpFrozen, wpCandy, wpHarvester, wpFrizen, wpFrozend];
            showDetail(player, titles[res.selection], details[res.selection], openWeaponMenu);
        }).catch(() => {});
}

const wpSteel =
`§e── STATS ──
§7Damage: §f7 DMG | Type: Sword
§7Tier:   §fEarly game

§e── CRAFT ──
§7First craft §fsteel_stick§7:
§7   steel_ingot + tast_iron_ingot => steel_stick
§7Then craft the sword:
§7   tast_iron_ingot + steel_ingot + steel_stick
§7   => §fsteel_sword

§e── HOW TO GET MATERIALS ──
§7steel_ingot: iron_ingot + coal => raw_steel => smelt
§7tast_iron_ingot: check recipe book
§7                (special variant of iron ingot)

§e── NOTES ──
§77 DMG matches a diamond sword.
§7Easy to craft with basic materials.
§7Use it until you get an Obsidian or
§7Frozenscythe.`;

const wpObsidian =
`§e── OBSIDIAN WEAPON LINE ──

§fObsidian Sword — 7 DMG
§7   obsidian_sharp + bigobsidian_shard
§7   + blaze_rod => obsidian_sword

§fBig Obsidian Sword — 8 DMG
§7   obsidian_sharp + bigobsidian_shard
§7   + blaze_rod => bigobsidian_sword

§fLong Obsidian Sword — 7 DMG
§7   Change Mithing template + bigobsidian_sword
§7   + blaze_rod => longobsidian_sword

§fLong Obsidian Sword (Upgraded) — §c10 DMG
§7   Smithing upgrade of the Long Obsidian Sword.
§7   §8(check recipe book for exact template)
§7   Special: §ccauses Lightning on hit

§fObsidian Battle Axe — 7 DMG
§7   bigobsidian_shard + netherite_ingot
§7   + blaze_rod => obsidian_battle_axe
§7   Right-click: grants a combat buff

§fObsidian Battle Axe (Big) — 10 DMG
§7   Upgraded version — also grants buff on use

§e── MATERIAL SOURCE ──
§7obsidian_sharp: craft from 4 obsidian
§7                OR farm Black Death (50%/roll)`;

const wpZombieAxe =
`§e── STATS ──
§7Damage: §f9 DMG | Type: Axe
§7Tier:   §fMid-game

§e── CRAFT ──
§7   waterofzombie + diamond_ingot
§7   + netherite_ingot + blaze_rod
§7   => §czombieaxe

§e── HOW TO GET waterofzombie ──
§7Crafted from Giant Zombie Boss materials.
§7Kill Giant Zombie Phase 2 to get its drops,
§7then use the drops to craft waterofzombie.
§7handgiantzombie — 50% drop from P2 (pool B)

§e── NOTES ──
§79 DMG at the cost of netherite + diamond.
§7Good stepping stone before Frozenscythe.
§7Use if you have Giant Zombie drops ready
§7but have not yet farmed Yeti Boss.`;

const wpFrozen =
`§e── STATS ──
§7Damage: §f9 DMG | Type: Scythe
§7Tier:   §fHigh — farm target

§e── CRAFT ──
§7   big_yeti_fur + icesteel + steel_stick
§7   + Utrasmithing template
§7   + netherite_sword + iceore
§7   => §bfrozenscythe

§e── HOW TO GET MATERIALS ──
§7icesteel: steel + iceore + yeti_fur => rawicesteel => smelt
§7iceore:   guaranteed x8 from Yeti Boss death phase
§7yeti_fur: Yeti Boss death phase ~33%/roll, 10 rolls
§7big_yeti_fur: white_wool + yeti_fur
§7steel_stick: steel_ingot + tast_iron_ingot

§e── ON USE ABILITY ──
§7Right-click grants the Frozen Scythe buff.
§7Also triggers the Yeti particle effect.
§7On hit: applies Frozen Scythe skill to target.

§e── THIS WEAPON IS THE BASE FOR ──
§7   + sugar + candy + Super Smithing
§7   => §fCandy Scythe §8(10 DMG)
§7   + fire_dust + fire_jade + netherite + steel_stick
§7   => §c§lFrizenscythe §8(12 DMG)
§7   + ender_dust + ender_jade + netherite + steel_stick
§7   => §5§lFrozendscythe §8(12 DMG)`;

const wpCandy =
`§e── STATS ──
§7Damage: §f10 DMG | Type: Scythe
§7Tier:   §fMid-high

§e── CRAFT ──
§7First craft §fcandy§7:
§7   sugar + milk_bucket => candy
§7Then craft the weapon:
§7   sugar + candy + frozenscythe
§7   + Super Smithing Update template
§7   => §fcandy_scythe

§e── EATING CANDY ──
§7candy is also a food item:
§7   Restores: +2 hunger
§7   Effects on eat:
§7      Speed II — 15 seconds
§7      Jump Boost II — 15 seconds
§7      Regeneration — 5 seconds

§e── NOTES ──
§710 DMG for relatively cheap materials.
§7Good if you have frozenscythe but
§7do not yet have fire_jade or ender_jade.
§7The candy ingredient is easy to farm.`;

const wpHarvester =
`§e── STATS ──
§7Damage: §f10 DMG | Type: Scythe
§7Tier:   §fHigh

§e── CRAFT ──
§7   dark_soul_ingot + reaper_skull
§7   + soul + frozenscythe
§7   + dark_night_ingot + Utrasmithing template
§7   => §dharvester_scythe

§e── HOW TO GET MATERIALS ──
§7reaper_skull: §dHarvester §8(The End, HP:500)
§7              33.3% drop per kill
§7              §8Also craftable: soul + skeleton_skull
§7soul:         §dHarvester§7 — guaranteed x8 per kill
§7dark_soul:    soul + steel_ingot
§7dark_night:   soul + tast_iron_ingot
§7frozenscythe: see Frozenscythe entry above

§e── NOTES ──
§7Requires venturing into The End.
§7You need at least full Frozen Set first.
§7Same DMG as Candy Scythe but harder to get.
§7Worth it for the Dark Armor progression path.`;

const wpFrizen =
`§e── STATS ──
§7Damage: §c§l12 DMG §8(TIED HIGHEST)
§7Type: Scythe | Tier: §cEndgame

§e── CRAFT ──
§7   fire_dust + netherite_ingot + frozenscythe
§7   + steel_stick + fire_jade
§7   => §c§lfrizenscythe

§e── ON USE ABILITY ──
§7Right-click triggers:
§7   function "3" (effect stack)
§7   Frizend_scythe_particle (fire particles)
§7   Frizen_scythe_buff (combat buff)
§7On hit: applies frizen_scythe_skill to target.
§7Also works as a sword variant (frizen_sword).

§e── MATERIAL CHAIN (from zero) ──
§7Nether — Farm §cPhoenixx §8(HP:22)§7:
§7   firefeather (farm until sufficient)
§7firefeather + blaze_rod + compressedfire
§7   => fire_dust
§7fire_dust + diamond + netherite + nether_star
§7   => §c§lfire_jade
§7fire_dust + netherite + frozenscythe
§7+ steel_stick + fire_jade
§7   => §c§lFrizenscythe`;

const wpFrozend =
`§e── STATS ──
§7Damage: §5§l12 DMG §8(TIED HIGHEST)
§7Type: Scythe | Tier: §5Endgame

§e── CRAFT ──
§7   ender_dust + netherite_ingot + frozenscythe
§7   + ender_jade + steel_stick
§7   => §5§lfrozendscythe

§e── ON USE ABILITY ──
§7Right-click triggers one random function from:
§7   icend, Frozendd_scythe_particle,
§7   Frozendd_scythe_buff
§7On hit: applies frozend_scythe_skill to target.
§7Also works as a sword variant (frozendsword).

§e── MATERIAL CHAIN (from zero) ──
§7The End — Farm §dHarvester §8(HP:500, ATK:11)§7:
§7   §cRequires full Frozen Set!
§7   ender_dust — 33.3% per kill
§7   soul x8   — 100% guaranteed
§7ender_eye + soul + shulker_shell
§7   => ender_dust §8(alternate craft)
§7ender_dust + amethyst + netherite + nether_star
§7   => §5§lender_jade
§7ender_dust + netherite + frozenscythe
§7+ ender_jade + steel_stick
§7   => §5§lFrozendscythe`;

// ═══════════════════════════════════════════
//  ITEM / CONSUMABLE MENU
// ═══════════════════════════════════════════
function openItemMenu(player) {
    new ActionFormData()
        .title('§l§dItems and Consumables')
        .body('§7Select an item:')
        .button('§bFrozen Heart')
        .button('§fCandy')
        .button('§dDark Night Apple')
        .button('§5Dark Soul Apple')
        .button('§fBlessing of Food')
        .button('§9Protection of the Sea')
        .button('§cBlessing from the Hell')
        .button('§aTrust of the Village')
        .button('§7Back')
        .show(player)
        .then(res => {
            if (res.canceled || res.selection == null) return;
            if (res.selection === 8) { openMainMenu(player); return; }
            const titles = ['§l§bFrozen Heart', '§l§fCandy', '§l§dDark Night Apple', '§l§5Dark Soul Apple', '§l§fBlessing of Food', '§l§9Protection of the Sea', '§l§cBlessing from the Hell', '§l§aTrust of the Village'];
            const details = [itemFrozenHeart, itemCandy, itemDarkNightApple, itemDarkSoulApple, itemBlessingFood, itemSea, itemHell, itemVillage];
            showDetail(player, titles[res.selection], details[res.selection], openItemMenu);
        }).catch(() => {});
}

const itemFrozenHeart =
`§e── WHAT IT IS ──
§7A mid-tier crafted key item.
§7Required to craft the §bYeti Boss Spawn Egg§7.
§7Also useful as an offhand item.

§e── OFFHAND EFFECT ──
§7When held in the offhand:
§7   Continuously removes §bSlowness§7 and
§7   §bMining Fatigue§7 from the player.

§e── HOW TO CRAFT ──
§7Step 1 — Get §bfrozen_heart_piece§7:
§7   Method A: Farm Yeti Boss Pet Riu
§7             (pa:yeti_boss_pet_riu) — 8.3% drop
§7   Method B: Buy from §bIce Villager Tier 5§7:
§7             netherite_ingot x1 + blue_ice x18
§7Step 2 — Craft §byeti_core§7:
§7   soul + big_yeti_fur + blue_ice + core
§7   (big_yeti_fur = white_wool + yeti_fur)
§7Step 3 — Craft §bfrozen_heart§7:
§7   frozen_heart_piece + yeti_core

§e── WHERE TO GET core ──
§7Yeti Boss Pet Riu — 6.3% drop per kill
§7(also sometimes from Mini Crab pool 2 — 7.1%)`;

const itemCandy =
`§e── STATS ──
§7Type: Food | Hunger Restored: +2
§7Effects on consume:
§7   Speed II       — 15 seconds
§7   Jump Boost II  — 15 seconds
§7   Regeneration   — 5 seconds

§e── CRAFT ──
§7   sugar + milk_bucket => §fcandy

§e── SECONDARY USE ──
§7candy is also a crafting material:
§7   sugar + candy + frozenscythe
§7   + Super Smithing Update
§7   => §fCandy Scythe §8(10 DMG)

§e── NOTES ──
§7Very cheap to produce once you have cows
§7and sugar cane. The speed and jump effects
§7make it useful for traversal.
§7Keep a stack handy for emergency mobility.`;

const itemDarkNightApple =
`§e── STATS ──
§7Type: Food (craftable)
§7Effects on consume (long duration):
§7   Fire Resistance II  — 10 minutes
§7   Health Boost V      — 10 minutes
§7   Night Vision I      — 15 minutes
§7   Regeneration IV     — 20 seconds
§7   Resistance II       — 10 minutes
§7   Saturation III      — 5 minutes
§7   Slow Falling        — 10 minutes
§7   Speed II            — 10 minutes
§7Removes: Wither, Weakness, Slowness,
§7         Poison, Nausea, Mining Fatigue,
§7         Levitation, Hunger

§e── CRAFT ──
§7   Check recipe book for exact layout.
§7   Requires dark materials (dark_night_ingot
§7   or dark_night-related components).

§e── NOTES ──
§7One of the strongest food items in the addon.
§7Ideal to eat before boss fights.
§7The Health Boost V adds 10 extra hearts.`;

const itemDarkSoulApple =
`§e── STATS ──
§7Type: Food (craftable)
§7Effects on consume (same as Dark Night Apple):
§7   Fire Resistance II  — 10 minutes
§7   Health Boost IV     — 10 minutes
§7   Night Vision I      — 15 minutes
§7   Regeneration IV     — 20 seconds
§7   Resistance II       — 10 minutes
§7   Saturation III      — 5 minutes
§7   Slow Falling        — 10 minutes
§7   Speed II            — 10 minutes
§7Removes all negative effects.

§e── CRAFT ──
§7   Check recipe book for exact layout.
§7   Uses dark_soul_ingot based components.

§e── COMPARISON TO DARK NIGHT APPLE ──
§7Dark Night Apple: Health Boost V (+10 hearts)
§7Dark Soul Apple:  Health Boost IV (+8 hearts)
§7Otherwise identical effects.
§7Both are exceptional pre-boss food items.`;

const itemBlessingFood =
`§e── WHAT IT IS ──
§7A craftable prestige item.
§7Likely provides strong food-related effects.
§7Considered an endgame item.

§e── CRAFT ──
§7   emerald_apple + cake
§7   + enchanted_golden_apple + nether_star
§7   => §fthe_blessing_of_food

§e── HOW TO GET MATERIALS ──
§7emerald_apple: craftable (emerald-based)
§7cake: vanilla craft
§7enchanted_golden_apple: chest loot (vanilla)
§7   cannot be crafted in vanilla Bedrock
§7nether_star: kill the Wither boss (vanilla)

§e── NOTES ──
§7Very expensive to craft.
§7Only pursue after you have netherite gear
§7and are farming end-game content regularly.
§7Treat this as a prestige / collector item.`;

const itemSea =
`§e── WHAT IT IS ──
§7A craftable prestige item.
§7Provides protection or water-related effects.

§e── CRAFT ──
§7   gold_block + prismarine_bricks
§7   + lapis_block + heart_of_the_sea
§7   + nether_star
§7   => §9protection_of_the_sea

§e── HOW TO GET MATERIALS ──
§7gold_block: 9 gold ingots
§7prismarine_bricks: craft from prismarine shards
§7lapis_block: 9 lapis lazuli
§7heart_of_the_sea: found in buried treasure chests
§7nether_star: kill the Wither boss (vanilla)

§e── NOTES ──
§7heart_of_the_sea requires treasure map
§7from cartographer or dolphin.
§7nether_star requires summoning Wither.
§7Best crafted once you have full end-game gear.`;

const itemHell =
`§e── WHAT IT IS ──
§7A Nether-themed prestige item.
§7Provides fire / nether resistance effects.

§e── CRAFT ──
§7   netherite_scrap + netherite_ingot
§7   + quartz + nether_star
§7   + fire_dust + soul_sand
§7   => §cblessing_from_the_hell

§e── HOW TO GET MATERIALS ──
§7fire_dust chain:
§7   Phoenixx (Nether, HP:22) => firefeather
§7   firefeather + blaze_rod + compressedfire
§7   => fire_dust
§7netherite_scrap: mine ancient debris (Nether)
§7nether_star: kill the Wither boss
§7quartz, soul_sand: Nether natural generation

§e── NOTES ──
§7Requires both Nether farming (Phoenixx)
§7and Wither killing.
§7A strong fire resistance / hell buff item.`;

const itemVillage =
`§e── WHAT IT IS ──
§7A village-themed prestige item.
§7Provides hero of the village-style effects.

§e── CRAFT ──
§7   emerald_block + bed
§7   + blast_furnace + nether_star
§7   + smithing_table
§7   => §athe_trust_of_the_village

§e── HOW TO GET MATERIALS ──
§7emerald_block: 9 emeralds
§7bed: wool + planks (vanilla)
§7blast_furnace: iron + smooth_stone + furnace
§7smithing_table: iron + planks
§7nether_star: kill the Wither boss (vanilla)

§e── NOTES ──
§7Very cheap to craft except for nether_star.
§7The Wither remains the primary gating cost.
§7Complete this after clearing The End content.`;

// ═══════════════════════════════════════════
//  PROGRESSION GUIDE
// ═══════════════════════════════════════════
function openProgressionMenu(player) {
    new ActionFormData()
        .title('§l§6Progression Guide')
        .body('§7Select a progression stage:')
        .button('§fStages 1-3: Early Game')
        .button('§eStages 4-6: Mid Game')
        .button('§cStages 7-9: End Game')
        .button('§7Back')
        .show(player)
        .then(res => {
            if (res.canceled || res.selection == null) return;
            if (res.selection === 3) { openMainMenu(player); return; }
            const titles = ['§l§fEarly Game — Stages 1-3', '§l§eMid Game — Stages 4-6', '§l§cEnd Game — Stages 7-9'];
            const details = [progressionEarly, progressionMid, progressionEnd];
            showDetail(player, titles[res.selection], details[res.selection], openProgressionMenu);
        }).catch(() => {});
}

const progressionEarly =
`§e── STAGE 1: STEEL TIER ──
§7Goal: First custom weapon and basic gear.
§7   Mine iron. Craft iron_ingot + coal
§7   => raw_steel => smelt => steel_ingot
§7   Craft tast_iron_ingot (check recipe book)
§7   Craft steel_stick, then Steel Sword (7 DMG)
§7   Also: craft Night Vision Helmet
§7   (leather_helmet + golden_carrot + redstone)

§e── STAGE 2: OBSIDIAN TIER ──
§7Goal: First custom armor set.
§7   Farm §fBlack Death §8(night, Overworld)
§7      obsidian_sharp — 50%/roll, 5 rolls/kill
§7   Craft 4 obsidian => obsidian_sharp
§7   Craft bigobsidian_shard from obsidian_sharp
§7   Craft Obsidian Armor Set (Change Mithing)
§7   Craft Obsidian Sword line up to Big (8 DMG)

§e── STAGE 3: EARLY BOSS FARMING ──
§7Goal: Diamond supply and boss materials.
§7   Farm §eZombie General §8(night, Overworld)
§7      zombie_heart — 10% | thitthoiran — 10%
§7   Craft Giant Zombie Spawn Egg
§7   Kill Giant Zombie => handgiantzombie (50%)
§7                     => diamond_block (8.3%)
§7   Also craft Diamond Golem Egg:
§7      carved_pumpkin + diamond_block
§7   Kill Diamond Golem => diamond x6 guaranteed
§7   Use diamonds to get netherite armor as base.`;

const progressionMid =
`§e── STAGE 4: NETHER AND FIRE DUST ──
§7Goal: Gather fire_dust for Frizenscythe later.
§7   Enter Nether with Obsidian gear minimum.
§7   Farm §cPhoenixx §8(HP:22, very easy)
§7      Collect firefeather (farm in bulk)
§7   Craft: firefeather + blaze_rod + compressedfire
§7          => fire_dust
§7   Hold fire_dust for now.
§7   Also get netherite_scrap via ancient debris.

§e── STAGE 5: FROZEN TIER ──
§7Goal: Frozen Set and Frozenscythe.
§7   Find or trade §bIce Villager§7 Tier 5:
§7      netherite x1 + blue_ice x18
§7      => frozen_heart_piece
§7   OR farm Yeti Boss Pet Riu (8.3% chance)
§7   Craft frozen_heart => Yeti Boss Egg
§7   Kill Yeti Boss (P1:700HP, P2:500HP, P3:500HP)
§7      => iceore x8 guaranteed, yeti_fur ~3-4
§7   Chain: steel => icesteel => frozensteel
§7   Craft Frozen Armor Set (Utrasmithing + netherite)
§7   Craft Frozenscythe (9 DMG)

§e── STAGE 6: CRAB TIER ──
§7Goal: Highest craftable armor set.
§7   Farm §eMini Crab§7 for parts (16.7% each)
§7   Craft Robot Crab Spawn Egg
§7   Kill Robot Crab => red_ore_piece x6 guaranteed
§7   Chain: red_ore_piece + steel => red_ore => smelt
§7          => red_steel => Crab Armor Set
§7   Crab Set is the best craftable armor in addon.`;

const progressionEnd =
`§e── STAGE 7: THE END — HARVESTER ──
§7Goal: Soul farming for Dark Armor + end weapons.
§7   §cRequire full Frozen Set before entering!
§7   Farm §dHarvester §8(HP:500, ATK:11)
§7      soul x8 — guaranteed every kill
§7      ender_dust — 33.3% per kill
§7      reaper_skull — 33.3% per kill
§7   Craft dark_soul_ingot and dark_night_ingot
§7   Craft Dark Night Armor Set (all 4 pieces)
§7   Craft Harvester Scythe (10 DMG)
§7   Also eat Dark Night / Dark Soul Apple
§7   before tough fights for 10-minute buffs.

§e── STAGE 8: ENDGAME WEAPONS ──
§7Goal: Craft 12 DMG endgame scythes.
§7   FROM FIRE PATH (Frizenscythe):
§7      fire_dust + fire_jade + netherite
§7      + frozenscythe + steel_stick
§7      => §c§lFrizenscythe §8(12 DMG)
§7   FROM ENDER PATH (Frozendscythe):
§7      ender_dust + ender_jade + netherite
§7      + frozenscythe + steel_stick
§7      => §5§lFrozendscythe §8(12 DMG)
§7   Both require: nether_star (Wither kill)
§7   for their respective jade crafts.

§e── STAGE 9: PRESTIGE ITEMS ──
§7Goal: Craft all collectible prestige items.
§7   Blessing of Food
§7      (enchanted_golden_apple + nether_star + more)
§7   Protection of the Sea
§7      (heart_of_the_sea + nether_star + more)
§7   Blessing from the Hell
§7      (fire_dust + nether_star + netherite)
§7   Trust of the Village
§7      (smithing_table + nether_star + more)
§7   Ice Villager special trade:
§7      diamond_block x32 + netherite_block
§7      => iceron_pear §8(unique item)`;
