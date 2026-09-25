# The Darkin Blade — Aatrox Addon for Minecraft Bedrock

This addon adds **The Darkin Blade** (`aatrox:darkin_blade`), a sword with a skill kit inspired by Aatrox (League of Legends),
written with the Script API `@minecraft/server` 2.0.0. **No Beta APIs / experiments required.**

Requirements: Minecraft Bedrock **1.21.90 or newer** (PC, mobile and console).

![The Darkin Blade 3D model](preview.png)

When held, the blade is shown as a **3D model** with a **Minecraft-style pixel art texture**
(limited palette, lit top-left, shaded bottom-right, dither noise like vanilla textures).

### Design based on the original

The shape follows Aatrox's blade after the 2018 rework, cross-checked against several sources:
- **Base splash art** (by Victor Maury): a bright lava vein running down the middle of the blade and branching out, a glowing core at the blade base, black curved horns rising on both sides.
- **Sea Hunter and Justicar splashes** (redrawn with the new blade during the rework): the Darkin eye in the guard with claws wrapped around it, a blade that widens toward the tip, an angled tip, a big serrated spine and a hook near the tip.
- **Q and passive icons**: a dark metal frame around the blade, a dark red flesh core inside.
- **Wiki and rework articles** (Nexus, Polygon, Rift Herald): Aatrox is a "greatsword warrior" and the blade is a living prison holding his soul.

So the model has:
- a widening blade with an **angled tip**, **4 big serrated teeth** and a **hook** on the spine, small notches on the edge
- a **dark metal frame** (thicker than the core) and a recessed **dark red flesh core**
- a **tree-like branching lava vein** running from the eye up toward the tip, casting orange light on the surrounding flesh
- a **slit-pupil Darkin eye** in a flesh socket in the guard (with an **eyelid that blinks** every 4 seconds), **black horns** curving around the blade base, side spikes and **claws** curling underneath
- a long leather-wrapped two-handed grip with 3 metal bands and a spiked pommel

The lava and the eye are a separate layer drawn with the `entity_emissive` material and a `.tga` texture
(low alpha = glowing, like the vanilla blaze texture), so they still glow at night.
This is an original Minecraft-style model inspired by Aatrox's blade, not a Riot model or texture
(the addon contains no Riot images).

### Holding the blade and animations

![Holding the blade and skill animations](preview_animation.png)

- **Holding:** the hand grips the handle, the blade is perpendicular to the arm and points forward, about as long as the character is tall.
  First person: the blade stands upright on the right side of the screen, turned 135° horizontally so its face points toward the center.
- **Skill animations** (seen by you and by everyone around you):
  - **Q1** raises the blade over the shoulder then slashes diagonally down, **Q2** sweeps horizontally from right to left, **Q3** leaps up with both hands overhead and slams the ground
  - **E** lunges forward with the blade dragging behind
  - **W** swings the left arm to throw the chain (the chain leaves exactly on the swing)
  - **R** crouches, then roars with the arms spread and the blade raised to the sky
- **The Darkin eye on the blade blinks** periodically.

### World Ender form (R)

While transformed, the blade in your hand is swapped for the **World Ender** version (swapped back when the form ends, keeping durability, enchantments and name):
- **3D bat-like demon wings** on the back (arm bone, a claw on the wrist, 4 finger bones, dark red membrane scalloped between the fingers, glowing lava veins and edges) that flap constantly, **3D horns** on the head, and a bigger blade.
  The wings and horns are hidden in first person so they don't block the view.
- **World Ender zone** with a 6-block radius that follows you: a spiked rune circle spinning under your feet, runes and fire running around the rim, souls rising;
  enemies inside lose 1.5 health per second and are slowed.
- **Empowered skills:**
  - **Q** 30% bigger slash area, fire pillars erupting along the slash
  - **E** 40% longer dash, half cooldown, leaves a fire trail that burns enemies it passes
  - **W** throws **3 chains** in a fan, each binding one target, shorter cooldown
  - **Passive** recharges twice as fast (as before)

