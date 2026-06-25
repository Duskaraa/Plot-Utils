import { ActionFormData } from "@minecraft/server-ui";
import { Color } from "../../core/Format.js";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { PlotService } from "../../services/PlotService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const MyPlotsMenu = {
  async open(player, ctx = {}) {
    const source = ctx.source ?? "mine";
    if (source === "all" && !PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const plots = (
      source === "all"
        ? PlotService.all()
        : source === "owner"
          ? PlotService.listByOwner(player.id)
          : PlotService.listForPlayer(player.id)
    ).slice();
    plots.sort((a, b) => a.name.localeCompare(b.name));

    const titleKey =
      source === "all"
        ? "plotutils.menu.browse.title"
        : source === "owner"
          ? "plotutils.menu.owner_plots.title"
          : "plotutils.menu.my_plots.title";
    const form = new ActionFormData().title(LanguageService.t(titleKey));

    if (plots.length === 0) {
      form.body(LanguageService.t(source === "owner" ? "plotutils.menu.owner_plots.empty" : "plotutils.menu.my_plots.empty"));
      form.button(LanguageService.t("plotutils.close"));
      await showForm(player, form);
      return;
    }

    form.body(LanguageService.t(
      source === "owner" ? "plotutils.menu.owner_plots.body" : "plotutils.menu.my_plots.count",
      [plots.length],
    ));
    for (const plot of plots) {
      form.button(
        LanguageService.raw([
          LanguageService.text(plot.name),
          "\n",
          Color.id,
          LanguageService.text(plot.id),
        ]),
      );
    }
    const backIndex = plots.length;
    form.button(LanguageService.t("plotutils.back"));

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return;
    if (res.selection === backIndex) return;

    const plot = plots[res.selection];
    if (!plot) return;
    return MenuService.open("manage", player, { plotId: plot.id, source });
  },
};
