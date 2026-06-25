import { ActionFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const AdminMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const buttons = [
      {
        label: "plotutils.menu.admin.preferences",
        run: () => MenuService.open("preferences", player),
      },
      {
        label: "plotutils.menu.admin.addon_permissions",
        run: () => MenuService.open("globalConfig", player),
      },
      {
        label: "plotutils.menu.admin.addon_data",
        run: () => MenuService.open("addonData", player, { source: "admin" }),
      },
      {
        label: "plotutils.menu.admin.credits",
        run: () => MenuService.open("credits", player, { source: "admin" }),
      },
      { label: "plotutils.back", run: () => undefined },
    ];

    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.admin.title"))
      .body(LanguageService.t("plotutils.menu.admin.body"));
    for (const b of buttons) form.button(LanguageService.t(b.label));

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return;
    return buttons[res.selection]?.run();
  },
};
