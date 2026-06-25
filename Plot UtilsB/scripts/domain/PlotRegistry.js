import { PlotDatabase } from "../data/PlotDatabase.js";
import { EventBus, Events } from "../core/EventBus.js";
import { Limits } from "../core/Constants.js";
import { regionKey, regionKeysForBounds } from "../utils/Vec3.js";
import { Logger } from "../core/Logger.js";

class PlotRegistryImpl {
  #index = new Map();
  #cell = Limits.regionCellSize;
  #subscribed = false;

  init() {
    if (!this.#subscribed) {
      EventBus.on(Events.PlotsChanged, () => this.rebuild());
      this.#subscribed = true;
    }
    this.rebuild();
  }

  rebuild() {
    this.#index.clear();
    for (const plot of PlotDatabase.all()) this.#indexPlot(plot);
    Logger.debug(`Spatial index rebuilt (${PlotDatabase.size} plot(s)).`);
  }

  #indexPlot(plot) {
    if (!plot.bounds) return;
    let dim = this.#index.get(plot.dimensionId);
    if (!dim) {
      dim = new Map();
      this.#index.set(plot.dimensionId, dim);
    }
    for (const key of regionKeysForBounds(plot.bounds.min, plot.bounds.max, this.#cell)) {
      let set = dim.get(key);
      if (!set) {
        set = new Set();
        dim.set(key, set);
      }
      set.add(plot.id);
    }
  }

  getPlotAt(dimensionId, location) {
    const dim = this.#index.get(dimensionId);
    if (!dim) return undefined;
    const set = dim.get(regionKey(location.x, location.z, this.#cell));
    if (!set) return undefined;
    for (const id of set) {
      const plot = PlotDatabase.get(id);
      if (plot && plot.contains(location)) return plot;
    }
    return undefined;
  }

  findOverlaps(dimensionId, bounds, exceptId = null) {
    const out = [];
    const dim = this.#index.get(dimensionId);
    if (!dim) return out;
    const seen = new Set();
    for (const key of regionKeysForBounds(bounds.min, bounds.max, this.#cell)) {
      const set = dim.get(key);
      if (!set) continue;
      for (const id of set) {
        if (id === exceptId || seen.has(id)) continue;
        seen.add(id);
        const plot = PlotDatabase.get(id);
        if (plot && plot.overlaps(bounds)) out.push(plot);
      }
    }
    return out;
  }

  nearby(dimensionId, location, radius) {
    const out = [];
    const dim = this.#index.get(dimensionId);
    if (!dim) return out;
    const min = { x: location.x - radius, y: 0, z: location.z - radius };
    const max = { x: location.x + radius, y: 0, z: location.z + radius };
    const seen = new Set();
    for (const key of regionKeysForBounds(min, max, this.#cell)) {
      const set = dim.get(key);
      if (!set) continue;
      for (const id of set) {
        if (seen.has(id)) continue;
        seen.add(id);
        const plot = PlotDatabase.get(id);
        if (plot) out.push(plot);
      }
    }
    return out;
  }

  listByOwner(ownerId) {
    return PlotDatabase.all().filter((p) => p.isOwner(ownerId));
  }
  listForPlayer(playerId) {
    return PlotDatabase.all().filter((p) => p.isOwner(playerId) || p.isTrusted(playerId));
  }
  all() {
    return PlotDatabase.all();
  }
}

export const PlotRegistry = new PlotRegistryImpl();
