import { ActionFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const GlobalSettingsHubMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }
    const buttons = [
      { label: "plotutils.menu.global_hub.defaults", run: () => MenuService.open("defaultSettings", player) },
      { label: "plotutils.menu.global_hub.owner_rules", run: () => MenuService.open("ownerRules", player) },
      { label: "plotutils.menu.global_hub.admin_protection", run: () => MenuService.open("adminProtection", player) },
      { label: "plotutils.back", run: () => MenuService.open("admin", player) },
    ];
    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.global_hub.title"))
      .body(LanguageService.t("plotutils.menu.global_hub.help"));
    for (const button of buttons) form.button(LanguageService.t(button.label));
    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return MenuService.open("admin", player);
    return buttons[res.selection]?.run();
  },
};
