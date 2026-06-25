import { system, world } from "@minecraft/server";
import { Logger } from "./core/Logger.js";
import { Scheduler } from "./core/Scheduler.js";
import { Limits } from "./core/Constants.js";
import { PlotDatabase } from "./data/PlotDatabase.js";
import { PlotGroupDatabase } from "./data/PlotGroupDatabase.js";
import { PlotRegistry } from "./domain/PlotRegistry.js";
import { ProtectionService } from "./services/ProtectionService.js";
import { ToolboxService } from "./services/ToolboxService.js";
import { ItemRegistry } from "./items/ItemRegistry.js";
import { ParticleService } from "./services/ParticleService.js";
import { PlayerSessionManager } from "./session/PlayerSessionManager.js";
import { OnlinePlayers } from "./session/OnlinePlayers.js";
import { SelectionService } from "./services/SelectionService.js";
import { PlotGroupService } from "./services/PlotGroupService.js";
import { CommandService } from "./services/CommandService.js";
import { LanguageService } from "./services/LanguageService.js";

CommandService.subscribe();
ItemRegistry.subscribe();
ToolboxService.subscribe();
ProtectionService.subscribe();

let booted = false;



function boot() {
  if (booted) return;
  booted = true;
  Logger.init();
  OnlinePlayers.init();
  PlotDatabase.load();
  PlotGroupDatabase.load();
  PlotRegistry.init();

  PlotGroupService.reconcile();

  system.runTimeout(() => {
    ToolboxService.recoverOnLoad().catch((error) =>
      Logger.error("Toolbox recovery failed:", error),
    );
  }, 20);
  Logger.info("Plot Utils ready.");
}
world.afterEvents.worldLoad?.subscribe(boot);
system.run(boot);

world.beforeEvents.playerLeave.subscribe((event) => {
  ToolboxService.restoreBeforeLeave(event.player);
});

world.afterEvents.playerLeave.subscribe((event) => {
  OnlinePlayers.remove(event.playerId);
  SelectionService.clearGroupSel(event.playerId);
  PlayerSessionManager.remove(event.playerId);
  ProtectionService.forgetPlayer(event.playerId);
  ToolboxService.forgetPlayer(event.playerId, event.playerName);
  ItemRegistry.forgetPlayer(event.playerId);
});

world.afterEvents.playerDimensionChange?.subscribe((event) => {
  OnlinePlayers.setDimension(event.player.id, event.toDimension.id);
});

world.afterEvents.playerSpawn.subscribe((event) => {
  OnlinePlayers.add(event.player);
  if (!event.initialSpawn) return;
  system.runTimeout(() => {
    ToolboxService.recoverOnJoin(event.player).catch((error) =>
      Logger.error("Toolbox recovery on player join failed:", error),
    );
  }, 30);
});

Scheduler.interval(() => {
  for (const player of OnlinePlayers.list()) {
    const session = PlayerSessionManager.peek(player.id);
    if (session) ParticleService.renderSelection(player, session);
  }
}, Limits.selectionParticleInterval);

Scheduler.interval(() => {
  for (const player of OnlinePlayers.list()) {
    const session = PlayerSessionManager.peek(player.id);
    if (session?.visualizing) ParticleService.renderPlots(player, session);
    if (session?.visualizingGroups) ParticleService.renderGroups(player, session);
  }
}, Limits.visualizeInterval);

Scheduler.interval(() => {
  const online = OnlinePlayers.ids();
  PlayerSessionManager.sweep(online);
  PlotDatabase.flush();
  PlotGroupDatabase.flush();
}, Limits.sessionSweepInterval);
