import { PlayerPermissionLevel, system } from "@minecraft/server";
import { Tags } from "../core/Constants.js";
import { Roles } from "../domain/PlotSchema.js";
import { GlobalSettings } from "../config/GlobalSettings.js";

const adminCache = new Map();

export const Actions = {
  Break: "blockBreak",
  Place: "blockPlace",
  InteractBlock: "blockInteract",
  InteractEntity: "entityInteract",
  EntityHurt: "entityHurt",
  UseItem: "itemUse",
  VisitorEntry: "visitorEntry",
  Pvp: "pvp",
};

export const PermissionService = {
  isAdmin(player) {
    const tick = system.currentTick;
    let id;
    try {
      id = player.id;
      const cached = adminCache.get(id);
      if (cached !== undefined && cached.tick === tick) return cached.value;
    } catch {
      id = undefined;
    }

    let value = false;
    try {
      if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) value = true;
    } catch {}
    if (!value) {
      try {
        value = player.hasTag(Tags.admin);
      } catch {
        value = false;
      }
    }

    if (id !== undefined) adminCache.set(id, { tick, value });
    return value;
  },

  relationOf(player, plot) {
    if (plot.isOwner(player.id)) return Roles.Owner;
    if (plot.isTrusted(player.id)) return Roles.Trusted;
    return Roles.Visitor;
  },

  canManage(player, plot) {
    return this.isAdmin(player) || plot.isOwner(player.id);
  },

  canDelete(player, plot) {
    return this.isAdmin(player);
  },

  canTeleport(player, plot) {
    if (this.isAdmin(player)) return true;
    if (plot.isOwner(player.id)) return GlobalSettings.get("ownersCanTeleportAndSetSpawn");
    if (plot.isTrusted(player.id)) return true;
    return Boolean(plot.flags.visitorEntry);
  },

  plotAllows(plot, flag) {
    return Boolean(plot.flags[flag]);
  },

  groupAllows(group, rule) {
    return Boolean(group.rules?.[rule]);
  },

  can(player, plot, action) {
    const role = this.relationOf(player, plot);
    if (role === Roles.Owner) return true;

    if (role === Roles.Trusted) {
      const perms = plot.getTrusted(player.id)?.permissions;
      if (perms && action in perms) return Boolean(perms[action]);
      return false;
    }

    const f = plot.flags;
    if (action in f) return Boolean(f[action]);
    return false;
  },
};
