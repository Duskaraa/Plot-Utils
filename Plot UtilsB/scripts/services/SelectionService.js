import { system, world } from "@minecraft/server";
import { PlayerSessionManager } from "../session/PlayerSessionManager.js";
import { PlotBounds } from "../domain/PlotBounds.js";
import { Limits } from "../core/Constants.js";
import { floorVec } from "../utils/Vec3.js";
import { Logger } from "../core/Logger.js";

const groupAreaPrefix = "plotutils_group_selection_";
const groupAreaMargin = 8;

function groupAreaId(playerId) {
  return `${groupAreaPrefix}${String(playerId).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function removeGroupSelectionAreaById(playerId) {
  try {
    const manager = world.tickingAreaManager;
    const areaId = groupAreaId(playerId);
    if (manager.hasTickingArea(areaId)) manager.removeTickingArea(areaId);
  } catch (error) {
    Logger.warn(`Failed to remove temporary group selection ticking area for ${playerId}: ${error}`);
  }
}

async function ensureGroupSelectionArea(player, bounds, dimensionId) {
  if (!bounds) return;
  const areaId = groupAreaId(player.id);
  removeGroupSelectionAreaById(player.id);
  try {
    const manager = world.tickingAreaManager;
    const dimension = world.getDimension(dimensionId);
    const options = {
      dimension,
      from: {
        x: bounds.min.x - groupAreaMargin,
        y: bounds.min.y - groupAreaMargin,
        z: bounds.min.z - groupAreaMargin,
      },
      to: {
        x: bounds.max.x + groupAreaMargin,
        y: bounds.max.y + groupAreaMargin,
        z: bounds.max.z + groupAreaMargin,
      },
    };
    if (!manager.hasCapacity(options)) {
      Logger.warn(`No ticking area capacity for temporary group selection area ${areaId}.`);
      return;
    }
    await manager.createTickingArea(areaId, options);
    PlayerSessionManager.get(player).groupSelectionAreaId = areaId;
  } catch (error) {
    Logger.warn(`Failed to create temporary group selection ticking area ${areaId}: ${error}`);
  }
}

export const SelectionService = {
  setPoint(player, which, location, dimensionId) {
    const sel = PlayerSessionManager.get(player).selection;
    const session = PlayerSessionManager.get(player);

    if (sel.dimensionId && sel.dimensionId !== dimensionId) {
      if (session.selectionMode === "group") this.clearGroupSelectionArea(player);
      sel.pos1 = null;
      sel.pos2 = null;
    }

    sel.dimensionId = dimensionId;
    sel[which] = floorVec(location);
    sel.changedTick = system.currentTick;
    if (session.selectionMode === "group" && sel.pos1 && sel.pos2) {
      ensureGroupSelectionArea(player, new PlotBounds(sel.pos1, sel.pos2), sel.dimensionId);
    }
    return sel;
  },

  get(player) {
    return PlayerSessionManager.get(player).selection;
  },

  clear(player) {
    this.clearGroupSelectionArea(player);
    PlayerSessionManager.get(player).clearSelection();
  },

  clearGroupSelectionArea(player) {
    removeGroupSelectionAreaById(player.id);
    const session = PlayerSessionManager.peek(player.id);
    if (session) session.groupSelectionAreaId = null;
  },

  clearGroupSel(playerId) {
    removeGroupSelectionAreaById(playerId);
  },

  hasBoth(player) {
    const s = this.get(player);
    return Boolean(s.pos1 && s.pos2);
  },

  hasAny(player) {
    const s = this.get(player);
    return Boolean(s.pos1 || s.pos2);
  },

  bounds(player) {
    const s = this.get(player);
    return s.pos1 && s.pos2 ? new PlotBounds(s.pos1, s.pos2) : null;
  },

  validateSize(bounds) {
    if (bounds.maxAxisSpan > Limits.maxSelectionSpan) {
      return {
        ok: false,
        key: "plotutils.selection_too_large",
        params: [bounds.size.x, bounds.size.y, bounds.size.z],
      };
    }
    if (bounds.capacity > Limits.maxPlotVolume) {
      return { ok: false, key: "plotutils.plot_too_large_volume", params: [Limits.maxPlotVolume] };
    }
    return { ok: true };
  },
};
