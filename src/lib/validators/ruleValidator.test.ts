/**
 * evorule 规则预校验器测试 (L_console 层)
 *
 * 测试 7 条门禁检查 (G1-G7)
 * 门禁分层见 ./GATE_ALIGNMENT.md
 * L_console 是 UX 预校验,核心仓 L0 是最终权威。
 */

import { describe, it, expect } from 'vitest';
import { RuleValidator } from './ruleValidator';

describe('RuleValidator - L_console 预校验', () => {
  describe('G1: JSON 格式合法性', () => {
    it('应该拒绝无效的 JSON', () => {
      const invalidJson = '{ "transform": [ }';
      const result = RuleValidator.validate(invalidJson);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].gate).toBe('G1');
      expect(result.errors[0].message).toContain('JSON 格式错误');
    });

    it('应该接受有效的 JSON', () => {
      const validJson = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'all', domains: [] },
              on_true: []
            }
          }
        ]
      });
      
      const result = RuleValidator.validate(validJson);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('G2: 元指令类型合法性', () => {
    it('应该拒绝无效的元指令类型', () => {
      const json = JSON.stringify({
        transform: [
          { type: 'update', params: {} }
        ]
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.gate === 'G2')).toBe(true);
      expect(result.errors.find(e => e.gate === 'G2')?.message).toContain('无效的元指令类型');
    });

    it('应该接受所有合法的元指令类型', () => {
      // 测试 set 类型
      const setJson = JSON.stringify({
        transform: [
          { type: 'set', params: { attr: 'test', value: 1 } },
          {
            type: 'branch',
            params: {
              domain: { type: 'all', domains: [] },
              on_true: []
            }
          }
        ]
      });
      expect(RuleValidator.validate(setJson).valid).toBe(true);

      // 测试 push 类型
      const pushJson = JSON.stringify({
        transform: [
          { type: 'push', params: { instructions: [] } },
          {
            type: 'branch',
            params: {
              domain: { type: 'all', domains: [] },
              on_true: []
            }
          }
        ]
      });
      expect(RuleValidator.validate(pushJson).valid).toBe(true);

      // 测试 branch 类型
      const branchJson = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'exists', path: '__exec__.payload.test' },
              on_true: []
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
      });
      expect(RuleValidator.validate(branchJson).valid).toBe(true);

      // 测试 io_request 类型（必须在 exists(__io_result__) 分支内）
      const ioRequestJson = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'exists', path: '__exec__.payload.__io_result__' },
              on_true: [
                { type: 'set', params: { attr: 'result', value: '__exec__.payload.__io_result__' } }
              ],
              on_false: [
                { type: 'io_request', params: { io_type: 'test_io' } }
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
      });
      expect(RuleValidator.validate(ioRequestJson).valid).toBe(true);

      // 测试 collect 类型（C10: 白名单 4→6; 递归只走 branch.on_true/on_false, each 内指令层不误判）
      const collectJson = JSON.stringify({
        transform: [
          {
            type: 'collect',
            params: {
              from: '__exec__.payload.llm_response.tool_calls',
              each: { type: 'call_service', params: { service_name: '{{name}}' } }
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
      });
      expect(RuleValidator.validate(collectJson).valid).toBe(true);

      // 测试 merge 类型（ReAct 循环收口: messages + tool_result + next_instruction）
      const mergeJson = JSON.stringify({
        transform: [
          {
            type: 'merge',
            params: {
              messages: '__exec__.payload.llm_response.messages',
              tool_result: '__exec__.payload.tool_result',
              next_instruction: { type: 'call_service', params: { service_name: 'advisor' } }
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
      });
      expect(RuleValidator.validate(mergeJson).valid).toBe(true);
    });

    it('应该递归检查子指令的元指令类型', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'exists', path: '__exec__.payload.test' },
              on_true: [
                { type: 'invalid_type', params: {} }
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
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.gate === 'G2')).toBe(true);
    });
  });

  describe('G3: I/O 双路径模式', () => {
    it('应该拒绝不在 exists(__io_result__) 分支内的 io_request', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'exists', path: '__exec__.payload.is_vip' },
              on_true: [
                { type: 'io_request', params: { io_type: 'notify_vip' } }
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
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.gate === 'G3')).toBe(true);
      expect(result.errors.find(e => e.gate === 'G3')?.message).toContain('io_request 必须在 exists(__io_result__) 分支内');
    });

    it('应该接受在 exists(__io_result__) 分支内的 io_request', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'exists', path: '__exec__.payload.is_vip' },
              on_true: [
                {
                  type: 'branch',
                  params: {
                    domain: { type: 'exists', path: '__exec__.payload.__io_result__' },
                    on_true: [
                      { type: 'set', params: { attr: 'discount', value: 10 } }
                    ],
                    on_false: [
                      { type: 'io_request', params: { io_type: 'notify_vip' } }
                    ]
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
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(true);
    });
  });

  describe('G4: 域类型合法性', () => {
    it('应该拒绝无效的域类型', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'greater', path: 'amount', value: 1000 }
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
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.gate === 'G4')).toBe(true);
      expect(result.errors.find(e => e.gate === 'G4')?.message).toContain('无效的域类型');
    });

    it('应该接受所有合法的域类型', () => {
      const validTypes = ['eq', 'lt', 'exists', 'instruction', 'all', 'not'];
      
      for (const type of validTypes) {
        const domain = type === 'all' 
          ? { type: 'all', domains: [] }
          : type === 'not'
          ? { type: 'not', domain: { type: 'eq', path: 'test', value: 1 } }
          : { type, path: 'test', value: 1 };
        
        const json = JSON.stringify({
          transform: [
            {
              type: 'branch',
              params: { domain }
            },
            {
              type: 'branch',
              params: {
                domain: { type: 'all', domains: [] },
                on_true: []
              }
            }
          ]
        });
        
        const result = RuleValidator.validate(json);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('G5: 路径引用格式', () => {
    it('应该拒绝无效的路径引用格式', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'set',
            params: {
              attr: 'test',
              value: '__payload__.invalid_path'
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
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.gate === 'G5')).toBe(true);
      expect(result.errors.find(e => e.gate === 'G5')?.message).toContain('无效的路径引用格式');
    });

    it('应该接受合法的路径引用格式', () => {
      const validPaths = [
        '__exec__.payload.test',
        '__exec__.instruction.params.prompt',
        '__exec__.queue[0]',
        '__exec__.result.notify',
        '__exec__.result.approve',
        '__io_result__'
      ];
      
      for (const path of validPaths) {
        const json = JSON.stringify({
          transform: [
            {
              type: 'set',
              params: {
                attr: 'test',
                value: path
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
        });
        
        const result = RuleValidator.validate(json);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('G6: 兜底规则存在', () => {
    it('应该拒绝缺少兜底规则的规则列表', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'exists', path: '__exec__.payload.test' },
              on_true: []
            }
          }
        ]
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.gate === 'G6')).toBe(true);
      expect(result.errors.find(e => e.gate === 'G6')?.message).toContain('兜底规则');
    });

    it('应该拒绝兜底规则不是 all([]) 的情况', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'exists', path: '__exec__.payload.test' },
              on_true: []
            }
          },
          {
            type: 'branch',
            params: {
              domain: { type: 'exists', path: '__exec__.payload.other' },
              on_true: []
            }
          }
        ]
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.gate === 'G6')).toBe(true);
    });

    it('应该接受正确的兜底规则 all([])', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'exists', path: '__exec__.payload.test' },
              on_true: []
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
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(true);
    });
  });

  describe('G7: 递归深度限制', () => {
    it('应该拒绝超过 64 层嵌套的规则', () => {
      // 创建一个超过 64 层嵌套的规则
      const createDeepRule = (depth: number): any => {
        if (depth === 0) {
          return { type: 'set', params: { attr: 'test', value: 1 } };
        }
        return {
          type: 'branch',
          params: {
            domain: { type: 'exists', path: `__exec__.payload.level_${depth}` },
            on_true: [createDeepRule(depth - 1)]
          }
        };
      };
      
      const json = JSON.stringify({
        transform: [
          createDeepRule(70),
          {
            type: 'branch',
            params: {
              domain: { type: 'all', domains: [] },
              on_true: []
            }
          }
        ]
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.gate === 'G7')).toBe(true);
      expect(result.errors.find(e => e.gate === 'G7')?.message).toContain('递归深度超过 64 层');
    });

    it('应该接受 64 层以内的嵌套', () => {
      const createDeepRule = (depth: number): any => {
        if (depth === 0) {
          return { type: 'set', params: { attr: 'test', value: 1 } };
        }
        return {
          type: 'branch',
          params: {
            domain: { type: 'exists', path: `__exec__.payload.level_${depth}` },
            on_true: [createDeepRule(depth - 1)]
          }
        };
      };
      
      const json = JSON.stringify({
        transform: [
          createDeepRule(60),
          {
            type: 'branch',
            params: {
              domain: { type: 'all', domains: [] },
              on_true: []
            }
          }
        ]
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(true);
    });
  });

  describe('综合测试', () => {
    it('应该通过完整的合规规则', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'branch',
            params: {
              domain: { type: 'instruction', instruction_type: 'process_order' },
              on_true: [
                {
                  type: 'branch',
                  params: {
                    domain: { type: 'exists', path: '__exec__.payload.is_vip' },
                    on_true: [
                      {
                        type: 'branch',
                        params: {
                          domain: { type: 'exists', path: '__exec__.payload.__io_result__' },
                          on_true: [
                            { type: 'set', params: { attr: 'discount', value: 10 } }
                          ],
                          on_false: [
                            { type: 'io_request', params: { io_type: 'notify_vip' } }
                          ]
                        }
                      }
                    ],
                    on_false: [
                      { type: 'set', params: { attr: 'discount', value: 0 } }
                    ]
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
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该收集多个错误', () => {
      const json = JSON.stringify({
        transform: [
          {
            type: 'invalid_type',
            params: {
              domain: { type: 'greater', path: 'amount', value: 1000 },
              on_true: [
                { type: 'io_request', params: { io_type: 'notify' } }
              ]
            }
          }
        ]
      });
      
      const result = RuleValidator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(e => e.gate === 'G2')).toBe(true);
      expect(result.errors.some(e => e.gate === 'G3')).toBe(true);
      expect(result.errors.some(e => e.gate === 'G4')).toBe(true);
      expect(result.errors.some(e => e.gate === 'G6')).toBe(true);
    });
  });
});
