import { world, system, ItemStack, ItemLockMode, EntityComponentTypes } from "@minecraft/server";
import { Items, Dimensions } from "../core/Constants.js";
import { HotbarLayouts, isLocked } from "../items/ToolDescriptors.js";
import { PermissionService } from "./PermissionService.js";
import { SelectionService } from "./SelectionService.js";
import { LanguageService } from "./LanguageService.js";
import { FeedbackService } from "./FeedbackService.js";
import { PlayerSessionManager } from "../session/PlayerSessionManager.js";
import { MenuService } from "../ui/MenuService.js";
import { confirm } from "../ui/menus/ConfirmMenu.js";
import { PlotService } from "./PlotService.js";
import { DefaultPlotSettings } from "../config/DefaultPlotSettings.js";
import { GroupSettings } from "../config/GroupSettings.js";
import { Logger } from "../core/Logger.js";

const stasherEntityId = "source:inventory_stasher";
const stasherDestroyEvent = "source:destroy";
const stashBase = { x: 10000, y: 300, z: 10000 };
const stashSpacing = 32;
const stashGridWidth = 64;

const toggleCooldownTicks = 5;
const createModeLockTicks = 15;
const visualizeCooldownTicks = 6;

const Sounds = {
  toolboxOpen: "random.chestopen",
  toolboxClose: "random.chestclosed",
  toolUse: "mob.chicken.plop",
  visualize: "note.pling",
  selectionCancel: "note.bass",
};

const layouts = {
  main: HotbarLayouts.main,
  create: HotbarLayouts.create,
  advanced: HotbarLayouts.advanced,
  plotGroups: HotbarLayouts.plotGroups,
  groupCreate: HotbarLayouts.groupCreate,
};

const validLayouts = new Set(Object.keys(layouts));
const defaultLayout = "main";

const tempToolItems = new Set();
for (const layout of Object.values(layouts)) {
  for (const typeId of layout.values()) tempToolItems.add(typeId);
}
tempToolItems.add(Items.visualizeGlobalTool);
const allToolItems = new Set([Items.toolboxClosed, ...tempToolItems]);
const visualizeItems = new Set([Items.visualizeTool, Items.visualizeGroupsTool, Items.visualizeGlobalTool]);

const slotByItem = {};
for (const [name, slots] of Object.entries(layouts)) {
  const index = new Map();
  for (const [slot, typeId] of slots) index.set(typeId, slot);
  slotByItem[name] = index;
}

const stashEntityIds = new Map();
const opening = new Set();
const closing = new Set();
const inventoryMutations = new Set();
const toggleReady = new Map();
const visReady = new Map();

function overworld() {
  return world.getDimension(Dimensions.overworld);
}
function playSound(player, sound, options = {}) {
  try {
    player.playSound(sound, options);
  } catch { }
}
function playToolSound(player) {
  playSound(player, Sounds.toolUse, { pitch: 1.2, volume: 0.6 });
}
function playVisualizeSound(player) {
  playSound(player, Sounds.visualize, { pitch: 1.35, volume: 0.7 });
}
function getInventory(player) {
  return player.getComponent(EntityComponentTypes.Inventory)?.container;
}

