export const ActionKeys = [
  "blockBreak",
  "blockPlace",
  "blockInteract",
  "entityInteract",
  "entityHurt",
  "itemUse",
  "visitorEntry",
];

export function defaultActionPermissions() {
  const out = {};
  for (const key of ActionKeys) out[key] = false;
  return out;
}

export function normalizeActionPermissions(input, base = defaultActionPermissions()) {
  const out = { ...base };
  if (input && typeof input === "object") {
    for (const key of ActionKeys) {
      if (typeof input[key] === "boolean") out[key] = input[key];
    }
  }
  return out;
}

export const FlagKeys = {
  blockBreak: "blockBreak",
  blockPlace: "blockPlace",
  blockInteract: "blockInteract",
  entityInteract: "entityInteract",
  entityHurt: "entityHurt",
  itemUse: "itemUse",
  visitorEntry: "visitorEntry",
  explosions: "explosions",
};

export const flagList = Object.values(FlagKeys);

export function defaultFlags() {
  return {
    blockBreak: false,
    blockPlace: false,
    blockInteract: false,
    entityInteract: false,
    entityHurt: false,
    itemUse: false,
    visitorEntry: true,
    explosions: false,
  };
}

export function normalizeFlags(input) {
  const out = defaultFlags();
  if (input && typeof input === "object") {
    for (const key of flagList) {
      if (typeof input[key] === "boolean") out[key] = input[key];
    }
    if (typeof input.blockInteract !== "boolean" && typeof input.entityInteract === "boolean") {
      out.blockInteract = input.entityInteract;
    }
  }
  return out;
}

export const GroupRuleKeys = [
  "blockBreak",
  "blockPlace",
  "blockInteract",
  "entityInteract",
  "entityHurt",
  "pvp",
  "itemUse",
  "explosions",
  "hostileSpawn",
  "projectiles",
];

export function defaultGroupRules() {
  const out = {};
  for (const key of GroupRuleKeys) out[key] = false;
  return out;
}

export function normalizeGroupRules(input) {
  const out = defaultGroupRules();
  if (input && typeof input === "object") {
    for (const key of GroupRuleKeys) {
      if (typeof input[key] === "boolean") out[key] = input[key];
    }
  }
  return out;
}

export const Roles = {
  Owner: "owner",
  Trusted: "trusted",
  Visitor: "visitor",
  Admin: "admin",
};

export function normalizeTrustedPlayers(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const ref = entry.player && typeof entry.player === "object" ? entry.player : entry;
    const playerId = typeof ref.id === "string" ? ref.id : null;
    if (!playerId || seen.has(playerId)) continue;
    seen.add(playerId);
    out.push({
      player: { id: playerId, name: typeof ref.name === "string" ? ref.name : playerId },
      permissions: normalizeActionPermissions(entry.permissions),
    });
  }
  return out;
}
