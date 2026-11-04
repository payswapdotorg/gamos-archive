import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PlaytestIssue, PlaytestMetrics, PlaytestRecord, PlaytestScenario, PlaytestStep, WorldBuild, WorldFiles } from "./types.js";
import { PLAYTEST_MODES, PLAYTEST_SCENARIOS } from "./types.js";
import { newId, nowIso } from "../lib/ids.js";
import { GamosStateError, GameOSStore } from "../lib/store.js";

/** 构建记录与试玩证据（规格 §2.4）：证据绑定构建 digest，可比较、可追溯。 */

export interface RecordBuildInput {
  engine?: WorldBuild["engine"];
  engineVersion?: string;
  target: string;
  artifactPath: string;
  entryPoint?: string;
  digest?: string;
  notes?: string;
}

export async function recordBuild(
  store: GameOSStore,
  workspaceRoot: string,
  worldId: string,
  input: RecordBuildInput,
): Promise<WorldBuild> {
  const files = await store.requireWorld(worldId);
  if (!input.target?.trim()) throw new Error("target is required");
  if (!input.artifactPath?.trim()) throw new Error("artifactPath is required (workspace-relative)");
  const digest = input.digest?.trim() || (await sha256File(workspaceRoot, input.artifactPath.trim()));
  const build: WorldBuild = {
    id: newId("bld", 5),
    engine: input.engine ?? files.world.engine,
    engineVersion: input.engineVersion?.trim() ?? files.world.engineVersion,
    target: input.target.trim(),
    artifactPath: input.artifactPath.trim(),
    entryPoint: input.entryPoint?.trim() || input.artifactPath.trim(),
    digest,
    testStatus: "untested",
    playtestCount: 0,
    notes: input.notes?.trim() ?? "",
    recordedAt: nowIso(),
  };
  files.builds.builds.push(build);
  await store.saveWorldFiles(worldId, { builds: files.builds });
  return build;
}

export interface RecordPlaytestInput {
  buildId?: string;
  mode?: (typeof PLAYTEST_MODES)[number];
  scenario: PlaytestScenario;
  steps?: PlaytestStep[];
  screenshots?: string[];
  metrics?: PlaytestMetrics;
  issues?: PlaytestIssue[];
  verdict: PlaytestRecord["verdict"];
  durationMs?: number;
}

export async function recordPlaytest(
  store: GameOSStore,
  worldId: string,
  input: RecordPlaytestInput,
): Promise<PlaytestRecord> {
  const files = await store.requireWorld(worldId);
  if (!PLAYTEST_SCENARIOS.includes(input.scenario)) {
    throw new Error(`scenario must be one of: ${PLAYTEST_SCENARIOS.join(", ")}`);
  }
  const build = input.buildId
    ? files.builds.builds.find((candidate) => candidate.id === input.buildId)
    : files.builds.builds.at(-1);
  if (!build) {
    throw new GamosStateError(
      "not_found",
      input.buildId
        ? `build not found: ${input.buildId}`
        : "no builds recorded yet; record one with build_record before playtest evidence",
    );
  }
  const record: PlaytestRecord = {
    id: newId("pt", 5),
    buildId: build.id,
    buildDigest: build.digest,
    engine: build.engine,
    target: build.target,
    mode: input.mode ?? "browser-use",
    scenario: input.scenario,
    steps: input.steps ?? [],
    screenshots: input.screenshots ?? [],
    metrics: input.metrics ?? {},
    issues: input.issues ?? [],
    verdict: input.verdict,
    durationMs: input.durationMs ?? 0,
    recordedAt: nowIso(),
  };
  files.playtests.playtests.push(record);
  build.playtestCount = files.playtests.playtests.filter((run) => run.buildId === build.id).length;
  const runs = files.playtests.playtests.filter((run) => run.buildId === build.id);
  build.testStatus = runs.some((run) => run.verdict === "pass")
    ? "pass"
    : runs.length > 0
      ? "fail"
      : "untested";
  await store.saveWorldFiles(worldId, { builds: files.builds, playtests: files.playtests });
  return record;
}

export function playtestReport(files: WorldFiles): {
  totalRuns: number;
  byBuild: {
    buildId: string;
    digest: string;
    target: string;
    runs: number;
    passes: number;
    latestVerdict: string;
    avgFps: number | null;
    avgLoadMs: number | null;
    openIssues: { severity: string; description: string }[];
  }[];
} {
  const byBuild = new Map<string, PlaytestRecord[]>();
  for (const run of files.playtests.playtests) {
    const list = byBuild.get(run.buildId) ?? [];
    list.push(run);
    byBuild.set(run.buildId, list);
  }
  const rows: {
    buildId: string;
    digest: string;
    target: string;
    runs: number;
    passes: number;
    latestVerdict: string;
    avgFps: number | null;
    avgLoadMs: number | null;
    openIssues: { severity: string; description: string }[];
  }[] = [];
  for (const build of files.builds.builds) {
    const runs = byBuild.get(build.id) ?? [];
    if (runs.length === 0) continue;
    const fpsValues = runs.map((run) => run.metrics.fps).filter((fps): fps is number => typeof fps === "number");
    const loadValues = runs.map((run) => run.metrics.loadMs).filter((ms): ms is number => typeof ms === "number");
    const latest = runs.at(-1);
    rows.push({
      buildId: build.id,
      digest: build.digest,
      target: build.target,
      runs: runs.length,
      passes: runs.filter((run) => run.verdict === "pass").length,
      latestVerdict: latest?.verdict ?? "inconclusive",
      avgFps: fpsValues.length ? Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length) : null,
      avgLoadMs: loadValues.length ? Math.round(loadValues.reduce((a, b) => a + b, 0) / loadValues.length) : null,
      openIssues: runs
        .flatMap((run) => run.issues)
        .filter((issue) => issue.severity === "blocker" || issue.severity === "major")
        .map((issue) => ({ severity: issue.severity, description: issue.description })),
    });
  }
  return { totalRuns: files.playtests.playtests.length, byBuild: rows };
}

async function sha256File(workspaceRoot: string, relativePath: string): Promise<string> {
  try {
    const content = await readFile(join(workspaceRoot, relativePath));
    return `sha256:${createHash("sha256").update(content).digest("hex")}`;
  } catch {
    throw new GamosStateError(
      "artifact_missing",
      `build artifact not found: ${relativePath} (record the build after the artifact exists, or pass digest explicitly)`,
    );
  }
}
