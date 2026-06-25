import { getString, setString } from "../data/DynamicPropertyStore.js";
import { Properties } from "../core/Constants.js";
import { safeParse, safeStringify } from "../utils/Json.js";
import { GroupRuleKeys, defaultGroupRules } from "../domain/PlotSchema.js";
import { Logger } from "../core/Logger.js";

export const GroupCreationKeys = ["deleteContainedByDefault", "deletePartialByDefault"];
export const GroupSettingKeys = [...GroupCreationKeys, ...GroupRuleKeys];

export function defaultGroupSettings() {
  return {
    deleteContainedByDefault: false,
    deletePartialByDefault: false,
    ...defaultGroupRules(),
  };
}

export function normalizeGroupSettings(input) {
  const out = defaultGroupSettings();
  if (input && typeof input === "object") {
    for (const key of GroupSettingKeys) {
      if (typeof input[key] === "boolean") out[key] = input[key];
    }
  }
  return out;
}

class GroupSettingsImpl {
  #cache = null;

  #get() {
    if (this.#cache) return this.#cache;
    let parsed = null;
    try {
      const raw = getString(Properties.groupSettings);
      if (raw !== undefined) parsed = safeParse(raw, null);
    } catch (error) {
      Logger.error("Failed to read group settings:", error);
    }
    this.#cache = normalizeGroupSettings(parsed);
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
    if (!GroupSettingKeys.includes(key)) return false;
    this.#get()[key] = Boolean(value);
    this.#persist();
    return true;
  }

  defaultRules() {
    const current = this.#get();
    const out = {};
    for (const key of GroupRuleKeys) out[key] = Boolean(current[key]);
    return out;
  }

  #persist() {
    try {
      setString(Properties.groupSettings, safeStringify(this.#cache));
    } catch (error) {
      Logger.error("Failed to persist group settings:", error);
    }
  }
}

export const GroupSettings = new GroupSettingsImpl();
