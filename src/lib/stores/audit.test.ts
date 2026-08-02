// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console audit store 单元测试
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段4 验收
// 测试策略:用 mock ExecutionBackend,验证 store actions 正确驱动状态
//
// 运行: npx vitest run src/lib/stores/audit.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type {
  ExecutionBackend,
  SessionId,
  SessionAudit,
  VerifyResult,
  CausalChain,
  Fact,
  SessionState,
  CommandResult
} from '$lib/backend/types';

// 动态导入 store(每个测试前重新加载,确保状态隔离)
async function loadFreshStore() {
  vi.resetModules();
  return await import('$lib/stores/audit');
}

// ============================================================================
// Mock ExecutionBackend — 提供审计相关方法的可控返回值
// ============================================================================

/** 生成一个 idle 状态的 SessionState(给 mock 用,避免重复字面量) */
function makeIdleState(): SessionState {
  return {
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
  };
}

class MockBackend implements ExecutionBackend {
  // 审计相关 mock 数据
  public auditResponse: SessionAudit | null = null;
  public verifyResponse: VerifyResult = { verified: true };
  public causalResponse: CausalChain = { chain: [] };

  // 错误控制
  public auditFails = false;
  public verifyFails = false;
  public causalFails = false;

  // 调用记录(断言用)
  public auditCalls: SessionId[] = [];
  public verifyCalls: SessionId[] = [];
  public causalCalls: Array<{ id: SessionId; factId: number }> = [];

  // === 审计相关方法(本测试重点关注) ===

  async getAudit(id: SessionId): Promise<SessionAudit> {
    this.auditCalls.push(id);
    if (this.auditFails) throw new Error('audit network error');
    if (!this.auditResponse) {
      return {
        entries: [],
        fact_count: 0,
        verified: true
      };
    }
    // 返回副本,避免测试间共享引用
    return JSON.parse(JSON.stringify(this.auditResponse));
  }

  async verifyAudit(id: SessionId): Promise<VerifyResult> {
    this.verifyCalls.push(id);
    if (this.verifyFails) throw new Error('verify error');
    return { ...this.verifyResponse };
  }

  async getCausalChain(id: SessionId, factId: number): Promise<CausalChain> {
    this.causalCalls.push({ id, factId });
    if (this.causalFails) throw new Error('causal error');
    return JSON.parse(JSON.stringify(this.causalResponse));
  }

  // === 其他方法(本测试不关注,空实现) ===

