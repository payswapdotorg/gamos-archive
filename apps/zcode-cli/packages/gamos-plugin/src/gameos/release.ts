import type { GamosGate } from "../contract.js";
import type { ReleaseChannel, WorldFiles } from "./types.js";
import { newId, nowIso } from "../lib/ids.js";
import { GamosStateError, GameOSStore } from "../lib/store.js";

/**
 * 发布门禁、审批与发布（规格见 docs/gamos/gamos-release-gates.md）。
 * 五门禁：gameir-complete → packages-validated → build-exists → playtest-evidence → user-approval。
 * 服务端评估是权威；PreToolUse hook 与宿主审批链是反馈/防线。
 */

export interface GateReport {
  evaluatedAt: string;
  status: "green" | "blocked";
  gates: GamosGate[];
}

export function evaluateGates(files: WorldFiles): GateReport {
  const gates: GamosGate[] = [];
  const gameir = files.gameir;
  const missing: string[] = [];
  if (gameir.coreLoop.length === 0) missing.push("coreLoop");
  if (gameir.mechanics.length === 0) missing.push("mechanics");
  if (gameir.levels.length === 0) missing.push("levels");
  if (!gameir.winCondition) missing.push("winCondition");
  if (!gameir.loseCondition) missing.push("loseCondition");
  gates.push({
    id: "gameir-complete",
    status: missing.length === 0 ? "pass" : "fail",
    detail:
      missing.length === 0
        ? `GameIR v${gameir.version}: ${gameir.mechanics.length} mechanics, ${gameir.levels.length} levels`
        : `GameIR v${gameir.version} missing: ${missing.join(", ")}`,
  });

  const invalid = files.packages.packages.filter((pkg) => pkg.validation.status !== "valid");
  gates.push({
    id: "packages-validated",
    status:
      files.packages.packages.length > 0 && invalid.length === 0
        ? "pass"
        : "fail",
    detail:
      files.packages.packages.length === 0
        ? "no packages registered yet"
        : invalid.length === 0
          ? `${files.packages.packages.length} package(s) valid`
          : `invalid or pending packages: ${invalid.map((pkg) => `${pkg.name}(${pkg.validation.status})`).join(", ")}`,
  });

  const latestBuild = files.builds.builds.at(-1);
  gates.push({
    id: "build-exists",
    status: latestBuild && latestBuild.digest ? "pass" : "fail",
    detail: latestBuild
      ? `latest build ${latestBuild.id} (${latestBuild.target}, ${latestBuild.digest.slice(0, 19)}…)`
      : `no builds recorded (${files.builds.builds.length} builds)`,
  });

  const passingRuns = latestBuild
    ? files.playtests.playtests.filter((run) => run.buildId === latestBuild.id && run.verdict === "pass")
    : [];
  const latestRun = files.playtests.playtests.at(-1);
  gates.push({
    id: "playtest-evidence",
    status: passingRuns.length > 0 ? "pass" : "fail",
    detail:
      passingRuns.length > 0
        ? `${passingRuns.length} passing playtest(s) for build ${latestBuild?.id}`
        : latestRun
          ? `latest playtest verdict is ${latestRun.verdict}; need at least one pass for the latest build`
          : "no playtest evidence recorded yet",
  });

  const pending = files.releases.approvals.filter((approval) => !approval.approvedAt);
  const approved = files.releases.approvals.filter((approval) => approval.approvedAt);
  gates.push({
    id: "user-approval",
    status: approved.length > 0 ? "pass" : "fail",
    detail:
      approved.length > 0
        ? `approved at ${approved.at(-1)?.approvedAt}`
        : pending.length > 0
          ? `approval requested but not yet granted (pending: ${pending.map((a) => a.id).join(", ")})`
          : "no release approval; request one with release_request_approval and grant it in the Gamos Console",
  });

  return { evaluatedAt: nowIso(), status: gates.every((gate) => gate.status === "pass") ? "green" : "blocked", gates };
}

export async function checkGates(store: GameOSStore, worldId: string): Promise<GateReport> {
  const files = await store.requireWorld(worldId);
  const report = evaluateGates(files);
  files.releases.lastGateReport = report;
  await store.saveWorldFiles(worldId, { releases: files.releases });
  return report;
}

export async function requestApproval(
  store: GameOSStore,
  worldId: string,
  notes?: string,
): Promise<{ id: string; status: "pending" }> {
  const files = await store.requireWorld(worldId);
  const approval = {
    id: newId("apr", 5),
    scope: "publish" as const,
    requestedAt: nowIso(),
    requestedNotes: notes?.trim() ?? "",
  };
  files.releases.approvals.push(approval);
  await store.saveWorldFiles(worldId, { releases: files.releases });
  return { id: approval.id, status: "pending" };
}

export async function approveRelease(
  store: GameOSStore,
  worldId: string,
  approvalId?: string,
  notes?: string,
): Promise<{ id: string; status: "approved" }> {
  const files = await store.requireWorld(worldId);
  const pending = files.releases.approvals.filter((approval) => !approval.approvedAt);
  if (pending.length === 0) {
    throw new GamosStateError("not_found", "no pending approval; request one with release_request_approval first");
  }
  const target = approvalId
    ? pending.find((approval) => approval.id === approvalId)
    : pending.at(-1);
  if (!target) throw new GamosStateError("not_found", `pending approval not found: ${approvalId}`);
  target.approvedBy = "user";
  target.approvedAt = nowIso();
  target.approvalNotes = notes?.trim() ?? "";
  await store.saveWorldFiles(worldId, { releases: files.releases });
  return { id: target.id, status: "approved" };
}

