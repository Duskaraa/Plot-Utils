import { world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { SelectionService } from "../../services/SelectionService.js";
import { PlotService } from "../../services/PlotService.js";
import { PlotGroupService } from "../../services/PlotGroupService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { PlayerSessionManager } from "../../session/PlayerSessionManager.js";
import { PlotBounds } from "../../domain/PlotBounds.js";
import { showForm, reportError } from "../FormGuards.js";
import { confirm } from "./ConfirmMenu.js";

const inputCount = 3;

export const CreatePlotMenu = {
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

    const bounds = new PlotBounds(sel.pos1, sel.pos2);
    const size = bounds.size;
    const dimensionId = sel.dimensionId ?? player.dimension.id;
    const { containing: containingGroup, partial: partialGroup } =
      PlotGroupService.findGroupOverlap(dimensionId, bounds);
    if (partialGroup) {
      FeedbackService.notify(player, "plotutils.create.group_partial_error", [partialGroup.name]);
      return;
    }

    const owners = [
      { id: null, name: null },
      ...world.getPlayers().map((p) => ({ id: p.id, name: p.name })),
    ];
    const ownerOptions = owners.map((o) =>
      o.id ? LanguageService.text(o.name) : LanguageService.t("plotutils.owner_undefined"),
    );

    const form = new ModalFormData()
      .title(LanguageService.t("plotutils.menu.create.title"))
      .label(
        LanguageService.t("plotutils.menu.create.info", [
          `${size.x} x ${size.y} x ${size.z}`,
          bounds.capacity,
          dimensionId,
        ]),
      )
      .textField(
        LanguageService.t("plotutils.create_display_name"),
        LanguageService.t("plotutils.create_display_name_placeholder"),
      )
      .textField(
        LanguageService.t("plotutils.create_internal_id"),
        LanguageService.t("plotutils.create_internal_id_placeholder"),
      )
      .dropdown(LanguageService.t("plotutils.create_owner"), ownerOptions, { defaultValueIndex: 0 })
      .submitButton(LanguageService.t("plotutils.create_submit"));

    const res = await showForm(player, form);
    if (!res || res.canceled || !res.formValues) return;

    const offset = Math.max(0, res.formValues.length - inputCount);
    const name = res.formValues[offset];
    const id = res.formValues[offset + 1];
    const owner = owners[Number(res.formValues[offset + 2]) || 0] ?? owners[0];

    try {
      if (containingGroup) {
        const ok = await confirm(player, {
          titleKey: "plotutils.create.group_confirm_title",
          bodyKey: "plotutils.create.group_confirm_body",
          bodyParams: [containingGroup.name],
          confirmKey: "plotutils.create.group_confirm_assign",
          cancelKey: "plotutils.create.group_confirm_cancel",
        });
        if (ok === null) return;
        if (!ok) {
          FeedbackService.notify(player, "plotutils.create.group_cancelled");
          return;
        }
      }
      const plot = PlotService.createFromSelection(player, {
        name: String(name ?? ""),
        id: String(id ?? ""),
        ownerId: owner.id,
        ownerName: owner.name,
        plotFlags: PlayerSessionManager.get(player).pendingPlotFlags ?? undefined,
        groupId: containingGroup?.id,
      });
      FeedbackService.notify(player, "plotutils.create.success", [plot.name, plot.bounds.capacity]);
    } catch (error) {
      reportError(player, error);
    }
  },
};
