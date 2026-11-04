---
description: Check the world against its performance budget using recorded playtest evidence.
argument-hint: "[world id or name]"
skills: gamos-performance
---

Use the gamos-performance skill for this request:

$ARGUMENTS

Steps:

1. Resolve the world and read the GameIR performance budget (`world_inspect`: targetFps, maxLoadMs per constraints).
2. Read the evidence history (`playtest_report`): avg fps, avg loadMs, per build.
3. Compare budget vs. actual per build; identify regressions between builds.
4. Investigate causes with evidence: artifact size, asset counts from the package graph, entity counts from levels, console/network observations.
5. Report: budget vs. actual table, regressions, prioritized concrete recommendations (compress/defer/cap), and — if the budget is unrealistic for the target — a proposed revised budget to apply via `world_update`.

Every claim cites measured evidence. Label browser-measured numbers as load/interaction measurements, not sustained GPU throughput.
