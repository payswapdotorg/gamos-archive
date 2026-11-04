/**
 * 契约示例：GameOS 领域操作的典型用法（保存式工作流与技能引导 Agent 走同一路径）。
 * 运行态入口是 MCP server（`mcp/server.ts` 的 main()）；此处演示库级调用。
 */
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameOSStore } from "./lib/store.js";
import { createWorld, updateWorld, emptyGameIr } from "./gameos/worlds.js";
import { registerPackage } from "./gameos/packages.js";
import { recordBuild, recordPlaytest } from "./gameos/evidence.js";
import { checkGates, requestApproval } from "./gameos/release.js";

export async function gamosContractExample(): Promise<void> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "gamos-example-"));
  const store = new GameOSStore(workspaceRoot);

  // 1) 创建世界（首个世界自动设为活动）。
  const world = await createWorld(store, { name: "Neon Runner", genre: "endless-runner" }, { engine: "web", target: "browser-desktop" });

  // 2) 完善 GameIR（整体替换，version+1）。
  await updateWorld(store, world.id, {
    gameIr: {
      ...emptyGameIr(),
      coreLoop: ["Run", "Dodge", "Collect"],
      mechanics: [{ id: "mec_dash", name: "Dash", description: "Short forward dash", rules: ["2s cooldown"] }],
      levels: [{ id: "lvl_city", name: "Neon City", kind: "level", difficulty: 1, mechanics: ["mec_dash"], entry: [], exit: [] }],
      winCondition: "Survive 90 seconds",
      loseCondition: "Hit an obstacle",
    },
  });

  // 3) 注册包（intake 校验立即执行：rights/provenance/engine-compat/file-exists/deps-resolve）。
  await registerPackage(store, workspaceRoot, world.id, {
    name: "coin-model",
    type: "asset-3d",
    path: "assets/coin.glb",
    license: "CC-BY-4.0",
    author: "Gamos",
  });

  // 4) 构建与试玩证据（digest 把证据绑定到构建）。
  const build = await recordBuild(store, workspaceRoot, world.id, {
    target: "browser-desktop",
    artifactPath: "dist/game.html",
    digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  });
  await recordPlaytest(store, world.id, {
    buildId: build.id,
    scenario: "smoke",
    verdict: "pass",
    metrics: { fps: 58, loadMs: 1800 },
  });

  // 5) 门禁 → 审批（用户在 Gamos Console 批准）→ 发布。
  await checkGates(store, world.id);
  await requestApproval(store, world.id, "first preview release");
  // release_approve 是 app-only 工具：只有面板（用户）能批准。
  // 审批后：
  // await approveRelease(store, world.id);
  // await publishWorld(store, world.id, { channel: "preview" });
}
