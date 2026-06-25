import { world, system } from "@minecraft/server";
import { Items, ToolItems } from "../core/Constants.js";
import { SelectionWandItem } from "./SelectionWandItem.js";
import { ToolboxService } from "../services/ToolboxService.js";
import { PermissionService } from "../services/PermissionService.js";
import { PlayerSessionManager } from "../session/PlayerSessionManager.js";
import { UiGate } from "../ui/UiGate.js";
import { Logger } from "../core/Logger.js";

const wandCd = 6;

function onceThisTick(player, typeId) {
  const session = PlayerSessionManager.get(player);
  if (session.lastItemTick.get(typeId) === system.currentTick) return false;
  session.lastItemTick.set(typeId, system.currentTick);
  return true;
}

const lastFireTick = new Map();
const lastWandBlockTick = new Map();

function isNewPress(player) {
  const tick = system.currentTick;
  const last = lastFireTick.get(player.id);
  lastFireTick.set(player.id, tick);
  return last === undefined || tick - last > 1;
}

function canUseWand(player, action) {
  const tick = system.currentTick;
  const state = lastWandBlockTick.get(player.id) ?? {};
  const last = state[action];
  if (last !== undefined && tick - last < wandCd) return false;
  state[action] = tick;
  lastWandBlockTick.set(player.id, state);
  return true;
}

export const ItemRegistry = {
  subscribe() {
    world.beforeEvents.itemUse.subscribe((event) => {
      const typeId = event.itemStack?.typeId;
      if (!typeId || !ToolItems.has(typeId) || typeId === Items.selectionWand) return;
      event.cancel = true;
      const player = event.source;
      if (!isNewPress(player)) return;
      system.run(async () => {
        if (!onceThisTick(player, typeId)) return;
        if (!UiGate.acquire(player.id)) return;
        try {
          await ToolboxService.handleTool(player, typeId);
        } finally {
          UiGate.release(player.id);
        }
      });
    });

    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
      const typeId = event.itemStack?.typeId;
      if (!typeId || !ToolItems.has(typeId)) return;
      event.cancel = true;
      const player = event.player;
      const block = event.block;

      if (typeId !== Items.selectionWand && !isNewPress(player)) return;
      if (typeId === Items.selectionWand && !canUseWand(player, "interact")) return;

      system.run(async () => {
        if (!onceThisTick(player, typeId)) return;
        if (typeId === Items.selectionWand) {
          SelectionWandItem.onInteractBlock(player, block);
          ToolboxService.afterWandUse(player);
          return;
        }
        if (!UiGate.acquire(player.id)) return;
        try {
          await ToolboxService.handleTool(player, typeId);
        } finally {
          UiGate.release(player.id);
        }
      });
    });

    world.beforeEvents.playerBreakBlock.subscribe((event) => {
      const typeId = event.itemStack?.typeId;
      if (!typeId || !ToolItems.has(typeId)) return;

      if (typeId === Items.selectionWand) {
        event.cancel = true;
        const player = event.player;
        const block = event.block;
        if (!canUseWand(player, "break")) return;
        system.run(() => {
          if (!onceThisTick(player, typeId)) return;
          SelectionWandItem.onBreak(player, block);
          ToolboxService.afterWandUse(player);
        });
        return;
      }

      if (!PermissionService.isAdmin(event.player)) {
        event.cancel = true;
        const player = event.player;
        system.run(() => ToolboxService.onNonAdminBreak(player));
      }
    });

    Logger.info("Item behaviors subscribed.");
  },

  forgetPlayer(playerId) {
    lastFireTick.delete(playerId);
    lastWandBlockTick.delete(playerId);
    UiGate.release(playerId);
  },
};
