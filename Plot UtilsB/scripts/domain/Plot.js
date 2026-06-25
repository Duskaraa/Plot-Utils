import { PlotBounds } from "./PlotBounds.js";
import {
  normalizeFlags,
  normalizeTrustedPlayers,
  normalizeActionPermissions,
} from "./PlotSchema.js";
import { Dimensions } from "../core/Constants.js";

export class Plot {
  constructor(data) {
    this.id = data.id;
    this.name = data.name ?? data.id;
    this.ownerId = data.ownerId ?? null;
    this.ownerName = data.ownerName ?? null;
    this.dimensionId = data.dimensionId ?? Dimensions.overworld;
    this.bounds =
      data.bounds instanceof PlotBounds ? data.bounds : PlotBounds.fromRecord(data.bounds);
    this.createdAt = typeof data.createdAt === "number" ? data.createdAt : Date.now();
    this.updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : this.createdAt;
    this.flags = normalizeFlags(data.flags);
    this.trustedPlayers = normalizeTrustedPlayers(data.trustedPlayers);
    this.hideOwnerName = data.hideOwnerName === true;
    this.spawn = normalizeLoc(data.spawn);
    this.metadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  }

  touch() {
    this.updatedAt = Date.now();
  }

  isOwner(playerId) {
    return this.ownerId != null && this.ownerId === playerId;
  }
  hasOwner() {
    return this.ownerId != null;
  }

  setOwner(playerId, playerName) {
    this.ownerId = playerId ?? null;
    this.ownerName = playerName ?? null;
    this.touch();
  }

  getTrusted(playerId) {
    return this.trustedPlayers.find((t) => t.player.id === playerId);
  }
  isTrusted(playerId) {
    return this.trustedPlayers.some((t) => t.player.id === playerId);
  }
  addTrusted(playerId, playerName, permissions) {
    if (this.isTrusted(playerId)) return false;
    this.trustedPlayers.push({
      player: { id: playerId, name: playerName ?? playerId },
      permissions: normalizeActionPermissions(permissions),
    });
    this.touch();
    return true;
  }
  removeTrusted(playerId) {
    const before = this.trustedPlayers.length;
    this.trustedPlayers = this.trustedPlayers.filter((t) => t.player.id !== playerId);
    if (this.trustedPlayers.length === before) return false;
    this.touch();
    return true;
  }

  setTrustedPermission(playerId, key, value) {
    const trusted = this.getTrusted(playerId);
    if (!trusted || !(key in trusted.permissions)) return false;
    trusted.permissions[key] = Boolean(value);
    this.touch();
    return true;
  }

  rename(name) {
    this.name = name;
    this.touch();
  }
  setFlag(key, value) {
    if (!(key in this.flags)) return false;
    this.flags[key] = Boolean(value);
    this.touch();
    return true;
  }
  setSpawn(location) {
    this.spawn = normalizeLoc(location);
    this.touch();
  }
  setHideOwnerName(value) {
    this.hideOwnerName = Boolean(value);
    this.touch();
  }

  contains(location) {
    return this.bounds ? this.bounds.isInside(location) : false;
  }
  overlaps(otherBounds) {
    return this.bounds && otherBounds ? this.bounds.intersects(otherBounds) : false;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      ownerId: this.ownerId,
      ownerName: this.ownerName,
      dimensionId: this.dimensionId,
      bounds: this.bounds ? this.bounds.toRecord() : undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      flags: this.flags,
      trustedPlayers: this.trustedPlayers,
      hideOwnerName: this.hideOwnerName,
      spawn: this.spawn,
      metadata: this.metadata,
    };
  }
}

function normalizeLoc(loc) {
  if (!loc || typeof loc.x !== "number" || typeof loc.y !== "number" || typeof loc.z !== "number") {
    return null;
  }
  return { x: loc.x, y: loc.y, z: loc.z };
}