function isToolboxOpen(player) {
  return Boolean(PlayerSessionManager.peek(player.id)?.toolboxLayout);
}
function layoutOf(player) {
  const stored = PlayerSessionManager.get(player).toolboxLayout;
  return validLayouts.has(stored) ? stored : defaultLayout;
}
function slotsFor(player) {
  return layouts[layoutOf(player)];
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
const stashKeyForName = (name) => hashText(name.toLowerCase()).toString(36);
const stashKey = (player) => stashKeyForName(player.name);
const stashTag = (player) => `plotutils_stash_${stashKey(player)}`;
const legacyStashTag = (player) => `plotutils_stash_${hashText(player.id).toString(36)}`;
const stashName = (player) => `Plot Utils Stash ${player.name}`;
const stashAreaIdForName = (name) => `plotutils_stash_${stashKeyForName(name)}`;
const stashAreaId = (player) => stashAreaIdForName(player.name);
const legacyStashAreaId = (player) => `plotutils_stash_${hashText(player.id).toString(36)}`;

function gridLocation(index) {
  const gridX = index % stashGridWidth;
  const gridZ = Math.floor(index / stashGridWidth) % stashGridWidth;
  return {
    x: stashBase.x + gridX * stashSpacing,
    y: stashBase.y,
    z: stashBase.z + gridZ * stashSpacing,
  };
}
const stashLocation = (player) => gridLocation(hashText(player.name.toLowerCase()));
const legacyStashLocation = (player) => gridLocation(hashText(player.id));

function stashAreaOptions(location) {
  return {
    dimension: overworld(),
    from: { x: location.x - 8, y: location.y - 8, z: location.z - 8 },
    to: { x: location.x + 8, y: location.y + 8, z: location.z + 8 },
  };
}

async function ensureTickingArea(areaId, options) {
  const manager = world.tickingAreaManager;
  if (!manager.hasTickingArea(areaId)) {
    if (!manager.hasCapacity(options)) throw new Error("No ticking area capacity for inventory stash.");
    await manager.createTickingArea(areaId, options);
  }
  const area = manager.getTickingArea(areaId);
  if (!area?.isFullyLoaded) throw new Error("Inventory stash ticking area was not fully loaded.");
}
async function ensureStashArea(player) {
  await ensureTickingArea(stashAreaId(player), stashAreaOptions(stashLocation(player)));
}
async function ensureLegacyStashArea(player) {
  const areaId = legacyStashAreaId(player);
  if (areaId === stashAreaId(player)) return;
  await ensureTickingArea(areaId, stashAreaOptions(legacyStashLocation(player)));
}
function removeStashArea(player) {
  const manager = world.tickingAreaManager;
  const areaId = stashAreaId(player);
  if (manager.hasTickingArea(areaId)) manager.removeTickingArea(areaId);
}
function removeLegacyStashArea(player) {
  const manager = world.tickingAreaManager;
  const areaId = legacyStashAreaId(player);
  if (areaId !== stashAreaId(player) && manager.hasTickingArea(areaId)) manager.removeTickingArea(areaId);
}
function removeStashAreas(player) {
  removeStashArea(player);
  removeLegacyStashArea(player);
}

function wait(ticks) {
  return new Promise((resolve) => system.runTimeout(resolve, ticks));
}

async function findStasher(player, attempts = 5, delayTicks = 4) {
  for (let i = 0; i < attempts; i++) {
    const stasher = getStashEntity(player);
    if (stasher) return stasher;
    if (i < attempts - 1) await wait(delayTicks);
  }
  return undefined;
}

function getStashEntity(player) {
  const cachedId = stashEntityIds.get(stashKey(player));
  if (cachedId) {
    const cached = world.getEntity(cachedId);
    if (cached?.isValid && cached.typeId === stasherEntityId) return cached;
    stashEntityIds.delete(stashKey(player));
  }
  const expectedTag = stashTag(player);
  const legacyTag = legacyStashTag(player);
  const expectedName = stashName(player);
  for (const stasher of overworld().getEntities({ type: stasherEntityId })) {
    if (stasher.hasTag(expectedTag) || stasher.hasTag(legacyTag) || stasher.nameTag === expectedName) {
      stashEntityIds.set(stashKey(player), stasher.id);
      if (!stasher.hasTag(expectedTag)) {
        try {
          stasher.addTag(expectedTag);
        } catch { }
      }
      return stasher;
    }
  }
  return undefined;
}
function spawnStashEntity(player) {
  const stasher = overworld().spawnEntity(stasherEntityId, stashLocation(player));
  stasher.addTag("plotutils_lz_stash");
  stasher.addTag(stashTag(player));
  stasher.addTag(legacyStashTag(player));
  stasher.nameTag = stashName(player);
  stashEntityIds.set(stashKey(player), stasher.id);
  return stasher;
}
function getStashContainer(stasher) {
  return stasher.getComponent(EntityComponentTypes.Inventory)?.container;
}

function isContainerEmpty(container, slotCount) {
  for (let slot = 0; slot < slotCount; slot++) {
    if (container.getItem(slot)) return false;
  }
  return true;
}

function stowSlots(from, to, slotCount) {
  for (let slot = 0; slot < slotCount; slot++) {
    const item = from.getItem(slot);
    if (!item) continue;
    to.setItem(slot, item);
    from.setItem(slot, undefined);
  }
}

function restoreMovedSlots(from, to, slotCount) {
  for (let slot = 0; slot < slotCount; slot++) {
    const item = from.getItem(slot);
    if (!item) continue;
    to.setItem(slot, item);
    from.setItem(slot, undefined);
  }
  return from.firstItem() === undefined;
}

function clearToolboxInv(container) {
  for (let slot = 0; slot < container.size; slot++) {
    container.setItem(slot, undefined);
  }
}

function mutateInventory(player, operation) {
  inventoryMutations.add(player.id);
  try {
    return operation();
  } finally {
    system.run(() => inventoryMutations.delete(player.id));
  }
}

function restoreStash(stashInv, pInv) {
  clearToolboxInv(pInv);
  return restoreMovedSlots(stashInv, pInv, Math.min(pInv.size, stashInv.size));
}

const wandDroppableLayouts = new Set(["create", "groupCreate"]);

function makeToolItem(typeId, layout = defaultLayout) {
  const item = new ItemStack(typeId, 1);
  const lock =
    typeId === Items.selectionWand ? !wandDroppableLayouts.has(layout) : isLocked(typeId);
  if (lock) item.lockMode = ItemLockMode.slot;
  return item;
}

function clearToolboxItems(player) {
  const container = getInventory(player);
  if (!container) return;
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item && tempToolItems.has(item.typeId)) container.setItem(slot, undefined);
  }
}
function removeAllToolItems(player) {
  const container = getInventory(player);
  if (!container) return;
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item && allToolItems.has(item.typeId)) container.setItem(slot, undefined);
  }
}
function getExpectedSlot(player, typeId) {
  if (visualizeItems.has(typeId)) {
    const slots = slotByItem[layoutOf(player)];
    return slots.get(Items.visualizeTool) ?? slots.get(Items.visualizeGroupsTool);
  }
  return slotByItem[layoutOf(player)].get(typeId);
}
function shouldShowItem(player, layout, typeId) {
  if (layout === "groupCreate") {
    if (typeId === Items.createGroupTool || typeId === Items.configCurrentTool) return SelectionService.hasBoth(player);
    return true;
  }
  if (layout !== "create") return true;
  if (typeId === Items.finishPlotTool || typeId === Items.configCurrentTool) return SelectionService.hasBoth(player);
  return true;
}
function isToggleReady(player) {
  const readyTick = toggleReady.get(player.id) ?? 0;
  const left = readyTick - system.currentTick;
  if (left > 0) {
    LanguageService.actionBar(player, "plotutils.toolbox_wait", [Math.ceil(left / 20)]);
    return false;
  }
  return true;
}
function beginToggleCooldown(player) {
  if (!isToggleReady(player)) return false;
  toggleReady.set(player.id, system.currentTick + toggleCooldownTicks);
  return true;
}
function lockToolboxToggle(player, ticks) {
  const readyTick = system.currentTick + ticks;
  toggleReady.set(player.id, Math.max(toggleReady.get(player.id) ?? 0, readyTick));
}
function beginVisualizeCooldown(player) {
  const readyTick = visReady.get(player.id) ?? 0;
  if (readyTick > system.currentTick) return false;
  visReady.set(player.id, system.currentTick + visualizeCooldownTicks);
  return true;
}
async function tryOpenVisualizeMenu(player) {
  if (!player.isSneaking) return false;
  if (!beginVisualizeCooldown(player)) return false;
  playToolSound(player);
  await MenuService.open("visualize", player);
  return true;
}
function placeToolboxItems(player, layout) {
  if (!validLayouts.has(layout)) layout = defaultLayout;
  const container = getInventory(player);
  if (!container) return false;
  PlayerSessionManager.get(player).toolboxLayout = layout;
  mutateInventory(player, () => {
    clearToolboxInv(container);
    for (const [slot, typeId] of layouts[layout]) {
      if (!shouldShowItem(player, layout, typeId)) continue;
      container.setItem(slot, makeToolItem(typeId, layout));
    }
  });
  return true;
}
function refreshCreateToolSlot(player) {
  const layout = layoutOf(player);
  if (layout !== "create" && layout !== "groupCreate") return;
  const container = getInventory(player);
  if (!container) return;
  const slots = layout === "groupCreate" ? layouts.groupCreate : layouts.create;
  for (const [slot, typeId] of slots) {
    if (typeId !== Items.finishPlotTool && typeId !== Items.createGroupTool && typeId !== Items.configCurrentTool) continue;
    if (SelectionService.hasBoth(player)) {
      container.setItem(slot, makeToolItem(typeId, layout));
    } else {
      const item = container.getItem(slot);
      if (item?.typeId === typeId) container.setItem(slot, undefined);
    }
  }
}
function cancelSelection(player) {
  SelectionService.clear(player);
  playSound(player, Sounds.selectionCancel, { pitch: 0.85, volume: 0.7 });
}
function restoreSlot(player, slot, preferredTypeId = undefined) {
  const typeId = preferredTypeId ?? slotsFor(player).get(slot);
  const container = getInventory(player);
  if (!typeId || !container || !isToolboxOpen(player)) return;
  if (!shouldShowItem(player, layoutOf(player), typeId)) {
    container.setItem(slot, undefined);
    return;
  }
  container.setItem(slot, makeToolItem(typeId, layoutOf(player)));
}

