import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { GroupSettings, GroupCreationKeys } from "../../config/GroupSettings.js";
import { GroupRuleKeys } from "../../domain/PlotSchema.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

function applyToggles(player, keys, current, formValues) {
  const offset = formValues.length === keys.length + 1 ? 1 : 0;
  let changed = false;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = Boolean(formValues[i + offset]);
    if (value !== Boolean(current[key])) {
      GroupSettings.set(key, value);
      changed = true;
    }
  }
  if (changed) FeedbackService.notify(player, "plotutils.menu.group_settings.updated");
}

export const GroupSettingsMenu = {
  async open(player, ctx = {}) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const back = () => {
      if (ctx.source === "defaults") return MenuService.open("defaultSettings", player);
      FeedbackService.notify(player, "plotutils.plot_groups.returned");
      return undefined;
    };

    const buttons = [
      {
        label: "plotutils.menu.group_settings.creation_defaults",
        run: () => this.creationDefaults(player, ctx),
      },
      {
        label: "plotutils.menu.group_settings.default_rules",
        run: () => this.defaultRules(player, ctx),
      },
      { label: "plotutils.back", run: back },
    ];

    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.group_settings.title"))
      .body(LanguageService.t("plotutils.menu.group_settings.body"));
    for (const b of buttons) form.button(LanguageService.t(b.label));

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return back();
    return buttons[res.selection]?.run();
  },

  async creationDefaults(player, ctx = {}) {
    const current = GroupSettings.all();
    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.group_settings.creation_defaults"))
      .label(LanguageService.t("plotutils.menu.group_settings.creation_help"));
    for (const key of GroupCreationKeys) {
      form.toggle(LanguageService.t(`plotutils.menu.group_settings.${key}`), { defaultValue: Boolean(current[key]) });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (res && !res.canceled && res.formValues) {
      applyToggles(player, GroupCreationKeys, current, res.formValues);
    }
    return MenuService.open("groupSettings", player, ctx);
  },

  async defaultRules(player, ctx = {}) {
    const current = GroupSettings.all();
    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.group_settings.default_rules"))
      .label(LanguageService.t("plotutils.menu.group_settings.rules_help"));
    for (const key of GroupRuleKeys) {
      form.toggle(LanguageService.t(`plotutils.flag.${key}`), { defaultValue: Boolean(current[key]) });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (res && !res.canceled && res.formValues) {
      applyToggles(player, GroupRuleKeys, current, res.formValues);
    }
    return MenuService.open("groupSettings", player, ctx);
  },
};
