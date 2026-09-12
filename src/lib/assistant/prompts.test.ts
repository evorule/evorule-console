// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 EvoRule Project
// promptTranspileFlow 单测——纯函数,断言资产上下文/schema 标识符/NL 入 prompt

import { describe, expect, test } from 'vitest';
import { promptTranspileFlow } from './prompts';
import type { FlowTranspileContext } from './types';

const CTX: FlowTranspileContext = {
  nodeTypes: [
    {
      node_type: 'approval',
      display_name: '审批',
      description: '人工审批节点',
      params_form: [
        { field_id: 'role', type: 'text' },
        { field_id: 'threshold', type: 'number' },
        { field_id: 'form_ref', type: 'scene_field', scene_ref: 'expense' },
      ],
    },
    { node_type: 'payment', display_name: '打款' },
  ],
  sceneFields: [
    { scene_id: 'expense', field_id: 'amount', path: 'expense.amount' },
    { scene_id: 'expense', field_id: 'applicant', path: 'expense.applicant' },
  ],
};

describe('promptTranspileFlow', () => {
  test('flow schema 协议标识符原样入 prompt（R5 i18n）', () => {
    const p = promptTranspileFlow('描述', CTX);
    for (const id of ['flow_id', 'version', 'nodes', 'edges', 'node_id', 'node_type', 'params', 'form_ref', 'threshold', 'guard']) {
      expect(p).toContain(id);
    }
  });

  test('资产上下文动态入 prompt（R4:node_type/字段/取值域原文）', () => {
    const p = promptTranspileFlow('描述', CTX);
    // node_types 投影
    expect(p).toContain('approval');
    expect(p).toContain('审批');
    expect(p).toContain('人工审批节点');
    expect(p).toContain('role:text');
    expect(p).toContain('form_ref:scene_field(scene_ref:expense)');
    // scene path 取值域（R2）
    expect(p).toContain('expense.amount');
    expect(p).toContain('expense.applicant');
  });

  test('用户 NL 原文入 prompt', () => {
    const nl = '员工提交报销,主管审批后财务打款';
    expect(promptTranspileFlow(nl, CTX)).toContain(nl);
  });

  test('空资产如实呈现（不虚构节点/字段）', () => {
    const p = promptTranspileFlow('描述', { nodeTypes: [], sceneFields: [] });
    expect(p).toContain('未声明 node_types 资产');
    expect(p).toContain('无已注册 path 的字段');
  });

  test('线性链与审批 guard 约束入 prompt', () => {
    const p = promptTranspileFlow('描述', CTX);
    expect(p).toContain('1 条出边');
    expect(p).toContain('"guard": "approved"');
  });

  test('few-shot 结构示例入 prompt 且标注禁止照抄（prompt 调优）', () => {
    const p = promptTranspileFlow('描述', CTX);
    // 形状示例:完整 flow 骨架(guard/formed/threshold/线性链形状)
    expect(p).toContain('expense_approval_flow');
    expect(p).toContain('"flow_id": "expense_approval_flow"');
    expect(p).toContain('"threshold": 5000');
    expect(p).toContain('"guard": "approved"');
    // 防照抄标注:示例类型是虚构占位,输出必须取白名单
    expect(p).toContain('禁止照抄');
    expect(p).toContain('禁止使用结构示例中的虚构类型');
    // 约束强化:flow_id snake_case + edges 顺序
    expect(p).toContain('snake_case');
    expect(p).toContain('edges 顺序与节点链顺序一致');
  });
});
