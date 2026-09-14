<!--
  Copyright 2026 EvoRule Project

  SPDX-License-Identifier: AGPL-3.0-or-later

  This file is part of EvoRule, licensed under the GNU Affero General
  Public License v3.0 or later. See /LICENSE in the repository root or
  <https://www.gnu.org/licenses/agpl-3.0.html>.
-->

# EvoRule Console 更新日志

所有对 evorule-console 项目的重大更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) v1.0,
本项目遵循 [语义化版本控制](https://semver.org/lang/zh-CN/) v2.0。

徽章说明:

- 🆕 新增
- 🔄 变更
- 🐛 修复
- 🗑 弃用
- ⚠️ Breaking Change
- 🔒 安全

---

## [0.3.0] - 2026-09-11

### 🆕 新增

- **插件模板页（通用表单薄切片,Plugin Contract v1）** — 工作空间顶栏新增「插件模板」入口,新路由 `/workspace/templates`:列出 server 已装载声明式 pack 的规则模板 → 按 `params_form` 渲染通用表单（8 控件词表;scene_field 下拉来源锁定为场景中声明了 path 的字段）→ 调用 generate 纯函数面 → 草稿 JSON 预览（JsonTree）与一键复制。草稿不落库,生效仍走既有 Draft→Publish 链
- **插件资产面客户端** — `src/lib/backend/plugin-packs.ts`:pack 清单 / 场景 / 模板 / 草稿生成四端点的轻客户端（默认 127.0.0.1:18080 loopback 免认证,server 启用 `--auth-token` 时经 `localStorage 'evorule.authToken'` 传 Bearer）;8 项单元测试覆盖端点/鉴权头/错误处理
- **操作者身份注入（ActorIdentity）**：`HttpWorkspaceBackend` 构造函数新增可选第三参 `actor?: ActorIdentity`（`{ name, role? }`，从 `workspace-types` 导出）。传入后，沙盒编排（`started_by`/`closed_by`/`?requester=`）与发布链路（`submitted_by`/`reviewed_by`/`operated_by` + `role`）携带真实操作者，server 审计链归属不再失真（上游债务 D2）。
- **审计归属 fail-fast**：`actor` 已配置但缺 `role` 时，发布侧三方法（`submitPublish`/`reviewPublish`/`emergencyRollback`）如实抛错并附修复指引；`actor` 整体未配置时回落历史内置值 `console` 并每实例 `console.warn` 一次（dev/演示路径兼容）。

### 🐛 修复

- **e2e 导航测试适配 v0.2.0+ 路由架构** — `navigation.spec.ts` 自 v0.1.0 后未随架构更新（规则库升级为 /workspace 独立路由、状态/审计视图重写后无 h1），5 个用例按旧假设失败。重写对齐现架构：根面板经 `addInitScript` 预设视图消除重定向竞态、状态/审计改组件锚点断言、新增默认 rules 重定向与 /workspace 离线空状态覆盖。13/13 全绿

---

## [0.2.0] - 2026-08-10

**领域专家友好化 + 业务规则模型统一 + 编辑器重构 + 三份战略文档** — 本次 MINOR 升级聚焦"不懂 JSON 的领域专家"项目方体验，统一 BusinessRule 共享模型，重构编辑器默认 form 模式，并落地产品战略/SDK 草案/金融示范三份设计文档。是 evorule-console 从"开发者工具"向"领域专家产品"转型的里程碑。

### ⚠️ Breaking Changes

- **编辑器默认模式 JSON → form**：`RuleEditor.svelte` 默认渲染业务化表单（form 模式），JSON 模式改为高级项目方主动切换。领域专家看到的不再是裸 JSON，而是结构化表单。
- **删除 `RuleEditor.svelte` 旧组件**：被新的 `RuleLibrary.svelte` + `BusinessRuleForm.svelte` 替代。外部代码若直接 import 旧组件会 break。
- **onboarding 完全重写**：迁移到 BusinessRule 模型，删除 `block` 动作（与 evorule 核心 6 域类型对齐），引导流程从"填 JSON"改为"填表单"。
- **gte/gt 域类型翻译**：evorule 核心仅支持 eq/lt/exists/instruction/all/not，server 端 `rule_translate.rs` 将 gte 翻译为 not(lt)、gt 翻译为 not(all([lt,eq]))，并实现对称回译。

### 🆕 新增

- **BusinessRule 共享模型**（`src/lib/views/business-rule-model.ts`）：统一业务层规则抽象，桥接领域专家语义与 evorule 核心 6 域类型。支持自定义字段扩展点（`CUSTOM_FIELDS_WORKSPACE_*`），为医疗/法律/物流等领域预留接口。
- **Workspace 后端层**（`src/lib/backend/http-workspace-backend.ts` + `workspace-types.ts` + `workspace-context.ts`）：完整的工作区 API 抽象，支持规则 CRUD、版本管理、审计链拉取。
- **Workspace 路由**（`src/routes/workspace/`）：`/workspace/[id]` + `/workspace/editor/[id]` 路由，编辑器直接导航 + 按 ID 拉取规则元数据。
- **Onboarding 路由**（`src/routes/onboarding/`）：5 步建库向导（选模板 → 命名 → 加规则 → 试运行 → 完成）。
- **FactStream 组件**（`src/lib/views/StateView/FactStream.svelte`）：Fact 流时间线，每行 = 逻辑版本号 + 故事线（中文派生）+ VerdictBadge。
- **Workspace/Verdict stores**（`src/lib/stores/workspace.ts` + `verdict.ts`）：工作区状态管理 + 裁决状态派生。
- **组件库目录**（`src/lib/components/`）：可复用 UI 组件抽离。
- **字体资源**（`src/lib/assets/fonts/`）：产品字体本地化。
- **三份战略设计文档**（`设计文档/`，gitignore 私有）：
  - `11_产品战略备忘录_v1.0.md`：定位/目标项目方/LLM 角色/许可证矩阵/SDK 分级/先通用后垂直路径
  - `12_SDK_API草案_v1.0.md`：完整版 + 云端简化版 SDK 设计，对齐 AGPL 双轨许可
  - `13_金融咨询Agent示范规格_v1.0.md`：金融领域垂直示范，复用 100% 通用层能力
- **Playwright 自动化脚本**（`src/routes/workspace/editor/__tests__/9.3-unsupported-readonly.spec.ts`）：验证 9 个 unsupported 规则表单控件的 disabled 状态。
- **V1 浏览器手动测试检查表**（`设计文档/10_V1浏览器手动测试检查表.md`）：9 个控件 disabled 状态 + 暗色模式 + 编辑器导航等手动测试项。

### 🔄 变更

- **ExecutionPad 暗色模式重构**：修复"大片白色背景下的黑色块居中"刺眼问题，统一使用设计令牌（design tokens）。
- **StateView/JsonNode/JsonTree 暗色模式**：统一设计令牌，移除硬编码颜色。
- **TimeTravel 琥珀主题**：Fact opacity 0.7 + 横幅 + 时间旅行视觉优化。
- **app.css 旧令牌清理**：删除向后兼容别名块，移除冗余 CSS。
- **RuleValidator G5 白名单**：新增 `__exec__.result.*` 路径前缀，支持执行结果引用。
- **HTTP backend 适配**：`submitCommand` 适配 evorule-server 实际响应格式，`listRules` 兼容 `Vec` 和 `{versions:[]}` 两种响应形态。

### 🐛 修复

- **编辑器直接导航显示"未找到规则"**：子组件 onMount 先于父组件执行，`currentWorkspaceId` 未水合，`$rules` 为空。新增 `ensureRule` 按 ID 拉取规则元数据；编辑器 onMount 订阅 `currentWorkspaceId`，等待工作区可用后加载规则。
- **编辑器点击规则库规则跳转后一直显示加载中**：store 订阅时同步执行回调，unsub 在赋值前被调用（TDZ 陷阱）。修复：去掉回调内的 `unsub()`，在 onMount 清理函数中调用，使用 done 标志防重复触发。
- **动作角色（role）丢失**：server 端 `translate_to_transform` 未正确处理 `action_set` 中的 value 字段。修复 server 端 `rule_translate.rs` 中 `action_set` 处理逻辑，确保 value 字段正确包含 role 信息。
- **G5 校验失败（路径引用错误）**：`__exec__.result.notify` 不在 G5 白名单。修复：在 server `rule_translate.rs` 和 console `ruleValidator.ts` 的 G5 白名单中添加 `__exec__.result.` 前缀。
- **params.path vs params.attr bug**：server `translate_to_transform` 生成 `params.path`，而 evorule core `exec_set` 读取 `params.attr`。修复：将 `rule_translate.rs` 中的 `params.path` 改为 `params.attr`。
- **CORS 跨域错误**：console（localhost:5173）与 server（127.0.0.1:18080）跨域。修复：server 启动时添加 `--allowed-origins http://localhost:5173`。
- **server 启动失败（拒绝绑定非 loopback 地址）**：server 安全策略要求非 loopback 地址必须设置认证 token。修复：启动时指定 `--addr 127.0.0.1:18080` 绑定 loopback 地址。
- **onboarding 创建的规则 G4 校验失败（含 gte）**：gte 直接作为域类型，evorule 核心仅支持 eq/lt/exists/instruction/all/not。修复：server 端 `rule_translate.rs` 将 gte 翻译为 not(lt)，gt 翻译为 not(all([lt,eq]))，并实现对称回译。

### 🔒 安全

- **License 矩阵对齐**：evorule-console 与 evorule 核心保持 AGPL-3.0-or-later 双轨许可一致。SDK 从 MIT 修正为 AGPL（SDK 是核心衍生作品，协议不能自相矛盾）。

---

## [0.1.1] - 2026-07-XX

详见 git tag v0.1.1。

---

## [0.1.0] - 2026-07-XX

evorule-console 首次公开发布。SvelteKit 应用 + npm 包双形态，无 LLM、无联网的完整规则引擎面板。

---

**作者**: EvoRule Project
**邮箱**: <evorulelab@gmail.com>
**Gitee**: <https://gitee.com/evo-rule-lab/evorule-console>
