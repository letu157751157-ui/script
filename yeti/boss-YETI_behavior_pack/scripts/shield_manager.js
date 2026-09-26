import {
  EntityDamageCause,
  EntityEquippableComponent,
  EntityOnFireComponent,
  EquipmentSlot,
  GameMode,
  InputButton,
  ButtonState,
  ItemCooldownComponent,
  ItemDurabilityComponent,
  ItemEnchantableComponent,
  Player,
  system,
  world,
} from "@minecraft/server";

const SHIELD_COMPONENT = "item:shield_components";
const ANIMATION_BLOCK_MAIN = "animation.custom_shield.player.shield_block_main_hand";
const ANIMATION_BLOCK_OFF = "animation.custom_shield.player.shield_block_off_hand";

const SHIELD_BREAKERS = new Set(["minecraft:vindicator", "minecraft:piglin_brute", "minecraft:warden"]);

class ShieldManager {
  constructor() {
    this._registerEvents();
  }

  _registerEvents() {
    system.beforeEvents.startup.subscribe((data) => {
      data.itemComponentRegistry.registerCustomComponent(SHIELD_COMPONENT, {});
    });

    world.afterEvents.playerButtonInput.subscribe((e) => this._handleSneakInput(e));

    world.afterEvents.playerSwingStart.subscribe((e) => this._resetWarmup(e.player));

    world.beforeEvents.entityHurt.subscribe((e) => this._handleEntityHurt(e));

    world.beforeEvents.effectAdd.subscribe((e) => {
      if (e.entity.getDynamicProperty("shield_blocked_effect")) {
        e.cancel = true;
      }
    });
  }

  _handleSneakInput(event) {
    if (event.button !== InputButton.Sneak) return;

    const player = event.player;

    if (player.isSneaking) {
      if (player.getDynamicProperty("shield_warmup_id") !== undefined || player.getDynamicProperty("is_shielding")) return;

      const shieldData = this._getValidShield(player);
      if (!shieldData) return;

      const params = shieldData.item.getComponent(SHIELD_COMPONENT)?.customComponentParameters?.params || {};
      const delayInTicks = Math.max(1, Math.floor((params.warmup_delay || 0.25) * 20));

      const anim = shieldData.hand === "main_hand" ? ANIMATION_BLOCK_MAIN : ANIMATION_BLOCK_OFF;
      player.playAnimation(anim, {
        blendOutTime: 0.1,
        stopExpression: "!query.is_sneaking"
      });

      const timeoutId = system.runTimeout(() => {
        player.setDynamicProperty("shield_warmup_id", undefined);
        if (player.isSneaking) player.setDynamicProperty("is_shielding", true);
      }, delayInTicks);

      player.setDynamicProperty("shield_warmup_id", timeoutId);
    } else {
      this._resetWarmup(player);
      player.setDynamicProperty("is_shielding", false);
    }
  }

  _resetWarmup(player) {
    const currentDelayId = player.getDynamicProperty("shield_warmup_id");
    if (currentDelayId !== undefined) {
      system.clearRun(currentDelayId);
      player.setDynamicProperty("shield_warmup_id", undefined);
    }
  }

  _handleEntityHurt(event) {
    if (!(event.hurtEntity instanceof Player)) return;

    const player = event.hurtEntity;

    if (!player.getDynamicProperty("is_shielding") || !player.isSneaking) return;

    const shieldData = this._getValidShield(player);
    if (!shieldData) return;

    if (!this._isFacingAttacker(player, event.damageSource)) return;

    const isShieldBroken = this._checkShieldBreaker(event.damageSource);

    const params = shieldData.item.getComponent(SHIELD_COMPONENT)?.customComponentParameters?.params || {};
    const damageReduction = params.damage_reduction ?? 1.0;

    if (damageReduction >= 1.0) {
      event.cancel = true;
    } else {
      event.damage = Math.max(0, event.damage * (1.0 - damageReduction));
    }

    player.setDynamicProperty("shield_blocked_effect", true);

    system.run(() => {
      player.setDynamicProperty("shield_blocked_effect", false);

      if (player.hasComponent(EntityOnFireComponent.componentId)) player.extinguishFire();

      if (params.block_sound) player.dimension.playSound(params.block_sound, player.location);

      if (shieldData.item.hasComponent(ItemDurabilityComponent.componentId)) {
        const damageTaken = Math.max(1, Math.floor(event.damage * (params.durability_loss_multiplier ?? 1.0)));
        const updatedShield = this._reduceDurability(player, shieldData.item, damageTaken);
        shieldData.slot.setItem(updatedShield);
      }

      if (params.knockback && event.damageSource.damagingEntity && !event.damageSource.damagingProjectile) {
        const damageLocation = event.damageSource.damagingEntity.location;
        if (damageLocation) {
          this._applyKnockbackToAttacker(player, event.damageSource.damagingEntity, params.knockback, damageLocation);
        }
      }

      if (isShieldBroken) {
        const cooldown = shieldData.item.getComponent(ItemCooldownComponent.componentId);
        if (cooldown) cooldown.startCooldown(player);
        if (params.break_sound) player.dimension.playSound(params.break_sound, player.location);

        this._resetWarmup(player);
        player.setDynamicProperty("is_shielding", false);
      }
    });
  }

