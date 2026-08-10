import type { ExecutionBackend, SessionId, SessionState, CommandResult } from '../backend/types';
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
/** 当前 session state 的派生视图(只读) */
export declare const reactorPhase: import("svelte/store").Readable<"idle" | "draining" | "executing" | "awaiting_io" | "stable" | "error" | null>;
export declare const reactorVersion: import("svelte/store").Readable<number | null>;
export declare const reactorCausalDepth: import("svelte/store").Readable<number | null>;
export declare const reactorPendingIO: import("svelte/store").Readable<number | null>;
/**
 * 刷新 session 列表(从 backend 拉取)
 */
export declare function refreshSessions(backend: ExecutionBackend): Promise<void>;
/**
 * 创建新 session
 * @returns 新 session id,失败返回 null
 */
export declare function createSession(backend: ExecutionBackend): Promise<SessionId | null>;
/**
 * 关闭当前 session
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
 * 清空所有状态(组件卸载或切换 view 时调用)
 */
export declare function resetSessionStore(): void;
