# Gamos 发布门禁规格（gamos release gates）

日期：2026-11-03 · 状态：已采纳 · 上游规格：`docs/gamos/gamos-plugin-spec.md` §4

## 1. 目标

让"游戏可以发布"成为一个**可验证**的状态而非 Agent 的自述：发布（`world_publish`）前必须同时
满足五道门禁；用户审批是其中唯一由人决策的一道，且**不能被 Agent 代行**。

## 2. 门禁定义（评估顺序即报告顺序）

| # | 门禁 id | 通过条件 | 失败细节字段 |
| --- | --- | --- | --- |
| 1 | `gameir-complete` | GameIR 具备 `coreLoop` ≥1、`mechanics` ≥1、`levels` ≥1、`winCondition`、`loseCondition` | `missing: string[]` |
| 2 | `packages-validated` | 包图非空且全部包 `validation.status === "valid"` | `invalid: string[]`（包名 + 失败检查） |
| 3 | `build-exists` | 存在目标档位的最新构建且 `digest` 非空 | `builds: number`（现有构建数） |
| 4 | `playtest-evidence` | 该构建 digest 至少一条 `verdict === "pass"` 的试玩记录 | `latest: string`（最近一次结论） |
| 5 | `user-approval` | 存在 `approvedAt` 非空、`scope === "publish"` 的审批记录 | `pending: string[]`（待审批 id） |

- 评估入口：`release_gate_check`（持久化最近报告）、`world_inspect`（附带评估）、
  `world_publish`（发布前强制复评）。
- 每道门禁输出 `{ id, status: "pass"|"fail", detail }`；总状态 `green` 当且仅当五道全 pass。

## 3. 审批边界（防自批）

- `release_request_approval`（Agent 可调）只创建 `approvals[]` 记录（`requestedAt`，无 `approvedAt`）。
- `release_approve` 声明 `_meta.ui.visibility = ["app"]`：宿主不把它放进模型工具列表，仅
  Gamos Console 面板可调（用户点按）。`approvedBy` 恒为 `user`。
- 审批一次对应一次发布意图；`world_publish` 成功后消费最新审批（记录 `approvalId`），此后再次
  发布需重新请求审批。
- 纵深防御：即使工具列表被绕过，服务端 `world_publish` 仍复评五门禁；PreToolUse hook 在宿主层
  再前置一次（见 §4）。三层中**服务端为权威**，hook 与宿主审批链为反馈/防线。

## 4. PreToolUse hook（反馈层）

- matcher：`mcp__plugin_gamos_gamos__world_publish`（正则串）。
- 逻辑：读 `.gamos/` 复算门禁与审批；未全绿 ⇒ exit 2 + stderr 原因（宿主转为工具拒绝理由）；
  `.gamos/` 缺失/损坏/世界不存在 ⇒ 放行（交给服务端裁决，hook 不越权阻断合法场景）。
- 超时 60s 内完成（纯本地文件读，毫秒级）。

## 5. 发布记录（publications）

`world_publish` 成功 ⇒ 追加 `publications[]`：`version`（语义化，缺省自动递增 patch）、`channel`
（`preview|stable`）、`buildId/buildDigest`（溯源）、`gateReport` 快照（发布时刻门禁全貌）、
`approvalId`、`publishedAt`、`localUrl`（本地构建入口路径；外部部署渠道属 P5，不在此列）。
World `status` 置为 `released`。发布不可静默：任何门禁从绿转红（新包失效、新试玩失败）后，
下一次 `world_publish` 复评会再次拦截。

## 6. 验收

1. 无审批 + 无试玩证据时，Agent 路径 `world_publish` 与 hook 路径都被拒，错误包含缺失门禁明细。
2. 面板审批（`release_approve`）后、补齐试玩证据前，发布仍被 `playtest-evidence` 拦截。
3. 五门禁全绿后发布成功，`publications[]` 含门禁快照与审批引用；重复发布需重新审批。
4. `world_publish` 对不存在的 World 返回 `not_found`，不产生任何写入。
