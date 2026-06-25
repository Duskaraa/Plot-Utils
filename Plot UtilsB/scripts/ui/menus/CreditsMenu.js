import { ActionFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { showForm } from "../FormGuards.js";
import { MenuService } from "../MenuService.js";

export const CreditsMenu = {
  async open(player, ctx = {}) {
    const form = new ActionFormData()
      .title(LanguageService.t("plotutils.menu.credits.title"))
      .body(LanguageService.t("plotutils.menu.credits.body"))
      .button(LanguageService.t("plotutils.close"));

    await showForm(player, form);
    if (ctx.source === "admin") return MenuService.open("admin", player);
  },
};
