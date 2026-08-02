// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console session store 单元测试
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段3 验收
// 测试策略:用 mock ExecutionBackend,验证 store actions 正确驱动状态
//
// 运行: npx vitest run src/lib/stores/session.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type {
  ExecutionBackend,
  SessionId,
  SessionState,
  CommandResult
} from '$lib/backend/types';

// 动态导入 store(每个测试前重新加载,确保状态隔离)
async function loadFreshStore() {
  vi.resetModules();
  return await import('$lib/stores/session');
}

// ============================================================================
// Mock ExecutionBackend
// ============================================================================

class MockBackend implements ExecutionBackend {
  public nextSessionId = 100;
  public sessions: Set<SessionId> = new Set([1, 2, 3]);
  public states: Map<SessionId, SessionState> = new Map();
  public commands: Array<{ id: SessionId; instruction: object }> = [];
  public shouldFail = false;

  constructor() {
    // 给 1/2/3 默认状态
    this.states.set(1, {
      payload: { x: 1 },
      queue: [],
      reactor: {
        phase: 'stable',
        causal_depth: 0,
        current_step: 5,
        pending_io_count: 0,
        structural_invariant_violations: 0
      },
      version: 5
    });
    this.states.set(2, {
      payload: { y: 2 },
      queue: [],
      reactor: {
        phase: 'idle',
        causal_depth: 0,
        current_step: 0,
        pending_io_count: 0,
        structural_invariant_violations: 0
      },
      version: 0
    });
    this.states.set(3, {
      payload: {},
      queue: [],
      reactor: {
        phase: 'stable',
        causal_depth: 1,
        current_step: 2,
        pending_io_count: 0,
        structural_invariant_violations: 0
      },
      version: 2
    });
  }

  async health(): Promise<boolean> {
    return !this.shouldFail;
  }

  async createSession(): Promise<SessionId> {
    if (this.shouldFail) throw new Error('create failed');
    const id = this.nextSessionId++;
    this.sessions.add(id);
    this.states.set(id, {
      payload: {},
      queue: [],
      reactor: {
        phase: 'idle',
        causal_depth: 0,
        current_step: 0,
        pending_io_count: 0,
        structural_invariant_violations: 0
      },
      version: 0
    });
    return id;
  }

  async listSessions(): Promise<SessionId[]> {
    if (this.shouldFail) throw new Error('list failed');
    return Array.from(this.sessions);
  }

  async closeSession(id: SessionId): Promise<void> {
    this.sessions.delete(id);
    this.states.delete(id);
  }

  async getSessionState(id: SessionId): Promise<SessionState> {
    if (this.shouldFail) throw new Error('state failed');
    const state = this.states.get(id);
    if (!state) throw new Error(`session ${id} not found`);
    return state;
  }

  async submitCommand(
    id: SessionId,
    instruction: object
  ): Promise<CommandResult> {
    if (this.shouldFail) throw new Error('submit failed');
    this.commands.push({ id, instruction });
    const state = this.states.get(id);
    if (!state) throw new Error(`session ${id} not found`);
    // 模拟版本递增(确定性:同输入同输出)
    state.version += 1;
    // 模拟 set 操作:把 instruction 的 attr/value 写入 payload
    const inst = instruction as { type: string; params?: { attr?: string; value?: unknown } };
    if (inst.type === 'set' && inst.params?.attr && 'value' in (inst.params ?? {})) {
      const path = inst.params.attr.replace('__exec__.payload.', '');
      (state.payload as Record<string, unknown>)[path] = inst.params.value;
    }
    return { accepted: true, version: state.version };
  }

