import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { Color } from "../../core/Format.js";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { PlotGroupService } from "../../services/PlotGroupService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { showForm, reportError } from "../FormGuards.js";
import { confirm } from "./ConfirmMenu.js";
import { MenuService } from "../MenuService.js";

function sizeText(group) {
  const size = group.bounds?.size;
  return size ? `${size.x} x ${size.y} x ${size.z}` : "-";
}

export const PlotGroupsMenu = {
  async open(player) {
    if (!PermissionService.isAdmin(player)) {
      FeedbackService.notify(player, "plotutils.permission.denied");
      return;
    }

    const groups = PlotGroupService.all().slice().sort((a, b) => a.name.localeCompare(b.name));
    const form = new ActionFormData().title(LanguageService.t("plotutils.menu.groups.title"));
    if (groups.length === 0) {
      form.body(LanguageService.t("plotutils.menu.groups.empty"));
      form.button(LanguageService.t("plotutils.back"));
      const res = await showForm(player, form);
      if (res && !res.canceled && res.selection === 0) return;
      return;
    }

    form.body(LanguageService.t("plotutils.menu.groups.count", [groups.length]));
    for (const group of groups) {
      form.button(
        LanguageService.raw([
          LanguageService.text(group.name),
          "\n",
          Color.id,
          LanguageService.text(group.id),
          " ",
          Color.id,
          LanguageService.t("plotutils.menu.group_plot_count_short", [group.plotIds.length]),
        ]),
      );
    }
    const backIndex = groups.length;
    form.button(LanguageService.t("plotutils.back"));

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined || res.selection === backIndex) return;
    const group = groups[res.selection];
    if (group) return MenuService.open("groupManage", player, { groupId: group.id });
  },
};

export const PlotGroupManageMenu = {
  async open(player, ctx = {}) {
    const group = PlotGroupService.requireById(ctx.groupId);
    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.group_manage.title", [group.name]))
      .body(LanguageService.t("plotutils.menu.group_manage.body", [
        group.id,
        group.dimensionId,
        sizeText(group),
        group.plotIds.length,
      ]));

    const buttons = [
      {
        label: "plotutils.menu.group_manage.plots",
        run: () => MenuService.open("groupPlots", player, { groupId: group.id }),
      },
      {
        label: "plotutils.menu.group_manage.rules",
        run: () => MenuService.open("groupRules", player, { groupId: group.id }),
      },
      {
        label: "plotutils.menu.group_manage.rename",
        run: () => this.rename(player, group),
      },
      {
        label: "plotutils.menu.group_manage.delete",
        run: () => this.delete(player, group),
      },
      {
        label: "plotutils.back",
        run: () => MenuService.open("groups", player),
      },
    ];
    for (const button of buttons) form.button(LanguageService.t(button.label));

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return MenuService.open("groups", player);
    return buttons[res.selection]?.run();
  },

  async rename(player, group) {
    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.group.rename.title"))
      .textField(
        LanguageService.t("plotutils.create_display_name"),
        LanguageService.t("plotutils.menu.group_create.name_placeholder"),
        { defaultValue: group.name },
    );
    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("groupManage", player, { groupId: group.id });
    try {
      const updated = PlotGroupService.rename(player, group.id, String(res.formValues[0] ?? ""));
      FeedbackService.notify(player, "plotutils.group.renamed", [updated.name]);
    } catch (error) {
      reportError(player, error);
    }
    return MenuService.open("groupManage", player, { groupId: group.id });
  },

  async delete(player, group) {
    const ok = await confirm(player, {
      titleKey: "plotutils.menu.group_manage.delete_confirm_title",
      bodyKey: "plotutils.menu.group_manage.delete_confirm_body",
      bodyParams: [group.name],
      confirmKey: "plotutils.menu.group_manage.delete",
      cancelKey: "plotutils.cancel",
    });
    if (ok === null) return;
    if (!ok) return MenuService.open("groupManage", player, { groupId: group.id });

    try {
      PlotGroupService.deleteGroup(player, group.id);
      FeedbackService.notify(player, "plotutils.group.deleted", [group.name]);
      return MenuService.open("groups", player);
    } catch (error) {
      reportError(player, error);
      return MenuService.open("groupManage", player, { groupId: group.id });
    }
  },
};

export const PlotGroupPlotsMenu = {
  async open(player, ctx = {}) {
    const group = PlotGroupService.requireById(ctx.groupId);
    const plots = PlotGroupService.plotsForGroup(group).sort((a, b) => a.name.localeCompare(b.name));
    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.group_plots.title", [group.name]));

    if (plots.length === 0) {
      form.body(LanguageService.t("plotutils.menu.group_plots.empty"));
      form.button(LanguageService.t("plotutils.back"));
      const res = await showForm(player, form);
      if (res && !res.canceled && res.selection === 0) return MenuService.open("groupManage", player, { groupId: group.id });
      return;
    }

    form.body(LanguageService.t("plotutils.menu.group_plots.body", [plots.length]));
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
    if (!res || res.canceled || res.selection === undefined) return MenuService.open("groupManage", player, { groupId: group.id });
    if (res.selection === backIndex) return MenuService.open("groupManage", player, { groupId: group.id });
    const plot = plots[res.selection];
    if (plot) return MenuService.open("manage", player, { plotId: plot.id, source: "group", groupId: group.id });
  },
};
