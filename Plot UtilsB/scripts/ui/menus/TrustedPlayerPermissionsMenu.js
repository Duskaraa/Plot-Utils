import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { PlotService } from "../../services/PlotService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { ActionKeys } from "../../domain/PlotSchema.js";
import { showForm, reportError } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const TrustedPlayerPermissionsMenu = {
  async open(player, ctx = {}) {
    const plot = PlotService.requireById(ctx.plotId);
    if (!PermissionService.canManage(player, plot)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return MenuService.open("manage", player, ctx);
    }
    if (!PlotService.ownerCan(player, plot, "ownersCanEditTrustedPlayerPermissions")) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return MenuService.open("members", player, ctx);
    }

    const trusted = plot.getTrusted(ctx.targetId);
    if (!trusted) {
      FeedbackService.notify(player, "plotutils.trusted.error.not_trusted");
      return MenuService.open("members", player, ctx);
    }

    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.member_perms.title", [trusted.player.name]))
      .label(LanguageService.t("plotutils.menu.member_perms.help"));
    for (const key of ActionKeys) {
      form.toggle(LanguageService.t(`plotutils.action.${key}`), {
        defaultValue: Boolean(trusted.permissions[key]),
      });
    }
    form.submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("members", player, ctx);

    const offset = res.formValues.length === ActionKeys.length + 1 ? 1 : 0;
    let changed = false;
    for (let i = 0; i < ActionKeys.length; i++) {
      const key = ActionKeys[i];
      const value = Boolean(res.formValues[i + offset]);
      if (value !== Boolean(trusted.permissions[key])) {
        try {
          PlotService.setTrustedPermission(player, plot.id, trusted.player.id, key, value);
          changed = true;
        } catch (error) {
          reportError(player, error);
          break;
        }
      }
    }
    if (changed) FeedbackService.notify(player, "plotutils.permission.updated");
    return MenuService.open("members", player, ctx);
  },
};
