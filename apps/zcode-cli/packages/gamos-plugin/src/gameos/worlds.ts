import type { GameIR, GameEngine, World, WorldFiles, WorldStatus } from "./types.js";
import { GAME_ENGINES, WORLD_STATUSES } from "./types.js";
import { newId, nowIso, slugify } from "../lib/ids.js";
import { GameOSStore } from "../lib/store.js";

/** 世界创建与 GameIR 更新（规格 §3）。GameIR 替换必须经 updateGameIr（version+1）。 */

export interface CreateWorldInput {
  name: string;
  genre?: string;
  description?: string;
  engine?: GameEngine;
  engineVersion?: string;
  targetProfiles?: string[];
}

export interface UpdateWorldInput {
  name?: string;
  genre?: string;
  description?: string;
  engine?: GameEngine;
  engineVersion?: string;
  targetProfiles?: string[];
  status?: WorldStatus;
  gameIr?: GameIR;
}

export function emptyGameIr(): GameIR {
  return {
    version: 1,
    coreLoop: [],
    mechanics: [],
    levels: [],
    progression: { model: "", description: "" },
    artDirection: { style: "", palette: [], references: [] },
    controls: [],
    winCondition: "",
    loseCondition: "",
    constraints: { performance: { targetFps: 60, maxLoadMs: 3000 } },
  };
}

export async function createWorld(
  store: GameOSStore,
  input: CreateWorldInput,
  defaults: { engine: GameEngine; target: string },
): Promise<World> {
  if (!input.name?.trim()) throw new Error("name is required");
  const engine = input.engine ?? defaults.engine;
  if (!GAME_ENGINES.includes(engine)) {
    throw new Error(`engine must be one of: ${GAME_ENGINES.join(", ")}`);
  }
  const world: World = {
    id: newId("wld", 6),
    name: input.name.trim(),
    slug: slugify(input.name),
    genre: input.genre?.trim() ?? "",
    description: input.description?.trim() ?? "",
    engine,
    engineVersion: input.engineVersion?.trim() ?? "",
    targetProfiles: input.targetProfiles?.length ? input.targetProfiles : [defaults.target],
    status: "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await store.saveWorldFiles(world.id, {
    world,
    gameir: emptyGameIr(),
    packages: { packages: [] },
    builds: { builds: [] },
    playtests: { playtests: [] },
    releases: { approvals: [], publications: [] },
  });
  const activeId = await store.activeWorldId();
  if (activeId === null) await store.setActiveWorld(world.id);
  return world;
}

export async function updateWorld(
  store: GameOSStore,
  worldId: string,
  patch: UpdateWorldInput,
): Promise<World> {
  const files = await store.requireWorld(worldId);
  const world = files.world;
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error("name cannot be empty");
    world.name = patch.name.trim();
    world.slug = slugify(world.name);
  }
  if (patch.genre !== undefined) world.genre = patch.genre.trim();
  if (patch.description !== undefined) world.description = patch.description.trim();
  if (patch.engine !== undefined) {
    if (!GAME_ENGINES.includes(patch.engine)) {
      throw new Error(`engine must be one of: ${GAME_ENGINES.join(", ")}`);
    }
    world.engine = patch.engine;
  }
  if (patch.engineVersion !== undefined) world.engineVersion = patch.engineVersion.trim();
  if (patch.targetProfiles !== undefined) world.targetProfiles = patch.targetProfiles;
  if (patch.status !== undefined) {
    if (!WORLD_STATUSES.includes(patch.status)) {
      throw new Error(`status must be one of: ${WORLD_STATUSES.join(", ")}`);
    }
    world.status = patch.status;
  }
  world.updatedAt = nowIso();
  await store.saveWorldFiles(world.id, { world });
  if (patch.gameIr) {
    const gameir: GameIR = { ...patch.gameIr, version: files.gameir.version + 1 };
    await store.saveWorldFiles(world.id, { gameir });
  }
  return world;
}

export interface WorldSummaryRow {
  id: string;
  name: string;
  slug: string;
  genre: string;
  engine: string;
  status: string;
  targetProfiles: string[];
  gameIrVersion: number;
  packageCount: number;
  buildCount: number;
  playtestCount: number;
  isActive: boolean;
  updatedAt: string;
}

export async function listWorlds(store: GameOSStore): Promise<WorldSummaryRow[]> {
  const activeId = await store.activeWorldId();
  const rows: WorldSummaryRow[] = [];
  for (const id of await store.worldIds()) {
    const files = await store.loadWorld(id);
    if (!files) continue;
    rows.push({
      id: files.world.id,
      name: files.world.name,
      slug: files.world.slug,
      genre: files.world.genre,
      engine: files.world.engine,
      status: files.world.status,
      targetProfiles: files.world.targetProfiles,
      gameIrVersion: files.gameir.version,
      packageCount: files.packages.packages.length,
      buildCount: files.builds.builds.length,
      playtestCount: files.playtests.playtests.length,
      isActive: id === activeId,
      updatedAt: files.world.updatedAt,
    });
  }
  return rows;
}

export async function inspectWorld(store: GameOSStore, worldId: string): Promise<InspectedWorld> {
  const files = await store.requireWorld(worldId);
  const { evaluateGates } = await import("./release.js");
  const gates = evaluateGates(files);
  return {
    world: files.world,
    gameir: files.gameir,
    packages: files.packages,
    builds: files.builds,
    playtests: files.playtests,
    releases: files.releases,
    gates,
  };
}

export interface InspectedWorld extends WorldFiles {
  gates: ReturnType<typeof import("./release.js").evaluateGates>;
}
