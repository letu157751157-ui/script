"""Pack definitions: manifests, items, recipe, attachables, hold pose, render controller and language files.

Item variants (the script swaps between them, keeping durability/enchantments/name):
- toji:inverted_spear           normal spear
- toji:inverted_spear_awakened  Heavenly Restriction awakened: extra glowing layer along the edges
- toji:inverted_spear_thrown    spear flying on the Thousand-Mile Chain: only the chain stays in the hand
"""
import json
import os

VERSION = [1, 1, 0]
MIN_ENGINE = [1, 21, 90]
UUID = {
    "bp": "40e20d6e-1d50-49a8-bcfd-2df5de5e7686",
    "bp_data": "91a3c3ac-17dc-4195-a533-a0e957df1a31",
    "bp_script": "f550661d-0cef-4556-9fc8-5e434120a70e",
    "rp": "3632bd64-7766-4c6a-a8c3-822bb2413c01",
    "rp_res": "c5eb004a-c550-4bde-a4d0-3d41f87e6a51",
}

# Hold pose. Model point (0, 24, 0) (grip center) sits in the hand; the blade (+Y) points forward.
# Same orientation as the Darkin Blade addon (verified in game), smaller scale: the spear is a short weapon.
HOLD = {
    "first_person": {"position": [0.0, -1.5, -1.0], "rotation": [45.8, -45.8, -154.2], "scale": 0.32},
    "third_person": {"position": [0.0, -1.5, -1.0], "rotation": [90.0, 6.0, -90.0], "scale": 0.42},
}

VARIANTS = {
    "inverted_spear": {"name": "item.toji.inverted_spear.name", "geometry": "geometry.toji.isoh", "glow": False,
                       "visible": True},
    "inverted_spear_awakened": {"name": "item.toji.inverted_spear_awakened.name", "geometry": "geometry.toji.isoh",
                                "glow": True, "visible": False},
    "inverted_spear_thrown": {"name": "item.toji.inverted_spear_thrown.name", "geometry": "geometry.toji.isoh_thrown",
                              "glow": False, "visible": False},
}

