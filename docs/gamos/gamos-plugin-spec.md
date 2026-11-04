# Gamos 插件规格（gamos plugin spec）

日期：2026-11-03 · 状态：已采纳 · 上游规格：`docs/gamos/2026-11-03-gamos-platform-spec.md`

## 1. 插件身份与分发

- 包：`apps/zcode-cli/packages/gamos-plugin`（`@zcode/gamos-plugin`，私有，ESM）。
- 插件名：`gamos`（marketplace id `gamos@zcode-plugins-official`，builtin 官方插件，随宿主播种）。
- 版本四同步：`package.json`、`.zcode-plugin/plugin.json`、`official-plugin-definitions.ts`、
  `sea-official-plugin-assets.mjs` / `prepare-agent-node-bundle.mjs` 必须一致（漏改会静默回退旧
  缓存目录）。
- 运行时：`dist/mcp/server.js`（esbuild 自包含 bundle）+ `dist/ui/panel.html`（Gamos Console）。
- 不设 `defaultEnabled`（带 MCP 运行时的插件不默认启用），用户从官方市场安装/启用。
- `ui.surfaces` 声明 Console 面板 ⇒ 官方定义必须带 `componentTypes: ["ui"]`（bootstrap 测试
  强制一致）。

## 2. 工作区存储（唯一事实源）

所有 GameOS 状态存于项目目录 `.gamos/`（服务端 `cwd` = `${ZCODE_PROJECT_DIR}`）：

```
.gamos/
├── gamos.json                    # 工作区注册表：schemaVersion、activeWorldId
└── worlds/<worldId>/
    ├── world.json                # World 身份与状态
    ├── gameir.json               # GameIR（版本化游戏定义）
    ├── packages.json             # 包图（资产/机制包 + 权利 + 出处 + 校验）
    ├── builds.json               # 构建记录（digest 溯源）
    ├── playtests.json            # 试玩证据
    └── releases.json             # 审批与发布历史
```

规则：写入全部走 MCP 工具（原子写、temp+rename）；Agent 不得手改 `.gamos/`（技能与上下文注入
均声明此约束）；目录缺失视为"工作区尚无 Gamos 项目"，读取类工具安全返回空态。

## 3. 数据模型（关键约束）

- `World`：`id`（`wld_` + 12 hex，稳定身份，与目录名解耦）、`name`、`slug`、`genre`、
  `engine`（`web|playcanvas|godot|unity`）、`engineVersion`、`targetProfiles[]`
  （如 `browser-desktop`、`browser-mobile`）、`status`（`draft|in-development|playable|released|archived`）。
- `GameIR`：`version`（单调递增）、`coreLoop[]`、`mechanics[]`、`levels[]`、`progression`、
  `economy?`、`artDirection`、`controls[]`、`winCondition`、`loseCondition`、
  `constraints.performance{targetFps,maxLoadMs}`。GameIR 更新必须经 `world_update`（校验后
  `version+1`）。
- `Package`：`id`（`pkg_` + 10 hex）、`type`（`asset-3d|asset-texture|asset-audio|asset-animation|
  mechanic|ui|shader|level`）、`path`（工作区内相对路径）、`engine`、`dependencies[]`、
  `rights{license,author,sourceUrl?,attribution?}`、`provenance{origin: original|generated|imported,
  createdBy: agent|user, digest?}`、`validation{status,checks[],validatedAt}`。
  **intake 校验**（`package_validate` / 注册时自动）：`rights-metadata`（license 与 author 必填）、
  `provenance`（origin 与 createdBy 必填）、`engine-compat`（包引擎与 World 引擎一致或 `*`）、
  `file-exists`（路径存在）、`deps-resolve`（依赖可解析）。任一 fail ⇒ 包 `invalid`，发布门禁
  `packages-validated` 不过。
- `Build`：`id`（`bld_` + 10 hex）、`engine/engineVersion/target`、`artifactPath`、`entryPoint`、
  `digest`（`sha256:<hex>`，缺省时服务端计算）、`testStatus`（由试玩证据推导）、`recordedAt`。
- `Playtest`：`id`（`pt_` + 10 hex）、`buildId/buildDigest`（绑定构建摘要）、`mode`
  （`browser-use|engine-adapter|manual`）、`scenario`（`smoke|core-loop|full`）、`steps[]`
  （action/target/status/detail）、`screenshots[]`（相对路径引用）、`metrics{fps?,loadMs?,crashes?,
  errors?}`、`issues[]`（`blocker|major|minor` + evidence）、`verdict`（`pass|fail|inconclusive`）。
- `Release`：`approvals[]`（`apr_` + 10 hex，`requestedAt`、`approvedBy: user`、`approvedAt?`、
  `scope: publish`）与 `publications[]`（`pub_` + 10 hex，version/channel/buildId/buildDigest/
  gateReport 快照/approvalId/publishedAt/`localUrl`）。

## 4. Tool Fabric（MCP 工具面）

server 名 `gamos`（运行时命名空间 `plugin:gamos:gamos`，模型可见工具名
`mcp__plugin_gamos_gamos__<tool>`，默认 ToolSearch 延迟加载）。工具描述必须包含领域关键词
（world/game/asset/package/playtest/build/release/atlas/…）保证可检索性。全部工具返回
`{ data | error }` JSON 信封（error 含 `code` 与可执行修复建议）。

