/**
 * gamos 插件对外契约：MCP server 提供的资源、工具名与结果信封，以及构建保证产出的文件。
 * 面板页面与 server 只经这里约定的 URI 和形状交互；规格见 docs/gamos/gamos-plugin-spec.md。
 */
/** `.zcode-plugin/plugin.json` 里 mcpServers 的 key，也是 ui.surfaces[].server。 */
export declare const GAMOS_SERVER_NAME = "gamos";
export declare const GAMOS_SURFACE_ID = "gamos";
export declare const GAMOS_PLUGIN_NAME = "gamos";
/** Gamos Console 面板资源。 */
export declare const PANEL_URI = "ui://gamos/panel.html";
export declare const PANEL_MIME = "text/html;profile=mcp-app";
/** 面板数据资源：全量世界状态（worlds 摘要 + 活动世界详情 + 门禁 + 待审批）。 */
export declare const STATE_URI = "gamos://state";
export declare const RESOURCE_MIME = "application/json";
/** 构建后在插件根目录下必定存在的产物；官方插件定义与打包清单都把它们列为必需资产。 */
export declare const GAMOS_PANEL_OUTPUTS: readonly ["dist/mcp/server.js", "dist/ui/panel.html"];
/** 工作区 GameOS 状态目录（相对项目根）。 */
export declare const GAMOS_STATE_DIR = ".gamos";
/** Tool Fabric 工具名（模型可见全名形如 `mcp__plugin_gamos_gamos__<tool>`）。 */
export declare const WORLD_CREATE_TOOL = "world_create";
export declare const WORLD_LIST_TOOL = "world_list";
export declare const WORLD_INSPECT_TOOL = "world_inspect";
export declare const WORLD_SET_ACTIVE_TOOL = "world_set_active";
export declare const WORLD_UPDATE_TOOL = "world_update";
export declare const PACKAGE_REGISTER_TOOL = "package_register";
export declare const PACKAGE_GRAPH_TOOL = "package_graph";
export declare const PACKAGE_VALIDATE_TOOL = "package_validate";
export declare const PLAYTEST_RECORD_TOOL = "playtest_record";
export declare const PLAYTEST_REPORT_TOOL = "playtest_report";
export declare const BUILD_RECORD_TOOL = "build_record";
export declare const RELEASE_GATE_CHECK_TOOL = "release_gate_check";
export declare const RELEASE_REQUEST_APPROVAL_TOOL = "release_request_approval";
export declare const RELEASE_APPROVE_TOOL = "release_approve";
export declare const WORLD_PUBLISH_TOOL = "world_publish";
export declare const WORLD_ATLAS_TOOL = "world_atlas";
export declare const WORLD_USAGE_TOOL = "world_usage";
/** PreToolUse 发布门禁 hook 匹配的模型侧工具全名。 */
export declare const WORLD_PUBLISH_MODEL_TOOL_NAME = "mcp__plugin_gamos_gamos__world_publish";
/**
 * 工具与资源的结果信封：成功 `data`，失败 `error`（code + 可执行的修复建议）。
 * Hook 脚本与面板共用 `error.code` 判定。
 */
export type GamosResult<T = unknown> = {
    data: T;
} | {
    error: GamosError;
};
export interface GamosError {
    code: "approval_missing" | "artifact_missing" | "gates_failed" | "invalid_input" | "not_found" | "state_corrupt";
    message: string;
    /** `gates_failed` 时附五门禁明细。 */
    gates?: readonly GamosGate[];
}
export interface GamosGate {
    id: "build-exists" | "gameir-complete" | "packages-validated" | "playtest-evidence" | "user-approval";
    status: "fail" | "pass";
    detail: string;
}
/** `gamos://state` 的一项世界摘要（面板列表用）。 */
export interface GamosWorldSummary {
    id: string;
    name: string;
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
//# sourceMappingURL=contract.d.ts.map