Skill animations have the full rhythm anticipation → swing → impact → overshoot → recover. The Catmull-Rom curve is precomputed and sampled every 0.04 seconds, so the motion is curved and smooth.

## Installation

- **Quickest:** download [`dist/AatroxDarkinBlade.mcaddon`](dist/AatroxDarkinBlade.mcaddon) and open it; Minecraft imports both packs automatically.
- **Manual:** copy `AatroxBP` into `development_behavior_packs` and `AatroxRP` into `development_resource_packs` inside the `com.mojang` folder.

Then create/edit a world → **Behavior Packs** → activate *Aatrox - The Darkin Blade (BP)* (the Resource Pack is activated with it).

> **Upgrading from an older version?** This is **v1.7.2**. In your world, remove the old packs and activate version 1.7.2.
> If the blade is still held like a lance or has no animations, go to **Settings → Storage**, delete every old Aatrox pack and import the `.mcaddon` again.

Getting the blade:
- Command: `/give @s aatrox:darkin_blade`
- Crafting (crafting table, shapeless): **Netherite Sword + Nether Star + Block of Redstone** (unlocks once you have a Nether Star)
- Or find it in the Creative inventory under Equipment → Swords.

## Controls

Bedrock doesn't let addons bind their own keys, so the skills use existing buttons: **right-click** (mobile: **tap the screen** or the Use/Place button; controller: **LT/L2**),
**sneak** (Shift / sneak button), **jump** and **sprint**:

| Input | Skill | Effect |
|---|---|---|
| **Right-click** | **Q — The Darkin Blade** | Press 3 times in a row (4 seconds to recast each time). The slash area is shown as rune tiles on the ground; **the orange tiles are the sweet spot**: x1.6 damage, knock-up, stun, reduces the passive cooldown. The 3rd cast slams a circular area |
| **Sprint + attack** (hit a mob/block while sprinting, or sprint + right-click) | **E — Umbral Dash** | Dash quickly where you look |
| **Sneak + right-click** | **W — Infernal Chains** | Throw a fiery chain. On hit it deals damage, slows and creates a binding circle; if the target hasn't left the circle after 1.5 seconds it is pulled back, takes more damage and is stunned |
| **Sneak + jump** | **R — World Ender** | A shockwave knocks back and slows everything around, then you transform for 10 seconds: +30% skill damage, +50% healing, Speed II, Strength I, the passive recharges twice as fast |
| **Normal attack** (left-click / tap a mob) | **Passive — Deathbringer Stance** | When ready (8 seconds): the wound explodes for an extra 8% of the target's max health and heals you by the same amount |

All damage dealt while holding the blade has **15% lifesteal**.

Pressing while aiming at **the air, the ground, a wall or a mob** all cast skills.
Blocks/mobs with their own interaction (chests, doors, crafting tables, beds, villagers, horses, boats...) still open/work as usual.

**Knowing which skill you can use:**
- The first time you hold the blade a title and a guide appear in chat. Type `/scriptevent aatrox:help` to see it again.
- The blade's tooltip (hover/select the blade in the inventory) lists how to use each skill.
- **The bar above the hotbar** shows:
  `Passive ✔  Press: Q  Q ✔  E ✔  W 3.2s  R ✔`, where **"Press: …"** is the skill that right-click would cast right now (it changes with your stance: `E (sprinting)`, `W (sneaking)  Jump: R`),
  followed by the cooldowns. Pressing while a skill is on cooldown plays a "clunk" and the bar shows `W on cooldown: 3.2s`.

### Particle effects

![Particle textures](preview_particles.png)

The addon has 29 custom particles with hand-made pixel art textures. Most are **multi-frame flipbooks**
that play through all their frames over the particle lifetime.

