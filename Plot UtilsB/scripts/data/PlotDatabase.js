import { deserializePlot } from "./PlotSerializer.js";
import { loadRecords } from "./MigrationManager.js";
import { getString, setString } from "./DynamicPropertyStore.js";
import { Properties, schemaVersion, Limits } from "../core/Constants.js";
import { safeStringify } from "../utils/Json.js";
import { EventBus, Events } from "../core/EventBus.js";
import { Scheduler } from "../core/Scheduler.js";
import { Logger } from "../core/Logger.js";

const saveKey = "plotdb-save";

class PlotDatabaseImpl {
  #plots = new Map();
  #dirty = false;
  #loaded = false;

  load() {
    const { plots, source, needsResave } = loadRecords();
    this.#plots.clear();
    for (const record of plots) {
      const plot = deserializePlot(record);
      if (plot) this.#plots.set(plot.id, plot);
    }
    this.#loaded = true;
    Logger.info(`Loaded ${this.#plots.size} plot(s) (source: ${source}).`);

    if (needsResave) {
      this.#dirty = true;
      this.requestSave();
    }
    EventBus.emit(Events.PlotsChanged, { reason: "load" });
  }

  get size() {
    return this.#plots.size;
  }
  isLoaded() {
    return this.#loaded;
  }
  get(id) {
    return this.#plots.get(id);
  }
  has(id) {
    return this.#plots.has(id);
  }
  all() {
    return [...this.#plots.values()];
  }

  add(plot) {
    this.#plots.set(plot.id, plot);
    this.markDirty();
    EventBus.emit(Events.PlotsChanged, { reason: "create" });
  }

  delete(id) {
    if (!this.#plots.delete(id)) return false;
    this.markDirty();
    EventBus.emit(Events.PlotsChanged, { reason: "delete" });
    return true;
  }

  clear(reason = "clear") {
    const count = this.#plots.size;
    if (count <= 0) return 0;
    this.#plots.clear();
    this.markDirty();
    EventBus.emit(Events.PlotsChanged, { reason });
    return count;
  }

  update(plot, reason = "update") {
    if (!this.#plots.has(plot.id)) return false;
    this.markDirty();
    EventBus.emit(Events.PlotsChanged, { reason });
    return true;
  }

  markDirty() {
    this.#dirty = true;
    this.requestSave();
  }

  requestSave() {
    Scheduler.debounce(saveKey, Limits.saveDebounceTicks, () => this.flush());
  }

  flush() {
    if (!this.#dirty) return false;
    const payload = { version: schemaVersion, plots: this.all().map((p) => p.toJSON()) };
    try {
      setString(Properties.database, safeStringify(payload));
      this.#dirty = false;
      Logger.debug(`Flushed ${payload.plots.length} plot(s).`);
      return true;
    } catch (error) {
      Logger.error("Failed to persist plot database:", error);
      return false;
    }
  }
}

export const PlotDatabase = new PlotDatabaseImpl();
