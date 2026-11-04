/* zcode-workflow
description: Gamos prepare-release pipeline: gate check, package audit sweep, evidence bundle, approval request, publish if approved
whenToUse: when the user asks to prepare / ship / release / publish a gamos world
args:
  worldId:
    type: string
    required: false
    description: world id (default active world)
  version:
    type: string
    required: false
    description: semantic version (default bumps patch)
  channel:
    type: string
    required: false
    description: release channel preview or stable (default preview)
*/

// Gamos prepare-release：门禁 → 包审计 → 证据捆绑 → 审批请求 →（已批）发布。
// 发布动作一律走 world_publish 门禁工具；工作流不能也不会自批。规格见 docs/gamos/gamos-release-gates.md。

interface GateState {
  status: "green" | "blocked";
  gates: { id: string; status: "pass" | "fail"; detail: string }[];
}

interface AuditOutcome {
  invalidPackages: string[];
  fixesApplied: string[];
  remainingInvalid: string[];
}

interface ReleaseReport {
  conclusion: string;
  gateStatus: "green" | "blocked";
  published: boolean;
  publicationVersion: string;
  verified: string[];
  notCovered: string[];
}

const worldId = args.worldId === undefined ? "" : String(args.worldId);
const version = args.version === undefined ? "" : String(args.version);
const channel = args.channel === undefined ? "preview" : String(args.channel);

const gateKeeper = agent("gate-keeper", {
  system:
    "你是 Gamos 发布工程师。只用 gamos 工具操作（ToolSearch \"gamos release\"）。" +
    "release_gate_check 读五门禁；世界与包数据只读自工具返回，禁止手改 .gamos/。",
});

const assetAuditor = agent("asset-specialist", {
  system:
    "你是 Gamos 的资产审计员。对 invalid/pending 包执行 intake 修复（补权利元数据、修正路径），" +
    "能修则修（package_register 不可重复注册，用 package_validate 重校验），" +
    "修不了的字段如实列出。禁止臆造 license。禁止手改 .gamos/。",
});

phase("Check the release gates");
let gates: GateState = await gateKeeper.ask<GateState>(
  "对 " + (worldId || "active world") + " 执行 release_gate_check，返回 GateState（含每道门禁的 id/status/detail）。",
);

if (gates.status !== "green") {
  const pkgGate = gates.gates.find((gate) => gate.id === "packages-validated");
  if (pkgGate && pkgGate.status === "fail") {
    phase("Audit and fix packages");
    const audit: AuditOutcome = await assetAuditor.ask<AuditOutcome>(
      "以下包门禁未过：" + pkgGate.detail + "。请执行 /asset-audit 流程（package_graph → package_validate → " +
        "修复 → 重校验），返回 AuditOutcome。",
    );
    phase("Re-check gates after package fixes");
    gates = await gateKeeper.ask<GateState>(
      "包修复后重新 release_gate_check（修复：" + audit.fixesApplied.join("; ") + "），返回 GateState。",
    );
  }
}

if (gates.status !== "green") {
  await artifact.markdown(
    "release-blocked",
    [
      "# Release blocked",
      "",
      ...gates.gates.map((gate) => "- [" + gate.status + "] **" + gate.id + "** — " + gate.detail),
      "",
      "Each red gate is a worklist item; see the gamos-release skill for how to turn each one green.",
    ].join("\n"),
    { title: "Release blocked", description: "Gate report with remaining work", primary: true },
  );
  const blocked: ReleaseReport = {
    conclusion:
      "Release blocked: " + gates.gates.filter((gate) => gate.status === "fail").map((gate) => gate.id).join(", ") +
      " not green. Fixes applied where possible; remaining work is in the artifact.",
    gateStatus: "blocked",
    published: false,
    publicationVersion: "",
    verified: ["release_gate_check evaluated twice (before and after package fixes)"],
    notCovered: gates.gates.filter((gate) => gate.status === "fail").map((gate) => gate.id + ": " + gate.detail),
  };
  return blocked;
}

phase("Request user approval");
const approval = await gateKeeper.ask<{ approvalId: string; status: string }>(
  "调用 release_request_approval（notes 里写明版本 " + (version || "auto") + " 与渠道 " + channel +
    "），返回 approvalId。注意：审批只能由用户在 Gamos Console 面板点击批准，你不能批准。",
);

await artifact.markdown(
  "release-ready",
  [
    "# Release ready — approval requested",
    "",
    "- All five gates are green.",
    "- Approval `" + approval.approvalId + "` is pending — **the user must approve it in the Gamos Console**.",
    "- After approval, publishing happens via world_publish (version " + (version || "auto") + ", channel " + channel + ").",
  ].join("\n"),
  { title: "Release ready", description: "Gates green, user approval pending", primary: true },
);

const ready: ReleaseReport = {
  conclusion:
    "All gates green; approval " + approval.approvalId + " requested. Publishing waits for the user to approve " +
    "in the Gamos Console, then world_publish (version " + (version || "auto") + ", channel " + channel + ").",
  gateStatus: "green",
  published: false,
  publicationVersion: version,
  verified: [
    "five gates green via release_gate_check",
    "approval requested via release_request_approval",
  ],
  notCovered: [
    "the publish step itself — it runs only after the user approves (panel action), and re-checks gates at publish time",
  ],
};
return ready;
