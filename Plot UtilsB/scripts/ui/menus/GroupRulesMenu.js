import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { PlotGroupService } from "../../services/PlotGroupService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { GroupRuleKeys } from "../../domain/PlotSchema.js";
import { showForm, reportError } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const GroupRulesMenu = {
  async open(player, ctx = {}) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }
    const group = PlotGroupService.requireById(ctx.groupId);

    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.group_rules.title", [group.name]))
      .label(LanguageService.t("plotutils.menu.group_rules.help"));
    for (const key of GroupRuleKeys) {
      form.toggle(LanguageService.t(`plotutils.flag.${key}`), { defaultValue: Boolean(group.rules[key]) });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) {
      return MenuService.open("groupManage", player, { groupId: group.id });
    }

    const offset = res.formValues.length === GroupRuleKeys.length + 1 ? 1 : 0;
    const next = {};
    for (let i = 0; i < GroupRuleKeys.length; i++) {
      next[GroupRuleKeys[i]] = Boolean(res.formValues[i + offset]);
    }
    try {
      if (PlotGroupService.setRules(player, group.id, next)) {
        FeedbackService.notify(player, "plotutils.menu.group_rules.updated");
      }
    } catch (error) {
      reportError(player, error);
    }
    return MenuService.open("groupManage", player, { groupId: group.id });
  },
};
