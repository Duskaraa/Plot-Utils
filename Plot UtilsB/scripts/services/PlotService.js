import { Plot } from "../domain/Plot.js";
import { OnlinePlayers } from "../session/OnlinePlayers.js";
import { PlotBounds } from "../domain/PlotBounds.js";
import { PlotDatabase } from "../data/PlotDatabase.js";
import { PlotRegistry } from "../domain/PlotRegistry.js";
import { PermissionService } from "./PermissionService.js";
import { FeedbackService } from "./FeedbackService.js";
import { SelectionService } from "./SelectionService.js";
import { TeleportService } from "./TeleportService.js";
import { validateDisplayName, validatePlotId } from "../domain/PlotValidation.js";
import { uniqueIdFromName } from "../utils/Ids.js";
import { PermissionError, ValidationError, NotFoundError } from "../core/Errors.js";
import { Limits } from "../core/Constants.js";
import { DefaultPlotSettings } from "../config/DefaultPlotSettings.js";
import { GlobalSettings } from "../config/GlobalSettings.js";
import { PlotGroupService } from "./PlotGroupService.js";
import { MaintenanceService } from "./MaintenanceService.js";

const subgates = new Set([
  "ownersCanAddTrustedPlayers",
  "ownersCanRemoveTrustedPlayers",
  "ownersCanEditTrustedPlayerPermissions",
]);

function onlineById(playerId) {
  if (!playerId) return undefined;
  return OnlinePlayers.getById(playerId);
}

function notifyPlayer(playerId, key, params = []) {
  const target = onlineById(playerId);
  if (target) FeedbackService.message(target, key, params);
}

class PlotServiceImpl {
  getById(id) {
    return PlotDatabase.get(id);
  }

  requireById(id) {
    const plot = PlotDatabase.get(id);
    if (!plot) throw new NotFoundError("plotutils.error.plot_not_found");
    return plot;
  }

  getPlotAt(dimensionId, location) {
    return PlotRegistry.getPlotAt(dimensionId, location);
  }

  listForPlayer(playerId) {
    return PlotRegistry.listForPlayer(playerId);
  }
  listByOwner(ownerId) {
    return PlotRegistry.listByOwner(ownerId);
  }
  all() {
    return PlotRegistry.all();
  }

  createFromSelection(player, options) {
    if (!PermissionService.isAdmin(player)) {
      throw new PermissionError("plotutils.permission.denied");
    }

    const sel = SelectionService.get(player);
    if (!sel.pos1 || !sel.pos2) throw new ValidationError("plotutils.set_positions");

    const bounds = new PlotBounds(sel.pos1, sel.pos2);
    const sz = SelectionService.validateSize(bounds);
    if (!sz.ok) throw new ValidationError(sz.key, sz.params);

    const name = String(options.name ?? "").trim();
    const nameErr = validateDisplayName(name);
    if (nameErr) throw new ValidationError(nameErr);

    const dimensionId = sel.dimensionId ?? player.dimension.id;

    const overlaps = PlotRegistry.findOverlaps(dimensionId, bounds);
    if (overlaps.length > 0) {
      throw new ValidationError("plotutils.create.error.overlap", [overlaps[0].name]);
    }

    if (PlotDatabase.size >= Limits.maxPlotsTotal) {
      throw new ValidationError("plotutils.error.too_many_plots", [Limits.maxPlotsTotal]);
    }

    let id = String(options.id ?? "").trim();
    if (id) {
      const idErr = validatePlotId(id, (candidate) => PlotDatabase.has(candidate));
      if (idErr) throw new ValidationError(idErr);
    } else {
      id = uniqueIdFromName(name, (candidate) => PlotDatabase.has(candidate));
    }

    const plot = new Plot({
      id,
      name,
      ownerId: options.ownerId ?? null,
      ownerName: options.ownerName ?? null,
      dimensionId,
      bounds,
      flags: DefaultPlotSettings.buildInitialFlags(options.plotFlags),
      metadata: {
        createdBy: { id: player.id, name: player.name },
      },
    });

    PlotDatabase.add(plot);
    if (options.groupId) PlotGroupService.assignPlotToGroup(plot, options.groupId);
    notifyPlayer(plot.ownerId, "plotutils.notify.owner.assigned", [plot.name, player.name]);
    SelectionService.clear(player);
    return plot;
  }

  assignOwner(player, plotId, targetId, targetName) {
    const plot = this.requireById(plotId);
    if (
      !PermissionService.isAdmin(player) &&
      (!plot.isOwner(player.id) || !GlobalSettings.get("ownersCanTransferOwnership"))
    ) {
      throw new PermissionError("plotutils.permission.denied");
    }
    const prevId = plot.ownerId;
    plot.setOwner(targetId ?? null, targetName ?? null);
    PlotDatabase.update(plot, "owner");
    if (prevId && prevId !== targetId) {
      notifyPlayer(prevId, "plotutils.notify.owner.removed", [plot.name, player.name]);
    }
    if (targetId && prevId !== targetId) {
      notifyPlayer(targetId, "plotutils.notify.owner.assigned", [plot.name, player.name]);
    }
    return plot;
  }

  findSelectionOverlap(player) {
    const sel = SelectionService.get(player);
    if (!sel.pos1 || !sel.pos2) return undefined;

    const dimensionId = sel.dimensionId ?? player.dimension.id;
    const bounds = new PlotBounds(sel.pos1, sel.pos2);
    return PlotRegistry.findOverlaps(dimensionId, bounds)[0];
  }

