// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// view store 单元测试 — 视图切换 + localStorage 持久化
//
// 运行: npx vitest run src/lib/stores/view.test.ts
//
// localStorage mock 模式对齐 rule-library.test.ts(vitest node 环境无原生 localStorage)

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { currentView, restored, setView, restoreView, VIEW_LIST, getViewMeta, type ViewId } from './view';

// ============ localStorage mock(对齐 rule-library.test.ts 模式) ============

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    removeItem: vi.fn((k: string) => { delete store[k]; }),
    clear: vi.fn(() => { store = {}; }),
    _store: () => store
  };
})();

vi.stubGlobal('localStorage', mockLocalStorage);

const STORAGE_KEY = 'evorule-console:current-view';

/** 重置 store 到默认值 + 清空 localStorage mock */
function resetStore(): void {
  currentView.set('rules');
  restored.set(false);
  mockLocalStorage.clear();
}

// ============ VIEW_LIST 元数据 ============

describe('VIEW_LIST', () => {
  test('恰好 5 个视图', () => {
    expect(VIEW_LIST.length).toBe(5);
  });

  test('id 唯一', () => {
    const ids = VIEW_LIST.map(v => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('每个视图有 label/essence/icon', () => {
    VIEW_LIST.forEach(v => {
      expect(typeof v.label).toBe('string');
      expect(v.label.length).toBeGreaterThan(0);
      expect(typeof v.essence).toBe('string');
      expect(v.essence.length).toBeGreaterThan(0);
      expect(typeof v.icon).toBe('string');
    });
  });

  test('包含预期的 5 个 id(顺序即导航排列顺序)', () => {
    const ids = VIEW_LIST.map(v => v.id);
    expect(ids).toEqual(['rules', 'execution', 'state', 'audit', 'timetravel']);
  });
});

// ============ getViewMeta ============

describe('getViewMeta', () => {
  test('已知 id 返回元数据', () => {
    const meta = getViewMeta('audit');
    expect(meta.id).toBe('audit');
    expect(meta.label).toBe('审计');
  });

  test('未知 id 抛错(防御)', () => {
    expect(() => getViewMeta('unknown' as ViewId)).toThrow(/unknown view id/);
  });
});

// ============ currentView 初始值 ============

describe('currentView 初始值', () => {
  test('默认 rules(规则库作为首屏入口)', () => {
    let value: ViewId | undefined;
    const unsub = currentView.subscribe(v => { value = v; });
    expect(value).toBe('rules');
    unsub();
  });
});

// ============ setView + 持久化 ============

describe('setView', () => {
  beforeEach(() => resetStore());

  test('切换视图 + 更新 store', () => {
    setView('execution');
    let value: ViewId | undefined;
    const unsub = currentView.subscribe(v => { value = v; });
    expect(value).toBe('execution');
    unsub();
  });

  test('持久化到 localStorage', () => {
    setView('audit');
    expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe('audit');
  });

  test('多次切换只保留最后一次', () => {
    setView('execution');
    setView('state');
    setView('timetravel');
    expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe('timetravel');
  });

  test('切回默认视图也持久化', () => {
    setView('audit');
    setView('rules');
    expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe('rules');
  });
});

// ============ restoreView ============

describe('restoreView', () => {
  beforeEach(() => resetStore());

  test('localStorage 有合法值 → 恢复', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'audit');
    restoreView();
    let value: ViewId | undefined;
    const unsub = currentView.subscribe(v => { value = v; });
    expect(value).toBe('audit');
    unsub();
  });

  test('localStorage 为空 → 保持默认 rules', () => {
    restoreView();
    let value: ViewId | undefined;
    const unsub = currentView.subscribe(v => { value = v; });
    expect(value).toBe('rules');
    unsub();
  });

  test('localStorage 有非法值 → 清理 + 回退默认', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'invalid-view-id');
    restoreView();
    let value: ViewId | undefined;
    const unsub = currentView.subscribe(v => { value = v; });
    expect(value).toBe('rules');
    expect(mockLocalStorage.getItem(STORAGE_KEY)).toBeNull(); // 已清理
    unsub();
  });

  test('所有合法 id 都能恢复', () => {
    VIEW_LIST.forEach(v => {
      mockLocalStorage.setItem(STORAGE_KEY, v.id);
      restoreView();
      let value: ViewId | undefined;
      const unsub = currentView.subscribe(val => { value = val; });
      expect(value).toBe(v.id);
      unsub();
    });
  });
});

// ============ restored 标志(竞态修复) ============
// 依据: +page.svelte 的 $effect 等待 restored=true 后再判断是否重定向到 /workspace。
// 修复子组件 $effect 先于父组件 onMount(restoreView)执行导致的 4 视图不可达竞态。

describe('restored 标志', () => {
  beforeEach(() => resetStore());

  test('初始值为 false(未恢复)', () => {
    let value: boolean | undefined;
    const unsub = restored.subscribe(v => { value = v; });
    expect(value).toBe(false);
    unsub();
  });

  test('restoreView 后置 true(解锁 +page.svelte 重定向)', () => {
    let value: boolean | undefined;
    const unsub = restored.subscribe(v => { value = v; });
    expect(value).toBe(false);
    restoreView();
    expect(value).toBe(true);
    unsub();
  });

  test('localStorage 有合法值时 restoreView 仍置 true', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'audit');
    let value: boolean | undefined;
    const unsub = restored.subscribe(v => { value = v; });
    restoreView();
    expect(value).toBe(true);
    unsub();
  });

  test('多次 restoreView 保持 true(幂等)', () => {
    let value: boolean | undefined;
    const unsub = restored.subscribe(v => { value = v; });
    restoreView();
    restoreView();
    expect(value).toBe(true);
    unsub();
  });
});
