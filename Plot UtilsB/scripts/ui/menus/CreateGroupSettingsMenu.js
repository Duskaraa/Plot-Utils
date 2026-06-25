import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { PlayerSessionManager } from "../../session/PlayerSessionManager.js";
import { GroupSettings } from "../../config/GroupSettings.js";
import { GroupRuleKeys } from "../../domain/PlotSchema.js";
import { showForm } from "../FormGuards.js";

export const CreateGroupSettingsMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const session = PlayerSessionManager.get(player);
    const current = session.pendingGroupRules ?? GroupSettings.defaultRules();

    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.create_group_settings.title"))
      .label(LanguageService.t("plotutils.menu.create_group_settings.help"));
    for (const key of GroupRuleKeys) {
      form.toggle(LanguageService.t(`plotutils.flag.${key}`), { defaultValue: Boolean(current[key]) });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) {
      FeedbackService.notify(player, "plotutils.create_group_settings.closed");
      return;
    }

    const offset = res.formValues.length === GroupRuleKeys.length + 1 ? 1 : 0;
    const next = { ...current };
    let changed = false;
    for (let i = 0; i < GroupRuleKeys.length; i++) {
      const key = GroupRuleKeys[i];
      const value = Boolean(res.formValues[i + offset]);
      if (value !== Boolean(current[key])) changed = true;
      next[key] = value;
    }
    session.pendingGroupRules = next;
    FeedbackService.notify(
      player,
      changed ? "plotutils.create_group_settings.updated" : "plotutils.create_group_settings.closed",
    );
  },
};
