import { getString, setString } from "./DynamicPropertyStore.js";
import { Properties, schemaVersion, Limits } from "../core/Constants.js";
import { safeParse, safeStringify } from "../utils/Json.js";
import { Scheduler } from "../core/Scheduler.js";
import { Logger } from "../core/Logger.js";
import { PlotGroup } from "../domain/PlotGroup.js";

const saveKey = "plotgroupdb-save";

function deserializeGroup(record) {
  try {
    if (!record || typeof record.id !== "string") return null;
    const group = new PlotGroup(record);
    if (!group.bounds) return null;
    return group;
  } catch (error) {
    Logger.warn(`Skipping invalid plot group: ${error}`);
    return null;
  }
}

class PlotGroupDatabaseImpl {
  #groups = new Map();
  #dirty = false;

  load() {
    this.#groups.clear();
    const raw = getString(Properties.plotGroups);
    const payload = raw ? safeParse(raw, null) : null;
    const records = Array.isArray(payload?.groups) ? payload.groups : [];
    for (const record of records) {
      const group = deserializeGroup(record);
      if (group) this.#groups.set(group.id, group);
    }
    Logger.info(`Loaded ${this.#groups.size} plot group(s).`);
  }

  get size() {
    return this.#groups.size;
  }
  has(id) {
    return this.#groups.has(id);
  }
  get(id) {
    return this.#groups.get(id);
  }
  all() {
    return [...this.#groups.values()];
  }

  getGroupAt(dimensionId, location) {
    if (this.#groups.size === 0) return undefined;
    for (const group of this.#groups.values()) {
      if (group.dimensionId === dimensionId && group.bounds?.isInside(location)) return group;
    }
    return undefined;
  }
  add(group) {
    this.#groups.set(group.id, group);
    this.#dirty = true;
    this.requestSave();
  }
  delete(id) {
    const existed = this.#groups.delete(id);
    if (existed) {
      this.#dirty = true;
      this.requestSave();
    }
    return existed;
  }
  clear() {
    const count = this.#groups.size;
    if (count <= 0) return 0;
    this.#groups.clear();
    this.#dirty = true;
    this.requestSave();
    return count;
  }
  requestSave() {
    Scheduler.debounce(saveKey, Limits.saveDebounceTicks, () => this.flush());
  }
  flush() {
    if (!this.#dirty) return false;
    try {
      setString(Properties.plotGroups, safeStringify({
        version: schemaVersion,
        groups: this.all().map((g) => g.toJSON()),
      }));
      this.#dirty = false;
      return true;
    } catch (error) {
      Logger.error("Failed to persist plot groups:", error);
      return false;
    }
  }
}

export const PlotGroupDatabase = new PlotGroupDatabaseImpl();