| Particle | Look | Used for |
|---|---|---|
| `aatrox:slash` | 4-frame fiery crescent: flare → brightest → cracking → breaks into sparks | Q slashes |
| `aatrox:shock_ring` | 3-frame fire ring: thick → thin → shattered | Q3 and R shockwaves |
| `aatrox:ground_mark` / `ground_mark_sweet` | 3-frame rune tiles appearing (frame → diamond → core), tinted red / orange | Q area and sweet spot warning |
| `aatrox:ult_aura` | 4-frame flickering flame | Aura while transformed |
| `aatrox:ember` | 4-frame ember: burns bright → fades to red specks | Fire rising from the blade, E dash trail |
| `aatrox:flash` | 3-frame star flash | Sweet spot explosions, passive, chain pull |
| `aatrox:hit_spark` | Long sparks flying along their velocity | Every skill hit |
| `aatrox:blood_burst` | Solid pixel blood drops falling to the ground | Sweet spot hits, passive, chain pull |
| `aatrox:chain_link` | Red-hot iron chain link | W chain and binding circle |
| `aatrox:lifesteal` | Glowing blood drops rising | Lifesteal |
| `aatrox:blood_orb` | Blood orbs flying from the target to you | Lifesteal |
| `aatrox:x_slash` | 3-frame X slash | Passive explosion, Q sweet spot hits |
| `aatrox:ground_crack` + `aatrox:debris` + `aatrox:smoke` | Lava-glowing cracked ground, bouncing debris, 4-frame red-black smoke | Q impacts, Q3 slam, W pull, R transform |
| `aatrox:fire_pillar` | Fire pillar erupting upward | Q3 sweet spot rim, 8 pillars around you on R |
| `aatrox:charge` | Embers gathering into the blade | When swinging Q, when starting R |
| `aatrox:afterimage` | Dark red afterimage | Left behind when dashing with E |
| `aatrox:chain_head` | Red-hot iron hook | Tip of the W chain |
| `aatrox:bind_circle` | Slowly spinning hexagram rune circle | Under a target hit by W (same size as the binding circle) |
| `aatrox:domain` | Large spiked World Ender circle with runes, spinning slowly | Under your feet for the whole R transformation |
| `aatrox:soul` | Screaming Darkin souls rising | Passive, Q3, transform, World Ender zone |
| `aatrox:lightning` | Jagged red lightning | Q3 slam, 4 bolts around you on R |
| `aatrox:glyph` | Rising rune glyphs (4 kinds) | W binding circle, World Ender zone rim |
| `aatrox:lava_drip` | Dripping lava | From the held blade |
| `aatrox:fear` | Fear skull | Above targets feared by R |
| `aatrox:blood_mist` | Spreading blood mist | Sweet spot hits, passive, inside the World Ender zone |
| `aatrox:fire_trail` | Fire burning on the ground | E dash while transformed, World Ender zone rim |

Besides particles, skills also **shake the screen** (Q3, sweet spot hits, passive, chain pull, R) and **flash the screen red** when transforming with R,
together with a roar (ender dragon + ravager) on transformation.

## Customization

All skill values live in [`AatroxBP/scripts/config.js`](AatroxBP/scripts/config.js): damage, cooldowns, range, PvP on/off (`pvp`)...
The blade's normal attack damage (9) is `minecraft:damage` in [`AatroxBP/items/darkin_blade.json`](AatroxBP/items/darkin_blade.json).

After editing, run `python3 build.py` to regenerate the textures, model, animations, particles and the `.mcaddon` file.
If you re-import into the game, bump `version` in both `manifest.json` files (otherwise Minecraft keeps the old version).