  _getValidShield(player) {
    const equippable = player.getComponent(EntityEquippableComponent.componentId);
    if (!equippable) return null;

    const checkSlot = (slotType, handName) => {
      const slot = equippable.getEquipmentSlot(slotType);
      const item = slot.getItem();
      if (!item || !item.hasComponent(SHIELD_COMPONENT)) return null;

      const cooldown = item.getComponent(ItemCooldownComponent.componentId);
      if (cooldown && cooldown.getCooldownTicksRemaining(player) > 0) return null;

      return { item, slot, hand: handName };
    };

    return checkSlot(EquipmentSlot.Offhand, "off_hand") || checkSlot(EquipmentSlot.Mainhand, "main_hand");
  }

  _isFacingAttacker(player, damageSource) {
    const attackerLoc = damageSource.damagingEntity?.location || damageSource.damagingProjectile?.location;
    if (!attackerLoc) return false;

    const playerLoc = player.location;
    const viewDir = player.getViewDirection();

    const viewDirLoc = {
      x: playerLoc.x + viewDir.x * 0.01,
      y: playerLoc.y,
      z: playerLoc.z + viewDir.z * 0.01
    };

    const pTotal = Math.abs(playerLoc.x - attackerLoc.x) + Math.abs(playerLoc.y - attackerLoc.y) + Math.abs(playerLoc.z - attackerLoc.z);
    const vTotal = Math.abs(viewDirLoc.x - attackerLoc.x) + Math.abs(viewDirLoc.y - attackerLoc.y) + Math.abs(viewDirLoc.z - attackerLoc.z);

    return vTotal <= pTotal;
  }

  _checkShieldBreaker(damageSource) {
    const attacker = damageSource.damagingEntity;
    if (!attacker) return false;

    if (SHIELD_BREAKERS.has(attacker.typeId)) {
      if (attacker.typeId === "minecraft:warden" && damageSource.cause !== EntityDamageCause.entityAttack) return false;
      return true;
    }

    const equippable = attacker.getComponent(EntityEquippableComponent.componentId);
    if (equippable?.getEquipmentSlot(EquipmentSlot.Mainhand).getItem()?.hasTag("minecraft:is_axe")) {
      return true;
    }

    return false;
  }

  _applyKnockbackToAttacker(player, attacker, knockbackParams, damageLocation) {
    const playerLoc = player.location;

    const total = Math.abs(damageLocation.x - playerLoc.x) + Math.abs(damageLocation.z - playerLoc.z);

    if (total === 0) return;

    try {
      const knockbackX = (damageLocation.x - playerLoc.x) / total * (knockbackParams.x ?? 0);
      const knockbackZ = (damageLocation.z - playerLoc.z) / total * (knockbackParams.x ?? 0);
      const knockbackY = knockbackParams.y ?? 0.1;

      attacker.applyKnockback({ x: knockbackX, z: knockbackZ }, knockbackY);
    } catch (e) { }
  }

  _reduceDurability(player, item, damageTaken) {
    if (player.getGameMode() === GameMode.Creative) return item;

    const durComp = item.getComponent(ItemDurabilityComponent.componentId);
    if (!durComp) return item;

    const unbreaking = item.getComponent(ItemEnchantableComponent.componentId)?.getEnchantment("unbreaking");

    if (unbreaking) {
      const chanceToIgnore = 100 / (unbreaking.level + 1);
      if ((Math.random() * 100) >= (100 - chanceToIgnore)) {
        return item;
      }
    }

    if (durComp.damage + damageTaken >= durComp.maxDurability) {
      player.dimension.playSound("random.break", player.location);
      return undefined;
    } else {
      durComp.damage += damageTaken;
      return item;
    }
  }
}


new ShieldManager();