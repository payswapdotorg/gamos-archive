---
description: Drive the world to release readiness: gate check, fixes, approval request, publish when green.
argument-hint: "[version, e.g. 1.0.0]"
skills: gamos-release
---

Use the gamos-release skill for this request:

$ARGUMENTS

Steps:

1. Run `release_gate_check` on the active world and read all five gates.
2. For every red gate, do the work (do not route around it):
   - `gameir-complete` — complete the GameIR with the game designer.
   - `packages-validated` — fix packages with the asset specialist (`/asset-audit`).
   - `build-exists` — build the game and `build_record` it.
   - `playtest-evidence` — get a passing recorded playtest (`/game-playtest`).
3. When gates are green: `release_request_approval`, then ask the user to approve in the **Gamos Console** panel. Never self-approve.
4. After the user approves, call `world_publish` (version from the argument, channel preview unless the user said stable) and report the publication record: version, channel, build digest, gate snapshot.

A `gates_failed` result is a worklist, not an error to retry.
