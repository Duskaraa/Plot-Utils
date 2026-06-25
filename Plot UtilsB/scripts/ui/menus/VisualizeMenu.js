import { EntityComponentTypes, ItemLockMode, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { Items } from "../../core/Constants.js";
import { LanguageService } from "../../services/LanguageService.js";
import { showForm } from "../FormGuards.js";

const itemByMode = {
  plots: Items.visualizeTool,
  groups: Items.visualizeGroupsTool,
  global: Items.visualizeGlobalTool,
};

function setHeldVisualizeItem(player, mode) {
  const typeId = itemByMode[mode];
  if (!typeId) return;

  const container = player.getComponent(EntityComponentTypes.Inventory)?.container;
  if (!container) return;

  const slot = player.selectedSlotIndex;
  const item = new ItemStack(typeId, 1);
  item.lockMode = ItemLockMode.slot;
  container.setItem(slot, item);
}

export const VisualizeMenu = {
  async open(player) {
    const container = player.getComponent(EntityComponentTypes.Inventory)?.container;
    const heldTypeId = container?.getItem(player.selectedSlotIndex)?.typeId;
    const current =
      heldTypeId === Items.visualizeGlobalTool
        ? "plotutils.menu.visualize.current_global"
        : heldTypeId === Items.visualizeGroupsTool
          ? "plotutils.menu.visualize.current_groups"
          : "plotutils.menu.visualize.current_plots";

    const buttons = [
      { label: "plotutils.menu.visualize.plots", mode: "plots", icon: "textures/items/visualize" },
      { label: "plotutils.menu.visualize.groups", mode: "groups", icon: "textures/items/visualize_groups" },
      { label: "plotutils.menu.visualize.global", mode: "global", icon: "textures/items/visualize_global" },
    ];

    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.visualize.title"))
      .body(LanguageService.t("plotutils.menu.visualize.body", [LanguageService.t(current)]));
    for (const b of buttons) form.button(LanguageService.t(b.label), b.icon);

    const res = await showForm(player, form);
    if (!res || res.canceled || res.selection === undefined) return;

    const selected = buttons[res.selection];
    if (!selected) return;
    setHeldVisualizeItem(player, selected.mode);
    LanguageService.actionBar(player, `plotutils.visualize_item_${selected.mode}`);
  },
};
