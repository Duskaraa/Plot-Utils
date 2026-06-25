import { EntityComponentTypes, EquipmentSlot, system, world } from "@minecraft/server";
import { PlotRegistry } from "../domain/PlotRegistry.js";
import { PlotGroupDatabase } from "../data/PlotGroupDatabase.js";
import { PermissionService, Actions } from "./PermissionService.js";
import { FeedbackService } from "./FeedbackService.js";
import { FlagKeys } from "../domain/PlotSchema.js";
import { GlobalSettings } from "../config/GlobalSettings.js";
import { PlayerSessionManager } from "../session/PlayerSessionManager.js";
import { OnlinePlayers } from "../session/OnlinePlayers.js";
import { ToolItems } from "../core/Constants.js";
import { Logger } from "../core/Logger.js";
import { LanguageService } from "./LanguageService.js";

const armorStandId = "minecraft:armor_stand";
const armorStandRestoreTag = "plotutils_restored_armor_stand";
const equipmentSlots = [
  EquipmentSlot.Head,
  EquipmentSlot.Chest,
  EquipmentSlot.Legs,
  EquipmentSlot.Feet,
  EquipmentSlot.Mainhand,
  EquipmentSlot.Offhand,
];
const playerPlotIds = new Map();

function bypassesProtection(player) {
  if (!PermissionService.isAdmin(player)) return false;
  if (GlobalSettings.get("adminsAlwaysBypass")) return true;
  return Boolean(PlayerSessionManager.peek(player.id)?.toolboxLayout);
}

function deniedAreaName(player, dimensionId, location, action) {
  const plot = PlotRegistry.getPlotAt(dimensionId, location);
  if (plot) return PermissionService.can(player, plot, action) ? null : plot.name;

  const group = PlotGroupDatabase.getGroupAt(dimensionId, location);
  if (group) return PermissionService.groupAllows(group, action) ? null : group.name;

  return null;
}

function areaFlagAllows(dimensionId, location, flag) {
  const plot = PlotRegistry.getPlotAt(dimensionId, location);
  if (plot) return PermissionService.plotAllows(plot, flag);

  const group = PlotGroupDatabase.getGroupAt(dimensionId, location);
  if (group) return PermissionService.groupAllows(group, flag);

  return true;
}

function guardBlock(event, player, block, action, messageKey) {
  try {
    if (!player || !block) return;
    if (bypassesProtection(player)) return;
    if (ToolItems.has(event.itemStack?.typeId)) return;

    const areaName = deniedAreaName(player, block.dimension.id, block.location, action);
    if (!areaName) return;

    event.cancel = true;
    FeedbackService.deny(player, messageKey, [areaName]);
  } catch (error) {
    Logger.error("guardBlock blew up:", error);
  }
}

function guardAt(event, player, location, action, messageKey) {
  try {
    if (!player || !location) return;
    if (bypassesProtection(player)) return;

    const areaName = deniedAreaName(player, OnlinePlayers.dimensionId(player), location, action);
    if (!areaName) return;

    event.cancel = true;
    FeedbackService.deny(player, messageKey, [areaName]);
  } catch (error) {
    Logger.error("guardAt blew up:", error);
  }
}

function canDamageEntity(player, target) {
  if (!player || !target || player.typeId !== "minecraft:player") return true;
  if (bypassesProtection(player)) return true;

  if (target.typeId === "minecraft:player") {
    const plot = PlotRegistry.getPlotAt(target.dimension.id, target.location);
    if (plot) return true;
    const group = PlotGroupDatabase.getGroupAt(target.dimension.id, target.location);
    return !group || PermissionService.groupAllows(group, Actions.Pvp);
  }
  const action = Actions.EntityHurt;
  return deniedAreaName(player, target.dimension.id, target.location, action) === null;
}

