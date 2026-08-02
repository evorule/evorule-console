<!--
  Copyright 2026 EvoRule Project
  SPDX-License-Identifier: CC-BY-4.0
-->

# evorule-console 功能规格

> **Status**: v0.1.0
> **依赖**: [`BOUNDARY.md`](./BOUNDARY.md)
> **本文档定位**: 把边界决策具体化为可实现的接口签名、视图划分、模块定义、嵌入判定
> **不含**: 具体 UI 布局/交互细节(留给实现阶段)、大众版扩展(见大众版仓)

---

## 0. 范围与依据

本文档基于 BOUNDARY.md 的边界决策,具体化以下内容:

1. **执行后端抽象接口**(§6 的接口签名)
2. **UI 视图划分**(去掉旧 console 的 AI 对话,定义 evorule-console 的视图)
3. **功能模块**(对应 evorule 6 大本质属性)
4. **ttd 嵌入方式**(按 §8.1 性能优先原则逐一判定)
5. **开发期执行后端**(HTTP 实现说明)

**端点依据**:evorule-server 仓的 HTTP 端点(从本仓 `src/lib/ttd/core/api.js` 的端点对齐验证和 `src/lib/backend/http-backend.ts` 的实现推导)。

---

## 1. 执行后端抽象接口(核心)

> 这是 §6 的具体化。evorule-console 只依赖此抽象接口,不绑定 HTTP。
> 大众版提供 HTTP 实现,高级版提供 Tauri 嵌入式实现。

### 1.1 数据契约

复用现有 console client 的类型 + 补全写操作所需:

```typescript
type SessionId = number;

/** reactor 运行态(复用 evorule-server.js ReactorState) */
interface ReactorState {
  phase: "idle" | "awaiting_io" | "stable" | "error";
  causal_depth: number;
  current_step: number;
  pending_io_count: number;
  structural_invariant_violations: number;
}

/** session 当前快照(复用 SessionState) */
interface SessionState {
  payload: object;
  queue: unknown[];
  reactor: ReactorState;
  version: number;
}

/** 审计链(字段对齐 ttd api.js 修复 3:fact_count + verified) */
interface SessionAudit {
  entries: unknown[];
  fact_count: number;
  verified: boolean;
  last_hash?: string;
}

interface VerifyResult {
  verified: boolean;
  detail?: string;
}

/** fact log 一条(7 种 type,具体字段由 evorule 核心定) */
interface Fact {
  type: string;
  id: number;
  [key: string]: unknown;
}

/** diff 结果(对齐 ttd api.js 修复 2:items 是数组格式) */
interface DiffResult {
  items: Array<[string, unknown] | [string, unknown, unknown]>;
}

interface CausalChain {
  chain: Fact[];
}

interface CommandResult {
  accepted: boolean;
  version?: number;
  error?: string;
}
```

### 1.2 执行后端接口定义

```typescript
/**
 * evorule-console 的执行后端抽象接口。
 * evorule-console 只依赖此接口,不绑定具体实现(HTTP / 嵌入式 / WASM)。
 * 大众版提供 HttpBackend 实现,高级版提供 EmbeddedBackend 实现。
 */
interface ExecutionBackend {
  // === 会话管理 ===
  health(): Promise<boolean>;
  createSession(): Promise<SessionId>;
  listSessions(): Promise<SessionId[]>;
  closeSession(id: SessionId): Promise<void>;
  getSessionState(id: SessionId): Promise<SessionState>;

  // === 命令执行(展现"确定性执行") ===
  submitCommand(id: SessionId, instruction: object): Promise<CommandResult>;

  // === 历史 / 回放(展现"可回放") ===
  getHistory(id: SessionId): Promise<unknown>;
  getReplay(id: SessionId, from?: number, to?: number | null): Promise<Fact[]>;
  getFacts(id: SessionId, prefix?: string): Promise<Fact[]>;

  // === 审计(展现"可审计") ===
  getAudit(id: SessionId): Promise<SessionAudit>;
  verifyAudit(id: SessionId): Promise<VerifyResult>;
  getCausalChain(id: SessionId, factId: number): Promise<CausalChain>;

  // === 时间旅行(展现"可回放"的回溯能力) ===
  getStateAtVersion(id: SessionId, version: number): Promise<SessionState>;
  getDiff(id: SessionId, a: number, b: number): Promise<DiffResult>;

  // === What-If 假设分析 ===
  forkSession(parentId: SessionId, version: number): Promise<SessionId>;
}
```

