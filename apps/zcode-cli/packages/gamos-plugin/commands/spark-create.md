---
description: Create a small playable game (a Spark) end-to-end: design, build, playtest, evidence.
argument-hint: "[game idea, e.g. a 3D endless runner with coins and mobile controls]"
skills: gamos-spark-design
---

Use the gamos-spark-design skill for this request:

$ARGUMENTS

The goal is a complete create-to-playable loop, not a code snippet:

1. Design — a compact GameIR (core loop, 2–4 mechanics, 1–3 levels, controls per target, win/lose, 60fps budget) recorded via the gamos tools.
2. Build — a browser-runnable, self-contained web game (single HTML, Three.js CDN, no build step).
3. Register — packages for produced assets with rights and provenance; record the build with its digest.
4. Playtest — verify the game actually loads and the core loop works (Browser Use), and record typed evidence with an honest verdict.
5. Report — world id, what is playable, evidence summary, and what is left before release.

Do not skip the playtest step: "the agent says it finished" is not evidence.
