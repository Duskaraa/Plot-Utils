import { world, MolangVariableMap } from "@minecraft/server";
import { Particles, Limits } from "../core/Constants.js";
import { PlotRegistry } from "../domain/PlotRegistry.js";
import { PlotGroupDatabase } from "../data/PlotGroupDatabase.js";
import { PlotDatabase } from "../data/PlotDatabase.js";
import { PlotBounds } from "../domain/PlotBounds.js";
import { distanceSq } from "../utils/Vec3.js";
import { AddonPreferences } from "../config/AddonPreferences.js";
import { OnlinePlayers } from "../session/OnlinePlayers.js";

const dimensionCache = new Map();
function dimensionFor(dimensionId) {
  let dim = dimensionCache.get(dimensionId);
  if (!dim) {
    dim = world.getDimension(dimensionId);
    dimensionCache.set(dimensionId, dim);
  }
  return dim;
}

const Palette = {
  selection: { edge: { red: 1, green: 1, blue: 1 }, face: { red: 1, green: 1, blue: 1 } },
  pulse: { edge: { red: 1, green: 1, blue: 1 }, face: { red: 1, green: 1, blue: 1 } },
  plot: { edge: { red: 0.4, green: 1, blue: 0.55 }, face: { red: 0.4, green: 1, blue: 0.55 } },
  groupPlot: { edge: { red: 0.7, green: 0.25, blue: 1 }, face: { red: 0.7, green: 0.25, blue: 1 } },
  group: { edge: { red: 1, green: 0.85, blue: 0.15 }, face: { red: 1, green: 0.85, blue: 0.15 } },
  warningGroup: { edge: { red: 1, green: 0.45, blue: 0.05 }, face: { red: 1, green: 0.45, blue: 0.05 } },
  invalid: { edge: { red: 1, green: 0.28, blue: 0.28 }, face: { red: 1, green: 0.28, blue: 0.28 } },
  cancel: { edge: { red: 1, green: 1, blue: 1 }, face: { red: 1, green: 0.28, blue: 0.28 } },
};

function isInvalid(colors) {
  return colors === Palette.invalid || colors === Palette.cancel;
}

function clampBounds(anchor, target) {
  const maxDelta = Limits.maxSelectionSpan - 1;
  const clampAxis = (from, to) =>
    from + Math.max(-maxDelta, Math.min(maxDelta, to - from));
  return new PlotBounds(anchor, {
    x: clampAxis(anchor.x, target.x),
    y: clampAxis(anchor.y, target.y),
    z: clampAxis(anchor.z, target.z),
  });
}

function spawnBox(player, dimensionId, origin, size, colors, faceAlpha = 0.065, innerAlpha = 0.12) {
  try {
    const dim = dimensionFor(dimensionId);
    const v = new MolangVariableMap();
    const useColors = AddonPreferences.get("particleColorsEnabled");
    const visibleColors = useColors ? colors : Palette.selection;
    const fillEnabled = AddonPreferences.get("particleFillEnabled");
    v.setVector3("variable.size", size);
    v.setVector3("variable.center", { x: 0, y: 0, z: 0 });
    v.setColorRGB("variable.edge_color", visibleColors.edge);
    v.setColorRGB("variable.face_color", visibleColors.face);
    v.setFloat("variable.face_alpha", fillEnabled ? faceAlpha : 0);
    v.setFloat("variable.inner_alpha", fillEnabled ? innerAlpha : 0);
    v.setFloat("variable.edges_enabled", AddonPreferences.get("particleEdgesEnabled") ? 1 : 0);
    if (AddonPreferences.get("normalUsersSeeParticles")) {
      dim.spawnParticle(Particles.selectionBox, origin, v);
    } else {
      player.spawnParticle(Particles.selectionBox, origin, v);
    }
  } catch {}
}

