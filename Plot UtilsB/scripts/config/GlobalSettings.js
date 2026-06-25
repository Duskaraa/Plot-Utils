import { getString, setString } from "../data/DynamicPropertyStore.js";
import { Properties } from "../core/Constants.js";
import { safeParse, safeStringify } from "../utils/Json.js";
import { Logger } from "../core/Logger.js";

export const GlobalSettingKeys = [
  "adminsAlwaysBypass",
  "ownersCanManageTrustedPlayers",
  "ownersCanAddTrustedPlayers",
  "ownersCanRemoveTrustedPlayers",
  "ownersCanEditTrustedPlayerPermissions",
  "ownersCanEditVisitorPermissions",
  "ownersCanHideOwnerName",
  "ownersCanChangeDisplayName",
  "ownersCanUseSocialMenu",
  "ownersCanTransferOwnership",
  "ownersCanTeleportAndSetSpawn",
  "showPlotEntryMessage",
];

export const AdminProtectionKeys = ["adminsAlwaysBypass"];
export const OwnerRuleKeys = GlobalSettingKeys.filter(
  (key) => key.startsWith("ownersCan") || key === "showPlotEntryMessage",
);

export function defaultGlobalSettings() {
  return {
    adminsAlwaysBypass: false,
    ownersCanManageTrustedPlayers: true,
    ownersCanAddTrustedPlayers: true,
    ownersCanRemoveTrustedPlayers: true,
    ownersCanEditTrustedPlayerPermissions: true,
    ownersCanEditVisitorPermissions: true,
    ownersCanHideOwnerName: false,
    ownersCanChangeDisplayName: true,
    ownersCanUseSocialMenu: true,
    ownersCanTransferOwnership: false,
    ownersCanTeleportAndSetSpawn: false,
    showPlotEntryMessage: true,
  };
}

export function normalizeGlobalSettings(input) {
  const out = defaultGlobalSettings();
  if (input && typeof input === "object") {
    for (const key of GlobalSettingKeys) {
      if (typeof input[key] === "boolean") out[key] = input[key];
    }
  }
  return out;
}

class GlobalSettingsImpl {
  #cache = null;

  #get() {
    if (this.#cache) return this.#cache;
    let parsed = null;
    try {
      const raw = getString(Properties.globalSettings);
      if (raw !== undefined) parsed = safeParse(raw, null);
    } catch (error) {
      Logger.error("Failed to read global settings:", error);
    }
    this.#cache = normalizeGlobalSettings(parsed);
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
    if (!GlobalSettingKeys.includes(key)) return false;
    this.#get()[key] = Boolean(value);
    this.#persist();
    return true;
  }

  #persist() {
    try {
      setString(Properties.globalSettings, safeStringify(this.#cache));
    } catch (error) {
      Logger.error("Failed to persist global settings:", error);
    }
  }
}

export const GlobalSettings = new GlobalSettingsImpl();
