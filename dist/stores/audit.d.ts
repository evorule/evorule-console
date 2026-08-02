import type { ExecutionBackend, SessionId, SessionAudit, VerifyResult, Fact, CausalChain } from '../backend/types';
/** 当前 session 的审计链快照(从 backend.getAudit 拉取) */
export declare const auditData: import("svelte/store").Writable<SessionAudit | null>;
/** verifyAudit 的结果(从 backend.verifyAudit 拉取,null 表示未验证) */
export declare const verifyResult: import("svelte/store").Writable<VerifyResult | null>;
/**
 * 当前展示的因果链(从 backend.getCausalChain 拉取)。
 * null 表示未选中任何 fact 的因果。
 */
export interface CausalSelection {
    /** 触发查询的 fact id */
    factId: number;
    /** 因果链(可能为空数组,表示该 fact 无前因) */
    chain: Fact[];
}
export declare const causalSelection: import("svelte/store").Writable<CausalSelection | null>;
/** 审计 loading(audit/verify/causal 任一在进行) */
export declare const auditLoading: import("svelte/store").Writable<boolean>;
/** 审计相关错误消息 */
export declare const auditError: import("svelte/store").Writable<string | null>;
/**
 * 刷新审计链。
 *
 * 设计说明:
 *   - id 必传(TS 强制),避免 audit store 反向 import session store 造成循环依赖
 *   - 组件层(AuditView.svelte)负责注入 currentSessionId,store 只关心数据本身
 *
 * @param backend  执行后端
 * @param id       当前 session id(组件层从 session store 取后传入)
 * @returns 拉取到的 SessionAudit,失败返回 null
 */
export declare function refreshAudit(backend: ExecutionBackend, id: SessionId): Promise<SessionAudit | null>;
/**
 * 验证审计链(blake3 哈希链验证)。
 * 验证由核心仓完成,本函数只是把核心仓的判断展示出来。
 *
 * @param backend  执行后端
 * @param id       可选 session id
 */
export declare function verifyAuditChain(backend: ExecutionBackend, id: SessionId): Promise<VerifyResult | null>;
/**
 * 拉取指定 fact 的因果链。
 * 用户在审计链列表点击某条 fact 时调用。
 *
 * @param backend  执行后端
 * @param id       session id
 * @param factId   要追溯的 fact id
 */
export declare function fetchCausalChain(backend: ExecutionBackend, id: SessionId, factId: number): Promise<CausalChain | null>;
/**
 * 清空因果选择(关闭因果侧栏)。
 */
export declare function clearCausalSelection(): void;
/**
 * 重置审计 store(切换 session / 组件卸载时调用)。
 */
export declare function resetAuditStore(): void;
