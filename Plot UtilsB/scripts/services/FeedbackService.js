import { system } from "@minecraft/server";
import { LanguageService } from "./LanguageService.js";
import { AddonPreferences } from "../config/AddonPreferences.js";

const denyThrottleTicks = 12;
const lastDenied = new Map();

export const FeedbackService = {
  notify(player, key, params = []) {
    LanguageService.actionBar(player, key, params);
  },

  message(player, key, params = []) {
    LanguageService.message(player, key, params);
  },

  support(player, key, params = []) {
    if (!AddonPreferences.get("supportMessagesEnabled")) return;
    LanguageService.message(player, key, params);
  },

  deny(player, key, params = []) {
    const tick = system.currentTick;
    if (tick - (lastDenied.get(player.id) ?? -denyThrottleTicks) < denyThrottleTicks) return;
    lastDenied.set(player.id, tick);
    system.run(() => LanguageService.actionBar(player, key, params));
  },

  forgetPlayer(playerId) {
    lastDenied.delete(playerId);
  },
};
