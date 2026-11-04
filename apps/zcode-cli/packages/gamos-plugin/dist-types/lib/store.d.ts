import type { WorkspaceRegistry, WorldFiles } from "../gameos/types.js";
/**
 * `.gamos/` 文件态存取：唯一事实源（规格 §2）。写入原子（temp + rename）；
 * 目录缺失视为"工作区尚无 Gamos 项目"，读取返回空态而不是错误。
 * `rootOverride` 供测试注入临时目录。
 */
export declare class GameOSStore {
    private readonly workspaceRoot;
    private readonly rootOverride?;
    constructor(workspaceRoot: string, rootOverride?: string | undefined);
    get stateRoot(): string;
    registry(): Promise<WorkspaceRegistry>;
    saveRegistry(registry: WorkspaceRegistry): Promise<void>;
    worldIds(): Promise<string[]>;
    loadWorld(worldId: string): Promise<WorldFiles | undefined>;
    requireWorld(worldId: string): Promise<WorldFiles>;
    saveWorldFiles(worldId: string, files: Partial<WorldFiles>): Promise<void>;
    activeWorldId(): Promise<string | null>;
    setActiveWorld(worldId: string): Promise<void>;
    /** 解析 worldId：显式传入 > 活动 World > 唯一 World；否则报 not_found。 */
    resolveWorldId(worldId?: string): Promise<string>;
    private readJson;
    private writeJson;
}
/** 领域错误：code 直接映射到工具结果信封的 `error.code`。 */
export declare class GamosStateError extends Error {
    readonly code: "artifact_missing" | "not_found" | "state_corrupt";
    constructor(code: "artifact_missing" | "not_found" | "state_corrupt", message: string);
}
//# sourceMappingURL=store.d.ts.map