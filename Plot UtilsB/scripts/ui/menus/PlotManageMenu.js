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

function labelOf(nameKey, descKey) {
  return LanguageService.raw([
    LanguageService.t(nameKey),
    LanguageService.text(`\n${Color.id}`),
    LanguageService.t(descKey),
  ]);
}

function ownerLabelOf(plot) {
  if (plot.hideOwnerName) return LanguageService.t("plotutils.owner_hidden");
  if (!plot.hasOwner()) return LanguageService.t("plotutils.owner_undefined");
  return plot.ownerName ? LanguageService.text(plot.ownerName) : LanguageService.t("plotutils.owner_unknown");
}

function backFromManage(player, ctx, source) {
  return source === "group" && ctx.groupId
    ? MenuService.open("groupPlots", player, { groupId: ctx.groupId })
    : MenuService.open("myPlots", player, { source });
}

export const PlotManageMenu = {
  async open(player, ctx = {}) {
    const plot = PlotService.requireById(ctx.plotId);
    const source = ctx.source ?? "mine";
    const isAdmin = PermissionService.isAdmin(player);
    const canManage = PermissionService.canManage(player, plot);
    const canDelete = PermissionService.canDelete(player, plot);
    const canTeleport = PermissionService.canTeleport(player, plot);

    const size = plot.bounds ? plot.bounds.size : { x: 0, y: 0, z: 0 };
    const body = source === "owner"
      ? LanguageService.raw([
          LanguageService.t("plotutils.menu.owner_manage.welcome", [plot.name]),
          LanguageService.text(`\n${Color.secondary}`),
          LanguageService.t("plotutils.menu.manage.field_owner"),
          LanguageService.text(`${Color.reset} `),
          ownerLabelOf(plot),
          LanguageService.text(`\n${Color.secondary}`),
          LanguageService.t("plotutils.menu.manage.field_members"),
          LanguageService.text(`${Color.reset} ${plot.trustedPlayers.length}`),
          LanguageService.text("\n"),
          LanguageService.t("plotutils.menu.owner_manage.help"),
        ])
      : LanguageService.raw([
          LanguageService.text(`${Color.secondary}`),
          LanguageService.t("plotutils.menu.manage.field_owner"),
          LanguageService.text(`${Color.reset} `),
          ownerLabelOf(plot),
          LanguageService.text(`\n${Color.secondary}`),
          LanguageService.t("plotutils.menu.manage.field_id"),
          LanguageService.text(`${Color.reset} ${Color.id}${plot.id}${Color.reset}`),
          LanguageService.text(`\n${Color.secondary}`),
          LanguageService.t("plotutils.menu.manage.field_dimension"),
          LanguageService.text(`${Color.reset} ${plot.dimensionId}`),
          LanguageService.text(`\n${Color.secondary}`),
          LanguageService.t("plotutils.menu.manage.field_size"),
          LanguageService.text(`${Color.reset} ${Color.coord}${size.x} x ${size.y} x ${size.z}${Color.reset}`),
          LanguageService.text(`\n${Color.secondary}`),
          LanguageService.t("plotutils.menu.manage.field_members"),
          LanguageService.text(`${Color.reset} ${plot.trustedPlayers.length}`),
        ]);

    const buttons = [];

    if (source === "owner" && canManage) {
      if (PlotService.ownerCan(player, plot, "ownersCanUseSocialMenu")) {
        buttons.push({
          label: labelOf("plotutils.menu.manage.members", "plotutils.menu.manage.members_desc"),
          run: () => MenuService.open("members", player, ctx),
        });
      }
      if (PlotService.ownerCan(player, plot, "ownersCanEditVisitorPermissions")) {
        buttons.push({
          label: labelOf("plotutils.menu.manage.flags", "plotutils.menu.manage.flags_desc"),
          run: () => MenuService.open("flags", player, ctx),
        });
      }
    }

    if (isAdmin || PlotService.ownerCan(player, plot, "ownersCanTransferOwnership")) {
      buttons.push({
        label: plot.hasOwner()
          ? labelOf("plotutils.menu.manage.change_owner", "plotutils.menu.manage.change_owner_desc")
          : labelOf("plotutils.menu.manage.assign_owner", "plotutils.menu.manage.assign_owner_desc"),
        run: () => this.assignOwner(player, plot, ctx, source),
      });
    }

    if (canTeleport) {
      buttons.push({
        label: labelOf("plotutils.menu.manage.teleport", "plotutils.menu.manage.teleport_desc"),
        run: () => {
          try {
            PlotService.teleport(player, plot.id);
            FeedbackService.notify(player, "plotutils.teleport.success", [plot.name]);
          } catch (error) {
            reportError(player, error);
          }
        },
      });
    }

    if (canManage) {
      if (PlotService.ownerCan(player, plot, "ownersCanChangeDisplayName")) {
        buttons.push({
          label: labelOf("plotutils.menu.manage.rename", "plotutils.menu.manage.rename_desc"),
          run: () => this.rename(player, plot, ctx),
        });
      }

      if (PlotService.ownerCan(player, plot, "ownersCanTeleportAndSetSpawn")) {
        buttons.push({
          label: labelOf("plotutils.menu.manage.set_spawn", "plotutils.menu.manage.set_spawn_desc"),
          run: () => {
            try {
              PlotService.setSpawn(player, plot.id, player.location);
              FeedbackService.notify(player, "plotutils.spawn.set");
            } catch (error) {
              reportError(player, error);
            }
            return MenuService.open("manage", player, ctx);
          },
        });
      }

      if (source !== "owner" && PlotService.ownerCan(player, plot, "ownersCanUseSocialMenu")) {
        buttons.push({
          label: labelOf("plotutils.menu.manage.members", "plotutils.menu.manage.members_desc"),
          run: () => MenuService.open("members", player, ctx),
        });
      }

      if (source !== "owner" && PlotService.ownerCan(player, plot, "ownersCanEditVisitorPermissions")) {
        buttons.push({
          label: labelOf("plotutils.menu.manage.flags", "plotutils.menu.manage.flags_desc"),
          run: () => MenuService.open("flags", player, ctx),
        });
      }

      if (PlotService.ownerCan(player, plot, "ownersCanHideOwnerName")) {
        buttons.push({
          label: labelOf(
            plot.hideOwnerName
              ? "plotutils.menu.manage.show_owner"
              : "plotutils.menu.manage.hide_owner",
            "plotutils.menu.manage.owner_vis_desc",
          ),
          run: () => {
            try {
              PlotService.setHideOwnerName(player, plot.id, !plot.hideOwnerName);
              FeedbackService.notify(player, "plotutils.owner_vis.updated");
            } catch (error) {
              reportError(player, error);
            }
            return MenuService.open("manage", player, ctx);
          },
        });
      }
    }

    if (canDelete && source !== "owner") {
      buttons.push({
        label: labelOf("plotutils.menu.manage.delete", "plotutils.menu.manage.delete_desc"),
        run: () => this.delete(player, plot, source, ctx),
      });
    }
    buttons.push({
      label: LanguageService.t("plotutils.back"),
      run: () => backFromManage(player, ctx, source),
    });

    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.manage.title", [plot.name]))
      .body(body);
    for (const b of buttons) form.button(b.label);

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return backFromManage(player, ctx, source);
    return buttons[res.selection]?.run();
  },

  async assignOwner(player, plot, ctx, source) {
    const candidates = [
      { id: null, name: null },
      ...world.getPlayers().map((p) => ({ id: p.id, name: p.name })),
    ];
    const options = candidates.map((c) =>
      c.id ? LanguageService.text(c.name) : LanguageService.t("plotutils.owner_undefined"),
    );

    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.manage.assign_owner_title", [plot.name]))
      .dropdown(LanguageService.t("plotutils.create_owner"), options, { defaultValueIndex: 0 })
      .submitButton(LanguageService.t("plotutils.save"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("manage", player, ctx);

    const target = candidates[Number(res.formValues[0]) || 0] ?? candidates[0];
    try {
      PlotService.assignOwner(player, plot.id, target.id, target.name);
      if (target.id) {
        FeedbackService.notify(player, "plotutils.owner_assigned", [target.name]);
      } else {
        FeedbackService.notify(player, "plotutils.owner_cleared");
      }
    } catch (error) {
      reportError(player, error);
    }
    return MenuService.open("manage", player, ctx);
  },

  async rename(player, plot, ctx) {
    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.rename.title"))
      .textField(LanguageService.t("plotutils.create_display_name"), plot.name, { defaultValue: plot.name })
      .submitButton(LanguageService.t("plotutils.create_submit"));
    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return MenuService.open("manage", player, ctx);

    try {
      PlotService.renamePlot(player, plot.id, String(res.formValues[0] ?? ""));
      FeedbackService.notify(player, "plotutils.renamed", [String(res.formValues[0] ?? "")]);
    } catch (error) {
      reportError(player, error);
    }
    return MenuService.open("manage", player, ctx);
  },

  async delete(player, plot, source, ctx = {}) {
    const ok = await confirm(player, {
      titleKey: "plotutils.menu.manage.delete_confirm_title",
      bodyKey: "plotutils.menu.manage.delete_confirm_body",
      bodyParams: [plot.name],
    });
    if (ok === null) return;
    if (!ok) return MenuService.open("manage", player, ctx);
    try {
      PlotService.deletePlot(player, plot.id);
      FeedbackService.notify(player, "plotutils.deleted", [plot.name]);
    } catch (error) {
      reportError(player, error);
    }
    if (source === "group" && ctx.groupId) return MenuService.open("groupPlots", player, { groupId: ctx.groupId });
    return MenuService.open("myPlots", player, { source });
  },
};
