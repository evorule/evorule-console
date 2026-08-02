// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 会话 store — 当前 session + session 列表 + 命令历史
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段3
// 设计:
//   - store 本身不持有 backend 实例(backend 由组件注入,便于测试 mock)
//   - store 函数签名带 backend 参数,组件调 useBackend() 后传给 store
//   - 命令历史存最近 N 条,用于"确定性"可视化(同输入同输出对比)

import { writable, derived, get } from 'svelte/store';
import type { ExecutionBackend, SessionId, SessionState, CommandResult } from '$lib/backend/types';

/** 命令历史一条记录 */
export interface CommandHistoryEntry {
  /** 提交时间(用于排序和显示) */
  timestamp: number;
  /** 提交的 instruction(JSON 对象) */
  instruction: object;
  /** 提交结果 */
  result: CommandResult;
  /** 提交时的 session version(便于追溯) */
  versionBefore: number | undefined;
}

const MAX_HISTORY = 50;

// ============================================================================
// Stores
// ============================================================================

export const sessions = writable<SessionId[]>([]);
export const currentSessionId = writable<SessionId | null>(null);
export const sessionState = writable<SessionState | null>(null);
export const commandHistory = writable<CommandHistoryEntry[]>([]);
export const isLoading = writable(false);
export const lastError = writable<string | null>(null);

/** 当前 session state 的派生视图(只读) */
export const reactorPhase = derived(sessionState, ($s) => $s?.reactor?.phase ?? null);
export const reactorVersion = derived(sessionState, ($s) => $s?.version ?? null);
export const reactorCausalDepth = derived(
  sessionState,
  ($s) => $s?.reactor?.causal_depth ?? null
);
export const reactorPendingIO = derived(
  sessionState,
  ($s) => $s?.reactor?.pending_io_count ?? null
);

// ============================================================================
// Actions
// ============================================================================

/**
 * 刷新 session 列表(从 backend 拉取)
 */
export async function refreshSessions(backend: ExecutionBackend): Promise<void> {
  isLoading.set(true);
  lastError.set(null);
  try {
    const ids = await backend.listSessions();
    sessions.set(ids);
    // 若当前 session 不在列表中,自动选第一个
    const current = get(currentSessionId);
    if (current === null || !ids.includes(current)) {
      currentSessionId.set(ids.length > 0 ? ids[0] : null);
    }
  } catch (e) {
    lastError.set(`刷新 session 列表失败: ${(e as Error).message}`);
  } finally {
    isLoading.set(false);
  }
}

/**
 * 创建新 session
 * @returns 新 session id,失败返回 null
 */
export async function createSession(backend: ExecutionBackend): Promise<SessionId | null> {
  isLoading.set(true);
  lastError.set(null);
  try {
    const id = await backend.createSession();
    sessions.update((all) => (all.includes(id) ? all : [...all, id]));
    currentSessionId.set(id);
    // 创建后立即拉取状态
    await refreshSessionState(backend, id);
    return id;
  } catch (e) {
    lastError.set(`创建 session 失败: ${(e as Error).message}`);
    return null;
  } finally {
    isLoading.set(false);
  }
}

/**
 * 关闭当前 session
 */
export async function closeSession(backend: ExecutionBackend, id: SessionId): Promise<void> {
  isLoading.set(true);
  lastError.set(null);
  try {
    await backend.closeSession(id);
    sessions.update((all) => all.filter((s) => s !== id));
    if (get(currentSessionId) === id) {
      const remaining = get(sessions);
      currentSessionId.set(remaining.length > 0 ? remaining[0] : null);
      // 状态清空
      sessionState.set(null);
      commandHistory.set([]);
    }
  } catch (e) {
    lastError.set(`关闭 session 失败: ${(e as Error).message}`);
  } finally {
    isLoading.set(false);
  }
}

/**
 * 切换到指定 session
 */
export async function selectSession(
  backend: ExecutionBackend,
  id: SessionId
): Promise<void> {
  currentSessionId.set(id);
  sessionState.set(null);
  commandHistory.set([]);
  await refreshSessionState(backend, id);
}

/**
 * 刷新当前 session 的状态
 */
export async function refreshSessionState(
  backend: ExecutionBackend,
  id?: SessionId
): Promise<void> {
  const targetId = id ?? get(currentSessionId);
  if (targetId === null) return;
  lastError.set(null);
  try {
    const state = await backend.getSessionState(targetId);
    sessionState.set(state);
  } catch (e) {
    lastError.set(`获取 session 状态失败: ${(e as Error).message}`);
    sessionState.set(null);
  }
}

/**
 * 提交命令到当前 session
 *
 * @param backend       执行后端
 * @param instruction   要提交的 instruction(JSON 对象)
 * @returns 命令结果,失败返回 null
 */
export async function submitCommand(
  backend: ExecutionBackend,
  instruction: object
): Promise<CommandResult | null> {
  const id = get(currentSessionId);
  if (id === null) {
    lastError.set('没有当前 session,请先创建');
    return null;
  }

  isLoading.set(true);
  lastError.set(null);
  const versionBefore = get(reactorVersion) ?? undefined;

  try {
    const result = await backend.submitCommand(id, instruction);
    // 加入历史
    commandHistory.update((hist) => {
      const entry: CommandHistoryEntry = {
        timestamp: Date.now(),
        instruction,
        result,
        versionBefore
      };
      const next = [...hist, entry];
      // 限制历史长度
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    // 提交后刷新状态
    await refreshSessionState(backend, id);
    return result;
  } catch (e) {
    lastError.set(`提交命令失败: ${(e as Error).message}`);
    return null;
  } finally {
    isLoading.set(false);
  }
}

/**
 * 清空所有状态(组件卸载或切换 view 时调用)
 */
export function resetSessionStore(): void {
  sessions.set([]);
  currentSessionId.set(null);
  sessionState.set(null);
  commandHistory.set([]);
  isLoading.set(false);
  lastError.set(null);
}
