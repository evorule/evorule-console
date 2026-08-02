// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 规则库单元测试
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段2 验收
// 测试覆盖:
//   1. 内置示例规则全部 PASS L_console G1-G7 预校验
//   2. rules store 的 addRule/updateRule/deleteRule/duplicateRule/importRule/exportRule
//   3. builtin 规则不可修改/删除(保护内置示例)
//
// 运行: npx vitest run src/lib/views/RuleLibrary/rule-library.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RuleValidator } from '../../validators/ruleValidator';
import { BUILTIN_RULES } from './example-rules';
// ============================================================================
// 1. 内置示例规则必须全部通过 L_console G1-G7 预校验
//    (这是阶段 2 验收硬要求 — 不通过则示例本身有 bug)
// ============================================================================
describe('内置示例规则 — L_console G1-G7 预校验', () => {
    it('应有 3 个内置示例', () => {
        expect(BUILTIN_RULES).toHaveLength(3);
    });
    for (const rule of BUILTIN_RULES) {
        describe(`规则: ${rule.id}`, () => {
            it(`应通过 G1-G7 全部 7 项预校验`, () => {
                const result = RuleValidator.validate(rule.content);
                expect(result.valid, result.errors.map((e) => `${e.gate}: ${e.message}`).join('\n')).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
            it(`content 应是合法 JSON`, () => {
                const parsed = JSON.parse(rule.content);
                expect(parsed).toBeTypeOf('object');
                expect(parsed.id).toBe(rule.id);
            });
            it(`应有 transform 数组`, () => {
                const parsed = JSON.parse(rule.content);
                expect(Array.isArray(parsed.transform)).toBe(true);
                expect(parsed.transform.length).toBeGreaterThan(0);
            });
            it(`末条应是 branch + all([]) 兜底(G6)`, () => {
                const parsed = JSON.parse(rule.content);
                const last = parsed.transform[parsed.transform.length - 1];
                expect(last.type).toBe('branch');
                expect(last.params.domain.type).toBe('all');
                expect(last.params.domain.domains).toEqual([]);
            });
        });
    }
});
// ============================================================================
// 2. rules store actions 测试
// ============================================================================
// Mock SvelteKit 的 $app/environment + localStorage
const mockLocalStorage = (() => {
    let store = {};
    return {
        getItem: vi.fn((k) => store[k] ?? null),
        setItem: vi.fn((k, v) => {
            store[k] = v;
        }),
        removeItem: vi.fn((k) => {
            delete store[k];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        _store: () => store
    };
})();
vi.mock('$app/environment', () => ({
    browser: true
}));
vi.stubGlobal('localStorage', mockLocalStorage);
vi.stubGlobal('console', {
    ...console,
    warn: vi.fn()
});
// 动态导入 store(每个测试前重新加载模块,确保状态隔离)
async function loadFreshStore() {
    vi.resetModules();
    mockLocalStorage.clear();
    const mod = await import('../../stores/rules');
    return mod;
}
// 仅重新加载模块,不清 localStorage(用于测试持久化)
async function reloadStoreKeepStorage() {
    vi.resetModules();
    const mod = await import('../../stores/rules');
    return mod;
}
describe('rules store — actions', () => {
    let store;
    beforeEach(async () => {
        store = await loadFreshStore();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
    it('初始状态应包含 3 个 builtin 规则', () => {
        const all = store.getAllRules();
        expect(all).toHaveLength(3);
        expect(all.every((r) => r.source === 'builtin')).toBe(true);
    });
    it('addRule 应新增 user 规则到列表', () => {
        const id = store.addRule({
            id: 'user.test1',
            version: 1,
            description: '测试规则',
            content: JSON.stringify({
                id: 'user.test1',
                version: 1,
                transform: [
                    { type: 'set', params: { attr: '__exec__.payload.x', operation: 'set', value: 1 } },
                    { type: 'branch', params: { domain: { type: 'all', domains: [] }, on_true: [] } }
                ]
            })
        });
        expect(id).toBe('user.test1');
        const all = store.getAllRules();
        expect(all).toHaveLength(4);
        expect(all.find((r) => r.id === 'user.test1')).toBeTruthy();
        expect(all.find((r) => r.id === 'user.test1')?.source).toBe('user');
    });
    it('addRule 后 selectedRuleId 应自动切换到新规则', () => {
        store.addRule({
            id: 'user.test_select',
            version: 1,
            description: 'test',
            content: '{}'
        });
        expect(store.getSelectedRuleId()).toBe('user.test_select');
    });
    it('updateRule 应只更新 user 规则,builtin 不可改', () => {
        // builtin 不可改 — 应抛错
        expect(() => store.updateRule('example.set_basic', { description: 'modified' })).toThrow(/builtin/);
        // user 规则可改
        store.addRule({
            id: 'user.edit_me',
            version: 1,
            description: 'before',
            content: '{}'
        });
        store.updateRule('user.edit_me', { description: 'after', version: 2 });
        const rule = store.getAllRules().find((r) => r.id === 'user.edit_me');
        expect(rule?.description).toBe('after');
        expect(rule?.version).toBe(2);
    });
    it('deleteRule 应只删 user 规则,builtin 不可删', () => {
        expect(() => store.deleteRule('example.set_basic')).toThrow(/builtin/);
        // 添加再删
        store.addRule({
            id: 'user.del_me',
            version: 1,
            description: 'to be deleted',
            content: '{}'
        });
        expect(store.getAllRules()).toHaveLength(4);
        store.deleteRule('user.del_me');
        expect(store.getAllRules()).toHaveLength(3);
        expect(store.getAllRules().find((r) => r.id === 'user.del_me')).toBeUndefined();
    });
    it('deleteRule 删除当前选中规则后,应自动选中第一个', () => {
        store.addRule({
            id: 'user.del_selected',
            version: 1,
            description: 'will be selected then deleted',
            content: '{}'
        });
        expect(store.getSelectedRuleId()).toBe('user.del_selected');
        store.deleteRule('user.del_selected');
        // 删完后,应自动选中第一个(builtin 第一个)
        expect(store.getSelectedRuleId()).toBe('example.set_basic');
    });
    it('duplicateRule 应复制 builtin 为 user 副本', () => {
        const newId = store.duplicateRule('example.set_basic');
        // duplicateRule 把 source.id 的 example./user. 前缀去掉,加 user. + timestamp
        // example.set_basic → user.set_basic.{timestamp}
        expect(newId).toMatch(/^user\.set_basic\.\d+$/);
        const copy = store.getAllRules().find((r) => r.id === newId);
        expect(copy?.source).toBe('user');
        expect(copy?.content).toBe(BUILTIN_RULES[0].content);
        expect(copy?.description).toBe(BUILTIN_RULES[0].description);
    });
    it('duplicateRule 源规则不存在时应抛错', () => {
        expect(() => store.duplicateRule('nonexistent.id')).toThrow(/不存在/);
    });
    it('importRule 应从 JSON 字符串导入规则', () => {
        const json = JSON.stringify({
            id: 'imported.rule',
            version: 1,
            description: '导入的规则',
            transform: [
                { type: 'set', params: { attr: '__exec__.payload.x', operation: 'set', value: 1 } },
                { type: 'branch', params: { domain: { type: 'all', domains: [] }, on_true: [] } }
            ]
        });
        const id = store.importRule(json);
        expect(id).toBe('user.imported.rule');
        const rule = store.getAllRules().find((r) => r.id === id);
        expect(rule?.content).toBe(json);
    });
    it('importRule 无效 JSON 应抛错', () => {
        expect(() => store.importRule('not valid json')).toThrow(/JSON 解析失败/);
    });
    it('importRule 非 object 内容应抛错', () => {
        expect(() => store.importRule('[1,2,3]')).toThrow(/必须是 JSON 对象/);
    });
    it('exportRule 应返回规则的原始 JSON 内容', () => {
        const content = store.exportRule('example.set_basic');
        expect(content).toBe(BUILTIN_RULES[0].content);
    });
    it('exportRule 不存在的规则应抛错', () => {
        expect(() => store.exportRule('nonexistent')).toThrow(/不存在/);
    });
    it('user 规则应持久化到 localStorage', () => {
        store.addRule({
            id: 'user.persist_me',
            version: 1,
            description: 'test persistence',
            content: '{}'
        });
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
        const stored = mockLocalStorage._store()['evorule-console:rules:user'];
        expect(stored).toBeDefined();
        const parsed = JSON.parse(stored);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].id).toBe('user.persist_me');
    });
    it('重新加载 store 后,user 规则应从 localStorage 恢复', async () => {
        store.addRule({
            id: 'user.survive_reload',
            version: 1,
            description: 'should survive module reload',
            content: '{}'
        });
        // 重新加载模块(保留 localStorage,验证持久化)
        const fresh = await reloadStoreKeepStorage();
        const all = fresh.getAllRules();
        expect(all).toHaveLength(4); // 3 builtin + 1 user
        expect(all.find((r) => r.id === 'user.survive_reload')).toBeTruthy();
    });
    it('localStorage 损坏时应 fallback 到 builtin', async () => {
        // 先写入损坏的 localStorage,再 reload(不清 storage)
        mockLocalStorage.setItem('evorule-console:rules:user', '{invalid json');
        const fresh = await reloadStoreKeepStorage();
        expect(fresh.getAllRules()).toHaveLength(3); // fallback 到 builtin
    });
});
