import { PlotDatabase } from "../data/PlotDatabase.js";
import { PlotGroupDatabase } from "../data/PlotGroupDatabase.js";
import { GlobalSettings } from "../config/GlobalSettings.js";
import { DefaultPlotSettings } from "../config/DefaultPlotSettings.js";
import { GroupSettings } from "../config/GroupSettings.js";
import { AddonPreferences } from "../config/AddonPreferences.js";

const configs = [GlobalSettings, DefaultPlotSettings, GroupSettings, AddonPreferences];

export const MaintenanceService = {
  reloadConfigs() {
    for (const config of configs) config.reload();
  },

  reloadAll() {
    PlotDatabase.flush();
    PlotDatabase.load();
    PlotGroupDatabase.flush();
    PlotGroupDatabase.load();
    this.reloadConfigs();
  },
};