### 1.3 HTTP 实现映射(开发期 / 大众版)

| 接口方法          | evorule-server 端点                                  | 方法   |
| ----------------- | ---------------------------------------------------- | ------ |
| health            | GET /api/health                                      | GET    |
| createSession     | POST /api/sessions                                   | POST   |
| listSessions      | GET /api/sessions                                    | GET    |
| closeSession      | DELETE /api/sessions/{id}                            | DELETE |
| getSessionState   | GET /api/sessions/{id}/state                         | GET    |
| submitCommand     | POST /api/sessions/{id}/command (body:{instruction}) | POST   |
| getHistory        | GET /api/sessions/{id}/history                       | GET    |
| getReplay         | GET /api/sessions/{id}/replay?from=&to=              | GET    |
| getFacts          | GET /api/sessions/{id}/facts?prefix=                 | GET    |
| getAudit          | GET /api/sessions/{id}/audit                         | GET    |
| verifyAudit       | GET /api/sessions/{id}/audit/verify                  | GET    |
| getCausalChain    | GET /api/sessions/{id}/audit/causal/{factId}         | GET    |
| getStateAtVersion | GET /api/sessions/{id}/rewind?version=               | GET    |
| getDiff           | GET /api/sessions/{id}/diff?a=&b=                    | GET    |
| forkSession       | POST /api/sessions/fork/{parentId}?version=          | POST   |

> 端点依据:本仓 `src/lib/ttd/core/api.js` 已验证可用(ttd v1.0,49/51 PASS),`src/lib/backend/http-backend.ts` 是其 TS 全功能超集。

---

## 2. UI 视图划分

### 2.1 视图清单(5 视图,对应 evorule 6 大本质)

| 视图                    | 展现的 evorule 属性      | 数据来源(执行后端)                      | 实现位置                      |
| ----------------------- | ------------------------ | --------------------------------------- | ----------------------------- |
| **规则库** RuleLibrary  | 规则即数据               | 本地规则文件(不调后端)                  | `src/lib/views/RuleLibrary/`  |
| **执行台** ExecutionPad | 确定性执行 + JSON-in/out | submitCommand + getSessionState         | `src/lib/views/ExecutionPad/` |
| **状态视图** StateView  | JSON-in/out 自解释       | getSessionState                         | `src/lib/views/StateView/`    |
| **审计视图** AuditView  | 可审计 + TCB 纯净        | getAudit + verifyAudit + getCausalChain | `src/lib/views/AuditView/`    |
| **时间旅行** TimeTravel | 可回放                   | 嵌入 ttd 副本(见 §4)                    | `src/lib/views/TimeTravel/`   |

### 2.2 各视图职责

**规则库**:

- 加载 / 编辑 / 保存 JSON 规则文件
- 规则列表 + 详情 + 编辑器(JSON 语法)
- 验证规则格式(L_console 预校验 G1-G7)
- 体现"规则即数据":业务专家改 JSON,无需编程

**执行台**:

- 选择规则 + 输入 JSON payload → 提交命令(submitCommand)
- 展示执行结果(同输入同输出,可视化"确定性")
- 多次提交看状态流转

**状态视图**:

- 当前 session 的 payload(可折叠 JSON 树 + 语法高亮)
- reactor 状态(phase/step/causal_depth/pending_io)
- 体现"JSON-in/out 自解释":用户直接读 JSON 理解状态

**审计视图**:

- 完整审计链(entries 列表)
- blake3 哈希验证(verifyAudit,显示 verified ✅/❌)
- 因果追溯(getCausalChain,点击 fact 看因果链)
- 体现"可审计 + TCB 纯净":每个决策可追溯,不可篡改

**时间旅行**(嵌入 ttd 副本):

- Timeline / State / Diff / Causal / What-If 5 视图
- rewind / diff / causal / fork 假设分析
- 体现"可回放":任意过去状态可重放、对比、假设

### 2.3 不含的(边界呼应)

- ❌ **ConversationPanel**(对话式创建)—— 依赖 AI,evorule-console 不含 LLM
- ❌ 任何 LLM 集成 —— 见 BOUNDARY §3

---

## 3. 功能模块(对应 evorule 6 大本质)

