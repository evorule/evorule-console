<!--
  Copyright 2026 EvoRule Project

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.

  SPDX-License-Identifier: AGPL-3.0-or-later
-->

# 贡献指南 — evorule-console

**项目**: evorule-console — evorule 规则引擎面板内核
**版本**: 0.1.0
**最后更新**: 2026-08-03

> evorule-console 是 EvoRule 生态的独立产品内核(无 LLM、不绑定网络栈)。本文档仅约束本仓;EvoRule 项目级原则见各仓自身的贡献指南。

---

## 🎯 核心原则

### 原则 1:执行后端抽象,不绑定网络栈

✅ **evorule-console 只定义 `ExecutionBackend` 抽象接口;具体实现(HTTP / Tauri 嵌入)由衍生版提供**
❌ **不要把网络栈(HTTP client、Tauri IPC、具体 server 地址)硬编码进视图 / store**

**为什么**:

- evorule-console 的边界是"无联网",绑定网络栈会破坏这一边界
- 大众版(HTTP)与高级版(Tauri 嵌入)必须能基于同一内核演化
- 开发期用 `HttpBackend`(调 evorule-server loopback)仅为可运行,不改变边界定义

### 原则 2:机制层与应用层分离

✅ **evorule-console 是机制层(规则展示 / 执行 / 审计 / 回放),不含 LLM、不含 AI 编排**
❌ **不要在 evorule-console 内嵌入 LLM 调用、AI 工作流、智能编排**

**为什么**:

- AI 编排归 evo-agent 仓;evorule-console 不依赖 evo-agent(各仓独立发展)
- 机制层独立可审计,应用层可独立演化
- LLM 升级不应触碰 evorule-console

### 原则 3:JSON 是唯一表达

✅ **规则 / 状态 / 命令 / 审计 / 输入输出 = 全部 JSON**
❌ **不要引入非 JSON 数据格式(二进制、protobuf)进入数据流**

**为什么**:

- 透明性、可解释性、可审计性都源于 JSON
- `git diff` = 审计,`grep` = 查询,JSONL = 时间机器
- 业务规则可读、可写、可版本控制

### 原则 4:因果链完整性

✅ **每次状态变化都有 `cause`;审计链 blake3 哈希可验证**
❌ **不要在前端伪造 / 修改审计哈希;不要引入"无原因的状态变更"**

**为什么**:

- `rewind` / `replay` / `diff` 都建立在因果链上
- 审计、调试、争议解决都依赖它
- **关键**:哈希计算与验证在 evorule 核心(tier1)完成,前端 AuditView **只展示不计算**(TCB 纯净)—— 不要把哈希逻辑搬到前端

---

## 🐛 报告 Bug

