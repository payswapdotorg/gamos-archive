/* zcode-workflow
description: Gamos game QA loop: smoke playtest, triage failures, bounded repair and re-verify, evidence report
whenToUse: when the user asks to QA / verify / playtest a gamos world until it passes
args:
  worldId:
    type: string
    required: false
    description: world id (default active world)
  buildId:
    type: string
    required: false
    description: build id to test (default latest build)
  maxRepairRounds:
    type: number
    required: false
    description: bounded repair attempts (default 3)
*/

// Gamos game-qa：冒烟 → 分诊 → 有界修复→复测 → 证据报告。规格见 docs/gamos/gamos-release-gates.md。

interface PlaytestOutcome {
  buildId: string;
  verdict: "pass" | "fail" | "inconclusive";
  steps: { action: string; target?: string; status: "pass" | "fail"; detail?: string }[];
  metrics: { fps?: number; loadMs?: number; crashes?: number; errors?: number };
  issues: { severity: "blocker" | "major" | "minor"; description: string; evidence: string }[];
  playtestRecorded: boolean;
}

interface RepairReport {
  fixed: string[];
  attempted: string[];
  stillBroken: string[];
  buildRecorded: boolean;
}

interface QaReport {
  conclusion: string;
  finalVerdict: "pass" | "fail" | "inconclusive";
  rounds: number;
  openBlockers: number;
  verified: string[];
  notCovered: string[];
}

const worldId = args.worldId === undefined ? "" : String(args.worldId);
const buildId = args.buildId === undefined ? "" : String(args.buildId);
const MAX_ROUNDS = args.maxRepairRounds === undefined ? 3 : Number(args.maxRepairRounds);

artifact.metrics("qa-progress", {
  title: "QA repair progress",
  metrics: [
    { field: "round", label: "Round" },
    { field: "verdict", label: "Verdict" },
    { field: "openIssues", label: "Open blocker/major issues" },
  ],
});

const playtester = agent("qa-playtester", {
  system:
    "你是 Gamos 的 QA 试玩员。用 gamos 工具确认构建存在（world_inspect），用 Browser Use 对入口做 " +
    "smoke 场景试玩（加载、全部声明操作、胜负路径、截图、console 错误与加载耗时），" +
    "再用 playtest_record 记录证据（steps/metrics/issues/verdict）。浏览器自动化只证明 UI 流程，" +
    "不证明持续 GPU 性能。禁止手改 .gamos/。",
});

const triager = agent("issue-triager", {
  system:
    "你是 QA 分诊员。把试玩失败步骤与 issue 转成可复现的修复工单：每条含复现步骤、疑似根因、" +
    "建议负责人角色（gameplay-engineer / asset-specialist / engine-specialist）。只基于证据分诊，不臆测。",
});

const repairer = agent("gameplay-engineer", {
  system:
    "你是 Gamos 的玩法工程师。按分诊工单修复游戏代码，修复后若产物变化则 build_record 记录新构建。" +
    "禁止手改 .gamos/。返回 RepairReport（fixed/attempted/stillBroken）。",
});

phase("Smoke playtest");
let outcome: PlaytestOutcome = await playtester.ask<PlaytestOutcome>(
  "对 " + (buildId ? "构建 " + buildId : "最新构建") + "（世界 " + (worldId || "active world") +
    "）执行 smoke 试玩并记录证据。返回 PlaytestOutcome。",
);
let round = 0;
report({ round, verdict: outcome.verdict, openIssues: countOpen(outcome) }, "qa-progress");

while (outcome.verdict !== "pass" && round < MAX_ROUNDS) {
  round = round + 1;
  phase("Triage failures (round " + round + ")");
  const tickets = await triager.ask<{ tickets: { reproduce: string; suspectedCause: string; owner: string }[] }>(
    "分诊以下试玩结果，输出修复工单：\n" + JSON.stringify(outcome, null, 2),
  );

  phase("Repair (round " + round + ")");
  const repair: RepairReport = await repairer.ask<RepairReport>(
    "修复以下工单，完成后记录新构建并返回 RepairReport：\n" + JSON.stringify(tickets, null, 2),
  );

  phase("Re-verify (round " + round + ")");
  outcome = await playtester.ask<PlaytestOutcome>(
    "复测修复后的最新构建（修复说明：" + repair.fixed.join("; ") + "），执行 smoke 场景并记录证据。",
  );
  report({ round, verdict: outcome.verdict, openIssues: countOpen(outcome) }, "qa-progress");
}

await artifact.markdown(
  "game-qa-report",
  [
    "# Game QA report",
    "",
    "- Final verdict: **" + outcome.verdict + "** after " + (round + 1) + " test run(s) (" + round + " repair round(s), cap " + MAX_ROUNDS + ")",
    "- Build: " + outcome.buildId,
    "- Metrics: " + JSON.stringify(outcome.metrics),
    outcome.issues.length > 0
      ? "- Open issues:\n" + outcome.issues.map((issue) => "  - [" + issue.severity + "] " + issue.description + " (" + issue.evidence + ")").join("\n")
      : "- Open issues: none",
    "",
    "Verdict honesty: pass requires all steps green and zero blocker/major issues.",
  ].join("\n"),
  { title: "Game QA report", description: "Smoke playtest, repair loop and evidence", primary: true },
);

const final: QaReport = {
  conclusion:
    "QA " + outcome.verdict + " for build " + outcome.buildId + " after " + (round + 1) +
    " run(s); " + countOpen(outcome) + " blocker/major issue(s) remain.",
  finalVerdict: outcome.verdict,
  rounds: round,
  openBlockers: countOpen(outcome),
  verified: [
    "smoke playtest recorded via playtest_record each round",
    "repair loop bounded at " + MAX_ROUNDS + " round(s)",
  ],
  notCovered: [
    "core-loop and full scenarios (run /game-playtest with the wider scenarios)",
    "sustained GPU performance (route to performance-analyst)",
  ],
};
return final;

function countOpen(outcome: PlaytestOutcome): number {
  return outcome.issues.filter(
    (issue) => issue.severity === "blocker" || issue.severity === "major",
  ).length;
}
