# Gamos 平台规格（Gamos Platform Spec）

日期：2026-11-03 · 状态：已采纳（Accepted） · 负责人：gamos（fork 维护方）

## 1. 背景与定位

Gamos 是 `payswapdotorg/gamos` 对上游 `zai-org/ZCode`（基线 a9fe401e，v3.17.2）的产品化演进：把
ZCode 作为**执行与交互操作系统**保留，在其现有扩展点（插件、技能、命令、子代理、MCP、Hook、
ToolSearch、Dynamic Workflow、权限系统）之上叠加一层**游戏原生（game-native）能力**，而不复制
Agent 运行时、会话、工具执行、权限或插件市场中的任何一个子系统。

Gamos 与上游的关系遵循以下不可违反的规则（源自 fork 演进审计报告的"所有权规则"）：

| 能力 | 归属 |
| --- | --- |
| 用户任务、会话与 Agent 执行 | ZCode（保持原样） |
| 模型选择、Provider 凭据与路由 | ZCode（保持原样） |
| Agent 循环、工具调度与子代理生命周期 | ZCode（保持原样） |
| 通用工具、扩展与权限交互 | ZCode（保持原样） |
| World 身份、GameIR 与游戏语义 | Gamos |
| 包组合、权利与出处（provenance） | Gamos |
| 引擎相关操作 | Gamos Tool Fabric（引擎适配） |
| 游戏构建、试玩证据与发布 | Gamos |

**禁止事项**（保持上游可维护性）：不创建第二个 Agent/模型路由、不另建任务/会话数据库、不实现
第二个通用文件系统或 Git 客户端、不复制插件市场、不复制记忆引擎或权限引擎。游戏领域能力一律
通过 ZCode 现有扩展点接入。

## 2. 核心概念

### 2.1 World（世界）

一个 World 是一个可玩的独立游戏项目：拥有稳定身份（`wld_` 前缀 ID，与目录名解耦）、引擎绑定
（`web` / `playcanvas` / `godot` / `unity`）、目标平台档位（target profiles）与状态机
（`draft → in-development → playable → released`，另有 `archived` 终态）。单个仓库可包含多个
World；活动 World 记录在工作区注册表中。

### 2.2 GameIR（游戏中间表示）

GameIR 是 World 的**类型化游戏定义**，版本化演进：核心循环（coreLoop）、机制（mechanics）、
关卡（levels）、进程（progression）、经济（economy）、美术方向（artDirection）、操作映射
（controls）、胜负条件与性能预算（constraints.performance）。GameIR 是"游戏是什么"的权威数据，
不是文档；记忆与 Wiki 不承载权威定义。

### 2.3 包图（Package Graph）

资产与机制以**包**为单位组合：类型（3D 资产、纹理、音频、动画、机制、UI、shader、关卡）、
依赖、引擎兼容性、**权利（rights：license/author/sourceUrl/attribution）**与**出处
（provenance：origin/createdBy/digest）**。包必须通过 intake 校验（权利元数据完整、出处明确、
引擎兼容）才允许进入已发布 World。区分"参考图"与"可投产资产"：图片搜索结果只是参考，未经
权利确认不得静默成为生产资产。

### 2.4 试玩证据（Playtest Evidence）

每次试玩记录：构建摘要（digest）、引擎与目标、场景（smoke/core-loop/full）、步骤、截图引用、
指标（fps/loadMs/crashes/errors）、问题（分级）与结论（verdict）。证据绑定到构建摘要，
可比较、可追溯。报告中的"完成"必须有证据支撑，而不是 Agent 的自述。

### 2.5 发布门禁（Release Gates）

发布前必须全部通过：`gameir-complete`（GameIR 完整）→ `packages-validated`（全部包校验通过）
→ `build-exists`（目标构建存在且有 digest）→ `playtest-evidence`（该构建至少一次通过结论的
试玩）→ `user-approval`（用户显式批准）。**审批工具仅面板可见**（`_meta.ui.visibility: ["app"]`），
Agent 不能自批自发。门禁评估是服务端权威，Hook 仅作前置反馈层，不是安全边界。

## 3. 集成架构（五个层次）

