export class PlayerSession {
  constructor(playerId) {
    this.playerId = playerId;

    this.selection = { pos1: null, pos2: null, dimensionId: null, changedTick: -1 };

    this.visualizing = false;

    this.visualizingGroups = false;

    this.toolboxLayout = null;

    this.createPlotSettingsReviewed = false;

    this.pendingPlotFlags = null;

    this.pendingGroupRules = null;

    this.selectionMode = null;

    this.groupSelectionAreaId = null;

    this.lastItemTick = new Map();
  }

  clearSelection() {
    this.selection.pos1 = null;
    this.selection.pos2 = null;
    this.selection.dimensionId = null;
    this.createPlotSettingsReviewed = false;
    this.pendingPlotFlags = null;
    this.pendingGroupRules = null;
    this.selectionMode = null;
  }
}
