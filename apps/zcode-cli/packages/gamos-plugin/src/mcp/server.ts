import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  PANEL_MIME,
  PANEL_URI,
  RESOURCE_MIME,
  STATE_URI,
  type GamosResult,
} from "../contract.js";
import { GameOSStore } from "../lib/store.js";
import { buildConsoleState } from "../gameos/console-state.js";
import { gamosTools, toolJsonSchema } from "./tools.js";
import { runTool, type ToolContext } from "./tool.js";

const SERVER_VERSION = "0.1.0";
const APP_ONLY = { ui: { visibility: ["app"] } };

export interface GamosServerOptions {
  /** 项目根（`.gamos/` 所在工作区）。 */
  workspaceRoot: string;
  /** `.gamos/` 根覆盖（测试注入）。 */
  stateRootOverride?: string;
  /** 构建产物 dist/ui/panel.html 的绝对路径。 */
  panelPath: string;
  defaults: { engine: "godot" | "playcanvas" | "unity" | "web"; target: string };
}

/**
 * gamos MCP server：Tool Fabric（17 个 GameOS 工具）+ Gamos Console 资源。
 * 读走资源（面板轮询不弹审批），写走工具（经宿主审批链）；`release_approve`
 * 声明 app-only（宿主不把它放进模型工具列表，用户只在面板批准）。
 */
export function createGamosServer(options: GamosServerOptions): Server {
  const server = new Server({ name: "gamos", version: SERVER_VERSION }, { capabilities: { resources: {}, tools: {} } });
  const tools = gamosTools();
  const context: ToolContext = {
    store: new GameOSStore(options.workspaceRoot, options.stateRootOverride),
    workspaceRoot: options.workspaceRoot,
    defaults: options.defaults,
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: toolJsonSchema(tool.inputSchema),
      annotations: tool.annotations,
      ...(tool.appOnly ? { _meta: APP_ONLY } : {}),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
    const parsed = tool.inputSchema.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      return envelope({ error: { code: "invalid_input", message: `Invalid arguments for ${name}: ${issues}` } });
    }
    const result = await runTool(tool, parsed.data as Record<string, unknown>, context);
    return envelope(result);
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: PANEL_URI, name: "Gamos Console", mimeType: PANEL_MIME },
      { uri: STATE_URI, name: "Gamos State", mimeType: RESOURCE_MIME },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === PANEL_URI) {
      const text = await readFile(options.panelPath, "utf8");
      return { contents: [{ uri, mimeType: PANEL_MIME, text }] };
    }
    if (uri === STATE_URI) {
      const state = await buildConsoleState(context.store);
      return {
        contents: [{ uri, mimeType: RESOURCE_MIME, text: JSON.stringify({ data: state }) }],
      };
    }
    throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
  });

  return server;
}

function envelope(result: GamosResult) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: result as Record<string, unknown>,
    ...("error" in result ? { isError: true } : {}),
  };
}

export async function main(): Promise<void> {
  const workspaceRoot = process.env.ZCODE_PROJECT_DIR ?? process.cwd();
  const here = dirname(fileURLToPath(import.meta.url));
  const engine = parseEngine(process.env.GAMOS_DEFAULT_ENGINE);
  const server = createGamosServer({
    workspaceRoot,
    panelPath: resolve(here, "..", "ui", "panel.html"),
    defaults: { engine, target: process.env.GAMOS_DEFAULT_TARGET?.trim() || "browser-desktop" },
  });
  await server.connect(new StdioServerTransport());
}

function parseEngine(raw: string | undefined): "godot" | "playcanvas" | "unity" | "web" {
  const value = raw?.trim();
  return value === "playcanvas" || value === "godot" || value === "unity" ? value : "web";
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  await main();
}
