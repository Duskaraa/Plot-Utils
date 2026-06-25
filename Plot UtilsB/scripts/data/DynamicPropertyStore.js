import { world } from "@minecraft/server";
import { Logger } from "../core/Logger.js";

const maxChunk = 30000;

const metaKey = (key) => `${key}::chunks`;
const partKey = (key, i) => `${key}::${i}`;

function clearChunks(key) {
  const count = world.getDynamicProperty(metaKey(key));
  if (typeof count === "number") {
    for (let i = 0; i < count; i++) world.setDynamicProperty(partKey(key, i), undefined);
    world.setDynamicProperty(metaKey(key), undefined);
  }
}

export function getString(key) {
  const count = world.getDynamicProperty(metaKey(key));
  if (typeof count === "number" && count > 0) {
    let out = "";
    for (let i = 0; i < count; i++) {
      const part = world.getDynamicProperty(partKey(key, i));
      if (typeof part !== "string") {
        Logger.warn(`Missing chunk ${i}/${count} for "${key}".`);
        return undefined;
      }
      out += part;
    }
    return out;
  }
  const value = world.getDynamicProperty(key);
  return typeof value === "string" ? value : undefined;
}

export function removeString(key) {
  clearChunks(key);
  world.setDynamicProperty(key, undefined);
}

export function setString(key, value) {
  const str = String(value);
  if (str.length <= maxChunk) {
    clearChunks(key);
    world.setDynamicProperty(key, str);
    return;
  }
  world.setDynamicProperty(key, undefined);
  const count = Math.ceil(str.length / maxChunk);
  for (let i = 0; i < count; i++) {
    world.setDynamicProperty(partKey(key, i), str.slice(i * maxChunk, (i + 1) * maxChunk));
  }
  world.setDynamicProperty(metaKey(key), count);
}
