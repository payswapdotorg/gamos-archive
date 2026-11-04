import type { GameIR, GameEngine, World, WorldFiles, WorldStatus } from "./types.js";
import { GameOSStore } from "../lib/store.js";
/** 世界创建与 GameIR 更新（规格 §3）。GameIR 替换必须经 updateGameIr（version+1）。 */
export interface CreateWorldInput {
    name: string;
    genre?: string;
    description?: string;
    engine?: GameEngine;
    engineVersion?: string;
    targetProfiles?: string[];
}
export interface UpdateWorldInput {
    name?: string;
    genre?: string;
    description?: string;
    engine?: GameEngine;
    engineVersion?: string;
    targetProfiles?: string[];
    status?: WorldStatus;
    gameIr?: GameIR;
}
export declare function emptyGameIr(): GameIR;
export declare function createWorld(store: GameOSStore, input: CreateWorldInput, defaults: {
    engine: GameEngine;
    target: string;
}): Promise<World>;
export declare function updateWorld(store: GameOSStore, worldId: string, patch: UpdateWorldInput): Promise<World>;
export interface WorldSummaryRow {
    id: string;
    name: string;
    slug: string;
    genre: string;
    engine: string;
    status: string;
    targetProfiles: string[];
    gameIrVersion: number;
    packageCount: number;
    buildCount: number;
    playtestCount: number;
    isActive: boolean;
    updatedAt: string;
}
export declare function listWorlds(store: GameOSStore): Promise<WorldSummaryRow[]>;
export declare function inspectWorld(store: GameOSStore, worldId: string): Promise<InspectedWorld>;
export interface InspectedWorld extends WorldFiles {
    gates: ReturnType<typeof import("./release.js").evaluateGates>;
}
//# sourceMappingURL=worlds.d.ts.map