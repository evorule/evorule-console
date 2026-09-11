export type BusinessFieldId = 'amount' | 'age' | 'risk' | string;
export interface BusinessFieldDef {
    id: BusinessFieldId;
    label: string;
    path: string;
    inputType: 'number' | 'text';
}
export declare const BUILTIN_FIELDS: BusinessFieldDef[];
export declare function registerDomainFields(domain: string, fields: BusinessFieldDef[]): void;
/** 取所有可用字段(内置 + 已注册领域) */
export declare function allFields(): BusinessFieldDef[];
/** 按 id 查字段定义 */
export declare function findField(id: BusinessFieldId): BusinessFieldDef | undefined;
/** 按 path 反查字段定义(回译用) */
export declare function findFieldByPath(path: string): BusinessFieldDef | undefined;
export type BusinessOp = 'gte' | 'gt' | 'eq' | 'lt';
export declare const BUSINESS_OPS: {
    id: BusinessOp;
    symbol: string;
    label: string;
}[];
export declare function opSymbol(op: BusinessOp): string;
export type BusinessAction = 'notify' | 'approve' | 'flag';
export declare const BUSINESS_ACTIONS: {
    id: BusinessAction;
    label: string;
    desc: string;
}[];
export declare function actionLabel(a: BusinessAction): string;
/** 动作对应的 result 路径 */
export declare function actionPath(a: BusinessAction): string;
export interface BusinessCondition {
    field: BusinessFieldId;
    op: BusinessOp;
    value: unknown;
}
export interface BusinessActionItem {
    type: BusinessAction;
    role: string;
}
export interface BusinessRule {
    name: string;
    description: string;
    conditions: BusinessCondition[];
    actions: BusinessActionItem[];
    /** 回译时 transform 超出业务子集 → 只读,引导切 JSON */
    unsupported?: boolean;
    unsupportedReason?: string;
}
export declare function summarize(rule: Pick<BusinessRule, 'conditions' | 'actions'>): string;
/**
 * BusinessRule → condition/action_set (供 server translateToTransform 入参)
 * - condition: {field: path, op, value} (field 用 path, server 据此写进 domain.path)
 * - action_set: {attr: actionPath, operation:"set", value:{role, action}}
 */
export declare function businessRuleToTranslateInput(rule: Pick<BusinessRule, 'conditions' | 'actions'>): {
    condition: unknown[];
    action_set: unknown[];
};
/**
 * condition/action_set (server translateToConditional 出参) → BusinessRule
 * - 回译失败(超子集) → unsupported=true + unsupportedReason
 * - 字段 path 反查不到 → 保留 path 作 field, 标记 unsupported
 * - 动作 attr 不匹配 __exec__.result.{action} → unsupported
 */
export declare function translateOutputToBusinessRule(condition: unknown[], action_set: unknown[], lossy: boolean, lostItems: string[]): Pick<BusinessRule, 'conditions' | 'actions' | 'unsupported' | 'unsupportedReason'>;