function removeDroppedTools(player, typeId, radius = 6) {
  try {
    const items = player.dimension.getEntities({
      type: "minecraft:item",
      location: player.location,
      maxDistance: radius,
    });
    for (const entity of items) {
      const stack = entity.getComponent(EntityComponentTypes.Item)?.itemStack;
      if (stack?.typeId !== typeId) continue;
      try {
        entity.remove();
      } catch { }
    }
  } catch (error) {
    Logger.debug("Dropped tool cleanup failed:", error);
  }
}

function destroyStashLater(player, stasher) {
  try {
    stasher.triggerEvent(stasherDestroyEvent);
  } catch (error) {
    LanguageService.message(player, "plotutils.error_stasher_trigger", [stasherDestroyEvent, String(error)]);
    return;
  }
  system.runTimeout(() => {
    try {
      if (getStashEntity(player)) {
        LanguageService.message(player, "plotutils.error_stasher_not_removed", [stasherDestroyEvent]);
        return;
      }
      stashEntityIds.delete(stashKey(player));
    } catch (error) {
      LanguageService.message(player, "plotutils.error_stash_area_remove", [String(error)]);
    }
  }, 5);
}

async function openToolbox(player) {
  if (!PermissionService.isAdmin(player)) {
    removeAllToolItems(player);
    LanguageService.actionBar(player, "plotutils.admin_only");
    return;
  }
  if (opening.has(player.id)) return;
  if (!beginToggleCooldown(player)) return;
  opening.add(player.id);
  try {
    await ensureStashArea(player);

    if (getStashEntity(player)) {
      placeToolboxItems(player, "main");
      playSound(player, Sounds.toolboxOpen, { pitch: 1.25, volume: 0.75 });
      LanguageService.actionBar(player, "plotutils.toolbox_reopened");
      return;
    }

    const pInv = getInventory(player);
    if (!pInv) throw new Error("Player inventory container unavailable.");

    const stasher = spawnStashEntity(player);
    try {
      const stashInv = getStashContainer(stasher);
      if (!stashInv) throw new Error(`${stasherEntityId} has no inventory container.`);
      if (stashInv.size < pInv.size) {
        throw new Error(`${stasherEntityId} needs at least ${pInv.size} slots.`);
      }

      if (!isContainerEmpty(stashInv, pInv.size)) {
        throw new Error(`${stasherEntityId} container was not empty before stowing.`);
      }
      stowSlots(pInv, stashInv, pInv.size);
    } catch (error) {
      const stashInv = getStashContainer(stasher);
      if (stashInv) restoreMovedSlots(stashInv, pInv, pInv.size);
      destroyStashLater(player, stasher);
      throw error;
    }

    placeToolboxItems(player, "main");
    playSound(player, Sounds.toolboxOpen, { pitch: 1.25, volume: 0.75 });
    LanguageService.actionBar(player, "plotutils.toolbox_opened");
  } catch (error) {
    try {
      if (!getStashEntity(player)) removeStashArea(player);
    } catch (cleanupError) {
      Logger.debug("Stash area cleanup after failed open failed:", cleanupError);
    }
    LanguageService.actionBar(player, "plotutils.toolbox_open_failed");
    LanguageService.message(player, "plotutils.error_inventory_stash", [String(error)]);
  } finally {
    opening.delete(player.id);
  }
}

