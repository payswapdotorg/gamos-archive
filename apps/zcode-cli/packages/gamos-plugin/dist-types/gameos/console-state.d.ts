import type { GamosWorldSummary } from "../contract.js";
import type { GameOSStore } from "../lib/store.js";
import { type GateReport } from "./release.js";
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
export declare function buildConsoleState(store: GameOSStore): Promise<GamosConsoleState>;
//# sourceMappingURL=console-state.d.ts.map