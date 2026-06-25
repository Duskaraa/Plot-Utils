import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { AddonPreferences } from "../../config/AddonPreferences.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

const keys = ["supportMessagesEnabled", "normalUsersSeeParticles"];

export const GeneralPreferencesMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const current = AddonPreferences.all();
    const form = new ModalFormData().title(LanguageService.t("plotutils.menu.general_preferences.title"));
    for (const key of keys) {
      form.label(LanguageService.t(`plotutils.preferences.${key}.help`));
      form.toggle(LanguageService.t(`plotutils.preferences.${key}`), { defaultValue: current[key] });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("preferences", player);

    const values = res.formValues.filter((value) => typeof value === "boolean");
    let changed = false;
    for (let i = 0; i < keys.length; i++) {
      const value = values[i] ?? current[keys[i]];
      if (value === current[keys[i]]) continue;
      AddonPreferences.set(keys[i], value);
      changed = true;
    }
    if (changed) FeedbackService.notify(player, "plotutils.preferences.updated");
    return MenuService.open("preferences", player);
  },
};