function snapshotArmorStand(entity) {
  try {
    if (!entity || entity.typeId !== armorStandId) return undefined;
    const equippable = entity.getComponent(EntityComponentTypes.Equippable);
    const equipment = [];
    if (equippable) {
      for (const slot of equipmentSlots) {
        const item = equippable.getEquipment(slot);
        if (item) equipment.push([slot, item]);
      }
    }

    return {
      dimension: entity.dimension,
      location: { ...entity.location },
      rotation: entity.getRotation(),
      nameTag: entity.nameTag,
      tags: entity.getTags().filter((tag) => tag !== armorStandRestoreTag),
      equipment,
    };
  } catch {
    return undefined;
  }
}

function restoreArmorStand(snapshot) {
  if (!snapshot) return;
  try {
    const stand = snapshot.dimension.spawnEntity(armorStandId, snapshot.location);
    stand.setRotation(snapshot.rotation);
    if (snapshot.nameTag) stand.nameTag = snapshot.nameTag;
    stand.addTag(armorStandRestoreTag);
    for (const tag of snapshot.tags) {
      try {
        stand.addTag(tag);
      } catch {}
    }

    const equippable = stand.getComponent(EntityComponentTypes.Equippable);
    if (equippable) {
      for (const [slot, item] of snapshot.equipment) {
        try {
          equippable.setEquipment(slot, item);
        } catch (error) {
          Logger.warn("couldn't restore armor stand equipment slot:", slot, error);
        }
      }
    }
  } catch (error) {
    Logger.error("couldn't restore armor stand:", error);
  }
}

function removeNearbyArmorStandDrops(snapshot) {
  if (!snapshot) return;
  try {
    const items = snapshot.dimension.getEntities({
      type: "minecraft:item",
      location: snapshot.location,
      maxDistance: 2,
    });
    for (const item of items) {
      try {
        item.remove();
      } catch {}
    }
  } catch {}
}

function repairArmorStandIfBroken(stand, snapshot) {
  system.run(() => {
    let needsRestore = false;
    try {
      needsRestore = !stand?.isValid;
    } catch {
      needsRestore = true;
    }
    if (!needsRestore) return;
    removeNearbyArmorStandDrops(snapshot);
    restoreArmorStand(snapshot);
  });
}

function onItemUse(event) {
  try {
    const player = event.source;
    if (!player || bypassesProtection(player)) return;
    if (ToolItems.has(event.itemStack?.typeId)) return;

    const areaName = deniedAreaName(
      player,
      OnlinePlayers.dimensionId(player),
      player.location,
      Actions.UseItem,
    );
    if (!areaName) return;

    event.cancel = true;
    FeedbackService.deny(player, "plotutils.cannot_use", [areaName]);
  } catch (error) {
    Logger.error("item-use guard failed:", error);
  }
}

function onEntityHurt(event) {
  try {
    const hurt = event.hurtEntity;
    if (!hurt) return;
    const source = event.damageSource;
    const attacker = source?.damagingEntity;

    if (source?.damagingProjectile && !PlotRegistry.getPlotAt(hurt.dimension.id, hurt.location)) {
      const group = PlotGroupDatabase.getGroupAt(hurt.dimension.id, hurt.location);
      if (group && !group.allows("projectiles")) {
        if (attacker?.typeId === "minecraft:player" && bypassesProtection(attacker)) return;
        event.cancel = true;
        if (attacker?.typeId === "minecraft:player") {
          FeedbackService.deny(attacker, "plotutils.cannot_projectile", [group.name]);
        }
        return;
      }
    }

    if (attacker?.typeId !== "minecraft:player") return;
    if (bypassesProtection(attacker)) return;

    let action = Actions.EntityHurt;
    let areaName;
    if (hurt.typeId === "minecraft:player") {
      action = Actions.Pvp;
      if (PlotRegistry.getPlotAt(hurt.dimension.id, hurt.location)) return;
      const group = PlotGroupDatabase.getGroupAt(hurt.dimension.id, hurt.location);
      areaName = group && !PermissionService.groupAllows(group, action) ? group.name : null;
    } else {
      areaName = deniedAreaName(attacker, hurt.dimension.id, hurt.location, action);
    }
    if (!areaName) return;

    event.cancel = true;
    FeedbackService.deny(
      attacker,
      action === Actions.Pvp ? "plotutils.cannot_pvp" : "plotutils.cannot_hurt",
      [areaName],
    );
  } catch (error) {
    Logger.error("entity-hurt guard failed:", error);
  }
}

