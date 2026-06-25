import { PlotGroup } from "../domain/PlotGroup.js";
import { PlotBounds } from "../domain/PlotBounds.js";
import { PlotGroupDatabase } from "../data/PlotGroupDatabase.js";
import { PlotDatabase } from "../data/PlotDatabase.js";
import { PlotRegistry } from "../domain/PlotRegistry.js";
import { PermissionService } from "./PermissionService.js";
import { SelectionService } from "./SelectionService.js";
import { GroupSettings } from "../config/GroupSettings.js";
import { GroupRuleKeys } from "../domain/PlotSchema.js";
import { validatePlotId } from "../domain/PlotValidation.js";
import { uniqueIdFromName } from "../utils/Ids.js";
import { PermissionError, ValidationError } from "../core/Errors.js";

class PlotGroupServiceImpl {
  all() {
    return PlotGroupDatabase.all();
  }

  getById(id) {
    return PlotGroupDatabase.get(id);
  }

  getGroupAt(dimensionId, location) {
    return PlotGroupDatabase.getGroupAt(dimensionId, location);
  }

  requireById(id) {
    const group = PlotGroupDatabase.get(id);
    if (!group) throw new ValidationError("plotutils.group.error.not_found");
    return group;
  }

  stats() {
    return { groups: PlotGroupDatabase.size };
  }

  analyzeSelection(player) {
    const sel = SelectionService.get(player);
    if (!sel.pos1 || !sel.pos2) throw new ValidationError("plotutils.set_positions");

    const bounds = new PlotBounds(sel.pos1, sel.pos2);
    const dimensionId = sel.dimensionId ?? player.dimension.id;
    const plots = PlotRegistry.findOverlaps(dimensionId, bounds);
    const contained = plots.filter((plot) => bounds.containsBounds(plot.bounds));
    const partial = plots.filter((plot) => !bounds.containsBounds(plot.bounds));
    const groups = PlotGroupDatabase.all().filter(
      (group) => group.dimensionId === dimensionId && group.bounds?.intersects(bounds),
    );
    return { bounds, dimensionId, contained, partial, groups };
  }

  findContainingGroup(dimensionId, bounds) {
    if (!bounds) return undefined;
    return PlotGroupDatabase.all().find(
      (group) => group.dimensionId === dimensionId && group.bounds?.containsBounds(bounds),
    );
  }

  findGroupOverlap(dimensionId, bounds) {
    if (!bounds) return { containing: undefined, partial: undefined };
    let partial;
    for (const group of PlotGroupDatabase.all()) {
      if (group.dimensionId !== dimensionId || !group.bounds?.intersects(bounds)) continue;
      if (group.bounds.containsBounds(bounds)) return { containing: group, partial: undefined };
      partial ??= group;
    }
    return { containing: undefined, partial };
  }

  _linkPlot(group, plot, reason) {
    let touched = false;
    if (!group.plotIds.includes(plot.id)) {
      group.plotIds.push(plot.id);
      group.updatedAt = Date.now();
      PlotGroupDatabase.add(group);
      touched = true;
    }
    if (plot.metadata?.groupId !== group.id) {
      plot.metadata = { ...plot.metadata, groupId: group.id };
      PlotDatabase.update(plot, reason);
      touched = true;
    }
    return touched;
  }

  _unlinkPlot(group, plot, reason) {
    const index = group.plotIds.indexOf(plot.id);
    if (index !== -1) {
      group.plotIds.splice(index, 1);
      group.updatedAt = Date.now();
      PlotGroupDatabase.add(group);
    }
    if (plot.metadata?.groupId === group.id) {
      const { groupId, groupName, ...metadata } = plot.metadata;
      plot.metadata = metadata;
      PlotDatabase.update(plot, reason);
    }
  }

  assignPlotToGroup(plot, groupId) {
    const group = this.requireById(groupId);
    if (group.dimensionId !== plot.dimensionId || !group.bounds?.containsBounds(plot.bounds)) {
      throw new ValidationError("plotutils.group.error.plot_outside_group", [group.name]);
    }
    this._linkPlot(group, plot, "group-assign");
    return group;
  }

  rename(player, groupId, rawName) {
    if (!PermissionService.isAdmin(player)) {
      throw new PermissionError("plotutils.permission.denied");
    }
    const group = this.requireById(groupId);
    const name = String(rawName ?? "").trim();
    if (!name) throw new ValidationError("plotutils.group.error.name_required");
    if (name.length > 32) throw new ValidationError("plotutils.group.error.name_length");
    group.name = name;
    group.updatedAt = Date.now();
    PlotGroupDatabase.add(group);
    return group;
  }

