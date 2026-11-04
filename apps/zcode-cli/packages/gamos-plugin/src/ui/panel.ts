import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { STATE_URI, WORLD_SET_ACTIVE_TOOL, RELEASE_APPROVE_TOOL, type GamosResult } from "../contract.js";
import type { GamosConsoleState } from "../gameos/console-state.js";

/**
 * Gamos Console 面板：经 ext-apps 宿主桥读取 gamos://state、切换活动世界、
 * 批准发布（app-only 工具）。样式只取宿主 MCP Apps 标准变量，浅/深色自适应。
 */

let app: App | undefined;
let state: GamosConsoleState | null = null;

async function readState(): Promise<GamosConsoleState | null> {
  if (!app) return null;
  try {
    const result = await app.readServerResource({ uri: STATE_URI });
    const content = result.contents[0];
    const parsed: unknown = content && "text" in content ? JSON.parse(content.text) : undefined;
    const envelope = parsed as GamosResult<GamosConsoleState> | undefined;
    return envelope && "data" in envelope ? envelope.data : null;
  } catch {
    return null;
  }
}

async function callTool(name: string, args: Record<string, unknown>): Promise<void> {
  if (!app) return;
  try {
    await app.callServerTool({ name, arguments: args });
  } catch {
    /* 宿主拒绝或工具出错：下一轮刷新会展示真实状态。 */
  }
  await refresh();
}

async function refresh(): Promise<void> {
  state = await readState();
  render();
}

function render(): void {
  const root = document.getElementById("gamos-root");
  if (!root) return;
  if (!state) {
    root.innerHTML = `<div class="empty">Loading Gamos state…</div>`;
    return;
  }
  const worlds = state.worlds
    .map(
      (world) => `
      <button class="card${world.isActive ? " active" : ""}" data-world="${world.id}">
        <div class="card-head"><span class="name">${escapeHtml(world.name)}</span><span class="badge">${escapeHtml(world.status)}</span></div>
        <div class="card-meta">${escapeHtml(world.engine)} · GameIR v${world.gameIrVersion} · ${world.packageCount} pkgs · ${world.buildCount} builds · ${world.playtestCount} playtests</div>
      </button>`,
    )
    .join("");
  const active = state.active;
  const detail = active ? renderActive(active) : `<div class="empty">No active world. Create one via the gamos tools, then set it active.</div>`;
  root.innerHTML = `
    <section><h2>Worlds</h2><div class="cards">${worlds || `<div class="empty">No worlds yet.</div>`}</div></section>
    <section>${detail}</section>`;
  bindActions(root);
}

