<!--
  Copyright 2026 EvoRule Project
  SPDX-License-Identifier: CC-BY-4.0
-->

# evorule-console 实施计划

> **Status**: v0.1.0
> **依赖**: [`BOUNDARY.md`](./BOUNDARY.md) + [`SPEC.md`](./SPEC.md)
> **本文档定位**: 把 SPEC 的功能规格拆解为可执行的实施阶段 + 文件级任务清单
> **实施原则**: 分阶段,每阶段独立可验证;基础先行(执行后端 → 视图);ttd 整体直接复制(性能优先)

---

## 0. 概述

基于 SPEC.md,分 **7 阶段**实施 evorule-console。每阶段产出可独立验证的成果,基础先行(执行后端 → 视图 → 集成)。

**实施位置**:在现有 `evorule-console/` 目录重组(保留 SvelteKit 配置,替换旧 AI 对话组件)
**技术栈**:SvelteKit 5 + TypeScript + adapter-static(可打包静态/本地 web 包)
**ttd 嵌入**:ttd v1.0 源码已整体复制进 `src/lib/ttd/`(SPEC §4.2,已完成)

---

## 1. 目标目录结构

重组后的 `evorule-console/` 结构:

```
evorule-console/
├── package.json                    (保留,SvelteKit 5)
├── svelte.config.js                (保留,adapter-static)
├── vite.config.ts                  (保留)
├── tsconfig.json                   (保留)
├── src/
│   ├── app.html / app.css / app.d.ts   (保留)
│   ├── routes/
│   │   ├── +layout.svelte          (导航 + 5 视图切换)
│   │   └── +page.svelte            (主视图容器)
│   ├── lib/
│   │   ├── backend/                ★ 阶段1:执行后端
│   │   │   ├── types.ts             (数据契约 + ExecutionBackend 接口)
│   │   │   ├── http-backend.ts       (HttpBackend 实现,调 evorule-server)
│   │   │   └── backend-context.ts   (Svelte context 注入)
│   │   ├── views/                   ★ 阶段2-5:5 视图
│   │   │   ├── RuleLibrary/         (阶段2:规则库)
│   │   │   ├── ExecutionPad/        (阶段3:执行台)
│   │   │   ├── StateView/           (阶段3:状态视图)
│   │   │   ├── AuditView/           (阶段4:审计视图)
│   │   │   └── TimeTravel/          (阶段5:嵌入 ttd)
│   │   ├── ttd/                     ★ 阶段5:复制的 ttd 源码
│   │   │   ├── algorithms/          (deep-diff, dag-layout, json-tree)
│   │   │   ├── components/          (fact-card, json-viewer, diff-tree, ...)
│   │   │   ├── views/              (timeline, state, diff, causal, whatif)
│   │   │   └── core/               (store, eventbus, dom, api)
│   │   ├── stores/                  (会话状态、当前视图等 Svelte stores)
│   │   └── utils/                   (通用工具)
│   └── static/
└── tests/
    ├── unit/                       (vitest)
    └── e2e/                        (playwright, 替换旧 llm-conversation.spec)
```

**清理掉的旧组件**(阶段0):

- ConversationPanel.svelte(AI 对话,evorule-console 不含 LLM)
- SimpleMode.svelte / AdvancedMode.svelte / ModeToggle.svelte(旧模式切换)
- stores/mode.ts(旧模式状态)
- tests/llm-conversation.spec.ts(AI 对话测试)

**保留复用的**:

- SvelteKit 配置(package.json/svelte.config/vite.config)
- src/lib/api/evorule-server.js(参考,补全为 http-backend.ts)
- src/lib/validators/ruleValidator.ts(规则验证,阶段2复用)

---

## 2. 实施阶段

### 阶段 0:项目重组 + 清理旧代码(2026-08-02)

**目标**:清理旧 AI 对话方向代码,建立 evorule-console 目录骨架。

**任务**:

- 删除旧组件:ConversationPanel/SimpleMode/AdvancedMode/ModeToggle
- 删除旧 stores:stores/mode.ts
- 删除旧测试:tests/llm-conversation.spec.ts
- 创建新目录:src/lib/backend/, src/lib/views/{5个视图}/, src/lib/ttd/, src/lib/stores/
- 更新 +page.svelte(临时占位,后续阶段填充)
- 验证 `npm run dev` 能启动(空壳)