async function closeToolbox(player) {
  if (closing.has(player.id)) return;
  if (!beginToggleCooldown(player)) return;
  closing.add(player.id);
  try {
    let areaError;
    try {
      await ensureStashArea(player);
    } catch (error) {
      areaError = error;
    }

    let stasher = await findStasher(player);
    if (!stasher) {
      await ensureLegacyStashArea(player);
      stasher = await findStasher(player);
    }
    if (!stasher && areaError) throw areaError;

    const session = PlayerSessionManager.get(player);
    const pInv = getInventory(player);
    const stashInv = stasher ? getStashContainer(stasher) : undefined;

    if (!stasher || !pInv || !stashInv) {
      clearToolboxItems(player);
      session.toolboxLayout = null;
      SelectionService.clear(player);
      removeStashArea(player);
      removeLegacyStashArea(player);
      stashEntityIds.delete(stashKey(player));
      LanguageService.actionBar(player, "plotutils.no_stash");
      return;
    }

    const restoredAll = mutateInventory(player, () => restoreStash(stashInv, pInv));

    if (!restoredAll || stashInv.firstItem() !== undefined) {
      placeToolboxItems(player, layoutOf(player));
      LanguageService.actionBar(player, "plotutils.partial_restore");
      return;
    }

    destroyStashLater(player, stasher);
    session.toolboxLayout = null;
    SelectionService.clear(player);
    playSound(player, Sounds.toolboxClose, { pitch: 1, volume: 0.75 });
    LanguageService.actionBar(player, "plotutils.toolbox_closed");
  } catch (error) {
    LanguageService.actionBar(player, "plotutils.toolbox_restore_failed");
    LanguageService.message(player, "plotutils.error_inventory_restore", [String(error)]);
  } finally {
    closing.delete(player.id);
  }
}