  // 以下方法在 session store 测试中不使用,留空实现
  async getHistory(): Promise<unknown> {
    return null;
  }
  async getReplay(): Promise<never[]> {
    return [];
  }
  async getFacts(): Promise<never[]> {
    return [];
  }
  async getAudit(): Promise<never> {
    return null as never;
  }
  async verifyAudit(): Promise<{ verified: boolean }> {
    return { verified: true };
  }
  async getCausalChain(): Promise<{ chain: never[] }> {
    return { chain: [] };
  }
  async getStateAtVersion(): Promise<SessionState> {
    return this.states.values().next().value as SessionState;
  }
  async getDiff(): Promise<{ items: never[] }> {
    return { items: [] };
  }
  async forkSession(): Promise<SessionId> {
    return 999;
  }
}

// ============================================================================
// 测试用例
// ============================================================================

describe('session store', () => {
  let store: Awaited<ReturnType<typeof loadFreshStore>>;
  let backend: MockBackend;

  beforeEach(async () => {
    store = await loadFreshStore();
    backend = new MockBackend();
    store.resetSessionStore();
  });

  describe('refreshSessions', () => {
    it('应从 backend 拉取 session 列表', async () => {
      await store.refreshSessions(backend);
      expect(get(store.sessions)).toEqual([1, 2, 3]);
    });

    it('无当前 session 时,自动选中第一个', async () => {
      await store.refreshSessions(backend);
      expect(get(store.currentSessionId)).toBe(1);
    });

    it('backend 报错时,lastError 应有消息', async () => {
      backend.shouldFail = true;
      await store.refreshSessions(backend);
      expect(get(store.lastError)).toContain('刷新 session 列表失败');
    });

    it('当前 session 不在列表中时,自动切换到第一个', async () => {
      store.currentSessionId.set(99);
      await store.refreshSessions(backend);
      expect(get(store.currentSessionId)).toBe(1);
    });
  });

  describe('createSession', () => {
    it('应新建 session 并自动选中', async () => {
      const id = await store.createSession(backend);
      expect(id).toBe(100);
      expect(get(store.sessions)).toContain(100);
      expect(get(store.currentSessionId)).toBe(100);
    });

    it('创建后应拉取状态', async () => {
      await store.createSession(backend);
      const state = get(store.sessionState);
      expect(state).not.toBeNull();
      expect(state?.version).toBe(0);
    });

    it('backend 报错时返回 null 且 lastError 有消息', async () => {
      backend.shouldFail = true;
      const id = await store.createSession(backend);
      expect(id).toBeNull();
      expect(get(store.lastError)).toContain('创建 session 失败');
    });
  });

  describe('closeSession', () => {
    it('应从列表中删除 session', async () => {
      await store.refreshSessions(backend);
      store.currentSessionId.set(2);
      await store.closeSession(backend, 2);
      expect(get(store.sessions)).toEqual([1, 3]);
    });

    it('关闭当前 session 时,自动选中剩余的第一个', async () => {
      await store.refreshSessions(backend);
      store.currentSessionId.set(1);
      await store.closeSession(backend, 1);
      expect(get(store.currentSessionId)).toBe(2);
    });

    it('关闭最后一个 session 时,currentSessionId 为 null', async () => {
      await store.refreshSessions(backend);
      // 删除全部
      await store.closeSession(backend, 1);
      await store.closeSession(backend, 2);
      await store.closeSession(backend, 3);
      expect(get(store.currentSessionId)).toBeNull();
    });
  });

  describe('selectSession', () => {
    it('应切换 currentSessionId 并刷新状态', async () => {
      await store.refreshSessions(backend);
      store.currentSessionId.set(1);
      await store.selectSession(backend, 3);
      expect(get(store.currentSessionId)).toBe(3);
      const state = get(store.sessionState);
      expect(state?.version).toBe(2); // session 3 的 version
    });

    it('切换时应清空命令历史', async () => {
      await store.refreshSessions(backend);
      store.currentSessionId.set(1);
      await store.submitCommand(backend, { type: 'set', params: { attr: 'x', value: 1 } });
      expect(get(store.commandHistory)).toHaveLength(1);
      await store.selectSession(backend, 2);
      expect(get(store.commandHistory)).toHaveLength(0);
    });
  });

  describe('submitCommand', () => {
    beforeEach(async () => {
      await store.refreshSessions(backend);
      store.currentSessionId.set(1);
      await store.refreshSessionState(backend);
    });

    it('无当前 session 时返回 null', async () => {
      store.currentSessionId.set(null);
      const r = await store.submitCommand(backend, { type: 'noop' });
      expect(r).toBeNull();
      expect(get(store.lastError)).toContain('没有当前 session');
    });

    it('成功提交应返回 CommandResult', async () => {
      const r = await store.submitCommand(backend, {
        type: 'set',
        params: { attr: '__exec__.payload.x', value: 42 }
      });
      expect(r).not.toBeNull();
      expect(r?.accepted).toBe(true);
      expect(r?.version).toBe(6); // 原 version=5,递增 1
    });

    it('提交后命令历史应增长', async () => {
      await store.submitCommand(backend, { type: 'noop' });
      await store.submitCommand(backend, { type: 'noop' });
      expect(get(store.commandHistory)).toHaveLength(2);
    });

    it('历史应记录提交前的 version', async () => {
      await store.submitCommand(backend, { type: 'noop' });
      const hist = get(store.commandHistory);
      expect(hist[0].versionBefore).toBe(5); // 提交前 version=5
    });

    it('提交后应刷新 sessionState', async () => {
      await store.submitCommand(backend, {
        type: 'set',
        params: { attr: '__exec__.payload.x', value: 99 }
      });
      const state = get(store.sessionState);
      expect(state?.version).toBe(6);
      expect((state?.payload as Record<string, unknown>)?.x).toBe(99);
    });

    it('backend 报错时返回 null 且 lastError 有消息', async () => {
      backend.shouldFail = true;
      const r = await store.submitCommand(backend, { type: 'noop' });
      expect(r).toBeNull();
      expect(get(store.lastError)).toContain('提交命令失败');
    });
  });

  describe('命令历史上限', () => {
    it('超过 MAX_HISTORY(50) 应裁剪到最近 50 条', async () => {
      await store.refreshSessions(backend);
      store.currentSessionId.set(1);
      // 提交 60 次
      for (let i = 0; i < 60; i++) {
        await store.submitCommand(backend, { type: 'noop', params: { n: i } });
      }
      expect(get(store.commandHistory)).toHaveLength(50);
      // 最早的应是第 11 次(index 10),最晚的应是第 60 次(index 59)
      const hist = get(store.commandHistory);
      expect((hist[0].instruction as { params: { n: number } }).params.n).toBe(10);
      expect((hist[49].instruction as { params: { n: number } }).params.n).toBe(59);
    });
  });

  describe('派生 store', () => {
    it('reactorPhase 应从 sessionState 派生', async () => {
      await store.refreshSessions(backend);
      store.currentSessionId.set(1);
      await store.refreshSessionState(backend);
      expect(get(store.reactorPhase)).toBe('stable');
    });

    it('reactorVersion 应从 sessionState 派生', async () => {
      await store.refreshSessions(backend);
      store.currentSessionId.set(3);
      await store.refreshSessionState(backend);
      expect(get(store.reactorVersion)).toBe(2);
    });
  });

  describe('resetSessionStore', () => {
    it('应清空所有状态', async () => {
      await store.refreshSessions(backend);
      store.currentSessionId.set(1);
      await store.submitCommand(backend, { type: 'noop' });
      expect(get(store.sessions)).toHaveLength(3);
      expect(get(store.commandHistory)).toHaveLength(1);

      store.resetSessionStore();
      expect(get(store.sessions)).toEqual([]);
      expect(get(store.currentSessionId)).toBeNull();
      expect(get(store.sessionState)).toBeNull();
      expect(get(store.commandHistory)).toEqual([]);
    });
  });
});
