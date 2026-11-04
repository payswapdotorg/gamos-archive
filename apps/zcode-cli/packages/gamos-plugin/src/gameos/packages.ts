import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { GamePackage, PackageType, PackageValidationCheck, World, WorldFiles } from "./types.js";
import { PACKAGE_TYPES } from "./types.js";
import { newId, nowIso } from "../lib/ids.js";
import { GameOSStore } from "../lib/store.js";

/**
 * 包图与 intake 校验（规格 §2.3 / §3）：
 * 权利元数据（license+author）、出处、引擎兼容、文件存在、依赖可解析。
 * 任一 fail ⇒ 包 invalid ⇒ 发布门禁 packages-validated 不过。
 */

export interface RegisterPackageInput {
  name: string;
  type: PackageType;
  path: string;
  engine?: GamePackage["engine"];
  version?: string;
  dependencies?: string[];
  license: string;
  author: string;
  sourceUrl?: string;
  attribution?: string;
  origin?: GamePackage["provenance"]["origin"];
  createdBy?: GamePackage["provenance"]["createdBy"];
}

export async function registerPackage(
  store: GameOSStore,
  workspaceRoot: string,
  worldId: string,
  input: RegisterPackageInput,
): Promise<GamePackage> {
  const files = await store.requireWorld(worldId);
  if (!input.name?.trim()) throw new Error("name is required");
  if (!PACKAGE_TYPES.includes(input.type)) {
    throw new Error(`type must be one of: ${PACKAGE_TYPES.join(", ")}`);
  }
  if (!input.path?.trim()) throw new Error("path is required (workspace-relative)");
  if (files.packages.packages.some((pkg) => pkg.name === input.name.trim())) {
    throw new Error(`package name already registered: ${input.name.trim()}`);
  }
  const pkg: GamePackage = {
    id: newId("pkg", 5),
    name: input.name.trim(),
    version: input.version?.trim() || "1.0.0",
    type: input.type,
    path: input.path.trim(),
    engine: input.engine ?? files.world.engine,
    dependencies: input.dependencies ?? [],
    rights: {
      license: input.license?.trim() ?? "",
      author: input.author?.trim() ?? "",
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
      ...(input.attribution ? { attribution: input.attribution } : {}),
    },
    provenance: {
      origin: input.origin ?? "original",
      createdBy: input.createdBy ?? "agent",
    },
    validation: { status: "pending", checks: [], validatedAt: "" },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  pkg.validation = validatePackage(pkg, files.packages.packages, files.world);
  pkg.validation.validatedAt = nowIso();
  files.packages.packages.push(pkg);
  await store.saveWorldFiles(worldId, { packages: files.packages });
  return pkg;
}

export function validatePackage(
  pkg: GamePackage,
  all: GamePackage[],
  world: World,
): GamePackage["validation"] {
  const checks: PackageValidationCheck[] = [];
  const pass = (check: PackageValidationCheck["check"], detail: string) =>
    checks.push({ check, status: "pass", detail });
  const fail = (check: PackageValidationCheck["check"], detail: string) =>
    checks.push({ check, status: "fail", detail });

  if (pkg.rights.license && pkg.rights.author) {
    pass("rights-metadata", `license=${pkg.rights.license}; author=${pkg.rights.author}`);
  } else {
    fail(
      "rights-metadata",
      "rights.license and rights.author are required before this package can enter a released world",
    );
  }

  if (pkg.provenance.origin && pkg.provenance.createdBy) {
    pass("provenance", `origin=${pkg.provenance.origin}; createdBy=${pkg.provenance.createdBy}`);
  } else {
    fail("provenance", "provenance.origin and provenance.createdBy are required");
  }

  if (pkg.engine === "*" || pkg.engine === world.engine) {
    pass("engine-compat", `package engine ${pkg.engine} matches world engine ${world.engine}`);
  } else {
    fail("engine-compat", `package engine ${pkg.engine} does not match world engine ${world.engine}`);
  }

  checks.push({ check: "file-exists", status: "warn", detail: `pending check for ${pkg.path}` });

  const unknown = pkg.dependencies.filter((dep) => !all.some((other) => other.id === dep || other.name === dep));
  if (unknown.length === 0) {
    pass("deps-resolve", `${pkg.dependencies.length} dependency(ies) resolved`);
  } else {
    fail("deps-resolve", `unresolved dependencies: ${unknown.join(", ")}`);
  }

  const failed = checks.filter((check) => check.status === "fail");
  return { status: failed.length > 0 ? "invalid" : "valid", checks, validatedAt: "" };
}

/** 重跑校验（含文件存在检查）。单个包或全部。 */
export async function refreshPackageValidation(
  store: GameOSStore,
  workspaceRoot: string,
  worldId: string,
  packageId?: string,
): Promise<GamePackage[]> {
  const files = await store.requireWorld(worldId);
  const targets = packageId
    ? files.packages.packages.filter((pkg) => pkg.id === packageId || pkg.name === packageId)
    : files.packages.packages;
  if (packageId && targets.length === 0) {
    throw new Error(`package not found: ${packageId}`);
  }
  for (const pkg of targets) {
    const validation = validatePackage(pkg, files.packages.packages, files.world);
    const fileCheck = await checkFileExists(workspaceRoot, pkg.path);
    validation.checks = validation.checks.map((check) =>
      check.check === "file-exists" ? fileCheck : check,
    );
    if (validation.status === "valid" && fileCheck.status === "fail") validation.status = "invalid";
    validation.validatedAt = nowIso();
    pkg.validation = validation;
    pkg.updatedAt = nowIso();
  }
  await store.saveWorldFiles(worldId, { packages: files.packages });
  return targets;
}

async function checkFileExists(workspaceRoot: string, relativePath: string): Promise<PackageValidationCheck> {
  try {
    const info = await stat(join(workspaceRoot, relativePath));
    if (!info.isFile()) {
      return { check: "file-exists", status: "fail", detail: `not a file: ${relativePath}` };
    }
    return {
      check: "file-exists",
      status: "pass",
      detail: `${relativePath} (${info.size} bytes)`,
    };
  } catch {
    return {
      check: "file-exists",
      status: "fail",
      detail: `file not found in workspace: ${relativePath}`,
    };
  }
}

export function packageGraph(files: WorldFiles): {
  nodes: { id: string; name: string; type: PackageType; validation: string; engine: string }[];
  edges: { from: string; to: string }[];
  unresolved: string[];
} {
  const byKey = new Map<string, GamePackage>();
  for (const pkg of files.packages.packages) {
    byKey.set(pkg.id, pkg);
    byKey.set(pkg.name, pkg);
  }
  const nodes = files.packages.packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    type: pkg.type,
    validation: pkg.validation.status,
    engine: pkg.engine,
  }));
  const edges: { from: string; to: string }[] = [];
  const unresolved = new Set<string>();
  for (const pkg of files.packages.packages) {
    for (const dep of pkg.dependencies) {
      const target = byKey.get(dep);
      if (target) edges.push({ from: pkg.id, to: target.id });
      else unresolved.add(`${pkg.name} → ${dep}`);
    }
  }
  return { nodes, edges, unresolved: [...unresolved] };
}
