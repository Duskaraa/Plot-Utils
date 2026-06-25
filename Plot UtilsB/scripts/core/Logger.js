import { world } from "@minecraft/server";
import { Properties } from "./Constants.js";

const levels = { debug: 10, info: 20, warn: 30, error: 40 };

let min = levels.info;
let dbg = false;

export const Logger = {
  init() {
    try {
      dbg = world.getDynamicProperty(Properties.debug) === true;
    } catch {
      dbg = false;
    }
    min = dbg ? levels.debug : levels.info;
  },

  setDebug(enabled) {
    dbg = Boolean(enabled);
    min = dbg ? levels.debug : levels.info;
    try {
      world.setDynamicProperty(Properties.debug, dbg);
    } catch {}
  },

  isDebug() {
    return dbg;
  },

  debug(...args) {
    if (min <= levels.debug) console.log("[PlotUtils:debug]", ...args);
  },
  info(...args) {
    if (min <= levels.info) console.log("[PlotUtils]", ...args);
  },
  warn(...args) {
    if (min <= levels.warn) console.warn("[PlotUtils]", ...args);
  },
  error(...args) {
    if (min <= levels.error) console.error("[PlotUtils]", ...args);
  },
};
