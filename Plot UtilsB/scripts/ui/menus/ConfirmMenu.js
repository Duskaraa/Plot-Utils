import { MessageFormData } from "@minecraft/server-ui";
import { LanguageService } from "../../services/LanguageService.js";
import { showForm } from "../FormGuards.js";

export async function confirm(player, options) {
  const {
    titleKey,
    bodyKey,
    bodyParams = [],
    confirmKey = "plotutils.confirm",
    cancelKey = "plotutils.cancel",
  } = options;

  const form = new MessageFormData()
    .title(LanguageService.t(titleKey))
    .body(LanguageService.t(bodyKey, bodyParams))
    .button1(LanguageService.t(confirmKey))
    .button2(LanguageService.t(cancelKey));

  const res = await showForm(player, form);
  if (!res || res.canceled || res.selection === undefined) return null;
  return res.selection === 0;
}
