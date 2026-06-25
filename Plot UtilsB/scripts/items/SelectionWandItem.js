import { PermissionService } from "../services/PermissionService.js";
import { SelectionService } from "../services/SelectionService.js";
import { LanguageService } from "../services/LanguageService.js";
import { PlotBounds } from "../domain/PlotBounds.js";
import { PlotRegistry } from "../domain/PlotRegistry.js";
import { PlotGroupDatabase } from "../data/PlotGroupDatabase.js";
import { PlotGroupService } from "../services/PlotGroupService.js";
import { Limits } from "../core/Constants.js";
import { PlayerSessionManager } from "../session/PlayerSessionManager.js";
import { FeedbackService } from "../services/FeedbackService.js";

function posText(pos) {
  return pos ? `${pos.x}, ${pos.y}, ${pos.z}` : LanguageService.t("plotutils.selection_not_set");
}

function selectionText(which, pos) {
  return LanguageService.t("plotutils.selection_point_set", [which === "pos1" ? 1 : 2, posText(pos)]);
}

function setPoint(player, which, block) {
  if (!PermissionService.isAdmin(player)) {
    LanguageService.actionBar(player, "plotutils.admin_only");
    return;
  }

  const sel = SelectionService.setPoint(player, which, block.location, block.dimension.id);
  const session = PlayerSessionManager.get(player);
  const a = sel.pos1 ?? sel.pos2;
  const b = sel.pos2 ?? sel.pos1;
  const hasBoth = Boolean(sel.pos1 && sel.pos2);
  const bounds = hasBoth ? new PlotBounds(a, b) : null;
  const isGroup = session.selectionMode === "group";

  if (!isGroup && bounds && bounds.maxAxisSpan > Limits.maxSelectionSpan) {
    LanguageService.actionBar(player, "plotutils.selection_too_large", [
      Limits.maxSelectionSpan,
      Limits.maxSelectionSpan,
      Limits.maxSelectionSpan,
    ]);
    FeedbackService.support(player, "plotutils.support.selection_too_large");
  } else if (isGroup && bounds) {
    const dimensionId = sel.dimensionId ?? block.dimension.id;
    const partial = PlotRegistry.findOverlaps(dimensionId, bounds).find((plot) => !bounds.containsBounds(plot.bounds));
    const groupOverlap = PlotGroupDatabase.all().find(
      (group) => group.dimensionId === dimensionId && group.bounds?.intersects(bounds),
    );
    if (groupOverlap) {
      LanguageService.actionBar(player, "plotutils.group.error.overlap_group", [groupOverlap.name]);
      FeedbackService.support(player, "plotutils.support.group_overlap");
    } else if (partial) {
      LanguageService.actionBar(player, "plotutils.group.error.partial_plot", [partial.name]);
      FeedbackService.support(player, "plotutils.support.partial_plot");
    } else {
      const sizeText = `${bounds.size.x} x ${bounds.size.y} x ${bounds.size.z}`;
      LanguageService.actionBar(player, "plotutils.group.selection_format", [
        sizeText,
        PlotRegistry.findOverlaps(dimensionId, bounds).length,
        bounds.capacity,
      ]);
      FeedbackService.support(player, "plotutils.support.group_selection_complete");
    }
  } else {
    if (bounds) {
      const dimensionId = sel.dimensionId ?? block.dimension.id;
      const { partial: partialGroup } = PlotGroupService.findGroupOverlap(dimensionId, bounds);
      const overlaps = PlotRegistry.findOverlaps(dimensionId, bounds);
      if (partialGroup && overlaps.length > 0) {
        LanguageService.actionBar(player, "plotutils.create.group_partial_error", [partialGroup.name]);
        FeedbackService.support(player, "plotutils.support.mixed_overlap", [
          overlaps[0].name,
          partialGroup.name,
        ]);
      } else if (partialGroup) {
        LanguageService.actionBar(player, "plotutils.create.group_partial_error", [partialGroup.name]);
        FeedbackService.support(player, "plotutils.support.partial_group");
      } else if (overlaps.length > 0) {
        const sizeText = `${bounds.size.x} x ${bounds.size.y} x ${bounds.size.z}`;
        LanguageService.actionBar(player, "plotutils.selection_format", [sizeText, bounds.capacity]);
        FeedbackService.support(player, "plotutils.support.plot_overlap", [overlaps[0].name]);
      } else {
        const sizeText = `${bounds.size.x} x ${bounds.size.y} x ${bounds.size.z}`;
        LanguageService.actionBar(player, "plotutils.selection_format", [sizeText, bounds.capacity]);
        FeedbackService.support(player, "plotutils.support.plot_selection_complete");
      }
    } else {
      LanguageService.actionBar(player, selectionText(which, sel[which]));
    }
  }

  try {
    player.playSound("random.orb", { pitch: 1.35, volume: 0.7 });
  } catch {}
}

export const SelectionWandItem = {
  onBreak(player, block) {
    setPoint(player, "pos1", block);
  },
  onInteractBlock(player, block) {
    setPoint(player, "pos2", block);
  },
};
