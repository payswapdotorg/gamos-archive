import { z } from "zod";
import type { GamosResult } from "../contract.js";
import type { GameOSStore } from "../lib/store.js";
/** 工具定义：name/title/description/zod schema/annotations + handler。 */
export interface ToolContext {
    store: GameOSStore;
    workspaceRoot: string;
    defaults: {
        engine: "godot" | "playcanvas" | "unity" | "web";
        target: string;
    };
}
export interface ToolDefinition {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodType;
    annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
    };
    /** app-only 工具不进入模型工具列表（宿主按 _meta.ui.visibility 过滤）。 */
    appOnly?: boolean;
    handler: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}
/** zod → MCP JSON Schema（draft-2020-12，input 视角：optional 不进 required）。 */
export declare function toolJsonSchema(schema: z.ZodType): Record<string, unknown>;
/** 统一错误→信封映射：领域错误带 code；发布门禁错误附 gates 明细。 */
export declare function runTool(tool: ToolDefinition, args: Record<string, unknown>, context: ToolContext): Promise<GamosResult>;
//# sourceMappingURL=tool.d.ts.map