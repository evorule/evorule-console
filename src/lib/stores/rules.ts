// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 规则库 store — 规则列表 + 当前选中规则
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段2
// 持久化策略:
//   - builtin 规则(3 个示例):代码内置,不持久化
//   - user 规则:localStorage 持久化,key = 'evorule-console:rules:user'
//
// 注意:evorule-console 基础版无网络,所以规则全在本地,不调 evorule-server。
// 用户编辑的规则用于:
//   - 在执行台(Phase 3)选择规则后,作为 instruction 提交给后端
//   - 或导出为 JSON 文件供其他系统使用

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { BUILTIN_RULES } from '$lib/views/RuleLibrary/example-rules';

export interface Rule {
  /** 规则 id,如 "example.set_basic" 或 "user.xxx" */
  id: string;
  /** 版本号,从 1 开始 */
  version: number;
  /** 业务专家可读的描述 */
  description: string;
  /** 原始 JSON 文本(用户编辑的对象) */
  content: string;
  /** 来源:builtin(内置示例) / user(用户创建) */
  source: 'builtin' | 'user';
  /** 创建时间(ISO 字符串) */
  createdAt: string;
  /** 最后更新时间(ISO 字符串) */
  updatedAt: string;
}

const STORAGE_KEY = 'evorule-console:rules:user';

/**
 * 加载所有规则 = builtin(代码内置)+ user(localStorage 持久化)
 */
function loadAllRules(): Rule[] {
  if (!browser) return BUILTIN_RULES;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return BUILTIN_RULES;
  try {
    const userRules = JSON.parse(stored) as Rule[];
    return [...BUILTIN_RULES, ...userRules];
  } catch {
    // localStorage 数据损坏,fallback 到 builtin
    console.warn('[rules] localStorage 损坏,fallback 到 builtin');
    return BUILTIN_RULES;
  }
}

/**
 * 持久化 user 规则(只持久化 source='user' 的)
 */
function persistUserRules(rules: Rule[]): void {
  if (!browser) return;
  const userRules = rules.filter((r) => r.source === 'user');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userRules));
}

// ============================================================================
// Stores
// ============================================================================

export const rules = writable<Rule[]>(loadAllRules());
export const selectedRuleId = writable<string | null>(null);

// 自动选中第一个规则(若没选中)
rules.subscribe((all) => {
  if (!browser) return;
  const current = get(selectedRuleId);
  if (!current && all.length > 0) {
    selectedRuleId.set(all[0].id);
  }
});

/** 当前选中的规则(派生 store) */
export const selectedRule = derived(
  [rules, selectedRuleId],
  ([$rules, $selectedId]) => {
    if (!$selectedId) return null;
    return $rules.find((r) => r.id === $selectedId) ?? null;
  }
);

// ============================================================================
// Actions
// ============================================================================

/**
 * 选中规则
 */
export function selectRule(id: string): void {
  selectedRuleId.set(id);
}

/**
 * 一次性获取当前所有规则(非响应式,测试和命令式代码用)
 */
export function getAllRules(): Rule[] {
  return get(rules);
}

/**
 * 一次性获取当前选中规则 id(非响应式,测试用)
 */
export function getSelectedRuleId(): string | null {
  return get(selectedRuleId);
}

/**
 * 新建规则(添加到 user 规则列表)
 * @returns 新规则的 id
 */
export function addRule(rule: Omit<Rule, 'source' | 'createdAt' | 'updatedAt'>): string {
  const now = new Date().toISOString();
  const newRule: Rule = {
    ...rule,
    source: 'user',
    createdAt: now,
    updatedAt: now
  };
  rules.update((all) => {
    const next = [...all, newRule];
    persistUserRules(next);
    return next;
  });
  selectedRuleId.set(newRule.id);
  return newRule.id;
}

/**
 * 更新规则(只能更新 user 规则,builtin 不可改)
 */
export function updateRule(
  id: string,
  patch: Partial<Pick<Rule, 'version' | 'description' | 'content'>>
): void {
  rules.update((all) => {
    const next = all.map((r) => {
      if (r.id !== id) return r;
      if (r.source === 'builtin') {
        // builtin 规则不允许直接修改 — 调用方应先 duplicate 再改
        throw new Error(
          `updateRule: builtin 规则 "${id}" 不可修改,请先复制为新副本(duplicateRule)`
        );
      }
      return {
        ...r,
        ...patch,
        updatedAt: new Date().toISOString()
      };
    });
    persistUserRules(next);
    return next;
  });
}

/**
 * 复制 builtin 规则为 user 副本(允许编辑)
 * @returns 新规则 id
 */
export function duplicateRule(sourceId: string): string {
  const all = get(rules);
  const source = all.find((r) => r.id === sourceId);
  if (!source) throw new Error(`duplicateRule: 源规则 "${sourceId}" 不存在`);

  const now = new Date().toISOString();
  const newId = `user.${source.id.replace(/^(example|user)\./, '')}.${Date.now()}`;
  const newRule: Rule = {
    ...source,
    id: newId,
    source: 'user',
    createdAt: now,
    updatedAt: now
  };
  rules.update((list) => {
    const next = [...list, newRule];
    persistUserRules(next);
    return next;
  });
  selectedRuleId.set(newId);
  return newId;
}

/**
 * 删除规则(只能删 user 规则)
 */
export function deleteRule(id: string): void {
  rules.update((all) => {
    const target = all.find((r) => r.id === id);
    if (!target) return all;
    if (target.source === 'builtin') {
      throw new Error(`deleteRule: builtin 规则 "${id}" 不可删除`);
    }
    const next = all.filter((r) => r.id !== id);
    persistUserRules(next);
    // 若删除的是当前选中,自动选中第一个
    if (get(selectedRuleId) === id) {
      selectedRuleId.set(next.length > 0 ? next[0].id : null);
    }
    return next;
  });
}

/**
 * 从 JSON 字符串导入规则(用户上传文件)
 * @returns 新规则 id
 */
export function importRule(jsonContent: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (e) {
    throw new Error(`importRule: JSON 解析失败: ${(e as Error).message}`);
  }
  // 数组也是 object,要排除(typeof [] === 'object',但我们要的是 {})
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('importRule: 内容必须是 JSON 对象');
  }
  const obj = parsed as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? `user.${obj.id}` : `user.imported.${Date.now()}`;
  return addRule({
    id,
    version: typeof obj.version === 'number' ? obj.version : 1,
    description:
      typeof obj.description === 'string'
        ? obj.description
        : '(导入的规则,无描述)',
    content: jsonContent
  });
}

/**
 * 导出规则为 JSON 字符串(用于下载)
 */
export function exportRule(id: string): string {
  const all = get(rules);
  const rule = all.find((r) => r.id === id);
  if (!rule) throw new Error(`exportRule: 规则 "${id}" 不存在`);
  return rule.content;
}
