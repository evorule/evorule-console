// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// 导出工具 — 将 fact log / 审计链导出为 JSONL 文件下载
//
// JSONL(每行一个 JSON)适合流式处理 + grep,符合 evorule 审计场景。
// 不修改任何 session 状态,纯只读导出。

import { api } from '../core/api.js';

export const Exporter = {
  /** 导出当前 session 的完整 fact log(JSONL) */
  async exportFacts(sessionId) {
    const data = await api.replay(sessionId);
    const arr = Array.isArray(data) ? data : (data.facts || []);
    const jsonl = arr.map(f => JSON.stringify(f)).join('\n');
    download(`session-${sessionId}-facts.jsonl`, jsonl);
  },

  /** 导出当前 session 的审计链(JSONL) */
  async exportAudit(sessionId) {
    const data = await api.audit(sessionId);
    const entries = data.entries || [];
    const meta = {
      session_id: data.session_id,
      fact_count: data.fact_count,
      last_hash: data.last_hash,
      verified: data.verified,
      exported_at: new Date().toISOString()
    };
    // 第一行是元数据,后续行是审计条目
    const lines = [JSON.stringify(meta), ...entries.map(e => JSON.stringify(e))];
    download(`session-${sessionId}-audit.jsonl`, lines.join('\n'));
  }
};

/** 触发浏览器下载 */
function download(filename, content) {
  const blob = new Blob([content], { type: 'application/jsonl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