**验收标准**:SvelteKit 启动通过,无旧 AI 对话代码残留。

---

### 阶段 1:执行后端抽象 + HttpBackend(基础,所有视图依赖)(2026-08-02)

**目标**:实现 SPEC §1 的执行后端抽象接口 + HTTP 实现。

**任务**:

- `backend/types.ts`:定义数据契约(ReactorState/SessionState/SessionAudit/Fact/DiffResult 等)
- `backend/types.ts`:定义 `ExecutionBackend` 接口(15 方法,SPEC §1.2)
- `backend/http-backend.ts`:实现 `HttpBackend` 类(调 evorule-server loopback:18080)
  - 复用现有 `api/evorule-server.js` 的只读部分
  - 补全写操作:submitCommand / forkSession / closeSession
  - 补全高级查询:getDiff / getCausalChain / verifyAudit / getStateAtVersion
- `backend/backend-context.ts`:Svelte context 注入(让组件获取 backend 实例)
- 单元测试:`backend/http-backend.test.ts`(用 mock fetch 测试各方法)

**验收标准**:

- TypeScript 接口编译通过(`npm run check`,backend 代码 0 错误)
- HttpBackend 各方法返回正确数据格式(对齐 evorule-server 端点 + ttd api.js 4 修复)
- 单元测试通过(34 个测试全 PASS,覆盖 15 方法 + 端点对齐 + 错误处理)

**产出文件**:

- `src/lib/backend/types.ts` (数据契约 + ExecutionBackend 接口,15 方法)
- `src/lib/backend/http-backend.ts` (HttpBackend 实现 + HttpBackendError)
- `src/lib/backend/backend-context.ts` (provideBackend / useBackend / useBackendOrNull)
- `src/lib/backend/http-backend.test.ts` (34 个测试用例)

**端点对齐验证**:

- 修复 1: rewind 用 `?version=N`(非 `/rewind/{v}`)
- 修复 2: diff items 是数组 `["key", value]` / `["key", old, new]`(非对象)
- 修复 3: audit 字段 `fact_count + verified`(非 `last_audited_version`)
- 修复 4: verify 字段 `verified`(非 `valid`)
- submitCommand body 是 `{ instruction }`(对齐 ttd api.js)
- fork 端点 `/sessions/fork/{parentId}?version=`

**依赖**:无(最基础)

---

### 阶段 2:规则库视图(规则即数据)(2026-08-02)

**目标**:实现 SPEC §2.1 的规则库视图,展现"规则即数据"。

**任务**:

- `views/RuleLibrary/RuleLibrary.svelte`:规则列表 + 详情 + 编辑
- `views/RuleLibrary/RuleEditor.svelte`:JSON 规则编辑器(实时 G1-G7 校验)
- 复用 `validators/ruleValidator.ts`(规则格式验证,已重构为 L_console 预校验)
- 规则文件加载/保存(localStorage 持久化 + 导入/导出 JSON 文件)
- 示例规则(`example-rules.ts` 3 个示例:set_basic / branch_vip / io_two_phase)
- 单元测试:`rule-library.test.ts`(29 测试全 PASS)

**附加产出**:

- `validators/ruleValidator.ts` 重构为 L_console 预校验器(逻辑不变,文档头重写 + 7 G 加跨仓 SPEC 引用)
- `validators/GATE_ALIGNMENT.md`:门禁分层文档(L_console ↔ L0 映射 + 同步策略 + UI 暴露策略)

**验收标准**:

- 能加载/编辑/保存 JSON 规则(localStorage 持久化 + 文件导入/导出)
- 规则格式验证正确(实时 G1-G7 显示,7 项全过才能保存)
- 体现"规则即数据":业务专家可读可改,带描述/版本元数据
- 内置 3 个示例规则全部 PASS L_console G1-G7(对齐核心仓 T1/T2/D2)
- builtin 规则保护:不可直接改/删,需 duplicate 为 user 副本
- 持久化:user 规则 localStorage 存储,模块重载后恢复

**产出文件**:

