import { ActionFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { PlotService } from "../../services/PlotService.js";
import { PlotGroupService } from "../../services/PlotGroupService.js";
import { ToolboxService } from "../../services/ToolboxService.js";
import { MaintenanceService } from "../../services/MaintenanceService.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";
import { confirm } from "./ConfirmMenu.js";
import { Properties } from "../../core/Constants.js";
import { removeString } from "../../data/DynamicPropertyStore.js";

const configProperties = [
  Properties.defaultPlotSettings,
  Properties.globalSettings,
  Properties.groupSettings,
  Properties.addonPreferences,
];

function resetConfigs() {
  for (const key of configProperties) removeString(key);
  MaintenanceService.reloadConfigs();
}

export const AddonDataMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const stats = PlotService.stats();
    const groupStats = PlotGroupService.stats();
    const buttons = [
      { label: "plotutils.menu.addon_data.delete_all_plots", run: () => this.deleteAllPlots(player) },
      { label: "plotutils.menu.addon_data.delete_all_groups", run: () => this.deleteAllGroups(player) },
      { label: "plotutils.menu.addon_data.reset_configs", run: () => this.resetConfigs(player) },
      { label: "plotutils.menu.addon_data.delete_all_addon", run: () => this.deleteAllAddonData(player) },
      { label: "plotutils.back", run: () => MenuService.open("admin", player) },
    ];

    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.addon_data.title"))
      .body(LanguageService.t("plotutils.menu.addon_data.body", [stats.plots, groupStats.groups]));
    for (const button of buttons) form.button(LanguageService.t(button.label));

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return MenuService.open("admin", player);
    return buttons[res.selection]?.run();
  },

  async deleteAllPlots(player) {
    const stats = PlotService.stats();
    const ok = await confirm(player, {
      titleKey: "plotutils.menu.addon_data.delete_all_confirm_title",
      bodyKey: "plotutils.menu.addon_data.delete_all_confirm_body",
      bodyParams: [stats.plots],
      confirmKey: "plotutils.menu.addon_data.delete_all_plots",
      cancelKey: "plotutils.cancel",
    });
    if (!ok) return MenuService.open("addonData", player);
    PlotGroupService.clearPlotReferences();
    const deleted = PlotService.deleteAllPlots(player);
    FeedbackService.notify(player, "plotutils.menu.addon_data.delete_all_done", [deleted]);
    return MenuService.open("addonData", player);
  },

  async deleteAllGroups(player) {
    const stats = PlotGroupService.stats();
    const ok = await confirm(player, {
      titleKey: "plotutils.menu.addon_data.delete_groups_confirm_title",
      bodyKey: "plotutils.menu.addon_data.delete_groups_confirm_body",
      bodyParams: [stats.groups],
      confirmKey: "plotutils.menu.addon_data.delete_all_groups",
      cancelKey: "plotutils.cancel",
    });
    if (!ok) return MenuService.open("addonData", player);
    const deleted = PlotGroupService.deleteAllGroups(player);
    FeedbackService.notify(player, "plotutils.menu.addon_data.delete_groups_done", [deleted]);
    return MenuService.open("addonData", player);
  },

  async resetConfigs(player) {
    const ok = await confirm(player, {
      titleKey: "plotutils.menu.addon_data.reset_configs_confirm_title",
      bodyKey: "plotutils.menu.addon_data.reset_configs_confirm_body",
      confirmKey: "plotutils.menu.addon_data.reset_configs",
      cancelKey: "plotutils.cancel",
    });
    if (!ok) return MenuService.open("addonData", player);
    resetConfigs();
    FeedbackService.notify(player, "plotutils.menu.addon_data.reset_configs_done");
    return MenuService.open("addonData", player);
  },

  async deleteAllAddonData(player) {
    const stats = PlotService.stats();
    const groupStats = PlotGroupService.stats();
    const ok = await confirm(player, {
      titleKey: "plotutils.menu.addon_data.delete_all_addon_confirm_title",
      bodyKey: "plotutils.menu.addon_data.delete_all_addon_confirm_body",
      bodyParams: [stats.plots, groupStats.groups],
      confirmKey: "plotutils.menu.addon_data.delete_all_addon",
      cancelKey: "plotutils.cancel",
    });
    if (!ok) return MenuService.open("addonData", player);

    const deletedGroups = PlotGroupService.deleteAllGroups(player);
    const deletedPlots = PlotService.deleteAllPlots(player);
    resetConfigs();
    removeString(Properties.legacyPlots);
    ToolboxService.clearOnlineSessions(player);

    FeedbackService.notify(player, "plotutils.menu.addon_data.delete_all_addon_done", [deletedPlots, deletedGroups]);
    return MenuService.open("addonData", player);
  },
};
