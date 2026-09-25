# Inverted Spear of Heaven — Toji Addon for Minecraft Bedrock

This addon adds the **Inverted Spear of Heaven** (`toji:inverted_spear`) of Toji Fushiguro (Jujutsu Kaisen), with a JJS-style skill kit.
Written with the Script API `@minecraft/server` 2.0.0, **no Beta APIs / experiments required**.
Requirements: Minecraft Bedrock **1.21.90 or newer** (PC, mobile, console). Current version: **v1.7.0**.

![3D model](preview.png)

## Installation

1. Download [`dist/TojiInvertedSpear.mcaddon`](dist/TojiInvertedSpear.mcaddon) and open it; Minecraft imports both packs.
2. Create/edit a world → **Behavior Packs** → activate *Toji - Inverted Spear of Heaven (BP)* (the Resource Pack is activated with it).
3. Get the spear:
   - Command: `/give @s toji:inverted_spear`
   - Crafting (crafting table, shapeless): **Trident + Echo Shard + Chain + Amethyst Shard**
   - Creative: Equipment → Swords.

> **Upgrading from an older version?** Go to **Settings → Storage**, delete every old Toji pack, then import the `.mcaddon` again.
> Version 1.0.0 had a bug: the spear was not held in the hand (missing hand bone binding) and was too big.

## Controls

| Input | Skill | Effect |
|---|---|---|
| **Right-click** (mobile: tap the screen / Use button) | **Pierce Infinity** | The scene where Toji stabs through Gojo's Infinity: blink forward and stab 6 blocks straight ahead. In front of each target a **blue hexagonal barrier (Infinity) appears and shatters**; the target is pierced, briefly stunned and **loses every positive effect**. 5 s cooldown |
| **Sneak (Shift) + right-click** | **Chain of a Thousand Miles** | The spear leaves your hand and **whirls around you on its chain** (2 laps, 4.5-block radius), hitting and knocking back every enemy in the ring on each lap; then it is **hurled straight ahead** (24 blocks): hitting an enemy **drags it along the chain right in front of you**, sticking in a wall/ground **swings you there** along an arc. 10 s cooldown |
| **Sprint + attack** (sprint then hit, or sprint + right-click) | **Heavenly Ambush** | Toji has no cursed energy, so nobody senses him: he **vanishes in smoke, reappears behind the enemy you look at** (up to 14 blocks) and **cuts an X** into its back. With no target, he dashes instead. 7 s cooldown |
| **Hold the spear 20 s** | **Heavenly Restriction: Awakened** | Triggers by itself after holding the spear for 20 s: the **Inventory Curse (the worm, a 3D model) grows out and coils twice around your body** for 15 s, slithering, its head on your right shoulder gnashing its jaws (hidden in first person). Grants Speed II, Strength II, Jump Boost II, Resistance I; x1.3 skill damage, half cooldowns |
| **Hold 20 s + jump** (while awakened) | **Heaven's Execution** | The Inventory Curse opens its mouth, **chains shoot out and hook every mob within 12 blocks** (up to 12), **drag them into the sky and hang them in a ring** around you. Toji flies up, **darts back and forth piercing each of them 3 rounds** (Infinity shattering, X cuts, blood), rises higher and **slams them all into the ground at once**: two crack waves, 4 shockwaves, a giant X, and all the damage lands in one go (**8 per pierce + 20 slam, x1.3 while awakened ≈ 57 health per mob**). Invulnerable while casting. Once per awakening |
| **Jump + attack** (hit a mob while in the air) | **Sky Splitter** | Raise the spear with both hands and smash straight down: the enemy is driven into the ground, the ground cracks, splash damage within 2.5 blocks. 3 s cooldown |
| **Crouch + attack** (hit a mob while sneaking) | **Low Sweep** | Drop low and sweep the spear in an arc at ankle height, then flick it up to launch enemies into the air. 3 s cooldown |
| **4 normal hits in a row** | **M1 Combo + Finisher** | The 4th hit is a spinning arc slash in front that knocks enemies away (like JJS M1s) |
| **Every hit** | **Passive: Nullification** | Normal attacks also strip the target's positive effects |

