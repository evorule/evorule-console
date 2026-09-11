import type { WorkspaceBackend, WorkspaceRecord, WorkspaceMemberRecord, RuleRecord, RuleVersionRecord, SessionRecord, SandboxSession, TestDatasetRecord, PublishQueueItem, ProductionStateRecord, ProductionAuditRecord, VerdictContractRecord, VersionClockMapRecord, CreateWorkspaceRequest, UpdateWorkspaceRequest, CreateRuleRequest, UpdateRuleContentRequest, CreateSessionRequest, StartSandboxRequest, StartSandboxResponse, SubmitPublishRequest, ReviewPublishRequest, RollbackRequest, ActorIdentity, TranslateToTransformRequest, TranslateToTransformResponse, TranslateToConditionalRequest, TranslateToConditionalResponse, CreateVerdictContractRequest, UpdateVerdictContractRequest, EvaluateVerdictRequest, EvaluateVerdictResult, RecordClockRequest } from './workspace-types';
/**
 * workspace 后端连接或响应异常的统一错误类型。
 * 与 HttpBackendError 同构,独立定义避免跨依赖。
 */
export declare class HttpWorkspaceBackendError extends Error {
    readonly status: number;
    readonly endpoint: string;
    constructor(message: string, status: number, endpoint: string);
}
/**
 * HttpWorkspaceBackend — 调 evorule-server workspace HTTP API 实现 WorkspaceBackend。
 *
 * 用法:
 *   const wb = new HttpWorkspaceBackend();                        // loopback 免认证
 *   const wb = new HttpWorkspaceBackend('http://x:18080', token); // 生产带 token
 *   const wb = new HttpWorkspaceBackend('http://x:18080', token,
 *     { name: 'zhang.san', role: 'admin' });                      // 审计归属:真实操作者
 */
