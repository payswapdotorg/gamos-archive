---
name: gamos-performance
description: "Use for performance work in a gamos world: reading the GameIR performance budget, comparing it against recorded playtest metrics per build, investigating regressions with evidence (artifact size, asset/entity counts, load behavior), and producing prioritized, concrete optimization recommendations."
---

# Performance (budget vs. evidence)

## The budget

Every GameIR carries `constraints.performance`: `targetFps` (default 60) and `maxLoadMs` (default 3000), per world (refine per target profile in `controls`/levels when needed). The budget is a design commitment — treat it like a mechanic.

## The evidence

`playtest_report` aggregates recorded runs per build: avg fps, avg loadMs, pass rate, open issues. Performance claims cite these numbers, or artifact measurements — never "feels fine".

## The flow

1. **Read** — `world_inspect` (budget) + `playtest_report` (actuals).
2. **Compare** — budget vs. actual per build; flag regressions build-over-build.
3. **Investigate** with evidence:
   - Artifact size (single-file HTML grows silently; large textures inline as base64).
   - Package graph: asset counts, oversized types.
   - Levels: entity counts vs. assumptions.
   - Load behavior via Browser Use: network waterfall, blocking scripts, console timing.
4. **Recommend**, concretely and prioritized: "compress hero texture (2.1MB → ≤300KB)", "defer audio decode until first input", "cap concurrent entities at 40". Each with expected impact.
5. **Fix or re-budget** — apply code fixes (dispatch `gameplay-engineer`), or, when the target cannot meet the budget, propose a revised budget through `world_update` and say why.

## Measurement honesty

- Browser-measured fps is an observation of a run, not sustained GPU throughput; sustained claims need engine-level profiling (route to `engine-specialist`).
- loadMs is comparable only against the same target profile.
- A regression introduced between two builds must name the delta (new package, new level, bigger artifact).

## Rules

- Never hand-edit `.gamos/`; budgets change via `world_update` only.
- Report format: budget vs. actual table → regressions → prioritized recommendations → proposed budget change (if any).
