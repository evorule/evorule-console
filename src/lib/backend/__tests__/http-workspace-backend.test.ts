// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// HttpWorkspaceBackend actor 注入单测 — 审计归属透传 + 回落 + fail-fast
//
// 运行: npx vitest run src/lib/backend/__tests__/http-workspace-backend.test.ts
//
// 测试范围 (对应上游债务 D2):
//   - actor.name 透传: 沙盒 body 字段 (started_by/closed_by) + 查询参数 (?requester=)
//     + 发布 body 字段 (submitted_by/reviewed_by/operated_by)
//   - actor.role 透传: 发布侧三方法 role 字段
//   - actor 已配置但缺 role → 发布侧如实抛错 (fail-fast, 不静默回落)
//   - actor 未配置 → 回落 "console" + console.warn 仅一次
//   - Bearer header 与 actor 正交共存

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { HttpWorkspaceBackend } from '../http-workspace-backend';
import type { SubmitPublishRequest, ReviewPublishRequest, RollbackRequest } from '../workspace-types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(okJson({}));
});

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

function lastCallBody(): Record<string, unknown> {
  const init = mockFetch.mock.calls.at(-1)![1] as RequestInit;
  return JSON.parse(init.body as string);
}

function lastCallUrl(): string {
  return mockFetch.mock.calls.at(-1)![0] as string;
}

const SUBMIT_REQ: SubmitPublishRequest = {
  workspace_id: 'w1',
  rule_id: 'r1',
  rule_version: 2
} as unknown as SubmitPublishRequest;
const REVIEW_REQ: ReviewPublishRequest = { action: 'approve' } as unknown as ReviewPublishRequest;
const ROLLBACK_REQ: RollbackRequest = {
  ruleset_name: 'rs1',
  target_version: 1
} as unknown as RollbackRequest;

// ============================================================================
// actor 透传
// ============================================================================

describe('actor 透传 (审计归属 = 真实操作者)', () => {
  test('submitPublish: body 带 actor.name + actor.role', async () => {
    const wb = new HttpWorkspaceBackend('http://x', 't', { name: 'zhang.san', role: 'admin' });
    await wb.submitPublish(SUBMIT_REQ);
    const body = lastCallBody();
    expect(body.submitted_by).toBe('zhang.san');
    expect(body.role).toBe('admin');
  });

  test('reviewPublish: body 带 actor.name + actor.role', async () => {
    const wb = new HttpWorkspaceBackend('http://x', 't', { name: 'li.si', role: 'department_head' });
    await wb.reviewPublish(7, REVIEW_REQ);
    const body = lastCallBody();
    expect(body.reviewed_by).toBe('li.si');
    expect(body.role).toBe('department_head');
  });

  test('emergencyRollback: body 带 actor.name + actor.role', async () => {
    const wb = new HttpWorkspaceBackend('http://x', 't', { name: 'wang.wu', role: 'admin' });
    await wb.emergencyRollback(ROLLBACK_REQ);
    const body = lastCallBody();
    expect(body.operated_by).toBe('wang.wu');
    expect(body.role).toBe('admin');
  });

  test('沙盒编排: started_by / closed_by 取 actor.name,?requester= 同步', async () => {
    const wb = new HttpWorkspaceBackend('http://x', 't', { name: 'zhao.liu' });
    await wb.startSandbox('w1', {} as never);
    expect(lastCallBody().started_by).toBe('zhao.liu');

    await wb.closeSandbox('w1', 3);
    expect(lastCallBody().closed_by).toBe('zhao.liu');

    await wb.listSandboxes('w1');
    expect(lastCallUrl()).toContain('requester=zhao.liu');

    await wb.getSandbox('w1', 3);
    expect(lastCallUrl()).toContain('requester=zhao.liu');
  });

  test('Bearer header 与 actor 正交共存', async () => {
    const wb = new HttpWorkspaceBackend('http://x', 'secret', { name: 'a', role: 'admin' });
    await wb.listSandboxes('w1');
    const init = mockFetch.mock.calls.at(-1)![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
  });
});

// ============================================================================
// fail-fast: actor 已配置但缺 role
// ============================================================================

describe('actor 缺 role → 发布侧抛错 (不静默回落)', () => {
  test('submitPublish 抛 actor-config 错误,含修复指引', async () => {
    const wb = new HttpWorkspaceBackend('http://x', 't', { name: 'zhang.san' });
    await expect(wb.submitPublish(SUBMIT_REQ)).rejects.toThrow(/actor\.role/);
  });

  test('reviewPublish / emergencyRollback 同样抛错', async () => {
    const wb = new HttpWorkspaceBackend('http://x', 't', { name: 'zhang.san' });
    await expect(wb.reviewPublish(1, REVIEW_REQ)).rejects.toThrow(/actor\.role/);
    await expect(wb.emergencyRollback(ROLLBACK_REQ)).rejects.toThrow(/actor\.role/);
  });

  test('沙盒编排不受缺 role 影响 (仅需 name)', async () => {
    const wb = new HttpWorkspaceBackend('http://x', 't', { name: 'zhao.liu' });
    await wb.startSandbox('w1', {} as never);
    expect(lastCallBody().started_by).toBe('zhao.liu');
  });
});

// ============================================================================
// 回落: actor 未配置
// ============================================================================

describe('actor 未配置 → 回落 "console" + warn 一次', () => {
  test('身份/角色回落历史内置值,warn 仅一次', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wb = new HttpWorkspaceBackend('http://x');

    await wb.submitPublish(SUBMIT_REQ);
    expect(lastCallBody().submitted_by).toBe('console');
    expect(lastCallBody().role).toBe('department_head');

    await wb.reviewPublish(1, REVIEW_REQ);
    expect(lastCallBody().reviewed_by).toBe('console');
    expect(lastCallBody().role).toBe('admin');

    await wb.listSandboxes('w1');
    expect(lastCallUrl()).toContain('requester=console');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('actor');
    warnSpy.mockRestore();
  });

  test('两次构造各自独立 warn 一次 (warn 状态是实例级)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await new HttpWorkspaceBackend('http://x').listSandboxes('w1');
    await new HttpWorkspaceBackend('http://x').listSandboxes('w1');
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });
});
