---
name: gamos-world-creation
description: "Use when creating a new game World or evolving an existing one's GameIR: the end-to-end world creation flow (concept → GameIR → engine binding → target profiles → initial packages), with concrete quality bars for each GameIR field and how to record everything through the gamos tools."
---

# World creation (GameIR-driven)

## 1. Create the World

`world_create` with: a distinct `name`, `genre`, one-paragraph `description`, `engine` (default `web`; use `engineVersion` like `three.js r170 (CDN)`), and `targetProfiles` (e.g. `["browser-desktop", "browser-mobile"]`). The first world in a workspace becomes active automatically; otherwise `world_set_active`.

## 2. Author the GameIR

Every field has a quality bar:

| Field | Bar |
| --- | --- |
| `coreLoop` | 3–6 verbs, compounding (Run → Dodge → Collect → Upgrade) |
| `mechanics[]` | id `mec_<slug>`; rules contain numbers (cooldowns, ranges, speeds) — testable |
| `levels[]` | id `lvl_<slug>`; a connected graph via entry/exit; difficulty 1–5; each exercises listed mechanics |
| `progression` | model + description (score/upgrade/unlock) |
| `economy` (optional) | currency with explicit sources and sinks, bounded |
| `artDirection` | style, palette, reference *descriptions* |
| `controls[]` | per target profile, explicit mappings (action → input) |
| `winCondition` / `loseCondition` | concrete and testable ("Survive 90s", not "do well") |
| `constraints.performance` | targetFps (60) and maxLoadMs (3000) defaults; adjust per target |

Dispatch the `game-designer` subagent for non-trivial designs. Record with `world_update` `{ gameIr }` (complete replacement; version bumps automatically). Re-read with `world_inspect` to confirm.

## 3. Initial packages

Register what the world is made of (`package_register`): mechanic modules, level content, core assets — each with rights (agent-created code: license of the project, author) and provenance (`original`/`agent`). Run `package_validate` and fix failures.

## 4. First build + smoke

Build the runnable artifact (web default: single self-contained HTML, CDN libs) and `build_record` it, then run a smoke playtest (`/game-playtest smoke`). A world without evidence is a draft, whatever the code looks like.

## Rules

- Never hand-edit `.gamos/` — every change flows through the tools.
- If a design changes mid-flight, update the GameIR **before** the code so mechanics keep tracing to declarations.
- World identity is stable (ids don't change); names can.
- For the full multi-agent pipeline, see the `create-world` workflow template in the `gamos-workflows` skill.
