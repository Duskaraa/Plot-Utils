import { ActionFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { PlayerSessionManager } from "../../session/PlayerSessionManager.js";
import { showForm } from "../FormGuards.js";

export const GuideMenu = {
  async open(player) {
    const layout = PlayerSessionManager.get(player).toolboxLayout;
    const key =
      layout === "create"
        ? "create"
        : layout === "advanced"
          ? "advanced"
          : layout === "plotGroups"
            ? "plot_groups"
            : layout === "groupCreate"
              ? "group_create"
              : "main";
    const form = new ActionFormData()
      .title(LanguageService.t(`plotutils.menu.guide.${key}_title`))
      .body(LanguageService.t(`plotutils.menu.guide.${key}_body`))
      .button(LanguageService.t("plotutils.close"));

    await showForm(player, form);
  },
};