**3D model:** the blade shape is a front-view pixel drawing in [`sword_art.py`](sword_art.py)
(blade outline, teeth, horns, eye, grip; each material has its own depth in `MATERIALS`).
[`model.py`](model.py) extrudes the drawing into 3D cubes, merges same-material pixels into bigger cubes, paints the pixel art texture (palettes in `PALETTES`)
and exports the geometries: `darkin_blade.geo.json` (regular parts + the `eyelid` bone) and `darkin_blade_glow.geo.json` (glowing parts, texture `darkin_blade_glow.tga`),
plus the World Ender versions `darkin_blade_ult.geo.json` / `darkin_blade_ult_glow.geo.json` with the wings and horns from [`ult_parts.py`](ult_parts.py).
The `.geo.json` files can be opened in Blockbench for manual edits.

**Holding pose** is in [`AatroxRP/animations/darkin_blade.animation.json`](AatroxRP/animations/darkin_blade.animation.json).
Attachables are placed so that model point `(0, 24, 0)` sits in the hand (verified against the vanilla trident, shield and spyglass models),
and the blade's grip center is exactly there, so `position` only nudges it into the palm, `rotation` is the blade direction and `scale` its size
(third person: 0.5, first person: 0.3; transformed 0.62 / 0.34).
The wings and horns use the same rule with bones bound to the player's `'body'` and `'head'`.

**Skill animations** are generated by [`player_anims.py`](player_anims.py) into `AatroxRP/animations/aatrox_player.animation.json`, and the script plays them with `playAnimation`:
- third person: extra rotation/offset for the player bones, plus the desired blade direction (the wrist is solved to match)
- first person: the hand position and blade direction on screen; the script works out the arm motion
- the Q strike keyframe at 0.45 seconds matches `Q.windup` in `config.js`; if you change `windup`, move the keyframe too

**Particles:** edit [`particles.py`](particles.py) (sprite shapes, palettes, frame count, speed, lifetime) and run `build.py` again.

**Icons:** `art/item_icon.png` (inventory, 64×64) and `art/pack_icon.png` are rendered from the 3D model; replace them for different icons.

## Structure

```
bedrock/
├── AatroxBP/                  Behavior pack
│   ├── manifest.json
│   ├── items/                 darkin_blade.json + darkin_blade_ult.json (World Ender form)
│   ├── recipes/darkin_blade.json
│   └── scripts/
│       ├── main.js            all skill logic, input handling, guide
│       └── config.js          tuning values
├── AatroxRP/                  Resource pack
│   ├── attachables/           replace the held item with the 3D model
│   ├── animations/            holding pose, blinking, wings, player skill animations
│   ├── render_controllers/    draws the glowing layer
│   ├── models/entity/         3D models (.geo.json) + glowing layers
│   ├── particles/             29 custom particles
│   └── textures/              icon, model textures (.png + glowing .tga), particle texture
├── art/                       icons rendered from the 3D model
├── sword_art.py               front-view pixel drawing of the blade (shape)
├── ult_parts.py               World Ender wings and horns
├── model.py                   extrudes the drawings into 3D models + paints the pixel art texture
├── player_anims.py            designs + inverse-solves the player skill animations
├── particles.py               particle definitions + particle texture painting
├── build.py                   builds textures, models, animations, particles + packages the .mcaddon
└── dist/AatroxDarkinBlade.mcaddon
```

## Notes

- Stun = maximum-level Slowness; stunned targets can still jump. A stunned player cannot cast the blade's skills.
- Mobs that were just hit have a short invulnerability window (0.5 seconds); skill damage that lands inside it is retried automatically once the window ends.

## Troubleshooting

- **Pressing does nothing and there is no cooldown bar above the hotbar:** the script isn't running. Make sure the **Behavior Pack** is active (not just the Resource Pack) and the game is **1.21.90** or newer.
- **The cooldown bar is there but nothing casts:** check **"Press: …"** on the bar to see which skill will cast; if it is on cooldown the remaining time is shown. You can't cast while stunned.
- **The blade shows as a flat 2D sprite instead of the 3D model:** the Resource Pack isn't active or an old version is in use, see *Upgrading from an older version?* above.
- **To change the blade size / holding pose:** edit `scale` and `rotation` in `AatroxRP/animations/darkin_blade.animation.json`.
