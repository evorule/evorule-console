// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// 审计徽章 — header 中的 blake3 链状态指示器
//
// 职责:
//   - SESSION_SELECT: 调 /api/sessions/:id/audit 获取 verified + fact_count,更新徽章
//   - 点击徽章: 调 /api/sessions/:id/audit/verify 重新验证,更新徽章
//
// audit 响应: {session_id, fact_count, last_hash, verified, entries}
// verify 响应: {verified, session_id, fact_count, last_hash}

import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { eventbus, EVENTS } from '../core/eventbus.js';

export const AuditBadge = {
  /** 初始化:绑定点击事件 + 订阅 SESSION_SELECT */
  init() {
    const el = document.getElementById('auditBadge');
    if (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => this.verify());
    }
    eventbus.on(EVENTS.SESSION_SELECT, () => this.refresh());
  },

  /** 刷新徽章(从 /audit 读取状态) */
  async refresh() {
    const el = document.getElementById('auditBadge');
    if (!el) return;
    const id = store.getState().currentSessionId;

    if (id == null) {
      el.textContent = '🔒 —';
      el.className = 'audit-badge';
      el.title = '未选择 session';
      return;
    }

    try {
      const data = await api.audit(id);
      const verified = data.verified === true;
      const count = data.fact_count ?? 0;
      const hashShort = (data.last_hash || '').slice(0, 12);
      el.textContent = verified ? `🔒 ✓ ${count}` : `🔒 ✗ ${count}`;
      el.className = `audit-badge ${verified ? 'valid' : 'invalid'}`;
      el.title = `blake3 审计链 · ${verified ? '已验证' : '验证失败'} · ${count} facts · ${hashShort}…`;
      store.dispatch({ auditBadge: { verified, factCount: count } });
    } catch (e) {
      el.textContent = '🔒 ?';
      el.className = 'audit-badge';
      el.title = `审计状态获取失败: ${e.message}`;
    }
  },

  /** 点击徽章 → 重新验证 */
  async verify() {
    const el = document.getElementById('auditBadge');
    const id = store.getState().currentSessionId;
    if (id == null) return;

    if (el) {
      el.textContent = '⏳ 验证中...';
      el.className = 'audit-badge';
    }

    try {
      const result = await api.auditVerify(id);
      const verified = result.verified === true;
      const count = result.fact_count ?? 0;
      const hashShort = (result.last_hash || '').slice(0, 12);
      if (el) {
        el.textContent = verified ? `🔒 ✓ ${count}` : `🔒 ✗ ${count}`;
        el.className = `audit-badge ${verified ? 'valid' : 'invalid'}`;
        el.title = `blake3 审计链 · ${verified ? '已验证' : '验证失败'} · ${count} facts · ${hashShort}…`;
      }
      store.dispatch({ auditBadge: { verified, factCount: count } });
    } catch (e) {
      if (el) {
        el.textContent = '🔒 ?';
        el.className = 'audit-badge';
        el.title = `验证失败: ${e.message}`;
      }
    }
  }
};
