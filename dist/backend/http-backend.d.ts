import type { SessionId, SessionState, HistoricalState, SessionAudit, VerifyResult, Fact, FactRecord, DiffResult, CausalChain, CommandResult, ExecutionBackend } from './types';
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
 *   const backend = new HttpBackend('http://localhost:9000', 'token'); // Bearer 认证
 *   const ok = await backend.health();
 */
export declare class HttpBackend implements ExecutionBackend {
    private readonly baseUrl;
    private readonly authToken;
    constructor(baseUrl?: string, authToken?: string | null);
    /** 构造请求头(含可选 Bearer token;模式对齐 HttpWorkspaceBackend.headers) */
    private headers;
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
    /**
     * POST /api/sessions — 创建 session,返回新 SessionId。
     *
     * C1 修复(2026-08-03):对齐 INTEGRATION_GUIDE §2.1,server 返回
     *   { session_id: number, message: string },字段名是 session_id(不是 id)。
     *   保留对裸数字 / {id} 的兜底以兼容其他实现。
     */
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
     *
     * 响应适配(2026-08-03 dogfooding 发现):
     *   evorule-server 实际返回: { success, message, fact_id }
     *   CommandResult 契约期望:   { accepted, version?, error? }
     *   这里做字段映射,兼容两种格式(优先 accepted,回退 success)。
     *   version 不在 command 响应中返回,前端通过 refreshSessionState 获取。
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
     * 对齐 ttd api.js facts(): 支持 prefix 过滤(按 path 前缀)。
     *
     * C4 修复(2026-08-03):对齐 server session_facts_by_prefix,返回 FactRecord[]
     *   (元素字段为 fact_id / version / path / value),不是完整 Fact。
     *   D-S3 后 server 已 filter 非 PayloadUpdate,不再有空对象。
     */
    getFacts(id: SessionId, prefix?: string): Promise<FactRecord[]>;
    /** GET /api/sessions/{id}/audit — 审计链 */
    getAudit(id: SessionId): Promise<SessionAudit>;
    /**
     * GET /api/sessions/{id}/audit/verify
     * 对齐 ttd api.js 修复 4: 字段是 verified,不是 valid。
     */
    verifyAudit(id: SessionId): Promise<VerifyResult>;
    /**
     * GET /api/sessions/{id}/audit/causal/{factId} — 因果链。
     * C3 修复(2026-08-03):chain 元素是审计条目 CausalEntry(fact_id / fact_type /
     *   logical_time / cause / ...),不是完整 Fact(type / id),对齐 INTEGRATION_GUIDE §3.3。
     *   server 返回 { session_id, fact_id, chain_length, chain: [...] },直接透传。
     */
    getCausalChain(id: SessionId, factId: number): Promise<CausalChain>;
    /**
     * GET /api/sessions/{id}/rewind?version=
     * 对齐 ttd api.js 修复 1: path 用 query ?version=N,不是 /rewind/{v}。
     *
     * C6/D2-A 修复(2026-08-03):rewind 是历史快照,server 不返回 reactor(无历史运行态,
     *   不编造)。返回类型从 SessionState 改为 HistoricalState(无 reactor)。
     *   server rewind 返回 { payload, queue, actual_version }(actual_version 是实际回溯版本,
     *   可能与请求 version 不同),这里映射为 HistoricalState.version。
     */
    getStateAtVersion(id: SessionId, version: number): Promise<HistoricalState>;
    /**
     * GET /api/sessions/{id}/diff?a=&b=
     * 对齐 ttd api.js 修复 2: items 是数组格式 ["key", value] / ["key", old, new]。
     * D1-B 修复(2026-08-03):server 同时返回 removed 字段(可选),DiffResult.removed 透传。
     */
    getDiff(id: SessionId, a: number, b: number): Promise<DiffResult>;
    /**
     * POST /api/sessions/fork/{parentId}?version=
     * 对齐 ttd api.js fork(): 在指定 version 处分叉出新 session。
     *
     * C2 修复(2026-08-03):对齐 server 实现,返回
     *   { session_id, parent_session_id, forked_from_version, message },
     *   字段名是 session_id(不是 id)。保留裸数字 / {id} 兜底。
     */
    forkSession(parentId: SessionId, version: number): Promise<SessionId>;
}
