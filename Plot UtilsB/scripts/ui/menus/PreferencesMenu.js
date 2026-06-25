import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { AddonPreferences } from "../../config/AddonPreferences.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const PreferencesMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const keys = ["particleFillEnabled", "particleEdgesEnabled", "particleColorsEnabled"];
    const current = AddonPreferences.all();
    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.preferences.title"))
      .label(LanguageService.t("plotutils.menu.preferences.help"));
    for (const key of keys) {
      form.label(LanguageService.t(`plotutils.preferences.${key}.help`));
      form.toggle(LanguageService.t(`plotutils.preferences.${key}`), { defaultValue: current[key] });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("preferences", player);

    let changed = false;
    const values = res.formValues.filter((value) => typeof value === "boolean");
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = values[i] ?? current[key];
      if (value !== current[key]) {
        AddonPreferences.set(key, value);
        changed = true;
      }
    }
    if (changed) FeedbackService.notify(player, "plotutils.preferences.updated");
    return MenuService.open("preferences", player);
  },
};
