import type { WorkspaceBackend, VerdictContractRecord, EvaluateVerdictResult } from '../backend/workspace-types';
export declare const verdictContracts: import("svelte/store").Writable<VerdictContractRecord[]>;
export declare const currentVerdictContract: import("svelte/store").Writable<VerdictContractRecord | null>;
export declare const lastEvaluateResult: import("svelte/store").Writable<EvaluateVerdictResult | null>;
export declare const isLoading: import("svelte/store").Writable<boolean>;
export declare const lastError: import("svelte/store").Writable<string | null>;
/**
 * 刷新指定 workspace 的判定契约列表。
 */
export declare function refreshVerdictContracts(backend: WorkspaceBackend, workspaceId: string): Promise<void>;
/**
 * 评估判定契约(应用层判定,非 evorule 确定性)。
 *
 * @param backend       workspace 后端
 * @param workspaceId   workspace id
 * @param payload       判定输入(JSON 可序列化对象)
 * @param contractId    指定契约 id(可选,缺省由 server 选默认契约)
 */
export declare function evaluateVerdict(backend: WorkspaceBackend, workspaceId: string, payload: unknown, contractId?: number): Promise<EvaluateVerdictResult | null>;
/**
 * 创建判定契约。
 */
export declare function createVerdictContract(backend: WorkspaceBackend, workspaceId: string, req: {
    name: string;
    rules_json: string;
    is_default?: boolean;
    created_by: string;
}): Promise<VerdictContractRecord | null>;
/**
 * 清空所有状态。
 */
export declare function resetVerdictStore(): void;
