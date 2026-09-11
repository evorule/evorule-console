// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 插件契约 v1 资产面客户端 — 声明式 pack 只读 + 草稿生成
//
// 依据: Plugin Contract v1 §5（D:\knowledge\2-Projects\evorule-plugin\02-Plugin-Contract-v1.md）
// 端点对齐 evorule-server api/plugin_packs.rs:
//   - GET  /api/plugins                                          → pack 清单
//   - GET  /api/plugins/{pack_id}/assets/{kind}                  → 资产只读面（kind ∈ scenes|templates）
//   - POST /api/plugins/templates/{pack_id}/{template_id}/generate → 草稿生成纯函数（不落库,R3）
//
// 设计: 独立轻客户端（不复用 HttpWorkspaceBackend 类型）——插件资产面是
//   独立契约域；鉴权/错误处理模式与 http-workspace-backend.ts 一致。
//   默认 loopback 免认证；server 启用 --auth-token 时经 authToken 构造参数传 Bearer。
const DEFAULT_BASE_URL = 'http://127.0.0.1:18080';
/** 连接或响应异常（模式对齐 HttpWorkspaceBackendError） */
export class PluginPacksError extends Error {
    status;
    endpoint;
    constructor(message, status, endpoint) {
        super(message);
        this.name = 'PluginPacksError';
        this.status = status;
        this.endpoint = endpoint;
    }
}
/** 展示名取值:zh 优先,en 兜底,最后回退 id（console 中文 UI） */
export function dn(name, fallback) {
    if (!name)
        return fallback;
    if (typeof name.zh === 'string' && name.zh)
        return name.zh;
    if (typeof name.en === 'string' && name.en)
        return name.en;
    return fallback;
}
// ============================================================================
// 客户端
// ============================================================================
export class PluginPacksClient {
    baseUrl;
    authToken;
    constructor(baseUrl = DEFAULT_BASE_URL, authToken = null) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.authToken = authToken;
    }
    headers(extra) {
        const h = { ...extra };
        if (this.authToken) {
            h['Authorization'] = `Bearer ${this.authToken}`;
        }
        return h;
    }
    async fetchJson(path, opts = {}) {
        const url = this.baseUrl + path;
        let r;
        try {
            r = await fetch(url, {
                ...opts,
                headers: this.headers(opts.headers)
            });
        }
        catch (e) {
            throw new PluginPacksError(`network error: ${e.message}`, 0, path);
        }
        if (!r.ok) {
            const text = await r.text().catch(() => '');
            throw new PluginPacksError(`HTTP ${r.status}: ${text.slice(0, 200)}`, r.status, path);
        }
        return (await r.json());
    }
    /** GET /api/plugins — 已注册声明式 pack 清单 */
    async listPacks() {
        const j = await this.fetchJson('/api/plugins');
        return Array.isArray(j.plugins) ? j.plugins : [];
    }
    /** GET /api/plugins/{pack_id}/assets/templates — 模板资产原值 */
    async getTemplates(packId) {
        const j = await this.fetchJson(`/api/plugins/${encodeURIComponent(packId)}/assets/templates`);
        return Array.isArray(j.assets) ? j.assets : [];
    }
    /** GET /api/plugins/{pack_id}/assets/scenes — 场景资产原值 */
    async getScenes(packId) {
        const j = await this.fetchJson(`/api/plugins/${encodeURIComponent(packId)}/assets/scenes`);
        return Array.isArray(j.assets) ? j.assets : [];
    }
    /**
     * POST /api/plugins/templates/{pack_id}/{template_id}/generate — 草稿生成。
     * 纯函数面:server 不落库,草稿仅在用户确认后走既有 Draft→Publish 链（R3）。
     * 校验失败 → 400 显式错误（服务端 fail-fast 文案已面向用户,原样抛出）。
     */
    async generate(packId, templateId, form) {
        return this.fetchJson(`/api/plugins/templates/${encodeURIComponent(packId)}/${encodeURIComponent(templateId)}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
        });
    }
}
