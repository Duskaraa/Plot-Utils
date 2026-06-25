import { world } from "@minecraft/server";
import { Logger } from "../core/Logger.js";

function fallbackSpawn(plot) {
  const c = plot.bounds.center;
  return { x: Math.floor(c.x), y: plot.bounds.max.y + 1, z: Math.floor(c.z) };
}

export const TeleportService = {
  teleportToPlot(player, plot) {
    if (!plot?.bounds) return false;
    const target = plot.spawn ?? fallbackSpawn(plot);
    try {
      const dimension = world.getDimension(plot.dimensionId);
      player.teleport(
        { x: target.x + 0.5, y: target.y, z: target.z + 0.5 },
        { dimension },
      );
      return true;
    } catch (error) {
      Logger.warn(`Teleport to plot "${plot.id}" failed:`, String(error));
      return false;
    }
  },
};