- `src/lib/views/RuleLibrary/RuleLibrary.svelte` (列表 + 详情)
- `src/lib/views/RuleLibrary/RuleEditor.svelte` (编辑器 + 实时 G1-G7 校验面板)
- `src/lib/views/RuleLibrary/example-rules.ts` (3 个内置示例)
- `src/lib/views/RuleLibrary/rule-library.test.ts` (29 测试)
- `src/lib/stores/rules.ts` (rules store + actions)
- `src/lib/validators/ruleValidator.ts` (重构为 L_console 预校验器)
- `src/lib/validators/GATE_ALIGNMENT.md` (门禁分层文档)

**依赖**:无(本地文件,不依赖后端)

---

### 阶段 3:执行台 + 状态视图(确定性执行 + JSON-in/out)(2026-08-02)

**目标**:实现 SPEC §2.1 的执行台 + 状态视图,展现"确定性执行 + JSON-in/out"。

**任务**:

- `views/ExecutionPad/ExecutionPad.svelte`:输入 JSON + 提交命令(submitCommand)
- `views/ExecutionPad/ExecutionPad.svelte`:展示执行结果(同输入同输出,可视化"确定性")
- `views/StateView/StateView.svelte`:当前 payload 可视化(折叠 JSON 树)
- `views/StateView/StateView.svelte`:reactor 状态(phase/step/causal_depth/pending_io)
- 会话管理:createSession / listSessions / 切换 session
- 单元测试:执行流程

**验收标准**:

- 能创建 session、提交命令、看状态流转
- payload 以折叠 JSON 树展示(可读,JsonTree + JsonNode 递归组件)
- 多次同输入提交,结果一致("重复上次"按钮 + 对比 badge 可视化"确定性")
- `npm run check` 0 错误,`npm run test` 全 PASS

**产出文件**:

- `src/lib/views/ExecutionPad/ExecutionPad.svelte` (执行台 + session 选择 + 历史)
- `src/lib/views/StateView/StateView.svelte` (reactor 状态 + payload JSON 树)
- `src/lib/views/StateView/JsonTree.svelte` (JSON 树入口,复用 JsonNode)
- `src/lib/views/StateView/JsonNode.svelte` (递归节点,Svelte 5 self-import)
- `src/lib/stores/session.ts` (sessions/currentSessionId/sessionState/commandHistory + 7 actions)
- `src/lib/stores/session.test.ts` (22 测试,MockBackend)

**依赖**:阶段 1(ExecutionBackend)

---

### 阶段 4:审计视图(可审计 + TCB 纯净)(2026-08-02)

**目标**:实现 SPEC §2.1 的审计视图,展现"可审计"。

**任务**:

- `views/AuditView/AuditView.svelte`:审计链列表(entries)
- `views/AuditView/AuditView.svelte`:blake3 哈希验证(verifyAudit,显示 ✅/❌)
- `views/AuditView/AuditView.svelte`:因果追溯(getCausalChain,点击 fact 看因果)
- 单元测试:审计数据展示

**验收标准**:

- 审计链完整展示(fact_count / verified / last_hash 摘要 + entries 列表)
- 哈希验证状态可见(verifyAudit 按钮 + verified badge + detail 折叠)
- 点击 fact 能看因果链(右侧侧栏,展示 factId 对应的因果链)
- TCB 纯净说明区(明确审计权威在 L0 核心仓,前端只展示)
- `npm run check` 0 错误,`npm run test` 全 PASS

**产出文件**:

- `src/lib/stores/audit.ts` (auditData/verifyResult/causalSelection + 5 actions,与 session store 解耦)
- `src/lib/stores/audit.test.ts` (16 测试,MockBackend)
- `src/lib/views/AuditView/AuditView.svelte` (摘要 + entries + 因果侧栏 + TCB 说明)

**附加清理**(阶段0漏网旧组件):

- 删除 `src/lib/components/` 目录 6 个孤儿组件(RuleDetail/RuleDialog/RuleLibrary/RuleList/TestBench/TopBar)
- 这些是阶段0清理 ConversationPanel 时漏网的旧 AI 方向 mock 组件,无任何引用
- 删除后 `npm run check` 从 2 errors / 2 warnings → 0 errors / 0 warnings

**设计要点**:

- `audit` store 不反向 import `session` store(避免循环依赖),组件层注入 sessionId
- `refreshAudit(backend, id: SessionId)` 的 id 必传(TS 强制),不持有 backend 实例
- `verifyAuditChain` 成功时同步更新 `auditData.verified`,保持状态一致

**依赖**:阶段 1(ExecutionBackend)

---

### 阶段 5:时间旅行视图(嵌入 ttd,可回放)(2026-08-02)

**目标**:实现 SPEC §4 的 ttd 嵌入,展现"可回放"。

**任务**:

- ttd v1.0 源码整体复制进 `src/lib/ttd/`(19 个源文件,见 `src/lib/ttd/VERSION.md`)
- 记录 ttd 版本号(`ttd/VERSION.md`,标注 copied from ttd v1.0 + 适配点 + 同步策略)
- `views/TimeTravel/TimeTravel.svelte`:Svelte 组件包装 ttd 5 视图
  - 适配:`main.js` 的自动 `init()` → `export function initTtd(opts)`(Svelte onMount 显式触发)
  - 适配:console 的 `ExecutionBackend` → ttd 的 `api` 单例(`console-adapter.ts` `injectBackend`)
  - 算法层(algorithms/)直接复用(纯函数,零适配成本)
- 集成 ttd 的 timeline/state/diff/causal/whatif 5 视图(tabs + panels 结构 + eventbus 通信)
- 确认 ttd 嵌入后性能可接受(无跨边界调用开销 — 整体复制 + 单 backend 注入,无 iframe/IPC)

**验收标准**:

- ttd 5 视图在 evorule-console 内可用(timeline/state/diff/causal/whatif tabs + panels)
- rewind / diff / causal / what-if 功能正常(经 console-adapter 适配 console HttpBackend)
- 无性能退化(整体直接复制,无 iframe/接口引用开销 — 符合 SPEC §4.2 性能优先)
- `npm run check` 0 errors / 0 warnings
- `npx vitest run` 250 tests PASS(含 ttd 算法层 131 测试,与原仓对齐)

**产出文件**:

- `src/lib/ttd/` (ttd v1.0 整体复制副本,19 源文件 + 适配层)
  - `algorithms/` (deep-diff.js / dag-layout.js / json-tree.js — 纯函数,零适配)
  - `components/` (audit-badge / diff-tree / exporter / fact-card / json-viewer / session-list / slider)
  - `views/` (timeline / state / diff / causal / whatif — 5 视图逻辑不变)
  - `core/` (api / dom / eventbus / store — 零适配)
  - `styles/main.css` (ttd 原始 dark 主题样式)
  - `styles/console-scoped.css` (新增:所有选择器加 `.ttd-root` 前缀,避免污染 console light 主题)
  - `main.js` (适配:自动 `init()` → `export initTtd(opts)` + `export cleanupTtd()`)
  - `console-adapter.ts` (新增:console ExecutionBackend → ttd api 单例适配,15 方法映射)
  - `VERSION.md` (新增:版本标记 + 适配点说明 + 同步策略)
- `src/lib/views/TimeTravel/TimeTravel.svelte` (Svelte 包装组件)
- `src/lib/ttd/algorithms/deep-diff.test.ts` (vitest 版,48 测试)
- `src/lib/ttd/algorithms/dag-layout.test.ts` (vitest 版,33 测试)
- `src/lib/ttd/algorithms/json-tree.test.ts` (vitest 版,50 测试)

**设计要点**:

- **整体直接复制**(SPEC §4.2 性能优先):ttd 源码 19 文件原样复制,不通过 iframe/接口引用
- **最小适配**(VERSION.md 记录 3 处):① `main.js` 导出 `initTtd` ② 新增 `console-adapter.ts` ③ `console-scoped.css` 作用域隔离
- **单一 backend 真相源**:`console-adapter.injectBackend(backend)` 用对象属性赋值覆盖 ttd `api` 单例方法,ttd 各 view 仍 `import { api } from '../core/api.js'` 但调用已是 console 实现(避免双重 fetch / 双重 baseUrl / 双重错误处理 — 符合 TCB 纯净)
- **session 同步**:`syncSessionToTtd(sessionId)` 监听 console `currentSessionId` store 变化,自动同步给 ttd store + emit `SESSION_SELECT`(console 自己管理 session,`skipAutoSelect: true` 关闭 ttd 自动选)
- **样式隔离**:`console-scoped.css` 把 ttd 原 `:root` CSS 变量改为 `.ttd-root` 局部作用域,前缀所有选择器,删除 `html, body` 全局样式 — console light 主题不被 ttd dark 主题污染
- **vitest 迁移**:3 个算法层测试从 `node:test` + `node:assert/strict` 迁移到 vitest,测试逻辑不变(131 测试全 PASS,与原仓对齐)
- **checkJs 关闭**:`tsconfig.json` `checkJs: true → false`(console 是 TS-first,唯一 JS 是复制的 ttd vanilla 源码 + legacy `evorule-server.js` 参考文件,不应被 TS 严格检查 — 关闭后从 341 errors → 0)

**依赖**:阶段 1(ExecutionBackend 提供数据)+ ttd 源码(已存在)

---

### 阶段 6:集成 + 导航 + 打磨(2026-08-02)

**目标**:5 视图集成,导航完善,整体打磨。

**任务**:

- `routes/+layout.svelte`:顶部导航栏(品牌 + 5 视图 tab + 主题切换 + 连接徽标)
- `routes/+page.svelte`:主视图容器(根据 currentView 渲染 5 视图之一,懒加载)
- `stores/session.ts`:当前 session 状态(跨视图共享,阶段3 已完成,本轮复用)
- `stores/view.ts`:当前活动视图 + VIEW_LIST 元数据 + localStorage 持久化
- 主题/样式统一(layout 用 app.css 设计令牌,无新主题文件)
- e2e 测试(playwright):5 视图切换 + 主题 + 持久化 + 连接徽标(13 测试)
- README(README.md 重写,反映新 evorule-console 定位)

**验收标准**:

- 5 视图可切换,各视图功能正常(导航 tab aria-pressed 反映活动视图)
- 跨视图状态共享(session/rules/audit 在 Svelte stores,组件销毁不丢失)
- e2e 测试通过(13 测试全 PASS,无 flaky)
- `npm run build` 产出静态文件(adapter-static → `build/`)
- `npm run check` 0 errors / 0 warnings
- `npx vitest run` 265 tests PASS(含 view store 15 测试)

**产出文件**:

- `src/lib/stores/view.ts` (currentView store + VIEW_LIST 元数据 + setView/restoreView + localStorage 持久化)
- `src/lib/stores/view.test.ts` (15 测试:VIEW_LIST 元数据 / setView 持久化 / restoreView 恢复 + 非法值清理)
- `src/routes/+layout.svelte` (重写:顶部导航 5 tab + backend 注入 provideBackend + 主题切换 + 连接徽标 backend.health)
- `src/routes/+page.svelte` (重写:视图容器,根据 currentView 渲染 5 视图之一,懒加载避免 5 视图同时初始化)
- `playwright.config.ts` (chromium + webServer auto-start npm run dev)
- `tests/e2e/navigation.spec.ts` (13 e2e 测试:5 视图切换 + 主题 + 持久化 + 连接徽标 + 规则库离线可用)
- `README.md` (重写:无 LLM 规则引擎面板定位 + 5 视图 ↔ 7 本质 + 三层架构 + 开发/验证指南)

**设计要点**:

- **单页 + tab 切换**(非多路由):5 视图共享 session store,路由切换会丢组件状态;tab 切换 + store 持久化是正确模式
- **懒加载渲染**:`+page.svelte` 用 `{#if $currentView === ...}` 每次只渲染当前视图(destroy/recreate),未切到的视图不 mount(避免 5 视图同时初始化 + 抢 backend)
- **backend 在根注入**:`provideBackend()` 在 `+layout.svelte` 组件初始化时调用(setContext 要求),所有视图经 `useBackendOrNull()` 取用;高级版只改 root 一处换 EmbeddedBackend
- **连接徽标**:`backend.health()` onMount 后异步检测,三态(检测中🟡 / 已连接🟢 / 未连接🔴),直接反映 evorule-server 是否在线 — UX 友好(用户一眼知道要不要启动后端)
- **导航元数据驱动**:VIEW_LIST 绑定每个视图对应的 evorule 本质(规则即数据/确定性执行/...),导航 tab 的 title/副标题自动展示 — 体现"每视图 ≥1 本质"的 SPEC 验收矩阵
- **e2e hydration 竞态修复**:adapter-static prerender 在静态 HTML 渲染默认视图(规则库 active),用"规则库 tab active"作 hydration 信号会立即满足但 onclick 未绑定 → 点击竞态。改用 `data-theme` 属性(onMount 设置,prerender 不含)作可靠 hydration 信号,彻底消除 flaky

