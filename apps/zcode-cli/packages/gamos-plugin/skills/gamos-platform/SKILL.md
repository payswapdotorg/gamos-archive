---
name: gamos-platform
description: "Use when working on ANY game development task in this workspace with the gamos platform: explains the World/GameIR model, the gamos tool surface (worlds, packages, playtest evidence, builds, release gates, atlas, usage), the specialist agents, and the rules (never hand-edit .gamos/, evidence over self-assessment, user-only release approval). Start here for game requests."
---

# Gamos platform guide

Gamos is the game-native layer over this coding agent: a **World** (a playable game project with a stable id, engine binding and target profiles) whose definition is a versioned **GameIR**, composed of **packages** (assets/mechanics with rights and provenance), verified by recorded **playtest evidence**, and shipped through **release gates** with explicit user approval.

## The model

- **World** — `draft → in-development → playable → released`. One workspace can hold several; one is *active* (injected into every session's context).
- **GameIR** — core loop, mechanics, levels (a graph), progression, economy, art direction, controls, win/lose conditions, performance budget. The authoritative definition of the game; replaced atomically via `world_update` (version bumps).
- **Packages** — asset/mechanic units with `rights` (license, author, sourceUrl, attribution) and `provenance` (original/generated/imported; agent/user). Must pass intake validation to count as releasable.
- **Playtest evidence** — runs bound to a build digest: steps, screenshots, metrics, issues, verdict. Reports of "done" cite evidence.
- **Release gates** — `gameir-complete`, `packages-validated`, `build-exists`, `playtest-evidence`, `user-approval`. All five must be green to publish. Approval is granted only by the user in the Gamos Console.

## The tools (ToolSearch "gamos" when deferred; model-visible names start with `mcp__plugin_gamos_gamos__`)

- Worlds: `world_create`, `world_list`, `world_inspect`, `world_set_active`, `world_update`
- Packages: `package_register`, `package_graph`, `package_validate`
- Evidence: `build_record`, `playtest_record`, `playtest_report`
- Release: `release_gate_check`, `release_request_approval`, `world_publish` (`release_approve` is panel-only)
- Insight: `world_atlas`, `world_usage`

All tools return `{ data }` or `{ error: { code, message } }`; `gates_failed` includes the gate details — treat them as a worklist.

## The specialists (dispatch as subagents)

`game-designer` (GameIR), `gameplay-engineer` (implementation), `level-designer` (levels/pacing), `asset-specialist` (assets/rights), `engine-specialist` (engine binding/exports), `qa-playtester` (evidence), `performance-analyst` (budgets), `build-release-engineer` (gates/publishing).

## Rules

1. **Never hand-edit `.gamos/`** — all state goes through the gamos tools.
2. **Evidence over self-assessment** — a mechanic "works" when a recorded playtest says so.
3. **References are not assets** — image-search results are research; production assets need rights and provenance.
4. **Never self-approve a release** — request approval; the user approves in the Gamos Console.
5. **Keep upstream behavior** — gamos composes with the normal task/session/model/plugin machinery; it replaces none of it.

## Typical flows

- Idea → playable: `/spark-create`
- Check state: `/world-inspect`
- Verify: `/game-playtest`
- Audit assets: `/asset-audit`
- Performance: `/performance-check`
- Ship: `/prepare-release`
- Multi-agent pipelines: see the `gamos-workflows` skill for Dynamic Workflow templates (create-world, asset-intake, game-qa, prepare-release).
