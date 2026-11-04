import { z } from "zod";
import { GAME_ENGINES, WORLD_STATUSES } from "../gameos/types.js";
import { createWorld, inspectWorld, listWorlds, updateWorld } from "../gameos/worlds.js";
import {
  BUILD_RECORD_TOOL,
  PACKAGE_GRAPH_TOOL,
  PACKAGE_REGISTER_TOOL,
  PACKAGE_VALIDATE_TOOL,
  PLAYTEST_RECORD_TOOL,
  PLAYTEST_REPORT_TOOL,
  RELEASE_APPROVE_TOOL,
  RELEASE_GATE_CHECK_TOOL,
  RELEASE_REQUEST_APPROVAL_TOOL,
  WORLD_ATLAS_TOOL,
  WORLD_CREATE_TOOL,
  WORLD_INSPECT_TOOL,
  WORLD_LIST_TOOL,
  WORLD_PUBLISH_TOOL,
  WORLD_SET_ACTIVE_TOOL,
  WORLD_UPDATE_TOOL,
  WORLD_USAGE_TOOL,
} from "../contract.js";
import { registerPackage, refreshPackageValidation, packageGraph } from "../gameos/packages.js";
import { playtestReport, recordBuild, recordPlaytest } from "../gameos/evidence.js";
import { approveRelease, checkGates, publishWorld, requestApproval, worldAtlas, worldUsage } from "../gameos/release.js";
import type { ToolContext, ToolDefinition } from "./tool.js";
import { toolJsonSchema } from "./tool.js";

/**
 * Tool Fabric：17 个 GameOS 工具（规格 §4）。描述包含领域关键词（world/game/asset/
 * package/playtest/build/release/atlas），供 ToolSearch 检索；全部返回 {data}|{error} 信封。
 */

const worldIdField = z
  .string()
  .optional()
  .describe("World id. Defaults to the active world (or the only world).");

