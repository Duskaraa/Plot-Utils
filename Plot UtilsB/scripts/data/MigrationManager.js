import { getString } from "./DynamicPropertyStore.js";
import { Properties, schemaVersion } from "../core/Constants.js";
import { safeParse } from "../utils/Json.js";
import { Logger } from "../core/Logger.js";

export function loadRecords() {
  const current = getString(Properties.database);
  if (current !== undefined) {
    const parsed = safeParse(current, null);
    const upgraded = upgrade(parsed);
    if (upgraded) {
      return { plots: upgraded.plots, source: "v2", needsResave: upgraded.changed };
    }
    Logger.error(
      `Database "${Properties.database}" is corrupt. Starting empty; legacy data left intact.`,
    );
    return { plots: [], source: "corrupt", needsResave: false };
  }

  const legacy = legacyRecords();
  if (legacy.length > 0) {
    Logger.info(`Found ${legacy.length} legacy plot(s); migrating to v${schemaVersion}.`);
    return { plots: legacy, source: "legacy", needsResave: true };
  }

  return { plots: [], source: "empty", needsResave: false };
}

function upgrade(parsed) {
  if (!parsed) return null;

  if (Array.isArray(parsed)) {
    return { plots: parsed, changed: true };
  }
  if (typeof parsed !== "object" || !Array.isArray(parsed.plots)) {
    return null;
  }
  if (parsed.version === schemaVersion) {
    return { plots: parsed.plots, changed: false };
  }

  Logger.info(`Upgrading database from v${parsed.version ?? "?"} to v${schemaVersion}.`);
  return { plots: parsed.plots, changed: true };
}

function legacyRecords() {
  const raw = getString(Properties.legacyPlots);
  if (raw === undefined) return [];
  const parsed = safeParse(raw, null);
  return Array.isArray(parsed) ? parsed : [];
}