function forceRestoreSync(player) {
  if (!isToolboxOpen(player)) return;
  try {
    const stasher = getStashEntity(player);
    if (!stasher) return;
    const pInv = getInventory(player);
    const stashInv = getStashContainer(stasher);
    if (!pInv || !stashInv) return;

    const restoredAll = mutateInventory(player, () => restoreStash(stashInv, pInv));

    if (restoredAll && stashInv.firstItem() === undefined) {
      try {
        stasher.triggerEvent(stasherDestroyEvent);
      } catch (error) {
        Logger.warn("Failed to trigger stash destroy on leave:", error);
      }
      stashEntityIds.delete(stashKey(player));
    }
    PlayerSessionManager.get(player).toolboxLayout = null;
  } catch (error) {
    Logger.error("Toolbox emergency restore on leave failed:", error);
  }
}

async function recoverPlayerStash(player) {
  const session = PlayerSessionManager.get(player);
  session.visualizing = false;
  session.visualizingGroups = false;
  session.selectionMode = null;
  SelectionService.clear(player);

  try {
    await ensureStashArea(player);
  } catch (error) {
    Logger.debug("Stash area ensure during recovery failed:", error);
  }

  let stasher = await findStasher(player);
  if (!stasher) {
    try {
      await ensureLegacyStashArea(player);
    } catch (error) {
      Logger.debug("Legacy stash area ensure during recovery failed:", error);
    }
    stasher = await findStasher(player);
  }

  if (stasher) {
    await closeToolbox(player);
  } else {
    clearToolboxItems(player);
    removeStashAreas(player);
  }
  session.toolboxLayout = null;
}

async function openCurrentPlotMenu(player, menuName) {
  const plot = PlotService.getPlotAt(player.dimension.id, player.location);
  if (!plot) {
    LanguageService.actionBar(player, "plotutils.not_in_plot");
    return;
  }
  await MenuService.open(menuName, player, { plotId: plot.id, source: "all" });
}

async function confirmLoseSelection(player) {
  if (!SelectionService.hasAny(player)) return true;
  const ok = await confirm(player, {
    titleKey: "plotutils.discard_title",
    bodyKey: "plotutils.discard_body",
    confirmKey: "plotutils.continue",
    cancelKey: "plotutils.cancel",
  });
  if (ok) {
    cancelSelection(player);
  }
  return ok === true;
}

async function confirmCreateWithSettings(player) {
  const session = PlayerSessionManager.get(player);
  return confirm(player, {
    titleKey: "plotutils.create_confirm_title",
    bodyKey: session.createPlotSettingsReviewed
      ? "plotutils.create_confirm_reviewed_body"
      : "plotutils.create_confirm_defaults_body",
    confirmKey: "plotutils.continue",
    cancelKey: "plotutils.cancel",
  });
}

function selectionHasNoOverlap(player) {
  const overlap = PlotService.findSelectionOverlap(player);
  if (!overlap) return true;
  LanguageService.actionBar(player, "plotutils.create.error.overlap", [overlap.name]);
  FeedbackService.support(player, "plotutils.support.plot_overlap", [overlap.name]);
  return false;
}

function startPlotCreation(player) {
  const session = PlayerSessionManager.get(player);
  SelectionService.clearGroupSelectionArea(player);
  session.selectionMode = "plot";
  session.createPlotSettingsReviewed = false;
  session.pendingPlotFlags = DefaultPlotSettings.all();
  placeToolboxItems(player, "create");
  lockToolboxToggle(player, createModeLockTicks);
  playToolSound(player);
  LanguageService.actionBar(player, "plotutils.create_tools");
  FeedbackService.support(player, "plotutils.support.plot_creation_started");
}

async function finishPlotCreation(player) {
  if (!SelectionService.hasBoth(player)) {
    LanguageService.actionBar(player, "plotutils.selection_incomplete");
    return;
  }
  if (!selectionHasNoOverlap(player)) return;
  if (!(await confirmCreateWithSettings(player))) return;
  playToolSound(player);
  await MenuService.open("create", player);
  if (!SelectionService.hasBoth(player)) placeToolboxItems(player, "main");
}

