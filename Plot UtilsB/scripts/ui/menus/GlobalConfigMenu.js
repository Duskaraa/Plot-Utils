import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { GlobalSettings, GlobalSettingKeys } from "../../config/GlobalSettings.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const GlobalConfigMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const current = GlobalSettings.all();
    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.global.title"))
      .label(LanguageService.t("plotutils.menu.global.help"));
    for (const key of GlobalSettingKeys) {
      form.toggle(LanguageService.t(`plotutils.global.${key}`), { defaultValue: current[key] });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("admin", player);

    let changed = false;
    const offset = res.formValues.length === GlobalSettingKeys.length + 1 ? 1 : 0;
    for (let i = 0; i < GlobalSettingKeys.length; i++) {
      const key = GlobalSettingKeys[i];
      const value = Boolean(res.formValues[i + offset]);
      if (value !== current[key]) {
        GlobalSettings.set(key, value);
        changed = true;
      }
    }
    if (changed) FeedbackService.notify(player, "plotutils.global.updated");
    return MenuService.open("admin", player);
  },
};