function onEntityHitEntity(event) {
  try {
    const attacker = event.damagingEntity;
    const target = event.hitEntity;
    if (target?.typeId !== armorStandId) return;
    if (canDamageEntity(attacker, target)) return;

    const snapshot = snapshotArmorStand(target);
    const plot = PlotRegistry.getPlotAt(target.dimension.id, target.location);
    const group = plot ? undefined : PlotGroupDatabase.getGroupAt(target.dimension.id, target.location);
    const areaName = plot?.name ?? group?.name;
    if (attacker?.typeId === "minecraft:player" && areaName) {
      FeedbackService.deny(attacker, "plotutils.cannot_hurt", [areaName]);
    }

    repairArmorStandIfBroken(target, snapshot);
  } catch (error) {
    Logger.error("armor stand hit handler failed:", error);
  }
}

function onEntityDie(event) {
  try {
    const dead = event.deadEntity;
    if (dead?.typeId !== armorStandId) return;
    const attacker = event.damageSource?.damagingEntity;
    if (canDamageEntity(attacker, dead)) return;

    const snapshot = snapshotArmorStand(dead);
    const plot = PlotRegistry.getPlotAt(dead.dimension.id, dead.location);
    const group = plot ? undefined : PlotGroupDatabase.getGroupAt(dead.dimension.id, dead.location);
    const areaName = plot?.name ?? group?.name;
    if (attacker?.typeId === "minecraft:player" && areaName) {
      FeedbackService.deny(attacker, "plotutils.cannot_hurt", [areaName]);
    }

    system.run(() => {
      removeNearbyArmorStandDrops(snapshot);
      restoreArmorStand(snapshot);
    });
  } catch (error) {
    Logger.error("armor stand death handler failed:", error);
  }
}

function onExplosion(event) {
  try {
    const dimId = event.dimension?.id;
    if (!dimId) return;
    const blocks = event.getImpactedBlocks();
    if (!blocks || blocks.length === 0) return;

    const kept = [];
    let changed = false;
    for (const block of blocks) {
      if (!areaFlagAllows(dimId, block.location, FlagKeys.explosions)) {
        changed = true;
        continue;
      }
      kept.push(block);
    }
    if (changed) event.setImpactedBlocks(kept);
  } catch (error) {
    Logger.error("explosion guard failed:", error);
  }
}

function onEntitySpawn(event) {
  try {
    const entity = event.entity;

    if (!entity || entity.typeId === "minecraft:player" || entity.typeId === "minecraft:item") {
      return;
    }
    const dimId = entity.dimension.id;
    if (PlotRegistry.getPlotAt(dimId, entity.location)) return;
    const group = PlotGroupDatabase.getGroupAt(dimId, entity.location);
    if (!group || group.allows("hostileSpawn")) return;

    const family = entity.getComponent("minecraft:type_family");
    if (!family?.hasTypeFamily?.("monster")) return;
    entity.remove();
  } catch {}
}

function onProjectileHit(event) {
  try {
    const projectile = event.projectile;
    if (!projectile?.isValid) return;
    const dimId = projectile.dimension?.id;
    if (!dimId) return;

    if (PlotRegistry.getPlotAt(dimId, projectile.location)) return;
    const group = PlotGroupDatabase.getGroupAt(dimId, projectile.location);
    if (!group || group.allows("projectiles")) return;

    const shooter = event.source;
    if (shooter?.typeId === "minecraft:player") {
      if (bypassesProtection(shooter)) return;
      FeedbackService.deny(shooter, "plotutils.cannot_projectile", [group.name]);
    }
    projectile.remove();
  } catch (error) {
    Logger.error("projectile guard failed:", error);
  }
}