async function togglePlotVisualization(player) {
  if (await tryOpenVisualizeMenu(player)) return;
  if (!beginVisualizeCooldown(player)) return;
  playVisualizeSound(player);
  if (PlotService.stats().plots <= 0) {
    PlayerSessionManager.get(player).visualizing = false;
    LanguageService.actionBar(player, "plotutils.visualize_no_plots");
    return;
  }
  const session = PlayerSessionManager.get(player);
  session.visualizing = !session.visualizing;
  LanguageService.actionBar(
    player,
    session.visualizing ? "plotutils.visualize_enabled" : "plotutils.visualize_disabled",
  );
  if (session.visualizing) FeedbackService.support(player, "plotutils.support.visualize_plots");
}

async function toggleGroupVisualization(player) {
  if (await tryOpenVisualizeMenu(player)) return;
  if (!beginVisualizeCooldown(player)) return;
  playVisualizeSound(player);
  const session = PlayerSessionManager.get(player);
  session.visualizingGroups = !session.visualizingGroups;
  LanguageService.actionBar(
    player,
    session.visualizingGroups ? "plotutils.visualize_groups_enabled" : "plotutils.visualize_groups_disabled",
  );
  if (session.visualizingGroups) FeedbackService.support(player, "plotutils.support.visualize_groups");
}

async function toggleGlobalVisualization(player) {
  if (await tryOpenVisualizeMenu(player)) return;
  if (!beginVisualizeCooldown(player)) return;
  playVisualizeSound(player);
  const session = PlayerSessionManager.get(player);
  const enabled = !(session.visualizing && session.visualizingGroups);
  session.visualizing = enabled;
  session.visualizingGroups = enabled;
  LanguageService.actionBar(
    player,
    enabled ? "plotutils.visualize_global_enabled" : "plotutils.visualize_global_disabled",
  );
  if (enabled) FeedbackService.support(player, "plotutils.support.visualize_global");
}

async function openCurrentPlotSettings(player) {
  const layout = layoutOf(player);
  if (layout === "groupCreate") {
    playToolSound(player);
    await MenuService.open("createGroupSettings", player);
    return;
  }
  if (layout === "create") {
    if (!SelectionService.hasBoth(player)) {
      LanguageService.actionBar(player, "plotutils.selection_incomplete");
      return;
    }
    if (!selectionHasNoOverlap(player)) return;
    PlayerSessionManager.get(player).createPlotSettingsReviewed = true;
    playToolSound(player);
    await MenuService.open("createSettings", player);
    return;
  }
  playToolSound(player);
  await openCurrentPlotMenu(player, "manage");
}

async function openGlobalSettings(player) {
  playToolSound(player);
  if (layoutOf(player) === "plotGroups") {
    await MenuService.open("groupSettings", player, { source: "toolbox" });
  } else {
    await MenuService.open("admin", player);
  }
}

async function navigateBack(player) {
  const layout = layoutOf(player);
  if (layout === "groupCreate") {
    const hadSelection = SelectionService.hasAny(player);
    if (await confirmLoseSelection(player)) {
      SelectionService.clearGroupSelectionArea(player);
      PlayerSessionManager.get(player).selectionMode = null;
      placeToolboxItems(player, "plotGroups");
      if (!hadSelection) playToolSound(player);
      LanguageService.actionBar(player, "plotutils.plot_groups.opened");
    }
    return;
  }
  if (layout === "plotGroups") {
    SelectionService.clearGroupSelectionArea(player);
    placeToolboxItems(player, "advanced");
    playToolSound(player);
    LanguageService.actionBar(player, "plotutils.advanced.returned");
    return;
  }
  if (layout === "advanced") {
    placeToolboxItems(player, "main");
    playToolSound(player);
    LanguageService.actionBar(player, "plotutils.returned_toolbox");
    return;
  }
  const hadSelection = SelectionService.hasAny(player);
  if (await confirmLoseSelection(player)) {
    placeToolboxItems(player, "main");
    if (!hadSelection) playToolSound(player);
    LanguageService.actionBar(player, "plotutils.returned_toolbox");
  }
}

function openAdvancedMenu(player) {
  playToolSound(player);
  placeToolboxItems(player, "advanced");
  LanguageService.actionBar(player, "plotutils.advanced.opened");
  FeedbackService.support(player, "plotutils.support.advanced");
}

function openPlotGroupsMenu(player) {
  playToolSound(player);
  placeToolboxItems(player, "plotGroups");
  LanguageService.actionBar(player, "plotutils.plot_groups.opened");
  FeedbackService.support(player, "plotutils.support.groups_menu");
}

function startGroupAreaCreation(player) {
  const session = PlayerSessionManager.get(player);
  SelectionService.clear(player);
  session.selectionMode = "group";
  session.pendingGroupRules = GroupSettings.defaultRules();
  placeToolboxItems(player, "groupCreate");
  playToolSound(player);
  LanguageService.actionBar(player, "plotutils.group.create_tools");
  FeedbackService.support(player, "plotutils.support.group_creation_started");
}