  deletePlot(player, plotId) {
    const plot = this.requireById(plotId);
    if (!PermissionService.canDelete(player, plot)) {
      throw new PermissionError("plotutils.permission.denied");
    }
    PlotDatabase.delete(plot.id);
    return plot;
  }

  deleteAllPlots(player) {
    if (!PermissionService.isAdmin(player)) {
      throw new PermissionError("plotutils.permission.denied");
    }
    return PlotDatabase.clear("admin-clear");
  }

  renamePlot(player, plotId, name) {
    const plot = this.#requireManageable(player, plotId);
    this.#requireOwnerCapability(player, plot, "ownersCanChangeDisplayName");
    const trimmed = String(name ?? "").trim();
    const err = validateDisplayName(trimmed);
    if (err) throw new ValidationError(err);
    plot.rename(trimmed);
    PlotDatabase.update(plot, "rename");
    return plot;
  }

  setFlag(player, plotId, flagKey, value) {
    const plot = this.#requireManageable(player, plotId);

    if (!PermissionService.isAdmin(player) && plot.isOwner(player.id)) {
      this.#requireOwnerCapability(player, plot, "ownersCanEditVisitorPermissions");
    }
    if (!plot.setFlag(flagKey, value)) throw new ValidationError("plotutils.flag.error.unknown");
    PlotDatabase.update(plot, "flag");
    return plot;
  }

  setSpawn(player, plotId, location) {
    const plot = this.#requireManageable(player, plotId);
    this.#requireOwnerCapability(player, plot, "ownersCanTeleportAndSetSpawn");
    if (location && !plot.contains(location)) {
      throw new ValidationError("plotutils.spawn.error.outside");
    }
    plot.setSpawn(location);
    PlotDatabase.update(plot, "spawn");
    return plot;
  }

  setHideOwnerName(player, plotId, value) {
    const plot = this.#requireManageable(player, plotId);
    this.#requireOwnerCapability(player, plot, "ownersCanHideOwnerName");
    plot.setHideOwnerName(value);
    PlotDatabase.update(plot, "hide-owner");
    return plot;
  }

  addTrusted(player, plotId, targetId, targetName) {
    const plot = this.#requireManageable(player, plotId);
    this.#requireOwnerCapability(player, plot, "ownersCanAddTrustedPlayers");
    if (!targetId) throw new ValidationError("plotutils.trusted.error.not_found");
    if (plot.isOwner(targetId)) throw new ValidationError("plotutils.trusted.error.is_owner");
    if (!plot.addTrusted(targetId, targetName)) {
      throw new ValidationError("plotutils.trusted.error.already");
    }
    PlotDatabase.update(plot, "trusted-add");
    notifyPlayer(targetId, "plotutils.notify.trusted.added", [plot.name, player.name]);
    return plot;
  }

  removeTrusted(player, plotId, targetId) {
    const plot = this.#requireManageable(player, plotId);
    this.#requireOwnerCapability(player, plot, "ownersCanRemoveTrustedPlayers");
    const trusted = plot.getTrusted(targetId);
    if (!plot.removeTrusted(targetId)) {
      throw new ValidationError("plotutils.trusted.error.not_trusted");
    }
    PlotDatabase.update(plot, "trusted-remove");
    notifyPlayer(trusted?.player.id ?? targetId, "plotutils.notify.trusted.removed", [plot.name, player.name]);
    return plot;
  }

  setTrustedPermission(player, plotId, targetId, key, value) {
    const plot = this.#requireManageable(player, plotId);
    this.#requireOwnerCapability(player, plot, "ownersCanEditTrustedPlayerPermissions");
    if (!plot.setTrustedPermission(targetId, key, value)) {
      throw new ValidationError("plotutils.permission.error.unknown");
    }
    PlotDatabase.update(plot, "trusted-permission");
    return plot;
  }

  teleport(player, plotId) {
    const plot = this.requireById(plotId);
    if (!PermissionService.canTeleport(player, plot)) {
      throw new PermissionError("plotutils.permission.denied");
    }
    if (!TeleportService.teleportToPlot(player, plot)) {
      throw new ValidationError("plotutils.teleport.error");
    }
    return plot;
  }

  ownerCan(player, plot, cap) {
    if (PermissionService.isAdmin(player)) return true;
    if (!plot.isOwner(player.id)) return false;
    if (subgates.has(cap) && !GlobalSettings.get("ownersCanManageTrustedPlayers")) {
      return false;
    }
    return GlobalSettings.get(cap);
  }

  reload(player) {
    if (!PermissionService.isAdmin(player)) throw new PermissionError("plotutils.permission.denied");
    MaintenanceService.reloadAll();
  }

  stats() {
    return { plots: PlotDatabase.size };
  }

  #requireManageable(player, plotId) {
    const plot = this.requireById(plotId);
    if (!PermissionService.canManage(player, plot)) {
      throw new PermissionError("plotutils.permission.denied");
    }
    return plot;
  }

  #requireOwnerCapability(player, plot, cap) {
    if (!this.ownerCan(player, plot, cap)) {
      throw new PermissionError("plotutils.permission.denied");
    }
  }
}

export const PlotService = new PlotServiceImpl();
