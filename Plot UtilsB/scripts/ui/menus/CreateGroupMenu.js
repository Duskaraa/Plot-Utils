import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { SelectionService } from "../../services/SelectionService.js";
import { PlotGroupService } from "../../services/PlotGroupService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { PlayerSessionManager } from "../../session/PlayerSessionManager.js";
import { GroupSettings } from "../../config/GroupSettings.js";
import { showForm, reportError } from "../FormGuards.js";

export const CreateGroupMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }
    const sel = SelectionService.get(player);
    if (!sel.pos1 || !sel.pos2) {
      FeedbackService.notify(player, "plotutils.set_positions");
      return;
    }

    const { bounds, dimensionId, contained, partial, groups } = PlotGroupService.analyzeSelection(player);
    const size = bounds.size;
    const bodyParts = [
      LanguageService.t("plotutils.menu.group_create.info", [
        `${size.x} x ${size.y} x ${size.z}`,
        bounds.capacity,
        dimensionId,
        contained.length,
        partial.length,
        groups.length,
      ]),
    ];
    if (contained.length > 0) {
      bodyParts.push("\n\n", LanguageService.t("plotutils.menu.group_create.contained_warning", [contained.length]));
    }
    if (partial.length > 0) {
      bodyParts.push("\n", LanguageService.t("plotutils.menu.group_create.partial_warning", [partial.length, partial[0].name]));
    }
    if (groups.length > 0) {
      bodyParts.push("\n", LanguageService.t("plotutils.menu.group_create.group_warning", [groups[0].name]));
    }

    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.group_create.title"))
      .label(LanguageService.raw(bodyParts))
      .textField(
        LanguageService.t("plotutils.menu.group_create.name"),
        LanguageService.t("plotutils.menu.group_create.name_placeholder"),
      )
      .textField(
        LanguageService.t("plotutils.create_internal_id"),
        LanguageService.t("plotutils.menu.group_create.id_placeholder"),
      );

    if (contained.length > 0) {
      form.toggle(LanguageService.t("plotutils.menu.group_create.delete_contained"), {
        defaultValue: GroupSettings.get("deleteContainedByDefault"),
      });
    }

    if (partial.length > 0) {
      form.toggle(LanguageService.t("plotutils.menu.group_create.delete_partial"), {
        defaultValue: GroupSettings.get("deletePartialByDefault"),
      });
    }

    form.submitButton(LanguageService.t("plotutils.create_submit"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return;

    const extraValues = (contained.length > 0 ? 1 : 0) + (partial.length > 0 ? 1 : 0);
    const nameIndex = res.formValues.length - (2 + extraValues);
    let cursor = nameIndex + 2;
    try {
      const group = PlotGroupService.createFromSelection(player, {
        name: String(res.formValues[nameIndex] ?? ""),
        id: String(res.formValues[nameIndex + 1] ?? ""),
        rules: PlayerSessionManager.get(player).pendingGroupRules ?? undefined,
        deleteContainedPlots: contained.length > 0 ? Boolean(res.formValues[cursor++]) : false,
        deletePartialPlots: partial.length > 0 ? Boolean(res.formValues[cursor++]) : false,
      });
      FeedbackService.notify(player, "plotutils.group.create.success", [group.name, group.plotIds.length]);
    } catch (error) {
      reportError(player, error);
    }
  },
};
