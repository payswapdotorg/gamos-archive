#!/usr/bin/env node
/**
 * Gamos MCP server stdio 冒烟测试：initialize → tools/list → world_create →
 * world_publish（被门禁拒绝）→ hook 冒烟。验收见 docs/gamos/gamos-plugin-spec.md §11。
 */
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "dist", "mcp", "server.js");
const workspace = await mkdtemp(join(tmpdir(), "gamos-smoke-"));
await mkdir(join(workspace, "dist"), { recursive: true });
await writeFile(join(workspace, "dist/game.html"), "<html>game</html>");

const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, ZCODE_PROJECT_DIR: workspace, GAMOS_DEFAULT_ENGINE: "web" },
});
let buffer = "";
const pending = new Map();
let nextId = 1;
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    const resolver = pending.get(message.id);
    if (resolver) {
      pending.delete(message.id);
      resolver(message);
    }
  }
});
child.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (message) => (message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

let failures = 0;
function check(label, condition, extra = "") {
  if (condition) {
    console.log(`  ok - ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL - ${label} ${extra}`);
  }
}

const init = await request("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0" },
});
check("initialize returns server info", init?.serverInfo?.name === "gamos");
child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

const tools = await request("tools/list", {});
const names = tools.tools.map((tool) => tool.name);
check("17 tools listed", names.length === 17, `got ${names.length}`);
check("world_publish present with destructiveHint", tools.tools.find((t) => t.name === "world_publish")?.annotations?.destructiveHint === true);
const approve = tools.tools.find((tool) => tool.name === "release_approve");
check("release_approve is app-only", approve?._meta?.ui?.visibility?.[0] === "app");
check("inputSchema is JSON Schema object", tools.tools[0]?.inputSchema?.type === "object");

const created = await request("tools/call", {
  name: "world_create",
  arguments: { name: "Neon Runner", genre: "endless-runner", engine: "web" },
});
const world = JSON.parse(created.content[0].text).data;
check("world_create returns wld_ id", /^wld_/.test(world.id), JSON.stringify(world));

const published = await request("tools/call", { name: "world_publish", arguments: {} });
const publishBody = JSON.parse(published.content[0].text);
check("world_publish blocked by gates", published.isError === true && publishBody.error.code === "gates_failed");
check("gate details included", Array.isArray(publishBody.error.gates) && publishBody.error.gates.length === 5);

// Hook 冒烟：SessionStart 世界上下文注入。
const hookEnv = { ...process.env, ZCODE_PLUGIN_ROOT: join(here, "..") };
const hookRun = await new Promise((resolve) => {
  const proc = spawn(process.execPath, [join(here, "..", "scripts", "world-context.mjs")], {
    stdio: ["pipe", "pipe", "pipe"],
    env: hookEnv,
  });
  let out = "";
  let err = "";
  proc.stdout.on("data", (chunk) => (out += chunk));
  proc.stderr.on("data", (chunk) => (err += chunk));
  proc.on("close", (code) => resolve({ code, out, err }));
  proc.stdin.write(JSON.stringify({ cwd: workspace, hookEventName: "SessionStart" }));
  proc.stdin.end();
});
check("world-context hook exits 0", hookRun.code === 0, hookRun.err);
let hookContext = "";
try {
  hookContext = JSON.parse(hookRun.out).hookSpecificOutput.additionalContext;
} catch {
  hookContext = "";
}
check("world-context injects active world", hookContext.includes("Neon Runner") && hookContext.includes(world.id));

// Hook 冒烟：PreToolUse 发布门禁（未过门禁 exit 2）。
const gateRun = await new Promise((resolve) => {
  const proc = spawn(process.execPath, [join(here, "..", "scripts", "release-gate.mjs")], {
    stdio: ["pipe", "pipe", "pipe"],
    env: hookEnv,
  });
  let err = "";
  proc.stderr.on("data", (chunk) => (err += chunk));
  proc.on("close", (code) => resolve({ code, err }));
  proc.stdin.write(
    JSON.stringify({ cwd: workspace, hookEventName: "PreToolUse", toolName: "mcp__plugin_gamos_gamos__world_publish", toolInput: {} }),
  );
  proc.stdin.end();
});
check("release-gate hook blocks with exit 2", gateRun.code === 2, `code=${gateRun.code}`);
check("release-gate names missing gates", gateRun.err.includes("playtest-evidence") && gateRun.err.includes("user-approval"));

child.stdin.end();
child.kill();
if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
