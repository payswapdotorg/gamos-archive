import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { PANEL_URI, STATE_URI, RELEASE_APPROVE_TOOL } from "../src/contract.ts";
import { createGamosServer } from "../src/mcp/server.ts";
import type { GamosResult } from "../src/contract.ts";

let dir: string;
let client: Client;

async function put(relative: string, content: string): Promise<void> {
  await mkdir(join(dir, relative, ".."), { recursive: true });
  await writeFile(join(dir, relative), content);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gamos-server-"));
  await writeFile(join(dir, "panel.html"), "<html>gamos panel</html>");
  const server = createGamosServer({
    workspaceRoot: dir,
    panelPath: join(dir, "panel.html"),
    defaults: { engine: "web", target: "browser-desktop" },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test", version: "0" });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  await rm(dir, { recursive: true, force: true });
});

async function call(name: string, args: Record<string, unknown> = {}): Promise<GamosResult> {
  const result = await client.callTool({ name, arguments: args });
  return result.structuredContent as GamosResult;
}

function errCode(result: GamosResult): string | undefined {
  return "error" in result ? result.error.code : undefined;
}

function textOf(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    const text = (content as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "{}";
}

describe("gamos mcp server", () => {
  it("lists 17 tools with the panel-only approval tool marked app-only", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(17);
    const approve = tools.find((tool) => tool.name === RELEASE_APPROVE_TOOL);
    expect(approve?.annotations?.readOnlyHint).toBe(false);
    const meta = approve as unknown as { _meta?: { ui?: { visibility?: string[] } } };
    expect(meta._meta?.ui?.visibility).toEqual(["app"]);
    const publish = tools.find((tool) => tool.name === "world_publish");
    expect((publish as unknown as { annotations?: { destructiveHint?: boolean } })?.annotations?.destructiveHint).toBe(true);
  });

  it("serves the console panel and state resources", async () => {
    const panel = await client.readResource({ uri: PANEL_URI });
    expect(panel.contents[0]).toMatchObject({ mimeType: "text/html;profile=mcp-app" });
    const state = await client.readResource({ uri: STATE_URI });
    const parsed = JSON.parse(textOf(state.contents[0])) as {
      data: { worlds: unknown[]; active: unknown };
    };
    expect(parsed.data.worlds).toHaveLength(0);
    expect(parsed.data.active).toBeNull();
  });

  it("runs the acceptance flow: create → build → gates block → evidence → approve → publish", async () => {
    const created = await call("world_create", { name: "Neon Runner", genre: "endless-runner" });
    const worldId = (created.data as { id: string }).id;

    await call("world_update", {
      worldId,
      gameIr: {
        version: 1,
        coreLoop: ["Run", "Dodge"],
        mechanics: [{ id: "mec_run", name: "Run", description: "run", rules: ["60 u/s"] }],
        levels: [{ id: "lvl_1", name: "One", kind: "level", difficulty: 1, mechanics: [], entry: [], exit: [] }],
        progression: { model: "score", description: "score" },
        artDirection: { style: "neon", palette: [], references: [] },
        controls: [],
        winCondition: "survive 90s",
        loseCondition: "hit",
        constraints: { performance: { targetFps: 60, maxLoadMs: 3000 } },
      },
    });

    const blocked = await call("release_gate_check", { worldId });
    expect(errCode(blocked)).toBeUndefined();
    const gates = (blocked.data as { gates: { id: string; status: string }[] }).gates;
    expect(gates.find((gate) => gate.id === "build-exists")?.status).toBe("fail");

    await put("dist/game.html", "<html>game</html>");
    const build = await call("build_record", { worldId, target: "browser-desktop", artifactPath: "dist/game.html" });
    expect((build.data as { digest: string }).digest).toMatch(/^sha256:/);
    await call("package_register", {
      worldId,
      name: "game",
      type: "mechanic",
      path: "dist/game.html",
      license: "MIT",
      author: "Gamos",
    });

    const publishBlocked = await call("world_publish", { worldId });
    expect(errCode(publishBlocked)).toBe("gates_failed");

    await call("playtest_record", { worldId, scenario: "smoke", verdict: "pass", metrics: { fps: 58, loadMs: 1200 } });
    await call("release_request_approval", { worldId, notes: "preview" });

    const stillBlocked = await call("world_publish", { worldId });
    expect(errCode(stillBlocked)).toBe("gates_failed");

    // 面板路径：用户批准（app-only 工具），随后发布放行。
    await call(RELEASE_APPROVE_TOOL, { worldId });
    const published = await call("world_publish", { worldId, channel: "preview" });
    expect(errCode(published)).toBeUndefined();
    const publication = (published.data as { publication: { version: string; approvalId: string } }).publication;
    expect(publication.version).toBe("0.1.0");
    expect(publication.approvalId).toMatch(/^apr_/);

    const state = await client.readResource({ uri: STATE_URI });
    const parsed = JSON.parse(textOf(state.contents[0])) as {
      data: { active: { world: { status: string }; gates: { status: string } } };
    };
    expect(parsed.data.active.world.status).toBe("released");
    expect(parsed.data.active.gates.status).toBe("green");
  });

  it("returns not_found for unknown worlds and invalid_input for bad payloads", async () => {
    const missing = await call("world_inspect", { worldId: "wld_missing" });
    expect(errCode(missing)).toBe("not_found");
    const bad = await call("world_create", { name: "" });
    expect(errCode(bad)).toBe("invalid_input");
  });
});
