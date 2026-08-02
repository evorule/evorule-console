<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- Copyright (C) 2026 EvoRule Project -->

# Changelog

本文件记录 evorule-console 的版本变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-03

### 首次发布

evorule-console v0.1.0 — evorule 灵魂产品内核的首次公开发布。

**定位**:无 LLM、无联网的完整规则引擎面板,展现 evorule「无智能,只有执行」的 7 大本质属性。

### 新增

- **5 视图**:规则库 / 执行台 / 状态 / 审计 / 时间旅行,每视图对应 ≥1 个 evorule 本质属性
- **执行后端抽象**:`ExecutionBackend` 接口(15 方法),evorule-console 用 `HttpBackend` 实现,大众版/高级版可替换为远程 / 嵌入式实现
- **L_console 预校验**:`RuleValidator` 在前端做 G1-G7 格式校验,对齐核心仓 TCB 约束(T1/T2/D2),核心仓 `build.rs` + clippy + Kani 是 L0 权威最终拦截器
- **ttd 整体嵌入**:时间旅行调试器 v1.0 源码整体复制进 `src/lib/ttd/`(性能优先,非 iframe / 非接口引用),仅 3 处最小适配
- **双形态**:`@evorule/console` 既是 SvelteKit 应用(可直接运行),又是 npm 包(可被大众版/高级版 `npm install` 复用)
- **双许可(4 文件结构,与 evorule 核心仓对齐)**:LICENSE(AGPL-3.0 全文)+ DUAL_LICENSE.md(双许可说明)+ COMMERCIAL_LICENSE.md(商业许可摘要)+ FREE_COMMERCIAL_LICENSE.md(免费豁免流程)
- **治理文件套件(与 evorule 核心仓治理层对齐)**:AUTHORS.md / CODE_OF_CONDUCT.md / TRADEMARK.md / CLA-individual.md / NOTICE.md / SECURITY.md / CONTRIBUTING.md — 治理/法律/社区/品牌层与核心仓一致;技术层(GATE_REFERENCE / VERSION_STRATEGY / DOCS_INDEX)不照搬,避免误导用户以为 console 也过 Kani 形式化验证
- **设计令牌系统**:CSS 变量 + 设计令牌,无 UI 框架依赖
- **示例规则**:3 个内置示例(set_basic / branch_vip / io_two_phase),全部通过 L_console G1-G7 校验

### 测试

| 测试            | 命令                              | 结果                          | 耗时   |
| --------------- | --------------------------------- | ----------------------------- | ------ |
| 单元测试(vitest) | `npm run test:unit`               | ✅ 9 files / 265 tests passed | 2.55s  |
| 类型检查         | `npm run check`                   | ✅ 0 errors / 0 warnings      | ~5s    |
| 构建             | `npm run build`                   | ✅ exit=0(adapter-static)    | 9.65s  |
| e2e(单 worker) | `npm run test`                    | ✅ 13/13 passed               | 27.9s  |
| npm 包           | `npm run prepack`                 | ✅ 产出 `dist/`              | —      |

**集成验证**:大众版 demo 仓通过 `npm install ../evorule-console-0.1.0.tgz` 安装后,`import { useBackendOrNull, RuleValidator, VIEW_LIST } from '@evorule/console'` 可用。

### 已知限制

- 执行台 / 状态 / 审计 / 时间旅行视图需要 evorule-server 跑在 `127.0.0.1:18080`(规则库视图可离线试用)
- e2e 测试需单 worker(`workers: 1`),多 worker 触发 Vite dev server 冷启动竞态(配置问题,非代码缺陷)
- v0.1.0 暂不发布到 npm registry,仅作为 git tag 基线;大众版开发时用 `npm install git+https://gitee.com/evo-rule-lab/evorule-console.git#v0.1.0` 形式依赖,等 v0.2.0 稳定后再正式发 npm

### 依赖

- SvelteKit 5 + Svelte 5(runes 模式)
- TypeScript(strict)
- Vite 5 + adapter-static
- vitest + playwright

---

## 版本号约定

- evorule-console 遵循独立 semver,与大众版 / 高级版版本松绑(`^x.x`)
- 大众版 / 高级版通过 `npm install @evorule/console@^0.1.0` 依赖,不绑定版本号
- breaking change 会递增主版本号,并在本文件显著标注

---

_本仓 changelog 只记录 evorule-console 自身版本。大众版 / 高级版各自独立 semver,见各自仓库。_
