// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 插件契约 v1 资产面客户端 — 单元测试
//
// 测试策略: mock fetch 覆盖 4 方法 + 端点 path/method/鉴权头 + 错误处理
// 运行: npm run test:unit -- src/lib/backend/plugin-packs.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginPacksClient, PluginPacksError, dn } from './plugin-packs';

function jsonResponse(body: unknown, status = 200): Response {
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
  } as unknown as Response;
}

type FetchCall = { url: string; init?: RequestInit };
interface MockRouter {
  calls: FetchCall[];
  route(method: string, pathMatcher: RegExp, handler: () => Response): void;
  reset(): void;
}

function makeMockFetch(): MockRouter & ((url: string, init?: RequestInit) => Promise<Response>) {
  const calls: FetchCall[] = [];
  const routes: Array<{ method: string; path: RegExp; handler: () => Response }> = [];

  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
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
    route(method: string, pathMatcher: RegExp, handler: () => Response) {
      routes.push({ method, path: pathMatcher, handler });
    },
    reset() {
      calls.length = 0;
      routes.length = 0;
    }
  });
}

const PACKS_BODY = {
  contract_version: '1.0',
  plugins: [
    {
      id: 'finance-pack',
      contract_version: '1.0',
      version: '0.1.0',
      description: '财务域',
      capabilities: ['assets'],
      assets: { scenes: 1, templates: 2 }
    }
  ]
};

const TEMPLATE_BODY = {
  pack: 'finance-pack',
  kind: 'templates',
  assets: [
    {
      template_id: 'amount_threshold_approval',
      display_name: { zh: '金额阈值审批' },
      scene_ref: 'expense',
      params_form: [
        {
          field_id: 'threshold',
          display_name: { zh: '阈值金额' },
          type: 'number',
          required: true,
          default: 5000
        }
      ],
      rule_draft_skeleton: { id: '{{pack}}.{{template}}' }
    }
  ]
};

const SCENE_BODY = {
  pack: 'finance-pack',
  kind: 'scenes',
  assets: [
    {
      scene_id: 'expense',
      display_name: { zh: '报销场景' },
      business_objects: [
        {
          object_id: 'expense_form',
          display_name: { zh: '报销单' },
          fields: [
            {
              field_id: 'amount',
              display_name: { zh: '报销金额' },
              type: 'number',
              path: '__exec__.payload.amount'
            }
          ]
        }
      ]
    }
  ]
};

const GENERATE_BODY = {
  rule_draft: { id: 'finance-pack.amount_threshold_approval', version: 1 },
  provenance: {
    pack: 'finance-pack',
    pack_version: '0.1.0',
    template: 'amount_threshold_approval',
    contract_version: '1.0'
  }
};

describe('PluginPacksClient', () => {
  const baseUrl = 'http://test.local:18080';
  let mock: ReturnType<typeof makeMockFetch>;
  let client: PluginPacksClient;

  beforeEach(() => {
    mock = makeMockFetch();
    vi.stubGlobal('fetch', mock);
    client = new PluginPacksClient(baseUrl);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listPacks: GET /api/plugins 并解包 plugins 数组', async () => {
    mock.route('GET', /\/api\/plugins$/, () => jsonResponse(PACKS_BODY));
    const packs = await client.listPacks();
    expect(packs).toHaveLength(1);
    expect(packs[0].id).toBe('finance-pack');
    expect(packs[0].assets.templates).toBe(2);
    expect(mock.calls[0].url).toBe(`${baseUrl}/api/plugins`);
    expect(mock.calls[0].init?.method).toBeUndefined(); // GET 缺省
  });

  it('getTemplates/getScenes: 请求正确资产端点', async () => {
    mock.route('GET', /\/assets\/templates$/, () => jsonResponse(TEMPLATE_BODY));
    mock.route('GET', /\/assets\/scenes$/, () => jsonResponse(SCENE_BODY));
    const t = await client.getTemplates('finance-pack');
    const s = await client.getScenes('finance-pack');
    expect(t[0].template_id).toBe('amount_threshold_approval');
    expect(t[0].params_form[0].type).toBe('number');
    expect(s[0].scene_id).toBe('expense');
    expect(mock.calls[0].url).toBe(`${baseUrl}/api/plugins/finance-pack/assets/templates`);
    expect(mock.calls[1].url).toBe(`${baseUrl}/api/plugins/finance-pack/assets/scenes`);
  });

  it('generate: POST JSON body 到 generate 端点', async () => {
    mock.route('POST', /\/templates\/finance-pack\/amount_threshold_approval\/generate$/, () =>
      jsonResponse(GENERATE_BODY)
    );
    const result = await client.generate('finance-pack', 'amount_threshold_approval', {
      threshold: 5000
    });
    expect(result.rule_draft).toEqual(GENERATE_BODY.rule_draft);
    expect(result.provenance.pack).toBe('finance-pack');
    expect(mock.calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(mock.calls[0].init?.body))).toEqual({ threshold: 5000 });
  });

  it('authToken 非空时注入 Bearer 头', async () => {
    const authed = new PluginPacksClient(baseUrl, 'secret-token');
    mock.route('GET', /\/api\/plugins$/, () => jsonResponse(PACKS_BODY));
    await authed.listPacks();
    const headers = mock.calls[0].init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer secret-token');
  });

  it('authToken 为 null 时不注入 Authorization 头', async () => {
    mock.route('GET', /\/api\/plugins$/, () => jsonResponse(PACKS_BODY));
    await client.listPacks();
    const headers = mock.calls[0].init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('HTTP 400 抛 PluginPacksError 且带 status', async () => {
    mock.route('POST', /\/generate$/, () =>
      jsonResponse({ error: '字段 threshold 类型应为 number' }, 400)
    );
    await expect(client.generate('p', 't', {})).rejects.toMatchObject({
      name: 'PluginPacksError',
      status: 400
    });
  });

  it('网络错误 → status 0 的 PluginPacksError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    );
    const dead = new PluginPacksClient('http://127.0.0.1:1');
    await expect(dead.listPacks()).rejects.toMatchObject({
      name: 'PluginPacksError',
      status: 0
    });
  });
});

describe('dn 双语展示名', () => {
  it('zh 优先,en 兜底,无值回退 id', () => {
    expect(dn({ zh: '阈值', en: 'Threshold' }, 'f')).toBe('阈值');
    expect(dn({ en: 'Threshold' }, 'f')).toBe('Threshold');
    expect(dn({}, 'f')).toBe('f');
    expect(dn(undefined, 'f')).toBe('f');
  });
});