function pushVisitorOut(player, plot) {
  try {
    const center = plot.bounds?.center;
    if (!center) return;
    const dx = player.location.x - center.x;
    const dz = player.location.z - center.z;
    const length = Math.sqrt(dx * dx + dz * dz) || 1;
    player.applyKnockback({ x: (dx / length) * 2.5, z: (dz / length) * 2.5 }, 0.4);
    FeedbackService.deny(player, "plotutils.cannot_enter", [plot.name]);
  } catch (error) {
    Logger.error("failed to push visitor out:", error);
  }
}

function enforceVisitorEntry() {
  for (const player of OnlinePlayers.list()) {
    try {
      if (bypassesProtection(player)) continue;
      const plot = PlotRegistry.getPlotAt(OnlinePlayers.dimensionId(player), player.location);
      if (!plot) continue;
      if (PermissionService.can(player, plot, Actions.VisitorEntry)) continue;
      pushVisitorOut(player, plot);
    } catch (error) {
      Logger.error("visitor-entry sweep failed for a player:", error);
    }
  }
}

function entryOwner(plot) {
  if (plot.hideOwnerName) return "plotutils.owner_hidden";
  if (!plot.hasOwner()) return "plotutils.owner_undefined";
  return plot.ownerName ? { text: plot.ownerName } : "plotutils.owner_unknown";
}

function announcePlotEntry() {
  for (const player of OnlinePlayers.list()) {
    try {
      const plot = PlotRegistry.getPlotAt(OnlinePlayers.dimensionId(player), player.location);
      const previousId = playerPlotIds.get(player.id) ?? null;
      const currentId = plot?.id ?? null;
      if (previousId === currentId) continue;
      if (currentId) playerPlotIds.set(player.id, currentId);
      else playerPlotIds.delete(player.id);
      if (!plot || !GlobalSettings.get("showPlotEntryMessage")) continue;
      const owner = entryOwner(plot);
      FeedbackService.notify(player, "plotutils.plot_entry", [
        plot.name,
        typeof owner === "string" ? LanguageService.t(owner) : owner,
      ]);
    } catch (error) {
      Logger.error("plot-entry announcement failed for a player:", error);
    }
  }
}

export const ProtectionService = {
  subscribe() {
    const be = world.beforeEvents;
    const ae = world.afterEvents;

    be.playerBreakBlock.subscribe((e) =>
      guardBlock(e, e.player, e.block, Actions.Break, "plotutils.cannot_break"),
    );
    be.playerPlaceBlock.subscribe((e) =>
      guardBlock(e, e.player, e.block, Actions.Place, "plotutils.cannot_place"),
    );
    be.itemUse.subscribe(onItemUse);
    be.playerInteractWithBlock.subscribe((e) => {
      const usingItem = Boolean(e.itemStack);
      guardBlock(
        e,
        e.player,
        e.block,
        usingItem ? Actions.UseItem : Actions.InteractBlock,
        usingItem ? "plotutils.cannot_use" : "plotutils.cannot_interact",
      );
    });
    be.playerInteractWithEntity.subscribe((e) =>
      guardAt(e, e.player, e.target?.location, Actions.InteractEntity, "plotutils.cannot_interact"),
    );
    be.entityHurt?.subscribe(onEntityHurt);
    be.explosion?.subscribe(onExplosion);

    ae.entitySpawn?.subscribe(onEntitySpawn);
    ae.entityHitEntity?.subscribe(onEntityHitEntity);
    ae.entityDie?.subscribe(onEntityDie);
    ae.projectileHitBlock?.subscribe(onProjectileHit);
    ae.projectileHitEntity?.subscribe(onProjectileHit);

    system.runInterval(enforceVisitorEntry, 10);
    system.runInterval(announcePlotEntry, 10);

    Logger.info("Protection events subscribed.");
  },

  forgetPlayer(playerId) {
    FeedbackService.forgetPlayer(playerId);
    playerPlotIds.delete(playerId);
  },
};
