import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { PlotService } from "../../services/PlotService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { flagList } from "../../domain/PlotSchema.js";
import { showForm, reportError } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const PlotFlagsMenu = {
  async open(player, ctx = {}) {
    const plot = PlotService.requireById(ctx.plotId);
    if (!PermissionService.canManage(player, plot)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return MenuService.open("manage", player, ctx);
    }

    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.flags.title", [plot.name]))
      .label(LanguageService.t("plotutils.menu.flags.help"));
    for (const key of flagList) {
      form.toggle(LanguageService.t(`plotutils.flag.${key}`), { defaultValue: plot.flags[key] });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("manage", player, ctx);

    const offset = res.formValues.length === flagList.length + 1 ? 1 : 0;
    let changed = false;
    for (let i = 0; i < flagList.length; i++) {
      const key = flagList[i];
      const value = Boolean(res.formValues[i + offset]);
      if (value !== plot.flags[key]) {
        try {
          PlotService.setFlag(player, plot.id, key, value);
          changed = true;
        } catch (error) {
          reportError(player, error);
          break;
        }
      }
    }
    if (changed) FeedbackService.notify(player, "plotutils.flag.updated");
    return MenuService.open("manage", player, ctx);
  },
};
