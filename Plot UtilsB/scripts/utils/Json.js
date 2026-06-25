import { Logger } from "../core/Logger.js";

export function safeParse(text, fallback = undefined) {
  if (typeof text !== "string") return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    Logger.warn("JSON parse failed:", String(error));
    return fallback;
  }
}

export function safeStringify(value, fallback = "") {
  try {
    return JSON.stringify(value);
  } catch (error) {
    Logger.warn("JSON stringify failed:", String(error));
    return fallback;
  }
}
