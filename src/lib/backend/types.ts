// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 执行后端 — 数据契约 + ExecutionBackend 抽象接口
//
// 依据: docs/SPEC.md §1
// 设计原则: evorule-console 只依赖此抽象接口,不绑定 HTTP / Tauri / WASM。
//   - 大众版提供 HttpBackend 实现(本目录 http-backend.ts)
//   - 高级版提供 EmbeddedBackend 实现(Tauri + Rust link evorule crate)
//
// 端点对齐来源:
//   - time-travel-debugger/src/core/api.js (v1.0,49/51 PASS)
//   - src/lib/api/evorule-server.js (旧只读 client)

// ============================================================================
// 1. 数据契约(SPEC §1.1)
// ============================================================================

/** Session 标识(evorule-server 用自增整数) */
export type SessionId = number;

/**
 * reactor 运行态。
 * 字段对齐 evorule-server.js 的 ReactorState。
 *
 * phase 取值:
 *   - idle:           无任务
 *   - awaiting_io:    阻塞在 IO 等待
 *   - stable:         稳态(级联收敛)
 *   - error:          异常
 */
export interface ReactorState {
  phase: 'idle' | 'awaiting_io' | 'stable' | 'error';
  causal_depth: number;
  current_step: number;
  pending_io_count: number;
  structural_invariant_violations: number;
}

/** session 当前快照(复用旧 console SessionState) */
export interface SessionState {
  payload: object;
  queue: unknown[];
  reactor: ReactorState;
  version: number;
}

/**
 * 审计链。
 * 字段对齐 ttd api.js 修复 3: fact_count + verified
 * (旧 console 用的是 last_audited_version,已废弃,以本契约为准)
 */
export interface SessionAudit {
  entries: unknown[];
  fact_count: number;
  verified: boolean;
  last_hash?: string;
}

/** verifyAudit 返回值(对齐 ttd api.js 修复 4: verified,不是 valid) */
export interface VerifyResult {
  verified: boolean;
  detail?: string;
}

/**
 * fact log 一条(7 种 type,具体字段由 evorule 核心定)。
 * 这里只规定公共字段,其余字段按 type 不同而异,故用 index signature。
 */
export interface Fact {
  type: string;
  id: number;
  [key: string]: unknown;
}

/**
 * diff 结果。
 * 对齐 ttd api.js 修复 2: items 是数组格式
 *   - 变更: [key, value]
 *   - 改动: [key, old, new]
 * 不是 {key, value} 对象。
 */
export interface DiffResult {
  items: Array<[string, unknown] | [string, unknown, unknown]>;
}

/** 因果链 */
export interface CausalChain {
  chain: Fact[];
}

/** submitCommand 返回值 */
export interface CommandResult {
  accepted: boolean;
  version?: number;
  error?: string;
}

// ============================================================================
// 2. ExecutionBackend 抽象接口(SPEC §1.2,15 方法)
// ============================================================================

/**
 * evorule-console 的执行后端抽象接口。
 *
 * evorule-console 的所有视图只依赖此接口,不绑定具体实现。
 * - 大众版: HttpBackend (调 evorule-server HTTP)
 * - 高级版: EmbeddedBackend (Tauri + Rust 直接 link evorule crate,不联网)
 *
 * 15 方法分组:
 *   - 会话管理(5):health / createSession / listSessions / closeSession / getSessionState
 *   - 命令执行(1):submitCommand
 *   - 历史 / 回放(3):getHistory / getReplay / getFacts
 *   - 审计(3):getAudit / verifyAudit / getCausalChain
 *   - 时间旅行(2):getStateAtVersion / getDiff
 *   - What-If(1):forkSession
 */
export interface ExecutionBackend {
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
