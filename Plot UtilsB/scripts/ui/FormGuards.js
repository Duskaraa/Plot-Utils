import { system } from "@minecraft/server";
import { FeedbackService } from "../services/FeedbackService.js";
import { isPlotError } from "../core/Errors.js";
import { Logger } from "../core/Logger.js";

const busy = "UserBusy";

function sleep(ticks) {
  return new Promise((resolve) => system.runTimeout(() => resolve(), ticks));
}

export async function showForm(player, form, max = 8) {
  for (let n = 0; ; n++) {
    const res = await form.show(player);
    if (res.canceled && res.cancelationReason === busy && n < max) {
      await sleep(10);
      continue;
    }
    return res;
  }
}

export function reportError(player, error) {
  if (isPlotError(error)) {
    FeedbackService.notify(player, error.messageKey, error.params);
  } else {
    Logger.error("Unexpected UI error:", error);
    FeedbackService.notify(player, "plotutils.error.generic");
  }
}
