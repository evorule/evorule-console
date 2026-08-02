// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// evorule-console 规则库 — 内置示例规则
//
// 设计:全部 PASS ruleValidator.ts G1-G7 预校验(对齐核心仓 T1/T2/D2)
// 用途:展示"规则即数据" — 业务专家可直接读懂、修改、扩展
//
// 这些示例遵循 evorule transform 格式:
//   {
//     "transform": [ ...rules... ],
//     末条必须是 branch + all([]) 兜底(G6)
//   }
//
// 元指令(set/push/branch/io_request)对齐 TCB_SPEC.md T1
// 域类型(eq/lt/exists/instruction/all/not)对齐 TCB_SPEC.md T2

import type { Rule } from '$lib/stores/rules';

/**
 * 3 个示例规则,从简到繁展示 evorule 规则即数据的特性。
 *
 * 示例 1(set_basic):最简单的 set 指令
 * 示例 2(branch_vip):条件分支 — VIP 客户打折
 * 示例 3(io_two_phase):IO 双路径 — 库存检查后发通知
 */
export const BUILTIN_RULES: Rule[] = [
  {
    id: 'example.set_basic',
    version: 1,
    description: '最简 set 示例 — 设置 payload.x = 1,展示元指令 set 的用法',
    source: 'builtin',
    content: JSON.stringify(
      {
        id: 'example.set_basic',
        version: 1,
        description: '最简 set 示例 — 设置 payload.x = 1',
        transform: [
          {
            type: 'set',
            params: {
              attr: '__exec__.payload.x',
              operation: 'set',
              value: 1
            }
          },
          {
            type: 'branch',
            params: {
              domain: { type: 'all', domains: [] },
              on_true: []
            }
          }
        ]
      },
      null,
      2
    ),
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z'
  },

  {
    id: 'example.branch_vip',
    version: 1,
    description: 'VIP 客户打 9 折,非 VIP 不打折 — 展示 branch + exists 域用法',
    source: 'builtin',
    content: JSON.stringify(
      {
        id: 'example.branch_vip',
        version: 1,
        description: 'VIP 客户打 9 折,非 VIP 不打折',
        transform: [
          {
            type: 'branch',
            params: {
              domain: {
                type: 'exists',
                path: '__exec__.payload.customer.is_vip'
              },
              on_true: [
                {
                  type: 'set',
                  params: {
                    attr: '__exec__.payload.order.discount',
                    operation: 'set',
                    value: 10
                  }
                }
              ],
              on_false: [
                {
                  type: 'set',
                  params: {
                    attr: '__exec__.payload.order.discount',
                    operation: 'set',
                    value: 0
                  }
                }
              ]
            }
          },
          {
            type: 'branch',
            params: {
              domain: { type: 'all', domains: [] },
              on_true: []
            }
          }
        ]
      },
      null,
      2
    ),
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z'
  },

  {
    id: 'example.io_two_phase',
    version: 1,
    description: 'IO 双路径示例 — 检查 __io_result__ 后分支发不同通知',
    source: 'builtin',
    content: JSON.stringify(
      {
        id: 'example.io_two_phase',
        version: 1,
        description: 'IO 双路径示例 — 根据 __io_result__ 分支发通知',
        transform: [
          {
            type: 'branch',
            params: {
              domain: {
                type: 'exists',
                path: '__exec__.payload.__io_result__'
              },
              on_true: [
                {
                  type: 'io_request',
                  params: {
                    io_type: 'call_external',
                    prompt: '库存充足,发确认通知'
                  }
                }
              ],
              on_false: [
                {
                  type: 'io_request',
                  params: {
                    io_type: 'call_external',
                    prompt: '库存不足,发预警通知'
                  }
                }
              ]
            }
          },
          {
            type: 'branch',
            params: {
              domain: { type: 'all', domains: [] },
              on_true: []
            }
          }
        ]
      },
      null,
      2
    ),
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z'
  }
];