### Awakening upgrades every other skill

During the 15 s awakening (hold the spear 20 s), every other skill turns into a stronger version (with a violet glow and a rune ring under your feet when cast):

| Skill | Upgraded version |
|---|---|
| Pierce Infinity | 70% longer reach, x1.6 damage, **3 stabs in a row**, shockwaves running along the stab |
| Chain of a Thousand Miles | **3 laps**, 35% wider; when the hurled spear hits an enemy **the chain splits and hooks 2 more enemies** nearby, dragging all 3 back |
| Heavenly Ambush | After the cut, **jumps to the next enemy's back**, chaining through up to 3 enemies |
| Sky Splitter (jump + attack) | Shockwave **twice as wide**, every enemy in it takes full damage, 3 shockwave rings |
| Low Sweep (crouch + attack) | **Full 360° sweep**, wider, launches 50% higher |
| Combo | The finisher comes on the **3rd hit** instead of the 4th, a full spin, x1.5 damage |

On top of the awakening's own buffs: x1.3 skill damage, half cooldowns.

- The bar above the hotbar shows the hold progress `▮▮▮▮▯▯ 12/20s`, the skill right-click will cast (`Press: Pierce / Chain / Ambush`), the combo count and the cooldowns.
- **Letting go of the spear (switching slot) resets the 20 s timer and ends the awakening** (buffs included). When the awakening ends you have to hold the spear 20 s again.
- Type `/scriptevent toji:help` to see the guide again.
- **Other players are hit by the skills too**, even when the world's PvP setting is off (their health is lowered directly); players in Creative/Spectator are never affected. Set `pvp: false` in `config.js` to only hit mobs.
- Right-clicking chests, doors, crafting tables, villagers, horses... still works as usual, no skill is cast.

## Effects: custom particles + animations

![Particles](preview_particles.png)

23 hand-drawn pixel art particles (`TojiRP/particles`), most of them multi-frame flipbooks:

