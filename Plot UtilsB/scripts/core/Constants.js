export const schemaVersion = 3;

export const Tags = {
  admin: "plotutils.admin",
};

export const Properties = {
  database: "plotutils:db_v2",
  legacyPlots: "plotutils:plots_mvp",
  debug: "plotutils:debug",
  globalSettings: "plotutils:global_settings",
  defaultPlotSettings: "plotutils:default_plot_settings",
  addonPreferences: "plotutils:addon_preferences",
  plotGroups: "plotutils:plot_groups",
  groupSettings: "plotutils:group_settings",
};

export const Items = {
  toolboxClosed: "source:plot_toolbox_closed",
  toolboxOpen: "source:plot_toolbox_open",
  selectionWand: "source:selection_wand",
  createTool: "source:plot_create_tool",
  finishPlotTool: "source:plot_finish_plot_tool",
  listTool: "source:plot_list_tool",
  visualizeTool: "source:plot_visualize_tool",
  configGlobalTool: "source:plot_config_global_tool",
  configCurrentTool: "source:plot_config_current_tool",
  backTool: "source:plot_back_tool",
  guideTool: "source:plot_guide_tool",
  advancedTool: "source:advanced_utilities_tool",
  plotGroupsTool: "source:plot_groups_tool",
  advancedDataTool: "source:view_advanced_data_tool",
  newGroupAreaTool: "source:new_group_area_tool",
  createGroupTool: "source:create_group_tool",
  listGroupsTool: "source:list_groups_tool",
  visualizeGroupsTool: "source:visualize_plot_groups_tool",
  visualizeGlobalTool: "source:visualize_global_tool",
};

export const ToolItems = new Set(Object.values(Items));

export const Particles = {
  selectionBox: "source:selection_box",
};

export const Limits = {
  maxSelectionSpan: 128,
  maxPlotVolume: 128 * 128 * 128,
  maxPlotsPerOwner: 50,
  maxPlotsTotal: 5000,
  saveDebounceTicks: 40,
  selectionParticleInterval: 8,
  visualizeInterval: 12,
  sessionSweepInterval: 1200,
  regionCellSize: 128,
  maxVisualizeDistance: 96,
  maxVisualizePlots: 24,
};

export const Dimensions = {
  overworld: "minecraft:overworld",
  nether: "minecraft:nether",
  end: "minecraft:the_end",
};

export const allowedDimensions = [Dimensions.overworld, Dimensions.nether, Dimensions.end];
