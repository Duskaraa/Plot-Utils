import { Items } from "../core/Constants.js";

export const HotbarLayouts = {
  main: new Map([
    [0, Items.toolboxOpen],
    [1, Items.guideTool],
    [3, Items.configGlobalTool],
    [4, Items.createTool],
    [5, Items.listTool],
    [7, Items.visualizeTool],
    [8, Items.advancedTool],
  ]),
  create: new Map([
    [0, Items.toolboxOpen],
    [1, Items.guideTool],
    [3, Items.configCurrentTool],
    [4, Items.selectionWand],
    [5, Items.finishPlotTool],
    [7, Items.visualizeTool],
    [8, Items.backTool],
  ]),
  advanced: new Map([
    [0, Items.toolboxOpen],
    [1, Items.guideTool],
    [3, Items.plotGroupsTool],
    [5, Items.advancedDataTool],
    [7, Items.visualizeTool],
    [8, Items.backTool],
  ]),
  plotGroups: new Map([
    [0, Items.toolboxOpen],
    [1, Items.guideTool],
    [3, Items.configGlobalTool],
    [4, Items.newGroupAreaTool],
    [5, Items.listGroupsTool],
    [7, Items.visualizeGroupsTool],
    [8, Items.backTool],
  ]),
  groupCreate: new Map([
    [0, Items.toolboxOpen],
    [1, Items.guideTool],
    [3, Items.configCurrentTool],
    [4, Items.selectionWand],
    [5, Items.createGroupTool],
    [7, Items.visualizeGroupsTool],
    [8, Items.backTool],
  ]),
};

const unlockedItems = new Set([Items.toolboxClosed, Items.selectionWand]);

export function isLocked(itemId) {
  return !unlockedItems.has(itemId);
}
