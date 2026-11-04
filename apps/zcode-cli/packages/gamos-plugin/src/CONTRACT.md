# gamos-panel 契约

Gamos 插件的核心模块：GameOS 领域层（World/GameIR/包图/构建/试玩证据/发布门禁）、
Tool Fabric（MCP server，17 个工具）与 Gamos Console 面板。

## 提供的能力

- **状态存取**（`lib/store.ts`）：`.gamos/` 文件态唯一事实源；原子写；目录缺失＝空态。
- **领域操作**（`gameos/`）：
  - `worlds.ts` — World 创建/更新/列表/详情（GameIR 替换自动 version+1）。
  - `packages.ts` — 包注册、intake 校验（rights/provenance/engine-compat/file-exists/deps-resolve）、包图。
  - `evidence.ts` — 构建记录（sha256 digest 溯源）与试玩证据（绑定 build digest）。
  - `release.ts` — 五门禁评估、审批、发布、World Atlas 投影、使用统计。
  - `console-state.ts` — `gamos://state` 面板数据聚合。
- **Tool Fabric**（`mcp/`）：`createGamosServer()`；工具返回 `{data}|{error}` 信封；
  `release_approve` 为 app-only（不进模型工具列表）。
- **Console 面板**（`ui/`）：ext-apps 宿主桥 + 只读状态 + 审批/切换活动世界。

## 依赖

- 外部 npm：`@modelcontextprotocol/sdk`（server）、`@modelcontextprotocol/ext-apps`（面板，构建期）、`zod`（校验与 JSON Schema 合成）。
- 不依赖任何 `@zcode/*` workspace 模块（requires: []）——与宿主只经 MCP 协议与插件机制交互。

## 稳定接口

`index.ts`（公共入口）导出：`createGamosServer`、`buildConsoleState`、`GameOSStore`、
领域操作与全部契约常量/类型（`contract.ts`）。工具名、URI、信封形状以 `contract.ts` 为准，
面板与 hook 脚本只依赖该文件约定的形状。

## 边界规则

- 领域层不 import MCP SDK（`gameos/` 只依赖 `lib/` 与 `contract.ts`），保证可独立测试。
- 面板（`ui/`）不直接读文件，只经 MCP 资源与工具。
- 发布门禁评估只此一处（`release.ts evaluateGates`），hook 与面板均复用同一语义。
