import { ModalFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PermissionService } from "../../services/PermissionService.js";
import { FeedbackService } from "../../services/FeedbackService.js";
import { GlobalSettings, OwnerRuleKeys, AdminProtectionKeys } from "../../config/GlobalSettings.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

async function openToggles(player, keys, titleKey) {
  if (!PermissionService.isAdmin(player)) {
    FeedbackService.notify(player, "plotutils.permission.denied");
    return;
  }
  const current = GlobalSettings.all();
  const form = new ModalFormData().title(LanguageService.t(titleKey));
  for (const key of keys) form.toggle(LanguageService.t(`plotutils.global.${key}`), { defaultValue: current[key] });
  form.submitButton(LanguageService.t("plotutils.save"));
  const res = await showForm(player, form);
  if (!res || res.canceled || !res.formValues) return MenuService.open("globalConfig", player);
  const values = res.formValues.filter((value) => typeof value === "boolean");
  let changed = false;
  for (let i = 0; i < keys.length; i++) {
    const value = values[i] ?? current[keys[i]];
    if (value === current[keys[i]]) continue;
    GlobalSettings.set(keys[i], value);
    changed = true;
  }
  if (changed) FeedbackService.notify(player, "plotutils.global.updated");
  return MenuService.open("globalConfig", player);
}

export const OwnerRulesMenu = { open: (player) => openToggles(player, OwnerRuleKeys, "plotutils.menu.owner_rules.title") };
export const AdminProtectionMenu = { open: (player) => openToggles(player, AdminProtectionKeys, "plotutils.menu.admin_protection.title") };
