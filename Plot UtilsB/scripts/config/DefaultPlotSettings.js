import { getString, setString } from "../data/DynamicPropertyStore.js";
import { Properties } from "../core/Constants.js";
import { safeParse, safeStringify } from "../utils/Json.js";
import { flagList, defaultFlags, normalizeFlags } from "../domain/PlotSchema.js";
import { Logger } from "../core/Logger.js";

class DefaultPlotSettingsImpl {
  #cache = null;

  #get() {
    if (this.#cache) return this.#cache;
    let parsed = null;
    try {
      const raw = getString(Properties.defaultPlotSettings);
      if (raw !== undefined) parsed = safeParse(raw, null);
    } catch (error) {
      Logger.error("Failed to read default plot settings:", error);
    }

    this.#cache = normalizeFlags(parsed);
    return this.#cache;
  }

  reload() {
    this.#cache = null;
    this.#get();
  }

  all() {
    return { ...this.#get() };
  }

  get(key) {
    return Boolean(this.#get()[key]);
  }

  set(key, value) {
    if (!flagList.includes(key)) return false;
    this.#get()[key] = Boolean(value);
    this.#persist();
    return true;
  }

  buildInitialFlags(override) {
    const source = override && typeof override === "object" ? override : this.#get();
    return normalizeFlags({ ...defaultFlags(), ...source });
  }

  #persist() {
    try {
      setString(Properties.defaultPlotSettings, safeStringify(this.#cache));
    } catch (error) {
      Logger.error("Failed to persist default plot settings:", error);
    }
  }
}

export const DefaultPlotSettings = new DefaultPlotSettingsImpl();