**依赖**:阶段 2-5(所有视图)

---

### 阶段 7:分仓 + 双形态改造 + v0.1.0 发布(待办)

**目标**:evorule-console 从 evorule-application 分仓到 gitee 公开仓 `evo-rule-lab/evorule-console`,改造为 SvelteKit 应用 + npm 包双形态,打 v0.1.0 tag。

**前置依据**:

- BOUNDARY.md §5.1(三独立仓模型)
- evorule-console 双形态设计(package.json exports + svelte-package 预编译)

**任务**:

- **阶段 7A:evorule-console 双形态改造**(在 evorule-application/portal/ 内完成,验证后再迁出)
  - 修订 `package.json`:name 改 `@evorule/console`,version `0.1.0`,加 `exports` / `files` / `prepack` 脚本
  - 新增 `src/lib/index.ts`:桶文件(barrel export),统一导出 backend/stores/views/assistant/types
  - 配置 `svelte-package`(已内置于 @sveltejs/kit,无需额外依赖)
  - 验证 `npm run prepack` 产出 `dist/`(含 .svelte.d.ts + 编译后 JS)
  - 验证 `npm pack` 产出 `evorule-console-0.1.0.tgz`,可被大众版 `npm install` 安装
  - 写一个临时大众版 demo 仓,`npm install ../evorule-console-0.1.0.tgz`,验证 `import { useBackendOrNull } from '@evorule/console'` 可用
  - `npm run check` 0 errors,`npx vitest run` 265 PASS,`npx playwright test` 13 PASS(双形态改造不破坏应用形态)

- **阶段 7B:双许可文件 + 治理文件套件 + 公开仓 README**
  - `LICENSE`:AGPL-3.0 全文(与 evorule 核心仓一致)
  - `DUAL_LICENSE.md`:双许可说明(AGPL-3.0 公开 + 商业许可付费)
  - `COMMERCIAL_LICENSE.md` / `FREE_COMMERCIAL_LICENSE.md`:商业许可摘要与免费豁免流程(与核心仓 4 文件结构对齐)
  - 治理文件套件(与 evorule 核心仓治理层对齐):`AUTHORS.md` / `CODE_OF_CONDUCT.md` / `TRADEMARK.md` / `CLA-individual.md` / `NOTICE.md` / `SECURITY.md` / `CONTRIBUTING.md`
  - `README.md` 重写:公开仓门面(定位 / 5 视图 / 7 本质 / 安装 / 双许可 / 仓导览)
  - `CHANGELOG.md`:v0.1.0 发布记录

- **阶段 7C:创建公开仓 + 迁出**
  - 在 gitee.com/evo-rule-lab 创建公开仓 `evorule-console`
  - 新建公开仓初始提交:把 `evorule-console/` 内容(排除构建产物)作为初始 commit 推到公开仓(公开仓第一笔提交即 v0.1.0 基线,不保留开发历史)
  - 打 v0.1.0 tag:`git tag -a v0.1.0 -m "..." && git push origin v0.1.0`
  - v0.1.0 仅打 git tag,不发布 npm registry(等 v0.2.0 稳定后再发)

**验收标准**:

- evorule-console 公开仓 `gitee.com/evo-rule-lab/evorule-console` 可访问
- v0.1.0 tag 已打,含完整 evorule-console 代码 + 双形态 package.json
- `npm pack` 产出可安装的 `evorule-console-0.1.0.tgz`
- 大众版 demo 仓能 `npm install` 后 `import { ... } from '@evorule/console'`
- evorule-console 自身 `npm run dev` 仍正常(双形态不破坏应用形态)
- 双许可文件就位(4 文件结构:LICENSE / DUAL_LICENSE / COMMERCIAL_LICENSE / FREE_COMMERCIAL_LICENSE),治理文件套件对齐核心仓