function renderActive(active: NonNullable<GamosConsoleState["active"]>): string {
  const pending = active.approvals.filter((approval) => !approval.approvedAt);
  const gates = active.gates.gates
    .map(
      (gate) =>
        `<li class="${gate.status}"><span class="dot"></span><strong>${gate.id}</strong><span>${escapeHtml(gate.detail)}</span></li>`,
    )
    .join("");
  const packages = active.packages
    .map(
      (pkg) =>
        `<tr><td>${escapeHtml(pkg.name)}</td><td>${escapeHtml(pkg.type)}</td><td>${escapeHtml(pkg.rights.license || "—")}</td><td><span class="badge ${pkg.validation.status}">${pkg.validation.status}</span></td></tr>`,
    )
    .join("");
  const builds = active.builds
    .map(
      (build) =>
        `<tr><td>${build.id}</td><td>${escapeHtml(build.target)}</td><td class="mono">${escapeHtml(build.digest.slice(0, 19))}…</td><td><span class="badge ${build.testStatus}">${build.testStatus}</span></td></tr>`,
    )
    .join("");
  const playtests = active.playtests
    .slice(-8)
    .reverse()
    .map(
      (run) =>
        `<tr><td>${run.id}</td><td>${escapeHtml(run.scenario)}</td><td>${escapeHtml(run.mode)}</td><td>${run.metrics.fps != null ? `${run.metrics.fps} fps` : "—"}</td><td><span class="badge ${run.verdict}">${run.verdict}</span></td></tr>`,
    )
    .join("");
  return `
    <h2>${escapeHtml(active.world.name)} <span class="badge">${escapeHtml(active.world.status)}</span></h2>
    <p class="meta">${escapeHtml(active.world.genre || "genre unset")} · ${escapeHtml(active.world.engine)}${active.world.engineVersion ? ` (${escapeHtml(active.world.engineVersion)})` : ""} · targets: ${active.world.targetProfiles.map(escapeHtml).join(", ")}</p>
    <div class="grid2">
      <div class="panel">
        <h3>Release gates ${active.gates.status === "green" ? '<span class="badge pass">green</span>' : '<span class="badge fail">blocked</span>'}</h3>
        <ul class="gates">${gates}</ul>
        ${
          pending.length > 0
            ? `<button class="primary" data-approve="${pending[pending.length - 1]?.id ?? ""}">Approve release (${escapeHtml(pending[pending.length - 1]?.id ?? "")})</button>`
            : active.gates.gates.find((gate) => gate.id === "user-approval")?.status === "pass"
              ? `<p class="meta">Release approved.</p>`
              : `<p class="meta">No pending approval. Request one via release_request_approval.</p>`
        }
      </div>
      <div class="panel">
        <h3>GameIR v${active.gameIr.version}</h3>
        <p class="meta">core loop: ${escapeHtml(active.gameIr.coreLoop.join(" → ") || "unset")}</p>
        <p class="meta">${active.gameIr.mechanics.length} mechanics · ${active.gameIr.levels.length} levels · budget ${active.gameIr.constraints.performance.targetFps}fps / ${active.gameIr.constraints.performance.maxLoadMs}ms</p>
        <p class="meta">win: ${escapeHtml(active.gameIr.winCondition || "unset")} · lose: ${escapeHtml(active.gameIr.loseCondition || "unset")}</p>
      </div>
    </div>
    <div class="grid2">
      <div class="panel"><h3>Packages (${active.packages.length})</h3><table><thead><tr><th>name</th><th>type</th><th>license</th><th>validation</th></tr></thead><tbody>${packages || `<tr><td colspan="4" class="empty">none</td></tr>`}</tbody></table></div>
      <div class="panel"><h3>Builds (${active.builds.length})</h3><table><thead><tr><th>id</th><th>target</th><th>digest</th><th>tests</th></tr></thead><tbody>${builds || `<tr><td colspan="4" class="empty">none</td></tr>`}</tbody></table></div>
    </div>
    <div class="panel"><h3>Playtests (${active.playtests.length})</h3><table><thead><tr><th>id</th><th>scenario</th><th>mode</th><th>fps</th><th>verdict</th></tr></thead><tbody>${playtests || `<tr><td colspan="5" class="empty">none</td></tr>`}</tbody></table></div>`;
}

function bindActions(root: HTMLElement): void {
  for (const card of root.querySelectorAll<HTMLButtonElement>("[data-world]")) {
    card.addEventListener("click", () => {
      void callTool(WORLD_SET_ACTIVE_TOOL, { worldId: card.dataset.world });
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-approve]")) {
    button.addEventListener("click", () => {
      void callTool(RELEASE_APPROVE_TOOL, { approvalId: button.dataset.approve });
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function startPanel(): Promise<void> {
  app = new App({ name: "gamos", version: "1" }, {}, { autoResize: false });
  app.onhostcontextchanged = () => {
    applyContext(app?.getHostContext());
  };
  await app.connect();
  applyContext(app.getHostContext());
  await refresh();
  setInterval(() => {
    void refresh();
  }, 5000);
}

function applyContext(context: McpUiHostContext | undefined): void {
  if (!context) return;
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
}

void startPanel();
