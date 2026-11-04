import { randomBytes } from "node:crypto";

/** 稳定 ID：前缀 + 随机 hex。World 身份与目录名解耦（规格 §2.1）。 */
export function newId(prefix: string, bytes = 6): string {
  return `${prefix}_${randomBytes(bytes).toString("hex")}`;
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "world";
}

export function nowIso(): string {
  return new Date().toISOString();
}
