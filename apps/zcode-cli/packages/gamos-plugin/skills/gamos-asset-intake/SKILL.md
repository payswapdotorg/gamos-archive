---
name: gamos-asset-intake
description: "Use for producing, sourcing, converting or auditing game assets in a gamos world: the asset intake contract (rights, provenance, engine compatibility, file existence, dependency resolution), the reference-vs-production distinction, and the audit flow that makes a world's package graph releasable."
---

# Asset intake (rights & provenance)

## The contract

Every production asset is a **package** that must pass intake validation before it can enter a released world:

| Check | Requirement |
| --- | --- |
| `rights-metadata` | `license` + `author` (and `sourceUrl` for anything imported) |
| `provenance` | `origin` (original/generated/imported) + `createdBy` (agent/user) |
| `engine-compat` | package engine matches the world engine (or `*`) |
| `file-exists` | the registered path exists in the workspace |
| `deps-resolve` | all dependencies resolve inside the graph |

## Reference vs. production

A reference image (from image search or user attachment) guides style — it is **research**. It becomes a production asset only after: rights are confirmed (license + author + sourceUrl recorded), or it is replaced by an original/generated asset. Never silently ship a reference as an asset; never present third-party work as original.

## Registering

`package_register`: `name` (unique in world), `type` (asset-3d / asset-texture / asset-audio / asset-animation / mechanic / ui / shader / level), `path` (workspace-relative), `license`, `author`, `sourceUrl` (imports), `origin`, `createdBy`. Validation runs immediately; read the result.

## Producing assets

Dispatch the `asset-specialist` subagent for creation/conversion (GLB/GLTF, textures, audio, animation). Prefer fewer, well-licensed assets. Generated assets: `origin: "generated"`, `createdBy: "agent"`. User-supplied: `createdBy: "user"`, ask for license if unknown.

## Auditing (`/asset-audit`)

1. `package_graph` → nodes, edges, unresolved deps.
2. `package_validate` (all) → failures are the worklist.
3. Fix: add missing rights from known sources (ask the user when unclear), correct paths, register forgotten assets, re-validate.
4. Report a table (package / type / license / validation / missing) and the verdict: will `packages-validated` pass?

## Rules

- Never fabricate rights metadata; unknown rights stay `invalid` until resolved.
- Never hand-edit `.gamos/`.
- Large binaries belong in the workspace (e.g. `assets/`), referenced by path — the package registry holds metadata, not bytes.
