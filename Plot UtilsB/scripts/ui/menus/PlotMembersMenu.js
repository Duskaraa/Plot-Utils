import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { PlotService } from "../../services/PlotService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { Color } from "../../core/Format.js";
import { showForm, reportError } from "../FormGuards.js";
import { confirm } from "./ConfirmMenu.js";
import { MenuService } from "../MenuService.js";

export const PlotMembersMenu = {
  async open(player, ctx = {}) {
    const plot = PlotService.requireById(ctx.plotId);
    if (!PermissionService.canManage(player, plot)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return MenuService.open("manage", player, ctx);
    }

    if (!PlotService.ownerCan(player, plot, "ownersCanUseSocialMenu")) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return MenuService.open("manage", player, ctx);
    }

    const canAdd = PlotService.ownerCan(player, plot, "ownersCanAddTrustedPlayers");
    const canRemove = PlotService.ownerCan(player, plot, "ownersCanRemoveTrustedPlayers");
    const canEditPerms = PlotService.ownerCan(player, plot, "ownersCanEditTrustedPlayerPermissions");

    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.members.title", [plot.name]))
      .body(LanguageService.t("plotutils.menu.members.body", [plot.trustedPlayers.length]));

    const actions = [];
    if (canAdd) {
      form.button(LanguageService.t("plotutils.menu.members.add"));
      actions.push(() => this.addTrusted(player, plot, ctx));
    }

    for (const trusted of plot.trustedPlayers) {
      form.button(
        LanguageService.raw([
          LanguageService.text(`${trusted.player.name}\n${Color.id}`),
          LanguageService.t("plotutils.menu.members.manage_hint"),
        ]),
      );
      actions.push(() => this.openTrusted(player, plot, trusted, ctx, canEditPerms, canRemove));
    }

    form.button(LanguageService.t("plotutils.back"));
    actions.push(() => MenuService.open("manage", player, ctx));

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return MenuService.open("manage", player, ctx);
    return actions[res.selection]?.();
  },

  async openTrusted(player, plot, trusted, ctx, canEditPerms, canRemove) {
    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.members.manage_title", [trusted.player.name]))
      .body(LanguageService.t("plotutils.menu.members.manage_body", [trusted.player.name]));

    const actions = [];
    if (canEditPerms) {
      form.button(LanguageService.t("plotutils.menu.members.edit_permissions"));
      actions.push(() =>
        MenuService.open("trustedPermissions", player, { ...ctx, targetId: trusted.player.id }),
      );
    }
    if (canRemove) {
      form.button(LanguageService.t("plotutils.menu.members.remove"));
      actions.push(() => this.removeTrusted(player, plot, trusted, ctx));
    }
    form.button(LanguageService.t("plotutils.back"));
    actions.push(() => MenuService.open("members", player, ctx));

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return MenuService.open("members", player, ctx);
    return actions[res.selection]?.();
  },

  async addTrusted(player, plot, ctx) {
    const candidates = world
      .getPlayers()
      .filter((p) => p.id !== plot.ownerId && !plot.isTrusted(p.id))
      .map((p) => ({ id: p.id, name: p.name }));

    if (candidates.length === 0) {
      FeedbackService.notify(player, "plotutils.menu.members.none_online");
      return MenuService.open("members", player, ctx);
    }

    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.members.add"))
      .dropdown(
        LanguageService.t("plotutils.menu.members.select_player"),
        candidates.map((c) => c.name),
        { defaultValueIndex: 0 },
      )
      .submitButton(LanguageService.t("plotutils.menu.members.add"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("members", player, ctx);

    const target = candidates[Number(res.formValues[0]) || 0];
    try {
      PlotService.addTrusted(player, plot.id, target.id, target.name);
      FeedbackService.notify(player, "plotutils.trusted.added", [target.name]);
    } catch (error) {
      reportError(player, error);
    }
    return MenuService.open("members", player, ctx);
  },

  async removeTrusted(player, plot, trusted, ctx) {
    const ok = await confirm(player, {
      titleKey: "plotutils.menu.members.remove_confirm_title",
      bodyKey: "plotutils.menu.members.remove_confirm_body",
      bodyParams: [trusted.player.name],
    });
    if (ok === null) return;
    if (ok) {
      try {
        PlotService.removeTrusted(player, plot.id, trusted.player.id);
        FeedbackService.notify(player, "plotutils.trusted.removed", [trusted.player.name]);
      } catch (error) {
        reportError(player, error);
      }
    }
    return MenuService.open("members", player, ctx);
  },
};
