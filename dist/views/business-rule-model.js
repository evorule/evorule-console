// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 业务规则共享模型 — onboarding 与编辑器共用真相源
//
// 依据: 08_领域专家体验优化方案.md §三 (决策3)
//       09_领域专家体验优化实施细则.md §C1
//
// 设计:
//   - 业务字段(field)/操作符(op)/动作(action)的业务化映射,藏起 evorule 底层路径与域类型
//   - 双向转换: BusinessRule ↔ condition/action_set (经 server translateToTransform/translateToConditional)
//   - gte/gt 由 server(决策1)翻译成 not(lt)/not(all),console 只面对业务比较符
//   - 领域字段注册接口预留(DOMAIN_FIELD_REGISTRY),医疗/法律/物流下一阶段填充
export const BUILTIN_FIELDS = [
    { id: 'amount', label: '金额', path: '__exec__.payload.amount', inputType: 'number' },
    { id: 'age', label: '年龄', path: '__exec__.payload.age', inputType: 'number' },
    { id: 'risk', label: '风险等级', path: '__exec__.payload.risk', inputType: 'text' },
];
/** 领域字段注册接口(预留,下一阶段填充医疗/法律/物流) */
const DOMAIN_FIELD_REGISTRY = {};
export function registerDomainFields(domain, fields) {
    DOMAIN_FIELD_REGISTRY[domain] = fields;
}
/** 取所有可用字段(内置 + 已注册领域) */
export function allFields() {
    const domainFields = Object.values(DOMAIN_FIELD_REGISTRY).flat();
    return [...BUILTIN_FIELDS, ...domainFields];
}
/** 按 id 查字段定义 */
export function findField(id) {
    return allFields().find((f) => f.id === id);
}
/** 按 path 反查字段定义(回译用) */
export function findFieldByPath(path) {
    return allFields().find((f) => f.path === path);
}
export const BUSINESS_OPS = [
    { id: 'gte', symbol: '≥', label: '大于等于' },
    { id: 'gt', symbol: '>', label: '大于' },
    { id: 'eq', symbol: '=', label: '等于' },
    { id: 'lt', symbol: '<', label: '小于' },
];
export function opSymbol(op) {
    return BUSINESS_OPS.find((o) => o.id === op)?.symbol ?? op;
}
export const BUSINESS_ACTIONS = [
    { id: 'notify', label: '通知', desc: '打"需通知"标记' },
    { id: 'approve', label: '审批', desc: '打"需审批"标记' },
    { id: 'flag', label: '关注', desc: '打"需关注"标记' },
];
export function actionLabel(a) {
    return BUSINESS_ACTIONS.find((x) => x.id === a)?.label ?? a;
}
/** 动作对应的 result 路径 */
export function actionPath(a) {
    return `__exec__.result.${a}`;
}
// === 自然语言摘要 ===
export function summarize(rule) {
    const condPart = rule.conditions.length
        ? rule.conditions
            .map((c) => {
            const f = findField(c.field);
            const sym = opSymbol(c.op);
            return `[${f?.label ?? c.field}] ${sym} [${formatValue(c.value)}]`;
        })
            .join(' 且 ')
        : '无条件';
    const actPart = rule.actions.length
        ? rule.actions.map((a) => `${actionLabel(a.type)} [${a.role}]`).join(' / ')
        : '无动作';
    return `如果 ${condPart} 则 ${actPart}`;
}
function formatValue(v) {
    if (v === null || v === undefined)
        return '';
    if (typeof v === 'string')
        return v;
    if (typeof v === 'number' || typeof v === 'boolean')
        return String(v);
    try {
        return JSON.stringify(v);
    }
    catch {
        return String(v);
    }
}
// === 双向转换: BusinessRule ↔ condition/action_set ===
/**
 * BusinessRule → condition/action_set (供 server translateToTransform 入参)
 * - condition: {field: path, op, value} (field 用 path, server 据此写进 domain.path)
 * - action_set: {attr: actionPath, operation:"set", value:{role, action}}
 */
export function businessRuleToTranslateInput(rule) {
    const condition = rule.conditions.map((c) => {
        const f = findField(c.field);
        return {
            field: f?.path ?? c.field, // 用 path, server 写进 domain.path
            op: c.op,
            value: c.value,
        };
    });
    const action_set = rule.actions.map((a) => ({
        attr: actionPath(a.type),
        operation: 'set',
        value: { role: a.role, action: a.type },
    }));
    return { condition, action_set };
}
/**
 * condition/action_set (server translateToConditional 出参) → BusinessRule
 * - 回译失败(超子集) → unsupported=true + unsupportedReason
 * - 字段 path 反查不到 → 保留 path 作 field, 标记 unsupported
 * - 动作 attr 不匹配 __exec__.result.{action} → unsupported
 */
export function translateOutputToBusinessRule(condition, action_set, lossy, lostItems) {
    const conditions = [];
    const actions = [];
    const issues = [];
    for (const c of condition) {
        const obj = c;
        const path = String(obj.field ?? '');
        const op = String(obj.op ?? '');
        const value = obj.value;
        const f = findFieldByPath(path);
        if (!f) {
            issues.push(`字段路径 ${path} 不在业务字段表`);
        }
        else if (!BUSINESS_OPS.some((o) => o.id === op)) {
            issues.push(`操作符 ${op} 不在业务子集`);
        }
        conditions.push({ field: f?.id ?? path, op, value });
    }
    for (const a of action_set) {
        const obj = a;
        const attr = String(obj.attr ?? '');
        const value = obj.value;
        // 匹配 __exec__.result.{action}
        const match = attr.match(/^__exec__\.result\.(notify|approve|flag)$/);
        if (match && value && typeof value.role === 'string') {
            actions.push({ type: match[1], role: value.role });
        }
        else {
            issues.push(`动作 ${attr} 不匹配业务动作模式`);
        }
    }
    const unsupported = lossy || issues.length > 0;
    const unsupportedReason = unsupported
        ? [...(lossy ? lostItems : []), ...issues].join('; ') || undefined
        : undefined;
    return { conditions, actions, unsupported, unsupportedReason };
}
