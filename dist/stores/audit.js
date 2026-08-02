// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 审计 store — 审计链 + 哈希验证 + 因果追溯
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段4
// 依据: docs/SPEC.md §2.1 (可审计)
//
// 设计:
//   - store 本身不持有 backend 实例(backend 由组件注入,便于测试 mock)
//   - 与 session store 解耦:审计是只读快照,不在 submitCommand 时累积
//   - 因果链按需拉取(用户点击 fact 才查 factId 对应的 causal chain)
//
// 与 TCB 的边界(对齐 GATE_ALIGNMENT.md):
//   - 审计链 / blake3 哈希计算在 evorule 核心(tier1)完成
//   - 本 store 只是展示层:调 backend.getAudit/verifyAudit/getCausalChain
//   - 前端不重算哈希,不重写审计链,体现"TCB 纯净"
//   - verifyAudit 调用核心仓的验证接口,返回 verified 是核心仓的判断
import { writable, get } from 'svelte/store';
// ============================================================================
// Stores
// ============================================================================
/** 当前 session 的审计链快照(从 backend.getAudit 拉取) */
export const auditData = writable(null);
/** verifyAudit 的结果(从 backend.verifyAudit 拉取,null 表示未验证) */
export const verifyResult = writable(null);
export const causalSelection = writable(null);
/** 审计 loading(audit/verify/causal 任一在进行) */
export const auditLoading = writable(false);
/** 审计相关错误消息 */
export const auditError = writable(null);
// ============================================================================
// Actions
// ============================================================================
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
export async function refreshAudit(backend, id) {
    auditLoading.set(true);
    auditError.set(null);
    try {
        const data = await backend.getAudit(id);
        auditData.set(data);
        return data;
    }
    catch (e) {
        auditError.set(`获取审计链失败: ${e.message}`);
        auditData.set(null);
        return null;
    }
    finally {
        auditLoading.set(false);
    }
}
/**
 * 验证审计链(blake3 哈希链验证)。
 * 验证由核心仓完成,本函数只是把核心仓的判断展示出来。
 *
 * @param backend  执行后端
 * @param id       可选 session id
 */
export async function verifyAuditChain(backend, id) {
    auditLoading.set(true);
    auditError.set(null);
    try {
        const result = await backend.verifyAudit(id);
        verifyResult.set(result);
        // 同步更新 auditData.verified(若 auditData 已存在)
        const current = get(auditData);
        if (current) {
            auditData.set({ ...current, verified: result.verified });
        }
        return result;
    }
    catch (e) {
        auditError.set(`验证审计链失败: ${e.message}`);
        verifyResult.set(null);
        return null;
    }
    finally {
        auditLoading.set(false);
    }
}
/**
 * 拉取指定 fact 的因果链。
 * 用户在审计链列表点击某条 fact 时调用。
 *
 * @param backend  执行后端
 * @param id       session id
 * @param factId   要追溯的 fact id
 */
export async function fetchCausalChain(backend, id, factId) {
    auditLoading.set(true);
    auditError.set(null);
    try {
        const result = await backend.getCausalChain(id, factId);
        causalSelection.set({ factId, chain: result.chain });
        return result;
    }
    catch (e) {
        auditError.set(`获取因果链失败: ${e.message}`);
        causalSelection.set(null);
        return null;
    }
    finally {
        auditLoading.set(false);
    }
}
/**
 * 清空因果选择(关闭因果侧栏)。
 */
export function clearCausalSelection() {
    causalSelection.set(null);
}
/**
 * 重置审计 store(切换 session / 组件卸载时调用)。
 */
export function resetAuditStore() {
    auditData.set(null);
    verifyResult.set(null);
    causalSelection.set(null);
    auditLoading.set(false);
    auditError.set(null);
}
