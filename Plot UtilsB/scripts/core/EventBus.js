import { Logger } from "./Logger.js";

class EventBusImpl {
  #handlers = new Map();

  on(event, handler) {
    let set = this.#handlers.get(event);
    if (!set) {
      set = new Set();
      this.#handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const set = this.#handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (error) {
        Logger.error(`EventBus handler for "${event}" failed:`, error);
      }
    }
  }
}

export const EventBus = new EventBusImpl();

export const Events = {
  PlotsChanged: "plots:changed",
};
