# @zcode/gamos-plugin

Gamos — the game-native platform plugin for ZCode. Evolves the agent into a game development
environment through ZCode's existing extension points (no second agent runtime, no second
permission engine): worlds, GameIR, package graph with rights and provenance, playtest
evidence, release gates with user-only approval, specialist agents, workflow templates,
and the Gamos Console panel.

Specs: [`docs/gamos/2026-11-03-gamos-platform-spec.md`](../../../docs/gamos/2026-11-03-gamos-platform-spec.md) ·
[`gamos-plugin-spec.md`](../../../docs/gamos/gamos-plugin-spec.md) ·
[`gamos-release-gates.md`](../../../docs/gamos/gamos-release-gates.md)

## What's inside

| Area | Contents |
| --- | --- |
| `src/mcp/` | Tool Fabric — 17 GameOS tools (worlds, packages, playtest evidence, builds, release gates, atlas, usage) served over MCP |
| `src/gameos/` | Domain layer: World/GameIR model, package intake validation, evidence, gates, atlas, console state |
| `src/ui/` | Gamos Console panel (`ui://gamos/panel.html`) — world overview, packages, evidence, gates, **user approval** |
| `agents/` | 8 specialist subagents: game-designer, gameplay-engineer, level-designer, asset-specialist, engine-specialist, qa-playtester, performance-analyst, build-release-engineer |
| `skills/` | gamos-platform, gamos-world-creation, gamos-spark-design, gamos-asset-intake, gamos-playtest, gamos-performance, gamos-release, gamos-workflows |
| `commands/` | `/world-inspect` `/spark-create` `/game-playtest` `/asset-audit` `/performance-check` `/prepare-release` |
| `hooks/` | SessionStart world-context injection + PreToolUse release gate on `world_publish` |
| `scripts/workflows/` | Dynamic Workflow templates: `create-world`, `asset-intake`, `game-qa`, `prepare-release` (`.dwf.ts`) |

## State

All GameOS state lives in the workspace under `.gamos/` (managed exclusively by the gamos
tools — never hand-edit). Hooks inject the active world context into every session.

## Release safety

Publishing requires five gates (GameIR complete, packages validated, build exists, passing
playtest evidence, user approval). `release_approve` is panel-only: the agent can request,
only the user can grant — enforced by the host tool list, the server, and a PreToolUse hook.

## Build

```
pnpm --filter @zcode/gamos-plugin build   # dist/mcp/server.js + dist/ui/panel.html
pnpm --filter @zcode/gamos-plugin test
```