LANG = {
    "en_US": {
        "item.toji.inverted_spear.name": "§fInverted Spear of Heaven",
        "item.toji.inverted_spear_awakened.name": "§fInverted Spear of Heaven §d(Awakened)",
        "item.toji.inverted_spear_thrown.name": "§fInverted Spear of Heaven §7(Thrown)",
        "toji.skill.thrust": "Nullifying Thrust",
        "toji.skill.chain": "Thousand-Mile Chain",
        "toji.skill.rush": "Heavenly Rush",
        "toji.skill.awaken": "Heavenly Restriction",
        "toji.skill.plunge": "Heaven-Splitting Plunge",
        "toji.skill.finisher": "Combo Finisher",
        "toji.short.thrust": "Thrust",
        "toji.short.chain": "Chain",
        "toji.short.rush": "Rush",
        "toji.bar.hold": "§7Hold %s",
        "toji.bar.awake": "§f§lAWAKENED %ss",
        "toji.bar.plunge_ready": "§dJump: Plunge",
        "toji.bar.plunge_used": "§8Plunge used",
        "toji.bar.press": "§fPress: §e%s",
        "toji.bar.combo": "§6Combo %s/4",
        "toji.bar.thrown": "§7Spear thrown...",
        "toji.notice.cast": "§f▶ %s",
        "toji.notice.cast_ult": "§d▶ %s",
        "toji.notice.cooldown": "§c%s on cooldown: %ss",
        "toji.notice.stunned": "§cYou are stunned!",
        "toji.notice.nullified": "§5Your effects were nullified!",
        "toji.title.name": "§fInverted Spear of Heaven",
        "toji.title.hint": "§7Right-click / tap to §fthrust§7 — hold it §f20s§7 to awaken",
        "toji.title.awaken": "§f§lHEAVENLY RESTRICTION",
        "toji.title.awaken_hint": "§7Awakened — §fjump§7 for §dHeaven-Splitting Plunge",
        "toji.guide.0": "§5━━━━━━ Inverted Spear of Heaven ━━━━━━",
        "toji.guide.1": "§7Hold the spear (mobile: right-click = §ftap the screen§7 / §fUse§7 button):",
        "toji.guide.2": "§f Right-click §7— §fNullifying Thrust§7: lunge and stab, pierces a line and strips all buffs",
        "toji.guide.3": "§f Sneak + right-click §7— §fThousand-Mile Chain§7: throw the spear; hit = yank the target, wall = grapple",
        "toji.guide.4": "§f Sprint + attack §7— §fHeavenly Rush§7: dash through enemies with 3 slashes",
        "toji.guide.5": "§f Hold 20s §7— §fHeavenly Restriction§7: awaken for 15s (speed, strength, halved cooldowns)",
        "toji.guide.6": "§f Hold 20s + jump §7— §dHeaven-Splitting Plunge§7: leap and drive the spear into the ground",
        "toji.guide.7": "§f Attack 4 times §7— the 4th hit is a spinning finisher. Every hit nullifies positive effects.",
        "toji.guide.8": "§7Type §f/scriptevent toji:help §7to see this again.",
    },
    "vi_VN": {
        "item.toji.inverted_spear.name": "§fThiên Nghịch Mâu",
        "item.toji.inverted_spear_awakened.name": "§fThiên Nghịch Mâu §d(Thức Tỉnh)",
        "item.toji.inverted_spear_thrown.name": "§fThiên Nghịch Mâu §7(Đã ném)",
        "toji.skill.thrust": "Đâm Vô Hiệu",
        "toji.skill.chain": "Xích Vạn Lý",
        "toji.skill.rush": "Thiên Dữ Tốc Trảm",
        "toji.skill.awaken": "Thiên Dữ Chú Phược",
        "toji.skill.plunge": "Giáng Thiên Nhất Kích",
        "toji.skill.finisher": "Đòn Kết Liễu",
        "toji.short.thrust": "Đâm",
        "toji.short.chain": "Xích",
        "toji.short.rush": "Trảm",
        "toji.bar.hold": "§7Cầm %s",
        "toji.bar.awake": "§f§lTHỨC TỈNH %ss",
        "toji.bar.plunge_ready": "§dNhảy: Giáng Thiên",
        "toji.bar.plunge_used": "§8Đã dùng Giáng Thiên",
        "toji.bar.press": "§fBấm: §e%s",
        "toji.bar.combo": "§6Combo %s/4",
        "toji.bar.thrown": "§7Mâu đang bay...",
        "toji.notice.cast": "§f▶ %s",
        "toji.notice.cast_ult": "§d▶ %s",
        "toji.notice.cooldown": "§c%s đang hồi: %ss",
        "toji.notice.stunned": "§cBạn đang bị choáng!",
        "toji.notice.nullified": "§5Hiệu ứng của bạn đã bị vô hiệu!",
        "toji.title.name": "§fThiên Nghịch Mâu",
        "toji.title.hint": "§7Chuột phải / chạm để §fđâm§7 — cầm §f20s§7 để thức tỉnh",
        "toji.title.awaken": "§f§lTHIÊN DỮ CHÚ PHƯỢC",
        "toji.title.awaken_hint": "§7Đã thức tỉnh — §fnhảy§7 để dùng §dGiáng Thiên Nhất Kích",
        "toji.guide.0": "§5━━━━━━ Thiên Nghịch Mâu ━━━━━━",
        "toji.guide.1": "§7Cầm mâu trên tay (điện thoại: chuột phải = §fchạm màn hình§7 / nút §fDùng§7):",
        "toji.guide.2": "§f Chuột phải §7— §fĐâm Vô Hiệu§7: lao tới đâm xuyên một hàng, xoá sạch buff của mục tiêu",
        "toji.guide.3": "§f Khuỵu + chuột phải §7— §fXích Vạn Lý§7: ném mâu; trúng địch = giật về, trúng tường = kéo mình tới",
        "toji.guide.4": "§f Chạy + chém §7— §fThiên Dữ Tốc Trảm§7: lướt xuyên kẻ địch, chém 3 nhát",
        "toji.guide.5": "§f Cầm 20s §7— §fThiên Dữ Chú Phược§7: thức tỉnh 15s (tốc độ, sức mạnh, hồi chiêu giảm nửa)",
        "toji.guide.6": "§f Cầm 20s + nhảy §7— §dGiáng Thiên Nhất Kích§7: nhảy vọt lên rồi cắm mâu xuống đất",
        "toji.guide.7": "§f Đánh 4 lần §7— đòn thứ 4 là cú xoay chém kết liễu. Mọi đòn đánh đều vô hiệu buff.",
        "toji.guide.8": "§7Gõ §f/scriptevent toji:help §7để xem lại.",
    },
}