**产出文件**:

在 evorule-console 仓(新):

- `package.json` (name: @evorule/console, exports: {".":"./dist/index.js"})
- `src/lib/index.ts` (barrel export 桶文件)
- `LICENSE` (AGPL-3.0)
- `DUAL_LICENSE.md` / `COMMERCIAL_LICENSE.md` / `FREE_COMMERCIAL_LICENSE.md` (双许可说明,与核心仓 4 文件结构对齐)
- 治理文件套件:`AUTHORS.md` / `CODE_OF_CONDUCT.md` / `TRADEMARK.md` / `CLA-individual.md` / `NOTICE.md` / `SECURITY.md` / `CONTRIBUTING.md`
- `README.md` (公开仓门面)
- `CHANGELOG.md` (v0.1.0)

**设计要点**:

- **双形态零冲突**:SvelteKit 应用形态用 `vite dev` 读 `svelte.config.js`,npm 包形态用 `exports["."]` 读 `dist/index.js`,两者不冲突
- **新建公开仓初始提交**:把 `evorule-console/` 内容作为公开仓第一笔 commit(公开仓第一笔提交即 v0.1.0 基线,不保留开发历史)
- **v0.1.0 即基线**:公开仓第一个 commit + tag 即 v0.1.0,作为大众版/高级版依赖的基线版本

**依赖**:阶段 0-6(evorule-console 已验收合格 + e2e 修复)

---

## 3. 依赖关系图

```
阶段0(重组) → 阶段1(后端) ┬→ 阶段2(规则库,独立)
                          ├→ 阶段3(执行台+状态)
                          ├→ 阶段4(审计)
                          └→ 阶段5(时间旅行+ttd)
                                    ↓
                          阶段6(集成)
                                    ↓
                          阶段7(分仓 + 双形态 + v0.1.0 发布)
```

**可并行**:阶段 2/3/4/5 在阶段 1 完成后可并行(都依赖后端,但相互独立)

---

## 4. 验收标准(整体)

evorule-console 完成后,对照 SPEC.md 验收:

| SPEC 要求                                | 验收方式                                      |
| ---------------------------------------- | --------------------------------------------- |
| 执行后端抽象接口(15 方法)                | TypeScript 接口 + HttpBackend 实现 + 单元测试 |
| 5 视图(规则库/执行台/状态/审计/时间旅行) | 各视图可切换 + 功能正常                       |
| ttd 整体直接复制                         | ttd 源码在 src/lib/ttd/,5 视图可用            |
| 展现 evorule 7 大本质                    | 每个视图对应 ≥1 个本质属性                    |
| 不含 LLM                                 | 无 ConversationPanel / 无 LLM 集成代码        |
| 不绑定网络栈                             | ExecutionBackend 抽象,HttpBackend 是实现之一  |

---

## 5. 风险与注意事项

### 5.1 ttd 嵌入适配(SPEC §4)

ttd 是 vanilla JS(DOM 操作 + eventbus),SvelteKit 是组件式。嵌入时需适配:

- **算法层**(algorithms/):纯函数,直接可用,无适配成本
- **组件层**(components/):DOM 操作,需用 Svelte 组件包装(onMount 挂载)
- **视图层**(views/):tab 路由 + eventbus,需适配 SvelteKit 路由或保留内部路由
- **风险**:适配不当可能引入性能开销(违反性能优先原则)→ 阶段5 要验证性能

### 5.2 evorule-server 依赖

开发期需要本地 evorule-server 跑在 18081。如果用户没装 evorule-server:

- 阶段 1 的 HttpBackend 测试用 mock
- 集成测试需要真实 evorule-server

### 5.3 现有代码复用边界

- `api/evorule-server.js`:参考其数据契约,但重写为 TypeScript `http-backend.ts`
- `validators/ruleValidator.ts`:直接复用(规则验证逻辑独立)
- 旧组件(ConversationPanel 等):不复用,删除

---

_本计划是实施依据,每阶段产出可独立验证。基础先行,避免返工。_