function spawnBoxes(player, boxes) {
  for (const box of boxes) {
    if (!isInvalid(box.colors)) spawnBox(player, box.dimensionId, box.center, box.size, box.colors, box.faceAlpha, box.innerAlpha);
  }
  for (const box of boxes) {
    if (isInvalid(box.colors)) spawnBox(player, box.dimensionId, box.center, box.size, box.colors, box.faceAlpha, box.innerAlpha);
  }
}

export const ParticleService = {
  renderSelection(player, session) {
    const sel = session.selection;
    if (session.selectionMode === "group") this.renderGroupPlots(player, session);
    if (!sel.pos1 && !sel.pos2) return;

    const pDim = OnlinePlayers.dimensionId(player);
    const dimId = sel.dimensionId ?? pDim;
    if (dimId !== pDim) return;

    const a = sel.pos1 ?? sel.pos2;
    const b = sel.pos2 ?? sel.pos1;
    const bounds = new PlotBounds(a, b);
    const vbox = clampBounds(a, b);

    const partialGroup =
      session.selectionMode !== "group" && sel.pos1 && sel.pos2
        ? PlotGroupDatabase.all().find(
            (group) =>
              group.dimensionId === dimId &&
              group.bounds?.intersects(bounds) &&
              !group.bounds.containsBounds(bounds),
          )
        : undefined;
    const plotOverlaps =
      session.selectionMode !== "group" && sel.pos1 && sel.pos2
        ? PlotRegistry.findOverlaps(dimId, bounds)
        : [];
    const colors = partialGroup || plotOverlaps.length > 0 ? Palette.invalid : Palette.selection;
    const faceAlpha = 0.03;
    const innerAlpha = 0.05;

    const boxes = [{
      dimensionId: dimId,
      center: vbox.center,
      size: vbox.size,
      colors,
      faceAlpha,
      innerAlpha,
    }];
    if (partialGroup) {
      boxes.push({
        dimensionId: partialGroup.dimensionId,
        center: partialGroup.bounds.center,
        size: partialGroup.bounds.size,
        colors: Palette.warningGroup,
        faceAlpha: 0.08,
        innerAlpha: 0.14,
      });
    }
    if (session.selectionMode !== "group" && sel.pos1 && sel.pos2) {
      for (const plot of plotOverlaps) {
        boxes.push({
          dimensionId: plot.dimensionId,
          center: plot.bounds.center,
          size: plot.bounds.size,
          colors: Palette.invalid,
          faceAlpha: 0.08,
          innerAlpha: 0.14,
        });
      }
    }
    spawnBoxes(player, boxes);
  },

  renderPlots(player, session) {
    if (!session.visualizing) return;

    const dimId = OnlinePlayers.dimensionId(player);
    const radius = Limits.maxVisualizeDistance;
    const candidates = PlotRegistry.nearby(dimId, player.location, radius);
    if (candidates.length === 0) return;

    const r2 = radius * radius;
    const ranked = [];
    for (const plot of candidates) {
      if (!plot.bounds || plot.dimensionId !== dimId) continue;
      const d = distanceSq(player.location, plot.bounds.center);
      if (d <= r2) ranked.push([d, plot]);
    }
    ranked.sort((x, y) => x[0] - y[0]);

    const limit = Math.min(ranked.length, Limits.maxVisualizePlots);
    const sel = session.selection;
    const selBox = sel.pos1 && sel.pos2 && (sel.dimensionId ?? dimId) === dimId
      ? new PlotBounds(sel.pos1, sel.pos2)
      : null;
    const boxes = [];
    for (let i = 0; i < limit; i++) {
      const plot = ranked[i][1];
      if (session.visualizingGroups && plot.metadata?.groupId) continue;
      let colors = plot.metadata?.groupId ? Palette.groupPlot : Palette.plot;
      if (selBox && plot.bounds.intersects(selBox)) {
        colors = session.selectionMode === "group" ? Palette.group : Palette.invalid;
      }
      boxes.push({
        dimensionId: plot.dimensionId,
        center: plot.bounds.center,
        size: plot.bounds.size,
        colors,
        faceAlpha: 0.065,
        innerAlpha: 0.12,
      });
    }
    spawnBoxes(player, boxes);
  },

  renderGroups(player, session) {
    if (!session.visualizingGroups) return;

    const dimId = OnlinePlayers.dimensionId(player);
    const radius = Limits.maxVisualizeDistance;
    const r2 = radius * radius;
    const ranked = [];
    for (const group of PlotGroupDatabase.all()) {
      if (!group.bounds || group.dimensionId !== dimId) continue;
      const d = distanceSq(player.location, group.bounds.center);
      if (d <= r2) ranked.push([d, group]);
    }
    ranked.sort((x, y) => x[0] - y[0]);

    const limit = Math.min(ranked.length, Limits.maxVisualizePlots);
    const sel = session.selection;
    const selBox = sel.pos1 && sel.pos2 && (sel.dimensionId ?? dimId) === dimId
      ? new PlotBounds(sel.pos1, sel.pos2)
      : null;
    const boxes = [];
    for (let i = 0; i < limit; i++) {
      const group = ranked[i][1];
      const colors =
        selBox &&
        group.bounds.intersects(selBox) &&
        (session.selectionMode === "group" || !group.bounds.containsBounds(selBox))
          ? session.selectionMode === "group"
            ? Palette.invalid
            : Palette.warningGroup
          : Palette.group;
      boxes.push({
        dimensionId: group.dimensionId,
        center: group.bounds.center,
        size: group.bounds.size,
        colors,
        faceAlpha: 0.055,
        innerAlpha: 0.1,
      });
      for (const plotId of group.plotIds) {
        const plot = PlotDatabase.get(plotId);
        if (!plot?.bounds || plot.dimensionId !== dimId) continue;
        const plotColors =
          selBox && plot.bounds.intersects(selBox) && session.selectionMode !== "group"
            ? Palette.invalid
            : Palette.groupPlot;
        boxes.push({
          dimensionId: plot.dimensionId,
          center: plot.bounds.center,
          size: plot.bounds.size,
          colors: plotColors,
          faceAlpha: 0.055,
          innerAlpha: 0.1,
        });
      }
    }
    spawnBoxes(player, boxes);
  },

  renderGroupPlots(player, session) {
    const dimId = OnlinePlayers.dimensionId(player);
    const radius = Limits.maxVisualizeDistance;
    const candidates = PlotRegistry.nearby(dimId, player.location, radius);
    if (candidates.length === 0) return;

    const sel = session.selection;
    const selBox = sel.pos1 && sel.pos2 && (sel.dimensionId ?? dimId) === dimId
      ? new PlotBounds(sel.pos1, sel.pos2)
      : null;

    const r2 = radius * radius;
    const ranked = [];
    for (const plot of candidates) {
      if (!plot.bounds || plot.dimensionId !== dimId) continue;
      const d = distanceSq(player.location, plot.bounds.center);
      if (d <= r2) ranked.push([d, plot]);
    }
    ranked.sort((x, y) => x[0] - y[0]);

    const limit = Math.min(ranked.length, Limits.maxVisualizePlots);
    const boxes = [];
    for (let i = 0; i < limit; i++) {
      const plot = ranked[i][1];
      const isPartial =
        selBox &&
        plot.bounds.intersects(selBox) &&
        !selBox.containsBounds(plot.bounds);
      boxes.push({
        dimensionId: plot.dimensionId,
        center: plot.bounds.center,
        size: plot.bounds.size,
        colors: isPartial ? Palette.invalid : Palette.plot,
        faceAlpha: 0.065,
        innerAlpha: 0.12,
      });
    }

    if (selBox) {
      for (const group of PlotGroupDatabase.all()) {
        if (!group.bounds || group.dimensionId !== dimId || !group.bounds.intersects(selBox)) continue;
        boxes.push({
          dimensionId: group.dimensionId,
          center: group.bounds.center,
          size: group.bounds.size,
          colors: Palette.invalid,
          faceAlpha: 0.08,
          innerAlpha: 0.14,
        });
      }
    }
    spawnBoxes(player, boxes);
  },

};
