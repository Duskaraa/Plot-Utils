import { world } from "@minecraft/server";

class OnlinePlayersImpl {
  #players = new Map();
  #listCache = null;
  #dims = new Map();

  init() {
    this.#players.clear();
    this.#listCache = null;
    this.#dims.clear();
    try {
      for (const player of world.getPlayers()) this.#players.set(player.id, player);
    } catch {}
  }

  add(player) {
    if (player) {
      this.#players.set(player.id, player);
      this.#listCache = null;
    }
  }

  remove(playerId) {
    if (this.#players.delete(playerId)) this.#listCache = null;
    this.#dims.delete(playerId);
  }

  dimensionId(player) {
    let dim = this.#dims.get(player.id);
    if (dim === undefined) {
      try {
        dim = player.dimension.id;
      } catch {
        return undefined;
      }
      this.#dims.set(player.id, dim);
    }
    return dim;
  }

  setDimension(playerId, dimensionId) {
    this.#dims.set(playerId, dimensionId);
  }

  list() {
    return (this.#listCache ??= [...this.#players.values()]);
  }

  ids() {
    return new Set(this.#players.keys());
  }

  getById(playerId) {
    const player = this.#players.get(playerId);
    if (!player) return undefined;
    try {
      if (player.isValid) return player;
    } catch {}
    this.#players.delete(playerId);
    return undefined;
  }

  get size() {
    return this.#players.size;
  }
}

export const OnlinePlayers = new OnlinePlayersImpl();