  setRules(player, groupId, partialRules) {
    if (!PermissionService.isAdmin(player)) {
      throw new PermissionError("plotutils.permission.denied");
    }
    const group = this.requireById(groupId);
    let changed = false;
    for (const key of GroupRuleKeys) {
      if (typeof partialRules?.[key] !== "boolean") continue;
      if (group.rules[key] !== partialRules[key]) {
        group.rules[key] = partialRules[key];
        changed = true;
      }
    }
    if (changed) {
      group.updatedAt = Date.now();
      PlotGroupDatabase.add(group);
    }
    return changed;
  }

  reconcile() {
    for (const group of PlotGroupDatabase.all()) {
      const alive = [];
      let changed = false;
      for (const plotId of group.plotIds) {
        const plot = PlotDatabase.get(plotId);
        if (!plot) {
          changed = true;
          continue;
        }
        alive.push(plotId);
        if (plot.metadata?.groupId !== group.id) {
          plot.metadata = { ...plot.metadata, groupId: group.id };
          PlotDatabase.update(plot, "group-reconcile");
        }
      }
      if (changed) {
        group.plotIds = alive;
        PlotGroupDatabase.add(group);
      }
    }
  }

  createFromSelection(player, options) {
    if (!PermissionService.isAdmin(player)) {
      throw new PermissionError("plotutils.permission.denied");
    }

    const { bounds, dimensionId, contained, partial, groups } = this.analyzeSelection(player);
    if (groups.length > 0) {
      throw new ValidationError("plotutils.group.error.overlap_group", [groups[0].name]);
    }
    if (partial.length > 0 && !options.deletePartialPlots) {
      throw new ValidationError("plotutils.group.error.partial_plot", [partial[0].name]);
    }

    const name = String(options.name ?? "").trim();
    if (!name) throw new ValidationError("plotutils.group.error.name_required");
    if (name.length > 32) throw new ValidationError("plotutils.group.error.name_length");

    let id = String(options.id ?? "").trim();
    if (id) {
      const idErr = validatePlotId(id, (candidate) => PlotGroupDatabase.has(candidate));
      if (idErr) throw new ValidationError(idErr);
    } else {
      id = uniqueIdFromName(name, (candidate) => PlotGroupDatabase.has(candidate));
    }

    const deletedPlots = [];
    if (options.deleteContainedPlots) {
      for (const plot of contained) {
        if (PlotDatabase.delete(plot.id)) deletedPlots.push(plot.id);
      }
    }
    if (options.deletePartialPlots) {
      for (const plot of partial) {
        if (PlotDatabase.delete(plot.id)) deletedPlots.push(plot.id);
      }
    }

    const group = new PlotGroup({
      id,
      name,
      dimensionId,
      bounds,
      plotIds: [],
      rules: options.rules ?? GroupSettings.defaultRules(),
      metadata: {
        createdBy: { id: player.id, name: player.name },
        deletedPlots,
      },
    });
    PlotGroupDatabase.add(group);

    if (!options.deleteContainedPlots) {
      for (const plot of contained) this._linkPlot(group, plot, "group-assign");
    }

    SelectionService.clear(player);
    return group;
  }
  //dio mio
  plotsForGroup(group) {
    return group.plotIds.map((id) => PlotDatabase.get(id)).filter(Boolean);
  }

  deleteGroup(player, groupId) {
    if (!PermissionService.isAdmin(player)) {
      throw new PermissionError("plotutils.permission.denied");
    }
    const group = this.requireById(groupId);
    for (const plot of this.plotsForGroup(group)) {
      this._unlinkPlot(group, plot, "group-unassign");
    }
    PlotGroupDatabase.delete(group.id);
    return group;
  }

  deleteAllGroups(player) {
    if (!PermissionService.isAdmin(player)) {
      throw new PermissionError("plotutils.permission.denied");
    }
    for (const group of PlotGroupDatabase.all()) {
      for (const plot of this.plotsForGroup(group)) {
        this._unlinkPlot(group, plot, "group-unassign");
      }
    }
    return PlotGroupDatabase.clear();
  }

  clearPlotReferences() {
    for (const group of PlotGroupDatabase.all()) {
      if (group.plotIds.length === 0) continue;
      group.plotIds = [];
      group.updatedAt = Date.now();
      PlotGroupDatabase.add(group);
    }
  }
}

export const PlotGroupService = new PlotGroupServiceImpl();