async function finishGroupAreaCreation(player) {
  if (!SelectionService.hasBoth(player)) {
    LanguageService.actionBar(player, "plotutils.selection_incomplete");
    return;
  }
  playToolSound(player);
  await MenuService.open("createGroup", player);
  if (!SelectionService.hasBoth(player)) placeToolboxItems(player, "plotGroups");
}

export const ToolboxService = {
  isOpen(player) {
    return isToolboxOpen(player);
  },

  async open(player) {
    await openToolbox(player);
  },

  async close(player) {
    await closeToolbox(player);
  },

  async toggle(player) {
    if (isToolboxOpen(player)) {
      await closeToolbox(player);
    } else {
      await openToolbox(player);
    }
  },

  afterWandUse(player) {
    const layout = layoutOf(player);
    if ((layout !== "create" && layout !== "groupCreate") || !PlayerSessionManager.get(player).toolboxLayout) return;
    system.run(() => {
      restoreSlot(player, getExpectedSlot(player, Items.selectionWand) ?? 4);
      refreshCreateToolSlot(player);
    });
  },

  onNonAdminBreak(player) {
    removeAllToolItems(player);
    LanguageService.actionBar(player, "plotutils.admin_only");
  },

  handleWandDrop(player) {
    cancelSelection(player);
    LanguageService.actionBar(player, "plotutils.selection_cleared");
    const layout = PlayerSessionManager.peek(player.id)?.toolboxLayout;
    if (layout !== "create" && layout !== "groupCreate") return;
    system.run(() => {
      removeDroppedTools(player, Items.selectionWand);
      restoreSlot(player, getExpectedSlot(player, Items.selectionWand) ?? 4);
      refreshCreateToolSlot(player);
    });
  },

  async handleTool(player, typeId) {
    if (typeId === Items.toolboxClosed) {
      await openToolbox(player);
      return;
    }

    if (!PermissionService.isAdmin(player)) {
      removeAllToolItems(player);
      LanguageService.actionBar(player, "plotutils.admin_only");
      return;
    }

    if (!isToolboxOpen(player)) {
      removeAllToolItems(player);
      return;
    }
    const slot = getExpectedSlot(player, typeId);
    if (slot === undefined) {
      clearToolboxItems(player);
      placeToolboxItems(player, layoutOf(player));
      return;
    }
    if (typeId !== Items.toolboxOpen) {
      const restoreTypeId = visualizeItems.has(typeId) ? typeId : undefined;
      system.run(() => restoreSlot(player, slot, restoreTypeId));
    }

    switch (typeId) {
      case Items.toolboxOpen:
        if (!isToggleReady(player)) return;
        if (await confirmLoseSelection(player)) await closeToolbox(player);
        break;
      case Items.createTool:
        startPlotCreation(player);
        break;
      case Items.finishPlotTool:
        await finishPlotCreation(player);
        break;
      case Items.listTool:
        playToolSound(player);
        await MenuService.open("myPlots", player, { source: "all" });
        break;
      case Items.visualizeTool:
        await togglePlotVisualization(player);
        break;
      case Items.configCurrentTool:
        await openCurrentPlotSettings(player);
        break;
      case Items.configGlobalTool:
        await openGlobalSettings(player);
        break;
      case Items.backTool:
        await navigateBack(player);
        break;
      case Items.guideTool:
        playToolSound(player);
        await MenuService.open("guide", player);
        break;
      case Items.advancedTool:
        openAdvancedMenu(player);
        break;
      case Items.plotGroupsTool:
        openPlotGroupsMenu(player);
        break;
      case Items.advancedDataTool:
        playToolSound(player);
        await MenuService.open("addonData", player);
        break;
      case Items.listGroupsTool:
        playToolSound(player);
        await MenuService.open("groups", player);
        break;
      case Items.visualizeGroupsTool:
        await toggleGroupVisualization(player);
        break;
      case Items.visualizeGlobalTool:
        await toggleGlobalVisualization(player);
        break;
      case Items.newGroupAreaTool:
        startGroupAreaCreation(player);
        break;
      case Items.createGroupTool:
        await finishGroupAreaCreation(player);
        break;
    }
  },

  async resetHotbarSystem(actor) {
    if (!PermissionService.isAdmin(actor)) {
      LanguageService.actionBar(actor, "plotutils.admin_only");
      return 0;
    }

    let count = 0;
    for (const player of world.getPlayers()) {
      toggleReady.delete(player.id);
      visReady.delete(player.id);
      opening.delete(player.id);
      closing.delete(player.id);

      const session = PlayerSessionManager.get(player);
      session.visualizing = false;
      session.visualizingGroups = false;
      session.selectionMode = null;
      SelectionService.clear(player);

      const stasher = getStashEntity(player);
      if (stasher) {
        await closeToolbox(player);
      } else {
        removeAllToolItems(player);
        removeStashAreas(player);
        stashEntityIds.delete(stashKey(player));
      }
      session.toolboxLayout = null;
      count++;
    }
    return count;
  },

  clearOnlineSessions(actor) {
    if (!PermissionService.isAdmin(actor)) {
      LanguageService.actionBar(actor, "plotutils.admin_only");
      return 0;
    }

    let count = 0;
    for (const player of world.getPlayers()) {
      const session = PlayerSessionManager.get(player);
      session.visualizing = false;
      session.visualizingGroups = false;
      session.createPlotSettingsReviewed = false;
      session.selectionMode = null;
      session.pendingPlotFlags = DefaultPlotSettings.all();
      session.pendingGroupRules = GroupSettings.defaultRules();
      SelectionService.clear(player);
      visReady.delete(player.id);
      count++;
    }
    return count;
  },

  async recoverOnLoad() {
    stashEntityIds.clear();
    opening.clear();
    closing.clear();
    toggleReady.clear();
    visReady.clear();

    for (const player of world.getPlayers()) {
      try {
        const session = PlayerSessionManager.get(player);
        session.visualizing = false;
        session.visualizingGroups = false;
        session.selectionMode = null;
        SelectionService.clear(player);

        try {
          await ensureStashArea(player);
        } catch (error) {
          Logger.debug("Stash area ensure during load recovery failed:", error);
        }
        let stasher = await findStasher(player);
        if (!stasher) {
          try {
            await ensureLegacyStashArea(player);
          } catch (error) {
            Logger.debug("Legacy stash area ensure during load recovery failed:", error);
          }
          stasher = await findStasher(player);
        }
        if (stasher) {
          await closeToolbox(player);
        } else {
          clearToolboxItems(player);
          removeStashAreas(player);
        }
        session.toolboxLayout = null;
      } catch (error) {
        Logger.error("Toolbox recovery on load failed:", error);
      }
    }
  },

  async recoverOnJoin(player) {
    try {
      await recoverPlayerStash(player);
    } catch (error) {
      Logger.error(`Toolbox recovery on join failed for ${player.name}:`, error);
    }
  },

  subscribe() {
    world.afterEvents.playerInventoryItemChange?.subscribe((event) => {
      const typeId = event.itemStack?.typeId;
      const beforeTypeId = event.beforeItemStack?.typeId;
      const player = event.player;
      const changedSlot = event.slot;

      if (inventoryMutations.has(player.id)) return;

      if (
        beforeTypeId === Items.selectionWand &&
        typeId !== Items.selectionWand &&
        isToolboxOpen(player) &&
        wandDroppableLayouts.has(layoutOf(player)) &&
        changedSlot === getExpectedSlot(player, Items.selectionWand)
      ) {
        system.run(() => ToolboxService.handleWandDrop(player));
        return;
      }

      if (!typeId) return;

      if (typeId === Items.toolboxClosed) return;
      if (!tempToolItems.has(typeId)) return;

      if (!PermissionService.isAdmin(player)) {
        system.run(() => removeAllToolItems(player));
        return;
      }

      system.run(() => {
        if (!isToolboxOpen(player)) {
          clearToolboxItems(player);
          return;
        }
        const expectedSlot = getExpectedSlot(player, typeId);
        if (expectedSlot === undefined || expectedSlot !== changedSlot) {
          const container = getInventory(player);
          if (container && changedSlot !== undefined) container.setItem(changedSlot, undefined);
          placeToolboxItems(player, layoutOf(player));
        }
      });
    });

    Logger.info("Toolbox events subscribed.");
  },

  restoreBeforeLeave(player) {
    system.run(() => forceRestoreSync(player));
  },

  forgetPlayer(playerId, playerName) {
    for (const [key, id] of stashEntityIds) {
      const entity = world.getEntity(id);
      if (!entity?.isValid) stashEntityIds.delete(key);
    }
    opening.delete(playerId);
    closing.delete(playerId);
    inventoryMutations.delete(playerId);
    toggleReady.delete(playerId);
    visReady.delete(playerId);

    if (playerName) {
      try {
        const manager = world.tickingAreaManager;
        const areaId = stashAreaIdForName(playerName);
        if (manager.hasTickingArea(areaId)) manager.removeTickingArea(areaId);
      } catch (error) {
        Logger.warn("Failed to remove stash ticking area on leave:", error);
      }
    }
    SelectionService.clearGroupSel(playerId);
  },
};

//never touching this file in my life again...