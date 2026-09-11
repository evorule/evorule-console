// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console — npm 包入口(barrel export)
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段7A(双形态设计)
//
// 用途:
//   - evorule-console 自身:`npm run dev` 走 SvelteKit 应用形态,不读本文件
//   - 大众版:`import { ... } from '@evorule/console'` 通过 package.json exports 读本文件
//   - 高级版:同大众版,可 import EmbeddedBackend 替换 HttpBackend
//
// 导出原则:
//   - 公共 API(类型/接口/store 函数/视图组件)— 导出
//   - 内部实现细节(ttd 算法/内部 helper)— 不导出
//   - AssistantProvider 扩展槽(v0.1.1 加入):默认 null,大众版注入 LLM 实现

// ============================================================================
// 1. 执行后端抽象(SPEC §1.2)— 大众版/高级版实现此接口
// ============================================================================
export type {
  SessionId,
  ReactorState,
  SessionState,
  HistoricalState,
  SessionAudit,
  VerifyResult,
  Fact,
  FactRecord,
  DiffResult,
  CausalChain,
  CausalEntry,
  CommandResult,
  ExecutionBackend
} from './backend/types';

export { HttpBackend } from './backend/http-backend';
export {
  provideBackend,
  useBackend,
  useBackendOrNull
} from './backend/backend-context';

// ============================================================================
// 1.B Workspace 后端抽象(阶段 C.1)— 与 ExecutionBackend 并列
// ============================================================================
export type {
  WorkspaceBackend,
  WorkspaceRecord,
  WorkspaceMemberRecord,
  RuleRecord,
  RuleVersionRecord,
  SessionRecord,
  RuleSessionBinding,
  SandboxSession,
  TestDatasetRecord,
  PublishQueueItem,
  ProductionStateRecord,
  ProductionAuditRecord,
  VerdictContractRecord,
  VersionClockMapRecord,
  // RuleState 改从 stores/rules 导出(对前端而言 rules store 是更常用的消费入口)
  WorkspaceState,
  RuleVersionState,
  SessionBindingState,
  SandboxStatus,
  PublishStatus,
  MemberRole,
  PublishRole,
  ActorIdentity,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  AddMemberRequest,
  CreateRuleRequest,
  UpdateRuleContentRequest,
  CreateSessionRequest,
  StartSandboxRequest,
  StartSandboxResponse,
  CreateTestDatasetRequest,
  SubmitPublishRequest,
  ReviewPublishRequest,
  RollbackRequest,
  // ValidationError / ValidationResult 改从 validators/ruleValidator 导出
  // (ruleValidator 是 console 侧权威定义,workspace-types 仅作 server 契约镜像)
  TranslateToTransformRequest,
  TranslateToTransformResponse,
  TranslateToConditionalRequest,
  TranslateToConditionalResponse,
  CreateVerdictContractRequest,
  UpdateVerdictContractRequest,
  EvaluateVerdictRequest,
  EvaluateVerdictResult,
  RecordClockRequest
} from './backend/workspace-types';

export { HttpWorkspaceBackend, HttpWorkspaceBackendError } from './backend/http-workspace-backend';
export {
  provideWorkspaceBackend,
  useWorkspaceBackend,
  useWorkspaceBackendOrNull
} from './backend/workspace-context';

// ============================================================================
// 2. AssistantProvider 扩展槽(v0.1.1)— LLM 辅助接口,默认 null
// ============================================================================
// evorule-console 自身不引入 LLM 依赖,只定义扩展槽(默认 null)。
// 大众版注入 CloudLlmAssistant 实现后,视图的 LLM 按钮才渲染。
// 详见 src/lib/assistant/types.ts
export type { AssistantProvider } from './assistant/types';
export { provideAssistant, useAssistantOrNull } from './assistant/assistant-context';

// ============================================================================
// 3. 状态 stores(跨视图共享)
// ============================================================================

