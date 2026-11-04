---
name: gamos-playtest
description: "Use when verifying that a gamos world actually works: the structured playtest flow (smoke / core-loop / full scenarios) using Browser Use against the recorded build, what evidence to capture (steps, screenshots, metrics, issues), how to record it via playtest_record, and the honesty rules for verdicts."
---

# Playtesting (evidence, not self-assessment)

Playtests bind to a **recorded build digest** (`build_record` first). No build → no evidence → no release.

## Scenarios

| Scenario | Covers |
| --- | --- |
| `smoke` | Loads, starts, responds to every declared control, reaches win AND lose paths |
| `core-loop` | The declared core loop completes end-to-end, once per level |
| `full` | Every level, every mechanic, edge cases (reload mid-run, extreme input, both targets) |

## How to run (browser worlds)

Use Browser Use:

1. Navigate to the build's `entryPoint`.
2. Exercise the **declared** controls from the GameIR (not invented ones).
3. Drive to the win condition and the lose condition — both.
4. Screenshot key moments (start, mid-loop, win, lose, any failure).
5. Read actual page state: console errors, load timing, HUD values — not your memory of what you wrote.

## Recording

`playtest_record`: `buildId` (default latest), `scenario`, `steps[]` (action/target/status/detail), `screenshots[]` (paths), `metrics` (fps, loadMs, crashes, errors), `issues[]` (severity blocker/major/minor + evidence), `verdict`, `durationMs`.

## Verdict honesty

- `pass` — every step green, zero blocker/major issues.
- `fail` — any step failed or a blocker/major issue exists. Include reproducible steps.
- `inconclusive` — you could not exercise the scenario; say exactly why.

A failed playtest is a **result**, not a mishap: record it, then route failures to the `gameplay-engineer` with the steps.

## Limits

Browser automation proves UI flow (load, input, state transitions). It does not prove sustained GPU performance — label fps numbers as observations and route depth analysis to the `performance-analyst`. Engine-native runtimes use `mode: "engine-adapter"` evidence from the engine's own tooling.

## Rules

- Never hand-edit `.gamos/`; never fabricate metrics or screenshots.
- After recording, check whether the `playtest-evidence` gate turned green for this build.
