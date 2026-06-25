import { Logger } from "../core/Logger.js";
import { reportError } from "./FormGuards.js";
import { CreatePlotMenu } from "./menus/CreatePlotMenu.js";
import { CreateGroupMenu } from "./menus/CreateGroupMenu.js";
import { MyPlotsMenu } from "./menus/MyPlotsMenu.js";
import { PlotManageMenu } from "./menus/PlotManageMenu.js";
import { PlotMembersMenu } from "./menus/PlotMembersMenu.js";
import { PlotFlagsMenu } from "./menus/PlotFlagsMenu.js";
import { TrustedPlayerPermissionsMenu } from "./menus/TrustedPlayerPermissionsMenu.js";
import { AdminMenu } from "./menus/AdminMenu.js";
import { GlobalSettingsHubMenu } from "./menus/GlobalSettingsHubMenu.js";
import { DefaultSettingsHubMenu } from "./menus/DefaultSettingsHubMenu.js";
import { OwnerRulesMenu, AdminProtectionMenu } from "./menus/GlobalToggleMenu.js";
import { DefaultPlotSettingsMenu } from "./menus/DefaultPlotSettingsMenu.js";
import { CreatePlotSettingsMenu } from "./menus/CreatePlotSettingsMenu.js";
import { CreateGroupSettingsMenu } from "./menus/CreateGroupSettingsMenu.js";
import { GroupRulesMenu } from "./menus/GroupRulesMenu.js";
import { GroupSettingsMenu } from "./menus/GroupSettingsMenu.js";
import { PreferencesMenu } from "./menus/PreferencesMenu.js";
import { PreferencesHubMenu } from "./menus/PreferencesHubMenu.js";
import { GeneralPreferencesMenu } from "./menus/GeneralPreferencesMenu.js";
import { GuideMenu } from "./menus/GuideMenu.js";
import { CreditsMenu } from "./menus/CreditsMenu.js";
import { AddonDataMenu } from "./menus/AddonDataMenu.js";
import { PlotGroupsMenu, PlotGroupManageMenu, PlotGroupPlotsMenu } from "./menus/PlotGroupsMenu.js";
import { VisualizeMenu } from "./menus/VisualizeMenu.js";

const registry = {
  create: CreatePlotMenu,
  createGroup: CreateGroupMenu,
  myPlots: MyPlotsMenu,
  manage: PlotManageMenu,
  members: PlotMembersMenu,
  flags: PlotFlagsMenu,
  trustedPermissions: TrustedPlayerPermissionsMenu,
  admin: AdminMenu,
  globalConfig: GlobalSettingsHubMenu,
  defaultSettings: DefaultSettingsHubMenu,
  ownerRules: OwnerRulesMenu,
  adminProtection: AdminProtectionMenu,
  defaultPlotSettings: DefaultPlotSettingsMenu,
  createSettings: CreatePlotSettingsMenu,
  createGroupSettings: CreateGroupSettingsMenu,
  groupRules: GroupRulesMenu,
  groupSettings: GroupSettingsMenu,
  preferences: PreferencesHubMenu,
  visualPreferences: PreferencesMenu,
  generalPreferences: GeneralPreferencesMenu,
  addonData: AddonDataMenu,
  groups: PlotGroupsMenu,
  groupManage: PlotGroupManageMenu,
  groupPlots: PlotGroupPlotsMenu,
  visualize: VisualizeMenu,
  guide: GuideMenu,
  credits: CreditsMenu,
};

export const MenuService = {
  async open(name, player, ctx = {}) {
    const menu = registry[name];
    if (!menu) {
      Logger.warn(`Unknown menu "${name}".`);
      return;
    }
    try {
      await menu.open(player, ctx);
    } catch (error) {
      reportError(player, error);
    }
  },
};
