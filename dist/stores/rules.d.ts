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
export declare const rules: import("svelte/store").Writable<Rule[]>;
export declare const selectedRuleId: import("svelte/store").Writable<string | null>;
/** 当前选中的规则(派生 store) */
export declare const selectedRule: import("svelte/store").Readable<Rule | null>;
/**
 * 选中规则
 */
export declare function selectRule(id: string): void;
/**
 * 一次性获取当前所有规则(非响应式,测试和命令式代码用)
 */
export declare function getAllRules(): Rule[];
/**
 * 一次性获取当前选中规则 id(非响应式,测试用)
 */
export declare function getSelectedRuleId(): string | null;
/**
 * 新建规则(添加到 user 规则列表)
 * @returns 新规则的 id
 */
export declare function addRule(rule: Omit<Rule, 'source' | 'createdAt' | 'updatedAt'>): string;
/**
 * 更新规则(只能更新 user 规则,builtin 不可改)
 */
export declare function updateRule(id: string, patch: Partial<Pick<Rule, 'version' | 'description' | 'content'>>): void;
/**
 * 复制 builtin 规则为 user 副本(允许编辑)
 * @returns 新规则 id
 */
export declare function duplicateRule(sourceId: string): string;
/**
 * 删除规则(只能删 user 规则)
 */
export declare function deleteRule(id: string): void;
/**
 * 从 JSON 字符串导入规则(用户上传文件)
 * @returns 新规则 id
 */
export declare function importRule(jsonContent: string): string;
/**
 * 导出规则为 JSON 字符串(用于下载)
 */
export declare function exportRule(id: string): string;
