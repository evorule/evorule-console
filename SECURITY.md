<!--
SPDX-License-Identifier: CC0-1.0
Security disclosure procedures are public knowledge; we release them under CC0 so everyone knows how to report vulnerabilities safely.
-->

# 安全漏洞报告政策

**最后更新**: 2026-08-03
**适用范围**: evorule-console 仓

---

## ⚠️ 支持的版本

| 版本 | 支持状态 | 说明 |
| --- | --- | --- |
| `v0.1.x`(含 0.1.0) | ✅ Supported | 公开基座阶段,当前主支持线 |
| `< v0.1.0` | ❌ Unsupported | 公开仓库之前的 commit 不维护 |

**alpha 阶段承诺**:

- Critical / High 漏洞:60 天内修
- Medium / Low 漏洞:推迟到 0.2.0
- 安全公告:修完后 30 天内公开披露(经协调)

**1.0.0 之后承诺**(届时更新本文档):

- Critical:7 天
- High:30 天
- Medium:90 天
- Low:next release

---

## 报告安全漏洞

如果您发现 evorule-console 中的安全漏洞,请通过以下方式负责任地披露:

### 📧 联系方式

- **邮箱**: <evorulelab@gmail.com>(主题加 `[SECURITY]`)
- **Gitee 私信**: 维护者(@evorulelab)
- **加密**: 当前未提供 PGP 公钥(如有需要可联系)

### 📋 报告内容

请在报告中包含:

1. 漏洞类型和描述
2. 复现步骤
3. 潜在影响评估
4. 建议的修复方案(如有)
5. 已尝试的缓解措施

### ⏱️ 响应时间承诺

- **确认收到**: 48 小时内
- **初步评估**: 5 个工作日内
- **修复计划**: 10 个工作日内
- **公开披露**: 修复后 30 天内(经协调)

### 🔒 保密承诺

在漏洞修复并公开披露之前,我们将:

- 严格保密您的报告
- 不与第三方分享相关信息
- 及时向您通报修复进展

### 🙏 致谢

对于负责任披露的安全研究者,我们将在修复后的发布公告中予以致谢(经您同意)。

### 🔐 evorule-console 特有的安全考虑

evorule-console 是前端面板(SvelteKit),其安全边界与后端规则引擎不同:

| 边界 | 风险 | 缓解 |
| --- | --- | --- |
| 项目方规则 JSON 输入 / 编辑 | XSS(规则内容含 `<script>` 注入到 DOM) | Svelte 默认文本转义;**禁用 `{@html}`** 渲染规则内容;`L_console` 预校验(G1-G7)拦截非法结构 |
| 视图/主题 localStorage 持久化 | 跨测试 / 跨会话状态串扰 | 每次使用前 `localStorage.clear()`;不持久化敏感数据 |
| 开发期 HTTP 后端 | 调用 evorule-server loopback 暴露面 | 开发后端仅绑定 `127.0.0.1`;生产环境由衍生版(大众版/高级版)替换 `ExecutionBackend` 实现 |
| `ttd` 嵌入副本 | 源仓安全修复未同步到本仓副本 | ttd 升级时在 CHANGELOG 记录同步(见 `src/lib/ttd/VERSION.md`) |
| npm 供应链 | 依赖被投毒 | `package-lock.json` 锁定;`npm audit` 定期检查;CI 校验签名 |

> **注**:evorule-console 的核心安全属性 —— 审计链 blake3 哈希计算与验证 —— **不在前端执行**,而在 evorule 核心(tier1)完成。前端 AuditView 仅做展示,不参与可信计算,因此前端被篡改不影响审计链完整性(TCB 纯净)。

### 📜 已知安全问题

当前**没有已知未修复的安全问题**。

历史上修复过的问题请见 [CHANGELOG.md](CHANGELOG.md)。

---

**重要提示**: 请勿在公共论坛、社交媒体或 issue tracker 中公开未修复的安全漏洞。

**作者**: EvoRule Project
**邮箱**: <evorulelab@gmail.com>
