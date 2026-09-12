// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// assistant-context 单元测试 — LLM 扩展槽 context 注入机制
//
// 运行: npx vitest run src/lib/assistant/assistant-context.test.ts
//
// 测试策略:
//   - Svelte 的 getContext/setContext 必须在组件初始化期间调用,非组件上下文会静默失败
//   - 因此 mock svelte 的 context 三函数,验证 assistant-context.ts 的逻辑正确性
//   - 不测 Svelte context 实现本身(那是 Svelte 的职责)
//
// 关键不变量:
//   1. provideAssistant(provider) 注入后 useAssistantOrNull() 能取到同一 provider
//   2. provideAssistant() / provideAssistant(null) 默认 null(扩展槽为空)
//   3. 未注入时 useAssistantOrNull() 返回 null(视图 LLM 按钮不渲染)
//   4. provide 和 use 使用相同 context key(Symbol)

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ============ mock svelte context API ============
// 用 vi.hoisted 确保 mock 函数在 vi.mock factory 执行前已就绪(hoisting)

const { mockSetContext, mockGetContext, mockHasContext } = vi.hoisted(() => ({
  mockSetContext: vi.fn(),
  mockGetContext: vi.fn(),
  mockHasContext: vi.fn(),
}));

vi.mock('svelte', () => ({
  setContext: mockSetContext,
  getContext: mockGetContext,
  hasContext: mockHasContext,
}));

import { provideAssistant, useAssistantOrNull } from './assistant-context';
import type { AssistantProvider } from './types';

// ============ 测试用 stub provider ============

const stubProvider: AssistantProvider = {
  generateRuleDraft: vi.fn(),
  explainRule: vi.fn(),
  generateInput: vi.fn(),
  transpileFlow: vi.fn(),
};

const anotherProvider: AssistantProvider = {
  generateRuleDraft: vi.fn(),
  explainRule: vi.fn(),
  generateInput: vi.fn(),
  transpileFlow: vi.fn(),
};

// ============ 重置 mock ============

function resetMocks(): void {
  mockSetContext.mockReset();
  mockGetContext.mockReset();
  mockHasContext.mockReset();
}

// ============ provideAssistant ============

describe('provideAssistant', () => {
  beforeEach(resetMocks);

  test('注入 provider 实例并返回该实例', () => {
    const result = provideAssistant(stubProvider);
    expect(result).toBe(stubProvider);
    expect(mockSetContext).toHaveBeenCalledTimes(1);
    // 第二参数是 provider 本身
    expect(mockSetContext).toHaveBeenCalledWith(expect.any(Symbol), stubProvider);
  });

  test('不传参数默认 null(扩展槽为空,与 evorule-console "无 LLM" 基调一致)', () => {
    const result = provideAssistant();
    expect(result).toBeNull();
    expect(mockSetContext).toHaveBeenCalledWith(expect.any(Symbol), null);
  });

  test('显式传 null 也注入 null', () => {
    const result = provideAssistant(null);
    expect(result).toBeNull();
    expect(mockSetContext).toHaveBeenCalledWith(expect.any(Symbol), null);
  });

  test('context key 是 Symbol(避免字符串冲突)', () => {
    provideAssistant(stubProvider);
    const key = mockSetContext.mock.calls[0][0];
    expect(typeof key).toBe('symbol');
  });
});

// ============ useAssistantOrNull ============

describe('useAssistantOrNull', () => {
  beforeEach(resetMocks);

  test('hasContext=false(未注入)时返回 null — 视图 LLM 按钮不渲染', () => {
    mockHasContext.mockReturnValue(false);
    expect(useAssistantOrNull()).toBeNull();
    // hasContext=false 时不应调 getContext(避免 Svelte 警告)
    expect(mockGetContext).not.toHaveBeenCalled();
  });

  test('hasContext=true + provider 已注入时返回该 provider', () => {
    mockHasContext.mockReturnValue(true);
    mockGetContext.mockReturnValue(stubProvider);
    expect(useAssistantOrNull()).toBe(stubProvider);
    expect(mockGetContext).toHaveBeenCalledTimes(1);
  });

  test('hasContext=true + 注入的是 null 时返回 null(显式 null 注入)', () => {
    mockHasContext.mockReturnValue(true);
    mockGetContext.mockReturnValue(null);
    expect(useAssistantOrNull()).toBeNull();
  });

  test('context key 是 Symbol(与 provideAssistant 一致)', () => {
    mockHasContext.mockReturnValue(true);
    mockGetContext.mockReturnValue(stubProvider);
    useAssistantOrNull();
    const key = mockGetContext.mock.calls[0][0];
    expect(typeof key).toBe('symbol');
  });
});

// ============ provide + use 配对(同一 context key) ============

describe('provide + use 配对', () => {
  beforeEach(resetMocks);

  test('provide 和 use 使用相同 context key(否则注入取不到)', () => {
    // 模拟注入
    mockHasContext.mockReturnValue(true);
    mockGetContext.mockReturnValue(stubProvider);

    provideAssistant(stubProvider);
    const provideKey = mockSetContext.mock.calls[0][0];

    useAssistantOrNull();
    const useKey = mockGetContext.mock.calls[0][0];

    expect(provideKey).toBe(useKey);
  });

  test('注入 stubProvider 后 use 取到 stubProvider(端到端一致性)', () => {
    mockHasContext.mockReturnValue(true);
    mockGetContext.mockReturnValue(stubProvider);

    const injected = provideAssistant(stubProvider);
    const retrieved = useAssistantOrNull();
    expect(injected).toBe(stubProvider);
    expect(retrieved).toBe(stubProvider);
  });

  test('注入 anotherProvider 后 use 取到 anotherProvider(不同 provider 不串)', () => {
    mockHasContext.mockReturnValue(true);
    mockGetContext.mockReturnValue(anotherProvider);

    provideAssistant(anotherProvider);
    const retrieved = useAssistantOrNull();
    expect(retrieved).toBe(anotherProvider);
    expect(retrieved).not.toBe(stubProvider);
  });
});

// ============ 默认行为(evorule-console 自身运行时) ============

describe('evorule-console 自身运行时(未注入 provider)', () => {
  beforeEach(resetMocks);

  test('useAssistantOrNull 返回 null — 视图 {#if assistant} 不渲染 LLM 按钮', () => {
    // evorule-console 自身不调 provideAssistant,hasContext=false
    mockHasContext.mockReturnValue(false);
    const assistant = useAssistantOrNull();
    expect(assistant).toBeNull();
    // 模拟视图逻辑:{#if assistant && onaiGenerateDraft} ... {/if}
    // assistant=null → 条件 false → 按钮不渲染
    const shouldRenderButton = assistant !== null;
    expect(shouldRenderButton).toBe(false);
  });

  test('stubProvider 满足 AssistantProvider 接口(4 方法齐全,含 P3 transpileFlow)', () => {
    // 验证测试 stub 完整实现了接口(否则类型不符)
    expect(typeof stubProvider.generateRuleDraft).toBe('function');
    expect(typeof stubProvider.explainRule).toBe('function');
    expect(typeof stubProvider.generateInput).toBe('function');
    expect(typeof stubProvider.transpileFlow).toBe('function');
  });
});
