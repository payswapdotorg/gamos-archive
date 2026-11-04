import { z } from "zod";
import type { GamosGate, GamosResult } from "../contract.js";
import type { GameOSStore } from "../lib/store.js";
import { GamosStateError } from "../lib/store.js";
import { GamosPublishError } from "../gameos/release.js";

/** 工具定义：name/title/description/zod schema/annotations + handler。 */
export interface ToolContext {
  store: GameOSStore;
  workspaceRoot: string;
  defaults: { engine: "godot" | "playcanvas" | "unity" | "web"; target: string };
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean };
  /** app-only 工具不进入模型工具列表（宿主按 _meta.ui.visibility 过滤）。 */
  appOnly?: boolean;
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}

/** zod → MCP JSON Schema（draft-2020-12，input 视角：optional 不进 required）。 */
export function toolJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: "input", target: "draft-2020-12" }) as Record<string, unknown>;
}

/** 统一错误→信封映射：领域错误带 code；发布门禁错误附 gates 明细。 */
export async function runTool(
  tool: ToolDefinition,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<GamosResult> {
  try {
    return { data: await tool.handler(args, context) };
  } catch (error) {
    if (error instanceof GamosPublishError) {
      return {
        error: {
          code: "gates_failed",
          message: "world_publish blocked: release gates are not green",
          gates: error.report.gates as GamosGate[],
        },
      };
    }
    if (error instanceof GamosStateError) {
      return { error: { code: error.code, message: error.message } };
    }
    return { error: { code: "invalid_input", message: (error as Error).message } };
  }
}