| evorule 属性       | 功能模块    | 实现位置                    |
| ------------------ | ----------- | --------------------------- |
| JSON-in/out 自解释 | JSON 可视化 | 状态视图 + 执行台           |
| 确定性执行         | 执行引擎    | 执行台                      |
| 可回放             | 时间旅行    | 时间旅行视图(嵌入 ttd 副本) |
| 可审计             | 审计验证    | 审计视图                    |
| 规则即数据         | 规则管理    | 规则库                      |
| TCB 纯净           | (隐含)      | 消费 evorule 核心,0 依赖    |

**模块依赖关系**:

```
规则库 ──提供规则──▶ 执行台 ──提交命令──▶ 执行后端
                       │
                       ├──状态──▶ 状态视图
                       ├──审计──▶ 审计视图
                       └──历史──▶ 时间旅行(嵌入 ttd 副本)
```

---

## 4. ttd 嵌入方式(按 §8.1 性能优先原则判定)

ttd 源码已整体复制进 `src/lib/ttd/`(见 `src/lib/ttd/VERSION.md`):

```
src/lib/ttd/
├── algorithms/   (deep-diff, dag-layout, json-tree — 纯函数算法)
├── components/   (fact-card, json-viewer, diff-tree, slider, ...)
├── views/        (timeline, state, diff, causal, whatif — 视图编排)
└── core/         (api / dom / eventbus / store)
```

### 4.1 逐层判定

| ttd 层          | 性能敏感度 | 嵌入方式 | 理由                                                                       |
| --------------- | ---------- | -------- | -------------------------------------------------------------------------- |
| **algorithms/** | 🔴 高      | 直接复制 | 计算密集纯函数(deep-diff 递归 / dag-layout 布局),跨边界调用开销不可接受    |
| **components/** | 🟡 中      | 直接复制 | 渲染密集(fact-card 列表 / json-viewer 树),复制后可在 SvelteKit 直接 import |
| **views/**      | 🟡 中      | 直接复制 | 视图编排含 DOM 操作,复制后适配 SvelteKit 组件包装                          |

### 4.2 结论:ttd 整体直接复制

- **判定**:ttd v1.0 源码整体复制进 `src/lib/ttd/`
- **理由**:ttd 是 vanilla JS ES modules,SvelteKit 可直接 import,无需重写;3 层都性能敏感或中等,无一刀切用接口引用的理由
- **代价**:ttd 升级时 evorule-console 要手动同步(但 ttd 已 v1.0 稳定,升级频率低)
- **替代方案**(否决):iframe 嵌入 ttd/index.html —— 跨边界 postMessage 开销大,且样式/交互割裂

### 4.3 同步策略

- ttd 在原仓(evorule-application)独立维护(可单独发布)
- evorule-console 复制 ttd 源码时,记录版本号(`src/lib/ttd/VERSION.md`,标注 copied from ttd v1.0)
- ttd 升级时,在 evorule-console 的 CHANGELOG 记录同步

---

## 5. 开发期执行后端(HTTP 实现)

> 开发期 evorule-console 需要能跑的开发后端(BOUNDARY §6 开发期实现说明)。

**实现**:`HttpBackend` 类实现 `ExecutionBackend` 接口,调本地 evorule-server loopback(127.0.0.1:18080)。源码在 `src/lib/backend/http-backend.ts`。

**关键**:

- 这个 `HttpBackend` 属于 evorule-console 的"开发期实现",不是 evorule-console 边界的一部分
- 大众版会继承并扩展这个 HTTP 实现(加联网能力)
- 高级版用 `EmbeddedBackend`(Tauri + Rust link evorule crate)替代,不联网

**实现依据**:

- `src/lib/backend/http-backend.ts` 实现了 15 方法全功能(含写操作和高级查询)
- 端点对齐 `src/lib/ttd/core/api.js` 的 4 项修复(rewind path / diff items 格式 / audit 字段 / verify 字段)

---

## 6. 不做的事(边界呼应)

| 不做                            | 原因                                   |
| ------------------------------- | -------------------------------------- |
| 不做 LLM 集成                   | BOUNDARY §3,LLM 是大众版/高级版扩展    |
| 不做联网(本仓内核)              | BOUNDARY §3,联网是大众版实现层         |
| 不做 AI 对话(ConversationPanel) | 依赖 AI,违反边界                       |
| 不重写时间旅行算法              | §4 嵌入 ttd 副本,避免重复造轮子        |
| 不绑定 HTTP                     | §1 抽象接口,HTTP 只是开发期/大众版实现 |

---

_本文档是功能规格,定义"做什么"和"接口长什么样",不是实现代码。实现见 [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)。_
