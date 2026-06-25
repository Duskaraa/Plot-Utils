import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { DefaultPlotSettings } from "../../config/DefaultPlotSettings.js";
import { flagList } from "../../domain/PlotSchema.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const DefaultPlotSettingsMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const current = DefaultPlotSettings.all();
    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.defaults.title"))
      .label(LanguageService.t("plotutils.menu.defaults.help"));
    for (const key of flagList) {
      form.toggle(LanguageService.t(`plotutils.flag.${key}`), { defaultValue: current[key] });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("defaultSettings", player);

    let changed = false;
    const offset = res.formValues.length === flagList.length + 1 ? 1 : 0;
    for (let i = 0; i < flagList.length; i++) {
      const key = flagList[i];
      const value = Boolean(res.formValues[i + offset]);
      if (value !== current[key]) {
        DefaultPlotSettings.set(key, value);
        changed = true;
      }
    }
    if (changed) FeedbackService.notify(player, "plotutils.defaults.updated");
    return MenuService.open("defaultSettings", player);
  },
};