| 工具 | 读写 | 说明 |
| --- | --- | --- |
| `world_create` | 写 | 建 World + 空 GameIR + 包图；首个 World 自动设为活动 |
| `world_list` | 读 | 世界列表（状态/引擎/目标/统计） |
| `world_inspect` | 读 | 全量状态（含门禁评估） |
| `world_set_active` | 写 | 切换活动 World |
| `world_update` | 写 | 更新 World 元数据或整体替换 GameIR（version+1） |
| `package_register` | 写 | 注册包并跑 intake 校验 |
| `package_graph` | 读 | 包节点/边 + 兼容报告 |
| `package_validate` | 写 | 重跑校验（单个或全部） |
| `playtest_record` | 写 | 记录试玩证据（校验 buildId 存在，携带 digest） |
| `playtest_report` | 读 | 试玩历史汇总（按构建分组，指标聚合） |
| `build_record` | 写 | 记录构建（缺省 digest 现场计算 sha256） |
| `release_gate_check` | 读写 | 评估五门禁并持久化最近报告 |
| `release_request_approval` | 写 | 创建待审批记录 |
| `release_approve` | 写 | **app-only**（`_meta.ui.visibility:["app"]`）：仅面板可调，Agent 不可自批 |
| `world_publish` | 写 | 门禁全绿 + 有效审批才放行；否则返回缺失门禁明细（错误码 `gates_failed` / `approval_missing`） |
| `world_atlas` | 读 | 生成 World Atlas 投影（系统/关卡图/资产/依赖/已知问题/已决事项） |
| `world_usage` | 读 | 活动/成本统计（世界级构建与试玩计数、最近活动） |

错误处理约定：未知 worldId/packageId/buildId ⇒ `not_found`；`world_publish` 门禁失败 ⇒
`gates_failed` 且附 `gates[]` 明细；所有写入原子（失败不留半态）。

## 5. Hooks

- `SessionStart`（matcher `startup|clear|compact`，`hooks/world-context.mjs`，node 运行）：
  读 stdin hook 输入的 `cwd`，聚合 `.gamos/` → 输出 `additionalContext`（活动 World、GameIR
  概要、包/构建/试玩状态、门禁摘要、"用 gamos 工具而非手改 .gamos/" 的指令）。无 `.gamos/` 时
  静默成功（无上下文可注入），不得报错。
- `PreToolUse`（matcher `mcp__plugin_gamos_gamos__world_publish`，`hooks/release-gate.mjs`）：
  复算门禁 + 审批；未全绿 exit 2 并在 stderr 给出缺失明细（宿主转成拒绝理由）；`.gamos/` 缺失
  或读取异常时放行（服务端仍是权威）。Hook 是反馈层，不是安全边界——服务端 `world_publish`
  独立复检。

## 6. Gamos Console（ui.surfaces）

- `ui://gamos/panel.html`（`text/html;profile=mcp-app`）+ 数据资源 `gamos://state`（全量状态
  JSON：worlds 摘要、活动世界详情、门禁、待审批）。
- 面板经 ext-apps 宿主桥读取资源、调用 `world_set_active` 与 app-only 的 `release_approve`；
  样式只取宿主 MCP Apps 标准变量（浅/深色自适应）。
- 审批交互：门禁清单全绿时展示「批准发布」按钮 → 调 `release_approve` → 刷新状态。

## 7. 角色包（agents/，均为 restrict-only 子代理）

`game-designer`（绿）、`gameplay-engineer`（蓝）、`level-designer`（黄）、`asset-specialist`
（紫）、`engine-specialist`（青）、`qa-playtester`（橙）、`performance-analyst`（粉）、
`build-release-engineer`（红）。每个角色：职责边界、输出契约（结构化 JSON/证据）、工具范围、
与 gamos 工具的协作方式（经 ToolSearch 发现 `mcp__plugin_gamos_gamos__*`）。

## 8. 技能与命令

技能（`skills/`，frontmatter `name`+`description`）：`gamos-platform`、`gamos-world-creation`、
`gamos-spark-design`、`gamos-asset-intake`、`gamos-playtest`、`gamos-performance`、
`gamos-release`、`gamos-workflows`。命令（`commands/`）：`/world-inspect`、`/spark-create`、
`/game-playtest`、`/asset-audit`、`/performance-check`、`/prepare-release`（各自引用对应技能，
`$ARGUMENTS` 透传，不绕过工具权限链）。

## 9. Dynamic Workflow 模板（templates/workflows/，保存式 `.dwf.ts`）

`create-world`、`asset-intake`、`game-qa`、`prepare-release`。契约沿用
`docs/dynamic-workflow/authoring.md`：typed asks、`phase()` 标记、有界循环、`report/artifact`
证据产物、`world.run` 仅字面量命令。模板由 `gamos-workflows` 技能安装到 `.zcode/workflows/`，
经 `CreateWorkflow{saved}` 启动；发布动作一律经门禁工具，工作流不直接写 `.gamos/`。

## 10. userConfig

`default_engine`（string，默认 `web`）与 `default_target`（string，默认 `browser-desktop`），
经 `${user_config.*}` 注入 server env（`GAMOS_DEFAULT_ENGINE` / `GAMOS_DEFAULT_TARGET`），仅作为
`world_create` 缺省值。

## 11. 验收

1. `pnpm --filter @zcode/gamos-plugin build` 产出 `dist/mcp/server.js` 与 `dist/ui/panel.html`。
2. MCP stdio 冒烟：initialize → tools/list（17 工具）→ `world_create` → `build_record` →
   `release_gate_check`（4 门禁 fail/1 情况合理）→ `world_publish`（被拒，`gates_failed`）→
   `release_approve` 后（模拟面板路径）仍因缺试玩证据被拒。
3. Hook 冒烟：无 `.gamos/` 时 SessionStart hook 静默；有世界时注入摘要；发布前 PreToolUse 阻断。
4. `pnpm architecture:check -- --changed`、CLI lint/typecheck、vitest 全绿；版本四同步。
