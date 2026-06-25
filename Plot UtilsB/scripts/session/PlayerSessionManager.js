import { PlayerSession } from "./PlayerSession.js";

class PlayerSessionManagerImpl {
  #sessions = new Map();

  get(player) {
    return this.getById(player.id);
  }

  getById(playerId) {
    let session = this.#sessions.get(playerId);
    if (!session) {
      session = new PlayerSession(playerId);
      this.#sessions.set(playerId, session);
    }
    return session;
  }

  peek(playerId) {
    return this.#sessions.get(playerId);
  }

  remove(playerId) {
    this.#sessions.delete(playerId);
  }

  all() {
    return [...this.#sessions.values()];
  }

  sweep(onlineIds) {
    for (const id of this.#sessions.keys()) {
      if (!onlineIds.has(id)) this.#sessions.delete(id);
    }
  }
}

export const PlayerSessionManager = new PlayerSessionManagerImpl();