| Particle | Used for |
|---|---|
| `toji:thrust` | Stab streaks shooting where you look (Pierce Infinity) |
| `toji:null_ring` / `toji:null_ground` | Cracked violet rune ring with spikes pointing inward, on the target / on the ground when nullified |
| `toji:shard` | Violet glass shards bursting out (the target's effects breaking) |
| `toji:spear` + `toji:chain_link` | The flying spear (tip always along its path) and the chain back to your hand |
| `toji:slash` | White-violet steel slash (Chain, finisher, Execution) |
| `toji:afterimage` | Afterimage Toji leaves behind when dashing |
| `toji:aura` / `toji:charge` | White wind rising while awakened / wind gathering into the spear before awakening and when stabbing |
| `toji:shock_ring`, `toji:crack`, `toji:dust`, `toji:debris` | Shockwave, cracked ground, dust, flying rocks |
| `toji:flash`, `toji:spark`, `toji:blood` | Flash, steel sparks, blood |
| `toji:infinity` + `toji:shard_blue` | Blue hexagonal Infinity barrier cracking and shattering into blue glass |
| `toji:x_slash` | Giant X cut (Ambush, Execution) |
| `toji:glow` | Soft glow halo that comes with every flash |
| `toji:impact` | Anime speed lines bursting out of every X cut |
| `toji:vanish` | Dark smoke where Toji vanishes |

**Player animations** (`TojiRP/animations/toji_player.animation.json`, generated by `player_anims.py`); you see the first-person version, everyone else sees the third-person one:

| Animation | Motion |
|---|---|
| `thrust` | Pull the spear back to the hip → lunge and stab straight ahead → hold → recover |
| `whirl` | Raise the arm and swing the chain overhead twice, body turning with the spear → hurl it forward |
| `ambush` | Reappear behind → cut from high right to low left → cut from high left to low right (an X) |
| `finisher` | Wind up the body → sweep the spear in an arc to the left |
| `awaken` | Crouch to gather power → rise into a reverse-grip stance |
| `cut_a` / `cut_b` | Running cuts: legs mid-stride, body leaning in, alternating diagonal slashes |
| `leap_cut` | Jump with the legs tucked, spear overhead, then chop down |
| `rampage_end` | Landing: low crouch, spear held out to the side, then stand up |
| `chain_summon` | Arms flung wide, spear raised to the sky as the chains shoot out |
| `aerial_slam` | In the air, spear raised with both hands, then smash straight down (Sky Splitter, Execution's final slam) |
| `low_sweep` | Deep crouch, low spear sweep, then flick up |

There is also screen shake, a screen flash when awakening / during the Execution, and sounds for every skill.

**3D model**: straight double-edged blade with a violet ridge, a hooked side prong next to the blade (jitte-like), a dark guard, a violet cloth-wrapped grip with brass bands,
and a brass ring at the pommel holding the chain links. There are 3 forms: normal, **Awakened** (an extra `entity_emissive` glowing layer along the blade edges, lit even at night, plus the 3D worm)
and **Thrown** (only the chain stays in the hand). The script swaps forms and keeps the spear's durability, enchantments and name.

## Customization

- Every value (damage, cooldowns, range, the 20 s hold time, combo, PvP...) lives in [`TojiBP/scripts/config.js`](TojiBP/scripts/config.js).
- Holding pose and spear size: `HOLD` in [`packs.py`](packs.py). In-game texts: `LANG` in `packs.py`.
- After editing, run `python3 build.py` to regenerate every file and the `.mcaddon` (`python3 preview.py` redraws the preview images, needs Pillow).
- If you re-import into the game, bump `VERSION` in `packs.py` (Minecraft keeps the old version if the version number is unchanged).

## Testing

Without opening the game, [`test/sim.mjs`](test/sim.mjs) runs the real `main.js` against a mocked `@minecraft/server`
and tries in turn: right-click, sneak + right-click (whirl, hurl into an enemy, hook into a wall), sprint + attack (reappear behind / dash with no target), 4-hit combo, hold 20 s, hold 20 s + jump,
jump + attack, crouch + attack, switching slot while awakened / mid-Execution, stunned players not being able to cast, hitting other players, and the awakened upgrades (72 checks):

```
node test/sim.mjs
```

The mock has no real physics (knockback and falling are only recorded), so the in-game feel still needs to be tried directly.

## Structure

```
toji/
├── TojiBP/             Behavior pack: items (3 spear forms), recipe, scripts/main.js + config.js
├── TojiRP/             Resource pack: attachables, animations, .geo.json models, 23 particles, textures, texts (en_US)
├── packs.py            manifests, items, recipe, attachables, holding pose, language file
├── model.py            builds the 3D models from cubes + paints the pixel art texture + icons
├── particles.py        paints the particle atlas + particle JSON files
├── player_anims.py     designs + inverse-solves the player animations
├── build.py            runs everything and packages dist/TojiInvertedSpear.mcaddon
├── preview.py          draws preview.png / preview_particles.png
├── test/               mocked @minecraft/server + a script trying every skill
└── dist/TojiInvertedSpear.mcaddon
```

## Troubleshooting

- **Pressing does nothing and there is no cooldown bar above the hotbar:** the script isn't running. Make sure the **Behavior Pack** is active (not just the Resource Pack) and the game is **1.21.90** or newer.
- **The spear shows as a flat 2D sprite or is not in the hand:** the Resource Pack isn't active or an old version is still installed, see *Upgrading from an older version?*.
- **Execution doesn't trigger on jump:** it only works while awakened (the bar shows `AWAKENED`), once per awakening, and not in the middle of another skill.

This is an original model/texture inspired by the Inverted Spear of Heaven and contains no official Jujutsu Kaisen artwork.
