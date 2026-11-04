/**
 * GameOS 领域类型：World / GameIR / Package / Build / Playtest / Release。
 * 这些是 `.gamos/` 文件态的唯一权威形状；写入前必须经 store 校验。
 * 规格见 docs/gamos/gamos-plugin-spec.md §3。
 */
export declare const GAME_ENGINES: readonly ["web", "playcanvas", "godot", "unity"];
export type GameEngine = (typeof GAME_ENGINES)[number];
export declare const WORLD_STATUSES: readonly ["draft", "in-development", "playable", "released", "archived"];
export type WorldStatus = (typeof WORLD_STATUSES)[number];
export declare const PACKAGE_TYPES: readonly ["asset-3d", "asset-texture", "asset-audio", "asset-animation", "mechanic", "ui", "shader", "level"];
export type PackageType = (typeof PACKAGE_TYPES)[number];
export declare const PLAYTEST_SCENARIOS: readonly ["smoke", "core-loop", "full"];
export type PlaytestScenario = (typeof PLAYTEST_SCENARIOS)[number];
export declare const PLAYTEST_MODES: readonly ["browser-use", "engine-adapter", "manual"];
export type PlaytestMode = (typeof PLAYTEST_MODES)[number];
export declare const RELEASE_CHANNELS: readonly ["preview", "stable"];
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];
export interface WorkspaceRegistry {
    schemaVersion: 1;
    activeWorldId: string | null;
}
export interface World {
    id: string;
    name: string;
    slug: string;
    genre: string;
    description: string;
    engine: GameEngine;
    engineVersion: string;
    targetProfiles: string[];
    status: WorldStatus;
    createdAt: string;
    updatedAt: string;
}
export interface GameMechanic {
    id: string;
    name: string;
    description: string;
    rules: string[];
}
export interface GameLevel {
    id: string;
    name: string;
    kind: "region" | "level" | "scene";
    difficulty: number;
    mechanics: string[];
    /** 入口关卡 id（关卡图边）。 */
    entry: string[];
    /** 出口关卡 id（关卡图边）。 */
    exit: string[];
}
export interface ControlScheme {
    target: string;
    scheme: string;
    mappings: {
        action: string;
        input: string;
    }[];
}
export interface GamePerformanceBudget {
    targetFps: number;
    maxLoadMs: number;
}
export interface GameIR {
    version: number;
    coreLoop: string[];
    mechanics: GameMechanic[];
    levels: GameLevel[];
    progression: {
        model: string;
        description: string;
    };
    economy?: {
        currency: string;
        sources: string[];
        sinks: string[];
    };
    artDirection: {
        style: string;
        palette: string[];
        references: string[];
    };
    controls: ControlScheme[];
    winCondition: string;
    loseCondition: string;
    constraints: {
        performance: GamePerformanceBudget;
    };
}
export interface PackageRights {
    license: string;
    author: string;
    sourceUrl?: string;
    attribution?: string;
}
export interface PackageProvenance {
    origin: "generated" | "imported" | "original";
    createdBy: "agent" | "user";
    digest?: string;
}
export interface PackageValidationCheck {
    check: "deps-resolve" | "engine-compat" | "file-exists" | "provenance" | "rights-metadata";
    status: "fail" | "pass" | "warn";
    detail: string;
}
export interface GamePackage {
    id: string;
    name: string;
    version: string;
    type: PackageType;
    /** 工作区内相对路径（资产文件或机制源文件）。 */
    path: string;
    engine: GameEngine | "*";
    dependencies: string[];
    rights: PackageRights;
    provenance: PackageProvenance;
    validation: {
        status: "invalid" | "pending" | "valid";
        checks: PackageValidationCheck[];
        validatedAt: string;
    };
    createdAt: string;
    updatedAt: string;
}
export interface WorldBuild {
    id: string;
    engine: GameEngine;
    engineVersion: string;
    target: string;
    artifactPath: string;
    entryPoint: string;
    digest: string;
    testStatus: "fail" | "pass" | "untested";
    playtestCount: number;
    notes: string;
    recordedAt: string;
}
export interface PlaytestStep {
    action: string;
    target?: string;
    status: "fail" | "pass";
    detail?: string;
}
export interface PlaytestIssue {
    severity: "blocker" | "major" | "minor";
    description: string;
    evidence: string;
}
export interface PlaytestMetrics {
    fps?: number;
    loadMs?: number;
    crashes?: number;
    errors?: number;
}
export interface PlaytestRecord {
    id: string;
    buildId: string;
    buildDigest: string;
    engine: GameEngine;
    target: string;
    mode: PlaytestMode;
    scenario: PlaytestScenario;
    steps: PlaytestStep[];
    screenshots: string[];
    metrics: PlaytestMetrics;
    issues: PlaytestIssue[];
    verdict: "fail" | "inconclusive" | "pass";
    durationMs: number;
    recordedAt: string;
}
export interface ReleaseApproval {
    id: string;
    scope: "publish";
    requestedAt: string;
    requestedNotes: string;
    approvedBy?: "user";
    approvedAt?: string;
    approvalNotes?: string;
}
export interface ReleasePublication {
    id: string;
    version: string;
    channel: ReleaseChannel;
    buildId: string;
    buildDigest: string;
    gateReport: {
        evaluatedAt: string;
        gates: {
            id: string;
            status: string;
            detail: string;
        }[];
    };
    approvalId: string;
    publishedAt: string;
    localUrl: string;
}
export interface WorldFiles {
    world: World;
    gameir: GameIR;
    packages: {
        packages: GamePackage[];
    };
    builds: {
        builds: WorldBuild[];
    };
    playtests: {
        playtests: PlaytestRecord[];
    };
    releases: {
        approvals: ReleaseApproval[];
        publications: ReleasePublication[];
        lastGateReport?: unknown;
    };
}
//# sourceMappingURL=types.d.ts.map