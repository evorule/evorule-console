export class EvoruleServerClient {
    /**
     * @param {string} [baseUrl]
     */
    constructor(baseUrl?: string);
    baseUrl: string;
    /**
     * GET /api/health
     * @returns {Promise<boolean>}
     */
    health(): Promise<boolean>;
    /**
     * GET /api/sessions
     * @returns {Promise<number[]>} session id 列表
     */
    listSessions(): Promise<number[]>;
    /**
     * GET /api/sessions/{id}/state
     * @param {number|string} id
     * @returns {Promise<SessionState>}
     */
    getSessionState(id: number | string): Promise<SessionState>;
    /**
     * GET /api/sessions/{id}/audit
     * @param {number|string} id
     * @returns {Promise<SessionAudit>}
     */
    getSessionAudit(id: number | string): Promise<SessionAudit>;
    /**
     * GET /api/sessions/{id}/replay
     * @param {number|string} id
     * @returns {Promise<SessionReplay>}
     */
    getSessionReplay(id: number | string): Promise<SessionReplay>;
}
/**
 * 默认 client 实例 — 用 evorule-server default 18080 端口.
 * 可以根据需要 new EvoruleServerClient(otherUrl).
 */
export const evoruleClient: EvoruleServerClient;
export type ReactorState = {
    /**
     * - 当前 phase: idle / awaiting_io / stable / error
     */
    phase?: string | undefined;
    causal_depth?: number | undefined;
    current_step?: number | undefined;
    pending_io_count?: number | undefined;
    structural_invariant_violations?: number | undefined;
};
export type SessionState = {
    payload?: Object | undefined;
    queue?: unknown[] | undefined;
    reactor?: ReactorState | undefined;
    version?: number | undefined;
};
export type SessionAudit = {
    entries?: unknown[] | undefined;
    last_audited_version?: number | undefined;
    entry_count?: number | undefined;
    last_hash?: string | undefined;
    verify_status?: string | undefined;
};
export type SessionReplay = {
    facts?: unknown[] | undefined;
};