// --- rules store (阶段 C.2.3 重构:localStorage → WorkspaceBackend) ---
export {
  rules,
  selectedRuleId,
  selectedRule,
  migrationNeeded,
  isOffline,
  lastError as rulesError,
  refreshRules,
  selectRule,
  selectRuleLocal,
  loadRuleContent,
  addRule,
  updateRule,
  duplicateRule,
  deleteRule,
  importRule,
  exportRule,
  checkMigrationNeeded,
  migrateLegacyRules,
  getAllRules,
  getSelectedRuleId,
  isRuleReadonly,
  resetRulesStore
} from './stores/rules';
export type { Rule, RuleState } from './stores/rules';
// 注:RuleState 同时存在于 workspace-types,但前端消费入口以 stores/rules 为准

// --- workspace store (阶段 C.2.1 新增) ---
export {
  workspaces,
  currentWorkspace,
  currentWorkspaceId,
  workspaceSessions,
  workspaceSandboxes,
  publishQueue,
  productionState,
  isLoading as isWorkspaceLoading,
  lastError as workspaceError,
  refreshWorkspaces,
  ensureDefaultWorkspace,
  seedBuiltinRules,
  selectWorkspace,
  refreshPublishQueue,
  refreshProductionState,
  refreshSandboxes,
  resetWorkspaceStore
} from './stores/workspace';

// --- verdict store (阶段 C.2.2 新增) ---
export {
  verdictContracts,
  currentVerdictContract,
  lastEvaluateResult,
  isLoading as isVerdictLoading,
  lastError as verdictError,
  refreshVerdictContracts,
  evaluateVerdict,
  createVerdictContract,
  resetVerdictStore
} from './stores/verdict';

// --- session store (阶段 C.2.4 改造:createWorkspaceSession + SSE 留桩) ---
export {
  sessions,
  currentSessionId,
  currentWorkspaceSession,
  sessionState,
  commandHistory,
  isLoading as isSessionLoading,
  lastError as sessionError,
  reactorPhase,
  reactorVersion,
  reactorCausalDepth,
  reactorPendingIO,
  refreshSessions,
  createSession,
  createWorkspaceSession,
  closeSession,
  selectSession,
  refreshSessionState,
  submitCommand,
  subscribeSessionSwitched,
  resetSessionStore
} from './stores/session';
export type { CommandHistoryEntry } from './stores/session';

export {
  auditData,
  verifyResult,
  causalSelection,
  auditLoading,
  auditError,
  refreshAudit,
  verifyAuditChain,
  fetchCausalChain,
  clearCausalSelection,
  resetAuditStore
} from './stores/audit';
export type { CausalSelection } from './stores/audit';

export {
  currentView,
  setView,
  restoreView,
  getViewMeta,
  VIEW_LIST
} from './stores/view';
export type { ViewId, ViewMeta } from './stores/view';

// ============================================================================
// 4. 视图组件(5 视图,展现 evorule 7 大本质)
// ============================================================================
export { default as RuleLibraryView } from './views/RuleLibrary/RuleLibrary.svelte';
export { default as ExecutionPadView } from './views/ExecutionPad/ExecutionPad.svelte';
export { default as StateView } from './views/StateView/StateView.svelte';
export { default as AuditView } from './views/AuditView/AuditView.svelte';
export { default as TimeTravelView } from './views/TimeTravel/TimeTravel.svelte';

// ============================================================================
// 4.B 通用组件 (阶段 D.3.1)
// ============================================================================
export { default as VerdictBadge } from './components/VerdictBadge.svelte';

// ============================================================================
// 5. L_console 预校验(G1-G7,与核心仓 TCB 对齐)
// ============================================================================
export { RuleValidator } from './validators/ruleValidator';
export type { ValidationError, ValidationResult } from './validators/ruleValidator';

// ============================================================================
// 6. 版本信息
// ============================================================================
export const CONSOLE_VERSION = '0.3.0';
