import type { GamosGate } from "../contract.js";
import type { ReleaseChannel, WorldFiles } from "./types.js";
import { GameOSStore } from "../lib/store.js";
/**
 * 发布门禁、审批与发布（规格见 docs/gamos/gamos-release-gates.md）。
 * 五门禁：gameir-complete → packages-validated → build-exists → playtest-evidence → user-approval。
 * 服务端评估是权威；PreToolUse hook 与宿主审批链是反馈/防线。
 */
export interface GateReport {
    evaluatedAt: string;
    status: "green" | "blocked";
    gates: GamosGate[];
}
export declare function evaluateGates(files: WorldFiles): GateReport;
export declare function checkGates(store: GameOSStore, worldId: string): Promise<GateReport>;
export declare function requestApproval(store: GameOSStore, worldId: string, notes?: string): Promise<{
    id: string;
    status: "pending";
}>;
export declare function approveRelease(store: GameOSStore, worldId: string, approvalId?: string, notes?: string): Promise<{
    id: string;
    status: "approved";
}>;
export interface PublishInput {
    version?: string;
    channel?: ReleaseChannel;
}
export declare function publishWorld(store: GameOSStore, worldId: string, input: PublishInput): Promise<Record<string, unknown>>;
export declare class GamosPublishError extends Error {
    readonly report: GateReport;
    constructor(report: GateReport);
}
/** World Atlas（规格 P4）：GameIR + 包图的只读投影，与源数据区分。 */
export declare function worldAtlas(files: WorldFiles): Record<string, unknown>;
/** 世界级使用统计（规格 P4）。 */
export declare function worldUsage(files: WorldFiles): Record<string, unknown>;
//# sourceMappingURL=release.d.ts.map