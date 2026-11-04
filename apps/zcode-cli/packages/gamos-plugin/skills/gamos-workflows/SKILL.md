---
name: gamos-workflows
description: "Use when a game development request needs a repeatable multi-agent pipeline (create a world, intake assets, QA loop, prepare release): how to install and run the gamos Dynamic Workflow templates (.dwf.ts saved workflows) with typed asks, phases, and evidence artifacts, and when a workflow beats ad-hoc subagent dispatch."
---

# Gamos workflow templates

When a game task is a **pipeline** (fan out over assets, bounded repair loops, gate-then-ship), a Dynamic Workflow beats ad-hoc dispatch: typed asks, phases, journaled/resumable runs, evidence artifacts. Authoring contract: `docs/dynamic-workflow/authoring.md`.

## Installing the templates

The templates ship with this plugin under `scripts/workflows/`. Install into the project so `CreateWorkflow{saved}` finds them:

```
mkdir -p .zcode/workflows
cp "${ZCODE_PLUGIN_ROOT}/scripts/workflows/"*.dwf.ts .zcode/workflows/
```

Then list them with `ListSavedWorkflows` (or the run pane) and start with `CreateWorkflow` `{ "saved": { "name": "create-world", "args": { … } } }`. The user approves the launch window (script, world-run commands, phases, graph) before anything runs.

## The four templates

| Template | What it does | Key args |
| --- | --- | --- |
| `create-world` | designer→reviewer GameIR loop (bounded rounds), then scaffold + build + smoke handoff | `name`, `genre?`, `description?` |
| `asset-intake` | discover candidate assets (glob), fan out per-asset rights/provenance validation, confirm and report | `pattern` (glob), `worldId?` |
| `game-qa` | smoke playtest → triage fan-out → bounded repair→re-verify loop → evidence report | `worldId`, `buildId?` |
| `prepare-release` | gate check → package audit sweep → evidence bundle → approval request → publish if approved | `worldId`, `version?`, `channel?` |

## How they fit the platform rules

- Workflow actors are subagents with the normal tool surface — world/package/playtest/release state changes go **through the gamos tools**, never direct `.gamos/` writes.
- Publishing inside `prepare-release` still hits the gates and the user-approval boundary; the workflow requests approval and waits, it cannot grant it.
- Evidence and reports surface as workflow artifacts (markdown/metrics) — attach them when reporting.

## When NOT to use a workflow

Single-designer tweaks, one-off questions, or anything a single subagent dispatch answers — workflows earn their cost when there is fan-out, a repair loop, or a gate sequence. Respect the skill gate: load `dynamic-workflows` before using the authoring tools, and prefer `saved` workflows over writing scripts inline.