```
Gamos 产品体验     New Task · Worlds · Gamos Console · Playtest · World Atlas · 创作者工具
ZCode 应用运行时   Tasks · Sessions · Models · Providers · Agent · Context · Permissions ·
                   Browser · Terminal · Files · Git · Plugins · Automations · Remote
集成边界           World context provider(Hook) · Tool Fabric(MCP) · 事件/证据适配
Gamos GameOS       GameIR · Package Graph · Build · Playtest Evidence · Release Gates · Atlas
实际执行基础设施   浏览器(Three.js/PlayCanvas) · 引擎 SDK · 构建产物 · 存储
```

实现载体：**一个第一方官方插件 `gamos`**（`apps/zcode-cli/packages/gamos-plugin`），通过
ZCode 插件机制分发全部游戏领域能力：

- **Tool Fabric（MCP server）**：GameOS 工具（world/package/playtest/build/release/atlas/usage），
  带丰富可检索描述（ToolSearch 延迟加载），文件态存储于工作区 `.gamos/`。
- **World context provider（SessionStart Hook）**：把活动 World 的身份、GameIR 概要、包状态、
  最近构建与门禁状态注入会话上下文——报告认定的**最重要集成点**。
- **Release gate（PreToolUse Hook）**：发布调用前的门禁前置检查，未过门禁即以原因阻断。
- **Gamos Console（ui.surfaces 面板）**：World 总览、包审计、试玩证据、门禁清单与**用户审批**
  （审批按钮仅面板可见）。
- **角色包（agents/）**：8 个游戏专家子代理（策划/玩法工程/关卡/资产/引擎/QA 试玩/性能/构建发布）。
- **技能与命令（skills/ + commands/）**：world-creation、spark-design、asset-intake、playtest、
  performance、release、workflows 七类技能；`/world-inspect`、`/spark-create`、`/game-playtest`、
  `/asset-audit`、`/performance-check`、`/prepare-release` 六个命令。
- **Dynamic Workflow 模板（templates/workflows/）**：create-world、asset-intake、game-qa、
  prepare-release 四个 `.dwf.ts` 保存式工作流（typed asks、阶段、证据产物）。

## 4. 阶段路线（对齐审计报告的 Phase 1–4）

- **P1 基础与上下文**（本规格）：插件骨架、World/GameIR/包模型、Tool Fabric、世界上下文注入、
  Gamos Console 面板、权限映射（审批边界）。
- **P2 从创意到可玩**：Spark（小型可玩浏览器游戏）创作闭环：world-creation/spark-design 技能 +
  角色子代理 + 工作流模板；引擎首选 `web`（浏览器可直接运行与试玩），PlayCanvas 等引擎适配
  以引擎绑定字段预留。
- **P3 质量与证据**：`/game-playtest` + Browser Use 的浏览器试玩闭环、证据记录、性能预算检查、
  发布门禁与用户审批。
- **P4 创作者生产力**：World Atlas（系统/关卡/资产/依赖地图）、资产审计、包权利扫描、
  使用统计。World Atlas 生成自 GameIR 与包图投影，保持与源数据区分。

P5/P6（远程 GPU 构建、常驻服务端调度、第三方引擎插件生态）超出本规格，后续另立。

## 5. 验收场景

1. 新任务"创建一个 3D 无尽跑酷"→ 会话注入世界上下文 → Agent 经 ToolSearch 发现 gamos 工具 →
   建 World/GameIR → 注册包 → 记录构建与试玩证据 → 门禁与审批就绪。
2. Agent 在无用户审批时调用发布工具 → PreToolUse Hook 与服务端门禁双层阻断，返回缺失门禁明细。
3. Gamos Console 面板展示活动 World 全量状态，用户点按批准 → 发布放行并记录发布历史。
4. 上游 ZCode 的任务/会话/插件市场行为不因安装 gamos 而改变（可禁用、可卸载、可恢复内置）。

## 6. 规格间关系

- 插件与 GameOS 契约细节：`docs/gamos/gamos-plugin-spec.md`
- 发布门禁与审批边界：`docs/gamos/gamos-release-gates.md`
- Dynamic Workflow 模板契约沿用 `docs/dynamic-workflow/authoring.md`，不在本目录重复。