使用 [Gitee Issues](https://gitee.com/evorule/evorule-console/issues)。

**报告模板**:

```markdown
**环境**:

- OS: [e.g. Windows 11 / Ubuntu 22.04]
- Node: [e.g. 20.10]
- 浏览器: [e.g. Chrome 126]
- evorule-console 版本: [e.g. 0.1.0]
- 是否启动 evorule-server: [是 / 否]

**复现步骤**:

1. ...
2. ...

**预期行为**:
...

**实际行为**:
...

**截图 / 控制台日志**:
[附截图或浏览器控制台输出]
```

---

## 💡 功能建议

同样用 Issues,加 `enhancement` 标签。

**模板**:

```markdown
**问题**: 当前做法有什么不足?
**建议方案**: 简要描述
**备选方案**: 评估过的其他选项
**影响范围**: 哪个视图 / store / 接口
```

---

## 🔧 提交 PR

### 工作流

1. **Fork 本仓** → 在你的 Gitee 账号下创建 fork
2. **建分支**: `git checkout -b feature/your-feature-name`
3. **写代码 + 写测试** — 覆盖率不得下降
4. **本地验证**(必须全部通过):

   ```bash
   npm install
   npm run check          # svelte-check,0 error
   npm run test:unit      # vitest 单元测试
   npx playwright test    # e2e(首次需 npx playwright install chromium)
   npm run lint           # prettier --check + eslint
   ```

5. **推送**: `git push origin feature/your-feature-name`
6. **提 PR** 到 Gitee,填写 PR 模板
7. **签 CLA**(见下文)
8. **等 review** — 维护者 7 天内回复

### Commit message 约定

使用 [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(audit): add causal chain highlight on hover
fix(ttd): correct rewind cursor offset
docs(boundary): clarify execution backend abstraction
chore(deps): upgrade svelte to 5.15
refactor(stores): split session store by concern
test(e2e): add theme toggle persistence case
```

### 分支命名

- `feature/<name>` — 新功能
- `fix/<name>` — bug 修复
- `docs/<name>` — 仅文档
- `chore/<name>` — 杂项
- `refactor/<name>` — 重构

---

## 📜 CLA(贡献者许可协议)

**所有贡献必须包含 CLA**。PR 时机器人自动检查。

- 个人贡献者: [CLA-individual.md](CLA-individual.md)
- 企业贡献者: 联系 <evorulelab@gmail.com>

**为什么需要 CLA**:

- 支持商业双许可(见 [DUAL_LICENSE.md](DUAL_LICENSE.md))
- 避免贡献者版权争议
- AGPL-3.0 单独不足以支撑商业双许可

---

## 🧪 测试要求

### 单元测试(vitest)

- 新功能必须有对应单元测试
- 测试文件与源文件同目录,命名 `*.test.ts`
- 覆盖率不得下降

### e2e 测试(playwright)

验证 5 视图导航与核心交互(见 `tests/e2e/`):

1. 首屏加载 + 品牌可见
2. 5 视图 tab 切换
3. 规则库离线可用(含 builtin 规则)
4. 主题切换 + 持久化
5. 视图选择持久化

**e2e 并发说明**: 本仓 `playwright.config.ts` 强制 `workers: 1` + `fullyParallel: false`,这是配置约束(vite dev 冷启动竞态),不是代码缺陷。详见 [tests/e2e/navigation.spec.ts](tests/e2e/navigation.spec.ts) 头注。

### L_console 预校验

`src/lib/validators/ruleValidator.ts` 是前端预校验层(G1-G7),与 evorule 核心仓的 `build.rs` + clippy + Kani(L0 权威)对齐。约束映射见 `validators/GATE_ALIGNMENT.md`。**核心仓 SPEC 变更时必须同步 GATE_ALIGNMENT.md**。

---

## 🛠 编码规范

### 风格

- `npm run format` (prettier) 必须通过
- `npm run lint` (eslint + eslint-plugin-svelte) 必须通过
- `npm run check` (svelte-check) 必须 0 error
- 公共 API 必须有 JSDoc / TSDoc 注释
- 导出的 store / 类型 / 组件签名必须稳定(语义化版本)

### 文件头

所有 `.ts` / `.svelte` / `.js` 文件必须包含 SPDX 头:

```typescript
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
```

`.svelte` / `.md` 用 HTML 注释形式:

```html
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 EvoRule Project -->
```

### 模块分层

- `src/lib/backend/` — 执行后端抽象(`ExecutionBackend` 接口 + `HttpBackend` 开发实现)
- `src/lib/stores/` — 跨视图共享状态(rules / session / audit / view)
- `src/lib/views/` — 5 视图组件(每个视图展现 ≥1 个 evorule 本质)
- `src/lib/ttd/` — time-travel-debugger 嵌入副本(整体复制,见 `src/lib/ttd/VERSION.md`)
- `src/lib/validators/` — L_console 预校验层

### 不可变优先

- Svelte runes:`$state` / `$derived` / `$effect`,避免可变全局
- store 返回不可变视图,修改走显式 action 函数
- 使用 `Object.freeze` / 只读类型(`Readonly<T>` / `as const`)约束公共数据

---

## 🚫 禁止事项

- ❌ **不要在网络栈层硬编码进视图 / store**(破坏执行后端抽象)
- ❌ **不要在 evorule-console 内嵌入 LLM / AI 编排**(机制层必须保持无智能)
- ❌ **不要引入非 JSON 数据格式**(破坏透明性)
- ❌ **不要用 `{@html}` 渲染项目方/规则内容**(XSS 风险)
- ❌ **不要把审计哈希计算搬到前端**(破坏 TCB 纯净)
- ❌ **不要修改 `src/lib/ttd/` 副本的业务逻辑**(ttd 源仓独立维护;升级走整体同步,见 CHANGELOG)
- ❌ **不要提交 secrets / API key / 个人信息 / 内部地址**(公开仓)

---

## 📞 联系

- **Gitee Issues**: <https://gitee.com/evorule/evorule-console/issues>
- **邮箱**: <evorulelab@gmail.com>
- **组织**: [EvoRule](https://gitee.com/evorule)

---

## 🙏 致谢

感谢所有贡献者!你的名字将出现在 [AUTHORS.md](AUTHORS.md)。

---

**风格遵循 [Keep a Changelog](https://keepachangelog.com/)、[Conventional Commits](https://www.conventionalcommits.org/)、[Contributor Covenant](https://www.contributor-covenant.org/)。**
