import { CommandPermissionLevel, CustomCommandStatus, system } from "@minecraft/server";
import { Logger } from "../core/Logger.js";
import { MenuService } from "../ui/MenuService.js";

function result(status, message) {
  return { status, message };
}

export const CommandService = {
  subscribe() {
    system.beforeEvents.startup.subscribe((event) => {
      event.customCommandRegistry.registerCommand(
        {
          name: "plotutils:myplots",
          description: "Open a menu to manage plots you own.",
          permissionLevel: CommandPermissionLevel.Any,
          cheatsRequired: false,
        },
        (origin) => {
          try {
            const player = origin?.sourceEntity ?? origin?.initiator;
            if (player?.typeId !== "minecraft:player") {
              return result(CustomCommandStatus.Failure, "This command must be used by a player.");
            }
            system.run(() => MenuService.open("myPlots", player, { source: "owner" }));
            return result(CustomCommandStatus.Success, "Opening My Plots.");
          } catch (error) {
            Logger.error("My Plots command failed:", error);
            return result(CustomCommandStatus.Failure, "Could not open My Plots.");
          }
        },
      );
      Logger.info("My Plots command registered.");
    });
  },
};
