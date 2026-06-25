import { ActionFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const DefaultSettingsHubMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }
    const buttons = [
      { label: "plotutils.menu.global_hub.default_plots", run: () => MenuService.open("defaultPlotSettings", player) },
      { label: "plotutils.menu.global_hub.default_groups", run: () => MenuService.open("groupSettings", player, { source: "defaults" }) },
      { label: "plotutils.back", run: () => MenuService.open("globalConfig", player) },
    ];
    const form = new ActionFormData().title(LanguageService.t("plotutils.menu.default_hub.title"));
    for (const button of buttons) form.button(LanguageService.t(button.label));
    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return MenuService.open("globalConfig", player);
    return buttons[res.selection]?.run();
  },
};