def write_json(root, path, data):
    full = os.path.join(root, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def manifest(name, description, header_uuid, modules, dependencies):
    return {
        "format_version": 2,
        "header": {"name": name, "description": description, "uuid": header_uuid, "version": VERSION,
                   "min_engine_version": MIN_ENGINE},
        "modules": modules,
        "dependencies": dependencies,
    }


def item(identifier, variant):
    if variant["visible"]:
        category = {"category": "equipment", "group": "minecraft:itemGroup.name.sword"}
    else:
        category = {"category": "none"}
    return {
        "format_version": "1.21.90",
        "minecraft:item": {
            "description": {"identifier": identifier, "menu_category": category},
            "components": {
                "minecraft:icon": {"textures": {"default": "toji_inverted_spear"}},
                "minecraft:display_name": {"value": variant["name"]},
                "minecraft:hand_equipped": True,
                "minecraft:max_stack_size": 1,
                "minecraft:damage": {"value": 8},
                "minecraft:durability": {"max_durability": 3000},
                "minecraft:enchantable": {"slot": "sword", "value": 15},
                "minecraft:can_destroy_in_creative": False,
                "minecraft:tags": {"tags": ["minecraft:is_sword"]},
            },
        },
    }


def attachable(identifier, variant):
    description = {
        "identifier": identifier,
        "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"},
        "textures": {"default": "textures/entity/isoh", "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": variant["geometry"]},
        "animations": {
            "hold_first_person": "animation.toji.isoh.hold_first_person",
            "hold_third_person": "animation.toji.isoh.hold_third_person",
        },
        "scripts": {"animate": [{"hold_first_person": "c.is_first_person"}, {"hold_third_person": "!c.is_first_person"}]},
        "render_controllers": ["controller.render.item_default"],
    }
    if variant["glow"]:
        description["materials"]["glow"] = "entity_emissive"
        description["textures"]["glow"] = "textures/entity/isoh_glow"
        description["geometry"]["glow"] = "geometry.toji.isoh_glow"
        description["animations"]["pulse"] = "animation.toji.isoh.pulse"
        description["scripts"]["animate"].append("pulse")
        description["render_controllers"].append("controller.render.toji.isoh_glow")
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": description}}


def write_lang(root, pack):
    folder = os.path.join(root, pack, "texts")
    os.makedirs(folder, exist_ok=True)
    for code, entries in LANG.items():
        with open(os.path.join(folder, f"{code}.lang"), "w", encoding="utf-8") as f:
            for key, value in entries.items():
                f.write(f"{key}={value}\n")
    with open(os.path.join(folder, "languages.json"), "w", encoding="utf-8") as f:
        json.dump(list(LANG), f)
        f.write("\n")


def write_packs(root):
    write_json(root, "TojiBP/manifest.json", manifest(
        "§5Toji - Inverted Spear of Heaven §r(BP)",
        "Toji Fushiguro's Inverted Spear of Heaven with a JJS-style skill kit.",
        UUID["bp"],
        [{"type": "data", "uuid": UUID["bp_data"], "version": VERSION},
         {"type": "script", "language": "javascript", "uuid": UUID["bp_script"], "entry": "scripts/main.js",
          "version": VERSION}],
        [{"module_name": "@minecraft/server", "version": "2.0.0"}, {"uuid": UUID["rp"], "version": VERSION}],
    ))
    write_json(root, "TojiRP/manifest.json", manifest(
        "§5Toji - Inverted Spear of Heaven §r(RP)",
        "Model, textures, animations, particles and texts for the Inverted Spear of Heaven.",
        UUID["rp"],
        [{"type": "resources", "uuid": UUID["rp_res"], "version": VERSION}],
        [{"uuid": UUID["bp"], "version": VERSION}],
    ))

    for name, variant in VARIANTS.items():
        identifier = f"toji:{name}"
        write_json(root, f"TojiBP/items/{name}.json", item(identifier, variant))
        write_json(root, f"TojiRP/attachables/{name}.entity.json", attachable(identifier, variant))

    write_json(root, "TojiBP/recipes/inverted_spear.json", {
        "format_version": "1.20.10",
        "minecraft:recipe_shapeless": {
            "description": {"identifier": "toji:inverted_spear_recipe"},
            "tags": ["crafting_table"],
            "ingredients": [{"item": "minecraft:trident"}, {"item": "minecraft:echo_shard"},
                            {"item": "minecraft:chain"}, {"item": "minecraft:amethyst_shard"}],
            "result": {"item": "toji:inverted_spear"},
            "unlock": [{"item": "minecraft:echo_shard"}],
        },
    })

    write_json(root, "TojiRP/animations/isoh.animation.json", {"format_version": "1.10.0", "animations": {
        "animation.toji.isoh.hold_first_person": {"loop": True, "bones": {"isoh": HOLD["first_person"]}},
        "animation.toji.isoh.hold_third_person": {"loop": True, "bones": {"isoh": HOLD["third_person"]}},
        # Awakened: the spear breathes slightly
        "animation.toji.isoh.pulse": {"loop": True, "bones": {"spear": {"scale": "1 + math.sin(q.life_time * 540) * 0.015"}}},
    }})
    write_json(root, "TojiRP/render_controllers/isoh.render_controllers.json", {
        "format_version": "1.8.0",
        "render_controllers": {"controller.render.toji.isoh_glow": {
            "geometry": "Geometry.glow", "materials": [{"*": "Material.glow"}], "textures": ["Texture.glow"]}},
    })
    write_json(root, "TojiRP/textures/item_texture.json", {
        "resource_pack_name": "toji", "texture_name": "atlas.items",
        "texture_data": {"toji_inverted_spear": {"textures": "textures/items/inverted_spear"}},
    })
    write_lang(root, "TojiRP")
    print(f"Packs: v{'.'.join(map(str, VERSION))}, {len(VARIANTS)} item variants, {len(LANG)} languages")
