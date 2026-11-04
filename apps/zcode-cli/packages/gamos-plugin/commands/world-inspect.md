---
description: Inspect the active (or a named) game world: GameIR, packages, builds, playtests, release gates.
argument-hint: "[world id or name]"
skills: gamos-platform
---

Use the gamos platform skill for this request:

$ARGUMENTS

Steps:

1. Resolve the world: if an argument was given, match it against `world_list` (id or name); otherwise use the active world.
2. Call `world_inspect` (ToolSearch query "gamos world inspect" if the tool is deferred).
3. Present a compact report:
   - World identity: name, id, genre, engine (version), targets, status.
   - GameIR: version, core loop, mechanic/level counts, win/lose conditions, performance budget.
   - Packages: counts by validation status; list invalid/pending ones with what is missing.
   - Builds: latest build (target, digest prefix, test status).
   - Playtests: latest verdict and open blocker/major issues.
   - Release gates: the five gates with pass/fail and detail.
4. End with the single most useful next action (what blocks progress toward a release).

If no world exists, say so and suggest `/spark-create` to make a playable game from scratch.