export declare class HttpWorkspaceBackend implements WorkspaceBackend {
    private readonly baseUrl;
    private readonly authToken;
    private readonly actor;
    /** actor 缺失回落 "console" 时只 warn 一次,避免刷屏 */
    private actorWarned;
    constructor(baseUrl?: string, authToken?: string | null, actor?: ActorIdentity | null);
    /** 构造请求头(含可选 Bearer token) */
    private headers;
    /**
     * 操作者名 — actor.name,未配置 actor 时回落 "console" 并 warn 一次。
     * 回落只应出现在 dev/演示路径;生产传入真实用户,否则 server 审计归属失真。
     */
    private requesterName;
    /**
     * 发布角色 — actor.role;actor 已配置但缺 role 时如实抛错(fail-fast)。
     * 静默回落会再次制造审计失真,此处不做。
     * 未配置 actor 时回落到各方法的历史内置值(warn 同上,仅一次)。
     */
    private publishRole;
    /** 统一 fetch + JSON 解析 + 错误处理 (与 http-backend.ts fetchJson 同构) */
    private fetchJson;
    /** 构造 POST application/json 请求 */
    private postJson;
    /** 构造 PATCH application/json 请求 */
    private patchJson;
    /** 构造带 Authorization 的 DELETE 请求 */
    private delete;
    /** GET /api/workspaces */
    listWorkspaces(): Promise<WorkspaceRecord[]>;
    /** POST /api/workspaces */
    createWorkspace(req: CreateWorkspaceRequest): Promise<WorkspaceRecord>;
    /** GET /api/workspaces/{id} */
    getWorkspace(id: string): Promise<WorkspaceRecord>;
    /** PATCH /api/workspaces/{id} */
    updateWorkspace(id: string, req: UpdateWorkspaceRequest): Promise<WorkspaceRecord>;
    /** DELETE /api/workspaces/{id} (归档) */
    archiveWorkspace(id: string): Promise<void>;
    /** GET /api/workspaces/{id}/members */
    listMembers(id: string): Promise<WorkspaceMemberRecord[]>;
    /** GET /api/workspaces/{id}/rules */
    listRules(workspaceId: string): Promise<RuleRecord[]>;
    /** POST /api/workspaces/{id}/rules */
    createRule(workspaceId: string, req: CreateRuleRequest): Promise<RuleRecord>;
    /** GET /api/workspaces/{id}/rules/{rule_id} */
    getRule(workspaceId: string, ruleId: string): Promise<RuleRecord>;
    /** PATCH /api/workspaces/{id}/rules/{rule_id} (仅 Draft 状态) */
    updateRuleContent(workspaceId: string, ruleId: string, req: UpdateRuleContentRequest): Promise<RuleRecord>;
    /** POST /api/workspaces/{id}/rules/{rule_id}/activate */
    activateRule(workspaceId: string, ruleId: string): Promise<RuleRecord>;
    /** POST /api/workspaces/{id}/rules/{rule_id}/submit (Draft→Candidate) */
    submitRule(workspaceId: string, ruleId: string): Promise<RuleRecord>;
    /** POST /api/workspaces/{id}/rules/{rule_id}/block (Active→Blocked) */
    blockRule(workspaceId: string, ruleId: string): Promise<RuleRecord>;
    /** POST /api/workspaces/{id}/rules/{rule_id}/archive */
    archiveRule(workspaceId: string, ruleId: string): Promise<RuleRecord>;
    /** GET /api/workspaces/{id}/rules/{rule_id}/versions — 列出规则全部版本(含 content, 按 version 降序) */
    listRuleVersions(workspaceId: string, ruleId: string): Promise<RuleVersionRecord[]>;
    /** GET /api/workspaces/{id}/rules/{rule_id}/versions/{version_id} — 获取规则指定版本(含 content) */
    getRuleVersion(workspaceId: string, ruleId: string, versionId: string): Promise<RuleVersionRecord>;
    /** POST /api/workspaces/{id}/sessions */
    createWorkspaceSession(workspaceId: string, req: CreateSessionRequest): Promise<SessionRecord>;
    /** GET /api/workspaces/{id}/sessions */
    listWorkspaceSessions(workspaceId: string): Promise<SessionRecord[]>;
    /** POST /api/workspaces/{id}/sandboxes */
    startSandbox(workspaceId: string, req: StartSandboxRequest): Promise<StartSandboxResponse>;
    /** GET /api/workspaces/{id}/sandboxes?requester= */
    listSandboxes(workspaceId: string): Promise<SandboxSession[]>;
    /** GET /api/workspaces/{id}/sandboxes/{sandbox_id}?requester= */
    getSandbox(workspaceId: string, sandboxId: number): Promise<SandboxSession>;
    /** POST /api/workspaces/{id}/sandboxes/{sandbox_id}/close (body: {closed_by}) */
    closeSandbox(workspaceId: string, sandboxId: number): Promise<void>;
    /** GET /api/workspaces/{id}/test-datasets */
    listTestDatasets(workspaceId: string): Promise<TestDatasetRecord[]>;
    /** GET /api/publish/queue?status= */
    listPublishQueue(status?: string): Promise<PublishQueueItem[]>;
    /** POST /api/publish/queue (body = SubmitPublishRequest + submitted_by + role) */
    submitPublish(req: SubmitPublishRequest): Promise<PublishQueueItem>;
    /** POST /api/publish/queue/{queue_id}/review (body = ReviewPublishRequest + reviewed_by + role) */
    reviewPublish(queueId: number, req: ReviewPublishRequest): Promise<PublishQueueItem>;
    /** POST /api/publish/rollback (body = RollbackRequest + operated_by + role, 紧急回滚) */
    emergencyRollback(req: RollbackRequest): Promise<void>;
    /** GET /api/production/state */
    getProductionState(): Promise<ProductionStateRecord>;
    /** GET /api/production/audit */
    listProductionAudit(): Promise<ProductionAuditRecord[]>;
    /** POST /api/rules/translate/to_transform — condition+action_set → transform */
    translateToTransform(req: TranslateToTransformRequest): Promise<TranslateToTransformResponse>;
    /** POST /api/rules/translate/to_conditional — transform → condition+action_set (可能 lossy) */
    translateToConditional(req: TranslateToConditionalRequest): Promise<TranslateToConditionalResponse>;
    /** GET /api/workspaces/{id}/verdict_contracts */
    listVerdictContracts(workspaceId: string): Promise<VerdictContractRecord[]>;
    /** POST /api/workspaces/{id}/verdict_contracts */
    createVerdictContract(workspaceId: string, req: CreateVerdictContractRequest): Promise<VerdictContractRecord>;
    /** GET /api/workspaces/{id}/verdict_contracts/{cid} */
    getVerdictContract(workspaceId: string, cid: number): Promise<VerdictContractRecord>;
    /** PATCH /api/workspaces/{id}/verdict_contracts/{cid} */
    updateVerdictContract(workspaceId: string, cid: number, req: UpdateVerdictContractRequest): Promise<VerdictContractRecord>;
    /** DELETE /api/workspaces/{id}/verdict_contracts/{cid} */
    deleteVerdictContract(workspaceId: string, cid: number): Promise<void>;
    /** POST /api/workspaces/{id}/verdict/evaluate (应用层判定,非 evorule 确定性) */
    evaluateVerdict(workspaceId: string, req: EvaluateVerdictRequest): Promise<EvaluateVerdictResult>;
    /** POST /api/sessions/{id}/clock/record */
    recordClock(sessionId: number, req: RecordClockRequest): Promise<void>;
    /** GET /api/sessions/{id}/clock/lookup?from_version=&to_version= */
    lookupClock(sessionId: number, fromVersion?: number, toVersion?: number): Promise<VersionClockMapRecord[]>;
}
