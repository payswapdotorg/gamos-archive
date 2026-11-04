---
description: Run a structured playtest of the active world's latest build and record the evidence.
argument-hint: "[scenario: smoke | core-loop | full]"
skills: gamos-playtest
---

Use the gamos-playtest skill for this request:

$ARGUMENTS

Steps:

1. Inspect the world and confirm a recorded build exists (`world_inspect`). No build → stop and explain that playtests bind to build digests.
2. Run the requested scenario (default `core-loop`) against the build's entry point:
   - Load the game, exercise every declared control, attempt the win path and the lose path.
   - Capture screenshots at key moments; note console errors and load time.
3. Record the evidence with `playtest_record`: steps, screenshots, metrics (fps, loadMs, crashes, errors), issues with severity, and the honest verdict.
4. Summarize: verdict, failed steps (reproducible), open issues, and whether the release gate `playtest-evidence` is now green for this build.

Browser automation proves UI flow, not sustained GPU performance — label fps numbers accordingly.
