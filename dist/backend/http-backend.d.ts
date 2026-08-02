import type { SessionId, SessionState, SessionAudit, VerifyResult, Fact, DiffResult, CausalChain, CommandResult, ExecutionBackend } from './types';
/**
 * evorule-server 连接或响应异常的统一错误类型。
 * 视图层用 instanceof 区分网络错误与业务错误。
 */
export declare class HttpBackendError extends Error {
    readonly status: number;
    readonly endpoint: string;
    constructor(message: string, status: number, endpoint: string);
}
/**
 * HttpBackend — 调 evorule-server HTTP API 实现 ExecutionBackend。
 *
 * 用法:
 *   const backend = new HttpBackend();           // 默认 127.0.0.1:18080
 *   const backend = new HttpBackend('http://localhost:9000');
 *   const ok = await backend.health();
 */
export declare class HttpBackend implements ExecutionBackend {
    private readonly baseUrl;
    constructor(baseUrl?: string);
    /**
     * 统一 fetch + JSON 解析 + 错误处理。
     * 对齐 ttd api.js fetchJson 的行为,但返回类型化结果。
     *
     * @param path  - 以 / 开头的 path,如 /api/sessions
     * @param opts  - RequestInit(method/headers/body)
     */
    private fetchJson;
    /** 构造 POST application/json 请求 */
    private postJson;
    /** GET /api/health — 只检查 HTTP 状态,不解析 body(兼容纯文本响应) */
    health(): Promise<boolean>;
    /** POST /api/sessions — 创建 session,返回新 SessionId */
    createSession(): Promise<SessionId>;
    /** GET /api/sessions — 返回 SessionId 列表 */
    listSessions(): Promise<SessionId[]>;
    /** DELETE /api/sessions/{id} — 关闭 session */
    closeSession(id: SessionId): Promise<void>;
    /** GET /api/sessions/{id}/state — 当前 session 快照 */
    getSessionState(id: SessionId): Promise<SessionState>;
    /**
     * POST /api/sessions/{id}/command (body: { instruction })
     * 对齐 ttd api.js command() 的 body 形式。
     */
    submitCommand(id: SessionId, instruction: object): Promise<CommandResult>;
    /** GET /api/sessions/{id}/history — 完整历史(结构由 evorule-server 定) */
    getHistory(id: SessionId): Promise<unknown>;
    /**
     * GET /api/sessions/{id}/replay?from=&to=
     * 对齐 ttd api.js replay(): 大 session 必须用范围参数。
     *
     * @param from  起始 fact id(默认 0)
     * @param to    结束 fact id,null 表示到末尾(默认 null)
     */
    getReplay(id: SessionId, from?: number, to?: number | null): Promise<Fact[]>;
    /**
     * GET /api/sessions/{id}/facts?prefix=
     * 对齐 ttd api.js facts(): 支持 prefix 过滤(按 type 前缀)。
     */
    getFacts(id: SessionId, prefix?: string): Promise<Fact[]>;
    /** GET /api/sessions/{id}/audit — 审计链 */
    getAudit(id: SessionId): Promise<SessionAudit>;
    /**
     * GET /api/sessions/{id}/audit/verify
     * 对齐 ttd api.js 修复 4: 字段是 verified,不是 valid。
     */
    verifyAudit(id: SessionId): Promise<VerifyResult>;
    /** GET /api/sessions/{id}/audit/causal/{factId} — 因果链 */
    getCausalChain(id: SessionId, factId: number): Promise<CausalChain>;
    /**
     * GET /api/sessions/{id}/rewind?version=
     * 对齐 ttd api.js 修复 1: path 用 query ?version=N,不是 /rewind/{v}。
     */
    getStateAtVersion(id: SessionId, version: number): Promise<SessionState>;
    /**
     * GET /api/sessions/{id}/diff?a=&b=
     * 对齐 ttd api.js 修复 2: items 是数组格式 ["key", value] / ["key", old, new]
     */
    getDiff(id: SessionId, a: number, b: number): Promise<DiffResult>;
    /**
     * POST /api/sessions/fork/{parentId}?version=
     * 对齐 ttd api.js fork(): 在指定 version 处分叉出新 session。
     */
    forkSession(parentId: SessionId, version: number): Promise<SessionId>;
}
