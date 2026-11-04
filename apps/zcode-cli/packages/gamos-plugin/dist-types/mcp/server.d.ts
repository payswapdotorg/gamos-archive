import { Server } from "@modelcontextprotocol/sdk/server/index.js";
export interface GamosServerOptions {
    /** 项目根（`.gamos/` 所在工作区）。 */
    workspaceRoot: string;
    /** `.gamos/` 根覆盖（测试注入）。 */
    stateRootOverride?: string;
    /** 构建产物 dist/ui/panel.html 的绝对路径。 */
    panelPath: string;
    defaults: {
        engine: "godot" | "playcanvas" | "unity" | "web";
        target: string;
    };
}
/**
 * gamos MCP server：Tool Fabric（17 个 GameOS 工具）+ Gamos Console 资源。
 * 读走资源（面板轮询不弹审批），写走工具（经宿主审批链）；`release_approve`
 * 声明 app-only（宿主不把它放进模型工具列表，用户只在面板批准）。
 */
export declare function createGamosServer(options: GamosServerOptions): Server;
export declare function main(): Promise<void>;
//# sourceMappingURL=server.d.ts.map