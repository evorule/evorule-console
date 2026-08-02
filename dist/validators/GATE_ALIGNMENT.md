<!--
  Copyright 2026 EvoRule Project
  SPDX-License-Identifier: CC-BY-4.0
-->

# 门禁对齐索引(L_console ↔ L0)

> **Status**: 权威(本文件是 evorule-console 预校验层与核心仓门禁的映射依据)
> **适用范围**: src/lib/validators/ruleValidator.ts
> **依赖**: 核心仓 `D:\evorule\GATE_REFERENCE.md`(跨模块门控索引,权威)
> **本文档定位**: 显式分层 + 跨仓引用,确保 evorule-console 预校验不脱离核心仓门禁

---

## 0. 设计立场

evorule-console 是 TypeScript 前端视图层,不是 TCB。它**不复制**核心仓 `build.rs` 的 Rust 源码扫描机制(那是守 Rust 源码的,与 TS 前端无关)。

但它**处理 JSON 规则内容**,这是业务专家编辑的对象。基础版无网络时,业务专家需要本地预校验给出即时反馈。所以 evorule-console 设立 **L_console 预校验层**,只校验 JSON 规则结构,不试图替代核心仓的最终拦截。

---

## 1. 门禁分层

| 层 | 机制 | 强度 | 扫描对象 | 实施位置 | 权威性 |
|---|---|---|---|---|---|
| **L0** | `build.rs` 字节子串 + clippy + Kani | 高 | Rust 源码 | 核心仓 4 个 crate 各自 build.rs | **最终权威** |
| **L0-runtime** | executor 运行时 + auditor 哈希链 | 高 | 运行时指令流 | 核心仓 evorule-{tcb,reactor,governance} | **运行时拦截** |
| **L_console** | ruleValidator.ts G1-G7 | 中 | JSON 规则内容 | src/lib/validators/ | **UX 预反馈,非权威** |

**协作关系**:
- L_console 通过 → 提交到 evorule-server → L0-runtime 拦截(若 L_console 漏检)
- L_console 不通过 → UI 即时反馈,业务专家修后再提交
- 即使 L_console 全通过,L0/L0-runtime 仍是最终权威

---

## 2. L_console G1-G7 ↔ L0 SPEC 对齐表

| L_console | 检查内容 | 对齐 L0 约束 | L0 SPEC 章节 | L0 实施机制 |
|---|---|---|---|---|
| **G1** | JSON 格式合法性 | (前置条件) | — | L0-runtime executor 解析时拦截 |
| **G2** | 元指令类型(set/push/branch/io_request) | **T1** 指令集有限性(3 真元指令 + 0.5 signal) | TCB_SPEC.md §一 | L0-runtime InstructionExecutor 枚举变体 |
| **G3** | I/O 双路径模式(io_request 必须在 exists(__io_result__) 分支内) | D7(数据流约束,io_request 双路径) | TCB_SPEC.md §四 | L0-runtime executor + reactor IO 状态机 |
| **G4** | 域类型(eq/lt/exists/instruction/all/not) | **T2** 域类型有限性(6 种) | TCB_SPEC.md §一 | L0-runtime Domain enum 变体 |
| **G5** | 路径引用格式(__exec__.payload.*) | D9(路径解析永不 panic,返回 Option/Result) | TCB_SPEC.md §四 | L0-runtime path.rs |
| **G6** | 兜底规则(末条 branch + all([])) | **D2** 终止性保证(MAX_TRANSFORM_RULES=64) | TCB_SPEC.md §四 | L0-runtime transition bounded + Kani proof |
| **G7** | 递归深度 ≤64 | **D2** MAX_BRANCH_DEPTH=64 / MAX_DOMAIN_DEPTH=64 | TCB_SPEC.md §四 | L0-runtime + Kani `transition_bounded` proof |

---

## 3. L_console 不覆盖的 L0 约束(明确边界)

L0 含 Rust 源码层 23 模式扫描,这些**不适用于 JSON 规则内容**,evorule-console 不复制:

| L0 模式 | 守什么 | 为何 L_console 不做 |
|---|---|---|
| T8 HashMap/HashSet | 确定性迭代顺序 | TS 端不迭代核心数据结构 |
| T9/T11 unwrap/expect/debug_assert | panic-prone | TS 端无 Rust panic 概念 |
| T10 unsafe | 内存非确定 | TS 端无 unsafe |
| T12 f32/f64/Float | 浮点跨平台非确定 | 规则 JSON 不含 Rust 浮点字面量 |
| T5 SystemTime/Instant | 系统时间 | 规则 JSON 不含时间源 |
| T6 rand/random | 随机数 | 规则 JSON 不含随机源 |
| T4 std::fs/net/io/process | I/O | 规则 JSON 不含 I/O 调用 |
| T14 thread/tokio/async/await/spawn | 线程异步 | 规则 JSON 不含并发构造 |
| G7/G8 控制流硬编码 + 业务术语 | 反应器层禁硬编码 | L_console 校验规则数据,不校验反应器源码 |

---

## 4. 同步策略

### 4.1 触发同步的事件

- 核心仓 TCB_SPEC.md / REACTOR_SPEC.md / GOVERNANCE_SPEC.md 任一约束编号变更
- 核心仓 `core_eval.json` schema 变更(影响 G2/G4 元指令/域类型集合)
- 核心仓 D2 数值变更(MAX_TRANSFORM_RULES / MAX_BRANCH_DEPTH / MAX_DOMAIN_DEPTH)
- 核心仓新增 G 编号(影响 L_console 是否需要补检查)

### 4.2 同步流程

1. 核心仓 PR 修改 SPEC → 核心仓 CHANGELOG 记录
2. evorule-console 维护者(本仓)看到 CHANGELOG,审视是否影响 L_console
3. 若影响 → 在本仓 PR 修改 `ruleValidator.ts` + 本文件对齐表
4. evorule-console CHANGELOG 记录:"同步核心仓 <commit>(<变更描述>)"
5. 跑 `ruleValidator.test.ts` 全 PASS 验证

### 4.3 不可能的同步

- L_console 永远不可能覆盖 L0 全部(§3 已列)
- L_console 不试图复制 L0 的 Rust 源码扫描(那是 L1 字面量层)
- L_console 不复制 L0-runtime 的运行时拦截(那是 L0-runtime 层)
- L_console 只是 UX 预反馈层,不是权威

---

## 5. UI 暴露策略

Phase 2 RuleLibrary 视图编辑器实时显示 L_console G1-G7 状态:

- 编辑 JSON 时实时跑 `RuleValidator.validate(json)`
- 显示 7 个 G 标签,通过 ✅ / 失败 ❌(含错误消息)
- 显著提示:"L_console 预校验通过 ≠ 核心仓 L0 通过,提交后核心仓做最终拦截"
- 体现 evorule "规则即数据 + TCB 纯净"本质

---

## 6. 相关文件

- 核心仓权威索引: `D:\evorule\GATE_REFERENCE.md`
- 核心仓 TCB 规范: `D:\evorule\evorule-tcb\TCB_SPEC.md`
- 核心仓 Reactor 规范: `D:\evorule\evorule-reactor\REACTOR_SPEC.md`
- 核心仓 Governance 规范: `D:\evorule\evorule-governance\GOVERNANCE_SPEC.md`
- 本仓 L_console 实施: `src/lib/validators/ruleValidator.ts`
- 本仓 L_console 测试: `src/lib/validators/ruleValidator.test.ts`

---

## 7. 待确认点

| # | 决策点 | 状态 |
|---|---|---|
| 1 | L_console 是否需要补 G8(核心仓 REACTOR_SPEC.md G8 控制流硬编码检查) | ⏳ 不补 — G8 守的是反应器 Rust 源码,不是 JSON 规则 |
| 2 | 是否在 L_console 加 Kani 类似的形式化验证 | ❌ 不做 — TS 端无 Kani 等价物,svelte-check + vitest 已够 |
| 3 | L_console 是否需要 L2(clippy 等价)层 | ❌ 不做 — eslint + prettier + svelte-check 已是 TS 等价 L2 |

---

_本文件是门禁分层依据。L_console 不替代 L0,只是 UX 预反馈。核心仓是最终权威。_
