import { getString, setString } from "../data/DynamicPropertyStore.js";
import { Properties } from "../core/Constants.js";
import { safeParse, safeStringify } from "../utils/Json.js";
import { Logger } from "../core/Logger.js";

export const AddonPreferenceKeys = [
  "particleFillEnabled",
  "particleEdgesEnabled",
  "particleColorsEnabled",
  "supportMessagesEnabled",
  "normalUsersSeeParticles",
];

export function defaultAddonPreferences() {
  return {
    particleFillEnabled: true,
    particleEdgesEnabled: true,
    particleColorsEnabled: true,
    supportMessagesEnabled: true,
    normalUsersSeeParticles: false,
  };
}

export function normalizeAddonPreferences(input) {
  const out = defaultAddonPreferences();
  if (input && typeof input === "object") {
    for (const key of AddonPreferenceKeys) {
      if (typeof input[key] === "boolean") out[key] = input[key];
    }
    if (
      typeof input.particleFillEnabled !== "boolean" &&
      typeof input.selectionFillEnabled === "boolean"
    ) {
      out.particleFillEnabled = input.selectionFillEnabled;
    }
  }
  return out;
}

class AddonPreferencesImpl {
  #cache = null;

  #get() {
    if (this.#cache) return this.#cache;
    let parsed = null;
    try {
      const raw = getString(Properties.addonPreferences);
      if (raw !== undefined) parsed = safeParse(raw, null);
    } catch (error) {
      Logger.error("Failed to read add-on preferences:", error);
    }
    this.#cache = normalizeAddonPreferences(parsed);
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
    if (!AddonPreferenceKeys.includes(key)) return false;
    this.#get()[key] = Boolean(value);
    this.#persist();
    return true;
  }

  #persist() {
    try {
      setString(Properties.addonPreferences, safeStringify(this.#cache));
    } catch (error) {
      Logger.error("Failed to persist add-on preferences:", error);
    }
  }
}

export const AddonPreferences = new AddonPreferencesImpl();
