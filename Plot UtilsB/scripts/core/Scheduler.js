import { system } from "@minecraft/server";
import { Logger } from "./Logger.js";

class SchedulerImpl {
  #debounces = new Map();

  interval(fn, ticks) {
    return system.runInterval(() => {
      try {
        fn();
      } catch (error) {
        Logger.error("interval task threw, swallowing:", error);
      }
    }, ticks);
  }

  timeout(fn, ticks = 1) {
    return system.runTimeout(() => {
      try {
        fn();
      } catch (error) {
        Logger.error("delayed task threw:", error);
      }
    }, ticks);
  }

  next(fn) {
    return system.run(() => {
      try {
        fn();
      } catch (error) {
        Logger.error("next-tick task threw:", error);
      }
    });
  }

  job(generator) {
    return system.runJob(generator);
  }

  clear(id) {
    try {
      system.clearRun(id);
    } catch {}
  }

  debounce(key, ticks, fn) {
    if (this.#debounces.has(key)) return;
    const id = system.runTimeout(() => {
      this.#debounces.delete(key);
      try {
        fn();
      } catch (error) {
        Logger.error(`Debounced task "${key}" failed:`, error);
      }
    }, ticks);
    this.#debounces.set(key, id);
  }

  flush(key, fn) {
    const id = this.#debounces.get(key);
    if (id !== undefined) {
      this.clear(id);
      this.#debounces.delete(key);
    }
    try {
      fn();
    } catch (error) {
      Logger.error(`Flushed task "${key}" failed:`, error);
    }
  }
}

export const Scheduler = new SchedulerImpl();
