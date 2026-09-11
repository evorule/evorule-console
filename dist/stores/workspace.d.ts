import { get } from 'svelte/store';
import type { WorkspaceBackend, WorkspaceRecord, SessionRecord, SandboxSession, PublishQueueItem, ProductionStateRecord } from '../backend/workspace-types';
export declare const workspaces: import("svelte/store").Writable<WorkspaceRecord[]>;
export declare const currentWorkspace: import("svelte/store").Writable<WorkspaceRecord | null>;
export declare const workspaceSessions: import("svelte/store").Writable<SessionRecord[]>;
export declare const workspaceSandboxes: import("svelte/store").Writable<SandboxSession[]>;
export declare const publishQueue: import("svelte/store").Writable<PublishQueueItem[]>;
export declare const productionState: import("svelte/store").Writable<ProductionStateRecord | null>;
export declare const isLoading: import("svelte/store").Writable<boolean>;
export declare const lastError: import("svelte/store").Writable<string | null>;
/** 当前 workspace id (派生,只读) */
export declare const currentWorkspaceId: import("svelte/store").Readable<string | null>;
/**
 * 拉取 workspace 列表。
 * 列表为空时自动 ensureDefaultWorkspace(开箱可用)。
 */
export declare function refreshWorkspaces(backend: WorkspaceBackend): Promise<void>;
/**
 * 首次启动逻辑:创建默认工作空间 + 种入 3 条 BUILTIN_RULES。
 *
 * 流程:
 *   1. listWorkspaces 确认为空
 *   2. createWorkspace({name:'默认工作空间', owner_id:'console', ...})
 *   3. seedBuiltinRules(backend, workspaceId) — 种入 3 条示例
 *   4. localStorage 记录 default-workspace-id
 *   5. 切换 currentWorkspace 到新建的 ws
 *
 * 幂等性:若已存在 workspace 则不重复创建(由 refreshWorkspaces 保证)。
 */
export declare function ensureDefaultWorkspace(backend: WorkspaceBackend): Promise<WorkspaceRecord>;
/**
 * 种入 3 条 BUILTIN_RULES 到指定 workspace。
 *
 * 幂等:先 listRules 查重,已存在(按 name 匹配)则跳过。
 * 元数据:metadata = {readonly:true, builtin:true}(isReadonly 据此判定)
 */
export declare function seedBuiltinRules(backend: WorkspaceBackend, workspaceId: string): Promise<number>;
/**
 * 切换当前 workspace,刷新其会话列表。
 */
export declare function selectWorkspace(backend: WorkspaceBackend, id: string): Promise<void>;
/**
 * 刷新发布队列。
 */
export declare function refreshPublishQueue(backend: WorkspaceBackend, status?: string): Promise<void>;
/**
 * 刷新生产状态(单行表)。
 */
export declare function refreshProductionState(backend: WorkspaceBackend): Promise<void>;
/**
 * 刷新当前 workspace 的沙盒列表。
 */
export declare function refreshSandboxes(backend: WorkspaceBackend, workspaceId: string): Promise<void>;
/**
 * 清空所有状态(组件卸载或切换 view 时调用)。
 */
export declare function resetWorkspaceStore(): void;
/**
 * 判断规则是否只读(内置示例或 archived)。
 *
 * 启发式:
 *   1. metadata.readonly === true → 只读
 *   2. metadata.builtin === true → 只读
 *   3. name 以 "example." 开头 → 只读(种子规则约定)
 *
 * 注意:server 端 createRule 接口未暴露 metadata 字段(阶段 A.1 表已加列但 API 未透出),
 *      故此处 name 前缀判断是核心依据;metadata 字段留作阶段 D 透出后的二次校验。
 */
export declare function isRuleReadonly(rule: {
    name: string;
    metadata?: string;
}): boolean;
export { get };