  async health(): Promise<boolean> {
    return true;
  }
  async createSession(): Promise<SessionId> {
    return 1;
  }
  async listSessions(): Promise<SessionId[]> {
    return [1];
  }
  async closeSession(): Promise<void> {}
  async getSessionState(): Promise<SessionState> {
    return makeIdleState();
  }
  async submitCommand(): Promise<CommandResult> {
    return { accepted: true, version: 1 };
  }
  async getHistory(): Promise<unknown> {
    return null;
  }
  async getReplay(): Promise<Fact[]> {
    return [];
  }
  async getFacts(): Promise<Fact[]> {
    return [];
  }
  async getStateAtVersion(): Promise<SessionState> {
    return makeIdleState();
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

describe('audit store', () => {
  let store: Awaited<ReturnType<typeof loadFreshStore>>;
  let backend: MockBackend;

  beforeEach(async () => {
    store = await loadFreshStore();
    backend = new MockBackend();
    store.resetAuditStore();
  });

  describe('refreshAudit', () => {
    it('成功拉取应写入 auditData 并清空错误', async () => {
      backend.auditResponse = {
        entries: [
          { type: 'instruction', id: 1, attr: '__exec__.payload.x' },
          { type: 'fact', id: 2, key: 'x', value: 42 }
        ],
        fact_count: 2,
        verified: true,
        last_hash: 'abcdef0123456789'
      };

      const result = await store.refreshAudit(backend, 1);

      expect(result).not.toBeNull();
      expect(result?.fact_count).toBe(2);
      expect(get(store.auditData)?.fact_count).toBe(2);
      expect(get(store.auditData)?.verified).toBe(true);
      expect(get(store.auditData)?.last_hash).toBe('abcdef0123456789');
      expect(get(store.auditError)).toBeNull();
      expect(get(store.auditLoading)).toBe(false);
      expect(backend.auditCalls).toEqual([1]);
    });

    it('backend 报错时 auditData 清空且 auditError 有消息', async () => {
      // 先填入一个旧值,验证出错时会清空
      backend.auditResponse = {
        entries: [],
        fact_count: 0,
        verified: true
      };
      await store.refreshAudit(backend, 1);
      expect(get(store.auditData)).not.toBeNull();

      backend.auditFails = true;
      const result = await store.refreshAudit(backend, 1);

      expect(result).toBeNull();
      expect(get(store.auditData)).toBeNull();
      expect(get(store.auditError)).toContain('获取审计链失败');
      expect(get(store.auditLoading)).toBe(false);
    });

    it('空审计链也应正确写入(fact_count=0)', async () => {
      backend.auditResponse = {
        entries: [],
        fact_count: 0,
        verified: true
      };
      await store.refreshAudit(backend, 1);
      expect(get(store.auditData)?.fact_count).toBe(0);
      expect(get(store.auditData)?.entries).toEqual([]);
    });

    it('verified=false(已断裂)的审计链也应原样展示', async () => {
      backend.auditResponse = {
        entries: [{ type: 'fact', id: 1 }],
        fact_count: 1,
        verified: false,
        last_hash: 'broken'
      };
      await store.refreshAudit(backend, 1);
      expect(get(store.auditData)?.verified).toBe(false);
    });
  });

  describe('verifyAuditChain', () => {
    it('成功验证应写入 verifyResult', async () => {
      backend.verifyResponse = { verified: true, detail: 'all 12 facts verified' };

      const result = await store.verifyAuditChain(backend, 1);

      expect(result?.verified).toBe(true);
      expect(result?.detail).toBe('all 12 facts verified');
      expect(get(store.verifyResult)?.verified).toBe(true);
      expect(backend.verifyCalls).toEqual([1]);
    });

    it('验证失败(verified=false)应正确传递', async () => {
      backend.verifyResponse = { verified: false, detail: 'broken at fact #5' };

      const result = await store.verifyAuditChain(backend, 1);

      expect(result?.verified).toBe(false);
      expect(get(store.verifyResult)?.verified).toBe(false);
    });

    it('若已有 auditData,应同步更新其 verified 字段', async () => {
      // 先拉一份 auditData(verified=true)
      backend.auditResponse = {
        entries: [],
        fact_count: 0,
        verified: true
      };
      await store.refreshAudit(backend, 1);
      expect(get(store.auditData)?.verified).toBe(true);

      // 验证返回 false(模拟哈希链实际已断)
      backend.verifyResponse = { verified: false };
      await store.verifyAuditChain(backend, 1);

      // auditData.verified 应被同步更新
      expect(get(store.auditData)?.verified).toBe(false);
    });

    it('无 auditData 时也应能验证(只更新 verifyResult)', async () => {
      // 不调 refreshAudit,直接验证
      backend.verifyResponse = { verified: true };
      await store.verifyAuditChain(backend, 1);
      expect(get(store.verifyResult)?.verified).toBe(true);
      expect(get(store.auditData)).toBeNull();
    });

    it('backend 报错时 verifyResult 清空且 auditError 有消息', async () => {
      // 先放一个旧 verifyResult
      backend.verifyResponse = { verified: true };
      await store.verifyAuditChain(backend, 1);
      expect(get(store.verifyResult)).not.toBeNull();

      backend.verifyFails = true;
      const result = await store.verifyAuditChain(backend, 1);

      expect(result).toBeNull();
      expect(get(store.verifyResult)).toBeNull();
      expect(get(store.auditError)).toContain('验证审计链失败');
    });
  });

  describe('fetchCausalChain', () => {
    it('成功拉取应写入 causalSelection(含 factId + chain)', async () => {
      backend.causalResponse = {
        chain: [
          { type: 'instruction', id: 1, attr: '__exec__.payload.x' },
          { type: 'fact', id: 2, key: 'x', value: 42 }
        ]
      };

      const result = await store.fetchCausalChain(backend, 1, 5);

      expect(result?.chain).toHaveLength(2);
      expect(get(store.causalSelection)?.factId).toBe(5);
      expect(get(store.causalSelection)?.chain).toHaveLength(2);
      expect(backend.causalCalls).toEqual([{ id: 1, factId: 5 }]);
    });

    it('空因果链(根 fact)也应正确展示', async () => {
      backend.causalResponse = { chain: [] };

      const result = await store.fetchCausalChain(backend, 1, 1);

      expect(result?.chain).toEqual([]);
      expect(get(store.causalSelection)?.factId).toBe(1);
      expect(get(store.causalSelection)?.chain).toEqual([]);
    });

    it('连续点击不同 fact,causalSelection 应替换为最新', async () => {
      backend.causalResponse = { chain: [{ type: 'fact', id: 1 }] };

      await store.fetchCausalChain(backend, 1, 10);
      expect(get(store.causalSelection)?.factId).toBe(10);

      backend.causalResponse = { chain: [{ type: 'fact', id: 1 }, { type: 'fact', id: 2 }] };
      await store.fetchCausalChain(backend, 1, 20);
      expect(get(store.causalSelection)?.factId).toBe(20);
      expect(get(store.causalSelection)?.chain).toHaveLength(2);
    });

    it('backend 报错时 causalSelection 清空且 auditError 有消息', async () => {
      backend.causalFails = true;

      const result = await store.fetchCausalChain(backend, 1, 5);

      expect(result).toBeNull();
      expect(get(store.causalSelection)).toBeNull();
      expect(get(store.auditError)).toContain('获取因果链失败');
    });
  });

  describe('clearCausalSelection', () => {
    it('应清空 causalSelection 但不影响 auditData/verifyResult', async () => {
      backend.auditResponse = { entries: [], fact_count: 0, verified: true };
      backend.verifyResponse = { verified: true };
      backend.causalResponse = { chain: [{ type: 'fact', id: 1 }] };

      await store.refreshAudit(backend, 1);
      await store.verifyAuditChain(backend, 1);
      await store.fetchCausalChain(backend, 1, 5);

      expect(get(store.causalSelection)).not.toBeNull();
      expect(get(store.auditData)).not.toBeNull();
      expect(get(store.verifyResult)).not.toBeNull();

      store.clearCausalSelection();

      expect(get(store.causalSelection)).toBeNull();
      // 其他数据不受影响
      expect(get(store.auditData)).not.toBeNull();
      expect(get(store.verifyResult)).not.toBeNull();
    });
  });

  describe('resetAuditStore', () => {
    it('应清空所有审计状态', async () => {
      backend.auditResponse = {
        entries: [{ type: 'fact', id: 1 }],
        fact_count: 1,
        verified: true,
        last_hash: 'h1'
      };
      backend.verifyResponse = { verified: true };
      backend.causalResponse = { chain: [{ type: 'fact', id: 1 }] };

      await store.refreshAudit(backend, 1);
      await store.verifyAuditChain(backend, 1);
      await store.fetchCausalChain(backend, 1, 1);

      store.resetAuditStore();

      expect(get(store.auditData)).toBeNull();
      expect(get(store.verifyResult)).toBeNull();
      expect(get(store.causalSelection)).toBeNull();
      expect(get(store.auditLoading)).toBe(false);
      expect(get(store.auditError)).toBeNull();
    });
  });

  describe('Loading 状态', () => {
    it('拉取审计链期间 auditLoading 应为 true', async () => {
      backend.auditResponse = { entries: [], fact_count: 0, verified: true };

      // 用未 resolve 的 promise 暂停 backend,观察 loading 中间态
      let resolveAudit!: (v: SessionAudit) => void;
      backend.getAudit = () =>
        new Promise((resolve) => {
          resolveAudit = (v) => resolve(v);
        }) as Promise<SessionAudit>;
      backend.auditResponse = { entries: [], fact_count: 0, verified: true };

      const promise = store.refreshAudit(backend, 1);
      // 让微任务跑一次,store 内 await backend.getAudit 已挂起
      await Promise.resolve();
      expect(get(store.auditLoading)).toBe(true);

      resolveAudit(backend.auditResponse!);
      await promise;

      expect(get(store.auditLoading)).toBe(false);
    });
  });
});
