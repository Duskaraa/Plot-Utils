import { Plot } from "../domain/Plot.js";
import { PlotBounds } from "../domain/PlotBounds.js";
import { Dimensions } from "../core/Constants.js";
import { Logger } from "../core/Logger.js";

export function deserializePlot(record) {
  if (!record || typeof record !== "object") return null;

  const id = typeof record.id === "string" ? record.id : null;
  if (!id) {
    Logger.warn("Skipping plot record with no id.");
    return null;
  }

  const bounds = PlotBounds.fromRecord(record.bounds ?? record);
  if (!bounds) {
    Logger.warn(`Skipping plot "${id}": invalid bounds.`);
    return null;
  }

  const legacyOwner = record.owner;
  const ownerId =
    record.ownerId ??
    (legacyOwner && typeof legacyOwner === "object" ? legacyOwner.id : null) ??
    null;
  const ownerName =
    record.ownerName ??
    (legacyOwner && typeof legacyOwner === "object" ? legacyOwner.name : null) ??
    null;

  return new Plot({
    id,
    name:
      typeof record.name === "string"
        ? record.name
        : typeof record.displayName === "string"
          ? record.displayName
          : id,
    ownerId,
    ownerName,
    dimensionId: typeof record.dimensionId === "string" ? record.dimensionId : Dimensions.overworld,
    bounds,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    members: record.members,
    bannedPlayers: record.bannedPlayers,
    flags: record.flags,
    permissions: record.permissions,
    trustedPlayers: record.trustedPlayers,
    hideOwnerName: record.hideOwnerName,
    spawn: record.spawn,
    metadata:
      record.metadata ?? (record.createdBy ? { createdBy: record.createdBy } : undefined),
  });
}