export interface PublishInput {
  version?: string;
  channel?: ReleaseChannel;
}

export async function publishWorld(
  store: GameOSStore,
  worldId: string,
  input: PublishInput,
): Promise<Record<string, unknown>> {
  const files = await store.requireWorld(worldId);
  const report = evaluateGates(files);
  if (report.status !== "green") {
    throw new GamosPublishError(report);
  }
  const approval = files.releases.approvals.find((candidate) => candidate.approvedAt);
  if (!approval) {
    // evaluateGates 已覆盖该情形；此处兜底，保证审批语义独立可读。
    throw new GamosPublishError(report);
  }
  const latestBuild = files.builds.builds.at(-1);
  const version = input.version?.trim() || nextVersion(files.releases.publications.at(-1)?.version);
  const channel = input.channel ?? "preview";
  const publication = {
    id: newId("pub", 5),
    version,
    channel,
    buildId: latestBuild?.id ?? "",
    buildDigest: latestBuild?.digest ?? "",
    gateReport: { evaluatedAt: report.evaluatedAt, gates: report.gates },
    approvalId: approval.id,
    publishedAt: nowIso(),
    localUrl: latestBuild?.entryPoint ?? "",
  };
  files.releases.publications.push(publication);
  files.world.status = "released";
  files.world.updatedAt = nowIso();
  await store.saveWorldFiles(worldId, { world: files.world, releases: files.releases });
  return {
    publication,
    note: "published to the local release record; external distribution channels are out of scope for this gate",
  };
}

export class GamosPublishError extends Error {
  constructor(readonly report: GateReport) {
    super("release gates are not green");
    this.name = "GamosPublishError";
  }
}

function nextVersion(previous?: string): string {
  if (!previous) return "0.1.0";
  const parts = previous.split(".");
  if (parts.length !== 3) return "0.1.0";
  const patch = Number.parseInt(parts[2] ?? "0", 10);
  return `${parts[0]}.${parts[1]}.${Number.isNaN(patch) ? 0 : patch + 1}`;
}

/** World Atlas（规格 P4）：GameIR + 包图的只读投影，与源数据区分。 */
export function worldAtlas(files: WorldFiles): Record<string, unknown> {
  const mechanicsById = new Map(files.gameir.mechanics.map((mechanic) => [mechanic.id, mechanic]));
  return {
    identity: {
      id: files.world.id,
      name: files.world.name,
      genre: files.world.genre,
      engine: `${files.world.engine}${files.world.engineVersion ? ` (${files.world.engineVersion})` : ""}`,
      status: files.world.status,
    },
    coreLoop: files.gameir.coreLoop,
    systems: files.gameir.mechanics.map((mechanic) => ({
      id: mechanic.id,
      name: mechanic.name,
      description: mechanic.description,
      rules: mechanic.rules,
      owningPackages: files.packages.packages
        .filter((pkg) => pkg.type === "mechanic" && pkg.name.toLowerCase().includes(mechanic.name.toLowerCase()))
        .map((pkg) => ({ id: pkg.id, name: pkg.name, validation: pkg.validation.status })),
    })),
    levelGraph: {
      nodes: files.gameir.levels.map((level) => ({
        id: level.id,
        name: level.name,
        kind: level.kind,
        difficulty: level.difficulty,
        mechanics: level.mechanics
          .map((id) => mechanicsById.get(id)?.name ?? id),
      })),
      edges: files.gameir.levels.flatMap((level) =>
        level.exit.map((to) => ({ from: level.id, to })),
      ),
    },
    assets: files.packages.packages.reduce<Record<string, string[]>>((acc, pkg) => {
      const key = pkg.type;
      (acc[key] ??= []).push(pkg.name);
      return acc;
    }, {}),
    dependencies: files.packages.packages.flatMap((pkg) =>
      pkg.dependencies.map((dep) => `${pkg.name} → ${dep}`),
    ),
    knownIssues: files.playtests.playtests
      .flatMap((run) => run.issues)
      .filter((issue) => issue.severity === "blocker" || issue.severity === "major"),
    decisions: [
      ...files.releases.approvals.map((approval) => ({
        kind: "approval",
        id: approval.id,
        at: approval.approvedAt ?? approval.requestedAt,
        summary: approval.approvedAt ? "approved by user" : "pending user approval",
      })),
      ...files.releases.publications.map((publication) => ({
        kind: "publication",
        id: publication.id,
        at: publication.publishedAt,
        summary: `published ${publication.version} (${publication.channel}) from ${publication.buildDigest.slice(0, 19)}…`,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at)),
    constraints: files.gameir.constraints,
  };
}

/** 世界级使用统计（规格 P4）。 */
export function worldUsage(files: WorldFiles): Record<string, unknown> {
  const runs = files.playtests.playtests;
  return {
    worldId: files.world.id,
    name: files.world.name,
    counts: {
      worlds: 1,
      mechanics: files.gameir.mechanics.length,
      levels: files.gameir.levels.length,
      packages: files.packages.packages.length,
      builds: files.builds.builds.length,
      playtests: runs.length,
      publications: files.releases.publications.length,
    },
    playtestsByVerdict: {
      pass: runs.filter((run) => run.verdict === "pass").length,
      fail: runs.filter((run) => run.verdict === "fail").length,
      inconclusive: runs.filter((run) => run.verdict === "inconclusive").length,
    },
    lastBuildAt: files.builds.builds.at(-1)?.recordedAt ?? null,
    lastPlaytestAt: runs.at(-1)?.recordedAt ?? null,
    lastPublicationAt: files.releases.publications.at(-1)?.publishedAt ?? null,
    updatedAt: files.world.updatedAt,
  };
}
