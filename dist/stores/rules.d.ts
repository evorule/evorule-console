import type { WorkspaceBackend, RuleState } from '../backend/workspace-types';
import { isRuleReadonly } from './workspace';
export type { RuleState } from '../backend/workspace-types';
/**
 * 规则视图模型(对齐 server RuleRecord + 懒加载 content)。
 *
 * 与 server RuleRecord 的差异:
 *   - 字段名 camelCase(前端约定)
 *   - content/version 懒加载(从 RuleVersionRecord 取,默认 undefined)
 */
export interface Rule {
    /** RuleRecord.id (ULID,server 生成) */
    id: string;
    /** RuleRecord.workspace_id */
    workspaceId: string;
    /** RuleRecord.name (workspace 内唯一,替代旧 id 语义) */
    name: string;
    /** RuleRecord.state (draft/candidate/active/blocked/archived) */
    state: RuleState;
    /** RuleRecord.current_version_id (Draft 状态时为 null) */
    currentVersionId: string | null;
    /** RuleRecord.description */
    description: string | null;
    /** RuleRecord.metadata (JSON 字符串,空时为 "{}") */
    metadata: string;
    /** RuleRecord.created_at (ISO 字符串) */
    createdAt: string;
    /** RuleRecord.updated_at (ISO 字符串) */
    updatedAt: string;
    /** 当前版本内容(懒加载,从 RuleVersionRecord.content 取) */
    content?: string;
    /** 当前版本号(懒加载,从 RuleVersionRecord.version 取) */
    version?: number;
}
export declare const rules: import("svelte/store").Writable<Rule[]>;
export declare const selectedRuleId: import("svelte/store").Writable<string | null>;
export declare const migrationNeeded: import("svelte/store").Writable<boolean>;
export declare const isOffline: import("svelte/store").Writable<boolean>;
export declare const lastError: import("svelte/store").Writable<string | null>;
/** 当前选中的规则(派生 store) */
export declare const selectedRule: import("svelte/store").Readable<Rule | null>;
/**
 * 从 server 拉取 workspace 的规则列表。
 *
 * 注意:server listRules 返回 RuleRecord[] 不含 content;
 *      content 在选中规则时通过 getRule 懒加载(阶段 D 视图可优化为批量预取)。
 */
export declare function refreshRules(backend: WorkspaceBackend, workspaceId: string): Promise<void>;
/**
 * 懒加载规则内容(content + version)。
 *
 * server listRules / getRule 返回的 RuleRecord 不含 content(content 在 rule_versions 表)。
 * 此函数调 backend.listRuleVersions 取首条(Current,server 按 version 降序)写入 rule。
 *
 * 幂等:rule.content !== undefined 时直接返回缓存,不触发网络请求。
 *
 * @returns content 字符串;规则不存在或加载失败时返回 null
 */
export declare function loadRuleContent(backend: WorkspaceBackend, workspaceId: string, ruleId: string): Promise<string | null>;
/**
 * 确保规则存在于 store 中(直接导航到 /workspace/editor/{id} 时使用)。
 *
 * 背景:refreshRules 只在 /workspace 路由 onMount 调用。若用户直接访问
 * /workspace/editor/{id}(刷新 / 外链),$rules 为空 → 编辑器派生的 rule 为 null
 * → 显示"未找到规则",且 loadRuleContent 也会因 store 无此规则而提前返回 null。
 *
 * 此函数按 id 单条拉取:store 已有则直接返回;否则调 backend.getRule 取元数据
 * (不含 content,content 仍由 loadRuleContent 懒加载)并加入 store。
 *
 * @returns 规则视图模型;不存在或加载失败时返回 null
 */
export declare function ensureRule(backend: WorkspaceBackend, workspaceId: string, ruleId: string): Promise<Rule | null>;
/**
 * 选中规则(并懒加载 content,若尚未加载)。
 */
export declare function selectRule(backend: WorkspaceBackend, workspaceId: string, id: string): Promise<void>;
/** 仅切换 selectedRuleId(不触发网络,用于已加载的规则) */
export declare function selectRuleLocal(id: string): void;
/**
 * 新建规则(调 server createRule)。
 * @returns 新规则 id (ULID)
 */
export declare function addRule(backend: WorkspaceBackend, workspaceId: string, req: {
    name: string;
    content: string;
    description?: string;
}): Promise<string>;
/**
 * 更新规则内容(仅 Draft 状态允许,调 server updateRuleContent)。
 */
export declare function updateRule(backend: WorkspaceBackend, workspaceId: string, ruleId: string, patch: {
    content: string;
}): Promise<void>;
/**
 * 复制规则为可编辑副本(替代旧 duplicateRule,通过 createRule 实现)。
 * @returns 新规则 id
 */
export declare function duplicateRule(backend: WorkspaceBackend, workspaceId: string, sourceId: string): Promise<string>;
/**
 * 归档规则(替代旧 deleteRule,调 server archiveRule)。
 * 注意:server 不支持物理删除,归档后规则 archived_at 填充、state='archived'。
 */
export declare function deleteRule(backend: WorkspaceBackend, workspaceId: string, ruleId: string): Promise<void>;
/**
 * 从 JSON 字符串导入规则(用户上传文件)。
 * @returns 新规则 id
 */
export declare function importRule(backend: WorkspaceBackend, workspaceId: string, jsonContent: string): Promise<string>;
/**
 * 导出规则为 JSON 字符串(用于下载)。
 */
export declare function exportRule(id: string): string;
/**
 * 检测旧 localStorage 数据是否存在,设置 migrationNeeded flag。
 * 在 /workspace 路由 onMount 调用。
 */
export declare function checkMigrationNeeded(): void;
/**
 * 迁移旧 localStorage 规则到 server。
 *
 * 流程:
 *   1. 备份旧 key 到 LEGACY_BACKUP_KEY(防止迁移失败丢数据)
 *   2. 解析旧规则(JSON 数组,旧 Rule 结构)
 *   3. 逐条 createRule(name=旧 id, content=旧 content, description=旧 description)
 *   4. 全部成功后删除旧 key
 *   5. migrationNeeded.set(false)
 *
 * 失败处理:某条迁移失败不阻断整体,console.warn 记录;全部失败则保留旧 key。
 */
export declare function migrateLegacyRules(backend: WorkspaceBackend, workspaceId: string): Promise<{
    migrated: number;
    failed: number;
}>;
/** 一次性获取当前所有规则 */
export declare function getAllRules(): Rule[];
/** 一次性获取当前选中规则 id */
export declare function getSelectedRuleId(): string | null;
/**
 * 判断规则是否只读(转调 workspace.isRuleReadonly,便于组件就近 import)。
 */
export { isRuleReadonly };
/**
 * 清空所有状态(组件卸载或切换 workspace 时调用)。
 */
export declare function resetRulesStore(): void;
