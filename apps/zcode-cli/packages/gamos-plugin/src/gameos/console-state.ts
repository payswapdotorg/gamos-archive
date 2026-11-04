import type { GamosWorldSummary } from "../contract.js";
import type { GameOSStore } from "../lib/store.js";
import { evaluateGates, type GateReport } from "./release.js";
import type { GamePackage, PlaytestRecord, ReleaseApproval, ReleasePublication, WorldBuild, World, GameIR } from "./types.js";

/** `gamos://state`：Gamos Console 面板的全量状态（读路径，不经工具审批）。 */

export interface GamosConsoleState {
  worlds: GamosWorldSummary[];
  active: {
    world: World;
    gameIr: GameIR;
    packages: GamePackage[];
    builds: WorldBuild[];
    playtests: PlaytestRecord[];
    approvals: ReleaseApproval[];
    publications: ReleasePublication[];
    gates: GateReport;
  } | null;
}

export async function buildConsoleState(store: GameOSStore): Promise<GamosConsoleState> {
  const { listWorlds } = await import("./worlds.js");
  const worlds = await listWorlds(store);
  const activeId = await store.activeWorldId();
  if (!activeId) return { worlds, active: null };
  const files = await store.loadWorld(activeId);
  if (!files) return { worlds, active: null };
  return {
    worlds,
    active: {
      world: files.world,
      gameIr: files.gameir,
      packages: files.packages.packages,
      builds: files.builds.builds,
      playtests: files.playtests.playtests,
      approvals: files.releases.approvals,
      publications: files.releases.publications,
      gates: evaluateGates(files),
    },
  };
}
