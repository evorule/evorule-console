// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 执行后端 — HttpBackend 单元测试
//
// 依据: docs/IMPLEMENTATION_PLAN.md 阶段1 验收项
// 测试策略:用 mock fetch 覆盖全部 15 方法 + 端点映射 + 错误处理
//   - 不依赖真实 evorule-server(可在 CI 无后端环境跑)
//   - 验证返回数据格式对齐 SPEC §1.1 数据契约
//   - 验证端点 path/method/body 对齐 SPEC §1.3
//
// 运行: npm run test:unit -- src/lib/backend/http-backend.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpBackend, HttpBackendError } from './http-backend';
// ============================================================================
// 工具:构造 mock fetch Response
// ============================================================================
function jsonResponse(body, status = 200) {
    // Response 是 lib.dom.d.ts 的复杂类型,用 unknown 中转避免严格重叠检查
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => body,
        text: async () => JSON.stringify(body),
        redirected: false,
        type: 'basic',
        url: '',
        clone() {
            return jsonResponse(body, status);
        }
    };
}
function textResponse(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: new Headers({ 'content-type': 'text/plain' }),
        json: async () => {
            throw new Error('not json');
        },
        text: async () => body,
        redirected: false,
        type: 'basic',
        url: '',
        clone() {
            return textResponse(body, status);
        }
    };
}
function makeMockFetch() {
    const calls = [];
    const routes = [];
    const fn = async (url, init) => {
        calls.push({ url, init });
        const method = (init?.method ?? 'GET').toUpperCase();
        const route = routes.find((r) => r.method === method && r.path.test(url));
        if (!route) {
            return jsonResponse({ error: `no mock route: ${method} ${url}` }, 404);
        }
        return route.handler();
    };
    return Object.assign(fn, {
        calls,
        route(method, pathMatcher, handler) {
            routes.push({ method, path: pathMatcher, handler });
        },
        reset() {
            calls.length = 0;
            routes.length = 0;
        }
    });
}
// ============================================================================
// 测试用例
// ============================================================================
describe('HttpBackend', () => {
    const baseUrl = 'http://test.local:18080';
    let backend;
    let mockFetch;
    beforeEach(() => {
        mockFetch = makeMockFetch();
        vi.stubGlobal('fetch', mockFetch);
        backend = new HttpBackend(baseUrl);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    // --------------------------------------------------------------------------
    // === 会话管理 ===
    // --------------------------------------------------------------------------
    describe('health', () => {
        it('GET /api/health 返回 ok=true 时返回 true', async () => {
            mockFetch.route('GET', /\/api\/health$/, () => jsonResponse({ status: 'ok' }));
            const ok = await backend.health();
            expect(ok).toBe(true);
            expect(mockFetch.calls[0].url).toBe(`${baseUrl}/api/health`);
        });
        it('HTTP 500 时返回 false(不抛错,health 设计为容错)', async () => {
            mockFetch.route('GET', /\/api\/health$/, () => jsonResponse({ err: 'down' }, 500));
            const ok = await backend.health();
            expect(ok).toBe(false);
        });
        it('fetch 抛错(网络问题)时返回 false', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
            const ok = await backend.health();
            expect(ok).toBe(false);
        });
    });
    describe('createSession', () => {
        it('POST /api/sessions 返回 { id } 时取 id', async () => {
            mockFetch.route('POST', /\/api\/sessions$/, () => jsonResponse({ id: 42 }));
            const id = await backend.createSession();
            expect(id).toBe(42);
            expect(mockFetch.calls[0].init?.method).toBe('POST');
        });
        it('返回裸数字时直接取值(兼容)', async () => {
            mockFetch.route('POST', /\/api\/sessions$/, () => jsonResponse(7));
            const id = await backend.createSession();
            expect(id).toBe(7);
        });
        it('HTTP 500 时抛 HttpBackendError', async () => {
            mockFetch.route('POST', /\/api\/sessions$/, () => jsonResponse({ err: 'busy' }, 500));
            await expect(backend.createSession()).rejects.toThrow(/createSession failed: 500/);
        });
        it('响应 shape 异常时抛 HttpBackendError', async () => {
            mockFetch.route('POST', /\/api\/sessions$/, () => jsonResponse({ unexpected: true }));
            await expect(backend.createSession()).rejects.toThrow(/unexpected response shape/);
        });
    });
    describe('listSessions', () => {
        it('GET /api/sessions 返回 { sessions: [1,2,3] }', async () => {
            mockFetch.route('GET', /\/api\/sessions$/, () => jsonResponse({ sessions: [1, 2, 3] }));
            const ids = await backend.listSessions();
            expect(ids).toEqual([1, 2, 3]);
        });
        it('返回裸数组时直接取(兼容)', async () => {
            mockFetch.route('GET', /\/api\/sessions$/, () => jsonResponse([5, 6]));
            const ids = await backend.listSessions();
            expect(ids).toEqual([5, 6]);
        });
        it('返回空对象时返回 []', async () => {
            mockFetch.route('GET', /\/api\/sessions$/, () => jsonResponse({}));
            const ids = await backend.listSessions();
            expect(ids).toEqual([]);
        });
    });
    describe('closeSession', () => {
        it('DELETE /api/sessions/{id}', async () => {
            mockFetch.route('DELETE', /\/api\/sessions\/42$/, () => jsonResponse({}));
            await backend.closeSession(42);
            expect(mockFetch.calls[0].url).toBe(`${baseUrl}/api/sessions/42`);
            expect(mockFetch.calls[0].init?.method).toBe('DELETE');
        });
        it('HTTP 404 时抛 HttpBackendError', async () => {
            mockFetch.route('DELETE', /\/api\/sessions\/99$/, () => jsonResponse({}, 404));
            await expect(backend.closeSession(99)).rejects.toThrow(HttpBackendError);
        });
    });
    describe('getSessionState', () => {
        it('GET /api/sessions/{id}/state 返回 SessionState', async () => {
            const state = {
                payload: { x: 1 },
                queue: [],
                reactor: {
                    phase: 'stable',
                    causal_depth: 3,
                    current_step: 5,
                    pending_io_count: 0,
                    structural_invariant_violations: 0
                },
                version: 5
            };
            mockFetch.route('GET', /\/api\/sessions\/1\/state$/, () => jsonResponse(state));
            const r = await backend.getSessionState(1);
            expect(r).toEqual(state);
            expect(r.reactor.phase).toBe('stable');
        });
    });
    // --------------------------------------------------------------------------
    // === 命令执行 ===
    // --------------------------------------------------------------------------
    describe('submitCommand', () => {
        it('POST /api/sessions/{id}/command body 是 { instruction }', async () => {
            const result = { accepted: true, version: 6 };
            mockFetch.route('POST', /\/api\/sessions\/3\/command$/, () => jsonResponse(result));
            const r = await backend.submitCommand(3, { type: 'set', key: 'foo', value: 42 });
            expect(r).toEqual(result);
            // 验证 body 形式对齐 ttd api.js: { instruction: {...} }
            const body = JSON.parse(mockFetch.calls[0].init?.body);
            expect(body).toEqual({ instruction: { type: 'set', key: 'foo', value: 42 } });
            expect(mockFetch.calls[0].init?.headers).toEqual({
                'Content-Type': 'application/json'
            });
        });
        it('command 被拒时 accepted=false', async () => {
            mockFetch.route('POST', /\/api\/sessions\/3\/command$/, () => jsonResponse({ accepted: false, error: 'invalid instruction' }));
            const r = await backend.submitCommand(3, { bad: true });
            expect(r.accepted).toBe(false);
            expect(r.error).toBe('invalid instruction');
        });
        // 2026-08-03 dogfooding 发现: evorule-server 实际返回 { success, message, fact_id }
        // 而非契约 { accepted, version },submitCommand 需适配
        it('evorule-server 响应格式 { success, message, fact_id } → accepted=true', async () => {
            mockFetch.route('POST', /\/api\/sessions\/3\/command$/, () => jsonResponse({ success: true, message: 'Command submitted', fact_id: 30000 }));
            const r = await backend.submitCommand(3, { type: 'set', params: { value: 1 } });
            expect(r.accepted).toBe(true);
            expect(r.error).toBeUndefined();
            // version 不在 command 响应中,前端通过 refreshSessionState 获取
            expect(r.version).toBeUndefined();
        });
        it('evorule-server 拒绝时 { success: false, message } → accepted=false + error', async () => {
            mockFetch.route('POST', /\/api\/sessions\/3\/command$/, () => jsonResponse({ success: false, message: 'rule validation failed' }));
            const r = await backend.submitCommand(3, { bad: true });
            expect(r.accepted).toBe(false);
            expect(r.error).toBe('rule validation failed');
        });
    });
    // --------------------------------------------------------------------------
    // === 历史 / 回放 ===
    // --------------------------------------------------------------------------
    describe('getHistory', () => {
        it('GET /api/sessions/{id}/history 透传未知结构', async () => {
            const hist = { entries: [], meta: { count: 0 } };
            mockFetch.route('GET', /\/api\/sessions\/1\/history$/, () => jsonResponse(hist));
            const r = await backend.getHistory(1);
            expect(r).toEqual(hist);
        });
    });
    describe('getReplay', () => {
        const facts = [
            { type: 'set', id: 0, key: 'x', value: 1 },
            { type: 'set', id: 1, key: 'y', value: 2 }
        ];
        it('默认 from=0,to=null → /replay?from=0', async () => {
            mockFetch.route('GET', /\/api\/sessions\/1\/replay\?from=0$/, () => jsonResponse(facts));
            const r = await backend.getReplay(1);
            expect(r).toEqual(facts);
        });
        it('指定 from/to → /replay?from=5&to=10', async () => {
            mockFetch.route('GET', /\/api\/sessions\/1\/replay\?from=5&to=10$/, () => jsonResponse(facts));
            const r = await backend.getReplay(1, 5, 10);
            expect(r).toEqual(facts);
            expect(mockFetch.calls[0].url).toContain('from=5');
            expect(mockFetch.calls[0].url).toContain('to=10');
        });
        it('返回 { facts: [...] } 时取 facts(兼容)', async () => {
            mockFetch.route('GET', /\/api\/sessions\/1\/replay/, () => jsonResponse({ facts }));
            const r = await backend.getReplay(1);
            expect(r).toEqual(facts);
        });
    });
    describe('getFacts', () => {
        it('无 prefix → /facts 不带 query', async () => {
            mockFetch.route('GET', /\/api\/sessions\/1\/facts$/, () => jsonResponse([{ type: 'set', id: 0 }]));
            const r = await backend.getFacts(1);
            expect(r).toHaveLength(1);
            expect(mockFetch.calls[0].url).not.toContain('?');
        });
        it('带 prefix → /facts?prefix=set(encodeURIComponent)', async () => {
            mockFetch.route('GET', /\/api\/sessions\/1\/facts\?prefix=set$/, () => jsonResponse([]));
            await backend.getFacts(1, 'set');
            expect(mockFetch.calls[0].url).toContain('?prefix=set');
        });
        it('prefix 含特殊字符时 URL 编码', async () => {
            mockFetch.route('GET', /\/api\/sessions\/1\/facts\?prefix=/, () => jsonResponse([]));
            await backend.getFacts(1, 'a/b c');
            // a/b c → a%2Fb%20c
            expect(mockFetch.calls[0].url).toContain('prefix=a%2Fb%20c');
        });
    });
    // --------------------------------------------------------------------------
    // === 审计 ===
    // --------------------------------------------------------------------------
    describe('getAudit', () => {
        it('GET /api/sessions/{id}/audit — fact_count + verified 字段(SPEC §1.1 修复 3)', async () => {
            const audit = {
                entries: [{ type: 'set', id: 0 }],
                fact_count: 1,
                verified: true,
                last_hash: 'abc123'
            };
            mockFetch.route('GET', /\/api\/sessions\/1\/audit$/, () => jsonResponse(audit));
            const r = await backend.getAudit(1);
            expect(r.fact_count).toBe(1);
            expect(r.verified).toBe(true);
            expect(r.last_hash).toBe('abc123');
        });
    });
    describe('verifyAudit', () => {
        it('GET /api/sessions/{id}/audit/verify — 字段是 verified(SPEC §1.1 修复 4)', async () => {
            const result = { verified: true, detail: 'all hashes match' };
            mockFetch.route('GET', /\/api\/sessions\/1\/audit\/verify$/, () => jsonResponse(result));
            const r = await backend.verifyAudit(1);
            expect(r.verified).toBe(true);
            expect(r.detail).toBe('all hashes match');
        });
    });
    describe('getCausalChain', () => {
        it('GET /api/sessions/{id}/audit/causal/{factId}', async () => {
            const chain = {
                chain: [
                    { type: 'set', id: 5 },
                    { type: 'set', id: 3 }
                ]
            };
            mockFetch.route('GET', /\/api\/sessions\/1\/audit\/causal\/5$/, () => jsonResponse(chain));
            const r = await backend.getCausalChain(1, 5);
            expect(r.chain).toHaveLength(2);
            expect(mockFetch.calls[0].url).toBe(`${baseUrl}/api/sessions/1/audit/causal/5`);
        });
    });
    // --------------------------------------------------------------------------
    // === 时间旅行 ===
    // --------------------------------------------------------------------------
    describe('getStateAtVersion', () => {
        it('GET /api/sessions/{id}/rewind?version=N — 用 query(SPEC §1.3 修复 1)', async () => {
            const state = {
                payload: { x: 1 },
                queue: [],
                reactor: {
                    phase: 'idle',
                    causal_depth: 0,
                    current_step: 0,
                    pending_io_count: 0,
                    structural_invariant_violations: 0
                },
                version: 3
            };
            mockFetch.route('GET', /\/api\/sessions\/1\/rewind\?version=3$/, () => jsonResponse(state));
            const r = await backend.getStateAtVersion(1, 3);
            expect(r.version).toBe(3);
            // 关键:不是 /rewind/3 而是 /rewind?version=3
            expect(mockFetch.calls[0].url).toContain('/rewind?version=3');
            expect(mockFetch.calls[0].url).not.toMatch(/\/rewind\/3/);
        });
    });
    describe('getDiff', () => {
        it('GET /api/sessions/{id}/diff?a=&b=', async () => {
            const diff = {
                // items 是数组格式(SPEC §1.1 修复 2):变更 [key, value],改动 [key, old, new]
                items: [
                    ['foo', 1],
                    ['bar', 'old', 'new']
                ]
            };
            mockFetch.route('GET', /\/api\/sessions\/1\/diff\?a=2&b=5$/, () => jsonResponse(diff));
            const r = await backend.getDiff(1, 2, 5);
            expect(r.items).toHaveLength(2);
            expect(r.items[0]).toEqual(['foo', 1]);
            expect(r.items[1]).toEqual(['bar', 'old', 'new']);
        });
    });
    // --------------------------------------------------------------------------
    // === What-If ===
    // --------------------------------------------------------------------------
    describe('forkSession', () => {
        it('POST /api/sessions/fork/{parentId}?version=', async () => {
            mockFetch.route('POST', /\/api\/sessions\/fork\/2\?version=4$/, () => jsonResponse({ id: 99 }));
            const newId = await backend.forkSession(2, 4);
            expect(newId).toBe(99);
            expect(mockFetch.calls[0].init?.method).toBe('POST');
            expect(mockFetch.calls[0].url).toBe(`${baseUrl}/api/sessions/fork/2?version=4`);
        });
        it('返回裸数字时直接取(兼容)', async () => {
            mockFetch.route('POST', /\/api\/sessions\/fork\/2\?version=4$/, () => jsonResponse(33));
            const newId = await backend.forkSession(2, 4);
            expect(newId).toBe(33);
        });
        it('HTTP 500 时抛 HttpBackendError', async () => {
            mockFetch.route('POST', /\/api\/sessions\/fork\/2\?version=4$/, () => jsonResponse({ err: 'cannot fork' }, 500));
            await expect(backend.forkSession(2, 4)).rejects.toThrow(/forkSession failed: 500/);
        });
    });
    // --------------------------------------------------------------------------
    // === 通用错误处理 ===
    // --------------------------------------------------------------------------
    describe('错误处理', () => {
        it('fetch 抛 TypeError 时包装为 HttpBackendError(status=0)', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('ECONNREFUSED')));
            await expect(backend.listSessions()).rejects.toMatchObject({
                name: 'HttpBackendError',
                status: 0,
                message: expect.stringContaining('network error')
            });
        });
        it('HTTP 错误时抛 HttpBackendError 含 status 和 endpoint', async () => {
            mockFetch.route('GET', /\/api\/sessions\/1\/state$/, () => jsonResponse({ err: 'not found' }, 404));
            try {
                await backend.getSessionState(1);
                throw new Error('expected getSessionState to throw HttpBackendError');
            }
            catch (e) {
                expect(e).toBeInstanceOf(HttpBackendError);
                const err = e;
                expect(err.status).toBe(404);
                expect(err.endpoint).toBe('/api/sessions/1/state');
            }
        });
    });
    // --------------------------------------------------------------------------
    // === baseUrl 处理 ===
    // --------------------------------------------------------------------------
    describe('baseUrl 处理', () => {
        it('末尾斜杠自动去除', async () => {
            mockFetch.route('GET', /\/api\/health$/, () => jsonResponse({}));
            const b = new HttpBackend('http://test.local:18080///');
            await b.health();
            expect(mockFetch.calls[0].url).toBe('http://test.local:18080/api/health');
        });
        it('默认 baseUrl 是 127.0.0.1:18080', () => {
            const b = new HttpBackend();
            // 间接验证:health 调用时的 url 应该带默认 baseUrl
            mockFetch.route('GET', /127\.0\.0\.1:18080\/api\/health$/, () => jsonResponse({}));
            void b.health();
            expect(mockFetch.calls[0].url).toBe('http://127.0.0.1:18080/api/health');
        });
    });
});
// ============================================================================
// 验收清单(对照 SPEC §1.2 的 15 方法)
// ============================================================================
//
// ✅ health              — health describe
// ✅ createSession       — createSession describe
// ✅ listSessions        — listSessions describe
// ✅ closeSession        — closeSession describe
// ✅ getSessionState     — getSessionState describe
// ✅ submitCommand       — submitCommand describe
// ✅ getHistory          — getHistory describe
// ✅ getReplay           — getReplay describe
// ✅ getFacts            — getFacts describe
// ✅ getAudit            — getAudit describe
// ✅ verifyAudit         — verifyAudit describe
// ✅ getCausalChain      — getCausalChain describe
// ✅ getStateAtVersion   — getStateAtVersion describe (rewind?version=)
// ✅ getDiff             — getDiff describe
// ✅ forkSession         — forkSession describe
//
// === 端点对齐验证(对照 SPEC §1.3 + ttd api.js 4 修复) ===
//
// ✅ rewind 用 query ?version=N(修复 1)
// ✅ diff items 是数组(修复 2,数据契约层)
// ✅ audit 字段 fact_count + verified(修复 3,数据契约层)
// ✅ verify 字段 verified(修复 4)
// ✅ submitCommand body 是 { instruction }(对齐 ttd api.js)
// ✅ fork 端点 /sessions/fork/{parentId}?version=
