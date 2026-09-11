import type { ExecutionBackend, SessionId, SessionState, CommandResult } from '../backend/types';
import type { WorkspaceBackend, SessionRecord } from '../backend/workspace-types';
/** 命令历史一条记录 */
export interface CommandHistoryEntry {
    /** 提交时间(用于排序和显示) */
    timestamp: number;
    /** 提交的 instruction(JSON 对象) */
    instruction: object;
    /** 提交结果 */
    result: CommandResult;
    /** 提交时的 session version(便于追溯) */
    versionBefore: number | undefined;
}
export declare const sessions: import("svelte/store").Writable<number[]>;
export declare const currentSessionId: import("svelte/store").Writable<number | null>;
export declare const sessionState: import("svelte/store").Writable<SessionState | null>;
export declare const commandHistory: import("svelte/store").Writable<CommandHistoryEntry[]>;
export declare const isLoading: import("svelte/store").Writable<boolean>;
export declare const lastError: import("svelte/store").Writable<string | null>;
/** 当前 session 关联的 workspace 会话记录(可选,workspace 上下文) */
export declare const currentWorkspaceSession: import("svelte/store").Writable<SessionRecord | null>;
/** 当前 session state 的派生视图(只读) */
export declare const reactorPhase: import("svelte/store").Readable<"idle" | "draining" | "executing" | "awaiting_io" | "stable" | "error" | null>;
export declare const reactorVersion: import("svelte/store").Readable<number | null>;
export declare const reactorCausalDepth: import("svelte/store").Readable<number | null>;
export declare const reactorPendingIO: import("svelte/store").Readable<number | null>;
/**
 * 刷新 session 列表(从 execBackend 拉取)。
 * 保留原签名,ExecutionPad 用。
 */
export declare function refreshSessions(backend: ExecutionBackend): Promise<void>;
/**
 * 创建新 session (简化路径,仅 evorule runtime 会话,无 workspace 上下文)。
 * ExecutionPad 用。
 * @returns 新 session id,失败返回 null
 */
export declare function createSession(backend: ExecutionBackend): Promise<SessionId | null>;
/**
 * 创建 workspace 会话(阶段 C.2.4 新增)。
 *
 * 流程:
 *   1. 调 wsBackend.createWorkspaceSession(workspaceId, {rule_id, rule_version_id, ...})
 *      — server 端联动创建 evorule runtime session 并返回 SessionRecord(id 即 runtime id)
 *   2. 将 SessionRecord.id 设为 currentSessionId(无需再调 execBackend.createSession)
 *   3. 记录 currentWorkspaceSession(workspace 上下文,供 UI 显示规则绑定)
 *   4. 立即拉取 session 状态
 *
 * @returns 新 session id,失败返回 null
 */
export declare function createWorkspaceSession(execBackend: ExecutionBackend, wsBackend: WorkspaceBackend, workspaceId: string, ruleId?: string, ruleVersionId?: string): Promise<SessionId | null>;
/**
 * 关闭当前 session (简化路径,仅关 evorule runtime)。
 */
export declare function closeSession(backend: ExecutionBackend, id: SessionId): Promise<void>;
/**
 * 切换到指定 session
 */
export declare function selectSession(backend: ExecutionBackend, id: SessionId): Promise<void>;
/**
 * 刷新当前 session 的状态
 */
export declare function refreshSessionState(backend: ExecutionBackend, id?: SessionId): Promise<void>;
/**
 * 提交命令到当前 session
 *
 * @param backend       执行后端
 * @param instruction   要提交的 instruction(JSON 对象)
 * @returns 命令结果,失败返回 null
 */
export declare function submitCommand(backend: ExecutionBackend, instruction: object): Promise<CommandResult | null>;
/**
 * 订阅 session_switched SSE 事件。
 *
 * @param onSwitched 收到事件时的回调(参数为新 session id)
 * @returns 取消订阅函数
 *
 * 注意:server 端 SSE 端点未实现前,此函数会静默失败(onerror 触发后自动关闭)。
 *       待 server 补端点后,无需改客户端即可生效。
 */
export declare function subscribeSessionSwitched(onSwitched: (newSessionId: SessionId) => void): () => void;
/**
 * 清空所有状态(组件卸载或切换 view 时调用)
 */
export declare function resetSessionStore(): void;
