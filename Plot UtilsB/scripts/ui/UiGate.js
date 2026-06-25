const active = new Set();

export const UiGate = {
  acquire(playerId) {
    if (active.has(playerId)) return false;
    active.add(playerId);
    return true;
  },

  release(playerId) {
    active.delete(playerId);
  },

  isActive(playerId) {
    return active.has(playerId);
  },
};
