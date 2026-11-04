#!/usr/bin/env node
/**
 * Gamos World context provider（SessionStart hook）。
 *
 * 把活动 World 的身份、GameIR 概要、包状态、最近构建/试玩与门禁摘要注入会话上下文
 * （docs/gamos/gamos-plugin-spec.md §5）。规则：
 * - 无 `.gamos/` 或无活动世界 ⇒ 静默成功（无上下文可注入），不得报错。
 * - 输出宿主约定的 additionalContext JSON；读取异常 ⇒ 静默成功（宁缺勿错）。
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

function summarize(worldDir, world, gameir, packages, builds, playtests, releases) {
  const latestBuild = builds.builds.at(-1);
  const latestRun = playtests.playtests.at(-1);
  const invalidPackages = packages.packages.filter((pkg) => pkg.validation && pkg.validation.status !== "valid");
  const approved = (releases.approvals ?? []).some((approval) => approval.approvedAt);
  const lines = [
    "GAMOS WORLD CONTEXT (injected by the gamos plugin; re-run after world/package changes)",
    `Active World: ${world.name} (${world.id}) — ${world.genre || "genre unset"}, engine ${world.engine}${world.engineVersion ? ` (${world.engineVersion})` : ""}, status ${world.status}, targets: ${world.targetProfiles.join(", ")}`,
    `GameIR v${gameir.version}: ${gameir.mechanics.length} mechanics, ${gameir.levels.length} levels; core loop: ${gameir.coreLoop.join(" → ") || "unset"}; win: ${gameir.winCondition || "unset"}; lose: ${gameir.loseCondition || "unset"}`,
    `Packages: ${packages.packages.length} registered${invalidPackages.length > 0 ? `, ${invalidPackages.length} invalid/pending (${invalidPackages.map((pkg) => pkg.name).join(", ")})` : ""}`,
    latestBuild
      ? `Last build: ${latestBuild.id} (${latestBuild.target}, ${latestBuild.digest.slice(0, 19)}…, tests ${latestBuild.testStatus})`
      : "Last build: none recorded",
    latestRun
      ? `Playtests: ${playtests.playtests.length} runs; latest ${latestRun.scenario} verdict ${latestRun.verdict}${latestRun.metrics && typeof latestRun.metrics.fps === "number" ? ` (${latestRun.metrics.fps} fps)` : ""}`
      : `Playtests: none recorded`,
    `Release: user approval ${approved ? "granted" : "not granted"}; publications: ${(releases.publications ?? []).length}`,
    "Guidance: use the gamos tools for world/package/playtest/build/release operations (ToolSearch query \"gamos world package playtest release\"). Never hand-edit files under .gamos/ — they are managed by the gamos tools.",
  ];
  return lines.join("\n");
}

async function main() {
  let input = {};
  try {
    input = JSON.parse(await readStdin());
  } catch {
    input = {};
  }
  const cwd = typeof input.cwd === "string" && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = join(cwd, ".gamos");
  const registry = await readJson(join(root, "gamos.json"));
  const activeId = registry?.activeWorldId;
  if (!activeId) {
    process.exit(0);
  }
  const worldDir = join(root, "worlds", activeId);
  const [world, gameir, packages, builds, playtests, releases] = await Promise.all([
    readJson(join(worldDir, "world.json")),
    readJson(join(worldDir, "gameir.json")),
    readJson(join(worldDir, "packages.json")),
    readJson(join(worldDir, "builds.json")),
    readJson(join(worldDir, "playtests.json")),
    readJson(join(worldDir, "releases.json")),
  ]);
  if (!world || !gameir) {
    process.exit(0);
  }
  const context = summarize(
    worldDir,
    world,
    gameir,
    packages ?? { packages: [] },
    builds ?? { builds: [] },
    playtests ?? { playtests: [] },
    releases ?? { approvals: [], publications: [] },
  );
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
      additionalContext: context,
    }),
  );
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

main().catch(() => process.exit(0));
