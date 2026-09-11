<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->

# evorule-console

> evorule 规则引擎面板 — **无智能,只有执行** 的响应式规则引擎前端

[![version](https://img.shields.io/badge/version-0.3.0-blue)](./CHANGELOG.md)
[![license](https://img.shields.io/badge/license-AGPL--3.0--or--later%20%2B%20Commercial-success)](./DUAL_LICENSE.md)
[![svelte](https://img.shields.io/badge/svelte-5-ff3e00)](https://svelte.dev)
[![check](https://img.shields.io/badge/svelte--check-0%20errors-brightgreen)](#验证)

evorule-console 是 evorule 的灵魂产品内核 — 完整的规则引擎面板,展现 evorule 作为「确定性执行规则引擎」的 7 大本质属性。**不含 LLM、不绑定网络栈**,用户画像为政府、军工、金融、法律、私有技术等保密性要求极高的场景。

> **双形态**:`@evorule/console` 既是 SvelteKit 应用(可直接运行),又是 npm 包(可被大众版/高级版 `npm install` 复用)。

---

## 定位

| 层级                      | 仓   | 定位                        | LLM               | 网络               | 依赖                     |
| ------------------------- | ---- | --------------------------- | ----------------- | ------------------ | ------------------------ |
| **evorule-console(本仓)** | 独立 | 灵魂产品内核,无智能只有执行 | ❌ 无             | ❌ 无(仅本地 HTTP) | 0(消费 evorule 核心)     |
| 大众版                    | 独立 | 在 core 基础上扩展          | ☁️ 云 LLM(默认开) | ✅ 联网            | `npm i @evorule/console` |
| 高级版                    | 独立 | 保密行业定制                | 🖥️ 本地 GPU LLM   | ✅ 联网/Tauri      | `npm i @evorule/console` |

三仓各自独立 semver,通过 npm 依赖松绑(`^0.1.0`),不绑定版本号。详见 [BOUNDARY.md §5.1](./docs/BOUNDARY.md)。

---

## 5 视图 ↔ 7 大本质

每个视图至少展现 1 个 evorule 本质属性:

| 视图       | 展现的本质                                                        |
| ---------- | ----------------------------------------------------------------- |
| 📐 规则库  | **规则即数据** — 业务专家可读可改,JSON 描述                       |
| ▶ 执行台   | **确定性执行** — 同输入同输出("重复上次"对比验证)                 |
| 📦 状态    | **JSON-in/out 自解释** · **反应式** — state change 自动级联       |
| 🔍 审计    | **完整审计**(blake3 哈希链)· **TCB 纯净**(核心 0 依赖,前端只展示) |
| ⏱ 时间旅行 | **可回放** — rewind / diff / causal / what-if(嵌入 ttd)           |

---

## 安装与使用

### 形态 1:作为 SvelteKit 应用直接运行(本仓)

```bash
git clone https://gitee.com/evo-rule-lab/evorule-console.git
cd evorule-console
npm install
npm run dev    # 访问 http://localhost:5173
```

> 规则库视图不需要后端,可离线试用;执行台/状态/审计/时间旅行需要 evorule-server 跑在 `127.0.0.1:18080`。

### 形态 2:作为 npm 包被大众版/高级版 import

在你的 SvelteKit 项目中:

```bash
npm install @evorule/console
```

然后在代码中 import:

```typescript
import {
  // 执行后端抽象(大众版实现此接口扩展为远程 server)
  type ExecutionBackend,
  HttpBackend,
  provideBackend,
  useBackendOrNull,
  // 状态 stores
  rules,
  currentView,
  setView,
  VIEW_LIST,
  // 视图组件
  RuleLibraryView,
  ExecutionPadView,
  StateView,
  AuditView,
  TimeTravelView,
  // L_console 预校验
  RuleValidator,
  // 版本
  CONSOLE_VERSION,
} from "@evorule/console";

console.log("evorule-console version:", CONSOLE_VERSION);
console.log("VIEW_LIST:", VIEW_LIST); // 5 视图元数据
```

> 双形态设计见 [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) 阶段 7A。

---

## 验证

```bash
npm run check       # svelte-check:0 errors / 0 warnings
npm run test:unit   # vitest:9 files / 265 tests
npm run test        # playwright:13 e2e(单 worker,稳定)
npm run build       # adapter-static:产出静态文件到 build/
npm run prepack     # svelte-package:产出 dist/(npm 包形态)
```

---

## 技术栈

- SvelteKit 5 + Svelte 5(runes 模式)
- TypeScript(strict)
- Vite + adapter-static(可打包为静态/本地 web 包)
- vitest(单元测试)+ playwright(e2e)
- CSS 变量 + 设计令牌系统(无 UI 框架依赖)

---

## 架构要点

- **执行后端抽象**:`ExecutionBackend` 接口(15 方法),evorule-console 用 `HttpBackend`(调 evorule-server);
  高级版替换为 `EmbeddedBackend`(Tauri + Rust),不联网 — 边界清晰,切换只改 root 一处。
- **操作者身份(ActorIdentity)**:`HttpWorkspaceBackend` 构造可选传入 `{ name, role? }`,
  发布链路(submitted_by/reviewed_by/operated_by + role)与沙盒编排(started_by/closed_by/?requester=)
  携带真实操作者;未传入时回落 `"console"` 并 warn 一次 — 该回落仅适用于本仓独立运行的 dev/演示形态,
  消费方(大众版等)生产环境必须传入登录用户,否则 server 审计归属失真。
  stores 层的 `created_by/updated_by = 'console'` 是本地/离线演示数据归属,不进 server 审计链,不属于此范畴。
- **L_console 预校验**:`validators/ruleValidator.ts` 在前端做 G1-G7 格式校验(对齐核心仓 TCB 约束),
  核心仓 `build.rs` + clippy + Kani 是 L0 权威最终拦截器(见 `validators/GATE_ALIGNMENT.md`)。
- **ttd 整体直接复制**:时间旅行调试器源码整体复制进 `src/lib/ttd/`(性能优先,无 iframe/接口引用开销),
  仅 3 处最小适配(见 `src/lib/ttd/VERSION.md`)。
- **TCB 纯净**:哈希计算/验证在 evorule 核心层,前端只做展示 — 审计权威不在前端。
- **双形态零冲突**:SvelteKit 应用形态用 `vite dev` 读 `svelte.config.js`;npm 包形态用 `exports["."]` 读 `dist/index.js`(由 `svelte-package` 产出)。

---

## 目录结构

```
evorule-console/
├── src/
│   ├── routes/              # +layout(导航)+ +page(视图容器)
│   ├── lib/
│   │   ├── index.ts         # ★ npm 包入口(barrel export)
│   │   ├── backend/         # ExecutionBackend 接口 + HttpBackend + context 注入
│   │   ├── views/           # 5 视图(RuleLibrary/ExecutionPad/StateView/AuditView/TimeTravel)
│   │   ├── stores/          # Svelte stores(rules/session/audit/view/theme)
│   │   ├── validators/      # L_console 预校验 + GATE_ALIGNMENT.md
│   │   └── ttd/             # 时间旅行调试器(整体复制副本 + console-adapter)
│   └── app.css              # 设计令牌系统
├── docs/                    # 设计文档(BOUNDARY/SPEC/IMPLEMENTATION_PLAN)
├── tests/
│   ├── unit/                # vitest
│   └── e2e/                 # playwright
├── package.json             # @evorule/console(name + exports 双形态)
├── svelte.config.js
└── README.md(本文件)
```

---

## 设计文档

| 文档                                                    | 内容                                     |
| ------------------------------------------------------- | ---------------------------------------- |
| [BOUNDARY.md](./docs/BOUNDARY.md)                       | 边界与定位(三独立仓模型 §5.1)            |
| [SPEC.md](./docs/SPEC.md)                               | 功能规格(ExecutionBackend 接口 + 5 视图) |
| [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) | 实施计划(阶段 0-7)                       |
| [CHANGELOG.md](./CHANGELOG.md)                          | 版本变更记录                             |

> 大众版 / 高级版扩展规格见各自仓库(release governance:各仓独立 semver,文档不跨仓引用)。

---

## 贡献

- Issue / PR 通过 gitee.com/evo-rule-lab/evorule-console 提交
- 贡献者需签署 CLA(后续补充)
- 开发约定:见 [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) 阶段任务

---

## 许可

**双许可**:AGPL-3.0-or-later(开源,默认) + Commercial License(商业,付费)。

详见 [LICENSE](./LICENSE) (AGPL-3.0 全文) 与 [DUAL_LICENSE.md](./DUAL_LICENSE.md) (双许可说明);商业许可摘要见 [COMMERCIAL_LICENSE.md](./COMMERCIAL_LICENSE.md)、免费豁免见 [FREE_COMMERCIAL_LICENSE.md](./FREE_COMMERCIAL_LICENSE.md)。

---

Copyright (C) 2026 EvoRule Project. All rights reserved.