export function gamosTools(): ToolDefinition[] {
  return [
    {
      name: WORLD_CREATE_TOOL,
      title: "Create World",
      description:
        "Gamos game platform: create a new game World with a stable id, engine binding (web/playcanvas/godot/unity), target profiles, an empty GameIR (versioned game definition) and an empty package graph. The first world becomes the active world.",
      inputSchema: z.object({
        name: z.string().min(1).describe("World/game name, for example 'Neon Runner'."),
        genre: z.string().optional().describe("Genre, for example endless-runner or puzzle."),
        description: z.string().optional().describe("One-paragraph concept."),
        engine: z.enum(GAME_ENGINES).optional().describe("Game engine binding. Defaults to the plugin default_engine."),
        engineVersion: z.string().optional().describe("Engine version/variant, for example 'three.js r170 (CDN)'."),
        targetProfiles: z.array(z.string()).optional().describe("Target profiles such as browser-desktop, browser-mobile."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      handler: async (args, context: ToolContext) =>
        createWorld(
          context.store,
          {
            name: String(args.name ?? ""),
            genre: args.genre as string | undefined,
            description: args.description as string | undefined,
            engine: args.engine as (typeof GAME_ENGINES)[number] | undefined,
            engineVersion: args.engineVersion as string | undefined,
            targetProfiles: args.targetProfiles as string[] | undefined,
          },
          context.defaults,
        ),
    },
    {
      name: WORLD_LIST_TOOL,
      title: "List Worlds",
      description:
        "Gamos game platform: list all game worlds in this workspace with engine, status, GameIR version and package/build/playtest counts.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      handler: async (_args, context) => listWorlds(context.store),
    },
    {
      name: WORLD_INSPECT_TOOL,
      title: "Inspect World",
      description:
        "Gamos game platform: inspect a world's full state — identity, GameIR (mechanics/levels/controls/constraints), package graph with rights and validation, builds, playtest evidence, release approvals, and the current release gate evaluation.",
      inputSchema: z.object({ worldId: worldIdField }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      handler: async (args, context) => inspectWorld(context.store, await resolveId(context, args)),
    },
    {
      name: WORLD_SET_ACTIVE_TOOL,
      title: "Set Active World",
      description:
        "Gamos game platform: set the active world for this workspace. The active world is injected into every session's world context and is the default for world tools.",
      inputSchema: z.object({ worldId: z.string().min(1).describe("World id to activate.") }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      handler: async (args, context) => {
        const worldId = String(args.worldId ?? "");
        await context.store.requireWorld(worldId);
        await context.store.setActiveWorld(worldId);
        return { activeWorldId: worldId };
      },
    },
    {
      name: WORLD_UPDATE_TOOL,
      title: "Update World or GameIR",
      description:
        "Gamos game platform: update world metadata (name/genre/description/engine/targets/status) or replace the whole GameIR (mechanics, levels, progression, economy, artDirection, controls, win/lose conditions, performance budget). Replacing the GameIR bumps its version.",
      inputSchema: z.object({
        worldId: worldIdField,
        name: z.string().optional(),
        genre: z.string().optional(),
        description: z.string().optional(),
        engine: z.enum(GAME_ENGINES).optional(),
        engineVersion: z.string().optional(),
        targetProfiles: z.array(z.string()).optional(),
        status: z.enum(WORLD_STATUSES).optional(),
        gameIr: z.record(z.string(), z.unknown()).optional().describe("Complete replacement GameIR object."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      handler: async (args, context) =>
        updateWorld(context.store, await resolveId(context, args), {
          name: args.name as string | undefined,
          genre: args.genre as string | undefined,
          description: args.description as string | undefined,
          engine: args.engine as (typeof GAME_ENGINES)[number] | undefined,
          engineVersion: args.engineVersion as string | undefined,
          targetProfiles: args.targetProfiles as string[] | undefined,
          status: args.status as (typeof WORLD_STATUSES)[number] | undefined,
          gameIr: args.gameIr as never,
        }),
    },
    {
      name: PACKAGE_REGISTER_TOOL,
      title: "Register Package",
      description:
        "Gamos game platform: register an asset or mechanic package into the world's package graph with rights (license, author, sourceUrl, attribution) and provenance (origin, createdBy). Runs the intake validation immediately (rights-metadata, provenance, engine-compat, file-exists, deps-resolve).",
      inputSchema: z.object({
        worldId: worldIdField,
        name: z.string().min(1).describe("Package name, unique within the world."),
        type: z.enum(["asset-3d", "asset-texture", "asset-audio", "asset-animation", "mechanic", "ui", "shader", "level"]),
        path: z.string().min(1).describe("Workspace-relative path of the asset or source file."),
        engine: z.string().optional().describe("Package engine compatibility. Defaults to the world engine; '*' means any."),
        version: z.string().optional().describe("Package version. Defaults to 1.0.0."),
        dependencies: z.array(z.string()).optional().describe("Package ids or names this package depends on."),
        license: z.string().describe("License identifier, for example MIT, CC-BY-4.0, proprietary."),
        author: z.string().describe("Author or rights holder."),
        sourceUrl: z.string().optional().describe("Where the asset came from (required context for imported assets)."),
        attribution: z.string().optional().describe("Attribution line to ship with the world."),
        origin: z.enum(["original", "generated", "imported"]).optional().describe("Provenance origin. Defaults to original."),
        createdBy: z.enum(["agent", "user"]).optional().describe("Who created it. Defaults to agent."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      handler: async (args, context) =>
        registerPackage(context.store, context.workspaceRoot, await resolveId(context, args), {
          name: String(args.name ?? ""),
          type: args.type as "asset-3d",
          path: String(args.path ?? ""),
          engine: args.engine as never,
          version: args.version as string | undefined,
          dependencies: args.dependencies as string[] | undefined,
          license: String(args.license ?? ""),
          author: String(args.author ?? ""),
          sourceUrl: args.sourceUrl as string | undefined,
          attribution: args.attribution as string | undefined,
          origin: args.origin as never,
          createdBy: args.createdBy as never,
        }),
    },
    {
      name: PACKAGE_GRAPH_TOOL,
      title: "Package Graph",
      description:
        "Gamos game platform: read the world's package graph — nodes with validation status and engine compatibility, dependency edges, and unresolved dependencies.",
      inputSchema: z.object({ worldId: worldIdField }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      handler: async (args, context) => {
        const files = await context.store.requireWorld(await resolveId(context, args));
        return packageGraph(files);
      },
    },
    {
      name: PACKAGE_VALIDATE_TOOL,
      title: "Validate Packages",
      description:
        "Gamos game platform: re-run the asset intake validation (rights, provenance, engine compatibility, file existence, dependency resolution) for one package or all packages of a world.",
      inputSchema: z.object({
        worldId: worldIdField,
        packageId: z.string().optional().describe("Package id or name. Defaults to all packages."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      handler: async (args, context) =>
        refreshPackageValidation(
          context.store,
          context.workspaceRoot,
          await resolveId(context, args),
          args.packageId as string | undefined,
        ),
    },
    {
      name: BUILD_RECORD_TOOL,
      title: "Record Build",
      description:
        "Gamos game platform: record a game build for a world and target profile. Computes a sha256 digest of the artifact when not provided (provenance for playtest evidence and release gates).",
      inputSchema: z.object({
        worldId: worldIdField,
        engine: z.enum(GAME_ENGINES).optional(),
        engineVersion: z.string().optional(),
        target: z.string().min(1).describe("Target profile, for example browser-desktop."),
        artifactPath: z.string().min(1).describe("Workspace-relative path of the build artifact (for example dist/game.html)."),
        entryPoint: z.string().optional().describe("Playable entry point if different from artifactPath."),
        digest: z.string().optional().describe("Precomputed digest (sha256:...). Otherwise computed from the artifact."),
        notes: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      handler: async (args, context) =>
        recordBuild(context.store, context.workspaceRoot, await resolveId(context, args), {
          engine: args.engine as never,
          engineVersion: args.engineVersion as string | undefined,
          target: String(args.target ?? ""),
          artifactPath: String(args.artifactPath ?? ""),
          entryPoint: args.entryPoint as string | undefined,
          digest: args.digest as string | undefined,
          notes: args.notes as string | undefined,
        }),
    },
    {
      name: PLAYTEST_RECORD_TOOL,
      title: "Record Playtest Evidence",
      description:
        "Gamos game platform: record playtest evidence for a build — scenario (smoke/core-loop/full), steps, screenshots, metrics (fps, loadMs, crashes, errors), issues with severity, and the verdict. Evidence is bound to the build digest so reports stay comparable and traceable.",
      inputSchema: z.object({
        worldId: worldIdField,
        buildId: z.string().optional().describe("Build id. Defaults to the latest build."),
        mode: z.enum(["browser-use", "engine-adapter", "manual"]).optional(),
        scenario: z.enum(["smoke", "core-loop", "full"]),
        steps: z
          .array(
            z.object({
              action: z.string(),
              target: z.string().optional(),
              status: z.enum(["pass", "fail"]),
              detail: z.string().optional(),
            }),
          )
          .optional(),
        screenshots: z.array(z.string()).optional().describe("Workspace-relative screenshot paths."),
        metrics: z
          .object({ fps: z.number().optional(), loadMs: z.number().optional(), crashes: z.number().optional(), errors: z.number().optional() })
          .optional(),
        issues: z
          .array(
            z.object({
              severity: z.enum(["blocker", "major", "minor"]),
              description: z.string(),
              evidence: z.string(),
            }),
          )
          .optional(),
        verdict: z.enum(["pass", "fail", "inconclusive"]),
        durationMs: z.number().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      handler: async (args, context) =>
        recordPlaytest(context.store, await resolveId(context, args), {
          buildId: args.buildId as string | undefined,
          mode: args.mode as never,
          scenario: args.scenario as never,
          steps: args.steps as never,
          screenshots: args.screenshots as string[] | undefined,
          metrics: args.metrics as never,
          issues: args.issues as never,
          verdict: args.verdict as never,
          durationMs: args.durationMs as number | undefined,
        }),
    },
    {
      name: PLAYTEST_REPORT_TOOL,
      title: "Playtest Report",
      description:
        "Gamos game platform: aggregated playtest report per build — run counts, pass rate, latest verdict, average fps and load time, open blocker/major issues.",
      inputSchema: z.object({ worldId: worldIdField }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      handler: async (args, context) => {
        const files = await context.store.requireWorld(await resolveId(context, args));
        return playtestReport(files);
      },
    },
    {
      name: RELEASE_GATE_CHECK_TOOL,
      title: "Check Release Gates",
      description:
        "Gamos game platform: evaluate the five release gates (gameir-complete, packages-validated, build-exists, playtest-evidence, user-approval) and persist the latest report. Publishing requires all gates green.",
      inputSchema: z.object({ worldId: worldIdField }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      handler: async (args, context) => checkGates(context.store, await resolveId(context, args)),
    },
    {
      name: RELEASE_REQUEST_APPROVAL_TOOL,
      title: "Request Release Approval",
      description:
        "Gamos game platform: request user approval to publish the world. The request appears in the Gamos Console; only the user can grant it (the agent cannot self-approve).",
      inputSchema: z.object({ worldId: worldIdField, notes: z.string().optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      handler: async (args, context) =>
        requestApproval(context.store, await resolveId(context, args), args.notes as string | undefined),
    },
    {
      name: RELEASE_APPROVE_TOOL,
      title: "Approve Release",
      description:
        "Gamos Console only: grant a pending release approval. This tool is not exposed to the model; the user approves from the Gamos Console panel.",
      inputSchema: z.object({
        worldId: worldIdField,
        approvalId: z.string().optional().describe("Approval id. Defaults to the latest pending approval."),
        notes: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      appOnly: true,
      handler: async (args, context) =>
        approveRelease(
          context.store,
          await resolveId(context, args),
          args.approvalId as string | undefined,
          args.notes as string | undefined,
        ),
    },
    {
      name: WORLD_PUBLISH_TOOL,
      title: "Publish World",
      description:
        "Gamos game platform: publish the world to its release record. Requires all five release gates green including explicit user approval; otherwise returns gates_failed with the gate details. Records version, channel, build digest, gate snapshot and approval reference.",
      inputSchema: z.object({
        worldId: worldIdField,
        version: z.string().optional().describe("Semantic version. Defaults to bumping the patch of the last publication (0.1.0 first)."),
        channel: z.enum(["preview", "stable"]).optional().describe("Release channel. Defaults to preview."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      handler: async (args, context) =>
        publishWorld(context.store, await resolveId(context, args), {
          version: args.version as string | undefined,
          channel: args.channel as never,
        }),
    },
    {
      name: WORLD_ATLAS_TOOL,
      title: "World Atlas",
      description:
        "Gamos game platform: generate the World Atlas — a read-only projection of the GameIR and package graph: gameplay systems with owning packages, level graph, asset inventory by type, dependencies, known blocker/major issues, decision timeline and performance constraints.",
      inputSchema: z.object({ worldId: worldIdField }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      handler: async (args, context) => {
        const files = await context.store.requireWorld(await resolveId(context, args));
        return worldAtlas(files);
      },
    },
    {
      name: WORLD_USAGE_TOOL,
      title: "World Usage",
      description:
        "Gamos game platform: per-world usage and cost analytics — counts of mechanics, levels, packages, builds, playtests and publications, playtest verdict breakdown, and last-activity timestamps.",
      inputSchema: z.object({ worldId: worldIdField }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      handler: async (args, context) => {
        const files = await context.store.requireWorld(await resolveId(context, args));
        return worldUsage(files);
      },
    },
  ];
}

async function resolveId(context: ToolContext, args: Record<string, unknown>): Promise<string> {
  return context.store.resolveWorldId(args.worldId as string | undefined);
}

export { toolJsonSchema };
