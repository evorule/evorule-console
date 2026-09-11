// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 规则库单元测试
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段2 验收 + 实施文档 §C.2.3
// 测试覆盖:
//   1. 内置示例规则全部 PASS L_console G1-G7 预校验 (核心资产,保留)
//   2. BUILTIN_RULES 种子数据结构正确性 (阶段 C.2.3 新增)
//
// 阶段 C.2.3 调整说明:
//   - 旧版第 2 部分 "rules store actions" 测试基于 localStorage + 同步 API,已废弃
//   - 新版 rules store 为 async + WorkspaceBackend,需 mock backend,留待阶段 D 视图稳定后补全
//   - G1-G7 校验测试是核心资产(验证种子规则本身),必须保留
//
// 运行: npx vitest run src/lib/views/RuleLibrary/rule-library.test.ts
import { describe, it, expect } from 'vitest';
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
        describe(`规则: ${rule.name}`, () => {
            it(`应通过 G1-G7 全部 7 项预校验`, () => {
                const result = RuleValidator.validate(rule.content);
                expect(result.valid, result.errors.map((e) => `${e.gate}: ${e.message}`).join('\n')).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
            it(`content 应是合法 JSON`, () => {
                const parsed = JSON.parse(rule.content);
                expect(parsed).toBeTypeOf('object');
                // 种子规则 JSON 内部的 id 字段应与 name 一致(约定)
                expect(parsed.id).toBe(rule.name);
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
// 2. BUILTIN_RULES 种子数据结构正确性 (阶段 C.2.3 新增)
// ============================================================================
describe('BUILTIN_RULES 种子数据结构', () => {
    it('每条种子应包含 name/description/content 三个字段', () => {
        for (const rule of BUILTIN_RULES) {
            expect(rule).toHaveProperty('name');
            expect(rule).toHaveProperty('description');
            expect(rule).toHaveProperty('content');
            expect(typeof rule.name).toBe('string');
            expect(typeof rule.description).toBe('string');
            expect(typeof rule.content).toBe('string');
        }
    });
    it('所有 name 应以 "example." 前缀开头 (isRuleReadonly 据此判定)', () => {
        for (const rule of BUILTIN_RULES) {
            expect(rule.name.startsWith('example.')).toBe(true);
        }
    });
    it('所有 name 应唯一 (workspace 内唯一约束)', () => {
        const names = BUILTIN_RULES.map((r) => r.name);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
    });
    it('不应包含旧版的 source/createdAt/updatedAt 字段 (阶段 C.2.3 已移除)', () => {
        for (const rule of BUILTIN_RULES) {
            expect(rule).not.toHaveProperty('source');
            expect(rule).not.toHaveProperty('createdAt');
            expect(rule).not.toHaveProperty('updatedAt');
            expect(rule).not.toHaveProperty('version');
            expect(rule).not.toHaveProperty('id');
        }
    });
});
// ============================================================================
// 3. rules store actions 测试 (阶段 C.2.3 暂略)
// ============================================================================
//
// 旧版测试基于 localStorage + 同步 API (addRule/updateRule/deleteRule 等),
// 阶段 C.2.3 重构后 store 改为 async + WorkspaceBackend:
//   - addRule(backend, workspaceId, req) → Promise<string>
//   - updateRule(backend, workspaceId, ruleId, patch) → Promise<void>
//   - deleteRule(backend, workspaceId, ruleId) → Promise<void>
//   - duplicateRule(backend, workspaceId, sourceId) → Promise<string>
//   - importRule(backend, workspaceId, jsonContent) → Promise<string>
//
// 这类测试需要 mock WorkspaceBackend (35 方法),工作量较大。
// 留待阶段 D 视图稳定后,随 /workspace 路由的集成测试一并补全。
//
// 详见: 实施文档_界面升级_v1.0.md §C.4 验收项 #3 (rules.ts 改造)
