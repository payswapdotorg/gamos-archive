---
name: gamos-release
description: "Use for any release/publishing work in a gamos world: the five release gates, how to turn each red gate green, the approval flow (request via tool, grant only by the user in the Gamos Console), publishing via world_publish, and the immutability/anti-bypass rules."
---

# Release (gates, approval, publishing)

## The five gates

| Gate | Green when |
| --- | --- |
| `gameir-complete` | coreLoop + ≥1 mechanic + ≥1 level + win/lose conditions recorded |
| `packages-validated` | ≥1 package and all packages `valid` |
| `build-exists` | a build exists with a digest for the target |
| `playtest-evidence` | the latest build has ≥1 recorded playtest with verdict `pass` |
| `user-approval` | the user granted a pending approval (Gamos Console only) |

`release_gate_check` evaluates and persists the report; `world_inspect` includes it.

## Turning gates green (in order)

1. `gameir-complete` — dispatch `game-designer`; record via `world_update`.
2. `packages-validated` — run `/asset-audit`; fix or remove invalid packages.
3. `build-exists` — build the artifact; `build_record` (digest computed automatically).
4. `playtest-evidence` — run `/game-playtest`; a recorded `pass` for **this** build.
5. `user-approval` — see below.

## The approval boundary

- `release_request_approval` records the request (visible in the Gamos Console).
- **Only the user** grants it, by pressing Approve in the Gamos Console panel. The `release_approve` tool is panel-only — it is not in your tool list, and you must never attempt to self-approve or have another agent approve.
- After asking, stop and tell the user where to click.

## Publishing

When all five gates are green, `world_publish` (optional `version`, default bumps patch from the last publication; `channel` preview|stable). The publication records: version, channel, build digest, the full gate snapshot, and the approval id — release history is immutable evidence.

A `gates_failed` result is a **worklist** (each gate's detail says what is missing), never something to retry or route around. Gates are re-evaluated at publish time: if a new playtest failed or a package went invalid since the last check, publishing is blocked again — by design.

## Rules

- Never hand-edit `.gamos/`; never fabricate builds, digests, evidence or approvals.
- Publishing sets world status to `released`; further changes need a new approval for the next publication.
- For the multi-agent release pipeline, see the `prepare-release` workflow template in the `gamos-workflows` skill.
