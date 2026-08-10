// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 判定契约 store — 应用层业务判定(非 evorule 确定性)
//
// 依据: 实施文档_界面升级_v1.0.md §C.2.2
//       设计文档/00_架构边界原则.md §六(判定契约不进审计链哈希)
//
// 设计:
//   - store 不持有 backend 实例
//   - 函数签名带 backend + workspaceId 参数
//   - 判定结果是"应用层"业务判定(通过/拦截/待定),不进 evorule 审计链
//   - 默认契约:workspace 无契约时,server 返回默认契约的 verdict

import { writable } from 'svelte/store';
import type {
  WorkspaceBackend,
  VerdictContractRecord,
  EvaluateVerdictResult
} from '$lib/backend/workspace-types';

// ============================================================================
// Stores
// ============================================================================

export const verdictContracts = writable<VerdictContractRecord[]>([]);
export const currentVerdictContract = writable<VerdictContractRecord | null>(null);
export const lastEvaluateResult = writable<EvaluateVerdictResult | null>(null);
export const isLoading = writable(false);
export const lastError = writable<string | null>(null);

// ============================================================================
// Actions
// ============================================================================

/**
 * 刷新指定 workspace 的判定契约列表。
 */
export async function refreshVerdictContracts(
  backend: WorkspaceBackend,
  workspaceId: string
): Promise<void> {
  isLoading.set(true);
  lastError.set(null);
  try {
    const list = await backend.listVerdictContracts(workspaceId);
    verdictContracts.set(list);

    // 默认选中 is_default=true 的契约,否则选第一个
    const def = list.find((c) => c.is_default) ?? list[0] ?? null;
    currentVerdictContract.set(def);
  } catch (e) {
    lastError.set(`刷新判定契约失败: ${(e as Error).message}`);
    verdictContracts.set([]);
    currentVerdictContract.set(null);
  } finally {
    isLoading.set(false);
  }
}

/**
 * 评估判定契约(应用层判定,非 evorule 确定性)。
 *
 * @param backend       workspace 后端
 * @param workspaceId   workspace id
 * @param payload       判定输入(JSON 可序列化对象)
 * @param contractId    指定契约 id(可选,缺省由 server 选默认契约)
 */
export async function evaluateVerdict(
  backend: WorkspaceBackend,
  workspaceId: string,
  payload: unknown,
  contractId?: number
): Promise<EvaluateVerdictResult | null> {
  isLoading.set(true);
  lastError.set(null);
  try {
    const result = await backend.evaluateVerdict(workspaceId, {
      payload,
      contract_id: contractId
    });
    lastEvaluateResult.set(result);
    return result;
  } catch (e) {
    lastError.set(`判定评估失败: ${(e as Error).message}`);
    return null;
  } finally {
    isLoading.set(false);
  }
}

/**
 * 创建判定契约。
 */
export async function createVerdictContract(
  backend: WorkspaceBackend,
  workspaceId: string,
  req: { name: string; rules_json: string; is_default?: boolean; created_by: string }
): Promise<VerdictContractRecord | null> {
  isLoading.set(true);
  lastError.set(null);
  try {
    const record = await backend.createVerdictContract(workspaceId, req);
    verdictContracts.update((all) => [...all, record]);
    return record;
  } catch (e) {
    lastError.set(`创建判定契约失败: ${(e as Error).message}`);
    return null;
  } finally {
    isLoading.set(false);
  }
}

/**
 * 清空所有状态。
 */
export function resetVerdictStore(): void {
  verdictContracts.set([]);
  currentVerdictContract.set(null);
  lastEvaluateResult.set(null);
  isLoading.set(false);
  lastError.set(null);
}
