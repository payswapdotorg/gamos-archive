/* zcode-workflow
description: Gamos create-world pipeline: designer/reviewer GameIR loop, then scaffold, build and smoke handoff
whenToUse: when the user asks to create a new game world / new game project in the gamos platform
args:
  name:
    type: string
    required: true
    description: world/game name
  genre:
    type: string
    required: false
    description: genre, e.g. endless-runner
  description:
    type: string
    required: false
    description: one-paragraph concept
  targets:
    type: string
    required: false
    description: comma-separated target profiles, e.g. browser-desktop,browser-mobile
*/

// Gamos create-world：设计→评审→建世界→冒烟移交。规格见 docs/gamos/gamos-plugin-spec.md。

interface GamePlan {
  coreLoop: string[];
  mechanics: { id: string; name: string; description: string; rules: string[] }[];
  levels: { id: string; name: string; kind: string; difficulty: number; mechanics: string[]; entry: string[]; exit: string[] }[];
  controls: { target: string; scheme: string; mappings: { action: string; input: string }[] }[];
  winCondition: string;
  loseCondition: string;
  artStyle: string;
  budget: { targetFps: number; maxLoadMs: number };
}

interface ReviewIssue {
  severity: "blocker" | "major" | "minor";
  area: string;
  description: string;
  suggestion: string;
}

interface ReviewVerdict {
  verdict: "approve" | "revise";
  score: number;
  issues: ReviewIssue[];
  focusNext: string[];
}

interface ScaffoldReport {
  worldId: string;
  gameIrVersion: number;
  buildRecorded: boolean;
  playtestVerdict: "pass" | "fail" | "inconclusive" | "skipped";
  notes: string[];
}

interface CreateWorldReport {
  conclusion: string;
  worldId: string | null;
  designRounds: number;
  reviewScore: number;
  verified: string[];
  notCovered: string[];
}

const name = String(args.name);
const genre = args.genre === undefined ? "" : String(args.genre);
const concept = args.description === undefined ? "" : String(args.description);
const targets = args.targets === undefined ? "browser-desktop" : String(args.targets);

const designer = agent("game-designer", {
  system:
    "你是 Gamos 平台的游戏策划。为一个可直接在浏览器运行的小型可玩游戏设计 GameIR。" +
    "硬约束：引擎 web（Three.js CDN、单 HTML、无构建步骤）、60fps/3000ms 预算、" +
    "机制规则必须带具体数值（冷却、距离、速度），胜负条件必须可测。" +
    "范围可控：2-4 个机制、1-3 个关卡、1-2 个目标档位。输出 GamePlan。",
});

const reviewer = agent("design-reviewer", {
  system:
    "你是严格的游戏设计评审员，只依据给出的计划文本评审。" +
    "评审维度：1) 核心循环是否清晰且可玩 2) 机制规则是否具体可测 3) 关卡图是否连通且有难度曲线 " +
    "4) 胜负条件是否可验证 5) 范围是否一个会话可完成。" +
    "score>=8 且无 blocker 才 approve，否则 revise 并给出可执行建议。",
});

phase("Design the GameIR");
let plan: GamePlan = await designer.ask<GamePlan>(
  "为以下游戏设计完整 GamePlan（coreLoop、mechanics、levels、controls、winCondition、" +
    "loseCondition、artStyle、budget）。游戏名：" + name +
    (genre ? "，类型：" + genre : "") +
    (concept ? "，概念：" + concept : "") +
    "，目标档位：" + targets + "。输出 GamePlan。",
);

phase("Review the design");
let verdict: ReviewVerdict = await reviewer.ask<ReviewVerdict>(
  "请评审以下游戏设计计划：\n" + JSON.stringify(plan, null, 2),
);

let round = 1;
const MAX_ROUNDS = 3;
while (verdict.verdict !== "approve" && round < MAX_ROUNDS) {
  phase("Revise the design (round " + (round + 1) + ")");
  round = round + 1;
  plan = await designer.ask<GamePlan>(
    "根据评审反馈修订计划，重点解决 focusNext 与 blocker/major 问题，保持 GamePlan 结构：\n" +
      "评审反馈：\n" + JSON.stringify(verdict, null, 2) +
      "\n\n当前计划：\n" + JSON.stringify(plan, null, 2),
  );
  phase("Re-review the revised design");
  verdict = await reviewer.ask<ReviewVerdict>(
    "请评审第 " + round + " 轮修订后的游戏设计计划：\n" + JSON.stringify(plan, null, 2),
  );
}

phase("Create the world and record the GameIR");
const scaffolder = agent("gamos-integrator", {
  system:
    "你是 Gamos 平台的集成工程师。通过 gamos 工具（ToolSearch \"gamos\"）操作：" +
    "world_create 建世界（engine=web，engineVersion=\"three.js r170 (CDN)\"），" +
    "再用 world_update 写入完整 GameIR（用给出的 GamePlan 映射：mechanics/levels/controls/" +
    "winCondition/loseCondition/artDirection/constraints.performance）。禁止手改 .gamos/。",
});
const scaffold: ScaffoldReport = await scaffolder.ask<ScaffoldReport>(
  "按以下已评审通过的设计创建 Gamos 世界并记录 GameIR，然后：注册代码产物为包" +
    "（package_register，rights=项目 license、author=Gamos、provenance=original/agent）。" +
    "暂不构建（构建在会话内继续）。返回 ScaffoldReport（worldId、gameIrVersion、notes）。\n" +
    "设计：\n" + JSON.stringify(plan, null, 2),
);

const verified: string[] = [
  "GameIR reviewed and recorded after " + round + " round(s), final score " + verdict.score + "/10",
];
if (scaffold.worldId) {
  verified.push("world created: " + scaffold.worldId + " (GameIR v" + scaffold.gameIrVersion + ")");
}

await artifact.markdown(
  "create-world-report",
  [
    "# Create-world report — " + name,
    "",
    "- World: " + scaffold.worldId + " (GameIR v" + scaffold.gameIrVersion + ")",
    "- Design rounds: " + round + " (final score " + verdict.score + "/10)",
    "- Core loop: " + plan.coreLoop.join(" → "),
    "- Win: " + plan.winCondition + " / Lose: " + plan.loseCondition,
    "- Notes: " + scaffold.notes.join("; "),
  ].join("\n"),
  { title: "Create-world report", description: "Reviewed design + world creation summary", primary: true },
);

const report: CreateWorldReport = {
  conclusion:
    "Designed and created world " + (scaffold.worldId ?? "(failed)") + " for " + name +
    " after " + round + " design round(s); GameIR v" + scaffold.gameIrVersion + " recorded via gamos tools.",
  worldId: scaffold.worldId || null,
  designRounds: round,
  reviewScore: verdict.score,
  verified,
  notCovered: [
    "implementation/build of the playable artifact (continue in-session)",
    "playtest evidence (run /game-playtest after a build is recorded)",
  ],
};
return report;
