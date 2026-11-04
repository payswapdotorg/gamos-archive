---
name: gamos-spark-design
description: "Use when asked to create a small playable game (a Spark) from an idea: the complete idea-to-playable loop — compact GameIR, browser-runnable build (single-file Three.js, no build step), package registration, build recording, real playtest with Browser Use, and typed evidence. A Spark must end playable and evidenced, not just written."
---

# Spark design (idea → playable)

A Spark is a small, complete, playable game. "Complete" means: runs in a browser, core loop works, evidence recorded. Target: playable prototype in one session.

## 1. Design compactly (dispatch `game-designer` for the first pass)

2–4 mechanics, 1–3 levels, one target profile (default `browser-desktop`; add `browser-mobile` with touch controls only if asked). Record the World + GameIR via `world_create` / `world_update`.

Typical Spark GameIR skeleton:

- coreLoop: e.g. ["Run", "Dodge", "Collect"]
- mechanics: e.g. `mec_dash` (2s cooldown), `mec_coins` (collect +1 score)
- levels: `lvl_01` teaching loop in <30s; optional `lvl_02` combining mechanics
- controls: keyboard (WASD/Space/Arrows) or touch (tap zones)
- winCondition / loseCondition: concrete and testable
- constraints: 60fps / 3000ms load budget

## 2. Build for the browser (dispatch `gameplay-engineer`)

House style for web Sparks — one self-contained `index.html`:

- Three.js from CDN (pinned version), no build step, no local server required.
- Game state + input + loop in the single file; scene assembled in code (or inline data).
- A visible HUD (score, win/lose states) — playtests read it.
- Deterministic-enough core loop so failures are reproducible.

## 3. Register and record

- `package_register` for meaningful produced assets (models, textures, level data) — rights + provenance included.
- `build_record` with `artifactPath` (the HTML) and `target` — digest is computed automatically.

## 4. Playtest with evidence (dispatch `qa-playtester`)

Use Browser Use against the entry point: load, exercise declared controls, drive to win and to lose, screenshot key moments, note console errors and load time. Record via `playtest_record` with the honest verdict. Fix and re-test until `pass` or report exactly what blocks it.

## 5. Report

World id · what is playable · evidence summary (verdict, fps, issues) · path to release (which gates remain). Never claim "done" without the recorded verdict.
