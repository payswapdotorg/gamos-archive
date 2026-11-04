import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { WorkspaceRegistry, WorldFiles } from "../gameos/types.js";
import { GAMOS_STATE_DIR } from "../contract.js";

const WORLD_FILES = ["world.json", "gameir.json", "packages.json", "builds.json", "playtests.json", "releases.json"] as const;

/**
 * `.gamos/` 文件态存取：唯一事实源（规格 §2）。写入原子（temp + rename）；
 * 目录缺失视为"工作区尚无 Gamos 项目"，读取返回空态而不是错误。
 * `rootOverride` 供测试注入临时目录。
 */
export class GameOSStore {
  constructor(
    private readonly workspaceRoot: string,
    private readonly rootOverride?: string,
  ) {}

  get stateRoot(): string {
    return this.rootOverride ?? join(this.workspaceRoot, GAMOS_STATE_DIR);
  }

  async registry(): Promise<WorkspaceRegistry> {
    const raw = await this.readJson("gamos.json");
    if (raw === undefined) return { schemaVersion: 1, activeWorldId: null };
    if (typeof raw.activeWorldId !== "string" && raw.activeWorldId !== null) {
      throw new Error("gamos.json: activeWorldId must be a string or null");
    }
    return { schemaVersion: 1, activeWorldId: raw.activeWorldId ?? null };
  }

  async saveRegistry(registry: WorkspaceRegistry): Promise<void> {
    await this.writeJson("gamos.json", registry);
  }

  async worldIds(): Promise<string[]> {
    const entries = await safeReaddir(join(this.stateRoot, "worlds"));
    const ids: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      if (!WORLD_FILES.every((file) => entry.files.includes(file))) continue;
      ids.push(entry.name);
    }
    return ids.sort();
  }

  async loadWorld(worldId: string): Promise<WorldFiles | undefined> {
    const [world, gameir, packages, builds, playtests, releases] = await Promise.all(
      WORLD_FILES.map((file) => this.readJson(join("worlds", worldId, file))),
    );
    if (world === undefined) return undefined;
    return {
      world: world as unknown as WorldFiles["world"],
      gameir: gameir as unknown as WorldFiles["gameir"],
      packages: (packages ?? { packages: [] }) as WorldFiles["packages"],
      builds: (builds ?? { builds: [] }) as WorldFiles["builds"],
      playtests: (playtests ?? { playtests: [] }) as WorldFiles["playtests"],
      releases: (releases ?? { approvals: [], publications: [] }) as WorldFiles["releases"],
    };
  }

  async requireWorld(worldId: string): Promise<WorldFiles> {
    const files = await this.loadWorld(worldId);
    if (files === undefined) throw new GamosStateError("not_found", `World not found: ${worldId}`);
    return files;
  }

  async saveWorldFiles(worldId: string, files: Partial<WorldFiles>): Promise<void> {
    const dir = join("worlds", worldId);
    await mkdir(join(this.stateRoot, dir), { recursive: true });
    const writes: Promise<void>[] = [];
    if (files.world) writes.push(this.writeJson(join(dir, "world.json"), files.world));
    if (files.gameir) writes.push(this.writeJson(join(dir, "gameir.json"), files.gameir));
    if (files.packages) writes.push(this.writeJson(join(dir, "packages.json"), files.packages));
    if (files.builds) writes.push(this.writeJson(join(dir, "builds.json"), files.builds));
    if (files.playtests) writes.push(this.writeJson(join(dir, "playtests.json"), files.playtests));
    if (files.releases) writes.push(this.writeJson(join(dir, "releases.json"), files.releases));
    await Promise.all(writes);
  }

  async activeWorldId(): Promise<string | null> {
    const registry = await this.registry();
    if (registry.activeWorldId && (await this.loadWorld(registry.activeWorldId)) === undefined) {
      return null;
    }
    return registry.activeWorldId;
  }

  async setActiveWorld(worldId: string): Promise<void> {
    await this.saveRegistry({ schemaVersion: 1, activeWorldId: worldId });
  }

  /** 解析 worldId：显式传入 > 活动 World > 唯一 World；否则报 not_found。 */
  async resolveWorldId(worldId?: string): Promise<string> {
    if (worldId) return worldId;
    const active = await this.activeWorldId();
    if (active) return active;
    const ids = await this.worldIds();
    if (ids.length === 1) return ids[0] as string;
    const hint =
      ids.length === 0
        ? "no worlds exist yet; create one with world_create"
        : `multiple worlds exist (${ids.join(", ")}); pass worldId or set an active world`;
    throw new GamosStateError("not_found", `Cannot resolve world: ${hint}`);
  }

  private async readJson(relative: string): Promise<Record<string, unknown> | undefined> {
    try {
      const content = await readFile(join(this.stateRoot, relative), "utf8");
      return JSON.parse(content) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new GamosStateError("state_corrupt", `Cannot read ${relative}: ${(error as Error).message}`);
    }
  }

  private async writeJson(relative: string, value: unknown): Promise<void> {
    const target = join(this.stateRoot, relative);
    const temp = `${target}.${randomBytes(4).toString("hex")}.tmp`;
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, target);
  }
}

/** 领域错误：code 直接映射到工具结果信封的 `error.code`。 */
export class GamosStateError extends Error {
  constructor(
    readonly code: "artifact_missing" | "not_found" | "state_corrupt",
    message: string,
  ) {
    super(message);
    this.name = "GamosStateError";
  }
}

interface DirEntry {
  name: string;
  isDirectory: boolean;
  files: string[];
}

async function safeReaddir(root: string): Promise<DirEntry[]> {
  try {
    const dirents = await readdir(root, { withFileTypes: true });
    const entries: DirEntry[] = [];
    for (const dirent of dirents) {
      if (!dirent.isDirectory()) continue;
      let files: string[] = [];
      try {
        files = (await readdir(join(root, dirent.name))).filter((file) => !file.startsWith("."));
      } catch {
        files = [];
      }
      entries.push({ name: dirent.name, isDirectory: dirent.isDirectory(), files });
    }
    return entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
