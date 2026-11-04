import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameOSStore } from "../src/lib/store.js";
import { createWorld, updateWorld, emptyGameIr } from "../src/gameos/worlds.js";
import { registerPackage, refreshPackageValidation } from "../src/gameos/packages.js";
import { recordBuild, recordPlaytest, playtestReport } from "../src/gameos/evidence.js";
import { checkGates, evaluateGates, publishWorld, requestApproval, worldAtlas } from "../src/gameos/release.js";
import type { WorldFiles } from "../src/gameos/types.js";

let dir: string;
let store: GameOSStore;

async function put(relative: string, content: string): Promise<void> {
  await mkdir(join(dir, relative, ".."), { recursive: true });
  await writeFile(join(dir, relative), content);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gamos-gameos-"));
  store = new GameOSStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("worlds", () => {
  it("creates a world with empty GameIR and sets it active when first", async () => {
    const world = await createWorld(store, { name: "Neon Runner", genre: "endless-runner" }, { engine: "web", target: "browser-desktop" });
    expect(world.id).toMatch(/^wld_/);
    expect(world.status).toBe("draft");
    expect(await store.activeWorldId()).toBe(world.id);
    const files = await store.requireWorld(world.id);
    expect(files.gameir.version).toBe(1);
    expect(files.packages.packages).toHaveLength(0);
  });

  it("bumps GameIR version on replacement", async () => {
    const world = await createWorld(store, { name: "A" }, { engine: "web", target: "browser-desktop" });
    await updateWorld(store, world.id, { gameIr: { ...emptyGameIr(), coreLoop: ["Run"] } });
    const files = await store.requireWorld(world.id);
    expect(files.gameir.version).toBe(2);
    expect(files.gameir.coreLoop).toEqual(["Run"]);
  });

  it("resolveWorldId prefers active, then the single world, else errors", async () => {
    await expect(store.resolveWorldId()).rejects.toThrow(/no worlds exist yet/);
    const a = await createWorld(store, { name: "A" }, { engine: "web", target: "browser-desktop" });
    expect(await store.resolveWorldId()).toBe(a.id);
    const b = await createWorld(store, { name: "B" }, { engine: "web", target: "browser-desktop" });
    expect(await store.resolveWorldId()).toBe(a.id);
    await store.saveRegistry({ schemaVersion: 1, activeWorldId: null });
    await expect(store.resolveWorldId()).rejects.toThrow(/multiple worlds/);
    expect(await store.resolveWorldId(b.id)).toBe(b.id);
  });
});

describe("packages", () => {
  it("validates rights, provenance, engine compatibility and dependencies", async () => {
    const world = await createWorld(store, { name: "A" }, { engine: "web", target: "browser-desktop" });
    await put("assets/coin.glb", "fake-glb");
    const pkg = await registerPackage(store, dir, world.id, {
      name: "coin",
      type: "asset-3d",
      path: "assets/coin.glb",
      license: "CC-BY-4.0",
      author: "Gamos",
    });
    expect(pkg.validation.status).toBe("valid");

    const bad = await registerPackage(store, dir, world.id, {
      name: "mystery",
      type: "asset-texture",
      path: "assets/missing.png",
      license: "",
      author: "",
      dependencies: ["nope"],
    });
    expect(bad.validation.status).toBe("invalid");
    const failedChecks = bad.validation.checks.filter((check) => check.status === "fail").map((check) => check.check);
    expect(failedChecks).toContain("rights-metadata");
    expect(failedChecks).toContain("deps-resolve");
  });

  it("file-exists flips to fail on refresh when the file is gone", async () => {
    const world = await createWorld(store, { name: "A" }, { engine: "web", target: "browser-desktop" });
    await put("assets/x.png", "png");
    const pkg = await registerPackage(store, dir, world.id, {
      name: "x",
      type: "asset-texture",
      path: "assets/x.png",
      license: "MIT",
      author: "Gamos",
    });
    expect(pkg.validation.status).toBe("valid");
    await rm(join(dir, "assets/x.png"));
    const [refreshed] = await refreshPackageValidation(store, dir, world.id, pkg.id);
    expect(refreshed?.validation.status).toBe("invalid");
    expect(refreshed?.validation.checks.find((check) => check.check === "file-exists")?.status).toBe("fail");
  });
});

describe("evidence", () => {
  it("binds playtest evidence to the build digest and derives testStatus", async () => {
    const world = await createWorld(store, { name: "A" }, { engine: "web", target: "browser-desktop" });
    await put("dist/game.html", "<html>game</html>");
    const build = await recordBuild(store, dir, world.id, { target: "browser-desktop", artifactPath: "dist/game.html" });
    expect(build.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    await expect(
      recordPlaytest(store, world.id, { scenario: "smoke", verdict: "pass" }),
    ).resolves.toMatchObject({ buildDigest: build.digest });
    const files = await store.requireWorld(world.id);
    expect(files.builds.builds[0]?.testStatus).toBe("pass");
    expect(playtestReport(files).byBuild[0]?.passes).toBe(1);
  });

  it("rejects playtests without builds and missing artifacts", async () => {
    const world = await createWorld(store, { name: "A" }, { engine: "web", target: "browser-desktop" });
    await expect(recordPlaytest(store, world.id, { scenario: "smoke", verdict: "pass" })).rejects.toThrow(
      /no builds recorded yet/,
    );
    await expect(
      recordBuild(store, dir, world.id, { target: "browser-desktop", artifactPath: "dist/missing.html" }),
    ).rejects.toThrow(/build artifact not found/);
  });
});

describe("release gates", () => {
  it("blocks publishing until every gate is green, then publishes with a snapshot", async () => {
    const world = await createWorld(store, { name: "A" }, { engine: "web", target: "browser-desktop" });
    await updateWorld(store, world.id, {
      gameIr: {
        ...emptyGameIr(),
        coreLoop: ["Run"],
        mechanics: [{ id: "mec_run", name: "Run", description: "run", rules: [] }],
        levels: [{ id: "lvl_1", name: "One", kind: "level", difficulty: 1, mechanics: [], entry: [], exit: [] }],
        winCondition: "survive",
        loseCondition: "hit",
      },
    });
    await put("dist/game.html", "<html>game</html>");
    const build = await recordBuild(store, dir, world.id, { target: "browser-desktop", artifactPath: "dist/game.html" });

    const early = evaluateGates(await store.requireWorld(world.id));
    expect(early.status).toBe("blocked");
    await expect(publishWorld(store, world.id, {})).rejects.toThrow(/gates are not green/);

    await registerPackage(store, dir, world.id, {
      name: "game",
      type: "mechanic",
      path: "dist/game.html",
      license: "MIT",
      author: "Gamos",
    });
    await recordPlaytest(store, world.id, { buildId: build.id, scenario: "smoke", verdict: "pass" });

    const mid = evaluateGates(await store.requireWorld(world.id));
    expect(mid.gates.find((gate) => gate.id === "user-approval")?.status).toBe("fail");
    await expect(publishWorld(store, world.id, {})).rejects.toThrow(/gates are not green/);

    await requestApproval(store, world.id, "first");
    const { approveRelease } = await import("../src/gameos/release.js");
    await approveRelease(store, world.id);

    const report = await checkGates(store, world.id);
    expect(report.status).toBe("green");
    const result = (await publishWorld(store, world.id, { channel: "preview" })) as {
      publication: { version: string; gateReport: { gates: unknown[] }; approvalId: string };
    };
    expect(result.publication.version).toBe("0.1.0");
    expect(result.publication.gateReport.gates).toHaveLength(5);
    expect(result.publication.approvalId).toMatch(/^apr_/);
    const files: WorldFiles = await store.requireWorld(world.id);
    expect(files.world.status).toBe("released");
  });
});

describe("atlas", () => {
  it("projects systems, level graph and assets from GameIR and packages", async () => {
    const world = await createWorld(store, { name: "A" }, { engine: "web", target: "browser-desktop" });
    await updateWorld(store, world.id, {
      gameIr: {
        ...emptyGameIr(),
        coreLoop: ["Run"],
        mechanics: [{ id: "mec_run", name: "Run", description: "run", rules: [] }],
        levels: [
          { id: "lvl_1", name: "One", kind: "level", difficulty: 1, mechanics: ["mec_run"], entry: [], exit: ["lvl_2"] },
          { id: "lvl_2", name: "Two", kind: "level", difficulty: 2, mechanics: ["mec_run"], entry: ["lvl_1"], exit: [] },
        ],
        winCondition: "w",
        loseCondition: "l",
      },
    });
    await registerPackage(store, dir, world.id, {
      name: "run-mechanic",
      type: "mechanic",
      path: "src/run.ts",
      license: "MIT",
      author: "Gamos",
    });
    const atlas = worldAtlas(await store.requireWorld(world.id)) as {
      systems: unknown[];
      levelGraph: { nodes: unknown[]; edges: { from: string; to: string }[] };
    };
    expect(atlas.systems).toHaveLength(1);
    expect(atlas.levelGraph.edges).toEqual([{ from: "lvl_1", to: "lvl_2" }]);
  });
});
