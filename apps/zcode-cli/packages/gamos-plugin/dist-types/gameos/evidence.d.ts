import type { PlaytestIssue, PlaytestMetrics, PlaytestRecord, PlaytestScenario, PlaytestStep, WorldBuild, WorldFiles } from "./types.js";
import { PLAYTEST_MODES } from "./types.js";
import { GameOSStore } from "../lib/store.js";
/** 构建记录与试玩证据（规格 §2.4）：证据绑定构建 digest，可比较、可追溯。 */
export interface RecordBuildInput {
    engine?: WorldBuild["engine"];
    engineVersion?: string;
    target: string;
    artifactPath: string;
    entryPoint?: string;
    digest?: string;
    notes?: string;
}
export declare function recordBuild(store: GameOSStore, workspaceRoot: string, worldId: string, input: RecordBuildInput): Promise<WorldBuild>;
export interface RecordPlaytestInput {
    buildId?: string;
    mode?: (typeof PLAYTEST_MODES)[number];
    scenario: PlaytestScenario;
    steps?: PlaytestStep[];
    screenshots?: string[];
    metrics?: PlaytestMetrics;
    issues?: PlaytestIssue[];
    verdict: PlaytestRecord["verdict"];
    durationMs?: number;
}
export declare function recordPlaytest(store: GameOSStore, worldId: string, input: RecordPlaytestInput): Promise<PlaytestRecord>;
export declare function playtestReport(files: WorldFiles): {
    totalRuns: number;
    byBuild: {
        buildId: string;
        digest: string;
        target: string;
        runs: number;
        passes: number;
        latestVerdict: string;
        avgFps: number | null;
        avgLoadMs: number | null;
        openIssues: {
            severity: string;
            description: string;
        }[];
    }[];
};
//# sourceMappingURL=evidence.d.ts.map