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
export { HttpBackend } from './backend/http-backend';
export { provideBackend, useBackend, useBackendOrNull } from './backend/backend-context';
export { provideAssistant, useAssistantOrNull } from './assistant/assistant-context';
// ============================================================================
// 3. 状态 stores(跨视图共享)
// ============================================================================
export { rules, selectedRuleId, selectedRule, selectRule, addRule, updateRule, deleteRule } from './stores/rules';
export { sessions, currentSessionId, sessionState, commandHistory, isLoading, lastError, reactorVersion, refreshSessions, createSession, selectSession, submitCommand } from './stores/session';
export { auditData, verifyResult, causalSelection, auditLoading, auditError, refreshAudit, verifyAuditChain, fetchCausalChain, clearCausalSelection, resetAuditStore } from './stores/audit';
export { currentView, setView, restoreView, getViewMeta, VIEW_LIST } from './stores/view';
// ============================================================================
// 4. 视图组件(5 视图,展现 evorule 7 大本质)
// ============================================================================
export { default as RuleLibraryView } from './views/RuleLibrary/RuleLibrary.svelte';
export { default as ExecutionPadView } from './views/ExecutionPad/ExecutionPad.svelte';
export { default as StateView } from './views/StateView/StateView.svelte';
export { default as AuditView } from './views/AuditView/AuditView.svelte';
export { default as TimeTravelView } from './views/TimeTravel/TimeTravel.svelte';
// ============================================================================
// 5. L_console 预校验(G1-G7,与核心仓 TCB 对齐)
// ============================================================================
export { RuleValidator } from './validators/ruleValidator';
// ============================================================================
// 6. 版本信息
// ============================================================================
export const CONSOLE_VERSION = '0.1.1';
