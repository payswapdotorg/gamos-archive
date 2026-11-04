/* zcode-workflow
description: Gamos asset-intake pipeline: discover candidate assets, validate rights and provenance per asset, confirm the package graph
whenToUse: when the user asks to intake/audit assets into a gamos world or check package rights
args:
  pattern:
    type: string
    required: false
    description: glob for candidate assets (default assets glob, all types)
  worldId:
    type: string
    required: false
    description: target world id (default active world)
*/

// Gamos asset-intake：发现候选资产 → 逐项权利/出处核验 → 图确认。规格见 docs/gamos/gamos-plugin-spec.md。

interface AssetCandidate {
  path: string;
  type: "asset-3d" | "asset-texture" | "asset-audio" | "asset-animation" | "shader";
  sizeBytes: number;
  note: string;
}

interface IntakeVerdict {
  path: string;
  decision: "register" | "reference-only" | "reject";
  license: string;
  author: string;
  sourceUrl: string;
  origin: "original" | "generated" | "imported";
  reason: string;
}

interface GraphState {
  totalPackages: number;
  valid: number;
  invalid: number;
  unresolved: string[];
}

interface IntakeReport {
  conclusion: string;
  registered: number;
  rejected: number;
  referenceOnly: number;
  graphValid: number;
  graphInvalid: number;
  verified: string[];
  notCovered: string[];
}

const pattern = args.pattern === undefined ? "assets/**/*" : String(args.pattern);
const worldId = args.worldId === undefined ? "" : String(args.worldId);

phase("Discover candidate assets");
const survey = await agent("asset-scout", {
  system:
    "你是资产勘察员。用 files.glob 找出候选资产文件，按扩展名分类（.glb/.gltf=asset-3d，" +
    ".png/.jpg/.webp/.ktx=asset-texture，.mp3/.ogg/.wav=asset-audio，" +
    ".glb 动画或 .anim=.asset-animation，.wgsl/.glsl=shader）。返回 AssetCandidate[]。",
});
const candidates: AssetCandidate[] = await survey.ask<AssetCandidate[]>(
  "列出匹配 " + pattern + " 的候选游戏资产（files.glob + files.read 判断类型），返回 AssetCandidate[]。" +
    "没有匹配时返回空数组。",
);

if (candidates.length === 0) {
  const empty: IntakeReport = {
    conclusion: "No candidate assets matched " + pattern + "; nothing to intake.",
    registered: 0,
    rejected: 0,
    referenceOnly: 0,
    graphValid: 0,
    graphInvalid: 0,
    verified: ["glob " + pattern + " returned no matches"],
    notCovered: ["assets outside the pattern"],
  };
  return empty;
}

phase("Validate rights and provenance per asset");
const MAX_PARALLEL = 4;
const batches: AssetCandidate[][] = [];
for (let i = 0; i < candidates.length; i += MAX_PARALLEL) {
  batches.push(candidates.slice(i, i + MAX_PARALLEL));
}
const verdicts: IntakeVerdict[] = [];
for (const batch of batches) {
  const results = await Promise.all(
    batch.map((candidate, index) =>
      agent("rights-reviewer-" + index, {
        system:
          "你是资产权利审查员。对单个候选资产判定 intake 结论：能确认权利（license/author/sourceUrl）" +
          "则 register；只是风格参考则 reference-only；权利不明或疑似第三方未授权则 reject。" +
          "不臆造 license：不确定就 reject 并说明缺什么。",
      }).ask<IntakeVerdict>(
        "审查资产：" + JSON.stringify(candidate) +
          "。若同目录有 license/README/CREDITS 文件可读取佐证。返回 IntakeVerdict。",
      ),
    ),
  );
  verdicts.push(...results);
}

phase("Register valid packages and confirm the graph");
const integrator = agent("gamos-integrator", {
  system:
    "你是 Gamos 集成工程师。对 decision=register 的资产逐个 package_register（rights 与 provenance " +
    "按审查结论填写），然后 package_validate 全量校验并读取 package_graph。禁止手改 .gamos/。",
});
const graph: GraphState = await integrator.ask<GraphState>(
  "将以下 register 结论注册为包（worldId=" + (worldId || "active world") + "）并校验：\n" +
    JSON.stringify(verdicts.filter((verdict) => verdict.decision === "register"), null, 2) +
    "\n返回 GraphState（totalPackages/valid/invalid/unresolved）。",
);

const registered = verdicts.filter((verdict) => verdict.decision === "register").length;
const rejected = verdicts.filter((verdict) => verdict.decision === "reject").length;
const referenceOnly = verdicts.filter((verdict) => verdict.decision === "reference-only").length;

await artifact.markdown(
  "asset-intake-report",
  [
    "# Asset intake report",
    "",
    "- Candidates: " + candidates.length + " (pattern `" + pattern + "`)",
    "- Registered: " + registered + " · Reference-only: " + referenceOnly + " · Rejected: " + rejected,
    "- Package graph: " + graph.valid + "/" + graph.totalPackages + " valid" +
      (graph.unresolved.length > 0 ? " · unresolved: " + graph.unresolved.join(", ") : ""),
    "",
    "## Decisions",
    ...verdicts.map(
      (verdict) =>
        "- **" + verdict.decision + "** `" + verdict.path + "` — " + verdict.license + " / " +
        verdict.author + (verdict.sourceUrl ? " / " + verdict.sourceUrl : "") + " — " + verdict.reason,
    ),
  ].join("\n"),
  { title: "Asset intake report", description: "Rights, provenance and package graph decisions", primary: true },
);

const report: IntakeReport = {
  conclusion:
    "Intaked " + registered + " asset(s) (" + referenceOnly + " reference-only, " + rejected +
    " rejected); package graph now " + graph.valid + "/" + graph.totalPackages + " valid.",
  registered,
  rejected,
  referenceOnly,
  graphValid: graph.valid,
  graphInvalid: graph.invalid,
  verified: [
    "per-asset rights/provenance verdicts with reasons",
    "package graph validated after registration" +
      (graph.unresolved.length > 0 ? " (unresolved deps: " + graph.unresolved.join(", ") + ")" : ""),
  ],
  notCovered: ["assets outside the pattern", "legal review beyond recorded metadata (ask the user for unclear rights)"],
};
return report;
