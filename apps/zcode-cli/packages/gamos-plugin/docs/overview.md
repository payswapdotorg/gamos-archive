# Gamos 用户指南（Gamos Console & 工作流）

Gamos 把本编程代理演进为游戏原生环境：以 **World**（世界）为单位的游戏项目、版本化的
**GameIR**（游戏定义）、带权利与出处的**包图**、可追溯的**试玩证据**、五道**发布门禁**
（用户审批只能在 Gamos Console 完成）。

## 快速开始

1. 在插件市场安装并启用 **Gamos**（官方内置插件）。
2. 直接对代理说"创建一个 3D 无尽跑酷"或运行 `/spark-create <想法>` —— 代理会经
   ToolSearch 发现 gamos 工具，建 World、写 GameIR、产出可玩构建并记录试玩证据。
3. 打开 **Gamos Console** 面板查看世界状态、包审计、试玩证据与门禁清单。

## 六个命令

| 命令 | 用途 |
| --- | --- |
| `/world-inspect [world]` | 世界全景（GameIR/包/构建/试玩/门禁） |
| `/spark-create [想法]` | 从想法到可玩（设计→构建→试玩→证据） |
| `/game-playtest [场景]` | 结构化试玩（smoke / core-loop / full）并记录证据 |
| `/asset-audit [world]` | 资产权利与出处审计 |
| `/performance-check [world]` | 性能预算对比（基于证据） |
| `/prepare-release [版本]` | 门禁→修复→审批请求→（用户批准后）发布 |

## 发布审批（仅面板）

`/prepare-release` 走到门禁全绿后，代理会请求审批；**你必须**在 Gamos Console 面板点击
「Approve release」。`release_approve` 是面板专用工具，不在代理工具列表里 —— 代理不能自批。

## 工作流模板

`scripts/workflows/` 内置四个 Dynamic Workflow 模板（create-world / asset-intake /
game-qa / prepare-release）。安装到项目后可从运行面板或 `CreateWorkflow{saved}` 启动：

```
mkdir -p .zcode/workflows && cp "<插件根>/scripts/workflows/"*.dwf.ts .zcode/workflows/
```

## 状态目录

`.gamos/`（项目根）是唯一事实源：`worlds/<id>/{world,gameir,packages,builds,playtests,releases}.json`。
所有变更经 gamos 工具完成；请勿手改。
