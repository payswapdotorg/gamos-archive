#!/usr/bin/env node
/**
 * Gamos release gate（PreToolUse hook，matcher: world_publish）。
 *
 * 复算五门禁 + 审批；未全绿 exit 2 并在 stderr 给出缺失明细（宿主转为工具拒绝理由）。
 * `.gamos/` 缺失/损坏/世界不存在 ⇒ 放行（服务端仍是权威裁决，hook 不越权阻断）。
 * 规格见 docs/gamos/gamos-release-gates.md §4。
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

function evaluateGates(gameir, packages, builds, playtests, releases) {
  const gates = [];
  const missing = [];
  if (!gameir.coreLoop?.length) missing.push("coreLoop");
  if (!gameir.mechanics?.length) missing.push("mechanics");
  if (!gameir.levels?.length) missing.push("levels");
  if (!gameir.winCondition) missing.push("winCondition");
  if (!gameir.loseCondition) missing.push("loseCondition");
  gates.push([
    "gameir-complete",
    missing.length === 0,
    missing.length === 0 ? "" : `GameIR missing: ${missing.join(", ")}`,
  ]);

  const pkgs = packages.packages ?? [];
  const invalid = pkgs.filter((pkg) => pkg.validation?.status !== "valid");
  gates.push([
    "packages-validated",
    pkgs.length > 0 && invalid.length === 0,
    pkgs.length === 0
      ? "no packages registered"
      : invalid.length === 0
        ? ""
        : `invalid/pending packages: ${invalid.map((pkg) => pkg.name).join(", ")}`,
  ]);

  const latestBuild = builds.builds?.at(-1);
  gates.push([
    "build-exists",
    Boolean(latestBuild?.digest),
    latestBuild ? "" : "no builds recorded",
  ]);

  const passing = latestBuild
    ? (playtests.playtests ?? []).some(
        (run) => run.buildId === latestBuild.id && run.verdict === "pass",
      )
    : false;
  gates.push([
    "playtest-evidence",
    passing,
    passing ? "" : `need one passing playtest for build ${latestBuild?.id ?? "(none)"}`,
  ]);

  const approved = (releases.approvals ?? []).some((approval) => approval.approvedAt);
  gates.push([
    "user-approval",
    approved,
    approved ? "" : "user approval missing (request via release_request_approval, grant in Gamos Console)",
  ]);
  return gates;
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
  const worldId =
    (input.toolInput && typeof input.toolInput.worldId === "string" && input.toolInput.worldId) ||
    registry?.activeWorldId;
  if (!worldId) {
    process.exit(0);
  }
  const worldDir = join(root, "worlds", worldId);
  const [world, gameir, packages, builds, playtests, releases] = await Promise.all([
    readJson(join(worldDir, "world.json")),
    readJson(join(worldDir, "gameir.json")),
    readJson(join(worldDir, "packages.json")),
    readJson(join(worldDir, "builds.json")),
    readJson(join(worldDir, "playtests.json")),
    readJson(join(worldDir, "releases.json")),
  ]);
  if (!world || !gameir || !packages || !builds || !playtests || !releases) {
    process.exit(0);
  }
  const gates = evaluateGates(gameir, packages, builds, playtests, releases);
  const failed = gates.filter(([, ok]) => !ok);
  if (failed.length === 0) {
    process.exit(0);
  }
  const detail = failed.map(([id, , message]) => `- ${id}: ${message}`).join("\n");
  process.stderr.write(
    `Gamos release gate blocked world_publish for ${world.name} (${worldId}):\n${detail}\nPublishing requires all five gates; the user approves releases in the Gamos Console.`,
  );
  process.exit(2);
}

main().catch(() => process.exit(0));
